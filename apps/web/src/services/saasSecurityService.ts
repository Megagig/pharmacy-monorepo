import api from '../lib/api';

// Types based on backend SecurityAuditLog model
export interface SecurityAuditLog {
  _id: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  timestamp: Date | string;
  success: boolean;
  errorMessage?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'user_management' | 'system' | 'tenant_management';
  details: Record<string, any>;
  riskScore: number;
  flagged: boolean;
  reviewedBy?: string;
  reviewedAt?: Date | string;
  reviewNotes?: string;
  workspaceId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SecurityDashboardMetrics {
  sessions: {
    total: number;
    active: number;
    inactive: number;
    uniqueUsers: number;
    uniqueIPs: number;
  };
  security: {
    failedLogins: number;
    successfulLogins: number;
    suspiciousActivities: number;
    accountLockouts: number;
  };
  policies: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number;
      preventReuse: number;
    };
    sessionSettings: any;
    accountLockout: {
      maxFailedAttempts: number;
      lockoutDuration: number;
      autoUnlock: boolean;
      notifyOnLockout: boolean;
    };
  };
  timeRange: string;
  generatedAt: Date | string;
}

export interface AuditLogsResponse {
  logs: SecurityAuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SecurityAuditFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
    maxConcurrentSessions: number;
    sessionTimeout: number;
    absoluteTimeout: number;
    idleTimeout: number;
  };
  accountLockout: {
    maxFailedAttempts: number;
    lockoutDuration: number;
    autoUnlock: boolean;
    notifyOnLockout: boolean;
  };
  twoFactorAuthentication: {
    enabled: boolean;
    required: boolean;
    methods: string[];
  };
}

class SaaSSecurityService {
  /**
   * Get security dashboard metrics
   * GET /api/admin/saas/security/dashboard
   */
  async getSecurityDashboard(timeRange: '1h' | '24h' | '7d' | '30d' = '24h') {
    const response = await api.get<{
      success: boolean;
      data: SecurityDashboardMetrics;
      message: string;
    }>(`/admin/saas/security/dashboard?timeRange=${timeRange}`);
    return response.data;
  }

  /**
   * Get security audit logs with filters
   * GET /api/admin/saas/security/audit-logs
   */
  async getSecurityAuditLogs(filters: SecurityAuditFilters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await api.get<{
      success: boolean;
      data: AuditLogsResponse;
      message: string;
    }>(`/admin/saas/security/audit-logs?${params}`);
    return response.data;
  }

  /**
   * Get security settings
   * GET /api/admin/saas/security/settings
   */
  async getSecuritySettings() {
    const response = await api.get<{
      success: boolean;
      data: { settings: SecuritySettings; retrievedAt: string };
      message: string;
    }>('/admin/saas/security/settings');
    return response.data;
  }

  /**
   * Update password policy
   * PUT /api/admin/saas/security/password-policy
   */
  async updatePasswordPolicy(policy: Partial<SecuritySettings['passwordPolicy']>) {
    const response = await api.put('/admin/saas/security/password-policy', policy);
    return response.data;
  }

  /**
   * Update account lockout settings
   * PUT /api/admin/saas/security/account-lockout
   */
  async updateAccountLockout(settings: Partial<SecuritySettings['accountLockout']>) {
    const response = await api.put('/admin/saas/security/account-lockout', settings);
    return response.data;
  }

  /**
   * Get active user sessions
   * GET /api/admin/saas/security/sessions
   */
  async getActiveSessions(filters: {
    page?: number;
    limit?: number;
    userId?: string;
    isActive?: boolean;
  } = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await api.get(`/admin/saas/security/sessions?${params}`);
    return response.data;
  }

  /**
   * Terminate a user session
   * DELETE /api/admin/saas/security/sessions/:sessionId
   */
  async terminateSession(sessionId: string, reason?: string) {
    const response = await api.delete(`/admin/saas/security/sessions/${sessionId}`, {
      data: { reason },
    });
    return response.data;
  }

  /**
   * Lock user account
   * POST /api/admin/saas/security/users/:userId/lock
   */
  async lockUserAccount(userId: string, reason: string) {
    const response = await api.post(`/admin/saas/security/users/${userId}/lock`, {
      reason,
    });
    return response.data;
  }

  /**
   * Unlock user account
   * POST /api/admin/saas/security/users/:userId/unlock
   */
  async unlockUserAccount(userId: string) {
    const response = await api.post(`/admin/saas/security/users/${userId}/unlock`);
    return response.data;
  }

  /**
   * Get security analytics aggregated by category
   */
  async getSecurityAnalytics(timeRange: '7d' | '30d' | '90d' = '30d') {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
    }

    const response = await this.getSecurityAuditLogs({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 200, // Maximum allowed by backend
    });

    const logs = response.data.logs;

    // Aggregate data for charts
    const analytics = {
      byCategory: this.aggregateByField(logs, 'category'),
      bySeverity: this.aggregateByField(logs, 'severity'),
      byDay: this.aggregateByDay(logs),
      topActions: this.getTopActions(logs, 10),
      riskDistribution: this.getRiskDistribution(logs),
      successVsFailure: {
        success: logs.filter(log => log.success).length,
        failure: logs.filter(log => !log.success).length,
      },
    };

    return analytics;
  }

  // Helper methods for analytics
  private aggregateByField(logs: SecurityAuditLog[], field: keyof SecurityAuditLog) {
    const counts: Record<string, number> = {};

    logs.forEach(log => {
      const value = log[field] as string;
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([key, value]) => ({
      _id: key,
      count: value,
    }));
  }

  private aggregateByDay(logs: SecurityAuditLog[]) {
    const daysCounts: Record<string, number> = {};

    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      daysCounts[dayKey] = (daysCounts[dayKey] || 0) + 1;
    });

    return Object.entries(daysCounts)
      .map(([date, count]) => ({ date, events: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private getTopActions(logs: SecurityAuditLog[], limit: number) {
    const actionCounts: Record<string, number> = {};

    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    return Object.entries(actionCounts)
      .map(([action, count]) => ({ _id: action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getRiskDistribution(logs: SecurityAuditLog[]) {
    const ranges = [
      { label: '0-20', min: 0, max: 20 },
      { label: '21-40', min: 21, max: 40 },
      { label: '41-60', min: 41, max: 60 },
      { label: '61-80', min: 61, max: 80 },
      { label: '81-100', min: 81, max: 100 },
    ];

    return ranges.map(range => ({
      _id: range.label,
      count: logs.filter(
        log => log.riskScore >= range.min && log.riskScore <= range.max
      ).length,
    }));
  }
}

export const saasSecurityService = new SaaSSecurityService();
