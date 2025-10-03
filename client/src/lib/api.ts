import { API_BASE_URL } from "./config";

// Helper function to make API calls with proper URL
export const apiFetch = (endpoint: string, options?: RequestInit) => {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, {
    credentials: 'include',
    ...options,
  }).then(async response => {
    // Debug: log response headers after login
    if (endpoint === '/api/login') {
      // Convert headers to object for easier viewing
      const headersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => { headersObj[key] = value; });
      console.log('[apiFetch] Login response headers:', headersObj);
    }
    return response;
  });
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
