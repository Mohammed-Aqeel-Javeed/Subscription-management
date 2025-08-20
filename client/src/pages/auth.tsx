import React, { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
// Backend API base URL
const API_BASE_URL = "http://localhost:5000";

export default function AuthPage() {
  const [showSignup, setShowSignup] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");
  const navigate = useNavigate();

  // Slide animation styles
  const mainStyle = {
    width: 350,
    height: 500,
    margin: "4rem auto",
    background: "#fff",
    borderRadius: 10,
    boxShadow: "5px 20px 50px #0002",
    overflow: "hidden",
    position: "relative" as const,
    transition: "box-shadow 0.3s"
  };
  const slideStyle = {
    position: "absolute" as const,
    width: "100%",
    height: "100%",
    top: "0px",
    left: showSignup ? "0px" : "100%",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: showSignup ? "0 2px 16px #0001" : "none",
    transition: "left 0.6s cubic-bezier(.68,-0.55,.27,1.55)"
  };
  const loginStyle = {
    position: "absolute" as const,
    width: "100%",
    height: "100%",
    top: "0px",
    left: showSignup ? "-100%" : "0px",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: !showSignup ? "0 2px 16px #0001" : "none",
    transition: "left 0.6s cubic-bezier(.68,-0.55,.27,1.55)"
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter both email and password.");
      return;
    }
    // Only backend validation for login
    try {
  const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.message || "Login failed");
        return;
      }
      sessionStorage.setItem("isAuthenticated", "true");
  navigate("/dashboard");
    } catch (err) {
      setLoginError("Network error");
    }
  };

  // Signup handler
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccess("");
    if (!signupName || !signupEmail || !signupPassword || !signupConfirm) {
      setSignupError("Please fill in all fields.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords do not match.");
      return;
    }
    try {
      // Store signup in login collection
  const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: signupName, email: signupEmail, password: signupPassword })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSignupError(data.message || "Signup failed");
        return;
      }
      setSignupSuccess("Signup successful!");
      setTimeout(() => {
        setShowSignup(false);
        setSignupSuccess("");
      }, 1200);
    } catch {
      setSignupError("Network error");
    }
  };

  return (
    <div style={mainStyle}>
      {/* Signup Slide */}
      <div style={slideStyle}>
        <form onSubmit={handleSignup} style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
          <UserPlus size={40} color="#573b8a" style={{ marginBottom: 16 }} />
          <label style={{ color: '#573b8a', fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Sign up</label>
          <input type="text" placeholder="User name" value={signupName} onChange={e => setSignupName(e.target.value)} required style={{ width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' }} />
          <input type="email" placeholder="Email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required style={{ width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' }} />
          <input type="password" placeholder="Password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required style={{ width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' }} />
          <input type="password" placeholder="Confirm Password" value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} required style={{ width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' }} />
          <button type="submit" style={{ width: '80%', height: 40, background: '#573b8a', color: '#fff', fontWeight: 600, fontSize: 18, border: 0, borderRadius: 5, marginTop: 10, cursor: 'pointer' }}>Sign up</button>
          {signupError && <div style={{ color: '#d32f2f', marginTop: 12, textAlign: 'center' }}>{signupError}</div>}
          {signupSuccess && <div style={{ color: '#388e3c', marginTop: 12, textAlign: 'center' }}>{signupSuccess}</div>}
          <button type="button" style={{ background: 'none', border: 0, color: '#573b8a', marginTop: 18, fontWeight: 500, cursor: 'pointer' }} onClick={() => setShowSignup(false)}>Already have an account? Login</button>
        </form>
      </div>
      {/* Login Slide */}
      <div style={loginStyle}>
        <form onSubmit={handleLogin} style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
          <LogIn size={40} color="#573b8a" style={{ marginBottom: 16 }} />
          <label style={{ color: '#573b8a', fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Login</label>
          <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={{ width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' }} />
          <input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required style={{ width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' }} />
          <button type="submit" style={{ width: '80%', height: 40, background: '#573b8a', color: '#fff', fontWeight: 600, fontSize: 18, border: 0, borderRadius: 5, marginTop: 10, cursor: 'pointer' }}>Login</button>
          {loginError && <div style={{ color: '#d32f2f', marginTop: 12, textAlign: 'center' }}>{loginError}</div>}
          <button type="button" style={{ background: 'none', border: 0, color: '#573b8a', marginTop: 18, fontWeight: 500, cursor: 'pointer' }} onClick={() => setShowSignup(true)}>Don't have an account? Sign up</button>
        </form>
      </div>
    </div>
  );
}
