import { API_BASE_URL } from "./config";

const DEFAULT_TIMEOUT_MS = 20_000;

function getTimeoutMs(endpoint: string) {
  // Stripe aggregation can be slow on cold starts / network variance.
  if (endpoint.startsWith("/api/platform/billing")) return 60_000;
  return DEFAULT_TIMEOUT_MS;
}

function normalizeToken(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^Bearer\s+/i, "");
}

function isLikelyJwt(value: string) {
  const trimmed = normalizeToken(value);
  if (!trimmed) return false;
  if (trimmed === "null" || trimmed === "undefined") return false;
  return trimmed.split(".").length === 3;
}

function pickToken(): string {
  const sessionToken = normalizeToken(String(sessionStorage.getItem("token") || ""));
  if (isLikelyJwt(sessionToken)) return sessionToken;
  return "";
}

function getTokenFromStorageOrCookie(): string {
  // Prefer per-tab storage so multiple accounts can be used
  // in different tabs without overriding each other.
  return pickToken();
}

// Helper function to make API calls with proper URL + auth + sane timeouts
export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const makeHeaders = (override?: { omitAuth?: boolean; forceToken?: string }) => {
    const headers = new Headers(options?.headers);
    if (override?.omitAuth) {
      headers.delete("Authorization");
      headers.delete("X-Tab-Auth");
      return headers;
    }

    const forced = normalizeToken(String(override?.forceToken || ""));
    if (isLikelyJwt(forced)) {
      headers.set("Authorization", `Bearer ${forced}`);
      return headers;
    }

    const token = getTokenFromStorageOrCookie();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  };

  const tokenUsed = getTokenFromStorageOrCookie();

  const doFetch = async (override?: { omitAuth?: boolean; forceToken?: string }) => {
    const effectiveHeaders = override?.omitAuth
      ? makeHeaders({ omitAuth: true })
      : makeHeaders({ forceToken: override?.forceToken });

    // Avoid hanging requests after sleep/offline
    if (options?.signal) {
      return fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers: effectiveHeaders,
      });
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), getTimeoutMs(endpoint));

    try {
      return await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers: effectiveHeaders,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const tryRefresh = async (): Promise<string | null> => {
    if (endpoint === "/api/auth/refresh") return null;
    if (endpoint === "/api/login") return null;

    const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });

    if (!refreshRes.ok) return null;

    const data = await refreshRes.json().catch(() => null);
    const next = normalizeToken(String(data?.token || ""));
    if (!isLikelyJwt(next)) return null;

    try {
      sessionStorage.setItem("token", next);
    } catch {
      // ignore
    }

    return next;
  };

  const res = await doFetch();

  // Auth recovery: if a stale per-tab token exists, attempt a cookie-only retry.
  // IMPORTANT: Do not eagerly delete the token on 401/403 — that breaks refresh when
  // cookies are unavailable (cross-site, blocked, or not yet set).
  if (res.status === 401 || res.status === 403) {
    if (tokenUsed) {
      const retryRes = await doFetch({ omitAuth: true });
      if (retryRes.ok) {
        try {
          sessionStorage.removeItem("token");
        } catch {
          // ignore
        }
        return retryRes;
      }
    }

    const refreshed = await tryRefresh();
    if (refreshed) {
      return doFetch({ forceToken: refreshed });
    }

    return res;
  }

  return res;
};

// Export commonly used endpoints
export const API_ENDPOINTS = {
  LOGIN: '/api/login',
  SIGNUP: '/api/signup',
  LOGOUT: '/api/logout',
  SUBSCRIPTIONS: '/api/subscriptions',
  EMPLOYEES: '/api/employees',
  ANALYTICS_DASHBOARD: '/api/analytics/dashboard',
  ANALYTICS_TRENDS: '/api/analytics/trends',
  ANALYTICS_CATEGORIES: '/api/analytics/categories',
  COMPLIANCE_LIST: '/api/compliance/list',
  COMPLIANCE_INSERT: '/api/compliance/insert',
  LEDGER_INSERT: '/api/ledger/insert',
  PAYMENT: '/api/payment',
  CONFIG_FIELDS: '/api/config/fields',
  CONFIG_COMPLIANCE_FIELDS: '/api/config/compliance-fields',
  COMPANY_CATEGORIES: '/api/company/categories',
  COMPANY_DEPARTMENTS: '/api/company/departments',
  COMPANY_INFO: '/api/company-info',
  CURRENCIES: '/api/currencies',
} as const;
