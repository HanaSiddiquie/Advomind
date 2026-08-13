/* eslint-disable no-undef */
// public/firebase-messaging-sw.js
// Must live at the site root (not in src/) so the browser can register it
// as a service worker with the right scope.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD842yEAQgwtTZZhaXCGFILNP-XxGBrNCo",
  authDomain: "court-system-135a3.firebaseapp.com",
  projectId: "court-system-135a3",
  storageBucket: "court-system-135a3.firebasestorage.app",
  messagingSenderId: "145437274539",
  appId: "1:145437274539:web:d5284ceb4817f87464a2ee"
});

const messaging = firebase.messaging();

// Fires when a push arrives while no tab has focus - shows the OS-level
// notification. (Foreground messages, while a tab IS focused, are handled
// separately in the app itself via onMessage.)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Advomind", {
    body: body || "",
    icon: "/logo192.png"
  });
});