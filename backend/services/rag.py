"""
services/rag.py
───────────────
RAG (Retrieval-Augmented Generation) pipeline for NeuroCompanion.

Pipeline per request:
  text → chunk → embed → (ChromaDB in-memory) → query → top-k chunks → context

Public API:
    context_str = build_rag_context(text, query, top_k, max_context_chars)
    chunks      = retrieve_chunks(text, query, top_k)

Dependencies (add to requirements.txt):
    sentence-transformers>=2.7.0
    chromadb>=0.5.0
"""

import hashlib
import logging
import re
from functools import lru_cache

logger = logging.getLogger("neuro.rag")
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"

CHUNK_SIZE    = 400   
CHUNK_OVERLAP = 80    

DEFAULT_TOP_K           = 6
DEFAULT_MAX_CONTEXT     = 6000   

# Embedding model — lazy-loaded, shared across all requests

@lru_cache(maxsize=1)
def _get_embedder():
    """
    Load the SentenceTransformer model once per process and cache it.
    Thread-safe after the first call thanks to Python's GIL + lru_cache.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        raise RuntimeError(
            "sentence-transformers not installed.\n"
            "Fix: pip install sentence-transformers"
        )
    logger.info(f"[RAG] Loading embedding model '{EMBED_MODEL_NAME}' …")
    model = SentenceTransformer(EMBED_MODEL_NAME)
    logger.info("[RAG] Embedding model ready.")
    return model

# Text chunking

def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int    = CHUNK_OVERLAP,
) -> list[str]:
    """
    Split *text* into overlapping fixed-size chunks, preferring sentence
    boundaries ('. ', '! ', '? ') so chunks don't cut mid-sentence.

    Returns an empty list for empty/whitespace-only input.
    """
    # Normalise internal whitespace but keep paragraph breaks as '. '
    text = re.sub(r"[ \t]+", " ", text).strip()
    text = re.sub(r"\n{2,}", " \n\n ", text)   # keep paragraph hints

    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end >= len(text):
            chunk = text[start:].strip()
            if chunk:
                chunks.append(chunk)
            break

        # Prefer breaking at a sentence boundary inside [start, end]
        search_window = text[start:end]
        best_boundary = -1
        for sep in (". ", "! ", "? ", ".\n", "!\n", "?\n"):
            pos = search_window.rfind(sep)
            if pos > overlap:           
                best_boundary = max(best_boundary, pos + len(sep) - 1)

        if best_boundary != -1:
            end = start + best_boundary + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap          

    logger.debug(f"[RAG] Chunked text ({len(text)} chars) → {len(chunks)} chunks")
    return chunks

# Embedding + ChromaDB storage (in-memory, per request)

def _text_fingerprint(text: str) -> str:
    """Short deterministic ID for a block of text."""
    return hashlib.md5(text.encode(), usedforsecurity=False).hexdigest()[:16]


def _build_collection(chunks: list[str], fingerprint: str):
    """
    Embed *chunks* and store them in a fresh ephemeral ChromaDB collection.
    Returns (collection, embedder) for querying.
    """
    try:
        import chromadb
    except ImportError:
        raise RuntimeError(
            "chromadb not installed.\n"
            "Fix: pip install chromadb"
        )

    embedder = _get_embedder()

    client = chromadb.Client()

    # Collection names must be unique within a client instance
    collection = client.create_collection(
        name=f"rag_{fingerprint}",
        metadata={"hnsw:space": "cosine"}, 
    )

    logger.info(f"[RAG] Embedding {len(chunks)} chunks …")
    embeddings = embedder.encode(
        chunks,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,   
    ).tolist()

    collection.add(
        documents=chunks,
        embeddings=embeddings,
        ids=[f"c{i}" for i in range(len(chunks))],
    )

    logger.info(f"[RAG] Stored {len(chunks)} chunks (fingerprint={fingerprint})")
    return collection, embedder


# Public: retrieve_chunks

def retrieve_chunks(
    text:  str,
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list[str]:
    """
    Chunk *text*, embed everything, then return the *top_k* chunks that are
    most semantically similar to *query*.

    If the text is short enough to fit in top_k chunks, returns all chunks
    without building a vector index (fast path).
    """
    chunks = chunk_text(text)

    if not chunks:
        return []

    if len(chunks) <= top_k:
        logger.debug("[RAG] Fast path — all chunks fit, skipping vector search")
        return chunks

    fingerprint = _text_fingerprint(text)
    collection, embedder = _build_collection(chunks, fingerprint)

    query_vec = embedder.encode(
        [query],
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()

    results = collection.query(
        query_embeddings=query_vec,
        n_results=min(top_k, len(chunks)),
        include=["documents"],
    )

    retrieved: list[str] = results["documents"][0]
    logger.info(
        f"[RAG] Retrieved {len(retrieved)}/{len(chunks)} chunks "
        f"for query: '{query[:70]}…'"
    )
    return retrieved


def build_rag_context(
    text:             str,
    query:            str,
    top_k:            int = DEFAULT_TOP_K,
    max_context_chars: int = DEFAULT_MAX_CONTEXT,
) -> str:
    """
    Full RAG pipeline.  Returns a single string ready to inject into an LLM
    prompt as "RELEVANT CONTEXT".

    Args:
        text:              The full source document (PDF/DOCX/plain text).
        query:             Semantic search query describing the current task.
                           E.g. "main concepts to simplify for ADHD student"
        top_k:             Number of chunks to retrieve.
        max_context_chars: Hard cap on context length sent to LLM.

    Returns:
        A "\n\n---\n\n"-separated string of retrieved passages, truncated to
        *max_context_chars*.  Falls back to a raw truncated excerpt if
        chunking/embedding fails.
    """
    try:
        chunks = retrieve_chunks(text, query, top_k=top_k)
    except Exception as exc:
        logger.warning(f"[RAG] Retrieval failed, using raw text fallback: {exc}")
        return text[:max_context_chars]

    if not chunks:
        return text[:max_context_chars]

    context = "\n\n---\n\n".join(chunks)

    if len(context) > max_context_chars:
        context = context[:max_context_chars] + "\n\n[… context trimmed for length …]"

    return context


# RAG query templates — import these in routers for consistency

RAG_QUERY_SIMPLIFY = (
    "main ideas, key concepts, definitions, and important explanations "
    "that a student needs to understand"
)

RAG_QUERY_QUIZ = (
    "important facts, definitions, dates, cause-and-effect relationships, "
    "and testable concepts for exam questions"
)