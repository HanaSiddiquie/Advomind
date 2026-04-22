import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD842yEAQgwtTZZhaXCGFILNP-XxGBrNCo",
  authDomain: "court-system-135a3.firebaseapp.com",
  projectId: "court-system-135a3",
  storageBucket: "court-system-135a3.firebasestorage.app",
  messagingSenderId: "145437274539",
  appId: "1:145437274539:web:d5284ceb4817f87464a2ee"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);