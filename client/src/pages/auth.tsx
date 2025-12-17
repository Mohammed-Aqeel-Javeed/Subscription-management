import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../lib/config";

export default function AuthPage() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter both email and password.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.message || "Login failed");
        return;
      }
      sessionStorage.setItem("isAuthenticated", "true");
      // Use replace to prevent going back to login page
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setLoginError("Network error");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        padding: "0.75rem",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 880,
          borderRadius: 16,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.45)",
        }}
      >
        {/* Left marketing / hero panel */}
        <div
          style={{
            padding: "2rem 2.25rem",
            color: "#f9fafb",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <img
              src="/assets/logo.png"
              alt="SubsTracker Logo"
              style={{
                width: 52,
                height: 52,
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35)) brightness(1.05)",
              }}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: "0.03em",
                color: "#f9fafb",
              }}
            >
              SubsTracker
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#ffffff",
                marginBottom: 16,
                lineHeight: 1.2,
              }}
            >
              Welcome Back
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "#e0e7ff",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              Login in to access your subscription dashboard and manage all your services in one place.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>📊</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#ffffff", marginBottom: 2 }}>
                  Real-time Analytics
                </div>
                <div style={{ fontSize: 14, color: "#c7d2fe" }}>
                  Track spending patterns and insights
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>🔔</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#ffffff", marginBottom: 2 }}>
                  Smart Reminders
                </div>
                <div style={{ fontSize: 14, color: "#c7d2fe" }}>
                  Never miss a renewal deadline
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>🛡️</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#ffffff", marginBottom: 2 }}>
                  Secure & Private
                </div>
                <div style={{ fontSize: 14, color: "#c7d2fe" }}>
                  Your data is encrypted and protected
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right signup/login card */}
        <div
          style={{
            background: "#ffffff",
            padding: "2.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: 380 }}>
            {/* Login Form */}
            <div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h2
                  style={{
                    fontWeight: 700,
                    fontSize: 22,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  Login
                </h2>
                <p style={{ color: "#6b7280", fontSize: 12 }}>
                  Welcome back! Please login to your account.
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      marginTop: 6,
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontSize: 15,
                      background: "#f9fafb",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Password
                  </label>
                  <div style={{ position: "relative", marginTop: 6 }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 40px 10px 12px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        fontSize: 15,
                        background: "#f9fafb",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6b7280",
                      }}
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  <div style={{ textAlign: "right", marginTop: 8 }}>
                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "#4f46e5",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                      onClick={() => {
                        // TODO: Implement forgot password functionality
}}
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
                    color: "#fff",
                    border: 0,
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 15,
                    boxShadow: "0 14px 30px rgba(79,70,229,0.35)",
                    cursor: "pointer",
                    marginTop: 4,
                  }}
                >
                  Login
                </button>

                {loginError && (
                  <div
                    style={{
                      color: "#dc2626",
                      marginTop: 12,
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    {loginError}
                  </div>
                )}
              </form>

              {/* Social Sign-in */}
              <div style={{ marginTop: 24, marginBottom: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "#e5e7eb",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      padding: "0 8px",
                    }}
                  >
                    Or continue with
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "#e5e7eb",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "7px 9px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      color: "#374151",
                    }}
                  >
                    <img
                      src="/assets/social/google.svg"
                      alt="Google logo"
                      style={{ width: 28, height: 28 }}
                    />
                    <span>Google</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      color: "#1d4ed8",
                    }}
                  >
                    <img
                      src="/assets/social/facebook.svg"
                      alt="Facebook logo"
                      style={{ width: 18, height: 18, borderRadius: 999 }}
                    />
                    <span>Facebook</span>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12 }}>
              <span style={{ color: "#6b7280" }}>Don't have an account? </span>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#4f46e5",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
