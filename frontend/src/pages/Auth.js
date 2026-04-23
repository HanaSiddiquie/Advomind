import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "../firebase";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSignup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.password);
    } catch (err) {
      alert(err.message);
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

        <h2 style={title}>⚖️ ADVOMIND</h2>

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

        {/* EMAIL */}
        <input
          style={input}
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        {/* PASSWORD */}
        <div style={passwordWrapper}>
          <input
            style={input}
            name="password"
            type={showPass ? "text" : "password"}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
          />

          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            style={eyeBtn}
          >
            {showPass ? "Hide" : "Show"}
          </button>
        </div>

        {/* BUTTON */}
        <button
          style={btn}
          onClick={isLogin ? handleLogin : handleSignup}
        >
          {isLogin ? "Login" : "Create Account"}
        </button>

        {/* FORGOT PASSWORD */}
        {isLogin && (
          <p style={forgot} onClick={handleForgotPassword}>
            Forgot password?
          </p>
        )}

      </div>
    </div>
  );
}

/* ================= THEME ================= */

const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#e5e7eb"
};

const card = {
  width: "360px",
  padding: "28px",
  background: "#fff",
  borderRadius: "14px",
  textAlign: "center",
  border: "1px solid #e5e7eb",
  boxShadow: "0 10px 25px rgba(0,0,0,0.08)"
};

const title = {
  marginBottom: "15px",
  fontSize: "22px",
  fontWeight: "700",
  color: "#111827"
};

const tabRow = {
  display: "flex",
  marginBottom: "15px",
  background: "#f3f4f6",
  borderRadius: "8px",
  overflow: "hidden"
};

const tabBtn = {
  flex: 1,
  padding: "10px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#374151",
  fontWeight: "500"
};

const activeTab = {
  ...tabBtn,
  background: "#111827",
  color: "white"
};

const input = {
  width: "100%",
  padding: "11px",
  marginBottom: "10px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  outline: "none",
  background: "#f9fafb"
};

const btn = {
  width: "100%",
  padding: "11px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600"
};

/* password wrapper */
const passwordWrapper = {
  position: "relative",
  width: "100%"
};

/* clean show/hide button */
const eyeBtn = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  fontSize: "12px",
  fontWeight: "600",
  color: "#4f46e5",
  cursor: "pointer"
};

const forgot = {
  marginTop: "10px",
  fontSize: "13px",
  color: "#4f46e5",
  cursor: "pointer"
};

export default Auth;