// frontend/src/pages/Auth.js
import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { colors, font, radius, shadow } from "../styles/theme";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Self-registration is always as a lawyer — secretary accounts can only
  // be created by a lawyer via the backend (see Manage Secretaries page).
  const handleSignup = async () => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);

      await setDoc(doc(db, "users", cred.user.uid), {
        role: "lawyer",
        email: form.email,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email) {
      alert("Enter email first");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, form.email);
      alert("Password reset email sent!");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={container}>
      <div style={card}>
        <h2 style={title}>⚖ ADVOMIND</h2>
        <p style={tagline}>Legal Case Management</p>

        {/* TAB */}
        <div style={tabRow}>
          <button
            onClick={() => setIsLogin(true)}
            style={isLogin ? activeTab : tabBtn}
          >
            Login
          </button>

          <button
            onClick={() => setIsLogin(false)}
            style={!isLogin ? activeTab : tabBtn}
          >
            Signup
          </button>
        </div>

        <Input
          name="email"
          placeholder="you@lawfirm.com"
          label="Email"
          value={form.email}
          onChange={handleChange}
        />

        <div style={passwordWrapper}>
          <Input
            name="password"
            type={showPass ? "text" : "password"}
            placeholder="••••••••"
            label="Password"
            value={form.password}
            onChange={handleChange}
          />

          <button type="button" onClick={() => setShowPass(!showPass)} style={eyeBtn}>
            {showPass ? "Hide" : "Show"}
          </button>
        </div>

        <Button full onClick={isLogin ? handleLogin : handleSignup} disabled={loading} style={{ marginTop: "6px" }}>
          {loading ? "Please wait…" : isLogin ? "Login" : "Create Account"}
        </Button>

        {isLogin && (
          <p style={forgot} onClick={handleForgotPassword}>
            Forgot password?
          </p>
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: colors.paper,
  fontFamily: font.body,
};

const card = {
  width: "380px",
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

const passwordWrapper = {
  position: "relative",
  width: "100%",
};

const eyeBtn = {
  position: "absolute",
  right: "10px",
  top: "34px",
  background: "none",
  border: "none",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: colors.accent,
  cursor: "pointer",
};

const forgot = {
  marginTop: "14px",
  fontSize: "13px",
  color: colors.accent,
  cursor: "pointer",
  fontWeight: 500,
};

export default Auth;