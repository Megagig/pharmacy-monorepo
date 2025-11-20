/**
 * Alert Types
 * TypeScript types for alert system
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

export interface PatientAlert {
  id: string;
  type: 'overdue_appointment' | 'missed_appointment' | 'abnormal_vitals' | 
        'low_adherence' | 'pending_lab_review' | 'overdue_followup' | 
        'preventive_care_due' | 'patient_inactive' | 'low_stock';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  patientId: string;
  patientName: string;
  data: Record<string, any>;
  createdAt: string;
  dismissedAt?: string;
  dismissedBy?: string;
  dismissReason?: string;
  actionUrl?: string;
  expiresAt?: string;
}

export interface DashboardAlert {
  id: string;
  type: 'appointments_today' | 'overdue_followups' | 'high_priority_tasks' | 
        'capacity_warning' | 'system_notification' | 'inventory_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  count?: number;
  data: Record<string, any>;
  createdAt: string;
  dismissedAt?: string;
  dismissedBy?: string;
  actionUrl?: string;
  expiresAt?: string;
}

export interface ClinicalTrigger {
  type: 'medication_start' | 'lab_result' | 'vital_signs' | 'appointment_missed' | 
        'medication_change' | 'hospital_discharge' | 'adherence_check';
  patientId: string;
  sourceId?: string;
  sourceType?: string;
  data: Record<string, any>;
  triggeredAt: string;
}

export interface AlertFilters {
  severity?: string | string[];
  type?: string | string[];
  patientId?: string;
  dismissed?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AlertOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AlertSummary {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

export interface AlertStatistics {
  patientAlerts: {
    total: number;
    bySeverity: Record<string, number>;
  };
  dashboardAlerts: {
    total: number;
    bySeverity: Record<string, number>;
  };
}

export interface MonitoringQueue {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface MonitoringJob {
  id: string;
  name: string;
  data: any;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  returnvalue?: any;
}

export interface MonitoringStatus {
  queue: MonitoringQueue;
  recentJobs: MonitoringJob[];
  isActive: boolean;
}

// Alert action types
export type AlertAction = 
  | { type: 'VIEW_DETAILS'; alertId: string; url?: string }
  | { type: 'DISMISS'; alertId: string; reason?: string }
  | { type: 'CREATE_APPOINTMENT'; patientId: string; appointmentType?: string }
  | { type: 'SCHEDULE_FOLLOWUP'; patientId: string; followUpType?: string }
  | { type: 'VIEW_PATIENT'; patientId: string }
  | { type: 'VIEW_VITALS'; patientId: string }
  | { type: 'VIEW_ADHERENCE'; patientId: string }
  | { type: 'VIEW_APPOINTMENTS'; patientId?: string }
  | { type: 'VIEW_FOLLOWUPS'; patientId?: string };

// Alert context for providers
export interface AlertContextValue {
  patientAlerts: PatientAlert[];
  dashboardAlerts: DashboardAlert[];
  alertStatistics: AlertStatistics | null;
  monitoringStatus: MonitoringStatus | null;
  isLoading: boolean;
  error: string | null;
  dismissAlert: (alertId: string, reason?: string) => Promise<void>;
  createAlert: (type: 'patient' | 'dashboard', alertData: any) => Promise<void>;
  triggerMonitoring: (workplaceId?: string, delay?: number) => Promise<void>;
  refreshAlerts: () => void;
}

// Alert notification types
export interface AlertNotification {
  id: string;
  alertId: string;
  type: PatientAlert['type'] | DashboardAlert['type'];
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  actionUrl?: string;
}

// Alert preferences
export interface AlertPreferences {
  enablePatientAlerts: boolean;
  enableDashboardAlerts: boolean;
  enableRealTimeUpdates: boolean;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  autoRefreshInterval: number; // in seconds
  maxAlertsPerView: number;
  groupSimilarAlerts: boolean;
}

// Alert display options
export interface AlertDisplayOptions {
  showDismissed: boolean;
  showExpired: boolean;
  groupByType: boolean;
  groupBySeverity: boolean;
  sortBy: 'createdAt' | 'severity' | 'type' | 'expiresAt';
  sortOrder: 'asc' | 'desc';
  compactView: boolean;
  showActionButtons: boolean;
  showMetadata: boolean;
}

export default {
  PatientAlert,
  DashboardAlert,
  ClinicalTrigger,
  AlertFilters,
  AlertOptions,
  AlertSummary,
  AlertStatistics,
  MonitoringQueue,
  MonitoringJob,
  MonitoringStatus,
  AlertAction,
  AlertContextValue,
  AlertNotification,
  AlertPreferences,
  AlertDisplayOptions,
};