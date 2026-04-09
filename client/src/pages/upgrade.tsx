import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { API_BASE_URL } from "../lib/config";
import { useUser } from "@/context/UserContext";

const STARTER_FEATURES = [
  "Up to 50 subscriptions",
  "5 team members",
  "Email reminders",
  "Basic reports",
  "Email support",
];

const PRO_FEATURES = [
  "Unlimited subscriptions",
  "Unlimited team members",
  "Advanced reminders",
  "Advanced analytics",
  "Compliance tracking",
  "Priority support",
];

const ENTERPRISE_FEATURES = [
  "Everything in Professional",
  "Custom integrations",
  "Dedicated account manager",
  "SLA guarantee",
  "24/7 phone support",
];

export default function UpgradePage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSelectPlan = async (plan: "starter" | "professional") => {
    setLoading(plan);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/stripe/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan,
          mode: "upgrade",
          userId: user?.userId || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to start checkout. Please try again.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%)",
        padding: "3rem 1rem 4rem",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <img
              src="/assets/logo.png"
              alt="Trackla"
              style={{ height: 48, width: 48, objectFit: "contain" }}
            />
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
            Upgrade your plan
          </h1>
          <p style={{ color: "#6b7280", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
            Your free trial has ended. Choose a plan to continue using Trackla.
          </p>
          {error && (
            <p
              style={{
                color: "#dc2626",
                marginTop: 16,
                fontSize: 14,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 16px",
                display: "inline-block",
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Plan Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
            alignItems: "stretch",
          }}
        >
          {/* ── Starter ── */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: "2rem",
              boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
              border: "2px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                Starter
              </h2>
              <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
                Perfect for small teams
              </p>
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: "#111827" }}>$29</span>
                <span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>/month</span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {STARTER_FEATURES.map(f => (
                  <li
                    key={f}
                    style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, color: "#374151" }}
                  >
                    <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => handleSelectPlan("starter")}
              disabled={loading !== null}
              style={{
                marginTop: "auto",
                width: "100%",
                padding: "13px 0",
                background: loading === "starter" ? "#9ca3af" : "#111827",
                color: "#fff",
                border: 0,
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 15,
                cursor: loading !== null ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading === "starter" ? "Redirecting to Stripe…" : "Choose Starter"}
            </button>
          </div>

          {/* ── Professional (featured) ── */}
          <div
            style={{
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              borderRadius: 20,
              padding: "2rem",
              boxShadow: "0 8px 40px rgba(79,70,229,0.3)",
              border: "2px solid #6366f1",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Badge */}
            <div
              style={{
                position: "absolute",
                top: -14,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#fbbf24",
                color: "#111827",
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 18px",
                borderRadius: 999,
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
              }}
            >
              MOST POPULAR
            </div>

            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>
                Professional
              </h2>
              <p style={{ color: "#c7d2fe", fontSize: 14, marginBottom: 20 }}>
                For growing teams
              </p>
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: "#ffffff" }}>$79</span>
                <span style={{ fontSize: 16, color: "#a5b4fc", fontWeight: 400 }}>/month</span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {PRO_FEATURES.map(f => (
                  <li
                    key={f}
                    style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, color: "#e0e7ff" }}
                  >
                    <CheckCircle2 size={16} style={{ color: "#86efac", flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => handleSelectPlan("professional")}
              disabled={loading !== null}
              style={{
                marginTop: "auto",
                width: "100%",
                padding: "13px 0",
                background: loading === "professional" ? "rgba(255,255,255,0.5)" : "#ffffff",
                color: "#4f46e5",
                border: 0,
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 15,
                cursor: loading !== null ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading === "professional" ? "Redirecting to Stripe…" : "Choose Professional"}
            </button>
          </div>

          {/* ── Enterprise (display only) ── */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: "2rem",
              boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
              border: "2px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
              opacity: 0.65,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Enterprise</h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#f3f4f6",
                    color: "#6b7280",
                    padding: "2px 10px",
                    borderRadius: 999,
                    letterSpacing: "0.04em",
                  }}
                >
                  COMING SOON
                </span>
              </div>
              <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
                For large organizations
              </p>
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: "#111827" }}>Custom</span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {ENTERPRISE_FEATURES.map(f => (
                  <li
                    key={f}
                    style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, color: "#374151" }}
                  >
                    <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <button
              disabled
              style={{
                marginTop: "auto",
                width: "100%",
                padding: "13px 0",
                background: "#f3f4f6",
                color: "#9ca3af",
                border: "2px solid #e5e7eb",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 15,
                cursor: "not-allowed",
              }}
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
