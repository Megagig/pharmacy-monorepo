/**
 * API Endpoint Constants
 * Base URLs and endpoint paths for API communication
 */
// Base API configuration
export const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000';
export const API_VERSION = 'v1';
export const API_TIMEOUT = 30000; // 30 seconds
// API Endpoints
export const API_ENDPOINTS = {
    // Authentication
    AUTH: {
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        LOGOUT: '/api/auth/logout',
        REFRESH: '/api/auth/refresh',
        VERIFY_EMAIL: '/api/auth/verify-email',
        FORGOT_PASSWORD: '/api/auth/forgot-password',
        RESET_PASSWORD: '/api/auth/reset-password',
    },
    // Patients
    PATIENTS: {
        BASE: '/api/patients',
        BY_ID: (id) => `/api/patients/${id}`,
        SEARCH: '/api/patients/search',
        ALLERGIES: (patientId) => `/api/patients/${patientId}/allergies`,
        CONDITIONS: (patientId) => `/api/patients/${patientId}/conditions`,
        MEDICATIONS: (patientId) => `/api/patients/${patientId}/medications`,
        ASSESSMENTS: (patientId) => `/api/patients/${patientId}/assessments`,
        DTPS: (patientId) => `/api/patients/${patientId}/dtps`,
        CARE_PLANS: (patientId) => `/api/patients/${patientId}/care-plans`,
        VISITS: (patientId) => `/api/patients/${patientId}/visits`,
    },
    // Workspace
    WORKSPACE: {
        MEMBERS: '/api/workspace/members',
        INVITES: '/api/workspace/invites',
        AUDIT_LOGS: '/api/workspace/audit-logs',
        STATS: '/api/workspace/stats',
    },
    // RBAC
    RBAC: {
        ROLES: '/api/rbac/roles',
        PERMISSIONS: '/api/rbac/permissions',
        USER_ROLES: '/api/rbac/user-roles',
        ASSIGN_ROLE: '/api/rbac/assign-role',
    },
    // Prescriptions
    PRESCRIPTIONS: {
        BASE: '/api/prescriptions',
        BY_ID: (id) => `/api/prescriptions/${id}`,
        DISPENSE: (id) => `/api/prescriptions/${id}/dispense`,
    },
    // Appointments
    APPOINTMENTS: {
        BASE: '/api/appointments',
        BY_ID: (id) => `/api/appointments/${id}`,
        TYPES: '/api/appointments/types',
    },
    // Billing
    BILLING: {
        BASE: '/api/billing',
        INVOICES: '/api/billing/invoices',
        PAYMENTS: '/api/billing/payments',
    },
    // Subscriptions
    SUBSCRIPTIONS: {
        BASE: '/api/subscriptions',
        PLANS: '/api/subscriptions/plans',
        CHECKOUT: '/api/subscriptions/checkout',
    },
};
// HTTP Status Codes
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
// Request Headers
export const REQUEST_HEADERS = {
    CONTENT_TYPE: 'Content-Type',
    AUTHORIZATION: 'Authorization',
    ACCEPT: 'Accept',
};
// Content Types
export const CONTENT_TYPES = {
    JSON: 'application/json',
    FORM_DATA: 'multipart/form-data',
    URL_ENCODED: 'application/x-www-form-urlencoded',
};
//# sourceMappingURL=api.js.map