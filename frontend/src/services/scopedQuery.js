// frontend/src/services/scopedQuery.js
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Fetches docs from a top-level collection (cases, hearings, archive, files)
 * scoped to: the owning lawyer's workspace, the active court, and — for
 * secretaries — case-assignment visibility (unassigned docs + docs assigned
 * to them, but not docs assigned to someone else).
 *
 * This exists because Firestore requires any field a security rule checks
 * (like assignedTo) to also be filtered in the query itself, or the whole
 * read gets denied — and "unassigned OR assigned to me" can't be expressed
 * as a single equality filter, so secretaries need two queries merged.
 *
 * @param {string} collectionName - e.g. "cases", "hearings", "archive", "files"
 * @param {object} opts
 * @param {string} opts.ownerId - the lawyer's uid (from useAuthRole().ownerId)
 * @param {boolean} opts.isLawyer
 * @param {string} [opts.myUid] - required when isLawyer is false
 * @param {Array} [opts.extraWhere] - extra where() clauses to apply to every query
 * @param {boolean} [opts.skipAssignment] - true for collections with no assignedTo concept (e.g. clients)
 */
export async function fetchScoped(collectionName, opts) {
  const { ownerId, isLawyer, myUid, extraWhere = [], skipAssignment = false } = opts;

  if (!ownerId) return [];

  const base = [where("userId", "==", ownerId), ...extraWhere];

  if (isLawyer || skipAssignment) {
    const snap = await getDocs(query(collection(db, collectionName), ...base));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  const [unassignedSnap, mineSnap] = await Promise.all([
    getDocs(query(collection(db, collectionName), ...base, where("assignedTo", "==", null))),
    getDocs(query(collection(db, collectionName), ...base, where("assignedTo", "==", myUid))),
  ]);

  const map = new Map();
  unassignedSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  mineSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  return Array.from(map.values());
}