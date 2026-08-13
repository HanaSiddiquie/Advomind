# advomind-backend/app.py
from flask import Flask
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()  # reads .env in this folder into os.environ

from admin_routes import admin_bp
from notifications import check_and_send_reminders
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
CORS(app)
app.register_blueprint(admin_bp)

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