"""
routers/quiz.py
───────────────
Endpoints:
    POST /quiz/generate        — generate questions from plain text (JSON body)
    POST /quiz/generate/file   — generate questions from an uploaded file
    POST /quiz/evaluate        — evaluate submitted answers

Generate response shape:
    {
        "source_summary":    str,       # one-line description of the source
        "questions":         list,      # question objects (schema varies by type)
        "question_type":     str,       # mcq | true_false | fill_blank | short_answer
        "num_questions":     int,       # actual count returned
        "source":            str,       # "text" or "file"
        "original_filename": str        # file uploads only
    }

Evaluate response shape (from LLM, passed through):
    {
        "results":    list[{id, correct, user_answer, correct_answer, explanation}],
        "score":      int,
        "total":      int,
        "percentage": int,
        "grade":      str,
        "study_tip":  str
    }

The server is stateless — the full question objects (including correct answers)
must be sent with every /quiz/evaluate request.
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import config
from services.file_parser import extract_text
from services.llm import llm_complete_json
from services.prompts import (
    QUIZ_EVALUATE_SYSTEM,
    QUIZ_GENERATE_SYSTEM,
    quiz_evaluate_user_prompt,
    quiz_generate_user_prompt,
)

router = APIRouter()
logger = logging.getLogger("neuro.quiz")

QuestionType = Literal["mcq", "true_false", "fill_blank", "short_answer"]
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# Required top-level keys in the LLM's evaluate response
_REQUIRED_EVAL_KEYS = {"results", "score", "total", "percentage", "grade"}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    text: str = Field(
        ..., min_length=20, max_length=50_000,
        description="Source text to generate questions from."
    )
    question_type: QuestionType = Field(
        "mcq",
        description="Type of questions to generate."
    )
    num_questions: int = Field(
        default=3, ge=1, le=20,
        description="Number of questions to generate (1–20)."
    )


class AnswerItem(BaseModel):
    id: int = Field(..., description="Question ID (must match the question object).")
    answer: str = Field("", description="The student's answer.")


class EvaluateRequest(BaseModel):
    questions: list[dict] = Field(
        ..., min_length=1,
        description="Full question objects as returned by /quiz/generate (with correct answers)."
    )
    answers: list[AnswerItem] = Field(
        ..., min_length=1,
        description="Student answers, one per question, in the same order."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Shared generate logic
# ─────────────────────────────────────────────────────────────────────────────

async def _run_generate(
    text: str,
    question_type: QuestionType,
    num_questions: int,
    source: str,
    original_filename: Optional[str] = None,
) -> dict:
    # Trim to configured char cap
    if len(text) > config.MAX_FILE_CHARS:
        logger.info(
            f"Text trimmed {len(text)} → {config.MAX_FILE_CHARS} chars "
            f"(source: {source})"
        )
        text = text[: config.MAX_FILE_CHARS] + "\n\n[… content trimmed for length …]"

    if not text.strip():
        raise HTTPException(status_code=422, detail="The extracted text is empty.")

    try:
        data = await llm_complete_json(
            system=QUIZ_GENERATE_SYSTEM,
            user=quiz_generate_user_prompt(text, question_type, num_questions),
            temperature=0.25,   # low = more deterministic JSON
            max_tokens=2800,    # generous — 10 short_answer questions can be large
        )
    except RuntimeError as exc:
        logger.error(f"LLM failure in /quiz/generate: {exc}")
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        # JSON parse failed after retry
        logger.error(f"JSON parse failure in /quiz/generate: {exc}")
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI returned a malformed response. "
                "Please try again — this is usually a one-off issue."
            ),
        )

    questions = data.get("questions")
    if not questions or not isinstance(questions, list):
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI response was missing the 'questions' field. "
                "Please try again."
            ),
        )

    result: dict = {
        "source_summary": data.get("source_summary", ""),
        "questions": questions,
        "question_type": question_type,
        "num_questions": len(questions),
        "source": source,
    }
    if original_filename:
        result["original_filename"] = original_filename

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Route 1 — generate from JSON text
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/quiz/generate",
    summary="Generate quiz questions from text",
)
async def quiz_generate(body: GenerateRequest):
    """Generate quiz questions from plain text sent as a JSON body."""
    result = await _run_generate(
        text=body.text,
        question_type=body.question_type,
        num_questions=body.num_questions,
        source="text",
    )
    return JSONResponse(content=result)


# ─────────────────────────────────────────────────────────────────────────────
# Route 2 — generate from uploaded file
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/quiz/generate/file",
    summary="Generate quiz questions from an uploaded file",
)
async def quiz_generate_file(
    file: UploadFile = File(..., description="Source file (.pdf, .docx, .txt, .md)"),
    question_type: QuestionType = Form("mcq"),
    num_questions: int = Form(3),
):
    """
    Upload a document and generate quiz questions from its content.
    Supported formats: .pdf, .docx, .txt, .md (max 10 MB).
    """
    content = await file.read()

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large ({len(content) // 1024} KB). Maximum allowed size is 10 MB.",
        )

    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    # Clamp num_questions to valid range in case it comes in wrong via form
    num_questions = max(1, min(num_questions, 20))

    try:
        text = extract_text(file.filename or "upload.txt", content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = await _run_generate(
        text=text,
        question_type=question_type,
        num_questions=num_questions,
        source="file",
        original_filename=file.filename,
    )
    return JSONResponse(content=result)


# ─────────────────────────────────────────────────────────────────────────────
# Route 3 — evaluate answers
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/quiz/evaluate",
    summary="Evaluate student answers",
)
async def quiz_evaluate(body: EvaluateRequest):
    """
    Evaluate a set of student answers against the original questions.

    The full question objects (including correct answers / model_answers) must
    be sent with this request — the server stores no session state.
    """
    if len(body.questions) != len(body.answers):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Question/answer count mismatch: "
                f"{len(body.questions)} question(s) but "
                f"{len(body.answers)} answer(s) provided. "
                f"Send one answer per question."
            ),
        )

    answers_dicts = [a.model_dump() for a in body.answers]

    try:
        data = await llm_complete_json(
            system=QUIZ_EVALUATE_SYSTEM,
            user=quiz_evaluate_user_prompt(body.questions, answers_dicts),
            temperature=0.15,   # very low — grading should be consistent
            max_tokens=2200,
        )
    except RuntimeError as exc:
        logger.error(f"LLM failure in /quiz/evaluate: {exc}")
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        logger.error(f"JSON parse failure in /quiz/evaluate: {exc}")
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI returned a malformed evaluation response. "
                "Please try again."
            ),
        )

    # Validate that all required top-level keys are present
    missing = _REQUIRED_EVAL_KEYS - set(data.keys())
    if missing:
        logger.error(f"Evaluate response missing keys: {missing}. Data: {data}")
        raise HTTPException(
            status_code=502,
            detail=(
                f"The AI response was missing required fields: {sorted(missing)}. "
                "Please try again."
            ),
        )

    return JSONResponse(content=data)


# ─────────────────────────────────────────────────────────────────────────────
# Route 4 — __init__.py placeholder
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/quiz/validate",
    include_in_schema=False,   # hidden from Swagger — dev/health use only
)
async def quiz_validate():
    """
    Lightweight check that the quiz router is wired up correctly.
    Returns provider list — does NOT make any LLM calls.
    """
    return {"status": "ok", "providers": config.available_providers()}