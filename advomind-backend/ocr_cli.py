# advomind-backend/ocr_cli.py
"""
Bulk text extraction for local files - meant for turning statute PDFs
(Constitution, CPC, CrPC, PPC, ...) into plain-text files ahead of building
the legal knowledge base.

    python ocr_cli.py path/to/statutes_folder
    python ocr_cli.py path/to/one_file.pdf --out knowledge_base/raw_text
    python ocr_cli.py path/to/folder --force-ocr

Writes one <name>.txt per input file and prints a summary line for each,
including OCR confidence and any warnings. READ THE WARNINGS: a statute with
a low-confidence or "text may be missing" warning should be fixed before it
goes anywhere near the knowledge base.
"""

import argparse
import os
import sys
import time

import ocr_service

SUPPORTED = {".pdf"} | ocr_service.IMAGE_EXTENSIONS


def iter_inputs(path):
    if os.path.isfile(path):
        yield path
        return

    for root, _dirs, files in os.walk(path):
        for name in sorted(files):
            if os.path.splitext(name.lower())[1] in SUPPORTED:
                yield os.path.join(root, name)


def main():
    parser = argparse.ArgumentParser(description="Extract text from PDFs/images into .txt files.")
    parser.add_argument("path", help="A file, or a folder to search recursively")
    parser.add_argument("--out", default=os.path.join("knowledge_base", "raw_text"),
                        help="Output folder (default: knowledge_base/raw_text)")
    parser.add_argument("--force-ocr", action="store_true",
                        help="OCR every page even if the PDF has a text layer")
    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"Not found: {args.path}")
        sys.exit(1)

    os.makedirs(args.out, exist_ok=True)

    started = time.time()
    done = failed = flagged = 0

    for src in iter_inputs(args.path):
        name = os.path.basename(src)
        t0 = time.time()

        try:
            with open(src, "rb") as f:
                result = ocr_service.extract_text(f.read(), name, force_ocr=args.force_ocr)
        except Exception as e:
            failed += 1
            print(f"[FAILED] {name}: {e}")
            continue

        out_path = os.path.join(args.out, os.path.splitext(name)[0] + ".txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(result.text)

        done += 1
        conf = f"{result.confidence:.0f}" if result.confidence is not None else "n/a (text layer)"
        print(f"[ok] {name}: {result.pages} page(s), {result.method}, confidence {conf}, "
              f"{len(result.text):,} chars, {time.time() - t0:.1f}s -> {out_path}")

        for w in result.warnings:
            print(f"     WARNING: {w}")
        if result.warnings:
            flagged += 1

    print(f"\nDone: {done} extracted, {failed} failed, {flagged} with warnings "
          f"({time.time() - started:.0f}s total).")


if __name__ == "__main__":
    main()