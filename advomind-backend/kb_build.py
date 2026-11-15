# advomind-backend/kb_build.py
"""
Turns the raw statute text files (made by ocr_cli.py) into structured, citable
chunks for the legal knowledge base - one chunk per section / article / rule,
each carrying its Act, number, heading, chapter, page range and amendment notes.

    python kb_build.py                     # every .txt in knowledge_base/raw_text
    python kb_build.py cpc_1908 ppc_1860   # just these

Reads : knowledge_base/raw_text/<doc>.txt   (and knowledge_base/source_pdfs/<doc>.pdf
        if present, to find pages that had no text layer and had to be OCR'd)
Writes: knowledge_base/chunks/<doc>.jsonl, knowledge_base/chunks/_all.jsonl
        knowledge_base/build_report.txt

THE REPORT IS THE POINT. The table of contents lists every section, so it's used as
an answer key: the report says exactly which sections the splitter FAILED to find,
which it found that aren't in the contents, and which pages were OCR'd. Nothing is
silently dropped - anything doubtful is flagged.

Known v1 limits: Schedules and Appendices (forms, tables of offences) are skipped,
and counted in the report. Only English text is handled.
"""

import argparse
import difflib
import json
import os
import re
import statistics
import sys
from collections import defaultdict

DEFAULT_BASE = "knowledge_base"

# Edit these if a file has a different name or the unit type is wrong.
DOC_CONFIG = {
    "constitution_1973": {"title": "Constitution of the Islamic Republic of Pakistan, 1973", "short": "Const.", "unit": "Article"},
    "cpc_1908": {"title": "Code of Civil Procedure, 1908", "short": "CPC", "unit": "Section"},
    "crpc_1898": {"title": "Code of Criminal Procedure, 1898", "short": "CrPC", "unit": "Section"},
    "ppc_1860": {"title": "Pakistan Penal Code, 1860", "short": "PPC", "unit": "Section"},
    "qanun_e_shahadat_1984": {"title": "Qanun-e-Shahadat Order, 1984", "short": "QSO", "unit": "Article"},
    "contract_act_1872": {"title": "Contract Act, 1872", "short": "Contract Act", "unit": "Section"},
}

MAX_GAP = 12                 # biggest numbering jump accepted where the contents give no guidance
TOC_WINDOW = 40              # how many contents entries ahead a section may be found (handles big jumps)
TARGET_CHUNK_CHARS = 2200    # long units are split at sub-clauses near this size...
MAX_CHUNK_CHARS = 3500       # ...and never allowed to exceed this
MIN_TEXT_CHARS_PER_PAGE = 30 # same rule ocr_service uses to decide a page has no text layer

PAGE_MARK = re.compile(r"^--- Page (\d+) ---$")
PAGE_HEADER = re.compile(r"^Page \d+ of \d+$", re.I)
NOISE_TAIL = re.compile(r"\s*RGN\s+Dated\.?\s*\d{1,2}-\d{1,2}-\d{4}\s*$")
MARK_PREFIX = r"(?:(?:\d{1,2}\*?\[|\{|\[|\*)\s*)*"
UNIT_START = re.compile(r"^" + MARK_PREFIX + r"(\d{1,3})[ \-\u2013]?([A-Z]{0,2})\.\s*(.*)$")
# typo tolerance: "185," for "185." - only ever trusted when the contents confirm it
ALT_START = re.compile(r"^" + MARK_PREFIX + r"(\d{1,3})[ \-\u2013]?([A-Z]{0,2}),\s*(.*)$")
FOOTNOTE_START = re.compile(r"^(\d{1,2})(?=[A-Z][a-z])")
MARKER = re.compile(r"(\d{1,2})\[")
SEPARATOR = re.compile(r"^[_=\-]{3,}$")
BLOCK_HEADING = re.compile(r"^ORDER\s+([IVXLCDM]+[A-Z]?|\d+[A-Z]?)\b\s*[.:\u2013\u2014-]*\s*(.*)$")
CONTEXT_HEADING = re.compile(r"^(PART|CHAPTER)\s+([IVXLCDM]+[A-Z]?|\d+[A-Z]?)\b\s*[.:\u2013\u2014-]*\s*(.*)$")
SKIP_HEADING = re.compile(r"^(?:THE\s+)?(?:[A-Z]+\s+)?(?:SCHEDULE|APPENDIX|APPENDICES)\b")
NEW_PARA = re.compile(r"^(\[?\(\w{1,4}\)|(?:Explanation|Illustrations?|Provided|Exceptions?)\b)")
SPLIT_AT_CLAUSE = re.compile(r"^\[?\(\d+[A-Za-z]?\)")


# ----------------------------------------------------------------------------- helpers
def is_upper_line(s):
    letters = [c for c in s if c.isalpha()]
    return len(letters) >= 3 and all(c.isupper() for c in letters)


def num_key(n):
    m = re.match(r"(\d+)", n)
    return (int(m.group(1)) if m else 10**9, n)


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", "", s.lower())).strip()


def title_match(a, b):
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return True
    if na.startswith(nb[:20]) or nb.startswith(na[:20]):
        return True
    return difflib.SequenceMatcher(None, na, nb).ratio() >= 0.6


def split_heading(text):
    """'Counterfeiting coin. Whoever...' -> ('Counterfeiting coin', 'Whoever...')"""
    t = text.strip()
    m = re.search(r"\.\s*(?:_+|\u2014|\u2013|-{1,2})\s*|\.\s+", t[:240])
    if m and m.start() <= 200:
        return t[:m.start()].strip(" [\u2014\u2013-_"), t[m.end():].strip()
    return "", t


def start_form_ok(m):
    rest = m.group(3).strip()
    return ((not rest) or rest[0].isupper() or rest[0] in "[\"\u201c\u2018'*]{_"
            or bool(re.match(r"\d{1,2}\*?\[", rest)) or bool(re.match(r"\d{1,2}\*", rest)))


def title_is_omitted(title):
    return bool(re.match(r"^\W*(?:omitted|repealed)\b", title.strip(), re.I)) or is_omitted(title)


def says_omitted(text):
    """A section whose text is just '[Old heading.] Omitted by ...' / '[Repealed by ...]'."""
    t = text.strip()
    if len(t) > 600:
        return False
    return bool(re.match(r"^\[?[^\]]{0,160}\]?\.?\s*(?:Omitted|Repealed)\s+by\b", t)
                or re.match(r"^\W{0,3}(?:Omitted|Repealed)\b", t))


def next_key(toc_block, last):
    """The contents entry that should come right after `last` (or the first one)."""
    if not toc_block:
        return None
    keys = list(toc_block)
    if last is None:
        return keys[0]
    cur = f"{last[0]}{last[1]}"
    if cur in toc_block:
        idx = keys.index(cur)
        return keys[idx + 1] if idx + 1 < len(keys) else None
    return None


def accept_number(num, suffix, last):
    if last is None:
        return int(num) <= 3
    ln, ls = last
    n = int(num)
    if n == ln:
        return suffix > ls
    return ln < n <= ln + MAX_GAP


# ----------------------------------------------------------------------------- loading / cleaning
def load_pages(text):
    pages, cur_no, cur = [], None, []
    for raw in text.splitlines():
        m = PAGE_MARK.match(raw.strip())
        if m:
            if cur_no is not None:
                pages.append((cur_no, cur))
            cur_no, cur = int(m.group(1)), []
        else:
            cur.append(raw.rstrip())
    if cur_no is not None:
        pages.append((cur_no, cur))
    if not pages:
        pages = [(1, text.splitlines())]
    return pages


def clean_page(lines):
    """-> (content lines, {footnote number: text}). Drops the 'Page N of M' header and
    moves the footnotes at the bottom of the page into their own dict."""
    body, notes = [], {}
    in_notes, last_note = False, None

    for line in lines:
        s = NOISE_TAIL.sub("", line.strip()).strip()
        if not s or PAGE_HEADER.match(s):
            continue

        m = FOOTNOTE_START.match(s)
        # a page's footnotes start at 1-9; once inside the footnote block, any number is a new note
        if m and (in_notes or int(m.group(1)) <= 9):
            last_note = int(m.group(1))
            notes[last_note] = s[len(m.group(1)):].strip()
            in_notes = True
            continue

        if in_notes:
            struct = (re.match(r"^\d{1,3}[A-Z]{0,2}\.$", s) or is_start(s) or
                      (is_upper_line(s) and (BLOCK_HEADING.match(s) or CONTEXT_HEADING.match(s) or SKIP_HEADING.match(s))))
            if not struct:
                if last_note is not None:
                    notes[last_note] += " " + s
                continue
            in_notes = False

        body.append(s)

    return body, notes


def ocr_pages_from_pdf(pdf_path):
    import pymupdf
    bad = []
    doc = pymupdf.open(pdf_path)
    try:
        for i, page in enumerate(doc, 1):
            t = page.get_text().strip()
            junk = sum(1 for ch in t if ch == "\ufffd" or "\ue000" <= ch <= "\uf8ff")
            if len(t) < MIN_TEXT_CHARS_PER_PAGE or (t and junk / len(t) >= 0.1):
                bad.append(i)
    finally:
        doc.close()
    return bad


# ----------------------------------------------------------------------------- table of contents
SENTENCE_BREAK = re.compile(r"\.\s+[A-Z\[(\"]|\.\s*(?:_+|[\u2014\u2013])|\.\s*-{1,2}\s")


def is_start(line):
    m = UNIT_START.match(line)
    return bool(m and start_form_ok(m))


def page_profile(lines):
    """-> (share of numbered entries that look like CONTENTS entries, count of long lines).
    A contents entry is a number followed by a short title with no sentence in it, then the
    next entry or heading. A real section reads 'Heading. Text...' so it fails that test."""
    starts = [i for i, l in enumerate(lines) if is_start(l)]
    longs = sum(1 for l in lines if len(l) >= 70)
    if not starts:
        return None, longs

    pairs = 0
    for i in starts:
        rest = UNIT_START.match(lines[i]).group(3).strip()
        if rest and (len(rest) > 110 or SENTENCE_BREAK.search(rest)):
            continue
        j, k = i + 1, 0
        while (j < len(lines) and k < 2 and not is_start(lines[j]) and not is_upper_line(lines[j])
               and len(lines[j]) <= 110 and not SENTENCE_BREAK.search(lines[j])):
            j += 1
            k += 1
        if not rest and k == 0:
            continue
        if j >= len(lines) or is_start(lines[j]) or is_upper_line(lines[j]):
            pairs += 1

    return pairs / len(starts), longs


def find_body_start(cleaned_pages):
    """First page of the actual law. A contents page scores close to 1.0 (nearly every numbered
    line is a short title), a body page rarely scores above 0.6, so: the body starts at the
    first page that looks like prose AND is followed by a page that is clearly not contents."""
    profiles = [page_profile(lines) for _no, lines in cleaned_pages]
    body_like = [longs >= 3 and (frac is None or frac < 0.5) for frac, longs in profiles]
    not_contents = [frac is None or frac < 0.75 for frac, _longs in profiles]

    for i, f in enumerate(body_like):
        if f and (i + 1 >= len(profiles) or not_contents[i + 1]):
            return i
    return 0


def take_title(entries, j, max_lines=2):
    parts = []
    while j < len(entries) and len(parts) < max_lines:
        s = entries[j][1]
        m = UNIT_START.match(s)
        if (m and start_form_ok(m)) or SEPARATOR.match(s) or not is_upper_line(s):
            break
        if BLOCK_HEADING.match(s) or CONTEXT_HEADING.match(s) or SKIP_HEADING.match(s):
            break
        parts.append(s)
        j += 1
    return " ".join(parts), j


def parse_toc(entries):
    toc = defaultdict(dict)
    block, skip, i = "main", False, 0

    while i < len(entries):
        _p, s = entries[i]

        if SEPARATOR.match(s):
            i += 1
            continue

        if is_upper_line(s):
            m = BLOCK_HEADING.match(s)
            if m:
                block, skip = f"ORDER {m.group(1)}", False
                _t, i = (m.group(2), i + 1) if m.group(2).strip() else take_title(entries, i + 1)
                continue
            m = CONTEXT_HEADING.match(s)
            if m:
                _t, i = (m.group(3), i + 1) if m.group(3).strip() else take_title(entries, i + 1)
                continue
            if SKIP_HEADING.match(s) and len(s) < 70:
                skip = True
                i += 1
                continue

        m = UNIT_START.match(s)
        if m and start_form_ok(m) and not skip:
            key = m.group(1) + m.group(2)
            parts = [m.group(3).strip()] if m.group(3).strip() else []
            j = i + 1
            while j < len(entries) and len(parts) < 3:
                t = entries[j][1]
                tm = UNIT_START.match(t)
                if (tm and start_form_ok(tm)) or SEPARATOR.match(t) or is_upper_line(t):
                    break
                parts.append(t)
                j += 1
            toc[block].setdefault(key, " ".join(parts).strip())
            i = j
            continue

        i += 1

    return toc


# ----------------------------------------------------------------------------- body parsing
def parse_units(entries, toc):
    units, state = [], {"cur": None, "pre": []}
    block, last, skip = "main", None, False
    context = {"part": "", "chapter": "", "order": "", "sub": ""}
    skipped_lines, skipped_names, subheads = 0, [], 0
    tb_index = {blk: {k: n for n, k in enumerate(d)} for blk, d in (toc or {}).items()}
    ptr = defaultdict(int)

    def ctx_list():
        return [v for v in (context["part"], context["chapter"], context["order"], context["sub"]) if v]

    def finalize():
        cur = state["cur"]
        if cur is not None:
            units.append(cur)
            state["cur"] = None

    i = 0
    while i < len(entries):
        page, s = entries[i]

        if SEPARATOR.match(s):
            i += 1
            continue

        if is_upper_line(s):
            m = BLOCK_HEADING.match(s)
            if m:
                finalize()
                title, i = (m.group(2).strip(), i + 1) if m.group(2).strip() else take_title(entries, i + 1)
                block, last, skip = f"ORDER {m.group(1)}", None, False
                context["order"] = f"ORDER {m.group(1)}" + (f" - {title}" if title else "")
                context["sub"] = ""
                continue
            m = CONTEXT_HEADING.match(s)
            if m:
                finalize()
                title, i = (m.group(3).strip(), i + 1) if m.group(3).strip() else take_title(entries, i + 1)
                label = f"{m.group(1)} {m.group(2)}" + (f" - {title}" if title else "")
                if m.group(1) == "PART":
                    context["part"], context["chapter"] = label, ""
                else:
                    context["chapter"] = label
                context["sub"] = ""
                skip = False
                continue
            if SKIP_HEADING.match(s) and len(s) < 70:
                finalize()
                skip = True
                skipped_names.append(s)
                i += 1
                continue
            um = UNIT_START.match(s)
            if not (um and start_form_ok(um)) and len(s) <= 120 and not skip:
                # an all-caps line that isn't a recognised heading: a sub-heading, not text
                context["sub"] = s
                subheads += 1
                i += 1
                continue

        if skip:
            skipped_lines += 1
            i += 1
            continue

        m = UNIT_START.match(s)
        alt = False
        if not m:
            m = ALT_START.match(s)
            alt = m is not None
        if m and start_form_ok(m):
            num, suf, rest = m.group(1), m.group(2), m.group(3).strip()
            nxt = entries[i + 1][1] if i + 1 < len(entries) else ""
            probe_src = rest or nxt
            probe = split_heading(probe_src)[0] or probe_src[:80]
            key = num + suf
            accepted = False
            in_toc = key in tb_index.get(block, {})

            if in_toc:
                # The contents are the answer key: accept this section if it is within the next
                # TOC_WINDOW expected entries and its heading agrees (or it is exactly the next one).
                idx, pos, title = tb_index[block][key], ptr[block], toc[block][key]
                if pos <= idx < pos + TOC_WINDOW and (
                        idx == pos or title_match(probe, title) or title_is_omitted(title)):
                    accepted = True
                    ptr[block] = idx + 1
            elif not alt and accept_number(num, suf, last) and (not rest or split_heading(probe_src)[0]):
                # Not in the contents (or this block has none): fall back to numbering order.
                accepted = True

            if accepted:
                finalize()
                if state["pre"] and not units:
                    units.append({"block": "preamble", "number": "Preamble", "lines": state["pre"],
                                  "context": [], "start": state["pre"][0][0]})
                state["pre"] = []
                marks = [(page, int(x)) for x in re.findall(r"(\d{1,2})\*?\[", s[:m.start(1)])]
                state["cur"] = {"block": block, "number": key, "lines": [(page, rest)] if rest else [],
                                "context": ctx_list(), "start": page, "marks": marks}
                last = (int(num), suf)
                i += 1
                continue

        if state["cur"] is not None:
            state["cur"]["lines"].append((page, s))
        elif not units:
            state["pre"].append((page, s))
        i += 1

    finalize()
    return units, skipped_lines, skipped_names, subheads


# ----------------------------------------------------------------------------- chunk building
def assemble(unit, page_notes):
    notes = []
    for p, n in unit.get("marks", []):
        fn = page_notes.get(p, {}).get(n)
        if fn and fn not in notes:
            notes.append(fn)
    for p, t in unit["lines"]:
        for m in MARKER.finditer(t):
            fn = page_notes.get(p, {}).get(int(m.group(1)))
            if fn and fn not in notes:
                notes.append(fn)

    paras = []
    for _p, t in unit["lines"]:
        t = MARKER.sub("[", t)
        t = re.sub(r"_+", "\u2014", t)
        if paras and not NEW_PARA.match(t):
            paras[-1] += " " + t
        else:
            paras.append(t)

    paras = [re.sub(r"[ \t]+", " ", p).strip() for p in paras]
    return "\n".join(p for p in paras if p), notes


def is_omitted(text):
    stripped = re.sub(r"[\[\]\*\s.\d{}]", "", text).lower()
    return stripped in ("", "omitted", "repealed", "omittedbyact", "repealedbyact")


def split_text(text):
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]
    parts, buf = [], ""
    for p in text.split("\n"):
        if buf and ((len(buf) >= TARGET_CHUNK_CHARS and SPLIT_AT_CLAUSE.match(p))
                    or len(buf) + len(p) + 1 > MAX_CHUNK_CHARS):
            parts.append(buf)
            buf = ""
        buf = f"{buf}\n{p}" if buf else p
        while len(buf) > MAX_CHUNK_CHARS:
            cut = buf.rfind(". ", 0, MAX_CHUNK_CHARS)
            cut = cut + 1 if cut > TARGET_CHUNK_CHARS // 2 else MAX_CHUNK_CHARS
            parts.append(buf[:cut].strip())
            buf = buf[cut:].strip()
    if buf:
        parts.append(buf)
    return parts


def citation_for(cfg, block, number):
    title = cfg["title"]
    if block.startswith("ORDER "):
        roman = block.split(" ", 1)[1]
        return f"Order {roman}, Rule {number}, {title}", f"{cfg['short']} O.{roman} r.{number}"
    if block == "preamble":
        return f"Preamble, {title}", f"{cfg['short']} Preamble"
    abbr = "s." if cfg["unit"] == "Section" else "Art."
    return f"{cfg['unit']} {number}, {title}", f"{cfg['short']} {abbr} {number}"


def build_chunks(doc_id, cfg, units, toc, page_notes, ocr_pages, source=None):
    chunks, stats = [], {"mismatch": [], "omitted": 0, "split": 0, "flagged": []}
    bad = set(ocr_pages)

    for u in units:
        text, notes = assemble(u, page_notes)
        derived, rest = split_heading(text.split("\n", 1)[0])
        remaining = text.split("\n", 1)[1] if "\n" in text else ""
        toc_title = toc.get(u["block"], {}).get(u["number"]) if toc else None

        if u["block"] == "preamble":
            body, heading = text, "Preamble"
        elif derived and len(derived) <= 160:
            body = (rest + ("\n" + remaining if remaining else "")).strip()
            heading = derived
        else:
            body, heading = text, ""

        if toc_title:
            if derived and not title_match(derived, toc_title):
                stats["mismatch"].append(f"{u['block']} {u['number']}: body='{derived[:40]}' toc='{toc_title[:40]}'")
            heading = toc_title

        omitted_by_toc = bool(toc_title) and title_is_omitted(toc_title)
        status = "omitted" if (u["block"] != "preamble" and (omitted_by_toc or is_omitted(text) or says_omitted(text))) else "in_force"
        if status == "omitted":
            stats["omitted"] += 1

        pages = sorted({p for p, _ in u["lines"]} | {u["start"]})
        flagged = bool(bad & set(pages))
        citation, short = citation_for(cfg, u["block"], u["number"])
        if flagged:
            stats["flagged"].append(short)

        pieces = split_text(body) if body.strip() else [""]
        if len(pieces) > 1:
            stats["split"] += 1

        for k, piece in enumerate(pieces, 1):
            chunks.append({
                "id": f"{doc_id}:{u['block']}:{u['number']}" + (f":{k}" if len(pieces) > 1 else ""),
                "doc_id": doc_id,
                "act": cfg["title"],
                "unit_type": "Preamble" if u["block"] == "preamble" else ("Rule" if u["block"].startswith("ORDER ") else cfg["unit"]),
                "block": u["block"],
                "number": u["number"],
                "citation": citation,
                "short_citation": short,
                "heading": heading,
                "context": u["context"],
                "text": piece,
                "part": k,
                "parts": len(pieces),
                "pages": [pages[0], pages[-1]],
                "status": status,
                "notes": notes if k == 1 else [],
                "needs_review": flagged,
                "source_file": f"{doc_id}.txt",
                "source": source,
            })

    return chunks, stats


# ----------------------------------------------------------------------------- per-document run + report
def diagnose(key, entries, toc_block, raw_entries=None):
    """Say WHY a section from the contents wasn't found, quoting the line that failed."""
    mm = re.match(r"(\d+)([A-Z]*)$", key)
    num, suf = (mm.group(1), mm.group(2)) if mm else (key, "")
    core = f"{num}[\\s\\-\u2013]*{suf}" if suf else num

    start_pat = re.compile(r"^" + MARK_PREFIX + core + r"\s*[.,]")
    for page, s in entries:
        if start_pat.match(s):
            m = UNIT_START.match(s) or ALT_START.match(s)
            shown = s[:70]
            if not m:
                return f"p.{page} '{shown}' -> line shape not recognised"
            if not start_form_ok(m):
                return f"p.{page} '{shown}' -> text after the number starts with '{m.group(3)[:1]}', not a capital/quote/bracket"
            return (f"p.{page} '{shown}' -> looks like a section start but was not accepted "
                    f"(out of order, or heading differs from contents '{toc_block.get(key, '')[:40]}')")

    if raw_entries:
        dropped = [(p, s) for p, s in raw_entries if start_pat.match(s)][:2]
        if dropped:
            return ("a line starting with this number is in the raw text but was DROPPED while cleaning "
                    "(probably taken for a footnote): " + " || ".join(f"p.{p} '{s[:70]}'" for p, s in dropped))

    title = norm(toc_block.get(key, ""))[:28]
    if len(title) >= 10 and not title_is_omitted(toc_block.get(key, "")):
        found = [(p, s) for p, s in entries if title in norm(s)][:2]
        if found:
            return ("the heading wording is there but the number isn't on the same line: "
                    + " || ".join(f"p.{p} '{s[:80]}'" for p, s in found))

    token = re.compile(r"(?<![\d\w.(])" + core + r"(?![\d\w)])")
    hits = [(p, s) for p, s in entries if token.search(s)][:2]
    if hits:
        return "number appears, but not as a section start: " + " || ".join(f"p.{p} '{s[:80]}'" for p, s in hits)
    return "this number does not appear anywhere in the body text (text missing, or written another way)"


def parse_sources(path):
    out = {}
    with open(path, encoding="utf-8-sig", errors="replace") as f:
        for line in f:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 4 or not parts[0].lower().endswith(".pdf"):
                continue
            date = re.search(r"\d{4}-\d{2}-\d{2}", parts[4]) if len(parts) > 4 else None
            out[parts[0][:-4].strip()] = {
                "title": parts[1], "site": parts[2], "url": parts[3],
                "downloaded": date.group(0) if date else (parts[4] if len(parts) > 4 else ""),
                "note": parts[5] if len(parts) > 5 else "",
            }
    return out


def find_sources_file(pdf_dir, base):
    tried = []
    for folder in (pdf_dir, base, ".", os.path.dirname(os.path.abspath(base)) or "."):
        if folder in tried:
            continue
        tried.append(folder)
        if os.path.isdir(folder):
            for name in sorted(os.listdir(folder)):
                low = name.lower()
                if low.startswith("sources") and low.endswith(".txt"):
                    return os.path.join(folder, name), tried
    return None, tried


def load_sources(pdf_dir, base):
    path, _tried = find_sources_file(pdf_dir, base)
    return parse_sources(path) if path else {}


def process_doc(doc_id, base, pdf_dir, check_pdf, sources=None):
    cfg = DOC_CONFIG.get(doc_id) or {"title": doc_id.replace("_", " ").title(), "short": doc_id, "unit": "Section"}
    with open(os.path.join(base, "raw_text", f"{doc_id}.txt"), encoding="utf-8") as f:
        pages = load_pages(f.read())

    cleaned, page_notes = [], {}
    for no, lines in pages:
        body, notes = clean_page(lines)
        cleaned.append((no, body))
        page_notes[no] = notes

    body_idx = find_body_start(cleaned)
    toc_entries = [(no, l) for no, ls in cleaned[:body_idx] for l in ls]
    body_entries = [(no, l) for no, ls in cleaned[body_idx:] for l in ls]
    toc = parse_toc(toc_entries) if toc_entries else {}
    raw_entries = [(no, l.strip()) for no, ls in pages[body_idx:] for l in ls if l.strip()]

    units, skipped_lines, skipped_names, subheads = parse_units(body_entries, toc)

    ocr_pages = []
    pdf_path = os.path.join(pdf_dir, f"{doc_id}.pdf")
    if check_pdf and os.path.exists(pdf_path):
        ocr_pages = ocr_pages_from_pdf(pdf_path)

    source = (sources or {}).get(doc_id)
    chunks, stats = build_chunks(doc_id, cfg, units, toc, page_notes, ocr_pages, source)

    found = defaultdict(set)
    for u in units:
        if u["block"] != "preamble":
            found[u["block"]].add(u["number"])

    problems, omitted_absent = [], []
    for blk, exp in toc.items():
        all_missing = sorted([n for n in exp if n not in found.get(blk, set())], key=num_key)
        missing = [n for n in all_missing if not title_is_omitted(exp[n])]
        omitted_absent += [f"{n}" if blk == "main" else f"{blk} {n}" for n in all_missing if title_is_omitted(exp[n])]
        extra = sorted([n for n in found.get(blk, set()) if n not in exp], key=num_key)
        if missing or extra:
            problems.append((blk, len(exp), missing, extra))

    # ---------------- report
    R = [f"== {doc_id}  ({cfg['title']})"]
    R.append(f"pages: {len(pages)} | contents on pages 1-{body_idx} | body starts at page {pages[body_idx][0] if pages else '?'}"
             f" | skipped schedule/appendix lines: {skipped_lines} | all-caps sub-heading lines: {subheads}" + (f" ({'; '.join(dict.fromkeys(skipped_names))[:120]})" if skipped_names else ""))
    R.append("source: " + (f"{source['site']}, downloaded {source['downloaded']}" + (f", note: {source['note']}" if source["note"] else "")
                           if source else "NOT LISTED in SOURCES.txt"))
    R.append(f"pages with no usable text layer (OCR'd): {ocr_pages if ocr_pages else 'none'}"
             + ("" if check_pdf and os.path.exists(pdf_path) else "   [PDF not checked]"))
    toc_total = sum(len(v) for v in toc.values())
    R.append(f"contents entries: {toc_total} across {len(toc)} block(s)"
             + (f" | units found: {sum(len(v) for v in found.values())}" if toc else ""))
    inforce = sum(1 for c in chunks if c["status"] == "in_force" and c["part"] == 1)
    R.append(f"units: {len(units)} (in force {inforce}, omitted/repealed {stats['omitted']}) -> {len(chunks)} chunks, {stats['split']} long unit(s) split")

    if not toc:
        R.append("CHECK: no table of contents detected - cannot cross-check section numbers")
    elif not problems:
        R.append("CHECK: every section in the contents was found, and nothing extra  [OK]")
        if omitted_absent:
            R.append(f"note: {len(omitted_absent)} section(s) the contents list as omitted/repealed have no text in the body (fine): {omitted_absent[:20]}")
    else:
        R.append(f"CHECK: {len(problems)} block(s) disagree with the contents:")
        for blk, n, missing, extra in problems[:12]:
            R.append(f"   {blk}: contents list {n}")
            if missing:
                R.append(f"      MISSING from body ({len(missing)}): {missing[:30]}{' ...' if len(missing) > 30 else ''}")
                if blk == "main":
                    first_order = next((n for n, (_p, l) in enumerate(body_entries) if is_upper_line(l) and BLOCK_HEADING.match(l)), len(body_entries))
                    for k in missing[:12]:
                        R.append(f"         why {k}: {diagnose(k, body_entries[:first_order], toc.get(blk, {}), raw_entries)}")
            if extra:
                R.append(f"      NOT in contents ({len(extra)}): {extra[:30]}{' ...' if len(extra) > 30 else ''}")
        if len(problems) > 12:
            R.append(f"   ... and {len(problems) - 12} more block(s)")
        if omitted_absent:
            R.append(f"note: {len(omitted_absent)} more listed as omitted/repealed in the contents have no body text (fine, not counted above): {omitted_absent[:20]}")

    if stats["mismatch"]:
        R.append(f"heading differs from contents in {len(stats['mismatch'])} unit(s), e.g.:")
        R.extend(f"   {x}" for x in stats["mismatch"][:4])

    if stats["flagged"]:
        R.append(f"FLAGGED for review (touch an OCR'd page): {len(stats['flagged'])} unit(s): {stats['flagged'][:25]}")

    lens = [len(c["text"]) for c in chunks if c["status"] == "in_force"]
    if lens:
        R.append(f"chunk size (chars): min {min(lens)} | median {int(statistics.median(lens))} | max {max(lens)}")
        tiny = [c["short_citation"] for c in chunks if c["status"] == "in_force" and len(c["text"]) < 40]
        if tiny:
            R.append(f"very short chunks (<40 chars): {len(tiny)} e.g. {tiny[:8]}")
        longest = sorted(((len(c["text"]), c["short_citation"]) for c in chunks), reverse=True)[:3]
        R.append(f"longest chunks: {longest}")

    for pno in ocr_pages[:6]:
        for no, lines in cleaned:
            if no == pno:
                R.append(f"   [page {pno} as extracted]: " + " / ".join(lines[:5])[:260])

    mids = [chunks[0], chunks[len(chunks) // 2], chunks[-1]] if chunks else []
    for c in mids:
        R.append(f"   sample> {c['short_citation']} | {c['heading'][:50]} | {c['text'][:160].replace(chr(10), ' / ')}")

    return chunks, R


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ap = argparse.ArgumentParser(description="Build citable knowledge-base chunks from raw statute text.")
    ap.add_argument("docs", nargs="*", help="document ids (file names without .txt); default: all")
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--pdf-dir", default=None, help="default: <base>/source_pdfs")
    ap.add_argument("--no-pdf-check", action="store_true")
    args = ap.parse_args()

    raw_dir = os.path.join(args.base, "raw_text")
    pdf_dir = args.pdf_dir or os.path.join(args.base, "source_pdfs")
    out_dir = os.path.join(args.base, "chunks")

    sources_path, tried = find_sources_file(pdf_dir, args.base)
    sources = parse_sources(sources_path) if sources_path else {}
    docs = args.docs or sorted(f[:-4] for f in os.listdir(raw_dir) if f.endswith(".txt"))
    os.makedirs(out_dir, exist_ok=True)

    report, all_chunks = [], []
    report.append("source: " + (f"SOURCES file found at {sources_path} with {len(sources)} entries: {sorted(sources)}"
                                if sources_path else f"SOURCES.txt NOT FOUND (looked in: {', '.join(tried)})"))
    report.append("")
    for d in docs:
        try:
            chunks, lines = process_doc(d, args.base, pdf_dir, not args.no_pdf_check, sources)
        except Exception as e:
            report.append(f"== {d}\n   FAILED: {type(e).__name__}: {e}")
            continue
        with open(os.path.join(out_dir, f"{d}.jsonl"), "w", encoding="utf-8") as f:
            for c in chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        all_chunks.extend(chunks)
        report.extend(lines)
        report.append("")

    with open(os.path.join(out_dir, "_all.jsonl"), "w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    usable = sum(1 for c in all_chunks if c["status"] == "in_force" and not c["needs_review"])
    report.append(f"TOTAL: {len(all_chunks)} chunks, of which {usable} are in force and not flagged (these are what the index will use).")

    text = "\n".join(report)
    with open(os.path.join(args.base, "build_report.txt"), "w", encoding="utf-8") as f:
        f.write(text)
    print(text)
    print(f"\nReport saved to {os.path.join(args.base, 'build_report.txt')}")


if __name__ == "__main__":
    main()