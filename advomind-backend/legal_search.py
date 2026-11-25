# advomind-backend/legal_search.py
"""
Search over the legal knowledge base (knowledge_base/chunks/_all.jsonl, built by
kb_build.py). No external services and no extra packages:

  1. DIRECT LOOKUP  - "section 302 PPC", "article 10A", "order 7 rule 11" (also in
                      Urdu / Roman Urdu: "دفعہ 302", "dafa 302") fetch the exact chunk(s).
  2. KEYWORD SEARCH - BM25 ranking over section headings + text for everything else.

retrieve() returns the chunk dicts to hand to the model as numbered excerpts.
"""

import json
import math
import os
import re
from collections import Counter, defaultdict

KB_PATH = os.environ.get("KB_CHUNKS_PATH") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "knowledge_base", "chunks", "_all.jsonl"
)

SECTION_ACTS = ["ppc_1860", "crpc_1898", "cpc_1908", "contract_act_1872"]
ARTICLE_ACTS = ["constitution_1973", "qanun_e_shahadat_1984"]

ACT_PATTERNS = [
    ("ppc_1860", r"\bppc\b|p\.p\.c|penal code|pakistan penal|پی پی سی|تعزیرات"),
    ("crpc_1898", r"\bcrpc\b|cr\.?\s?p\.?\s?c\b|criminal procedure|ضابطہ فوجداری|سی آر پی سی"),
    ("cpc_1908", r"\bcpc\b|c\.p\.c|civil procedure|ضابطہ دیوانی|سی پی سی"),
    ("constitution_1973", r"constitution|\bconst\b|آئین|دستور"),
    ("qanun_e_shahadat_1984", r"\bqso\b|qanun[- ]?e[- ]?shahadat|law of evidence|evidence order|قانون شہادت"),
    ("contract_act_1872", r"contract act|معاہدہ"),
]

STOP = set("""
a an the of to in on at for by with from and or but not nor is are was were be been being am do does
did have has had this that these those it its as if then than so such into upon under over any all
each other shall may must can will would should could which who whom whose what when where why how
i you he she we they me my your his her our their them there here also etc per via about between
against
""".split())

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def _stem(w):
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    for suf in ("ations", "ation", "ings", "ing", "edly", "ed", "es", "s", "ly"):
        if len(w) > len(suf) + 2 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def tokens(text):
    out = []
    for t in re.findall(r"[a-z0-9]+", (text or "").lower()):
        if t in STOP:
            continue
        if len(t) < 2 and not t.isdigit():
            continue
        out.append(_stem(t))
    return out


def _norm_num(n):
    return re.sub(r"[^A-Z0-9]", "", str(n).upper())


def _to_roman(n):
    vals = [(50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out


class _Index:
    def __init__(self, chunks):
        self.chunks = chunks
        self.tf = []
        self.dl = []
        self.df = Counter()
        self.inv = defaultdict(list)
        self.by_key = defaultdict(list)    # (doc_id, NUMBER) -> chunks (Sections / Articles / Preamble)
        self.rules = defaultdict(list)     # (ROMAN, RULE) -> chunks (CPC Orders)
        self.vocab = set()

        for i, c in enumerate(chunks):
            heading = c.get("heading") or ""
            toks = tokens(heading) * 3 + tokens(" ".join(c.get("context") or [])) + tokens(c.get("text"))
            tf = Counter(toks)
            self.tf.append(tf)
            self.dl.append(len(toks))
            for term in tf:
                self.df[term] += 1
                self.inv[term].append(i)
            self.vocab.update(tf.keys())

            sc = c.get("short_citation") or ""
            m = re.match(r"^CPC O\.([IVXLC]+) r\.([0-9A-Za-z]+)$", sc)
            if c.get("unit_type") == "Rule" and m:
                self.rules[(m.group(1), _norm_num(m.group(2)))].append(c)
            elif c.get("unit_type") in ("Section", "Article"):
                self.by_key[(c["doc_id"], _norm_num(c.get("number")))].append(c)

        self.avgdl = (sum(self.dl) / len(self.dl)) if self.dl else 1.0

    def search(self, query, k):
        q = list(dict.fromkeys(tokens(query)))
        if not q:
            return []
        n = len(self.chunks)
        k1, b = 1.4, 0.75
        scores = defaultdict(float)
        for term in q:
            df = self.df.get(term, 0)
            if not df:
                continue
            idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
            for i in self.inv[term]:
                tf = self.tf[i][term]
                denom = tf + k1 * (1 - b + b * self.dl[i] / self.avgdl)
                scores[i] += idf * (tf * (k1 + 1)) / denom
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        out = []
        for i, s in ranked:
            c = self.chunks[i]
            if c.get("status") == "omitted":
                continue
            out.append(c)
            if len(out) >= k:
                break
        return out


_INDEX = None
_LOAD_ERROR = None


def _load():
    global _INDEX, _LOAD_ERROR
    try:
        with open(KB_PATH, "r", encoding="utf-8") as f:
            chunks = [json.loads(line) for line in f if line.strip()]
        _INDEX = _Index(chunks)
        print(f"[legal_search] loaded {len(chunks)} chunks from {KB_PATH}")
    except Exception as e:  # never take the server down over the knowledge base
        _LOAD_ERROR = f"{type(e).__name__}: {e}"
        print(f"[legal_search] could not load knowledge base: {_LOAD_ERROR}")


_load()


def available():
    return _INDEX is not None


def load_error():
    return _LOAD_ERROR


def loaded_acts():
    if not _INDEX:
        return []
    seen = {}
    for c in _INDEX.chunks:
        seen.setdefault(c["doc_id"], c["act"])
    return list(seen.values())


def english_coverage(text):
    """Share of the words in `text` that appear in the knowledge base. Plain English
    questions score high; Urdu script and Roman Urdu score low."""
    if not _INDEX:
        return 0.0
    words = tokens(text)
    if not words:
        return 0.0
    return sum(1 for w in words if w in _INDEX.vocab) / len(words)


# ---------------------------------------------------------------- references

def detect_acts(text):
    t = (text or "").lower()
    return [doc for doc, pat in ACT_PATTERNS if re.search(pat, t)]


_SECTION_RE = re.compile(
    r"(?:\bsections?\b|\bsec\b\.?|\bs\.|\bdafa(?:h)?\b|\bdaf'?a\b|دفعہ|دفعه|دفعات)\s*[:#-]?\s*(\d{1,3})-?([a-z]{0,2})\b"
)
_ACT_NUM_RE = re.compile(r"\b(ppc|crpc|cpc|qso)\s*(?:s\.?|sec\.?|section)?\s*(\d{1,3})-?([a-z]{0,2})\b")
_ARTICLE_RE = re.compile(
    r"(?:\barticles?\b|\bart\b\.?|آرٹیکل|آرٹیکلز)\s*[:#-]?\s*(\d{1,3})-?([a-z]{0,2})\b"
)
_ORDER_RE = re.compile(r"\border\s+(\d{1,2}|[ivxlc]+)\s*,?\s*rule\s+(\d{1,3})-?([a-z]{0,2})\b")
_ORDER_SHORT_RE = re.compile(r"\bo\.?\s*(\d{1,2})\s*,?\s*r\.?\s*(\d{1,3})-?([a-z]{0,2})\b")

_ACT_WORD = {"ppc": "ppc_1860", "crpc": "crpc_1898", "cpc": "cpc_1908", "qso": "qanun_e_shahadat_1984"}


def find_references(text):
    """-> list of {"kind": "section"|"article"|"rule", "docs": [...], "number": "302"}"""
    t = (text or "").translate(_DIGITS).lower()
    acts = detect_acts(t)
    refs = []

    for m in _ORDER_RE.finditer(t):
        o = m.group(1)
        roman = o.upper() if not o.isdigit() else _to_roman(int(o))
        refs.append({"kind": "rule", "roman": roman, "number": _norm_num(m.group(2) + m.group(3))})
    for m in _ORDER_SHORT_RE.finditer(t):
        refs.append({"kind": "rule", "roman": _to_roman(int(m.group(1))), "number": _norm_num(m.group(2) + m.group(3))})

    sec_docs = [a for a in acts if a in SECTION_ACTS] or SECTION_ACTS
    for m in _SECTION_RE.finditer(t):
        refs.append({"kind": "section", "docs": sec_docs, "number": _norm_num(m.group(1) + m.group(2))})
    for m in _ACT_NUM_RE.finditer(t):
        refs.append({"kind": "section", "docs": [_ACT_WORD[m.group(1)]], "number": _norm_num(m.group(2) + m.group(3))})

    art_docs = [a for a in acts if a in ARTICLE_ACTS] or ARTICLE_ACTS
    for m in _ARTICLE_RE.finditer(t):
        refs.append({"kind": "article", "docs": art_docs, "number": _norm_num(m.group(1) + m.group(2))})

    return refs


def _clean_extra_refs(extra):
    """References suggested by the model (query rewrite). Validated strictly."""
    out = []
    valid_docs = set(SECTION_ACTS + ARTICLE_ACTS)
    for r in (extra or [])[:4]:
        if not isinstance(r, dict):
            continue
        number = _norm_num(r.get("number") or "")
        if not number or len(number) > 6:
            continue
        doc = r.get("act")
        kind = r.get("kind") or "section"
        docs = [doc] if doc in valid_docs else (ARTICLE_ACTS if kind == "article" else SECTION_ACTS)
        out.append({"kind": "article" if kind == "article" else "section", "docs": docs, "number": number})
    return out


def _lookup(ref):
    if not _INDEX:
        return []
    if ref["kind"] == "rule":
        return list(_INDEX.rules.get((ref["roman"], ref["number"]), []))
    found = []
    for doc in ref["docs"]:
        found.extend(_INDEX.by_key.get((doc, ref["number"]), []))
    return found


_FILLER = set("""
section sections sec article articles art order rule rules say says said mean means meaning tell
explain about define defined please give show what dafa dafah act code
""".split())

_REF_STRIP = re.compile(
    "|".join([_SECTION_RE.pattern, _ACT_NUM_RE.pattern, _ARTICLE_RE.pattern, _ORDER_RE.pattern, _ORDER_SHORT_RE.pattern])
)


def _topic_words(text):
    """The question with section numbers, Act names and filler removed - what is left
    is the actual topic, if there is one."""
    t = (text or "").translate(_DIGITS).lower()
    t = _REF_STRIP.sub(" ", t)
    for _doc, pat in ACT_PATTERNS:
        t = re.sub(pat, " ", t)
    return [w for w in re.findall(r"[a-z]+", t) if w not in _FILLER and w not in STOP and len(w) > 2]


def retrieve(message, english_query="", extra_refs=None, k=6, max_total=8):
    """Returns a list of chunk dicts (each with a "_via" of "lookup" or "search").

    Exact section/article/rule references come first. Keyword search only adds extra
    context if the question also names a topic ("what is the punishment under
    section 379") - a bare "section 302 PPC" gets just that section."""
    if not _INDEX:
        return []

    refs = find_references(message)
    if english_query and english_query != message:
        refs += find_references(english_query)
    refs += _clean_extra_refs(extra_refs)

    picked, seen = [], set()

    def add(chunks, via):
        for c in chunks:
            if c["id"] in seen or len(picked) >= max_total:
                continue
            seen.add(c["id"])
            picked.append(dict(c, _via=via))

    for ref in refs:
        add(sorted(_lookup(ref), key=lambda c: c.get("part") or 1), "lookup")

    query = english_query or message
    if not picked:
        add(_INDEX.search(query, k), "search")
        if not picked and query != message:
            add(_INDEX.search(message, k), "search")  # the rewrite found nothing - try the user's own words
    elif len(_topic_words(query)) >= 2:
        add(_INDEX.search(query, len(picked) + 2), "search")
    return picked