from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import easyocr
import tempfile
import os
import re
from pathlib import Path

app = FastAPI(title="Blind-Friendly Vision Reader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize EasyOCR reader (English)
reader = easyocr.Reader(["en"], gpu=False)

SUPPORTED_IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}


def pdf_to_images(pdf_path: str) -> list[str]:
    """Convert PDF pages to image files."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PyMuPDF not installed. PDF support unavailable."
        )

    doc = fitz.open(pdf_path)
    image_paths = []
    tmp_dir = tempfile.mkdtemp()

    for i, page in enumerate(doc):
        mat = fitz.Matrix(2, 2)  # 2x zoom for better OCR
        pix = page.get_pixmap(matrix=mat)
        img_path = os.path.join(tmp_dir, f"page_{i}.png")
        pix.save(img_path)
        image_paths.append(img_path)

    doc.close()
    return image_paths


def ocr_image(image_path: str) -> str:
    """Run EasyOCR on a single image and return raw text."""
    results = reader.readtext(image_path, detail=0, paragraph=True)
    return "\n".join(results)


def clean_and_split(raw_text: str) -> list[str]:
    """Clean OCR output and split into readable paragraphs."""
    # Remove excessive whitespace
    text = re.sub(r"[ \t]+", " ", raw_text)
    # Normalize line endings
    text = re.sub(r"\r\n|\r", "\n", text)
    # Collapse 3+ blank lines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    # Split on double newlines (paragraph breaks)
    blocks = [b.strip() for b in re.split(r"\n{2,}", text) if b.strip()]

    paragraphs = []
    for block in blocks:
        # Join lines within a block into a single sentence flow
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        paragraph = " ".join(lines)
        if len(paragraph) > 10:  # Skip tiny fragments
            paragraphs.append(paragraph)

    return paragraphs if paragraphs else ["No readable text was found in the document."]


@app.post("/vision/read")
async def vision_read(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        all_text_parts = []

        if suffix == ".pdf":
            image_paths = pdf_to_images(tmp_path)
            for img_path in image_paths:
                all_text_parts.append(ocr_image(img_path))
                os.remove(img_path)
        elif suffix in SUPPORTED_IMAGE_TYPES:
            all_text_parts.append(ocr_image(tmp_path))
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {suffix}. Supported: {', '.join(SUPPORTED_IMAGE_TYPES)} and .pdf"
            )

        raw_text = "\n\n".join(all_text_parts)
        paragraphs = clean_and_split(raw_text)

        return {"status": "success", "paragraphs": paragraphs}

    finally:
        os.unlink(tmp_path)


@app.get("/health")
async def health():
    return {"status": "ok"}
