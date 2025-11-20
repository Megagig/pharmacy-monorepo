import { api as apiClient } from '../lib/api';

// Types for SaaS Settings
export interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  activeSubscriptions: number;
  totalWorkspaces: number;
  monthlyRevenue: number;
  systemUptime: string;
  activeFeatureFlags: number;
  pendingLicenses: number;
  supportTickets: {
    open: number;
    resolved: number;
    critical: number;
  };
}

export interface SystemHealth {
  database: HealthStatus;
  api: HealthStatus;
  memory: HealthStatus;
  cache: HealthStatus;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  value: string | number;
  threshold?: number;
  message?: string;
}

export interface Activity {
  id: string;
  type: 'user_registration' | 'feature_flag_change' | 'license_approval' | 'system_alert';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  workspaceId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedUsers {
  users: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: UserFilters;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
}

export interface ImpersonationSession {
  sessionToken: string;
  expiresAt: Date;
  targetUser: any;
}

export interface FeatureFlagTargeting {
  pharmacies?: string[];
  userGroups?: string[];
  subscriptionPlans?: string[];
  percentage?: number;
}

export interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number;
    preventReuse: number;
  };
  sessionSettings: {
    maxDuration: number;
    idleTimeout: number;
    maxConcurrentSessions: number;
  };
  accountLockout: {
    maxFailedAttempts: number;
    lockoutDuration: number;
    autoUnlock: boolean;
  };
  twoFactorAuth: {
    enforced: boolean;
    methods: string[];
    gracePeriod: number;
  };
}

export interface UserSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  loginTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

/**
 * SaaS Service - Handles all SaaS Settings API calls
 */
class SaaSService {
  private baseUrl = '/admin/saas';

  // System Overview APIs
  async getSystemMetrics(): Promise<SystemMetrics> {
    const response = await apiClient.get(`${this.baseUrl}/overview/metrics`);
    return response.data.data;
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const response = await apiClient.get(`${this.baseUrl}/overview/health`);
    return response.data.data;
  }

  async getRecentActivities(): Promise<Activity[]> {
    const response = await apiClient.get(`${this.baseUrl}/overview/activities`);
    return response.data.data.activities || [];
  }

  // User Management APIs
  async getUsers(filters: UserFilters = {}, pagination: Pagination = { page: 1, limit: 20 }): Promise<PaginatedUsers> {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      ...filters,
    });
    
    const response = await apiClient.get(`${this.baseUrl}/users?${params}`);
    return response.data.data;
  }

  async updateUserRole(userId: string, roleId: string, workspaceId?: string): Promise<void> {
    await apiClient.put(`${this.baseUrl}/users/${userId}/role`, {
      roleId,
      workspaceId,
    });
  }

  async suspendUser(userId: string, reason: string): Promise<void> {
    await apiClient.put(`${this.baseUrl}/users/${userId}/suspend`, { reason });
  }

  async reactivateUser(userId: string): Promise<void> {
    await apiClient.put(`${this.baseUrl}/users/${userId}/reactivate`);
  }

  async bulkAssignRoles(userIds: string[], roleId: string): Promise<BulkOperationResult> {
    const response = await apiClient.post(`${this.baseUrl}/users/bulk/assign-roles`, {
      userIds,
      roleId,
    });
    return response.data.data;
  }

  async impersonateUser(targetUserId: string): Promise<ImpersonationSession> {
    const response = await apiClient.post(`${this.baseUrl}/users/${targetUserId}/impersonate`);
    return response.data.data;
  }

  async approveUser(userId: string): Promise<void> {
    await apiClient.put(`${this.baseUrl}/users/${userId}/approve`);
  }

  async rejectUser(userId: string, reason?: string): Promise<void> {
    await apiClient.put(`${this.baseUrl}/users/${userId}/reject`, { reason });
  }

  async bulkApproveUsers(userIds: string[]): Promise<BulkOperationResult> {
    const response = await apiClient.post(`${this.baseUrl}/users/bulk-approve`, { userIds });
    return response.data.data;
  }

  async bulkRejectUsers(userIds: string[], reason?: string): Promise<BulkOperationResult> {
    const response = await apiClient.post(`${this.baseUrl}/users/bulk-reject`, { userIds, reason });
    return response.data.data;
  }

  async bulkSuspendUsers(userIds: string[], reason: string): Promise<BulkOperationResult> {
    const response = await apiClient.post(`${this.baseUrl}/users/bulk-suspend`, { userIds, reason });
    return response.data.data;
  }

  async createUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: string;
    workplaceId?: string;
    phone?: string;
  }): Promise<any> {
    const response = await apiClient.post(`${this.baseUrl}/users`, userData);
    return response.data.data;
  }

  // Feature Flags APIs
  async getFeatureFlags(): Promise<any[]> {
    const response = await apiClient.get(`${this.baseUrl}/feature-flags`);
    return response.data.data.featureFlags || [];
  }

  async updateFeatureFlagTargeting(flagId: string, targeting: FeatureFlagTargeting): Promise<void> {
    await apiClient.put(`${this.baseUrl}/feature-flags/${flagId}/targeting`, {
      targetingRules: targeting,
    });
  }

  async getFeatureFlagUsageMetrics(flagId: string): Promise<any> {
    const response = await apiClient.get(`${this.baseUrl}/feature-flags/${flagId}/usage-metrics`);
    return response.data.data;
  }

  // Security APIs
  async getSecuritySettings(): Promise<{ success: boolean; data: { settings: SecuritySettings } }> {
    const response = await apiClient.get(`${this.baseUrl}/security/settings`);
    return response.data;
  }

  async updatePasswordPolicy(policy: SecuritySettings['passwordPolicy']): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/security/password-policy`, policy);
    return response.data;
  }

  async updateAccountLockout(lockout: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/security/account-lockout`, lockout);
    return response.data;
  }

  async getActiveSessions(filters: any = {}): Promise<{ success: boolean; data: { sessions: UserSession[] } }> {
    // Filter out empty values
    const cleanFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    const params = new URLSearchParams(cleanFilters);
    const response = await apiClient.get(`${this.baseUrl}/security/sessions?${params}`);
    return response.data;
  }

  async terminateSession(sessionId: string, data: { reason?: string } = {}): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`${this.baseUrl}/security/sessions/${sessionId}`, { data });
    return response.data;
  }

  async getSecurityAuditLogs(filters: any = {}): Promise<{ success: boolean; data: { auditLogs: any[] } }> {
    // Filter out empty values
    const cleanFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    const params = new URLSearchParams(cleanFilters);
    const response = await apiClient.get(`${this.baseUrl}/security/audit-logs?${params}`);
    return response.data;
  }

  async lockUserAccount(userId: string, data: { reason: string }): Promise<{ success: boolean }> {
    const response = await apiClient.post(`${this.baseUrl}/security/users/${userId}/lock`, data);
    return response.data;
  }

  async unlockUserAccount(userId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(`${this.baseUrl}/security/users/${userId}/unlock`);
    return response.data;
  }

  async getSecurityDashboard(timeRange: string = '24h'): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.get(`${this.baseUrl}/security/dashboard?timeRange=${timeRange}`);
    return response.data;
  }

  // Analytics APIs
  async getSubscriptionAnalytics(params: { timeRange: string }): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.get(`${this.baseUrl}/analytics/subscriptions?timeRange=${params.timeRange}`);
    return response.data;
  }

  async getPharmacyUsageReports(params: { timeRange: string }): Promise<{ success: boolean; data: { reports: any[] } }> {
    const response = await apiClient.get(`${this.baseUrl}/analytics/pharmacy-usage?timeRange=${params.timeRange}`);
    return response.data;
  }

  async getClinicalOutcomesReport(params: { timeRange: string }): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.get(`${this.baseUrl}/analytics/clinical-outcomes?timeRange=${params.timeRange}`);
    return response.data;
  }

  async exportReport(options: any): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.post(`${this.baseUrl}/analytics/export`, options, {
      responseType: 'blob',
    });
    return { success: true, data: response.data };
  }

  async scheduleReport(options: any): Promise<{ success: boolean }> {
    const response = await apiClient.post(`${this.baseUrl}/analytics/schedule`, options);
    return response.data;
  }

  // Notifications APIs
  async getNotificationChannels(): Promise<{ success: boolean; data: { channels: any[] } }> {
    const response = await apiClient.get(`${this.baseUrl}/notifications/channels`);
    return response.data;
  }

  async updateNotificationChannel(channelId: string, data: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/notifications/channels/${channelId}`, data);
    return response.data;
  }

  async getNotificationRules(): Promise<{ success: boolean; data: { rules: any[] } }> {
    const response = await apiClient.get(`${this.baseUrl}/notifications/rules`);
    return response.data;
  }

  async createNotificationRule(data: any): Promise<{ success: boolean }> {
    const response = await apiClient.post(`${this.baseUrl}/notifications/rules`, data);
    return response.data;
  }

  async updateNotificationRule(ruleId: string, data: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/notifications/rules/${ruleId}`, data);
    return response.data;
  }

  async deleteNotificationRule(ruleId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`${this.baseUrl}/notifications/rules/${ruleId}`);
    return response.data;
  }

  async toggleNotificationRule(ruleId: string, data: { isActive: boolean }): Promise<{ success: boolean }> {
    const response = await apiClient.patch(`${this.baseUrl}/notifications/rules/${ruleId}/toggle`, data);
    return response.data;
  }

  async getNotificationTemplates(): Promise<{ success: boolean; data: { templates: any[] } }> {
    const response = await apiClient.get(`${this.baseUrl}/notifications/templates`);
    return response.data;
  }

  async createNotificationTemplate(data: any): Promise<{ success: boolean }> {
    const response = await apiClient.post(`${this.baseUrl}/notifications/templates`, data);
    return response.data;
  }

  async updateNotificationTemplate(templateId: string, data: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/notifications/templates/${templateId}`, data);
    return response.data;
  }

  async deleteNotificationTemplate(templateId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`${this.baseUrl}/notifications/templates/${templateId}`);
    return response.data;
  }

  async getNotificationHistory(filters: any = {}): Promise<{ success: boolean; data: { history: any[] } }> {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`${this.baseUrl}/notifications/history?${params}`);
    return response.data;
  }

  async sendTestNotification(data: any): Promise<{ success: boolean }> {
    const response = await apiClient.post(`${this.baseUrl}/notifications/test`, data);
    return response.data;
  }

  // Audit APIs
  async getAuditLogs(filters: any = {}): Promise<{ success: boolean; data: any }> {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`${this.baseUrl}/audit/logs?${params}`);
    return response.data;
  }

  async getAuditSummary(timeRange: string = '30d'): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.get(`${this.baseUrl}/audit/summary?timeRange=${timeRange}`);
    return response.data;
  }

  async generateComplianceReport(options: any): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.post(`${this.baseUrl}/audit/compliance-report`, options);
    return response.data;
  }

  async reviewAuditLog(logId: string, data: { resolution: string; notes?: string }): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/audit/logs/${logId}/review`, data);
    return response.data;
  }

  async getFlaggedAuditLogs(limit: number = 50): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.get(`${this.baseUrl}/audit/flagged?limit=${limit}`);
    return response.data;
  }

  async exportAuditLogs(options: any): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.post(`${this.baseUrl}/audit/export`, options, {
      responseType: 'blob',
    });
    return { success: true, data: response.data };
  }

  // Tenant Management APIs
  async getTenants(filters: any = {}): Promise<{ success: boolean; data: { tenants: any[]; pagination: any } }> {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants?${params}`);
    return response.data;
  }

  async getTenantById(tenantId: string, options: any = {}): Promise<{ success: boolean; data: { tenant: any } }> {
    const params = new URLSearchParams(options);
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}?${params}`);
    return response.data;
  }

  async getTenantCustomization(tenantId: string): Promise<{ success: boolean; customization: any }> {
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}/customization`);
    return response.data.data;
  }

  async updateTenantBranding(tenantId: string, branding: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/tenant-management/tenants/${tenantId}/branding`, branding);
    return response.data;
  }

  async updateTenantLimits(tenantId: string, limits: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/tenant-management/tenants/${tenantId}/limits`, limits);
    return response.data;
  }

  async updateTenantFeatures(tenantId: string, features: string[]): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/tenant-management/tenants/${tenantId}/features`, { features });
    return response.data;
  }

  async updateTenantCustomization(tenantId: string, customization: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/tenant-management/tenants/${tenantId}/customization`, customization);
    return response.data;
  }



  async deprovisionTenant(tenantId: string, options: any = {}): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`${this.baseUrl}/tenant-management/tenants/${tenantId}`, { data: options });
    return response.data;
  }

  async updateTenantStatus(tenantId: string, statusUpdate: any): Promise<{ success: boolean }> {
    const response = await apiClient.put(`${this.baseUrl}/tenant-management/tenants/${tenantId}/status`, statusUpdate);
    return response.data;
  }

  async getTenantStatistics(): Promise<{ success: boolean; data: { statistics: any } }> {
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/statistics`);
    return response.data;
  }

  async validateTenantDataIsolation(tenantId: string): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}/data-isolation/validate`);
    return response.data;
  }

  async enforceTenantDataIsolation(tenantId: string): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.post(`${this.baseUrl}/tenant-management/tenants/${tenantId}/data-isolation/enforce`);
    return response.data;
  }

  async getTenantAnalytics(tenantId: string, timeRange: string = '30d'): Promise<{ success: boolean; data: { analytics: any } }> {
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}/analytics?timeRange=${timeRange}`);
    return response.data;
  }

  async getTenantPerformanceMetrics(tenantId: string): Promise<{ success: boolean; data: { metrics: any } }> {
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}/performance`);
    return response.data;
  }

  async getTenantBillingAnalytics(tenantId: string, timeRange: string = '30d'): Promise<{ success: boolean; data: { billingAnalytics: any } }> {
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}/billing-analytics?timeRange=${timeRange}`);
    return response.data;
  }

  async provisionTenant(tenantData: any): Promise<{ success: boolean; data: { tenant: any; message: string } }> {
    const response = await apiClient.post(`${this.baseUrl}/tenant-management/tenants`, tenantData);
    return response.data;
  }

  async getAvailableSubscriptionPlans(billingPeriod?: 'monthly' | 'yearly'): Promise<{ success: boolean; data: { plans: any[] } }> {
    const params = billingPeriod ? `?billingPeriod=${billingPeriod}` : '';
    const response = await apiClient.get(`/pricing/plans${params}`);
    return response.data;
  }

  // Subscription Management APIs
  async getTenantSubscription(tenantId: string): Promise<{ success: boolean; data: { subscription: any } }> {
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}/subscription`);
    return response.data;
  }

  async updateTenantSubscription(tenantId: string, update: {
    action: 'upgrade' | 'downgrade' | 'revoke';
    planId?: string;
    reason?: string;
  }): Promise<{ success: boolean; data: { subscription: any; message: string } }> {
    const response = await apiClient.put(`${this.baseUrl}/tenant-management/tenants/${tenantId}/subscription`, update);
    return response.data;
  }

  // Workspace Member Management APIs
  async getWorkspaceMembers(tenantId: string, options: { page?: number; limit?: number } = {}): Promise<{
    success: boolean;
    data: {
      members: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
  }> {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 20).toString(),
    });
    const response = await apiClient.get(`${this.baseUrl}/tenant-management/tenants/${tenantId}/members?${params}`);
    return response.data;
  }

  async inviteWorkspaceMember(tenantId: string, memberData: {
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  }): Promise<{ success: boolean; data: { invitation: any; message: string } }> {
    const response = await apiClient.post(`${this.baseUrl}/tenant-management/tenants/${tenantId}/members/invite`, memberData);
    return response.data;
  }

  async updateMemberRole(tenantId: string, memberId: string, role: string): Promise<{
    success: boolean;
    data: { member: any; message: string };
  }> {
    const response = await apiClient.put(`${this.baseUrl}/tenant-management/tenants/${tenantId}/members/${memberId}/role`, { role });
    return response.data;
  }

  async removeMember(tenantId: string, memberId: string, reason?: string): Promise<{
    success: boolean;
    data: { message: string };
  }> {
    const response = await apiClient.delete(`${this.baseUrl}/tenant-management/tenants/${tenantId}/members/${memberId}`, {
      data: { reason }
    });
    return response.data;
  }
}

export const saasService = new SaaSService();
export default saasService;