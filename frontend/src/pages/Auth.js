// frontend/src/pages/Auth.js
import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { needsVerification } from "../context/AuthRoleContext";
import { checkEmailDomain } from "../services/authApi";
import { colors, font, radius, shadow } from "../styles/theme";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

// Must look like name@domain.com (a dot in the domain) - rejects things like "name@mail"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Common typos of popular email providers
const TYPO_FIXES = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "hotmial.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "outlok.com": "outlook.com",
};

// Returns a message if the email looks wrong, or "" if it looks fine
function checkEmail(raw) {
  const email = String(raw || "").trim();
  if (!EMAIL_RE.test(email)) return "Please enter a valid email address, like name@gmail.com.";
  const [local, domain] = email.toLowerCase().split("@");
  if (TYPO_FIXES[domain]) return `Did you mean ${local}@${TYPO_FIXES[domain]}?`;
  return "";
}

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unverified, setUnverified] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const switchTab = (login) => {
    setIsLogin(login);
    setError("");
    setNotice("");
    setUnverified(false);
  };

  // Turn Firebase's technical messages into something a person can read
  const friendly = (err) => {
    const code = err?.code || "";
    if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "Incorrect email or password.";
    if (/invalid-email/.test(code)) return "Please enter a valid email address.";
    if (/email-already-in-use/.test(code)) return "An account with this email already exists. Try logging in.";
    if (/weak-password/.test(code)) return "Password is too weak — use at least 6 characters.";
    if (/too-many-requests/.test(code)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/network-request-failed/.test(code)) return "Network problem. Check your internet connection.";
    return err?.message || "Something went wrong. Please try again.";
  };

  const handleSubmit = (e) => {
    e.preventDefault(); // Enter key submits the form
    if (loading) return;
    isLogin ? handleLogin() : handleSignup();
  };

  const handleLogin = async () => {
    setError("");
    setNotice("");
    setUnverified(false);

    const problem = checkEmail(form.email);
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      if (needsVerification(cred.user)) {
        await signOut(auth);
        setUnverified(true);
        setError("Please verify your email first. We sent a link when you signed up — check your inbox and spam folder.");
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  };

  // Self-registration is always as a lawyer — secretary accounts can only
  // be created by a lawyer via the backend (see Manage Secretaries page).
  const handleSignup = async () => {
    setError("");
    setNotice("");
    if (!form.name.trim()) {
      setError("Please enter your name.");
      return;
    }

    const problem = checkEmail(form.email);
    if (problem) {
      setError(problem);
      return;
    }

    const email = form.email.trim();
    setLoading(true);
    try {
      // Reject made-up or throwaway email domains before any account is created
      const domainCheck = await checkEmailDomain(email);
      if (!domainCheck.ok) {
        setError(domainCheck.message);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, form.password);

      await setDoc(doc(db, "users", cred.user.uid), {
        role: "lawyer",
        name: form.name.trim(),
        email,
        createdAt: serverTimestamp()
      });

      // Don't let them straight into the app: send a verification link, then
      // sign out and take them to the Login tab.
      let sent = true;
      try {
        await sendEmailVerification(cred.user);
      } catch (e) {
        sent = false;
      }
      await signOut(auth);

      setIsLogin(true);
      setForm({ name: "", email, password: "" });
      setUnverified(!sent);
      setNotice(
        sent
          ? `Account created. We sent a verification link to ${email} — open it (check spam too), then log in.`
          : "Account created, but we couldn't send the verification email. Log in and tap “Resend verification email”."
      );
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  };

  // Signs in just long enough to send a fresh verification link, then signs out again.
  const resendVerification = async () => {
    setError("");
    setNotice("");
    if (loading) return;
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      if (needsVerification(cred.user)) {
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setUnverified(false);
        setNotice(`Verification email sent to ${form.email.trim()}. Open the link, then log in.`);
      }
      // otherwise the email was verified in the meantime and the app opens normally
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setNotice("");
    if (!form.email) {
      setError("Enter your email first, then tap “Forgot password?”.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, form.email.trim());
      setNotice("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(friendly(err));
    }
  };

  return (
    <div style={container}>
      <form style={card} onSubmit={handleSubmit} noValidate>
        <h2 style={title}>⚖ ADVOMIND</h2>
        <p style={tagline}>Legal Case Management</p>

        {/* TAB */}
        <div style={tabRow}>
          <button type="button" onClick={() => switchTab(true)} style={isLogin ? activeTab : tabBtn}>
            Login
          </button>

          <button type="button" onClick={() => switchTab(false)} style={!isLogin ? activeTab : tabBtn}>
            Signup
          </button>
        </div>

        {!isLogin && (
          <Input
            name="name"
            placeholder="Your full name"
            label="Name"
            value={form.name}
            onChange={handleChange}
          />
        )}

        <Input
          name="email"
          placeholder="you@lawfirm.com"
          label="Email"
          value={form.email}
          onChange={handleChange}
          style={{ paddingRight: 60 }}
        />

        <div style={fieldWrap}>
          <label htmlFor="auth-password" style={fieldLabel}>Password</label>
          <div style={inputBox}>
            <input
              id="auth-password"
              name="password"
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              className="am-input"
              style={passwordInput}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={eyeBtn}
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && <div role="alert" style={errorBox}>{error}</div>}
        {notice && <div role="status" style={noticeBox}>{notice}</div>}

        <Button full type="submit" disabled={loading} style={{ marginTop: "6px" }}>
          {loading ? "Please wait…" : isLogin ? "Login" : "Create Account"}
        </Button>

        {isLogin && unverified && (
          <p style={forgot} onClick={resendVerification}>
            Resend verification email
          </p>
        )}

        {isLogin && (
          <p style={forgot} onClick={handleForgotPassword}>
            Forgot password?
          </p>
        )}
      </form>
    </div>
  );
}

/* ================= STYLES ================= */

const container = {
  minHeight: "100vh",
  padding: "16px",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: colors.paper,
  fontFamily: font.body,
};

const card = {
  width: "100%",
  maxWidth: "380px",
  padding: "34px 32px",
  background: colors.surface,
  borderRadius: radius.lg,
  textAlign: "center",
  border: `1px solid ${colors.hairline}`,
  boxShadow: shadow.lg,
};

const title = {
  margin: 0,
  fontFamily: font.display,
  fontSize: "24px",
  fontWeight: 600,
  color: colors.ink,
};

const tagline = {
  margin: "4px 0 22px",
  fontSize: "12px",
  color: colors.slate,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const tabRow = {
  display: "flex",
  marginBottom: "20px",
  background: colors.paper,
  borderRadius: radius.sm,
  border: `1px solid ${colors.hairline}`,
  overflow: "hidden",
};

const tabBtn = {
  flex: 1,
  padding: "10px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: colors.slate,
  fontWeight: 600,
  fontFamily: font.body,
  fontSize: "13px",
};

const activeTab = {
  ...tabBtn,
  background: colors.ink,
  color: colors.white,
};

const fieldWrap = {
  display: "block",
  width: "100%",
  marginBottom: "14px",
  textAlign: "left",
};

const fieldLabel = {
  display: "block",
  fontFamily: font.body,
  fontSize: "12px",
  fontWeight: 600,
  color: colors.slate,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

// wraps ONLY the input, so "top: 50%" below is the middle of the box
const inputBox = {
  position: "relative",
  width: "100%",
};

const passwordInput = {
  boxSizing: "border-box",
  width: "100%",
  padding: "11px 64px 11px 13px",
  fontFamily: font.body,
  fontSize: "14px",
  color: colors.ink,
  background: colors.surface,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  outline: "none",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

const eyeBtn = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  padding: "6px 4px",
  lineHeight: 1,
  background: "none",
  border: "none",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: colors.accent,
  cursor: "pointer",
};

const errorBox = {
  textAlign: "left",
  fontSize: "13px",
  lineHeight: 1.45,
  color: colors.danger,
  background: colors.dangerSoft,
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.sm,
  padding: "10px 12px",
  marginBottom: "10px",
};

const noticeBox = {
  ...errorBox,
  color: colors.success,
  background: colors.successSoft,
  border: `1px solid ${colors.success}`,
};

const forgot = {
  marginTop: "14px",
  fontSize: "13px",
  color: colors.accent,
  cursor: "pointer",
  fontWeight: 500,
};

export default Auth;