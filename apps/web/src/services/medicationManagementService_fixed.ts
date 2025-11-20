import api from './api';

export interface MedicationCreateData {
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate?: string | Date;
  endDate?: string | Date;
  indication?: string;
  prescriber?: string;
  allergyCheck?: {
    status: boolean;
    details?: string;
  };
  status?: 'active' | 'archived' | 'cancelled';
}

export interface MedicationUpdateData {
  name?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  indication?: string;
  prescriber?: string;
  allergyCheck?: {
    status: boolean;
    details?: string;
  };
  status?: 'active' | 'archived' | 'cancelled';
  historyNotes?: string;
}

export interface MedicationHistoryItem {
  name?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  indication?: string;
  prescriber?: string;
  status?: 'active' | 'archived' | 'cancelled';
  updatedAt: string | Date;
  updatedBy?: string;
  notes?: string;
}

export interface MedicationData {
  _id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate?: string | Date;
  endDate?: string | Date;
  indication?: string;
  prescriber?: string;
  allergyCheck: {
    status: boolean;
    details?: string;
  };
  interactionCheck?: {
    status: boolean;
    details?: string;
    severity?: 'minor' | 'moderate' | 'severe';
  };
  status: 'active' | 'archived' | 'cancelled';
  history: MedicationHistoryItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface AdherenceLogCreateData {
  medicationId: string;
  patientId: string;
  refillDate?: string | Date;
  adherenceScore: number;
  pillCount?: number;
  notes?: string;
}

export interface AdherenceLogData {
  _id: string;
  medicationId: string;
  patientId: string;
  refillDate: string | Date;
  adherenceScore: number;
  pillCount?: number;
  notes?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface InteractionCheckItem {
  medicationId?: string;
  medicationName: string;
  dosage?: string;
  route?: string;
}

export interface MedicationReminderSettings {
  enabled: boolean;
  defaultReminderTimes: string[];
  reminderMethod: 'email' | 'sms' | 'both';
  defaultNotificationLeadTime: number;
}

export interface MedicationMonitoringSettings {
  adherenceMonitoring: boolean;
  refillReminders: boolean;
  interactionChecking: boolean;
}

export interface InteractionResult {
  drugPair: string[];
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
}

/**
 * Medication Management API Service
 */
const medicationManagementService = {
  // Medication CRUD operations
  createMedication: async (
    medicationData: MedicationCreateData
  ): Promise<MedicationData> => {
    const response = await api.post('/medication-management', medicationData);
    return response.data.data;
  },

  getMedicationsByPatient: async (
    patientId: string,
    status = 'active'
  ): Promise<MedicationData[]> => {
    const response = await api.get(
      `/medication-management/patient/${patientId}`,
      {
        params: { status },
      }
    );
    return response.data.data;
  },

  getMedicationById: async (id: string): Promise<MedicationData> => {
    const response = await api.get(`/medication-management/${id}`);
    return response.data.data;
  },

  updateMedication: async (
    id: string,
    medicationData: MedicationUpdateData
  ): Promise<MedicationData> => {
    const response = await api.put(
      `/medication-management/${id}`,
      medicationData
    );
    return response.data.data;
  },

  archiveMedication: async (
    id: string,
    reason?: string
  ): Promise<MedicationData> => {
    const response = await api.patch(`/medication-management/${id}/archive`, {
      reason,
    });
    return response.data.data;
  },

  // Adherence tracking
  logAdherence: async (
    adherenceData: AdherenceLogCreateData
  ): Promise<AdherenceLogData> => {
    const response = await api.post(
      '/medication-management/adherence',
      adherenceData
    );
    return response.data.data;
  },

  getAdherenceLogs: async (
    patientId: string,
    startDate?: string | Date,
    endDate?: string | Date
  ): Promise<AdherenceLogData[]> => {
    const response = await api.get(
      `/medication-management/adherence/patient/${patientId}`,
      {
        params: { startDate, endDate },
      }
    );
    return response.data.data;
  },

  // Medication interactions
  checkInteractions: async (
    medications: InteractionCheckItem[]
  ): Promise<InteractionResult[]> => {
    const response = await api.post(
      '/medication-management/check-interactions',
      {
        medications,
      }
    );
    return response.data.data;
  },

  // Dashboard endpoints
  getDashboardStats: async (): Promise<{
    activeMedications: number;
    averageAdherence: number;
    interactionAlerts: number;
  }> => {
    const response = await api.get('/medication-management/dashboard/stats');
    return response.data.data;
  },

  getAdherenceTrends: async (
    period?: string
  ): Promise<{ name: string; adherence: number }[]> => {
    const response = await api.get(
      '/medication-management/dashboard/adherence-trends',
      {
        params: { period },
      }
    );
    return response.data.data;
  },

  getRecentPatientsWithMedications: async (
    limit?: number
  ): Promise<
    {
      id: string;
      name: string;
      medicationCount: number;
      lastUpdate: string;
    }[]
  > => {
    const response = await api.get(
      '/medication-management/dashboard/recent-patients',
      {
        params: { limit },
      }
    );
    return response.data.data;
  },

  // Analytics endpoints
  getAdherenceAnalytics: async (
    patientId: string,
    period: string = '6months'
  ): Promise<{
    monthlyAdherence: { month: string; adherence: number }[];
    averageAdherence: number;
    trendDirection: 'up' | 'down' | 'stable';
    complianceDays: { day: string; count: number }[];
  }> => {
    const response = await api.get(
      `/medication-management/analytics/adherence/${patientId}`,
      {
        params: { period },
      }
    );
    return response.data.data;
  },

  getPrescriptionPatternAnalytics: async (
    patientId: string
  ): Promise<{
    medicationsByCategory: { category: string; count: number }[];
    medicationsByRoute: { route: string; count: number }[];
    prescriptionFrequency: { month: string; count: number }[];
    topPrescribers: { prescriber: string; count: number }[];
  }> => {
    const response = await api.get(
      `/medication-management/analytics/prescription-patterns/${patientId}`
    );
    return response.data.data;
  },

  getMedicationInteractionAnalytics: async (
    patientId: string
  ): Promise<{
    severityDistribution: { severity: string; count: number }[];
    interactionTrends: { month: string; count: number }[];
    commonInteractions: {
      medications: string[];
      description: string;
      count: number;
    }[];
  }> => {
    const response = await api.get(
      `/medication-management/analytics/interactions/${patientId}`
    );
    return response.data.data;
  },

  getPatientMedicationSummary: async (
    patientId: string
  ): Promise<{
    activeCount: number;
    archivedCount: number;
    cancelledCount: number;
    adherenceRate: number;
    interactionCount: number;
    mostCommonCategory: string;
    mostCommonRoute: string;
    lastUpdated: string;
  }> => {
    const response = await api.get(
      `/medication-management/analytics/summary/${patientId}`
    );
    return response.data.data;
  },

  // Settings endpoints
  getPatientMedicationSettings: async (
    patientId: string
  ): Promise<{
    reminderSettings: MedicationReminderSettings;
    monitoringSettings: MedicationMonitoringSettings;
  }> => {
    const response = await api.get(
      `/medication-management/settings/${patientId}`
    );
    return response.data.data;
  },

  updatePatientMedicationSettings: async (
    patientId: string,
    settings: {
      reminderSettings?: {
        enabled?: boolean;
        defaultReminderTimes?: string[];
        reminderMethod?: 'email' | 'sms' | 'both';
        defaultNotificationLeadTime?: number;
      };
      monitoringSettings?: {
        adherenceMonitoring?: boolean;
        refillReminders?: boolean;
        interactionChecking?: boolean;
      };
    }
  ): Promise<{
    reminderSettings: MedicationReminderSettings;
    monitoringSettings: MedicationMonitoringSettings;
  }> => {
    const response = await api.put(
      `/medication-management/settings/${patientId}`,
      settings
    );
    return response.data.data;
  },

  testNotification: async (
    patientId: string,
    type: 'email' | 'sms',
    contact: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(
      `/medication-management/settings/${patientId}/test-notification`,
      {
        type,
        contact,
      }
    );
    return response.data;
  },
};

export default medicationManagementService;
