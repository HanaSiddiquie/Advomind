// frontend/src/services/cascadeDelete.js
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";

async function getDocsFor(collectionName, ownerId, extraWhere) {
  const q = query(
    collection(db, collectionName),
    where("userId", "==", ownerId),
    ...extraWhere
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function deleteCaseAndChildren(caseId, ownerId) {
  // Hearings, diary notes, details notes, files all reference case_id.
  const [hearings, diaryNotes, detailsNotes, files] = await Promise.all([
    getDocsFor("hearings", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("diaryNotes", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("detailsNotes", ownerId, [where("case_id", "==", caseId)]),
    getDocsFor("files", ownerId, [where("case_id", "==", caseId)]),
  ]);

  await Promise.all([
    ...hearings.map(h => deleteDoc(doc(db, "hearings", h.id))),
    ...diaryNotes.map(n => deleteDoc(doc(db, "diaryNotes", n.id))),
    ...detailsNotes.map(n => deleteDoc(doc(db, "detailsNotes", n.id))),
    ...files.map(async f => {
      if (f.storagePath) {
        try {
          await deleteObject(ref(storage, f.storagePath));
        } catch (err) {
          // File may already be gone from Storage — don't block the rest of the cascade.
          console.warn("Could not delete storage object for file", f.id, err);
        }
      }
      await deleteDoc(doc(db, "files", f.id));
    }),
  ]);
}

/**
 * Deletes a single case and everything tied to it: hearings, diary notes,
 * detail notes, and file attachments (Storage objects included). Does NOT
 * delete the client — only this one case.
 */
export async function cascadeDeleteCase({ caseId, ownerId }) {
  await deleteCaseAndChildren(caseId, ownerId);
  await deleteDoc(doc(db, "cases", caseId));
}

/**
 * Same idea, for a document sitting in the archive collection (id there is
 * the archive doc's own id, not the original case id — but the hearings/
 * notes/files still reference the ORIGINAL case id via originalCaseId).
 */
export async function cascadeDeleteArchivedCase({ archiveDocId, originalCaseId, ownerId }) {
  if (originalCaseId) {
    await deleteCaseAndChildren(originalCaseId, ownerId);
  }
  await deleteDoc(doc(db, "archive", archiveDocId));
}

/**
 * Deletes a client and everything tied to them: every case (active AND
 * archived) that references this client_id, plus each of those cases'
 * hearings, diary notes, detail notes, and file attachments (Storage
 * objects included). Does NOT touch standalone diaryEvents — those aren't
 * tied to any client or case.
 *
 * Caller is responsible for the confirm() dialog and for gating this
 * behind canDelete — Firestore rules enforce the same permission on every
 * delete call this makes, so an unauthorized call will just fail partway
 * with a permission error rather than silently succeeding.
 */
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

  return {
    deletedCases: activeCases.length,
    deletedArchivedCases: archivedCases.length,
  };
}