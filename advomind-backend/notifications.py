# advomind-backend/notifications.py
"""
Reminders: email + push notifications, for both hearings AND standalone
calendar events (diaryEvents).

Two reminder types, checked every hour by a background scheduler:
  - "day before"  : fires once, the day before
  - "morning of"  : fires once, on the day

Each document tracks dayBeforeReminderSent / morningOfReminderSent booleans
so a reminder is never sent twice even though the check runs hourly.

Recipients:
  - Hearings: the owning lawyer, always; plus the assigned secretary if the
    case is assigned, otherwise every active secretary on that court.
  - Diary events: the owning lawyer, plus every active secretary on that
    court (events aren't tied to a case, so there's no per-secretary
    assignment concept for them).

Requires two things to actually be configured:
  1. GMAIL_USER / GMAIL_APP_PASSWORD env vars, for email
  2. Web Push set up on the frontend (VAPID key + service worker), for push
     tokens to exist in Firestore at all
"""

import os
import smtplib
import logging
from datetime import date, timedelta
from email.mime.text import MIMEText

from firebase_admin import messaging
from firebase_admin_setup import get_admin_db

logger = logging.getLogger("advomind.notifications")

GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")


# ============================================================
# EMAIL
# ============================================================

def send_email(to_email, subject, body):
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logger.warning("Email not configured (GMAIL_USER/GMAIL_APP_PASSWORD missing) - skipping email to %s", to_email)
        return False

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = GMAIL_USER
    msg["To"] = to_email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


# ============================================================
# PUSH
# ============================================================

def send_push(tokens, title, body):
    """tokens: list of FCM registration tokens for one or more devices."""
    if not tokens:
        return

    messages = [
        messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=t,
        )
        for t in tokens
    ]

    try:
        response = messaging.send_each(messages)
        if response.failure_count:
            logger.warning("%d/%d push notifications failed", response.failure_count, len(messages))
    except Exception as e:
        logger.error("Failed to send push notifications: %s", e)


def _notify_all(db, recipients, subject, body, push_title, push_body):
    for recipient in recipients:
        email = recipient.get("email")
        if email:
            send_email(email, subject, body)

        tokens = recipient.get("fcmTokens") or []
        if tokens:
            send_push(tokens, push_title, push_body)


# ============================================================
# RECIPIENT RESOLUTION
# ============================================================

def get_recipients_for_owner_and_court(db, owner_id, court):
    """Everyone active on a given court under this lawyer: the lawyer
    themselves, plus every non-disabled secretary assigned to that court."""
    recipients = []

    lawyer_snap = db.collection("users").document(owner_id).get()
    if lawyer_snap.exists:
        recipients.append(lawyer_snap.to_dict())

    secs = db.collection("users").where("lawyerId", "==", owner_id).stream()
    for s in secs:
        data = s.to_dict()
        if not data.get("disabled") and court in (data.get("assignedCourts") or []):
            recipients.append(data)

    return recipients


def get_recipients_for_hearing(db, hearing):
    owner_id = hearing.get("userId")
    if not owner_id:
        return []

    assigned_to = hearing.get("assignedTo")

    if assigned_to:
        recipients = []
        lawyer_snap = db.collection("users").document(owner_id).get()
        if lawyer_snap.exists:
            recipients.append(lawyer_snap.to_dict())

        sec_snap = db.collection("users").document(assigned_to).get()
        if sec_snap.exists and not sec_snap.to_dict().get("disabled"):
            recipients.append(sec_snap.to_dict())

        return recipients

    return get_recipients_for_owner_and_court(db, owner_id, hearing.get("court_type"))


# ============================================================
# NOTIFY: HEARINGS
# ============================================================

def notify_hearing_recipients(db, hearing, when_label):
    case_title = "a case"
    case_id = hearing.get("case_id")
    if case_id:
        case_snap = db.collection("cases").document(case_id).get()
        if case_snap.exists:
            case_title = case_snap.to_dict().get("title", case_title)

    event = hearing.get("event", "Hearing")
    hearing_date = hearing.get("date", "")

    subject = f"Reminder: {event} - {when_label}"
    body = (
        f"You have a hearing coming up.\n\n"
        f"Case: {case_title}\n"
        f"Event: {event}\n"
        f"Date: {hearing_date}\n"
        f"When: {when_label}\n"
    )
    if hearing.get("notes"):
        body += f"Notes: {hearing['notes']}\n"

    push_title = event
    push_body = f"{when_label} - {case_title} ({hearing_date})"

    recipients = get_recipients_for_hearing(db, hearing)
    _notify_all(db, recipients, subject, body, push_title, push_body)


# ============================================================
# NOTIFY: CALENDAR EVENTS
# ============================================================

def notify_event_recipients(db, event, when_label):
    owner_id = event.get("userId")
    if not owner_id:
        return

    title = event.get("title", "Event")
    event_date = event.get("date", "")

    subject = f"Reminder: {title} - {when_label}"
    body = (
        f"You have an upcoming calendar event.\n\n"
        f"Event: {title}\n"
        f"Date: {event_date}\n"
        f"When: {when_label}\n"
    )
    if event.get("notes"):
        body += f"Notes: {event['notes']}\n"

    push_title = title
    push_body = f"{when_label} - {event_date}"

    recipients = get_recipients_for_owner_and_court(db, owner_id, event.get("court_type"))
    _notify_all(db, recipients, subject, body, push_title, push_body)


# ============================================================
# THE SCHEDULED CHECK
# ============================================================

def _send_for_date(db, collection_name, notify_fn, target_date_str, flag_field, when_label):
    docs = db.collection(collection_name).where("date", "==", target_date_str).stream()

    count = 0
    for snap in docs:
        data = snap.to_dict()
        if data.get(flag_field):
            continue  # already sent

        notify_fn(db, data, when_label)
        snap.reference.update({flag_field: True})
        count += 1

    if count:
        logger.info("Sent %d '%s' reminder(s) in %s for %s", count, when_label, collection_name, target_date_str)


def check_and_send_reminders():
    db = get_admin_db()

    today = date.today()
    tomorrow = today + timedelta(days=1)

    _send_for_date(db, "hearings", notify_hearing_recipients, tomorrow.isoformat(), "dayBeforeReminderSent", "Tomorrow")
    _send_for_date(db, "hearings", notify_hearing_recipients, today.isoformat(), "morningOfReminderSent", "Today")

    _send_for_date(db, "diaryEvents", notify_event_recipients, tomorrow.isoformat(), "dayBeforeReminderSent", "Tomorrow")
    _send_for_date(db, "diaryEvents", notify_event_recipients, today.isoformat(), "morningOfReminderSent", "Today")