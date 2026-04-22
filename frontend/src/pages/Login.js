import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/clients"); // redirect after login
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={box}>
      <h2>Login</h2>

      <input style={input} placeholder="Email"
        onChange={(e) => setEmail(e.target.value)} />

      <input style={input} type="password" placeholder="Password"
        onChange={(e) => setPassword(e.target.value)} />

      <button style={btn} onClick={handleLogin}>
        Login
      </button>
    </div>
  );
}

const box = { padding: 20, maxWidth: 300, margin: "auto" };
const input = { width: "100%", padding: 10, marginBottom: 10 };
const btn = { width: "100%", padding: 10, background: "#4f46e5", color: "white" };

export default Login;