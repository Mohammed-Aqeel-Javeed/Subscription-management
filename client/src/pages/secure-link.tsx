import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function SecureLinkRedirect() {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const tokenStr = String(token ?? "").trim();
    if (!tokenStr) {
      navigate("/dashboard", { replace: true });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const qs = new URLSearchParams({ token: tokenStr }).toString();
        const res = await fetch(`/api/secure-link/resolve?${qs}`, { credentials: "include" });

        if (res.status === 401) {
          const next = encodeURIComponent(location.pathname + location.search);
          if (!cancelled) navigate(`/login?next=${next}`, { replace: true });
          return;
        }

        if (!res.ok) throw new Error("Failed to resolve");

        const data = (await res.json()) as { path?: string; query?: Record<string, string> };
        const path = String(data?.path ?? "").trim();
        const query = data?.query && typeof data.query === "object" ? data.query : {};

        if (!path.startsWith("/")) throw new Error("Invalid path");

        const search = new URLSearchParams(query).toString();
        const dest = search ? `${path}?${search}` : path;

        if (!cancelled) navigate(dest, { replace: true });
      } catch {
        if (!cancelled) navigate("/dashboard", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate, location.pathname, location.search]);

  return null;
}
