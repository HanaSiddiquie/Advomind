# advomind-backend/ocr_routes.py
"""
Text extraction endpoint for uploaded case files.

POST /ocr/process-file   { "fileId": "<files doc id>", "forceOcr": false }

Downloads the file from Firebase Storage, extracts its text (embedded text
layer where there is one, Tesseract OCR otherwise - see ocr_service.py for
what that is and isn't good at), and saves the result onto the file's
Firestore document:

    extractedText, extractedAt, ocrMethod, ocrPages,
    ocrConfidence (None for text-layer PDFs), ocrWarnings, ocrTruncated

Access control mirrors the Firestore rules (owner + court + assignment),
re-checked by hand here because the Admin SDK bypasses those rules.
"""

import os
from datetime import datetime

import pymupdf
import pytesseract
from firebase_admin import storage
from flask import Blueprint, request, jsonify

from ai_routes import _verify_caller, _has_case_access, _err
from firebase_admin_setup import get_admin_db
import ocr_service

ocr_bp = Blueprint("ocr", __name__, url_prefix="/ocr")

STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "court-system-135a3.firebasestorage.app")


@ocr_bp.route("/process-file", methods=["POST"])
def process_file():
    uid, profile, error = _verify_caller()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    file_id = data.get("fileId")
    force_ocr = bool(data.get("forceOcr"))

    if not file_id:
        return _err("fileId is required")

    db = get_admin_db()
    snap = db.collection("files").document(file_id).get()

    if not snap.exists:
        return _err("File not found", 404)

    file_data = snap.to_dict()

    if not _has_case_access(uid, profile, file_data):
        return _err("You don't have access to this file", 403)

    storage_path = file_data.get("storagePath")
    if not storage_path:
        return _err("This file record has no storage path", 400)

    try:
        file_bytes = storage.bucket(STORAGE_BUCKET).blob(storage_path).download_as_bytes()
    except Exception as e:
        return _err(f"Couldn't read the file from storage: {e}", 500)

    filename = file_data.get("name") or storage_path

    try:
        result = ocr_service.extract_text(file_bytes, filename, force_ocr=force_ocr)
    except ocr_service.UnsupportedFileType as e:
        return _err(str(e), 415)
    except ValueError as e:                      # e.g. password-protected PDF
        return _err(str(e), 422)
    except pymupdf.FileDataError:
        return _err("This file couldn't be opened - it may be corrupt.", 422)
    except pytesseract.TesseractNotFoundError:
        return _err(
            "Tesseract isn't installed on the server (or TESSERACT_CMD points to the wrong place).", 500
        )
    except Exception as e:
        return _err(f"Text extraction failed: {e}", 500)

    extracted_at = datetime.utcnow().isoformat() + "Z"

    snap.reference.update({
        "extractedText": result.text,
        "extractedAt": extracted_at,
        "ocrMethod": result.method,
        "ocrPages": result.pages,
        "ocrConfidence": result.confidence,
        "ocrWarnings": result.warnings,
        "ocrTruncated": result.truncated,
    })

    return jsonify({
        "method": result.method,
        "pages": result.pages,
        "confidence": result.confidence,
        "warnings": result.warnings,
        "truncated": result.truncated,
        "chars": len(result.text),
    }), 200