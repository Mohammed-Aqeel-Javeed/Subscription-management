import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { apiFetch, API_ENDPOINTS } from "../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    try {
      const res = await apiFetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.message !== "Login successful") {
        setError(data.message || "Login failed");
        return;
      }
      // Success: cookie is set, dashboard will check it
  navigate("/dashboard");
    } catch (err) {
      setError("Network error");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "3rem auto" }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <LogIn size={48} color="#007bff" style={{ marginBottom: 8 }} />
          <h2 style={{ fontWeight: 700, fontSize: 28, color: '#222' }}>Welcome Back</h2>
          <p style={{ color: '#666', fontSize: 15, marginTop: 4 }}>Login to your subscription tracker</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 }}
            />
          </div>
          <div style={{ marginBottom: 16, textAlign: "right" }}>
            <a href="#" style={{ fontSize: 14, color: "#007bff", textDecoration: "underline" }}>Forgot Password?</a>
          </div>
          <button type="submit" style={{ width: "100%", padding: 12, background: "#007bff", color: "#fff", border: 0, borderRadius: 8, fontWeight: 600, fontSize: 18, boxShadow: '0 2px 8px rgba(0,123,255,0.08)' }}>Login</button>
          <button
            type="button"
            style={{ width: "100%", padding: 12, background: "#eee", color: "#007bff", border: 0, borderRadius: 8, fontWeight: 600, fontSize: 18, marginTop: 8 }}
            onClick={() => navigate("/signup")}
          >
            Signup
          </button>
          {error && <div style={{ color: "#d32f2f", marginTop: 12, textAlign: 'center' }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}