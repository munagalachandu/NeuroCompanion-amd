"""
services/llm.py
───────────────
Multi-LLM orchestrator — 100% free providers, automatic fallback.

Priority:
  1. Groq   — free tier, OpenAI-compatible, ultra-fast (LPU inference)
  2. Google — free tier Gemini 1.5 Flash, 1M tokens/day
  3. Ollama — local, no key, works offline

All three use the same call signature so adding/removing providers is trivial.

Public API:
    text  = await llm_complete(system, user, temperature, max_tokens)
    data  = await llm_complete_json(system, user, temperature, max_tokens)
"""

import asyncio
import json
import logging

import config
import os

# =============================
# CORS
# =============================
ALLOWED_ORIGINS = ["*"]
MAX_FILE_CHARS = 20000

# =============================
# GROQ (FASTEST FREE)
# =============================
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "llama-3.1-8b-instant"


# =============================
# GOOGLE GEMINI (FREE)
# =============================
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_MODEL = "models/gemini-1.5-flash"


# =============================
# OLLAMA (LOCAL OPTIONAL)
# =============================
OLLAMA_ENABLED = os.getenv("OLLAMA_ENABLED", "false").lower() == "true"
OLLAMA_BASE_URL = "http://localhost:11434/v1"
OLLAMA_MODEL = "llama3"


# =============================
# PROVIDER SELECTOR
# =============================
def available_providers():
    providers = []

    if GROQ_API_KEY:
        providers.append("groq")

    if GOOGLE_API_KEY:
        providers.append("google")

    if OLLAMA_ENABLED:
        providers.append("ollama")

    return providers
logger = logging.getLogger("neuro.llm")


# ─────────────────────────────────────────────────────────────
# Provider 1 — Groq
# OpenAI-compatible → we use the openai SDK pointed at Groq's base URL.
# Free tier: 14,400 requests/day, 500k tokens/min (as of mid-2025).
# Sign up:   https://console.groq.com  — no card needed.
# ─────────────────────────────────────────────────────────────

async def _call_groq(system: str, user: str, temperature: float, max_tokens: int) -> str:
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise RuntimeError("openai package not installed — run: pip install openai")

    client = AsyncOpenAI(
        api_key=config.GROQ_API_KEY,
        base_url=config.GROQ_BASE_URL,
    )
    response = await client.chat.completions.create(
        model=config.GROQ_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    )
    return response.choices[0].message.content.strip()


# ─────────────────────────────────────────────────────────────
# Provider 2 — Google Gemini
# Free tier: 15 RPM, 1,000,000 tokens/day (Gemini 1.5 Flash).
# Sign up:   https://aistudio.google.com → "Get API key" — no card.
# ─────────────────────────────────────────────────────────────

async def _call_google(system: str, user: str, temperature: float, max_tokens: int) -> str:
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError(
            "google-generativeai package not installed — run: pip install google-generativeai"
        )

    genai.configure(api_key=config.GOOGLE_API_KEY)

    model = genai.GenerativeModel(
        model_name=config.GOOGLE_MODEL,
        system_instruction=system,
        generation_config=genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )

    # Google SDK is synchronous — run in executor to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None, lambda: model.generate_content(user)
    )
    return response.text.strip()


# ─────────────────────────────────────────────────────────────
# Provider 3 — Ollama (local)
# Zero cost, no API key, fully private — runs models on your machine.
# Install:  https://ollama.com/download
# Pull:     ollama pull llama3.1   (or gemma2, mistral, phi3, etc.)
# Ollama exposes an OpenAI-compatible API on localhost:11434.
# ─────────────────────────────────────────────────────────────

async def _call_ollama(system: str, user: str, temperature: float, max_tokens: int) -> str:
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise RuntimeError("openai package not installed — run: pip install openai")

    client = AsyncOpenAI(
        api_key="ollama",                   # Ollama ignores this but the SDK requires it
        base_url=config.OLLAMA_BASE_URL,
    )
    response = await client.chat.completions.create(
        model=config.OLLAMA_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    )
    return response.choices[0].message.content.strip()


# ─────────────────────────────────────────────────────────────
# Provider dispatch table
# ─────────────────────────────────────────────────────────────

_PROVIDERS = {
    "groq":   _call_groq,
    "google": _call_google,
    "ollama": _call_ollama,
}


# ─────────────────────────────────────────────────────────────
# Public interface
# ─────────────────────────────────────────────────────────────

async def llm_complete(
    system: str,
    user: str,
    temperature: float = 0.4,
    max_tokens: int = 1500,
) -> str:
    """
    Try each configured provider in priority order (Groq → Google → Ollama).
    Returns the first successful text response.
    Raises RuntimeError with details from all providers if every one fails.
    """
    providers = config.available_providers()

    if not providers:
        raise RuntimeError(
            "No LLM providers are configured or enabled.\n"
            "Options (all free):\n"
            "  • Groq:   set GROQ_API_KEY in .env  →  https://console.groq.com\n"
            "  • Gemini: set GOOGLE_API_KEY in .env →  https://aistudio.google.com\n"
            "  • Ollama: set OLLAMA_ENABLED=true    →  https://ollama.com"
        )

    errors: dict[str, str] = {}

    for name in providers:
        fn = _PROVIDERS[name]
        try:
            logger.info(f"LLM attempt → {name} ({_model_name(name)})")
            result = await fn(system, user, temperature, max_tokens)
            logger.info(f"LLM success ← {name} ({len(result)} chars)")
            return result
        except Exception as exc:
            logger.warning(f"LLM failed  ✗ {name}: {exc}")
            errors[name] = str(exc)

    # All providers failed
    error_summary = " | ".join(f"{k}: {v}" for k, v in errors.items())
    raise RuntimeError(f"All LLM providers failed. Errors: {error_summary}")


async def llm_complete_json(
    system: str,
    user: str,
    temperature: float = 0.2,
    max_tokens: int = 2000,
) -> dict:
    """
    Same as llm_complete but strips markdown fences and parses JSON.

    Note on temperature: lower = more deterministic = better JSON reliability.
    Groq with Llama 3.1 and low temperature is very reliable for JSON output.
    Google Gemini occasionally wraps output in ```json``` — stripped automatically.
    """
    raw = await llm_complete(system, user, temperature, max_tokens)

    # Strip ```json … ``` or ``` … ``` wrappers that some models add
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Drop first line (```json or ```) and last closing ```
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        cleaned = "\n".join(inner).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error(f"JSON parse failed.\nRaw response:\n{raw[:600]}")
        raise ValueError(
            f"LLM returned invalid JSON: {exc}. "
            f"Raw (first 300 chars): {raw[:300]}"
        )


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _model_name(provider: str) -> str:
    """Return the model name for a given provider, for logging."""
    return {
        "groq":   config.GROQ_MODEL,
        "google": config.GOOGLE_MODEL,
        "ollama": config.OLLAMA_MODEL,
    }.get(provider, "unknown")
