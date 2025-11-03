import React, { useState } from "react";
import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../lib/config";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  // Autogenerate tenantId in frontend

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      // Generate a random tenantId (UUID v4 style)
      const tenantId = 'tenant-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
      console.log('Attempting signup with:', { fullName, email, tenantId }); // Debug log
      
      const res = await fetch(`${API_BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName, email, password, tenantId })
      });
      
  // ...existing code...
      const data = await res.json().catch(() => ({}));
      console.log('Signup response data:', data); // Debug log
      
      if (!res.ok) {
        setError(data.message || `Signup failed (${res.status})`);
        return;
      }
      setSuccess("Signup successful! You can now login with your credentials.");
      
      // Clear form
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error('Signup error:', err); // Debug log
      setError("Network error - please check if the server is running");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "3rem auto" }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <UserPlus size={48} color="#007bff" style={{ marginBottom: 8 }} />
          <h2 style={{ fontWeight: 700, fontSize: 28, color: '#222' }}>Create Account</h2>
        </div>
  <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 }}
            />
          </div>
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
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 500 }}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 }}
            />
          </div>
          <button type="submit" style={{ width: "100%", padding: 12, background: "#007bff", color: "#fff", border: 0, borderRadius: 8, fontWeight: 600, fontSize: 18, boxShadow: '0 2px 8px rgba(0,123,255,0.08)' }}>Sign Up</button>
          {error && <div style={{ color: "#d32f2f", marginTop: 12, textAlign: 'center' }}>{error}</div>}
          {success && <div style={{ color: "#388e3c", marginTop: 12, textAlign: 'center' }}>{success}</div>}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ color: '#666', fontSize: 14 }}>Already have an account? </span>
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{ 
                background: 'none', 
                border: 0, 
                color: '#007bff', 
                fontWeight: 500, 
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: 14
              }}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
