/**
 * API Endpoint Constants
 * Base URLs and endpoint paths for API communication
 */
export declare const API_BASE_URL: string;
export declare const API_VERSION = "v1";
export declare const API_TIMEOUT = 30000;
export declare const API_ENDPOINTS: {
    readonly AUTH: {
        readonly LOGIN: "/api/auth/login";
        readonly REGISTER: "/api/auth/register";
        readonly LOGOUT: "/api/auth/logout";
        readonly REFRESH: "/api/auth/refresh";
        readonly VERIFY_EMAIL: "/api/auth/verify-email";
        readonly FORGOT_PASSWORD: "/api/auth/forgot-password";
        readonly RESET_PASSWORD: "/api/auth/reset-password";
    };
    readonly PATIENTS: {
        readonly BASE: "/api/patients";
        readonly BY_ID: (id: string) => string;
        readonly SEARCH: "/api/patients/search";
        readonly ALLERGIES: (patientId: string) => string;
        readonly CONDITIONS: (patientId: string) => string;
        readonly MEDICATIONS: (patientId: string) => string;
        readonly ASSESSMENTS: (patientId: string) => string;
        readonly DTPS: (patientId: string) => string;
        readonly CARE_PLANS: (patientId: string) => string;
        readonly VISITS: (patientId: string) => string;
    };
    readonly WORKSPACE: {
        readonly MEMBERS: "/api/workspace/members";
        readonly INVITES: "/api/workspace/invites";
        readonly AUDIT_LOGS: "/api/workspace/audit-logs";
        readonly STATS: "/api/workspace/stats";
    };
    readonly RBAC: {
        readonly ROLES: "/api/rbac/roles";
        readonly PERMISSIONS: "/api/rbac/permissions";
        readonly USER_ROLES: "/api/rbac/user-roles";
        readonly ASSIGN_ROLE: "/api/rbac/assign-role";
    };
    readonly PRESCRIPTIONS: {
        readonly BASE: "/api/prescriptions";
        readonly BY_ID: (id: string) => string;
        readonly DISPENSE: (id: string) => string;
    };
    readonly APPOINTMENTS: {
        readonly BASE: "/api/appointments";
        readonly BY_ID: (id: string) => string;
        readonly TYPES: "/api/appointments/types";
    };
    readonly BILLING: {
        readonly BASE: "/api/billing";
        readonly INVOICES: "/api/billing/invoices";
        readonly PAYMENTS: "/api/billing/payments";
    };
    readonly SUBSCRIPTIONS: {
        readonly BASE: "/api/subscriptions";
        readonly PLANS: "/api/subscriptions/plans";
        readonly CHECKOUT: "/api/subscriptions/checkout";
    };
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly UNPROCESSABLE_ENTITY: 422;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const REQUEST_HEADERS: {
    readonly CONTENT_TYPE: "Content-Type";
    readonly AUTHORIZATION: "Authorization";
    readonly ACCEPT: "Accept";
};
export declare const CONTENT_TYPES: {
    readonly JSON: "application/json";
    readonly FORM_DATA: "multipart/form-data";
    readonly URL_ENCODED: "application/x-www-form-urlencoded";
};
//# sourceMappingURL=api.d.ts.map