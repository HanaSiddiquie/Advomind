// frontend/src/services/aiApi.js
import { auth } from "../firebase";

const BASE_URL = "http://127.0.0.1:5000";

export async function summarizeCase(caseId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const idToken = await user.getIdToken();

  const res = await fetch(`${BASE_URL}/ai/summarize-case`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ caseId }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}