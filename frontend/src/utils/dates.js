// frontend/src/utils/dates.js
const pad = (n) => String(n).padStart(2, "0");

export const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => toKey(new Date());

export const tomorrowKey = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toKey(d);
};

// "2026-11-21" -> "21 Nov 2026"
export function formatDate(key) {
  if (!key) return "";
  const [y, m, d] = String(key).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(key);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}