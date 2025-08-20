import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { apiFetch, API_ENDPOINTS } from "../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    if (!email || !password) {
      setError("Please enter both email and password.");
      setIsLoading(false);
      return;
    }
    
    try {
      console.log('Attempting login with:', { email }); // Debug log
      const res = await apiFetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      console.log('Login response status:', res.status); // Debug log
      const data = await res.json().catch(() => ({}));
      console.log('Login response data:', data); // Debug log
      
      if (!res.ok) {
        setError(data.message || `Login failed (${res.status})`);
        setIsLoading(false);
        return;
      }
      
      if (data.message === "Login successful") {
        console.log('Login successful, navigating to dashboard'); // Debug log
        // Small delay to ensure cookie is set
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      } else {
        setError("Unexpected response from server");
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err); // Debug log
      setError("Network error - please check if the server is running");
      setIsLoading(false);
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
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              width: "100%", 
              padding: 12, 
              background: isLoading ? "#ccc" : "#007bff", 
              color: "#fff", 
              border: 0, 
              borderRadius: 8, 
              fontWeight: 600, 
              fontSize: 18, 
              boxShadow: '0 2px 8px rgba(0,123,255,0.08)',
              cursor: isLoading ? "not-allowed" : "pointer"
            }}
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>
          <button
            type="button"
            style={{ width: "100%", padding: 12, background: "#eee", color: "#007bff", border: 0, borderRadius: 8, fontWeight: 600, fontSize: 18, marginTop: 8 }}
            onClick={() => navigate("/signup")}
          >
            Signup
          </button>
          <button
            type="button"
            style={{ width: "100%", padding: 8, background: "#f8f9fa", color: "#6c757d", border: "1px solid #dee2e6", borderRadius: 6, fontWeight: 500, fontSize: 14, marginTop: 8 }}
            onClick={async () => {
              setEmail("test@example.com");
              setPassword("password123");
              setError("Demo credentials loaded. Click Login or create this user via Signup first.");
            }}
          >
            Load Demo Credentials
          </button>
          {error && <div style={{ color: "#d32f2f", marginTop: 12, textAlign: 'center' }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}