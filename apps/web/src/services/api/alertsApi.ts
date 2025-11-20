/**
 * Alerts API Service
 * API calls for alert management
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { apiClient } from './client';
import { PatientAlert, DashboardAlert, AlertFilters } from '../../types/alerts';

export interface AlertsResponse<T> {
  success: boolean;
  data: {
    alerts: T[];
    summary: {
      total: number;
      bySeverity: Record<string, number>;
      byType: Record<string, number>;
    };
  };
  message?: string;
}

export interface CreateAlertRequest {
  type: 'patient' | 'dashboard';
  alertData: Partial<PatientAlert | DashboardAlert>;
}

export interface CreateAlertResponse {
  success: boolean;
  data: {
    alert: PatientAlert | DashboardAlert;
    message: string;
  };
}

export interface DismissAlertResponse {
  success: boolean;
  data: {
    message: string;
    dismissedAt: string;
  };
}

export interface TriggerMonitoringRequest {
  workplaceId?: string;
  delay?: number;
}

export interface TriggerMonitoringResponse {
  success: boolean;
  data: {
    message: string;
    jobId: string;
    workplaceId: string;
    delay?: number;
  };
}

export interface AlertStatisticsResponse {
  success: boolean;
  data: {
    alerts: {
      patientAlerts: {
        total: number;
        bySeverity: Record<string, number>;
      };
      dashboardAlerts: {
        total: number;
        bySeverity: Record<string, number>;
      };
    };
    monitoring: {
      queue: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
      };
      lastRun: string;
    };
  };
}

export interface MonitoringStatusResponse {
  success: boolean;
  data: {
    queue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    recentJobs: Array<{
      id: string;
      name: string;
      data: any;
      processedOn?: number;
      finishedOn?: number;
      failedReason?: string;
      returnvalue?: any;
    }>;
    isActive: boolean;
  };
}

class AlertsApi {
  /**
   * Get patient alerts
   */
  async getPatientAlerts(
    patientId: string,
    filters?: AlertFilters
  ): Promise<AlertsResponse<PatientAlert>> {
    const params = new URLSearchParams();
    
    if (filters?.severity) {
      if (Array.isArray(filters.severity)) {
        filters.severity.forEach(s => params.append('severity', s));
      } else {
        params.append('severity', filters.severity);
      }
    }
    
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        filters.type.forEach(t => params.append('type', t));
      } else {
        params.append('type', filters.type);
      }
    }
    
    if (filters?.dismissed !== undefined) {
      params.append('dismissed', filters.dismissed.toString());
    }

    const response = await apiClient.get(
      `/alerts/patient/${patientId}?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get dashboard alerts
   */
  async getDashboardAlerts(
    filters?: AlertFilters & { assignedToMe?: boolean }
  ): Promise<AlertsResponse<DashboardAlert>> {
    const params = new URLSearchParams();
    
    if (filters?.severity) {
      if (Array.isArray(filters.severity)) {
        filters.severity.forEach(s => params.append('severity', s));
      } else {
        params.append('severity', filters.severity);
      }
    }
    
    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        filters.type.forEach(t => params.append('type', t));
      } else {
        params.append('type', filters.type);
      }
    }
    
    if (filters?.dismissed !== undefined) {
      params.append('dismissed', filters.dismissed.toString());
    }
    
    if (filters?.assignedToMe !== undefined) {
      params.append('assignedToMe', filters.assignedToMe.toString());
    }

    const response = await apiClient.get(`/alerts/dashboard?${params.toString()}`);
    return response.data;
  }

  /**
   * Create a custom alert
   */
  async createAlert(request: CreateAlertRequest): Promise<CreateAlertResponse> {
    const response = await apiClient.post('/alerts', request);
    return response.data;
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: string, reason?: string): Promise<DismissAlertResponse> {
    const response = await apiClient.post(`/alerts/${alertId}/dismiss`, {
      reason,
    });
    return response.data;
  }

  /**
   * Trigger clinical monitoring
   */
  async triggerClinicalMonitoring(
    request: TriggerMonitoringRequest = {}
  ): Promise<TriggerMonitoringResponse> {
    const response = await apiClient.post('/alerts/trigger-monitoring', request);
    return response.data;
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(): Promise<AlertStatisticsResponse> {
    const response = await apiClient.get('/alerts/statistics');
    return response.data;
  }

  /**
   * Get monitoring status
   */
  async getMonitoringStatus(): Promise<MonitoringStatusResponse> {
    const response = await apiClient.get('/alerts/monitoring/status');
    return response.data;
  }
}

export const alertsApi = new AlertsApi();
export default alertsApi;