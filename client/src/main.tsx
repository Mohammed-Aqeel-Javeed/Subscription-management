import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Attach per-tab Authorization for API calls so multiple tabs
// can be logged into different accounts (cookie auth is shared).
declare global {
	interface Window {
		__tracklaFetchAuthPatched?: boolean;
	}
}

if (typeof window !== "undefined" && !window.__tracklaFetchAuthPatched) {
	window.__tracklaFetchAuthPatched = true;
	const originalFetch = window.fetch.bind(window);

	const isLikelyJwt = (value: string) => {
		const trimmed = String(value || "").trim().replace(/^Bearer\s+/i, "");
		if (!trimmed) return false;
		if (trimmed === "null" || trimmed === "undefined") return false;
		return trimmed.split(".").length === 3;
	};

	const normalizeToken = (value: string) => String(value || "").trim().replace(/^Bearer\s+/i, "");

	const pickToken = () => {
		const sessionToken = normalizeToken(String(sessionStorage.getItem("token") || ""));
		if (isLikelyJwt(sessionToken)) return { token: normalizeToken(sessionToken), tabScoped: true };
		return { token: "", tabScoped: false };
	};

	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
		const isApiCall = url.startsWith("/api/") || url.includes("/api/");
		if (!isApiCall) return originalFetch(input as any, init);

		const { token, tabScoped } = pickToken();
		const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));

		// Only opt into tab-scoped auth when this tab actually has a per-tab token.
		// This prevents new tabs (no sessionStorage yet) from 401'ing because cookies are ignored.
		if (tabScoped && token && !headers.has("X-Tab-Auth")) {
			headers.set("X-Tab-Auth", "1");
		}

		if (token && !headers.has("Authorization")) {
			headers.set("Authorization", `Bearer ${token}`);
		}

		return originalFetch(input as any, { ...init, headers });
	};
}

createRoot(document.getElementById("root")!).render(<App />);
