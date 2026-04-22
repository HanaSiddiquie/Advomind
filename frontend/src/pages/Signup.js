import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate("/clients");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={box}>
      <h2>Signup</h2>

      <input style={input} placeholder="Email"
        onChange={(e) => setEmail(e.target.value)} />

      <input style={input} type="password" placeholder="Password"
        onChange={(e) => setPassword(e.target.value)} />

      <button style={btn} onClick={handleSignup}>
        Create Account
      </button>
    </div>
  );
}

const box = { padding: 20, maxWidth: 300, margin: "auto" };
const input = { width: "100%", padding: 10, marginBottom: 10 };
const btn = { width: "100%", padding: 10, background: "#4f46e5", color: "white" };

export default Signup;