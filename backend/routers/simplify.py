"""
routers/simplify.py
────────────────────
Endpoints:
    POST /simplify        — simplify plain text (JSON body)
    POST /simplify/file   — simplify uploaded file (multipart/form-data)

Both return:
    {
        "output":            str,            # simplified text from the LLM
        "mode":              str,            # paragraph | bullet | keywords | summary | steps
        "dyslexic_mode":     bool,
        "char_count":        int,            # length of text sent to LLM
        "source":            "text" | "file",
        "original_filename": str             # file uploads only
    }
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import config
from services.file_parser import extract_text
from services.llm import llm_complete
from services.prompts import SIMPLIFY_SYSTEM, simplify_user_prompt

router = APIRouter()
logger = logging.getLogger("neuro.simplify")

SimplifyMode = Literal["paragraph", "bullet", "keywords", "summary", "steps"]
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


# ─────────────────────────────────────────────────────────────────────────────
# Request schema (JSON body route)
# ─────────────────────────────────────────────────────────────────────────────

class SimplifyRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50_000,
                      description="The text to simplify.")
    mode: SimplifyMode = Field("paragraph",
                               description="Output format mode.")
    dyslexic_mode: bool = Field(False,
                                description="Enable dyslexic-friendly output.")
    reading_level: str = Field("simple",
                               description="Reserved for future use.")


# ─────────────────────────────────────────────────────────────────────────────
# Shared processing logic
# ─────────────────────────────────────────────────────────────────────────────

async def _run_simplify(
    text: str,
    mode: SimplifyMode,
    dyslexic_mode: bool,
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
        output = await llm_complete(
            system=SIMPLIFY_SYSTEM,
            user=simplify_user_prompt(text, mode, dyslexic_mode),
            temperature=0.45,
            max_tokens=1800,
        )
    except RuntimeError as exc:
        logger.error(f"LLM failure in /simplify: {exc}")
        raise HTTPException(status_code=503, detail=str(exc))

    result: dict = {
        "output": output,
        "mode": mode,
        "dyslexic_mode": dyslexic_mode,
        "char_count": len(text),
        "source": source,
    }
    if original_filename:
        result["original_filename"] = original_filename

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Route 1 — JSON body
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/simplify",
    summary="Simplify plain text",
    response_description="Simplified text in the requested format",
)
async def simplify_text(body: SimplifyRequest):
    """Simplify plain text sent as a JSON body."""
    result = await _run_simplify(
        text=body.text,
        mode=body.mode,
        dyslexic_mode=body.dyslexic_mode,
        source="text",
    )
    return JSONResponse(content=result)


# ─────────────────────────────────────────────────────────────────────────────
# Route 2 — File upload
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/simplify/file",
    summary="Simplify an uploaded file",
    response_description="Simplified text extracted from the file",
)
async def simplify_file(
    file: UploadFile = File(..., description="File to simplify (.pdf, .docx, .txt, .md)"),
    mode: SimplifyMode = Form("paragraph"),
    dyslexic_mode: bool = Form(False),
):
    """
    Upload a document and simplify its content.
    Supported formats: .pdf, .docx, .txt, .md (max 10 MB).
    PDF text is extracted server-side — no third-party OCR needed for text-based PDFs.
    """
    content = await file.read()

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large ({len(content) // 1024} KB). Maximum allowed size is 10 MB.",
        )

    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    try:
        text = extract_text(file.filename or "upload.txt", content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = await _run_simplify(
        text=text,
        mode=mode,
        dyslexic_mode=dyslexic_mode,
        source="file",
        original_filename=file.filename,
    )
    return JSONResponse(content=result)