import { API_BASE_URL } from "./config";

const DEFAULT_TIMEOUT_MS = 20_000;

function getTokenFromStorageOrCookie(): string {
  const fromStorage = localStorage.getItem("token") || "";
  if (fromStorage) return fromStorage;

  if (document.cookie) {
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (match) return match[1];
  }
  return "";
}

// Helper function to make API calls with proper URL + auth + sane timeouts
export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options?.headers);
  const token = getTokenFromStorageOrCookie();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Avoid hanging requests after sleep/offline
  if (options?.signal) {
    return fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers,
    });
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
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
