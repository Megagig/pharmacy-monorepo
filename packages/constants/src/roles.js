/**
 * User Roles and Permissions Constants
 */
// System Roles
export const SYSTEM_ROLES = {
    SUPER_ADMIN: 'super_admin',
    OWNER: 'owner',
    PHARMACIST: 'pharmacist',
    PHARMACY_TEAM: 'pharmacy_team',
    PHARMACY_OUTLET: 'pharmacy_outlet',
    INTERN_PHARMACIST: 'intern_pharmacist',
};
// Workplace Roles
export const WORKPLACE_ROLES = {
    OWNER: 'Owner',
    STAFF: 'Staff',
    PHARMACIST: 'Pharmacist',
    CASHIER: 'Cashier',
    TECHNICIAN: 'Technician',
    ASSISTANT: 'Assistant',
};
// Permission Categories
export const PERMISSION_CATEGORIES = {
    PATIENT: 'patient',
    PRESCRIPTION: 'prescription',
    BILLING: 'billing',
    INVENTORY: 'inventory',
    REPORTS: 'reports',
    SETTINGS: 'settings',
    WORKSPACE: 'workspace',
    RBAC: 'rbac',
};
// Common Permissions
export const PERMISSIONS = {
    // Patient Management
    PATIENT_CREATE: 'patient:create',
    PATIENT_READ: 'patient:read',
    PATIENT_UPDATE: 'patient:update',
    PATIENT_DELETE: 'patient:delete',
    PATIENT_EXPORT: 'patient:export',
    // Prescription Management
    PRESCRIPTION_CREATE: 'prescription:create',
    PRESCRIPTION_READ: 'prescription:read',
    PRESCRIPTION_UPDATE: 'prescription:update',
    PRESCRIPTION_DELETE: 'prescription:delete',
    PRESCRIPTION_DISPENSE: 'prescription:dispense',
    // Billing
    BILLING_CREATE: 'billing:create',
    BILLING_READ: 'billing:read',
    BILLING_UPDATE: 'billing:update',
    BILLING_DELETE: 'billing:delete',
    BILLING_PROCESS_PAYMENT: 'billing:process-payment',
    // Workspace Management
    WORKSPACE_INVITE: 'workspace:invite',
    WORKSPACE_MANAGE_MEMBERS: 'workspace:manage-members',
    WORKSPACE_VIEW_AUDIT: 'workspace:view-audit',
    // RBAC
    RBAC_MANAGE_ROLES: 'rbac:manage-roles',
    RBAC_MANAGE_PERMISSIONS: 'rbac:manage-permissions',
    RBAC_ASSIGN_ROLES: 'rbac:assign-roles',
    // Settings
    SETTINGS_VIEW: 'settings:view',
    SETTINGS_UPDATE: 'settings:update',
    SETTINGS_MANAGE_SUBSCRIPTION: 'settings:manage-subscription',
};
// Member Status
export const MEMBER_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    INACTIVE: 'inactive',
};
// Invite Status
export const INVITE_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    REVOKED: 'revoked',
};
//# sourceMappingURL=roles.js.map