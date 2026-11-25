# advomind-backend/kb_show.py
"""
Look at what the knowledge base actually holds for a section, so you can compare it with the
original PDF. Reads knowledge_base/chunks/<doc>.jsonl (made by kb_build.py).

    python kb_show.py ppc_1860 302               # section 302
    python kb_show.py ppc_1860 302 420 34        # several
    python kb_show.py cpc_1908 1 --order XIII    # Order XIII, Rule 1
    python kb_show.py constitution_1973 10A      # an article with a letter
    python kb_show.py ppc_1860 --find "qatl-i-amd"      # sections whose text contains a phrase
    python kb_show.py ppc_1860 --omitted         # list sections marked omitted/repealed
"""

import argparse
import json
import os
import sys


def load(base, doc):
    path = os.path.join(base, "chunks", f"{doc}.jsonl")
    if not os.path.exists(path):
        sys.exit(f"Not found: {path}   (run python kb_build.py first)")
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def show(c, width=100):
    parts = f" (part {c['part']} of {c['parts']})" if c["parts"] > 1 else ""
    print("=" * width)
    print(f"{c['citation']}{parts}")
    print(f"heading : {c['heading'] or '(none)'}")
    print(f"context : {' > '.join(c['context']) or '-'}")
    print(f"pdf page: {c['pages'][0]}" + (f"-{c['pages'][1]}" if c['pages'][1] != c['pages'][0] else ""))
    print(f"status  : {c['status']}" + ("   ** NEEDS REVIEW (touches an OCR'd page) **" if c["needs_review"] else ""))
    src = c.get("source")
    if src:
        print(f"source  : {src['site']}, downloaded {src['downloaded']}" + (f", note: {src['note']}" if src["note"] else ""))
    print("-" * width)
    print(c["text"] if c["text"].strip() else "(no text)")
    for n in c.get("notes", []):
        print(f"  [amendment note] {n}")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="Show knowledge-base sections.")
    ap.add_argument("doc")
    ap.add_argument("numbers", nargs="*")
    ap.add_argument("--base", default="knowledge_base")
    ap.add_argument("--order", help="Roman numeral of a CPC Order, for rule lookups")
    ap.add_argument("--find", help="show sections whose text contains this phrase")
    ap.add_argument("--omitted", action="store_true", help="list omitted/repealed sections")
    args = ap.parse_args()

    chunks = load(args.base, args.doc)

    if args.omitted:
        om = sorted({c["short_citation"] for c in chunks if c["status"] == "omitted"})
        print(f"{len(om)} omitted/repealed:\n" + ", ".join(om))
        return

    if args.find:
        needle = args.find.lower()
        hits = [c for c in chunks if needle in c["text"].lower() or needle in c["heading"].lower()]
        print(f"{len(hits)} chunk(s) mention {args.find!r}:")
        for c in hits[:15]:
            print(f"  {c['short_citation']:22s} {c['heading'][:60]}")
        if len(hits) > 15:
            print(f"  ... and {len(hits) - 15} more")
        return

    if not args.numbers:
        sys.exit("Give one or more section numbers, or use --find / --omitted.")

    block = f"ORDER {args.order.upper()}" if args.order else "main"
    for n in args.numbers:
        found = [c for c in chunks if c["number"].upper() == n.upper() and c["block"] == block]
        if not found:
            print(f"\n{n}: not found in {args.doc} ({block}).")
            continue
        for c in found:
            show(c)


if __name__ == "__main__":
    main()