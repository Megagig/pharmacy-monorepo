/**
 * User Roles and Permissions Constants
 */
export declare const SYSTEM_ROLES: {
    readonly SUPER_ADMIN: "super_admin";
    readonly OWNER: "owner";
    readonly PHARMACIST: "pharmacist";
    readonly PHARMACY_TEAM: "pharmacy_team";
    readonly PHARMACY_OUTLET: "pharmacy_outlet";
    readonly INTERN_PHARMACIST: "intern_pharmacist";
};
export declare const WORKPLACE_ROLES: {
    readonly OWNER: "Owner";
    readonly STAFF: "Staff";
    readonly PHARMACIST: "Pharmacist";
    readonly CASHIER: "Cashier";
    readonly TECHNICIAN: "Technician";
    readonly ASSISTANT: "Assistant";
};
export declare const PERMISSION_CATEGORIES: {
    readonly PATIENT: "patient";
    readonly PRESCRIPTION: "prescription";
    readonly BILLING: "billing";
    readonly INVENTORY: "inventory";
    readonly REPORTS: "reports";
    readonly SETTINGS: "settings";
    readonly WORKSPACE: "workspace";
    readonly RBAC: "rbac";
};
export declare const PERMISSIONS: {
    readonly PATIENT_CREATE: "patient:create";
    readonly PATIENT_READ: "patient:read";
    readonly PATIENT_UPDATE: "patient:update";
    readonly PATIENT_DELETE: "patient:delete";
    readonly PATIENT_EXPORT: "patient:export";
    readonly PRESCRIPTION_CREATE: "prescription:create";
    readonly PRESCRIPTION_READ: "prescription:read";
    readonly PRESCRIPTION_UPDATE: "prescription:update";
    readonly PRESCRIPTION_DELETE: "prescription:delete";
    readonly PRESCRIPTION_DISPENSE: "prescription:dispense";
    readonly BILLING_CREATE: "billing:create";
    readonly BILLING_READ: "billing:read";
    readonly BILLING_UPDATE: "billing:update";
    readonly BILLING_DELETE: "billing:delete";
    readonly BILLING_PROCESS_PAYMENT: "billing:process-payment";
    readonly WORKSPACE_INVITE: "workspace:invite";
    readonly WORKSPACE_MANAGE_MEMBERS: "workspace:manage-members";
    readonly WORKSPACE_VIEW_AUDIT: "workspace:view-audit";
    readonly RBAC_MANAGE_ROLES: "rbac:manage-roles";
    readonly RBAC_MANAGE_PERMISSIONS: "rbac:manage-permissions";
    readonly RBAC_ASSIGN_ROLES: "rbac:assign-roles";
    readonly SETTINGS_VIEW: "settings:view";
    readonly SETTINGS_UPDATE: "settings:update";
    readonly SETTINGS_MANAGE_SUBSCRIPTION: "settings:manage-subscription";
};
export declare const MEMBER_STATUS: {
    readonly PENDING: "pending";
    readonly ACTIVE: "active";
    readonly SUSPENDED: "suspended";
    readonly INACTIVE: "inactive";
};
export declare const INVITE_STATUS: {
    readonly PENDING: "pending";
    readonly ACCEPTED: "accepted";
    readonly REJECTED: "rejected";
    readonly EXPIRED: "expired";
    readonly REVOKED: "revoked";
};
//# sourceMappingURL=roles.d.ts.map