var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
// API configuration for different environments
var getApiUrl = function () {
    // In production, use environment variable or default to same domain
    if (import.meta.env.MODE === 'production') {
        // If VITE_API_URL is set, use it; otherwise use same domain (relative path)
        return import.meta.env.VITE_API_URL || '';
    }
    // In development, point to backend server on port 5000
    return 'http://localhost:5000';
};
export var API_BASE_URL = getApiUrl();
// Helper function to make API calls with proper URL
export var apiFetch = function (endpoint, options) {
    var url = "".concat(API_BASE_URL).concat(endpoint);
    return fetch(url, __assign({ credentials: 'include' }, options));
};
// Export commonly used endpoints
export var API_ENDPOINTS = {
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
};
