# advomind-backend/ocr_service.py
"""
Text extraction for PDFs and images.

Strategy for PDFs, page by page:
  1. If the page has a usable embedded text layer (most "born digital" PDFs,
     e.g. statutes downloaded from government sites), use it directly - fast,
     free, and exact.
  2. Otherwise (scanned page, or a text layer that's clearly garbage) render
     the page to an image and run Tesseract OCR on it.

Images (png/jpg/tiff/...) always go through Tesseract.

SELF-CHECKS (added after testing showed Tesseract can silently drop whole
lines while still reporting high confidence on what it did read):
  * After each OCR pass we measure how much of the page's ink was NOT covered
    by a recognized word ("unread ink"). If it's high, we retry at other
    image scales - text size alone can make Tesseract skip a line - and keep
    the best result.
  * If a large share is still unread, we warn that text may be missing.
  * Mean word confidence is reported, with a warning when it's low.

WHAT THIS IS GOOD AT (tested on clean synthetic input):
  * PDFs with a real text layer           -> exact
  * English scans / images                -> ~100%
  * Printed Urdu in Naskh style           -> ~100% (after the scale retry)
  * Mixed Urdu + English lines            -> good with 'urd+eng'

WHAT IT IS NOT GOOD AT:
  * Printed Urdu in NASTALIQ style (the calligraphic style most Pakistani
    printed material uses): only ~55% accurate even on a clean render.
  * Handwriting of any kind. Tesseract is not a handwriting recognizer.
  * Poor scans: skewed, noisy, low-resolution, photocopied-many-times.

Requires the Tesseract binary installed on the machine (not just pip), plus
the 'urd' and 'eng' language data.
"""

import io
import os
from dataclasses import dataclass, field
from typing import Optional

import pymupdf  # PyMuPDF (>= 1.24.3 for the `pymupdf` import name)
import pytesseract
from PIL import Image, ImageDraw, ImageOps

# Optional override for where the Tesseract binary lives (typical on Windows,
# e.g. C:\Program Files\Tesseract-OCR\tesseract.exe).
_tesseract_cmd = os.environ.get("TESSERACT_CMD")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd

OCR_LANGS = os.environ.get("OCR_LANGS", "urd+eng")
RENDER_DPI = 250                 # resolution scanned PDF pages are rendered at before OCR
MIN_TEXT_CHARS_PER_PAGE = 30     # fewer than this and a page is treated as "no text layer"
MAX_PAGES = 40                   # keep a single request from running for ages
MAX_STORED_CHARS = 200_000       # keeps the saved text well under Firestore's 1 MiB doc limit

# Measured in testing: English ~96, Naskh Urdu ~91, Nastaliq Urdu ~50-54.
LOW_CONFIDENCE_THRESHOLD = 75

INK_DARKNESS_CUTOFF = 140        # pixels darker than this count as "ink"
RETRY_IF_UNREAD_OVER = 0.15      # retry at other scales if more than this share of ink is unread
WARN_IF_UNREAD_OVER = 0.30       # still unread after retries -> warn that text may be missing
RETRY_SCALES = (0.5, 1.5, 0.75, 1.25)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}


class UnsupportedFileType(Exception):
    pass


@dataclass
class ExtractionResult:
    text: str
    method: str                          # "text-layer" | "tesseract" | "mixed"
    pages: int
    truncated: bool = False
    confidence: Optional[float] = None   # mean word confidence 0-100; None if no OCR was used
    warnings: list = field(default_factory=list)


@dataclass
class _OcrPass:
    text: str
    confs: list
    unread: float                        # share of ink not covered by any recognized word (0-1)


_available_langs_cache = None


def _available_langs():
    global _available_langs_cache
    if _available_langs_cache is None:
        _available_langs_cache = set(pytesseract.get_languages(config=""))
    return _available_langs_cache


def _effective_langs(warnings):
    """Use whichever of the requested languages are actually installed,
    and say so (rather than crashing, or silently degrading) if some aren't."""
    requested = [l for l in OCR_LANGS.split("+") if l]
    installed = _available_langs()
    usable = [l for l in requested if l in installed]
    missing = [l for l in requested if l not in installed]

    if not usable:
        raise RuntimeError(
            f"None of the requested OCR languages ({OCR_LANGS}) are installed in Tesseract. "
            f"Installed: {sorted(installed)}"
        )

    if missing:
        warnings.append(
            f"Tesseract language data missing for: {', '.join(missing)}. "
            f"OCR ran with: {'+'.join(usable)}."
        )

    return "+".join(usable)


def _unread_ink_share(img, boxes):
    """Fraction of dark pixels NOT inside any recognized word's box."""
    bw = img.point(lambda v: 0 if v < INK_DARKNESS_CUTOFF else 255)
    total_ink = bw.histogram()[0]
    if total_ink == 0:
        return 0.0

    pad = max(3, round(img.width * 0.003))
    draw = ImageDraw.Draw(bw)
    for (left, top, w, h) in boxes:
        draw.rectangle([left - pad, top - pad, left + w + pad, top + h + pad], fill=255)

    return bw.histogram()[0] / total_ink


def _single_pass(img, langs, dpi):
    """One Tesseract run. Uses image_to_data (not image_to_string) so text,
    per-word confidence and word boxes all come from the same pass."""
    config = f"--dpi {dpi}" if dpi else ""
    data = pytesseract.image_to_data(
        img, lang=langs, config=config, output_type=pytesseract.Output.DICT
    )

    lines = {}
    confs = []
    boxes = []

    for i, word in enumerate(data["text"]):
        word = word.strip()
        if not word:
            continue

        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        lines.setdefault(key, []).append(word)
        boxes.append((data["left"][i], data["top"][i], data["width"][i], data["height"][i]))

        conf = float(data["conf"][i])
        if conf >= 0:
            confs.append(conf)

    out = []
    prev_par = None
    for key in sorted(lines):
        par = key[:2]
        if prev_par is not None and par != prev_par:
            out.append("")  # blank line between paragraphs
        out.append(" ".join(lines[key]))
        prev_par = par

    return _OcrPass(
        text="\n".join(out).strip(),
        confs=confs,
        unread=_unread_ink_share(img, boxes),
    )


def _ocr_image(img, langs, dpi=None):
    """OCR with self-check: if much of the page's ink went unread, retry at
    other scales and keep the best pass. Returns an _OcrPass."""
    img = ImageOps.exif_transpose(img).convert("L")

    best = _single_pass(img, langs, dpi)

    if best.unread > RETRY_IF_UNREAD_OVER:
        for scale in RETRY_SCALES:
            scaled = img.resize(
                (max(1, int(img.width * scale)), max(1, int(img.height * scale))),
                Image.LANCZOS,
            )
            candidate = _single_pass(scaled, langs, int(dpi * scale) if dpi else None)

            # Take it only if it reads meaningfully more of the page.
            if candidate.unread < best.unread - 0.05:
                best = candidate

            if best.unread <= RETRY_IF_UNREAD_OVER:
                break

    return best


def _ocr_pdf_page(page, langs):
    pix = page.get_pixmap(dpi=RENDER_DPI)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return _ocr_image(img, langs, dpi=RENDER_DPI)


def _text_layer_is_usable(text):
    stripped = text.strip()
    if len(stripped) < MIN_TEXT_CHARS_PER_PAGE:
        return False

    # Some PDFs (notably certain Urdu exports using legacy fonts) carry a
    # "text layer" that is really private-use / replacement characters.
    bad = sum(1 for ch in stripped if ch == "\ufffd" or "\ue000" <= ch <= "\uf8ff")
    return bad / len(stripped) < 0.1


def _finish_confidence(confs, warnings):
    if not confs:
        return None

    mean = sum(confs) / len(confs)

    if mean < LOW_CONFIDENCE_THRESHOLD:
        warnings.append(
            f"Low OCR confidence ({mean:.0f}/100). This text is probably inaccurate - common with "
            f"Nastaliq-style Urdu, handwriting, or poor-quality scans. Review it before relying on it."
        )

    return round(mean, 1)


def _warn_unread(unread_by_page, warnings):
    """unread_by_page: {page_number: share}. Pages can legitimately have lots of
    non-text ink (stamps, logos, signatures), so the wording is 'may be'."""
    bad = {p: u for p, u in unread_by_page.items() if u > WARN_IF_UNREAD_OVER}
    if not bad:
        return

    pages = ", ".join(str(p) for p in sorted(bad)[:8])
    worst = max(bad.values())
    warnings.append(
        f"Some text may be missing: on page(s) {pages}, up to {worst:.0%} of the printed content "
        f"wasn't recognized (could also be stamps, logos or signatures). Check against the original."
    )


def _extract_pdf(data, force_ocr):
    doc = pymupdf.open(stream=data, filetype="pdf")

    try:
        if doc.needs_pass:
            raise ValueError("This PDF is password-protected - unlock it first and re-upload.")

        warnings = []
        total_pages = doc.page_count
        pages_to_read = min(total_pages, MAX_PAGES)

        langs = None  # resolved lazily, only if some page actually needs OCR
        used_layer = False
        used_ocr = False
        all_confs = []
        unread_by_page = {}
        chunks = []

        for i in range(pages_to_read):
            page = doc[i]
            layer_text = "" if force_ocr else page.get_text().strip()

            if not force_ocr and _text_layer_is_usable(layer_text):
                text = layer_text
                used_layer = True
            else:
                if langs is None:
                    langs = _effective_langs(warnings)
                result = _ocr_pdf_page(page, langs)
                text = result.text
                all_confs.extend(result.confs)
                unread_by_page[i + 1] = result.unread
                used_ocr = True

            chunks.append(f"--- Page {i + 1} ---\n{text}")

        full_text = "\n\n".join(chunks)
        truncated = total_pages > MAX_PAGES

        if truncated:
            warnings.append(f"Only the first {MAX_PAGES} of {total_pages} pages were processed.")

        if len(full_text) > MAX_STORED_CHARS:
            full_text = full_text[:MAX_STORED_CHARS]
            truncated = True
            warnings.append("Extracted text was cut off to fit the storage limit.")

        if used_layer and used_ocr:
            method = "mixed"
        elif used_ocr:
            method = "tesseract"
        else:
            method = "text-layer"

        confidence = _finish_confidence(all_confs, warnings)
        _warn_unread(unread_by_page, warnings)

        return ExtractionResult(
            text=full_text, method=method, pages=pages_to_read,
            truncated=truncated, confidence=confidence, warnings=warnings
        )
    finally:
        doc.close()


def _extract_image(data):
    warnings = []
    langs = _effective_langs(warnings)
    img = Image.open(io.BytesIO(data))
    result = _ocr_image(img, langs)
    text = result.text

    truncated = False
    if len(text) > MAX_STORED_CHARS:
        text = text[:MAX_STORED_CHARS]
        truncated = True
        warnings.append("Extracted text was cut off to fit the storage limit.")

    confidence = _finish_confidence(result.confs, warnings)
    _warn_unread({1: result.unread}, warnings)

    return ExtractionResult(
        text=text, method="tesseract", pages=1,
        truncated=truncated, confidence=confidence, warnings=warnings
    )


def extract_text(data, filename, force_ocr=False):
    """data: raw file bytes. filename: used only to decide PDF vs image."""
    ext = os.path.splitext((filename or "").lower())[1]

    if ext == ".pdf":
        return _extract_pdf(data, force_ocr)

    if ext in IMAGE_EXTENSIONS:
        return _extract_image(data)

    raise UnsupportedFileType(
        f"Text extraction supports PDFs and images only (got '{ext or 'no extension'}')."
    )