// frontend/src/utils/caseClass.js
// Every case is either Civil or Criminal (independent of which court it is in).
export const CASE_CLASSES = [
  { key: "civil", label: "Civil" },
  { key: "criminal", label: "Criminal" },
];

export function classLabel(key) {
  if (key === "civil") return "Civil";
  if (key === "criminal") return "Criminal";
  return "Unclassified";
}

// Badge tone for a case class (see components/ui/Badge.js)
export function classTone(key) {
  if (key === "civil") return "civil";
  if (key === "criminal") return "criminal";
  return "warn";
}

// Used by the "Civil / Criminal / Unclassified" filters
export function matchesClass(caseItem, filter) {
  if (!filter || filter === "All") return true;
  if (filter === "unclassified") return !caseItem.case_class;
  return caseItem.case_class === filter;
}