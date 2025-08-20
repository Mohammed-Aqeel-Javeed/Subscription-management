// API configuration for different environments
const getApiUrl = () => {
  // In production, use environment variable or fallback to relative path if backend is in same domain
  if (import.meta.env.MODE === 'production') {
    return import.meta.env.VITE_API_URL || '';
  }
  // In development, use relative path (assumes backend runs on same domain)
  return '';
};

export const API_BASE_URL = getApiUrl();

// Helper function to make API calls with proper URL
export const apiFetch = (endpoint: string, options?: RequestInit) => {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, {
    credentials: 'include',
    ...options,
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
  CURRENCIES: '/api/currencies',
} as const;
