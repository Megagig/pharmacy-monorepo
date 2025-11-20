import api from '../lib/api';

// Security Dashboard Types
export interface SecurityThreat {
  _id: string;
  timestamp: string;
  type:
  | 'suspicious_login'
  | 'data_breach_attempt'
  | 'unauthorized_access'
  | 'malware_detection'
  | 'ddos_attack';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  ipAddress: string;
  userId?: string;
  userAgent?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  description: string;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  affectedResources: string[];
  mitigation?: {
    action: string;
    timestamp: string;
    performedBy: string;
  };
  metadata: Record<string, unknown>;
}

export interface SecurityDashboardStats {
  totalThreats: number;
  activeThreats: number;
  resolvedThreats: number;
  criticalThreats: number;
  threatsByType: {
    [key: string]: number;
  };
  threatsBySeverity: {
    [key: string]: number;
  };
  topRiskyIPs: Array<{
    ip: string;
    threatCount: number;
    lastSeen: string;
  }>;
  securityMetrics: {
    averageResponseTime: number;
    falsePositiveRate: number;
    detectionAccuracy: number;
    systemUptime: number;
  };
  recentActivity: Array<{
    timestamp: string;
    event: string;
    severity: string;
    status: string;
  }>;
}

export interface SecurityAlert {
  _id: string;
  type:
  | 'threat_detected'
  | 'system_breach'
  | 'unusual_activity'
  | 'policy_violation';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  affectedSystems: string[];
  recommendedActions: string[];
}

export interface SecurityFilters {
  startDate?: string;
  endDate?: string;
  severity?: string;
  type?: string;
  status?: string;
  ipAddress?: string;
  page?: number;
  limit?: number;
}

export interface SecurityReportConfig {
  format: 'pdf' | 'csv' | 'json';
  includeThreats: boolean;
  includeAlerts: boolean;
  includeMetrics: boolean;
  startDate: string;
  endDate: string;
  filters?: Partial<SecurityFilters>;
}

class SecurityService {
  // Get security dashboard overview
  async getSecurityDashboard(): Promise<SecurityDashboardStats> {
    const response = await api.get('/security/dashboard');
    return response.data;
  }

  // Get security threats with filtering
  async getSecurityThreats(filters: SecurityFilters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await api.get(`/security/threats?${params}`);
    return response.data;
  }

  // Get security alerts
  async getSecurityAlerts(filters: Partial<SecurityFilters> = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await api.get(`/security/alerts?${params}`);
    return response.data;
  }

  // Acknowledge security alert
  async acknowledgeAlert(alertId: string, note?: string) {
    const response = await api.patch(
      `/security/alerts/${alertId}/acknowledge`,
      {
        note,
      }
    );
    return response.data;
  }

  // Resolve security alert
  async resolveAlert(
    alertId: string,
    resolution: string,
    preventiveMeasures?: string[]
  ) {
    const response = await api.patch(`/security/alerts/${alertId}/resolve`, {
      resolution,
      preventiveMeasures,
    });
    return response.data;
  }

  // Update threat status
  async updateThreatStatus(
    threatId: string,
    status: SecurityThreat['status'],
    mitigation?: string
  ) {
    const response = await api.patch(`/security/threats/${threatId}`, {
      status,
      mitigation: mitigation
        ? {
          action: mitigation,
          timestamp: new Date().toISOString(),
          performedBy: 'current_user', // This should be populated from auth context
        }
        : undefined,
    });
    return response.data;
  }

  // Block IP address
  async blockIpAddress(ipAddress: string, reason: string, duration?: number) {
    const response = await api.post('/security/block-ip', {
      ipAddress,
      reason,
      duration,
    });
    return response.data;
  }

  // Generate security report
  async generateSecurityReport(config: SecurityReportConfig) {
    const response = await api.post('/security/reports/generate', config, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Get security settings
  async getSecuritySettings() {
    const response = await api.get('/security/settings');
    return response.data;
  }

  // Update security settings
  async updateSecuritySettings(settings: {
    alertThresholds?: {
      criticalThreatCount?: number;
      highThreatCount?: number;
      suspiciousLoginAttempts?: number;
    };
    autoBlockSettings?: {
      enabled?: boolean;
      suspiciousLoginThreshold?: number;
      blockDuration?: number;
    };
    notificationSettings?: {
      emailAlerts?: boolean;
      smsAlerts?: boolean;
      webhookUrl?: string;
    };
  }) {
    const response = await api.patch('/security/settings', settings);
    return response.data;
  }

  // Get real-time security metrics
  async getRealTimeMetrics() {
    const response = await api.get('/security/metrics/realtime');
    return response.data;
  }

  // Get security trends
  async getSecurityTrends(period: '24h' | '7d' | '30d' | '90d' = '7d') {
    const response = await api.get(`/security/trends?period=${period}`);
    return response.data;
  }

  // Test security notification
  async testSecurityNotification(type: 'email' | 'sms' | 'webhook') {
    const response = await api.post(`/security/test-notification`, { type });
    return response.data;
  }
}

export const securityService = new SecurityService();
