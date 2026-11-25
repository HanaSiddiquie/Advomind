// frontend/src/services/chatApi.js
import { auth } from "../firebase";

const BASE_URL = process.env.REACT_APP_API_URL ?? "http://127.0.0.1:5000";

async function request(path, { method = "GET", body, timeoutMs = 30000 } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const idToken = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
        res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        Authorization: `Bearer ${idToken}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The server took too long to answer. Please try again.");
    throw new Error("Couldn't reach the server. Check that the backend is running.");
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

// Ask a question. threadId = continue that chat; omit it to start a new chat.
// caseId only matters for a new chat (an existing chat remembers its own case).
export function askAdvoChat({ message, threadId, caseId, model }) {
  return request("/chat/ask", {
    method: "POST",
    body: { message, threadId: threadId || null, caseId: caseId || null, model: model || null },
        timeoutMs: 150000,
  });
}

// Which models the server has set up (no login needed). Never throws.
export async function getChatStatus() {
  try {
    const res = await fetch(`${BASE_URL}/chat/status`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function listThreads(caseId) {
  const q = caseId ? `?caseId=${encodeURIComponent(caseId)}` : "";
  const data = await request(`/chat/threads${q}`);
  return data.threads || [];
}

export function getThread(threadId) {
  return request(`/chat/threads/${encodeURIComponent(threadId)}`);
}

export function renameThread(threadId, title) {
  return request(`/chat/threads/${encodeURIComponent(threadId)}`, { method: "PATCH", body: { title } });
}

export function deleteThread(threadId) {
  return request(`/chat/threads/${encodeURIComponent(threadId)}`, { method: "DELETE" });
}