from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# =========================
# In-memory DB
# =========================
clients = []
cases = []
hearings = []

# =========================
# HELPER
# =========================
def response(message, data=None, status=200):
    return jsonify({
        "message": message,
        "data": data if data is not None else []
    }), status


# =========================
# CLIENTS
# =========================
@app.route('/clients', methods=['GET', 'POST'])
def clients_route():
    if request.method == 'GET':
        return response("All clients", clients)

    data = request.get_json()
    if not data:
        return response("Invalid request body", None, 400)

    required = ["id", "name", "cnic", "address", "email", "phone"]

    for f in required:
        if not data.get(f):
            return response(f"{f} is required", None, 400)

    if any(c["id"] == data["id"] for c in clients):
        return response("Client already exists", None, 400)

    client = {
        "id": data["id"],
        "name": data["name"],
        "cnic": data["cnic"],
        "address": data["address"],
        "email": data["email"],
        "phone": data["phone"],
        "cases": []
    }

    clients.append(client)
    return response("Client created", client, 201)


@app.route('/clients/<client_id>', methods=['PUT', 'DELETE'])
def client_detail(client_id):
    global clients, cases, hearings

    client = next((c for c in clients if c["id"] == client_id), None)

    if request.method == "PUT":
        if not client:
            return response("Client not found", None, 404)

        data = request.get_json() or {}

        client.update({
            "name": data.get("name", client["name"]),
            "cnic": data.get("cnic", client["cnic"]),
            "address": data.get("address", client["address"]),
            "email": data.get("email", client["email"]),
            "phone": data.get("phone", client["phone"]),
        })

        return response("Client updated", client)

    if request.method == "DELETE":
        clients = [c for c in clients if c["id"] != client_id]

        case_ids = [c["id"] for c in cases if c["client_id"] == client_id]
        cases = [c for c in cases if c["client_id"] != client_id]
        hearings = [h for h in hearings if h["case_id"] not in case_ids]

        return response("Client deleted")


# =========================
# CASES
# =========================
@app.route('/cases', methods=['GET', 'POST'])
def cases_route():
    if request.method == 'GET':
        return response("All cases", cases)

    data = request.get_json()
    if not data:
        return response("Invalid request body", None, 400)

    required = ["id", "client_id", "title", "description"]

    for f in required:
        if not data.get(f):
            return response(f"{f} is required", None, 400)

    if any(c["id"] == data["id"] for c in cases):
        return response("Case already exists", None, 400)

    client = next((c for c in clients if c["id"] == data["client_id"]), None)
    if not client:
        return response("Client not found", None, 404)

    case = {
    "id": data["id"],
    "client_id": data["client_id"],
    "title": data["title"],
    "description": data["description"],
    "status": "Open",

    # new modules
    "details": data.get("details", ""),
    "diary": data.get("diary", ""),
    "files": [],

    # OLD (IDs only)
    "hearings": [],

    # NEW (FULL TIMELINE OBJECTS)
    "hearing_objects": []
    }

    cases.append(case)
    client["cases"].append(case["id"])

    return response("Case created", case, 201)


@app.route('/cases/<case_id>', methods=['PUT', 'DELETE'])
def case_detail(case_id):
    global cases, hearings

    case = next((c for c in cases if c["id"] == case_id), None)

    if request.method == "PUT":
        if not case:
            return response("Case not found", None, 404)

        data = request.get_json() or {}

        case.update({
            "title": data.get("title", case["title"]),
            "description": data.get("description", case["description"]),
            "status": data.get("status", case["status"]),
            "details": data.get("details", case["details"]),
            "diary": data.get("diary", case["diary"]),
        })

        return response("Case updated", case)

    if request.method == "DELETE":
        cases = [c for c in cases if c["id"] != case_id]
        hearings = [h for h in hearings if h["case_id"] != case_id]

        for client in clients:
            client["cases"] = [c for c in client["cases"] if c != case_id]

        return response("Case deleted")


# =========================
# HEARINGS
# =========================
@app.route('/hearings', methods=['GET', 'POST'])
def hearings_route():
    if request.method == 'GET':
        return response("All hearings", hearings)

    data = request.get_json()
    if not data:
        return response("Invalid request body", None, 400)

    required = ["id", "case_id", "date", "event"]

    for f in required:
        if not data.get(f):
            return response(f"{f} is required", None, 400)

    if any(h["id"] == data["id"] for h in hearings):
        return response("Hearing already exists", None, 400)

    case = next((c for c in cases if c["id"] == data["case_id"]), None)
    if not case:
        return response("Case not found", None, 404)

    hearing = {
        "id": data["id"],
        "case_id": data["case_id"],
        "date": data["date"],
        "event": data["event"],
        "notes": data.get("notes", ""),
        "reminder": data.get("reminder", "")
    }

    hearings.append(hearing)
    case["hearing_objects"].append(hearing)

    return response("Hearing created", hearing, 201)


@app.route('/hearings/<hearing_id>', methods=['PUT', 'DELETE'])
def hearing_detail(hearing_id):
    global hearings

    hearing = next((h for h in hearings if h["id"] == hearing_id), None)

    if request.method == "PUT":
        if not hearing:
            return response("Hearing not found", None, 404)

        data = request.get_json() or {}

        hearing.update({
            "date": data.get("date", hearing["date"]),
            "event": data.get("event", hearing["event"]),
            "notes": data.get("notes", hearing["notes"]),
            "reminder": data.get("reminder", hearing["reminder"]),
        })

        return response("Hearing updated", hearing)

    if request.method == "DELETE":
        hearings = [h for h in hearings if h["id"] != hearing_id]

        for case in cases:
            case["hearings"] = [h for h in case["hearings"] if h != hearing_id]

        return response("Hearing deleted")


# =========================
# HOME
# =========================
@app.route('/')
def home():
    return "Advomind Backend Running"


if __name__ == '__main__':
    app.run(debug=True)