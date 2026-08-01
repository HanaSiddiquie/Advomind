// frontend/src/services/adminApi.js
import { auth } from "../firebase";

const BASE_URL = "http://127.0.0.1:5000";

async function authedFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const idToken = await user.getIdToken(true);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export function createSecretary({ email, name, assignedCourts }) {
  return authedFetch("/admin/create-secretary", {
    method: "POST",
    body: JSON.stringify({ email, name, assignedCourts }),
  });
}

export function setSecretaryStatus(uid, disabled) {
  return authedFetch(`/admin/secretaries/${uid}/status`, {
    method: "PATCH",
    body: JSON.stringify({ disabled }),
  });
}

export function deleteSecretary(uid) {
  return authedFetch(`/admin/secretaries/${uid}`, {
    method: "DELETE",
  });
}