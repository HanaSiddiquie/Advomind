// frontend/src/components/NotificationSetup.js
import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { messagingPromise, db } from "../firebase";
import { useAuthRole } from "../context/AuthRoleContext";
import { colors, font, shadow } from "../styles/theme";
import Button from "./ui/Button";

const VAPID_KEY = "BBx_laRb7KVBthXs6Hnmow0vq4ELg30wJCBkiDPHvrcjwt5m2sSfNXEaYXDIMjUix_Suehx0onfMfluHerC_zJs";

async function registerTokenForCurrentUser(userId) {
  const messaging = await messagingPromise;
  if (!messaging || !userId) return;

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });

  if (token) {
    await updateDoc(doc(db, "users", userId), {
      fcmTokens: arrayUnion(token)
    });
  }
}

function NotificationSetup() {
  const { user } = useAuthRole();
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (permission === "granted" && user) {
      registerTokenForCurrentUser(user.uid).catch((err) =>
        console.error("Silent notification token registration failed:", err)
      );
    }
  }, [permission, user]);

  useEffect(() => {
    let unsubscribe;

    messagingPromise.then((messaging) => {
      if (!messaging) return;
      unsubscribe = onMessage(messaging, (payload) => {
        const notif = payload.notification || {};
        if (notif.title && Notification.permission === "granted") {
          new Notification(notif.title, { body: notif.body, icon: "/logo192.png" });
        }
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const enableNotifications = async () => {
    setBusy(true);
    try {
      const messaging = await messagingPromise;
      if (!messaging) {
        alert("Push notifications aren't supported in this browser.");
        return;
      }

      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") return;

      if (user) await registerTokenForCurrentUser(user.uid);
    } catch (err) {
      console.error("Notification setup failed:", err);
    } finally {
      setBusy(false);
    }
  };

  if (permission === "granted" || permission === "denied" || permission === "unsupported") {
    return null;
  }

  return (
    <div style={banner}>
      <span style={text}>Get reminders for upcoming hearings on this device.</span>
      <Button onClick={enableNotifications} disabled={busy} variant="dark">
        {busy ? "Enabling..." : "Enable Notifications"}
      </Button>
    </div>
  );
}

const banner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 20px",
  background: colors.paper,
  borderBottom: `1px solid ${colors.hairline}`,
  boxShadow: shadow.sm,
  flexWrap: "wrap",
};

const text = {
  fontFamily: font.body,
  fontSize: "13px",
  color: colors.charcoal,
};

export default NotificationSetup;