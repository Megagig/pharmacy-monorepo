/**
 * Dynamic RBAC (Role-Based Access Control) Types
 */
import type { ObjectId } from './common';
export interface Role {
    _id: ObjectId;
    name: string;
    displayName: string;
    description: string;
    category: 'system' | 'workplace' | 'custom';
    parentRole?: ObjectId;
    childRoles: ObjectId[];
    hierarchyLevel: number;
    permissions: string[];
    isActive: boolean;
    isSystemRole: boolean;
    isDefault: boolean;
    workspaceId?: ObjectId;
    createdBy: ObjectId;
    lastModifiedBy: ObjectId;
    createdAt: string;
    updatedAt: string;
}
export interface Permission {
    _id: ObjectId;
    action: string;
    displayName: string;
    description: string;
    category: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    isSystemPermission: boolean;
    requiresSubscription: boolean;
    allowTrialAccess: boolean;
    requiredPlanTiers: string[];
    requiredFeatures: string[];
    dependsOn: string[];
    conflicts: string[];
    createdBy: ObjectId;
    lastModifiedBy: ObjectId;
    createdAt: string;
    updatedAt: string;
}
export interface UserRole {
    _id: ObjectId;
    userId: ObjectId;
    roleId: ObjectId;
    workspaceId?: ObjectId;
    assignedBy: ObjectId;
    assignedAt: string;
    expiresAt?: string;
    isTemporary: boolean;
    assignmentReason?: string;
    revokedBy?: ObjectId;
    revokedAt?: string;
    revocationReason?: string;
    isActive: boolean;
    lastModifiedBy: ObjectId;
    lastModifiedAt: string;
}
export interface RolePermission {
    _id: ObjectId;
    roleId: ObjectId;
    permission: string;
    granted: boolean;
    conditions?: {
        workspaceOnly?: boolean;
        timeRestricted?: {
            startTime: string;
            endTime: string;
        };
        ipRestricted?: string[];
    };
    grantedBy: ObjectId;
    grantedAt: string;
    lastModifiedBy: ObjectId;
    lastModifiedAt: string;
}
export interface DynamicUser {
    _id: ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    status: 'pending' | 'active' | 'suspended' | 'license_pending' | 'license_rejected';
    systemRole: 'pharmacist' | 'pharmacy_team' | 'pharmacy_outlet' | 'intern_pharmacist' | 'super_admin' | 'owner';
    workplaceRole?: 'Owner' | 'Staff' | 'Pharmacist' | 'Cashier' | 'Technician' | 'Assistant';
    assignedRoles: ObjectId[];
    directPermissions: string[];
    deniedPermissions: string[];
    cachedPermissions?: {
        permissions: string[];
        lastUpdated: string;
        expiresAt: string;
    };
    roleLastModifiedBy?: ObjectId;
    roleLastModifiedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface PermissionResult {
    allowed: boolean;
    source?: 'super_admin' | 'direct_permission' | 'role' | 'inherited' | 'legacy' | 'direct_denial' | 'none';
    reason?: string;
    roleId?: ObjectId;
    roleName?: string;
    inheritedFrom?: string;
    requiredPermissions?: string[];
    upgradeRequired?: boolean;
}
export interface RoleHierarchyNode {
    role: Role;
    children: RoleHierarchyNode[];
    level: number;
    path: string[];
}
export interface PermissionCategory {
    name: string;
    displayName: string;
    description: string;
    permissions: Permission[];
}
export interface BulkRoleAssignment {
    userIds: ObjectId[];
    roleIds: ObjectId[];
    workspaceId?: ObjectId;
    isTemporary?: boolean;
    expiresAt?: string;
    assignmentReason?: string;
}
export interface BulkUserUpdate {
    userId: ObjectId;
    roleIds?: ObjectId[];
    directPermissions?: string[];
    deniedPermissions?: string[];
    workspaceId?: ObjectId;
}
export interface BulkOperationResult {
    success: boolean;
    message: string;
    data: {
        operationId: string;
        totalUpdates: number;
        successfulUpdates: number;
        failedUpdates: number;
        results: Array<{
            userId: ObjectId;
            success: boolean;
            error?: string;
            changes: Record<string, unknown>;
        }>;
        summary: {
            usersUpdated: number;
            rolesAssigned?: number;
            rolesRevoked?: number;
        };
    };
}
export interface PermissionChangeNotification {
    type: 'role_assigned' | 'role_revoked' | 'permission_granted' | 'permission_denied' | 'role_updated';
    userId: ObjectId;
    affectedUsers?: ObjectId[];
    roleId?: ObjectId;
    roleName?: string;
    permission?: string;
    timestamp: string;
    modifiedBy: ObjectId;
}
export interface RoleListResponse {
    success: boolean;
    data: {
        roles: Role[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
export interface PermissionListResponse {
    success: boolean;
    data: {
        permissions: Permission[];
        categories: PermissionCategory[];
        total: number;
    };
}
export interface UserRoleResponse {
    success: boolean;
    data: {
        userRoles: UserRole[];
        effectivePermissions: string[];
        roleHierarchy: RoleHierarchyNode[];
    };
}
export interface RoleHierarchyResponse {
    success: boolean;
    data: {
        hierarchy: RoleHierarchyNode[];
        flatRoles: Role[];
    };
}
export interface RoleFormData {
    name: string;
    displayName: string;
    description: string;
    category: 'system' | 'workplace' | 'custom';
    parentRoleId?: ObjectId;
    permissions: string[];
    isActive: boolean;
    workspaceId?: ObjectId;
}
export interface UserRoleAssignmentFormData {
    userIds: ObjectId[];
    roleIds: ObjectId[];
    workspaceId?: ObjectId;
    expiresAt?: string;
    isTemporary: boolean;
}
export interface PermissionFormData {
    action: string;
    displayName: string;
    description: string;
    category: string;
    requiresSubscription: boolean;
    allowTrialAccess: boolean;
    requiredPlanTiers: string[];
    dependsOn: string[];
    conflicts: string[];
}
export interface RoleSearchParams {
    search?: string;
    category?: 'system' | 'workplace' | 'custom';
    isActive?: boolean;
    workspaceId?: ObjectId;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface UserSearchParams {
    search?: string;
    status?: string;
    systemRole?: string;
    workplaceRole?: string;
    hasRole?: ObjectId;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PermissionSearchParams {
    search?: string;
    category?: string;
    requiresSubscription?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface SystemConfig {
    app: {
        name: string;
        version: string;
        environment: string;
        url: string;
    };
    auth: {
        jwtExpiration: string;
        bcryptRounds: number;
        maxLoginAttempts: number;
        lockoutDuration: string;
    };
    email: {
        provider: string;
        from: string;
        maxRecipients: number;
    };
    upload: {
        maxFileSize: number;
        allowedTypes: string;
        storageProvider: string;
    };
    pagination: {
        defaultLimit: number;
        maxLimit: number;
    };
    cache: {
        provider: string;
        ttl: number;
    };
}
export interface SecuritySettings {
    passwordPolicy: {
        minLength: number;
        requireUppercase: boolean;
        requireLowercase: boolean;
        requireNumbers: boolean;
        requireSpecialChars: boolean;
        expireAfterDays: number;
        preventReuse: number;
        lockoutAfterAttempts: number;
        lockoutDurationMinutes: number;
    };
    sessionPolicy: {
        timeoutMinutes: number;
        concurrentSessions: number;
        rememberMeDays: number;
        requireReauthAfterDays: number;
    };
    twoFactorAuth: {
        enabled: boolean;
        requiredForAdmins: boolean;
        requiredForUsers: boolean;
        methods: string[];
    };
    ipRestrictions: {
        enabled: boolean;
        allowedIPs: string[];
        blockSuspiciousIPs: boolean;
    };
    auditLogging: {
        enabled: boolean;
        logLevel: string;
        retentionDays: number;
    };
}
export interface FeatureFlag {
    _id: ObjectId;
    name: string;
    description: string;
    isActive: boolean;
    conditions: Record<string, unknown>;
    createdBy: ObjectId;
    createdAt: string;
    lastModifiedBy: ObjectId;
    lastModifiedAt: string;
}
//# sourceMappingURL=rbac.d.ts.map