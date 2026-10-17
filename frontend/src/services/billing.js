// frontend/src/services/billing.js
export function computeItemAmount(item) {
  if (item.type === "time") {
    return (Number(item.hours) || 0) * (Number(item.rate) || 0);
  }
  return Number(item.amount) || 0;
}

export function computeTotals(items, payments) {
  const billed = items.reduce((sum, item) => sum + computeItemAmount(item), 0);
  const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return { billed, paid, balance: billed - paid };
}

export function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return `Rs ${n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}