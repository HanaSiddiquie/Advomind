# advomind-backend/gemini_check.py
"""
Diagnoses why Gemini calls fail. Run from the advomind-backend folder:

    python gemini_check.py

It prints only the first/last 4 characters of your key, never the whole thing.
Step 1: can the key list models at all?   (separates "bad key" from "bad model")
Step 2: which models does the key see?
Step 3: does a tiny generateContent call work, and on which model?
"""

import os
import re
import sys

import requests
from dotenv import load_dotenv

load_dotenv(override=True)

BASE = "https://generativelanguage.googleapis.com/v1beta"

key = (os.environ.get("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
if not key:
    print("GEMINI_API_KEY is not set. Check advomind-backend/.env")
    sys.exit(1)

if key.startswith("AQ."):
    kind = "AQ. (the newer 'authorization key' format)"
elif key.startswith("AIza"):
    kind = "AIza (the older key format)"
else:
    kind = "UNRECOGNISED format - check .env for typos, quotes or a pasted extra word"

print(f"Key: {key[:4]}...{key[-4:]}  |  {len(key)} characters  |  {kind}")


def call(method, url, use_header=True, body=None, timeout=40):
    kwargs = {"timeout": timeout, "headers": {"Content-Type": "application/json"}}
    if use_header:
        kwargs["headers"]["x-goog-api-key"] = key
    else:
        kwargs["params"] = {"key": key}
    if body is not None:
        kwargs["json"] = body
    return requests.request(method, url, **kwargs)


def describe(resp):
    try:
        err = resp.json()["error"]
        details = err.get("details") or [{}]
        reason = details[0].get("reason", "")
        return f"HTTP {resp.status_code} {reason} - {err.get('message', '')[:100]}"
    except Exception:
        return f"HTTP {resp.status_code} {resp.text[:120]}"


# ---------------------------------------------------------------- step 1
print("\nStep 1: can this key list models at all?")
list_resp = None
working_style = None

for label, use_header in [("x-goog-api-key header", True), ("?key= query parameter", False)]:
    resp = call("GET", f"{BASE}/models?pageSize=100", use_header=use_header)
    ok = resp.status_code == 200
    print(f"  {'OK    ' if ok else 'FAILED'} via {label}: {'listed models' if ok else describe(resp)}")
    if ok and list_resp is None:
        list_resp, working_style = resp, use_header

if list_resp is None:
    print("\nRESULT: Google rejects this key outright, before any model is involved.")
    print("  - Create a brand-new key in a NEW AI Studio project (not just 'regenerate'),")
    print("    put it in .env, and run this script again.")
    print("  - If NEW keys fail the same way, it's an account-level problem on Google's side")
    print("    (several people report it). Then either wait/report it to Google, try a different")
    print("    Google account, or switch the summarizer to another provider - it's one function.")
    sys.exit(2)

# ---------------------------------------------------------------- step 2
models = []
for m in list_resp.json().get("models", []):
    name = m.get("name", "").replace("models/", "")
    if "generateContent" not in (m.get("supportedGenerationMethods") or []):
        continue
    if "flash" not in name or any(bad in name for bad in ("image", "tts", "live", "audio", "embedding", "robotics")):
        continue
    models.append(name)

models = sorted(set(models), reverse=True)
print(f"\nStep 2: the key can use {len(models)} text 'flash' model(s). Newest-looking first:")
for name in models[:8]:
    print("   ", name)

configured = None
try:
    text = open("ai_routes.py", encoding="utf-8").read()
    found = re.search(r'GEMINI_MODEL\s*=\s*"([^"]+)"', text)
    configured = found.group(1) if found else None
except OSError:
    pass

candidates = []
if configured:
    candidates.append(configured)
candidates += [m for m in models[:4] if m not in candidates]

# ---------------------------------------------------------------- step 3
print("\nStep 3: tiny generateContent test on each candidate (each can take up to 25 seconds)")
winner = None
for name in candidates:
    tag = " (the one currently set in ai_routes.py)" if name == configured else ""
    print(f"  testing {name}{tag} ...", flush=True)
    try:
        resp = call(
            "POST", f"{BASE}/models/{name}:generateContent", use_header=working_style, timeout=25,
            body={"contents": [{"parts": [{"text": "Reply with the single word: ok"}]}]},
        )
    except Exception as e:
        print(f"    ERROR   no usable reply: {type(e).__name__}: {str(e)[:110]}")
        continue

    if resp.status_code == 200:
        print("    WORKS")
        winner = winner or name
    elif resp.status_code == 503:
        print("    BUSY    overloaded right now (the key is fine - retry later)")
        winner = winner or name
    else:
        print(f"    FAILED  {describe(resp)}")

print()
if winner and winner == configured:
    print(f"RESULT: everything works with {winner}. If the app still fails, Flask is loading a")
    print("different key than .env - apply the load_dotenv(override=True) change.")
elif winner:
    print(f"RESULT: the key works, but not with the model currently configured. In ai_routes.py set:")
    print(f'    GEMINI_MODEL = "{winner}"')
else:
    print("RESULT: the key can list models but generateContent fails on all of them.")
    print("  See the errors above; if they are 401 ACCESS_TOKEN_TYPE_UNSUPPORTED, this matches the")
    print("  newer-key-format problem several people report. Try a key from a NEW project.")