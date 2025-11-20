import { apiClient } from '../services/apiClient';
import {
  DynamicUser,
  Role,
  Permission,
  BulkUserUpdate,
  RoleConflict,
  RoleConflictResolution,
  SystemConfig,
  SecuritySettings,
  MaintenanceStatus,
  ApiKey,
  FeatureFlag,
  SystemAnalytics,
} from '../types/rbac';

// User role management
export const getUserRoles = async (
  userId: string
): Promise<{ success: boolean; data: { userRoles: Role[] } }> => {
  try {
    const response = await apiClient.get(`/admin/users/${userId}/roles`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user roles:', error);
    throw error;
  }
};

export const assignUserRoles = async (data: {
  userIds: string[];
  roleIds: string[];
  workspaceId?: string;
  isTemporary?: boolean;
  expiresAt?: string;
  assignmentReason?: string;
}): Promise<{ success: boolean; message: string; data?: unknown }> => {
  try {
    const response = await apiClient.post(`/admin/users/assign-roles`, data);
    return response.data;
  } catch (error) {
    console.error('Error assigning user roles:', error);
    throw error;
  }
};

export const revokeUserRole = async (
  userId: string,
  roleId: string,
  workspaceId?: string,
  revocationReason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(
      `/admin/users/${userId}/roles/${roleId}`,
      {
        data: { workspaceId, revocationReason },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error revoking user role:', error);
    throw error;
  }
};

export const updateUserPermissions = async (
  userId: string,
  data: {
    directPermissions?: string[];
    deniedPermissions?: string[];
    replaceExisting?: boolean;
  }
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.put(
      `/admin/users/${userId}/permissions`,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error updating user permissions:', error);
    throw error;
  }
};

export const getUserEffectivePermissions = async (
  userId: string,
  workspaceId?: string,
  includeInherited?: boolean,
  includeRoleDetails?: boolean
): Promise<{ success: boolean; data: unknown }> => {
  try {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId);
    if (includeInherited !== undefined)
      params.append('includeInherited', includeInherited.toString());
    if (includeRoleDetails !== undefined)
      params.append('includeRoleDetails', includeRoleDetails.toString());

    const response = await apiClient.get(
      `/admin/users/${userId}/effective-permissions?${params}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching user effective permissions:', error);
    throw error;
  }
};

export const bulkUpdateUsers = async (
  updates: BulkUserUpdate[],
  dryRun?: boolean
): Promise<{ success: boolean; message: string; data?: unknown }> => {
  try {
    const response = await apiClient.post(`/admin/users/bulk-update`, {
      updates,
      dryRun,
    });
    return response.data;
  } catch (error) {
    console.error('Error in bulk user update:', error);
    throw error;
  }
};

export const checkUserPermission = async (
  userId: string,
  permission: string,
  context?: Record<string, unknown>
): Promise<{
  success: boolean;
  data: { allowed: boolean; source: string; reason: string };
}> => {
  try {
    const response = await apiClient.post(
      `/admin/users/${userId}/check-permission`,
      { permission, context }
    );
    return response.data;
  } catch (error) {
    console.error('Error checking user permission:', error);
    throw error;
  }
};

export const previewPermissionChanges = async (
  userId: string,
  data: {
    roleIds?: string[];
    directPermissions?: string[];
    deniedPermissions?: string[];
  }
): Promise<{ success: boolean; data: unknown }> => {
  try {
    const response = await apiClient.post(
      `/admin/users/${userId}/preview-permissions`,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error previewing permission changes:', error);
    throw error;
  }
};

export const detectRoleConflicts = async (
  userId: string,
  roleIds: string[]
): Promise<{ success: boolean; data: { conflicts: RoleConflict[] } }> => {
  try {
    const response = await apiClient.post(
      `/admin/users/${userId}/detect-conflicts`,
      { roleIds }
    );
    return response.data;
  } catch (error) {
    console.error('Error detecting role conflicts:', error);
    throw error;
  }
};

export const resolveRoleConflicts = async (
  userId: string,
  resolutions: RoleConflictResolution[]
): Promise<{ success: boolean; message: string; data?: unknown }> => {
  try {
    const response = await apiClient.post(
      `/admin/users/${userId}/resolve-conflicts`,
      { resolutions }
    );
    return response.data;
  } catch (error) {
    console.error('Error resolving role conflicts:', error);
    throw error;
  }
};

export const refreshUserPermissionCache = async (
  userId: string,
  workspaceId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(
      `/admin/users/${userId}/refresh-cache`,
      { workspaceId }
    );
    return response.data;
  } catch (error) {
    console.error('Error refreshing user permission cache:', error);
    throw error;
  }
};

// Admin management
export const getAllUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { users: DynamicUser[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/admin/users?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getUserById = async (
  userId: string
): Promise<{ success: boolean; data: { user: DynamicUser } }> => {
  try {
    const response = await apiClient.get(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;
  }
};

export const updateUserRole = async (
  userId: string,
  roleId: string,
  workspaceId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.put(`/admin/users/${userId}/role`, {
      roleId,
      workspaceId,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const suspendUser = async (
  userId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/admin/users/${userId}/suspend`, {
      reason,
    });
    return response.data;
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

export const reactivateUser = async (
  userId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/admin/users/${userId}/reactivate`);
    return response.data;
  } catch (error) {
    console.error('Error reactivating user:', error);
    throw error;
  }
};

export const bulkAssignRoles = async (
  userIds: string[],
  roleId: string,
  workspaceId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/admin/users/bulk-assign-roles`, {
      userIds,
      roleId,
      workspaceId,
    });
    return response.data;
  } catch (error) {
    console.error('Error in bulk role assignment:', error);
    throw error;
  }
};

export const bulkRevokeRoles = async (
  userIds: string[],
  roleId: string,
  workspaceId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/admin/users/bulk-revoke-roles`, {
      userIds,
      roleId,
      workspaceId,
    });
    return response.data;
  } catch (error) {
    console.error('Error in bulk role revocation:', error);
    throw error;
  }
};

export const getAllRoles = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { roles: Role[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/roles?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }
};

export const getAllPermissions = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  riskLevel?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { permissions: Permission[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/permissions?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching permissions:', error);
    throw error;
  }
};

export const getSystemStatistics = async (): Promise<{
  success: boolean;
  data: unknown;
}> => {
  try {
    const response = await apiClient.get(`/admin/statistics`);
    return response.data;
  } catch (error) {
    console.error('Error fetching system statistics:', error);
    throw error;
  }
};

export const getAuditLogs = async (params?: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { auditLogs: unknown[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/admin/audit-logs?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
};

export const getSystemHealth = async (): Promise<{
  success: boolean;
  data: unknown;
}> => {
  try {
    const response = await apiClient.get(`/admin/system-health`);
    return response.data;
  } catch (error) {
    console.error('Error fetching system health:', error);
    throw error;
  }
};

export const getSystemConfig = async (): Promise<{
  success: boolean;
  data: { config: SystemConfig };
}> => {
  try {
    const response = await apiClient.get(`/admin/system-config`);
    return response.data;
  } catch (error) {
    console.error('Error fetching system config:', error);
    throw error;
  }
};

export const updateSystemConfig = async (
  config: SystemConfig
): Promise<{
  success: boolean;
  message: string;
  data?: { config: SystemConfig };
}> => {
  try {
    const response = await apiClient.put(`/admin/system-config`, {
      config,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating system config:', error);
    throw error;
  }
};

export const getActivityLogs = async (params?: {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { activityLogs: unknown[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/admin/activity-logs?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
};

export const getSystemNotifications = async (params?: {
  page?: number;
  limit?: number;
  type?: string;
  priority?: string;
  isRead?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { notifications: unknown[]; unreadCount: number; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/admin/notifications?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching system notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (
  notificationId: string
): Promise<{
  success: boolean;
  message: string;
  data?: { notification: unknown };
}> => {
  try {
    const response = await apiClient.put(
      `/admin/notifications/${notificationId}/read`
    );
    return response.data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (): Promise<{
  success: boolean;
  message: string;
  data?: { count: number };
}> => {
  try {
    const response = await apiClient.put(`/admin/notifications/read-all`);
    return response.data;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteNotification = async (
  notificationId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(
      `/admin/notifications/${notificationId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

export const getBackupStatus = async (): Promise<{
  success: boolean;
  data: { backupStatus: unknown };
}> => {
  try {
    const response = await apiClient.get(`/admin/backup-status`);
    return response.data;
  } catch (error) {
    console.error('Error fetching backup status:', error);
    throw error;
  }
};

export const createBackup = async (): Promise<{
  success: boolean;
  message: string;
  data?: { backupId: string; status: string; estimatedDuration: string };
}> => {
  try {
    const response = await apiClient.post(`/admin/create-backup`);
    return response.data;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

export const getSecuritySettings = async (): Promise<{
  success: boolean;
  data: { securitySettings: SecuritySettings };
}> => {
  try {
    const response = await apiClient.get(`/admin/security-settings`);
    return response.data;
  } catch (error) {
    console.error('Error fetching security settings:', error);
    throw error;
  }
};

export const updateSecuritySettings = async (
  securitySettings: SecuritySettings
): Promise<{
  success: boolean;
  message: string;
  data?: { securitySettings: SecuritySettings };
}> => {
  try {
    const response = await apiClient.put(`/admin/security-settings`, {
      securitySettings,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating security settings:', error);
    throw error;
  }
};

export const getMaintenanceStatus = async (): Promise<{
  success: boolean;
  data: { maintenanceStatus: MaintenanceStatus };
}> => {
  try {
    const response = await apiClient.get(`/admin/maintenance-status`);
    return response.data;
  } catch (error) {
    console.error('Error fetching maintenance status:', error);
    throw error;
  }
};

export const updateMaintenanceStatus = async (
  maintenanceStatus: MaintenanceStatus
): Promise<{
  success: boolean;
  message: string;
  data?: { maintenanceStatus: MaintenanceStatus };
}> => {
  try {
    const response = await apiClient.put(`/admin/maintenance-status`, {
      maintenanceStatus,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating maintenance status:', error);
    throw error;
  }
};

export const getApiKeys = async (): Promise<{
  success: boolean;
  data: { apiKeys: ApiKey[] };
}> => {
  try {
    const response = await apiClient.get(`/admin/api-keys`);
    return response.data;
  } catch (error) {
    console.error('Error fetching API keys:', error);
    throw error;
  }
};

export const createApiKey = async (data: {
  name: string;
  permissions: string[];
  expiresAt?: string;
}): Promise<{
  success: boolean;
  message: string;
  data?: { apiKey: ApiKey };
}> => {
  try {
    const response = await apiClient.post(`/admin/api-keys`, data);
    return response.data;
  } catch (error) {
    console.error('Error creating API key:', error);
    throw error;
  }
};

export const revokeApiKey = async (
  apiKeyId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(`/admin/api-keys/${apiKeyId}`);
    return response.data;
  } catch (error) {
    console.error('Error revoking API key:', error);
    throw error;
  }
};

export const getPendingLicenses = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { licenses: unknown[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(
      `/admin/licenses/pending?${queryParams}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching pending licenses:', error);
    throw error;
  }
};

export const approveLicense = async (
  userId: string,
  expirationDate?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/admin/licenses/${userId}/approve`, {
      expirationDate,
      notes,
    });
    return response.data;
  } catch (error) {
    console.error('Error approving license:', error);
    throw error;
  }
};

export const rejectLicense = async (
  userId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/admin/licenses/${userId}/reject`, {
      reason,
    });
    return response.data;
  } catch (error) {
    console.error('Error rejecting license:', error);
    throw error;
  }
};

export const getAllFeatureFlags = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { featureFlags: FeatureFlag[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/admin/feature-flags?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    throw error;
  }
};

export const createFeatureFlag = async (data: {
  name: string;
  description?: string;
  isActive?: boolean;
  conditions?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  message: string;
  data?: { featureFlag: FeatureFlag };
}> => {
  try {
    const response = await apiClient.post(`/admin/feature-flags`, data);
    return response.data;
  } catch (error) {
    console.error('Error creating feature flag:', error);
    throw error;
  }
};

export const updateFeatureFlag = async (
  flagId: string,
  data: {
    name?: string;
    description?: string;
    isActive?: boolean;
    conditions?: Record<string, unknown>;
  }
): Promise<{
  success: boolean;
  message: string;
  data?: { featureFlag: FeatureFlag };
}> => {
  try {
    const response = await apiClient.put(
      `/admin/feature-flags/${flagId}`,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error updating feature flag:', error);
    throw error;
  }
};

export const getSystemAnalytics = async (
  period?: string
): Promise<{ success: boolean; data: SystemAnalytics }> => {
  try {
    const params = new URLSearchParams();
    if (period) params.append('period', period);

    const response = await apiClient.get(`/admin/analytics?${params}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching system analytics:', error);
    throw error;
  }
};

// Role Hierarchy Management
export const getRoleHierarchyTree = async (): Promise<{
  success: boolean;
  data: any;
}> => {
  try {
    const response = await apiClient.get(`/role-hierarchy/hierarchy-tree`);
    return response.data;
  } catch (error) {
    console.error('Error fetching role hierarchy tree:', error);
    throw error;
  }
};

export const getRoleHierarchy = async (
  roleId: string
): Promise<{ success: boolean; data: any }> => {
  try {
    const response = await apiClient.get(`/role-hierarchy/${roleId}/hierarchy`);
    return response.data;
  } catch (error) {
    console.error('Error fetching role hierarchy:', error);
    throw error;
  }
};

export const addChildRoles = async (
  roleId: string,
  childRoleIds: string[]
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(
      `/role-hierarchy/${roleId}/children`,
      { childRoleIds }
    );
    return response.data;
  } catch (error) {
    console.error('Error adding child roles:', error);
    throw error;
  }
};

export const removeChildRole = async (
  roleId: string,
  childId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(
      `/role-hierarchy/${roleId}/children/${childId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error removing child role:', error);
    throw error;
  }
};

export const changeParentRole = async (
  roleId: string,
  newParentId: string | null
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.put(`/role-hierarchy/${roleId}/parent`, {
      newParentId,
    });
    return response.data;
  } catch (error) {
    console.error('Error changing parent role:', error);
    throw error;
  }
};

export const validateRoleHierarchy = async (data: {
  roleId: string;
  newParentId?: string;
  childRoleIds?: string[];
}): Promise<{ success: boolean; data: any }> => {
  try {
    const response = await apiClient.post(
      `/role-hierarchy/hierarchy/validate`,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error validating role hierarchy:', error);
    throw error;
  }
};

// Permission Management
export const getPermissionMatrix = async (params?: {
  category?: string;
  includeInactive?: boolean;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(`/workspace/rbac/permission-matrix?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching permission matrix:', error);
    throw error;
  }
};

export const getPermissionCategories = async (): Promise<{
  success: boolean;
  data: any;
}> => {
  try {
    const response = await apiClient.get(`/workspace/rbac/permissions/categories`);
    return response.data;
  } catch (error) {
    console.error('Error fetching permission categories:', error);
    throw error;
  }
};

export const getPermissionDependencies = async (params?: {
  action?: string;
  includeReverse?: boolean;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(
      `/permissions/dependencies?${queryParams}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching permission dependencies:', error);
    throw error;
  }
};

export const getPermissionUsage = async (
  action: string
): Promise<{ success: boolean; data: any }> => {
  try {
    const response = await apiClient.get(`/permissions/${action}/usage`);
    return response.data;
  } catch (error) {
    console.error('Error fetching permission usage:', error);
    throw error;
  }
};

export const validatePermissions = async (data: {
  permissions: string[];
  context?: Record<string, any>;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const response = await apiClient.post(`/permissions/validate`, data);
    return response.data;
  } catch (error) {
    console.error('Error validating permissions:', error);
    throw error;
  }
};

export const createPermission = async (data: {
  action: string;
  displayName: string;
  description?: string;
  category?: string;
  dependencies?: string[];
}): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const response = await apiClient.post(`/permissions`, data);
    return response.data;
  } catch (error) {
    console.error('Error creating permission:', error);
    throw error;
  }
};

export const updatePermission = async (
  action: string,
  data: {
    displayName?: string;
    description?: string;
    category?: string;
    dependencies?: string[];
    isActive?: boolean;
  }
): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const response = await apiClient.put(`/permissions/${action}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating permission:', error);
    throw error;
  }
};

// Role Management
export const createRole = async (data: {
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  permissions?: string[];
  parentRole?: string;
}): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const response = await apiClient.post(`/roles`, data);
    return response.data;
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
};

export const getRoleById = async (
  roleId: string
): Promise<{ success: boolean; data: any }> => {
  try {
    const response = await apiClient.get(`/roles/${roleId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching role:', error);
    throw error;
  }
};

export const updateRole = async (
  roleId: string,
  data: {
    displayName?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
  }
): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const response = await apiClient.put(`/roles/${roleId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
};

export const deleteRole = async (
  roleId: string,
  options?: { force?: boolean; reassignRoleId?: string }
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(`/roles/${roleId}`, {
      data: options,
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
};

export const getRolePermissions = async (
  roleId: string
): Promise<{ success: boolean; data: any }> => {
  try {
    const response = await apiClient.get(`/roles/${roleId}/permissions`);
    return response.data;
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    throw error;
  }
};

// RBAC Audit Functions
export const getAuditDashboard = async (params?: {
  timeRange?: string;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(`/rbac-audit/dashboard?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching audit dashboard:', error);
    throw error;
  }
};

export const getRBACDetailedAuditLogs = async (params?: {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(`/rbac-audit/logs?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching RBAC audit logs:', error);
    throw error;
  }
};

export const getUserAuditTrail = async (
  userId: string,
  params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(
      `/rbac-audit/users/${userId}/trail?${queryParams}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching user audit trail:', error);
    throw error;
  }
};

export const getRoleAuditTrail = async (
  roleId: string,
  params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(
      `/rbac-audit/roles/${roleId}/trail?${queryParams}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching role audit trail:', error);
    throw error;
  }
};

export const exportAuditLogs = async (params?: {
  format?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(`/rbac-audit/export?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    throw error;
  }
};

export const getComplianceReport = async (params?: {
  reportType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(
      `/rbac-audit/compliance?${queryParams}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching compliance report:', error);
    throw error;
  }
};

export const getSecurityAlerts = async (params?: {
  page?: number;
  limit?: number;
  severity?: string;
  status?: string;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(
      `/rbac-audit/security-alerts?${queryParams}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    throw error;
  }
};

export const resolveSecurityAlert = async (
  alertId: string,
  resolution: {
    action: string;
    notes?: string;
  }
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(
      `/rbac-audit/security-alerts/${alertId}/resolve`,
      resolution
    );
    return response.data;
  } catch (error) {
    console.error('Error resolving security alert:', error);
    throw error;
  }
};

export const getAuditStatistics = async (params?: {
  timeRange?: string;
}): Promise<{ success: boolean; data: any }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const response = await apiClient.get(
      `/rbac-audit/statistics?${queryParams}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    throw error;
  }
};

// Alias for getRBACStatistics (used by RBAC Management page)
export const getRBACStatistics = getAuditStatistics;

// Permission Usage Analytics
export const getPermissionUsageAnalytics = async (): Promise<{
  success: boolean;
  data: any;
}> => {
  try {
    const response = await apiClient.get(`/workspace/rbac/permissions/usage-analytics`);
    return response.data;
  } catch (error) {
    console.error('Error fetching permission usage analytics:', error);
    throw error;
  }
};

// Update Permission Matrix
export const updatePermissionMatrix = async (
  roleId: string,
  permissions: Record<string, boolean>
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.put(`/roles/${roleId}/permissions-matrix`, {
      permissions,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating permission matrix:', error);
    throw error;
  }
};

// Export Role Assignments
export const exportRoleAssignments = async (
  format: string = 'csv'
): Promise<Blob> => {
  try {
    const response = await apiClient.get(`/roles/export?format=${format}`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting role assignments:', error);
    throw error;
  }
};

// ==================== WORKSPACE-SCOPED RBAC FUNCTIONS ====================
// These functions are for workspace owners to manage roles and permissions
// within their workspace

/**
 * Get all roles in the workspace
 */
export const getWorkspaceRoles = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{
  success: boolean;
  data: { roles: Role[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/workspace/rbac/roles?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching workspace roles:', error);
    throw error;
  }
};

/**
 * Get a single role by ID
 */
export const getWorkspaceRoleById = async (
  roleId: string
): Promise<{ success: boolean; data: { role: Role } }> => {
  try {
    const response = await apiClient.get(`/workspace/rbac/roles/${roleId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching workspace role:', error);
    throw error;
  }
};

/**
 * Create a new custom role in workspace
 */
export const createWorkspaceRole = async (data: {
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  parentRoleId?: string;
}): Promise<{ success: boolean; message: string; data: { role: Role } }> => {
  try {
    const response = await apiClient.post('/workspace/rbac/roles', data);
    return response.data;
  } catch (error) {
    console.error('Error creating workspace role:', error);
    throw error;
  }
};

/**
 * Update an existing role
 */
export const updateWorkspaceRole = async (
  roleId: string,
  data: {
    displayName?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
  }
): Promise<{ success: boolean; message: string; data: { role: Role } }> => {
  try {
    const response = await apiClient.put(`/workspace/rbac/roles/${roleId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating workspace role:', error);
    throw error;
  }
};

/**
 * Delete a custom role
 */
export const deleteWorkspaceRole = async (
  roleId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(`/workspace/rbac/roles/${roleId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting workspace role:', error);
    throw error;
  }
};

/**
 * Clone an existing role
 */
export const cloneWorkspaceRole = async (
  roleId: string,
  data: {
    newName: string;
    newDisplayName: string;
    newDescription?: string;
  }
): Promise<{ success: boolean; message: string; data: { role: Role } }> => {
  try {
    const response = await apiClient.post(`/workspace/rbac/roles/${roleId}/clone`, data);
    return response.data;
  } catch (error) {
    console.error('Error cloning workspace role:', error);
    throw error;
  }
};

/**
 * Get workspace permissions
 */
export const getWorkspacePermissions = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  riskLevel?: string;
}): Promise<{
  success: boolean;
  data: { permissions: Permission[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/workspace/rbac/permissions?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching workspace permissions:', error);
    throw error;
  }
};

/**
 * Get permission matrix grouped by categories
 */
export const getWorkspacePermissionMatrix = async (): Promise<{
  success: boolean;
  data: {
    matrix: Record<string, Permission[]>;
    categories: string[];
    totalPermissions: number;
  };
}> => {
  try {
    const response = await apiClient.get('/workspace/rbac/permission-matrix');
    return response.data;
  } catch (error) {
    console.error('Error fetching workspace permission matrix:', error);
    throw error;
  }
};

/**
 * Get permission categories
 */
export const getWorkspacePermissionCategories = async (): Promise<{
  success: boolean;
  data: { categories: string[] };
}> => {
  try {
    const response = await apiClient.get('/workspace/rbac/permissions/categories');
    return response.data;
  } catch (error) {
    console.error('Error fetching permission categories:', error);
    throw error;
  }
};

/**
 * Get team members with their roles
 */
export const getWorkspaceTeamMembers = async (): Promise<{
  success: boolean;
  data: { teamMembers: any[] };
}> => {
  try {
    const response = await apiClient.get('/workspace/rbac/team-members');
    return response.data;
  } catch (error) {
    console.error('Error fetching workspace team members:', error);
    throw error;
  }
};

/**
 * Assign role to team member
 */
export const assignRoleToTeamMember = async (
  userId: string,
  roleId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(
      `/workspace/rbac/team-members/${userId}/assign-role`,
      { roleId, reason }
    );
    return response.data;
  } catch (error) {
    console.error('Error assigning role to team member:', error);
    throw error;
  }
};

/**
 * Revoke role from team member
 */
export const revokeRoleFromTeamMember = async (
  userId: string,
  roleId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(
      `/workspace/rbac/team-members/${userId}/roles/${roleId}`,
      { data: { reason } }
    );
    return response.data;
  } catch (error) {
    console.error('Error revoking role from team member:', error);
    throw error;
  }
};

/**
 * Get team member's effective permissions
 */
export const getTeamMemberPermissions = async (
  userId: string
): Promise<{
  success: boolean;
  data: { permissions: string[]; roleDetails: any[] };
}> => {
  try {
    const response = await apiClient.get(
      `/workspace/rbac/team-members/${userId}/permissions`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching team member permissions:', error);
    throw error;
  }
};

/**
 * Get pending permission requests
 */
export const getPermissionRequests = async (): Promise<{
  success: boolean;
  data: { requests: any[] };
}> => {
  try {
    const response = await apiClient.get('/workspace/rbac/permission-requests');
    return response.data;
  } catch (error) {
    console.error('Error fetching permission requests:', error);
    throw error;
  }
};

/**
 * Approve permission request
 */
export const approvePermissionRequest = async (
  requestId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(
      `/workspace/rbac/permission-requests/${requestId}/approve`
    );
    return response.data;
  } catch (error) {
    console.error('Error approving permission request:', error);
    throw error;
  }
};

/**
 * Reject permission request
 */
export const rejectPermissionRequest = async (
  requestId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(
      `/workspace/rbac/permission-requests/${requestId}/reject`,
      { reason }
    );
    return response.data;
  } catch (error) {
    console.error('Error rejecting permission request:', error);
    throw error;
  }
};

/**
 * Get RBAC audit logs
 */
export const getWorkspaceAuditLogs = async (params?: {
  page?: number;
  limit?: number;
  action?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  success: boolean;
  data: { logs: any[]; pagination: unknown };
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }

    const response = await apiClient.get(`/workspace/rbac/audit-logs?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching workspace audit logs:', error);
    throw error;
  }
};

/**
 * Get RBAC statistics
 */
export const getWorkspaceRBACStatistics = async (): Promise<{
  success: boolean;
  data: {
    totalRoles: number;
    activeRoles: number;
    customRoles: number;
    systemRoles: number;
    totalMembers: number;
    roleAssignments: number;
  };
}> => {
  try {
    const response = await apiClient.get('/workspace/rbac/statistics');
    return response.data;
  } catch (error) {
    console.error('Error fetching workspace RBAC statistics:', error);
    throw error;
  }
};
