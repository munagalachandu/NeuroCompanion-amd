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
        "original_filename": str,       # file uploads only
        "rag_chunks_used":   int        # RAG chunks used to ground question generation
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

RAG flow (generate routes):
  1. Full text → chunk → embed (sentence-transformers, local CPU).
  2. Retrieve top-k chunks most relevant to exam-question topics.
  3. Inject retrieved passages into the LLM prompt as priority context.
  4. LLM generates questions grounded in source → no hallucinated facts.

The server is stateless — full question objects (including correct answers)
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
from services.rag import build_rag_context, RAG_QUERY_QUIZ

router = APIRouter()
logger = logging.getLogger("neuro.quiz")

QuestionType = Literal["mcq", "true_false", "fill_blank", "short_answer"]
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

_REQUIRED_EVAL_KEYS = {"results", "score", "total", "percentage", "grade"}

# RAG settings for quiz generation
RAG_TOP_K        = 8      
RAG_MAX_CONTEXT  = 5500   
# Pydantic schemas

class GenerateRequest(BaseModel):
    text: str = Field(
        ..., min_length=20, max_length=50_000,
        description="Source text to generate questions from.",
    )
    question_type: QuestionType = Field(
        "mcq",
        description="Type of questions to generate.",
    )
    num_questions: int = Field(
        default=3, ge=1, le=20,
        description="Number of questions to generate (1–20).",
    )


class AnswerItem(BaseModel):
    id:     int = Field(..., description="Question ID (must match the question object).")
    answer: str = Field("",  description="The student's answer.")


class EvaluateRequest(BaseModel):
    questions: list[dict] = Field(
        ..., min_length=1,
        description="Full question objects as returned by /quiz/generate (with correct answers).",
    )
    answers: list[AnswerItem] = Field(
        ..., min_length=1,
        description="Student answers, one per question, in the same order.",
    )

# Shared generate logic


async def _run_generate(
    text:              str,
    question_type:     QuestionType,
    num_questions:     int,
    source:            str,
    original_filename: Optional[str] = None,
) -> dict:
    # ── 1. Trim raw text ─────────────────────────────────────
    if len(text) > config.MAX_FILE_CHARS:
        logger.info(
            f"Text trimmed {len(text)} → {config.MAX_FILE_CHARS} chars "
            f"(source: {source})"
        )
        text = text[: config.MAX_FILE_CHARS] + "\n\n[… content trimmed for length …]"

    if not text.strip():
        raise HTTPException(status_code=422, detail="The extracted text is empty.")

    # ── 2. RAG — retrieve exam-relevant passages ──────────────
    
    logger.info(f"[quiz/generate] Running RAG retrieval (source={source}) …")
    rag_context = build_rag_context(
        text              = text,
        query             = RAG_QUERY_QUIZ,
        top_k             = RAG_TOP_K,
        max_context_chars = RAG_MAX_CONTEXT,
    )
    chunks_used = rag_context.count("\n\n---\n\n") + 1 if rag_context else 0
    logger.info(f"[quiz/generate] RAG returned ~{chunks_used} chunk(s)")

    # ── 3. LLM call — generate questions ─────────────────────
    try:
        data = await llm_complete_json(
            system      = QUIZ_GENERATE_SYSTEM,
            user        = quiz_generate_user_prompt(text, question_type, num_questions, rag_context),
            temperature = 0.25,   
            max_tokens  = 2800,
        )
    except RuntimeError as exc:
        logger.error(f"LLM failure in /quiz/generate: {exc}")
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        logger.error(f"JSON parse failure in /quiz/generate: {exc}")
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI returned a malformed response. "
                "Please try again — this is usually a one-off issue."
            ),
        )

    # ── 4. Validate LLM output ────────────────────────────────
    questions = data.get("questions")
    if not questions or not isinstance(questions, list):
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI response was missing the 'questions' field. "
                "Please try again."
            ),
        )

    # ── 5. Build response ─────────────────────────────────────
    result: dict = {
        "source_summary":  data.get("source_summary", ""),
        "questions":       questions,
        "question_type":   question_type,
        "num_questions":   len(questions),
        "source":          source,
        "rag_chunks_used": chunks_used,
    }
    if original_filename:
        result["original_filename"] = original_filename

    return result

# Route 1 — generate from JSON text

@router.post(
    "/quiz/generate",
    summary="Generate quiz questions from text (RAG-powered)",
)
async def quiz_generate(body: GenerateRequest):
    """
    Generate quiz questions from plain text sent as a JSON body.

    RAG pipeline retrieves the most educationally important passages from
    your text so questions focus on what actually matters — not boilerplate.
    """
    result = await _run_generate(
        text          = body.text,
        question_type = body.question_type,
        num_questions = body.num_questions,
        source        = "text",
    )
    return JSONResponse(content=result)

# Route 2 — generate from uploaded file

@router.post(
    "/quiz/generate/file",
    summary="Generate quiz questions from an uploaded file (RAG-powered)",
)
async def quiz_generate_file(
    file:          UploadFile = File(..., description="Source file (.pdf, .docx, .txt, .md)"),
    question_type: QuestionType = Form("mcq"),
    num_questions: int          = Form(3),
):
    """
    Upload a document and generate quiz questions from its content.

    Supported formats: .pdf, .docx, .txt, .md (max 10 MB).

    RAG pipeline:
      1. Extract text from file.
      2. Chunk + embed locally (no external API needed).
      3. Retrieve top passages relevant to exam topics.
      4. LLM generates questions grounded in those passages — factually accurate.
    """
    content = await file.read()

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File is too large ({len(content) // 1024} KB). "
                "Maximum allowed size is 10 MB."
            ),
        )

    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    # Clamp num_questions to valid range in case form data comes in wrong
    num_questions = max(1, min(num_questions, 20))

    try:
        text = extract_text(file.filename or "upload.txt", content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = await _run_generate(
        text              = text,
        question_type     = question_type,
        num_questions     = num_questions,
        source            = "file",
        original_filename = file.filename,
    )
    return JSONResponse(content=result)

# Route 3 — evaluate answers

@router.post(
    "/quiz/evaluate",
    summary="Evaluate student answers",
)
async def quiz_evaluate(body: EvaluateRequest):
    """
    Evaluate a set of student answers against the original questions.

    The full question objects (including correct answers / model_answers) must
    be sent with this request — the server stores no session state.

    No RAG needed here: the questions already contain all necessary context.
    """
    if len(body.questions) != len(body.answers):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Question/answer count mismatch: "
                f"{len(body.questions)} question(s) but "
                f"{len(body.answers)} answer(s) provided. "
                "Send one answer per question."
            ),
        )

    answers_dicts = [a.model_dump() for a in body.answers]

    try:
        data = await llm_complete_json(
            system      = QUIZ_EVALUATE_SYSTEM,
            user        = quiz_evaluate_user_prompt(body.questions, answers_dicts),
            temperature = 0.15,    # very low — grading should be consistent
            max_tokens  = 2200,
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

    # Validate all required top-level keys are present
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

# Route 4 — health / validation (hidden from Swagger)

@router.post(
    "/quiz/validate",
    include_in_schema=False,
)
async def quiz_validate():
    """
    Lightweight check that the quiz router + RAG deps are wired up correctly.
    Does NOT make any LLM calls.
    """
    rag_status = "ok"
    try:
        from services.rag import _get_embedder, chunk_text
        chunk_text("test sentence for validation check")
    except Exception as exc:
        rag_status = f"error: {exc}"

    return {
        "status":     "ok",
        "providers":  config.available_providers(),
        "rag_status": rag_status,
    }