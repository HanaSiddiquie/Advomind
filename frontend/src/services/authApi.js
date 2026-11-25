// frontend/src/services/authApi.js
const BASE_URL = process.env.REACT_APP_API_URL ?? "http://127.0.0.1:5000";

// Asks the backend whether this email's domain is real. If the backend can't be reached,
// the address is let through - the verification link is still required afterwards.
export async function checkEmailDomain(email) {
  try {
    const res = await fetch(`${BASE_URL}/email/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.ok === false) return { ok: false, message: data.message || "That email address can't be used." };
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}