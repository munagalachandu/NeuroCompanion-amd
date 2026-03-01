"""
services/llm.py
───────────────
Multi-LLM orchestrator with automatic fallback — 100% free providers.

Priority order:
  1. Groq   — free tier, OpenAI-compatible, ultra-fast LPU inference
              sign up: https://console.groq.com (no card required)
  2. Google — free tier Gemini 1.5 Flash, 15 RPM, 1M tokens/day
              sign up: https://aistudio.google.com
  3. Ollama — fully local, zero cost, no API key, works offline
              install:  https://ollama.com  then: ollama pull llama3.1

Public API:
    text = await llm_complete(system, user, temperature, max_tokens)
    data = await llm_complete_json(system, user, temperature, max_tokens)

llm_complete_json() includes one automatic retry on JSON parse failure,
since free/local models occasionally produce malformed JSON on first attempt.
"""

import asyncio
import json
import logging

import config

logger = logging.getLogger("neuro.llm")


# ─────────────────────────────────────────────────────────────────────────────
# Provider 1 — Groq
#
# Uses the openai SDK pointed at Groq's OpenAI-compatible endpoint.
# Free tier: 14,400 req/day, 500k tokens/min (as of 2025).
# Best model for this use case: llama-3.1-70b-versatile
# ─────────────────────────────────────────────────────────────────────────────

async def _call_groq(system: str, user: str, temperature: float, max_tokens: int) -> str:
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise RuntimeError(
            "openai package not installed. Run: pip install openai"
        )

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


# ─────────────────────────────────────────────────────────────────────────────
# Provider 2 — Google Gemini
#
# Free tier: 15 RPM, 1,000,000 tokens/day (Gemini 1.5 Flash).
# Uses the native google-generativeai SDK.
# The SDK is synchronous so we run it in an executor to avoid blocking.
# ─────────────────────────────────────────────────────────────────────────────

async def _call_google(system: str, user: str, temperature: float, max_tokens: int) -> str:
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError(
            "google-generativeai not installed. Run: pip install google-generativeai"
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

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None, lambda: model.generate_content(user)
    )
    return response.text.strip()


# ─────────────────────────────────────────────────────────────────────────────
# Provider 3 — Ollama (local)
#
# Runs models entirely on your machine — no API key, no cost, no data leaves.
# Ollama exposes an OpenAI-compatible API on localhost:11434 by default.
# Install: https://ollama.com/download
# Pull:    ollama pull llama3.1   (or mistral, gemma2, phi3, etc.)
# Enable:  set OLLAMA_ENABLED=true in .env
# ─────────────────────────────────────────────────────────────────────────────

async def _call_ollama(system: str, user: str, temperature: float, max_tokens: int) -> str:
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise RuntimeError(
            "openai package not installed. Run: pip install openai"
        )

    client = AsyncOpenAI(
        api_key="ollama",                 # Ollama ignores this, but the SDK requires a value
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


# ─────────────────────────────────────────────────────────────────────────────
# Provider dispatch table
# ─────────────────────────────────────────────────────────────────────────────

_PROVIDERS: dict[str, callable] = {
    "groq":   _call_groq,
    "google": _call_google,
    "ollama": _call_ollama,
}


# ─────────────────────────────────────────────────────────────────────────────
# Public: llm_complete
# ─────────────────────────────────────────────────────────────────────────────

async def llm_complete(
    system: str,
    user: str,
    temperature: float = 0.4,
    max_tokens: int = 1500,
) -> str:
    """
    Call the first available provider. Falls back to the next if one fails.
    Provider order: Groq → Google → Ollama (set by config.available_providers()).

    Returns:
        The model's raw text response as a str.

    Raises:
        RuntimeError: If no providers are configured, or all configured providers fail.
                      The error includes details from each failed provider.
    """
    providers = config.available_providers()

    if not providers:
        raise RuntimeError(
            "No LLM providers are configured. "
            "Add at least one free key to your .env file:\n"
            "  GROQ_API_KEY=...      →  https://console.groq.com\n"
            "  GOOGLE_API_KEY=...    →  https://aistudio.google.com\n"
            "  OLLAMA_ENABLED=true   →  https://ollama.com (no key needed)"
        )

    errors: dict[str, str] = {}

    for name in providers:
        fn = _PROVIDERS[name]
        model = _model_label(name)
        try:
            logger.info(f"LLM → {name} ({model})")
            result = await fn(system, user, temperature, max_tokens)
            logger.info(f"LLM ✓ {name} — {len(result)} chars returned")
            return result
        except Exception as exc:
            logger.warning(f"LLM ✗ {name}: {exc}")
            errors[name] = str(exc)

    error_lines = "\n".join(f"  {k}: {v}" for k, v in errors.items())
    raise RuntimeError(
        f"All LLM providers failed:\n{error_lines}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Public: llm_complete_json
# ─────────────────────────────────────────────────────────────────────────────

async def llm_complete_json(
    system: str,
    user: str,
    temperature: float = 0.2,
    max_tokens: int = 2000,
) -> dict:
    """
    Same as llm_complete but parses and returns a JSON dict.

    Automatically strips ```json ... ``` markdown fences before parsing
    (Gemini and some Ollama models add these despite being told not to).

    Includes one automatic retry on JSON parse failure — free/local models
    occasionally produce malformed JSON on first attempt, especially Ollama.
    The retry uses a slightly lower temperature to push toward more structured output.

    Returns:
        Parsed dict from the model's JSON response.

    Raises:
        RuntimeError: If the LLM call itself fails (propagated from llm_complete).
        ValueError:   If the response cannot be parsed as JSON after retry.
    """
    for attempt in range(1, 3):  # up to 2 attempts
        raw = await llm_complete(
            system=system,
            user=user,
            temperature=max(0.05, temperature - (0.1 * (attempt - 1))),
            max_tokens=max_tokens,
        )

        cleaned = _strip_fences(raw)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            if attempt == 1:
                logger.warning(
                    f"JSON parse failed on attempt 1 — retrying with lower temperature.\n"
                    f"Parse error: {exc}\n"
                    f"Raw (first 300 chars): {raw[:300]}"
                )
            else:
                logger.error(
                    f"JSON parse failed on attempt 2 — giving up.\n"
                    f"Parse error: {exc}\n"
                    f"Raw (first 500 chars): {raw[:500]}"
                )
                raise ValueError(
                    f"The LLM returned a response that could not be parsed as JSON "
                    f"after 2 attempts. Try again. "
                    f"Parse error: {exc}. "
                    f"Raw response (first 300 chars): {raw[:300]}"
                )

    # Should be unreachable
    raise ValueError("JSON parsing failed after maximum retries.")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    """
    Remove markdown code fences that models add despite being told not to.

    Handles:
        ```json ... ```
        ```       ... ```
        ` (single backtick variants — rare but seen with phi3)
    """
    cleaned = text.strip()

    # Multi-line fences
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Drop the opening ```json or ``` line
        inner = lines[1:]
        # Drop the closing ``` line if present
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        cleaned = "\n".join(inner).strip()

    # Some models output just a leading/trailing backtick
    cleaned = cleaned.strip("`").strip()

    return cleaned


def _model_label(provider: str) -> str:
    """Return the configured model name for a provider — used in log messages."""
    return {
        "groq":   config.GROQ_MODEL,
        "google": config.GOOGLE_MODEL,
        "ollama": config.OLLAMA_MODEL,
    }.get(provider, "unknown")