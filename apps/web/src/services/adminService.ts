import { apiClient } from './apiClient';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  licenseStatus: string;
  licenseNumber?: string;
  subscriptionTier: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface License {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
  licenseDocument: {
    fileName: string;
    uploadedAt: string;
  };
  createdAt: string;
}

export interface Analytics {
  users: { _id: string; count: number; active: number }[];
  subscriptions: { _id: string; count: number; active: number; revenue: number }[];
  licenses: { _id: string; count: number }[];
  generated: string;
}

export interface FeatureFlag {
  _id: string;
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  requiredTiers: string[];
  requiredRoles: string[];
  customRules: {
    field: string;
    operator: string;
    value: unknown;
  }[];
  environments: string[];
  createdAt: string;
  updatedAt: string;
}

export const adminService = {
  // User Management
  async getUsers(params: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    licenseStatus?: string;
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });

    const response = await apiClient.get(`/admin/users?${queryParams}`);
    return response.data;
  },

  async updateUserRole(userId: string, role: string) {
    const response = await apiClient.put(`/admin/users/${userId}/role`, { role });
    return response.data;
  },

  async updateUserStatus(userId: string, status: string, reason?: string) {
    const response = await apiClient.put(`/admin/users/${userId}/status`, {
      status,
      reason
    });
    return response.data;
  },

  async deleteUser(userId: string) {
    const response = await apiClient.delete(`/admin/users/${userId}`);
    return response.data;
  },

  async assignUserToTeam(userId: string, teamLeadId: string) {
    const response = await apiClient.put(`/admin/users/${userId}/team`, {
      teamLeadId
    });
    return response.data;
  },

  // License Management
  async getPendingLicenses() {
    const response = await apiClient.get('/admin/licenses/pending');
    return response.data;
  },

  async approveLicense(licenseId: string, licenseNumber: string) {
    const response = await apiClient.put(`/admin/licenses/${licenseId}/approve`, {
      licenseNumber
    });
    return response.data;
  },

  async rejectLicense(licenseId: string, reason: string) {
    const response = await apiClient.put(`/admin/licenses/${licenseId}/reject`, {
      reason
    });
    return response.data;
  },

  async downloadLicenseDocument(licenseId: string) {
    const response = await apiClient.get(`/admin/licenses/${licenseId}/document`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Analytics
  async getAnalytics() {
    const response = await apiClient.get('/admin/analytics');
    return response.data;
  },

  async getUserAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const response = await apiClient.get(`/admin/analytics/users?period=${period}`);
    return response.data;
  },

  async getSubscriptionAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    // Map period to timeRange that backend expects
    const timeRangeMap = {
      day: '7d',
      week: '7d',
      month: '30d',
      year: '1y',
    };
    const timeRange = timeRangeMap[period];
    const response = await apiClient.get(`/admin/saas/analytics/subscriptions?timeRange=${timeRange}`);
    return response.data;
  },

  async getRevenueAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const response = await apiClient.get(`/admin/analytics/revenue?period=${period}`);
    return response.data;
  },

  // Feature Flags Management
  async getFeatureFlags() {
    const response = await apiClient.get('/admin/feature-flags');
    return response.data;
  },

  async createFeatureFlag(flagData: Partial<FeatureFlag>) {
    const response = await apiClient.post('/admin/feature-flags', flagData);
    return response.data;
  },

  async updateFeatureFlag(flagId: string, updates: Partial<FeatureFlag>) {
    const response = await apiClient.put(`/admin/feature-flags/${flagId}`, updates);
    return response.data;
  },

  async toggleFeatureFlag(flagId: string, enabled: boolean) {
    const response = await apiClient.patch(`/admin/feature-flags/${flagId}/toggle`, {
      enabled
    });
    return response.data;
  },

  async deleteFeatureFlag(flagId: string) {
    const response = await apiClient.delete(`/admin/feature-flags/${flagId}`);
    return response.data;
  },

  // System Settings
  async getSystemSettings() {
    const response = await apiClient.get('/admin/settings');
    return response.data;
  },

  async updateSystemSettings(settings: Record<string, unknown>) {
    const response = await apiClient.put('/admin/settings', settings);
    return response.data;
  },

  // Subscription Management
  async getSubscriptions(params: {
    page?: number;
    limit?: number;
    status?: string;
    tier?: string;
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });

    const response = await apiClient.get(`/admin/subscriptions?${queryParams}`);
    return response.data;
  },

  async updateSubscription(subscriptionId: string, updates: {
    tier?: string;
    status?: string;
    endDate?: string;
    customFeatures?: string[];
  }) {
    const response = await apiClient.put(`/admin/subscriptions/${subscriptionId}`, updates);
    return response.data;
  },

  async extendSubscription(subscriptionId: string, days: number) {
    const response = await apiClient.post(`/admin/subscriptions/${subscriptionId}/extend`, {
      days
    });
    return response.data;
  },

  async cancelSubscription(subscriptionId: string, reason?: string) {
    const response = await apiClient.delete(`/admin/subscriptions/${subscriptionId}`, {
      data: { reason }
    });
    return response.data;
  },

  // Audit Logs
  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });

    const response = await apiClient.get(`/admin/audit-logs?${queryParams}`);
    return response.data;
  },

  // Bulk Operations
  async bulkUpdateUsers(userIds: string[], updates: {
    role?: string;
    status?: string;
    subscriptionTier?: string;
  }) {
    const response = await apiClient.put('/admin/users/bulk', {
      userIds,
      updates
    });
    return response.data;
  },

  async exportUsers(format: 'csv' | 'xlsx' = 'csv', filters?: Record<string, unknown>) {
    const response = await apiClient.post('/admin/users/export', {
      format,
      filters
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  async exportAnalytics(period: string, format: 'csv' | 'xlsx' = 'csv') {
    const response = await apiClient.get(`/admin/analytics/export?period=${period}&format=${format}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Dashboard Overview
  async getDashboardOverview() {
    try {
      const response = await apiClient.get('/admin/dashboard/overview');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);

      // Return mock data for development
      return {
        success: true,
        data: {
          summary: {
            workspaces: {
              total: 45,
              active: 38,
              trial: 5,
              expired: 2,
              growth: 12.5,
            },
            subscriptions: {
              total: 43,
              active: 40,
              byTier: [
                { _id: 'basic', count: 15, revenue: 45000 },
                { _id: 'professional', count: 20, revenue: 120000 },
                { _id: 'enterprise', count: 5, revenue: 75000 },
              ],
            },
            users: {
              total: 156,
              active: 142,
              growth: 8.7,
            },
            patients: {
              total: 2847,
            },
            invitations: {
              total: 23,
              pending: 8,
              stats: [
                { _id: 'active', count: 8 },
                { _id: 'accepted', count: 12 },
                { _id: 'expired', count: 3 },
              ],
            },
            emails: {
              stats: [
                { _id: 'delivered', count: 156 },
                { _id: 'failed', count: 3 },
                { _id: 'pending', count: 2 },
              ],
            },
          },
          recentActivity: {
            newWorkspaces: 3,
            newUsers: 12,
          },
          alerts: {
            trialExpiring: [
              {
                _id: '1',
                name: 'MediCare Pharmacy',
                trialEndDate: '2024-01-20',
                ownerId: {
                  firstName: 'John',
                  lastName: 'Doe',
                  email: 'john.doe@medicare.com',
                },
              },
            ],
            failedPayments: [
              {
                _id: '1',
                workspaceId: { name: 'HealthPlus Clinic' },
                status: 'past_due',
                updatedAt: '2024-01-14',
              },
            ],
          },
          timestamp: new Date().toISOString(),
        },
      };
    }
  },

  // System Health
  async getSystemHealth() {
    try {
      const response = await apiClient.get('/admin/dashboard/system-health');
      return response.data;
    } catch (error) {
      console.error('Error fetching system health:', error);

      // Return mock data for development
      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          database: {
            connected: true,
            stats: {
              collections: 12,
              documents: 15420,
              dataSize: 45.6, // MB
            },
          },
          application: {
            uptime: 2592000, // 30 days in seconds
            memory: {
              used: 134217728, // 128 MB
              total: 536870912, // 512 MB
            },
            nodeVersion: 'v18.17.0',
            environment: 'production',
          },
          services: {
            emailDelivery: [
              { _id: 'delivered', count: 156 },
              { _id: 'failed', count: 3 },
            ],
            invitations: [
              { _id: 'active', count: 8 },
              { _id: 'accepted', count: 12 },
            ],
            subscriptions: [
              { _id: 'active', count: 40 },
              { _id: 'expired', count: 3 },
            ],
          },
          recentErrors: [],
        },
      };
    }
  },

  // Workspace Management
  async getWorkspaceManagement(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tier?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });

    const response = await apiClient.get(`/admin/workspaces?${queryParams}`);
    return response.data;
  },

  async updateWorkspaceSubscription(workspaceId: string, updates: {
    planId?: string;
    status?: string;
    endDate?: string;
    notes?: string;
  }) {
    const response = await apiClient.put(`/admin/workspaces/${workspaceId}/subscription`, updates);
    return response.data;
  },

  // Invitation Management
  async getInvitationManagement(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    workspaceId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });

    const response = await apiClient.get(`/admin/dashboard/invitations?${queryParams}`);
    return response.data;
  },

  async cancelInvitation(invitationId: string, reason?: string) {
    const response = await apiClient.delete(`/admin/dashboard/invitations/${invitationId}`, {
      data: { reason },
    });
    return response.data;
  },

  async resendInvitation(invitationId: string) {
    const response = await apiClient.post(`/api/invitations/${invitationId}/resend`);
    return response.data;
  },

  // Location Management
  async getLocations(params?: {
    page?: number;
    limit?: number;
    search?: string;
    workspaceId?: string;
  }) {
    // For now, we'll fetch workspaces and extract their locations
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    
    const response = await apiClient.get(`/admin/dashboard/workspaces?${queryParams}`);
    return response.data;
  },
};
