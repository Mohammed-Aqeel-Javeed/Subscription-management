import React, { useState } from "react";
import { UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../lib/config";

export default function SignupPage() {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // Autogenerate tenantId in frontend

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    // More strict email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return false;
    }
    
    // Additional checks
    const [localPart, domain] = email.split('@');
    
    // Local part should not be empty or too long
    if (!localPart || localPart.length > 64) {
      return false;
    }
    
    // Domain should have at least one dot and valid TLD
    if (!domain || !domain.includes('.')) {
      return false;
    }
    
    const domainParts = domain.split('.');
    const tld = domainParts[domainParts.length - 1];
    
    // TLD should be at least 2 characters
    if (tld.length < 2) {
      return false;
    }
    
    return true;
  };

  // Password policy validation
  const validatePassword = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  };

  const passwordValidation = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet the security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to send OTP");
        return;
      }

      setSuccess("OTP sent to your email! Please check your inbox.");
      setStep("otp");
    } catch (err) {
      setError("Network error - please check if the server is running");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      // First verify OTP
      const verifyRes = await fetch(`${API_BASE_URL}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.message || "Invalid OTP");
        return;
      }

      // Then create account
      const tenantId = 'tenant-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
      
      const signupRes = await fetch(`${API_BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName, email, password, tenantId })
      });

      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        setError(signupData.message || "Signup failed");
        return;
      }

      setSuccess("Signup successful! Redirecting to login...");
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError("Network error - please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "3rem auto" }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <UserPlus size={48} color="#007bff" style={{ marginBottom: 8 }} />
          <h2 style={{ fontWeight: 700, fontSize: 28, color: '#222' }}>Create Account</h2>
          <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
            {step === "details" && "Step 1: Enter your details"}
            {step === "otp" && "Step 2: Verify OTP"}
          </p>
        </div>

        {/* Step 1: Enter All Details */}
        {step === "details" && (
          <form onSubmit={handleSubmitDetails}>
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
              <label style={{ fontWeight: 500 }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 }}
              />
              {email && !isValidEmail(email) && (
                <div style={{ color: '#d32f2f', fontSize: 12, marginTop: 4 }}>
                  Please enter a valid email address
                </div>
              )}
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
              {password && (
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: '#555' }}>Password must contain:</div>
                  <PasswordRequirement met={passwordValidation.minLength} text="At least 8 characters" />
                  <PasswordRequirement met={passwordValidation.hasUpperCase} text="One uppercase letter (A-Z)" />
                  <PasswordRequirement met={passwordValidation.hasLowerCase} text="One lowercase letter (a-z)" />
                  <PasswordRequirement met={passwordValidation.hasNumber} text="One number (0-9)" />
                  <PasswordRequirement met={passwordValidation.hasSpecialChar} text="One special character (!@#$%^&*)" />
                </div>
              )}
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
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: "100%", 
                padding: 12, 
                background: loading ? "#ccc" : "#007bff", 
                color: "#fff", 
                border: 0, 
                borderRadius: 8, 
                fontWeight: 600, 
                fontSize: 18, 
                boxShadow: '0 2px 8px rgba(0,123,255,0.08)',
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
            {error && <div style={{ color: "#d32f2f", marginTop: 12, textAlign: 'center' }}>{error}</div>}
            {success && <div style={{ color: "#388e3c", marginTop: 12, textAlign: 'center' }}>{success}</div>}
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOTP}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 500 }}>Enter 6-Digit OTP</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                style={{ 
                  width: "100%", 
                  padding: 12, 
                  marginTop: 6, 
                  borderRadius: 6, 
                  border: '1px solid #ddd', 
                  fontSize: 24, 
                  textAlign: 'center',
                  letterSpacing: '8px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ color: '#666', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                OTP sent to: <strong>{email}</strong>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: "100%", 
                padding: 12, 
                background: loading ? "#ccc" : "#007bff", 
                color: "#fff", 
                border: 0, 
                borderRadius: 8, 
                fontWeight: 600, 
                fontSize: 18, 
                boxShadow: '0 2px 8px rgba(0,123,255,0.08)',
                cursor: loading ? "not-allowed" : "pointer",
                marginBottom: 12
              }}
            >
              {loading ? "Verifying & Creating Account..." : "Verify OTP & Sign Up"}
            </button>
            <button 
              type="button"
              onClick={() => {
                setStep("details");
                setOtp("");
                setError("");
                setSuccess("");
              }}
              style={{ 
                width: "100%", 
                padding: 10, 
                background: "transparent", 
                color: "#007bff", 
                border: '1px solid #007bff', 
                borderRadius: 8, 
                fontWeight: 500, 
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              Back to Details
            </button>
            {error && <div style={{ color: "#d32f2f", marginTop: 12, textAlign: 'center' }}>{error}</div>}
            {success && <div style={{ color: "#388e3c", marginTop: 12, textAlign: 'center' }}>{success}</div>}
          </form>
        )}

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
      </div>
    </div>
  );
}

// Helper component for password requirements
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      {met ? (
        <CheckCircle2 size={14} color="#388e3c" />
      ) : (
        <XCircle size={14} color="#d32f2f" />
      )}
      <span style={{ color: met ? '#388e3c' : '#d32f2f' }}>{text}</span>
    </div>
  );
}
