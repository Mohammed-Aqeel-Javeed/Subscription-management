import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

type Status = "verifying" | "success" | "error";

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    let cancelled = false;

    const verify = async () => {
      const MAX_ATTEMPTS = 12;
      const INTERVAL_MS = 1500;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;

        // Small initial wait on attempt 0 so the webhook has a head-start
        await new Promise(r => setTimeout(r, attempt === 0 ? 1000 : INTERVAL_MS));
        if (cancelled) return;

        try {
          const res = await apiFetch(`/api/stripe/verify-session?sessionId=${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            // Force a fresh /api/me fetch so the updated plan takes effect immediately
            await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
            if (!cancelled) {
              setStatus("success");
              setTimeout(() => navigate("/dashboard", { replace: true }), 2500);
            }
            return;
          }
          // 404 or 402 means webhook hasn't fired yet — keep polling
        } catch {
          // Network blip — keep retrying
        }
      }

      // Exhausted retries
      if (!cancelled) setStatus("error");
    };

    verify();
    return () => { cancelled = true; };
  }, [sessionId, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "1rem",
        background:
          status === "success"
            ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
            : status === "error"
            ? "linear-gradient(135deg, #fff1f2, #ffe4e6)"
            : "linear-gradient(135deg, #f0f4ff, #e8edff)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {status === "verifying" && (
          <>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                margin: "0 auto 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(79,70,229,0.3)",
                animation: "spin 1.2s linear infinite",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
              Confirming your payment…
            </h1>
            <p style={{ color: "#6b7280", fontSize: 15 }}>
              Please wait while we activate your plan.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                margin: "0 auto 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(22,163,74,0.3)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
              Payment successful!
            </h1>
            <p style={{ color: "#6b7280", fontSize: 15 }}>
              Your plan has been activated. Redirecting to your dashboard…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                margin: "0 auto 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(239,68,68,0.3)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
              Something went wrong
            </h1>
            <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 28 }}>
              We could not confirm your payment. If you were charged, your account will be updated shortly. Please contact support if this persists.
            </p>
            <button
              onClick={() => navigate("/upgrade")}
              style={{
                padding: "12px 28px",
                background: "#4f46e5",
                color: "#fff",
                border: 0,
                borderRadius: 999,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 15,
                boxShadow: "0 4px 16px rgba(79,70,229,0.25)",
              }}
            >
              Back to Upgrade
            </button>
          </>
        )}
      </div>
    </div>
  );
}
