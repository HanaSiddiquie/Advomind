from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
import time
import uuid  # ✅ NEW

app = Flask(__name__)
CORS(app)

# =========================
# FILE STORAGE
# =========================
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# =========================
# IN-MEMORY DATABASE
# =========================
clients = []
cases = []
hearings = []

COURTS = ["civil", "session", "high"]

# =========================
# RESPONSE HELPER
# =========================
def response(message, data=None, status=200):
    return jsonify({
        "message": message,
        "data": data if data is not None else []
    }), status


# =========================
# HELPERS
# =========================
def get_case(case_id):
    return next((c for c in cases if c["id"] == case_id), None)

def filter_cases_by_court(court):
    if not court:
        return cases
    return [c for c in cases if c.get("court_type") == court]


# =========================
# HOME
# =========================
@app.route('/')
def home():
    return "Advomind Backend Running"


# =========================
# CLIENTS (AUTO ID)
# =========================
@app.route('/clients', methods=['GET', 'POST'])
def clients_route():

    if request.method == 'GET':
        court = request.args.get("court")

        if court:
            filtered = [c for c in clients if c.get("court_type") == court]
            return response("Clients fetched", filtered)

        return response("Clients fetched", clients)

    data = request.get_json(silent=True)

    if not data:
        return response("No data received", None, 400)

    # ❌ removed id from required
    required = ["name", "cnic", "address", "email", "phone", "court_type"]

    missing = [f for f in required if not data.get(f)]
    if missing:
        return response(f"Missing: {missing}", None, 400)

    if data["court_type"] not in COURTS:
        return response("Invalid court type", None, 400)

    # ✅ AUTO ID
    new_id = str(uuid.uuid4())

    client = {
        "id": new_id,
        "name": data["name"],
        "cnic": data["cnic"],
        "address": data["address"],
        "email": data["email"],
        "phone": data["phone"],
        "court_type": data["court_type"]
    }

    clients.append(client)

    return response("Client created", client, 201)


@app.route('/clients/<client_id>', methods=['PUT', 'DELETE'])
def client_detail(client_id):
    global clients, cases, hearings

    if request.method == "PUT":
        client = next((c for c in clients if c["id"] == client_id), None)

        if not client:
            return response("Client not found", None, 404)

        data = request.get_json(silent=True) or {}

        client.update({
            "name": data.get("name", client["name"]),
            "cnic": data.get("cnic", client["cnic"]),
            "address": data.get("address", client["address"]),
            "email": data.get("email", client["email"]),
            "phone": data.get("phone", client["phone"]),
        })

        return response("Client updated", client)

    if request.method == "DELETE":
        client_cases = [c["id"] for c in cases if c["client_id"] == client_id]

        clients[:] = [c for c in clients if c["id"] != client_id]
        cases[:] = [c for c in cases if c["client_id"] != client_id]
        hearings[:] = [h for h in hearings if h["case_id"] not in client_cases]

        return response("Client deleted")


# =========================
# CASES (AUTO ID)
# =========================
@app.route('/cases', methods=['GET', 'POST'])
def cases_route():

    if request.method == 'GET':
        court = request.args.get("court")
        return response("Cases fetched", filter_cases_by_court(court))

    data = request.get_json(silent=True)

    if not data:
        return response("No data received", None, 400)

    # ❌ removed id
    required = ["client_id", "title", "description", "court_type"]

    missing = [f for f in required if not data.get(f)]
    if missing:
        return response(f"Missing fields: {missing}", None, 400)

    if data["court_type"] not in COURTS:
        return response("Invalid court type", None, 400)

    # ✅ AUTO ID
    new_id = str(uuid.uuid4())

    case = {
        "id": new_id,
        "client_id": str(data["client_id"]),
        "title": data["title"],
        "description": data["description"],
        "court_type": data["court_type"],
        "status": data.get("status", "Open"),
        "details": "",
        "diary": "",
        "files": []
    }

    cases.append(case)

    return response("Case created", case, 201)


@app.route('/cases/<case_id>', methods=['PUT', 'DELETE'])
def case_detail(case_id):
    global cases, hearings

    case = get_case(case_id)

    if request.method == "PUT":
        if not case:
            return response("Case not found", None, 404)

        data = request.get_json(silent=True) or {}

        case.update({
            "title": data.get("title", case["title"]),
            "description": data.get("description", case["description"]),
            "status": data.get("status", case["status"]),
            "details": data.get("details", case["details"]),
            "diary": data.get("diary", case["diary"]),
        })

        return response("Case updated", case)

    if request.method == "DELETE":
        cases[:] = [c for c in cases if c["id"] != case_id]
        hearings[:] = [h for h in hearings if h["case_id"] != case_id]

        return response("Case deleted")


# =========================
# HEARINGS (AUTO ID + FIXED)
# =========================
@app.route('/hearings', methods=['GET', 'POST'])
def hearings_route():

    if request.method == 'GET':
        court = request.args.get("court")

        if not court:
            return response("All hearings fetched", hearings)

        filtered = [
            h for h in hearings
            if get_case(h["case_id"]) and get_case(h["case_id"]).get("court_type") == court
        ]

        return response("Filtered hearings", filtered)

    data = request.get_json(silent=True)

    if not data:
        return response("No data received", None, 400)

    # ❌ removed id
    required = ["case_id", "date", "event"]

    missing = [f for f in required if not data.get(f)]
    if missing:
        return response(f"Missing: {missing}", None, 400)

    case = get_case(data["case_id"])
    if not case:
        return response("Case not found", None, 404)

    # ✅ AUTO ID
    new_id = str(uuid.uuid4())

    hearing = {
        "id": new_id,
        "case_id": str(data["case_id"]),
        "court_type": case["court_type"],
        "date": data["date"],
        "event": data["event"],
        "notes": data.get("notes", ""),
        "reminder": data.get("reminder", "")
    }

    hearings.append(hearing)

    return response("Hearing created", hearing, 201)


# =========================
# FILES (UNCHANGED)
# =========================
@app.route('/files', methods=['POST'])
def upload_file():

    file = request.files.get("file")
    case_id = request.form.get("case_id")

    if not file or not case_id:
        return response("Missing file or case_id", None, 400)

    case = get_case(case_id)
    if not case:
        return response("Case not found", None, 404)

    original_name = secure_filename(file.filename)
    unique_name = f"{case_id}_{int(time.time()*1000)}_{original_name}"

    path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
    file.save(path)

    file_data = {
        "name": unique_name,
        "original_name": original_name,
        "path": path
    }

    case["files"].append(file_data)

    return response("File uploaded", file_data, 201)


@app.route('/files/<case_id>', methods=['GET'])
def get_files(case_id):
    case = get_case(case_id)

    if not case:
        return response("Case not found", None, 404)

    return response("Files fetched", case["files"])


@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


# =========================
# RUN
# =========================
if __name__ == '__main__':
    app.run(debug=True)