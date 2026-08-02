// frontend/src/context/AuthRoleContext.js
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthRoleContext = createContext(null);

/**
 * Wrap the app in this. After login, resolves:
 *  - user: the raw Firebase Auth user (or null)
 *  - role: "lawyer" | "secretary" | null
 *  - ownerId: the uid whose data we should read/write - the lawyer's own
 *             uid if they ARE the lawyer, or their lawyerId if they're a secretary.
 *             Every page should query/write using ownerId, not auth.currentUser.uid.
 *  - assignedCourts: for secretaries, the court(s) they're allowed to work in.
 *             null for lawyers (they can access all courts).
 *  - canDelete: true for lawyers always; for secretaries only if their lawyer
 *             has toggled delete/archive permission on for them.
 *  - profile: the raw users/{uid} Firestore doc
 *  - loading: true until both auth + profile have resolved
 */
export function AuthRoleProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setProfile(null);
        setProfileLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    setProfileLoading(true);

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setProfile(snap.exists() ? snap.data() : null);
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );

    return () => unsub();
  }, [user]);

  const role = profile?.role || null;
  const ownerId = role === "lawyer" ? user?.uid : role === "secretary" ? profile?.lawyerId : null;
  const assignedCourts = role === "secretary" ? (profile?.assignedCourts || []) : null;
  const isDisabled = role === "secretary" && profile?.disabled === true;

  // Lawyers can always delete/archive. Secretaries only if their lawyer
  // has explicitly toggled it on for them.
  const canDelete = role === "lawyer" ? true : role === "secretary" ? profile?.canDelete === true : false;

  const value = {
    user,
    profile,
    role,
    ownerId,
    assignedCourts,
    isLawyer: role === "lawyer",
    isSecretary: role === "secretary",
    isDisabled,
    canDelete,
    loading: authLoading || profileLoading,
  };

  return (
    <AuthRoleContext.Provider value={value}>
      {children}
    </AuthRoleContext.Provider>
  );
}

export function useAuthRole() {
  const ctx = useContext(AuthRoleContext);
  if (!ctx) throw new Error("useAuthRole must be used inside AuthRoleProvider");
  return ctx;
}

/** True if the given court key is one this user can access. Lawyers: always true. */
export function canAccessCourt(assignedCourts, isLawyer, court) {
  if (isLawyer) return true;
  if (!court) return false;
  return Array.isArray(assignedCourts) && assignedCourts.includes(court);
}