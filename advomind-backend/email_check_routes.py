# advomind-backend/email_check_routes.py
"""
Signup email check (no login needed, because it runs BEFORE the account exists).

  POST /email/check   {"email": "..."}  ->  {"ok": true}  or  {"ok": false, "message": "..."}

An address is accepted when:
  * it is shaped like name@domain.com,
  * its domain is not a throwaway-mail service, and
  * its domain is a well-known provider (Gmail, Yahoo, Outlook ...) or really receives email
    (checked with a free public DNS lookup for mail servers).

If the DNS lookup itself can't be reached, the address is let through - the verification
link the user must click is the real proof, this check only filters out made-up domains.
"""

import re
import time
from collections import defaultdict, deque

import requests
from flask import Blueprint, request, jsonify

email_bp = Blueprint("email_check", __name__, url_prefix="/email")

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

KNOWN_PROVIDERS = {
    "gmail.com", "googlemail.com",
    "yahoo.com", "yahoo.co.uk", "yahoo.co.in", "ymail.com",
    "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com",
    "icloud.com", "me.com",
    "proton.me", "protonmail.com",
    "aol.com", "mail.com", "zoho.com",
}

THROWAWAY = {
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com",
    "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com",
    "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mailnesia.com", "tempail.com",
}

DOH_URL = "https://dns.google/resolve"
RATE_LIMIT = 15      # checks ...
RATE_WINDOW = 60     # ... per minute, per IP

_recent = defaultdict(deque)
_cache = {}          # domain -> (expires_at, ok)
CACHE_SECONDS = 3600


def _rate_limited(ip):
    now = time.time()
    q = _recent[ip]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        return True
    q.append(now)
    return False


def _dns(domain, rtype):
    r = requests.get(DOH_URL, params={"name": domain, "type": rtype}, timeout=4)
    r.raise_for_status()
    return r.json()


def domain_receives_mail(domain):
    """True / False, or None when the lookup couldn't be done (then the caller lets it through)."""
    hit = _cache.get(domain)
    if hit and hit[0] > time.time():
        return hit[1]

    try:
        mx = _dns(domain, "MX")
        if mx.get("Status") == 3:                       # NXDOMAIN: the domain doesn't exist
            result = False
        elif any(a.get("type") == 15 for a in mx.get("Answer", []) or []):
            result = True
        else:                                           # no MX: mail can still go to the domain's own address
            a = _dns(domain, "A")
            result = any(x.get("type") == 1 for x in a.get("Answer", []) or [])
    except Exception as e:
        print(f"[email-check] DNS lookup failed for {domain}: {type(e).__name__}")
        return None

    _cache[domain] = (time.time() + CACHE_SECONDS, result)
    return result


@email_bp.route("/check", methods=["POST"])
def check_email():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
    if _rate_limited(ip):
        return jsonify({"ok": False, "message": "Too many attempts. Please wait a minute and try again."}), 429

    email = str((request.get_json(silent=True) or {}).get("email") or "").strip().lower()
    if not EMAIL_RE.match(email):
        return jsonify({"ok": False, "message": "Please enter a valid email address, like name@gmail.com."}), 200

    domain = email.split("@")[1]

    if domain in THROWAWAY:
        return jsonify({"ok": False, "message": "Temporary email addresses can't be used. Please use your real email."}), 200

    if domain in KNOWN_PROVIDERS:
        return jsonify({"ok": True}), 200

    if domain_receives_mail(domain) is False:
        return jsonify({
            "ok": False,
            "message": f"“{domain}” doesn't look like a real email provider. Please check the address.",
        }), 200

    return jsonify({"ok": True}), 200