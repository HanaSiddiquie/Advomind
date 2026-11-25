# advomind-backend/app.py
import os
import traceback

from dotenv import load_dotenv
from flask import Flask, jsonify, abort, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

load_dotenv(override=True)  # .env wins over stale shell/system variables

from admin_routes import admin_bp
from ai_routes import ai_bp
from notifications import check_and_send_reminders
from apscheduler.schedulers.background import BackgroundScheduler
from account_cleanup import cleanup_unverified_accounts

app = Flask(__name__, static_folder=None)  # the React build's /static files are served below
CORS(app)
app.register_blueprint(admin_bp)
app.register_blueprint(ai_bp)

# OCR is optional: if its packages (pymupdf, pytesseract, python-docx) aren't
# installed, switch OCR off and keep the rest of the backend running instead
# of crashing everything at startup.
try:
    from ocr_routes import ocr_bp
    app.register_blueprint(ocr_bp)
except Exception as e:
    traceback.print_exc()
    _ocr_error = f"{type(e).__name__}: {e}"
    print(f"[warning] OCR routes disabled: {_ocr_error}")

try:
    from chat_routes import chat_bp
    app.register_blueprint(chat_bp)
except Exception as e:
    print(f"[warning] Chat routes disabled: {type(e).__name__}: {e}")

try:
    from email_check_routes import email_bp
    app.register_blueprint(email_bp)
except Exception as e:
    print(f"[warning] Email check disabled: {type(e).__name__}: {e}")

    @app.route("/ocr/process-file", methods=["POST"])
    def ocr_disabled():
        return jsonify({"error": f"OCR is disabled on the server: {_ocr_error}"}), 503


@app.errorhandler(Exception)
def handle_unexpected_error(e):
    """Without this, in Flask debug mode an unexpected error returns a 500 with no
    CORS headers, which the browser shows as an unhelpful 'Failed to fetch'."""
    if isinstance(e, HTTPException):
        return e
    traceback.print_exc()
    return jsonify({"error": f"Unexpected server error: {type(e).__name__}: {e}"}), 500


# Flask's debug reloader spawns a child process that re-imports this module,
# which would start a second scheduler instance. WERKZEUG_RUN_MAIN is only
# set in that child process, so this guard keeps it to one scheduler.
if os.environ.get("WERKZEUG_RUN_MAIN") != "true" or not app.debug:
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_and_send_reminders, "interval", hours=1, id="hearing_reminders")
    scheduler.add_job(cleanup_unverified_accounts, "interval", hours=24, id="cleanup_unverified")
    scheduler.start()
    # Also run once at startup so reminders don't wait up to an hour to fire
    # the first time the server comes up.
    scheduler.add_job(check_and_send_reminders, id="hearing_reminders_startup")


# =========================
# HOME
# =========================
# =========================
# FRONTEND (optional)
# =========================
# If the React app has been built (frontend/build), serve it from here too, so one
# address (for example one ngrok link) serves both the site and the API.
# On a host where there is no build folder, none of this does anything.
BUILD_DIR = os.path.abspath(
    os.environ.get("FRONTEND_BUILD_DIR")
    or os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
)
HAS_FRONTEND = os.path.isfile(os.path.join(BUILD_DIR, "index.html"))
API_PREFIXES = ("ai", "ocr", "chat", "admin", "email")


def _index():
    resp = send_from_directory(BUILD_DIR, "index.html")
    resp.headers["Cache-Control"] = "no-cache"
    return resp


# =========================
# HOME
# =========================
@app.route('/')
def home():
    if HAS_FRONTEND:
        return _index()
    return "Advomind Backend Running"


if HAS_FRONTEND:
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.split("/")[0] in API_PREFIXES:
            abort(404)  # an unknown API address should be a real 404, not the web page
        if os.path.isfile(os.path.join(BUILD_DIR, path)):
            return send_from_directory(BUILD_DIR, path)
        return _index()  # page addresses like /cases/123 are handled by the React router


# =========================
# RUN
# =========================
if __name__ == '__main__':
    app.run(debug=True)