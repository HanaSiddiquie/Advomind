import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // =========================
  // LOGIN
  // =========================
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
    } catch (err) {
      alert(err.message);
    }
  };

  // =========================
  // SIGNUP
  // =========================
  const handleSignup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.password);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={container}>

      <div style={card}>

        <h2>⚖️ Legal Case System</h2>

        {/* TAB SWITCH */}
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

        {/* FORM */}
        <input
          style={input}
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        <input
          style={input}
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        {isLogin ? (
          <button style={btn} onClick={handleLogin}>
            Login
          </button>
        ) : (
          <button style={btn} onClick={handleSignup}>
            Create Account
          </button>
        )}

      </div>
    </div>
  );
}

/* STYLES */
const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#f5f6fa"
};

const card = {
  width: "350px",
  padding: "25px",
  background: "white",
  borderRadius: "12px",
  textAlign: "center",
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
};

const tabRow = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "15px"
};

const tabBtn = {
  flex: 1,
  padding: "10px",
  border: "none",
  background: "#eee",
  cursor: "pointer"
};

const activeTab = {
  ...tabBtn,
  background: "#4f46e5",
  color: "white"
};

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  border: "1px solid #ddd",
  borderRadius: "8px"
};

const btn = {
  width: "100%",
  padding: "10px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px"
};

export default Auth;