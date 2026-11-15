# advomind-backend/app.py
import os
import traceback

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

load_dotenv(override=True)  # .env wins over stale shell/system variables

from admin_routes import admin_bp
from ai_routes import ai_bp
from notifications import check_and_send_reminders
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
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
    print(f"[warning] OCR routes disabled: {type(e).__name__}: {e}")


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
    scheduler.start()
    # Also run once at startup so reminders don't wait up to an hour to fire
    # the first time the server comes up.
    scheduler.add_job(check_and_send_reminders, id="hearing_reminders_startup")


# =========================
# HOME
# =========================
@app.route('/')
def home():
    return "Advomind Backend Running"


# =========================
# RUN
# =========================
if __name__ == '__main__':
    app.run(debug=True)