// frontend/src/services/cascadeDelete.js
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";

async function getDocsFor(collectionName, ownerId, extraWhere) {
  const q = query(collection(db, collectionName), where("userId", "==", ownerId), ...extraWhere);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function deleteCaseAndChildren(caseId, ownerId) {
  const [hearings, diaryNotes, detailsNotes, files, billingItems, payments] = await Promise.all([
    getDocsFor("hearings", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("diaryNotes", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("detailsNotes", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("files", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("billingItems", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("payments", ownerId, [where("case_id", "==", caseId)]),
  ]);

  await Promise.all([
    ...hearings.map(h => deleteDoc(doc(db, "hearings", h.id))),
    ...diaryNotes.map(n => deleteDoc(doc(db, "diaryNotes", n.id))),
    ...detailsNotes.map(n => deleteDoc(doc(db, "detailsNotes", n.id))),
    ...billingItems.map(b => deleteDoc(doc(db, "billingItems", b.id))),
    ...payments.map(p => deleteDoc(doc(db, "payments", p.id))),
    ...files.map(async f => {
      if (f.storagePath) {
        try { await deleteObject(ref(storage, f.storagePath)); } catch (err) { console.warn(err); }
      }
      await deleteDoc(doc(db, "files", f.id));
    }),
  ]);
}

export async function cascadeDeleteCase({ caseId, ownerId }) {
  await deleteCaseAndChildren(caseId, ownerId);
  await deleteDoc(doc(db, "cases", caseId));
}

export async function cascadeDeleteArchivedCase({ archiveDocId, originalCaseId, ownerId }) {
  if (originalCaseId) await deleteCaseAndChildren(originalCaseId, ownerId);
  await deleteDoc(doc(db, "archive", archiveDocId));
}

export async function cascadeDeleteClient({ clientId, ownerId, court }) {
  const [activeCases, archivedCases] = await Promise.all([
    getDocsFor("cases", ownerId, [where("client_id", "==", clientId), where("court_type", "==", court)]),
    getDocsFor("archive", ownerId, [where("client_id", "==", clientId), where("court_type", "==", court)]),
  ]);

  await Promise.all(activeCases.map(c => deleteCaseAndChildren(c.id, ownerId)));
  await Promise.all([
    ...activeCases.map(c => deleteDoc(doc(db, "cases", c.id))),
    ...archivedCases.map(c => deleteDoc(doc(db, "archive", c.id))),
  ]);
  await deleteDoc(doc(db, "users", ownerId, "clients", clientId));

  return { deletedCases: activeCases.length, deletedArchivedCases: archivedCases.length };
}