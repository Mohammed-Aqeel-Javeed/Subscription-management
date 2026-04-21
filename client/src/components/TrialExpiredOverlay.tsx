import { useNavigate } from "react-router-dom";

interface Props {
  plan: string | null | undefined;
  trialEndsAt: string | null | undefined;
}

export default function TrialExpiredOverlay({ plan, trialEndsAt }: Props) {
  const navigate = useNavigate();

  const isTrialExpired = plan === "trial" && !!trialEndsAt && new Date(trialEndsAt) < new Date();
  const isPlanExpired  = plan === "expired";

  if (!isTrialExpired && !isPlanExpired) return null;

  const heading = isTrialExpired
    ? "Your free trial has expired"
    : "Your subscription has expired";

  const body = isTrialExpired
    ? "Your 3-day free trial has ended. Upgrade to a paid plan to continue using Trackla and access all your data."
    : "Your subscription has ended. Upgrade to restore full access — all your data is safely preserved and ready.";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: "3rem 2.5rem",
          maxWidth: 480,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            margin: "0 auto 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(239,68,68,0.35)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
              fill="white"
            />
          </svg>
        </div>

        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 12,
            lineHeight: 1.3,
          }}
        >
          {heading}
        </h2>

        <p
          style={{
            color: "#6b7280",
            fontSize: 15,
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          {body}
        </p>

        {/* Data safety reassurance */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginBottom: 28,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 13, color: "#166534", fontWeight: 500 }}>
            Your data is safe and preserved
          </span>
        </div>

        <button
          onClick={() => navigate("/upgrade")}
          style={{
            width: "100%",
            padding: "14px 0",
            background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
            color: "#fff",
            border: 0,
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(79,70,229,0.35)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Upgrade Now
        </button>
      </div>
    </div>
  );
}
