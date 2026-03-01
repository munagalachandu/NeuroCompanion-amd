"""
main.py
────────
NeuroCompanion Backend — FastAPI entry point.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

API docs available at:
    http://localhost:8000/docs   (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dotenv import load_dotenv
load_dotenv()

import config
from routers.simplify import router as simplify_router
from routers.quiz import router as quiz_router
# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger("neuro.main")


# ── Startup checks ───────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    providers = config.available_providers()
    if not providers:
        logger.warning(
            "⚠  No LLM API keys found in environment! "
            "Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY in .env"
        )
    else:
        logger.info(f"✓  LLM providers available (in priority order): {providers}")
    yield


# ── App ──────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroCompanion API",
    description=(
        "Backend for the NeuroCompanion learning assistant. "
        "Provides Simplify and Quiz endpoints with multi-LLM fallback."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request timing middleware ─────────────────────────────────
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000)
    response.headers["X-Response-Time-Ms"] = str(elapsed)
    return response


# ── Global error handler ─────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )


# ── Routers ──────────────────────────────────────────────────
app.include_router(simplify_router, tags=["Simplify"])
app.include_router(quiz_router,     tags=["Quiz"])


# ── Health check ─────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    providers = config.available_providers()
    return {
        "status": "ok",
        "providers_configured": providers,
        "provider_count": len(providers),
    }


# ── Root ─────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "name": "NeuroCompanion API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "POST /simplify",
            "POST /simplify/file",
            "POST /quiz/generate",
            "POST /quiz/generate/file",
            "POST /quiz/evaluate",
            "GET  /health",
        ],
    }