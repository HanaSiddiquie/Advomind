// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD842yEAQgwtTZZhaXCGFILNP-XxGBrNCo",
  authDomain: "court-system-135a3.firebaseapp.com",
  projectId: "court-system-135a3",

  // 🔥 IMPORTANT FIX (THIS IS YOUR REAL BUCKET)
  storageBucket: "court-system-135a3.firebasestorage.app",

  messagingSenderId: "145437274539",
  appId: "1:145437274539:web:d5284ceb4817f87464a2ee"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Messaging isn't supported in every browser/context (e.g. Safari's older
// push support, or non-HTTPS in dev) - isSupported() checks before we try.
export const messagingPromise = isSupported().then((supported) =>
  supported ? getMessaging(app) : null
);