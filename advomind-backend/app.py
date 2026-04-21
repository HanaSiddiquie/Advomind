from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

clients = []
cases = []
hearings = []

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
        return response("Invalid request", None, 400)

    required = ["id", "name", "cnic", "address", "email", "phone"]

    for f in required:
        if not data.get(f):
            return response(f"{f} required", None, 400)

    if any(c["id"] == data["id"] for c in clients):
        return response("Client exists", None, 400)

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
        cases = [c for c in cases if c["client_id"] != client_id]
        hearings = [h for h in hearings if h["case_id"] != client_id]

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
        return response("Invalid request", None, 400)

    required = ["id", "client_id", "title", "description"]

    for f in required:
        if not data.get(f):
            return response(f"{f} required", None, 400)

    if any(c["id"] == data["id"] for c in cases):
        return response("Case exists", None, 400)

    case = {
        "id": data["id"],
        "client_id": data["client_id"],
        "title": data["title"],
        "description": data["description"],
        "status": "Open",
        "details": "",
        "diary": "",
        "files": [],
        "hearings": []
    }

    cases.append(case)
    return response("Case created", case, 201)


@app.route('/cases/<case_id>', methods=['PUT', 'DELETE'])
def case_detail(case_id):
    global cases

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
        return response("Invalid request", None, 400)

    required = ["id", "case_id", "date", "event"]

    for f in required:
        if not data.get(f):
            return response(f"{f} required", None, 400)

    if any(h["id"] == data["id"] for h in hearings):
        return response("Hearing exists", None, 400)

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
    case["hearings"].append(hearing)

    return response("Hearing created", hearing, 201)


@app.route('/')
def home():
    return "Advomind Running"

if __name__ == '__main__':
    app.run(debug=True)