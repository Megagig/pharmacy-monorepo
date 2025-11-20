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
  cost?: number; // Cost price in Naira (₦)
  sellingPrice?: number; // Selling price in Naira (₦)
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
  cost?: number; // Cost price in Naira (₦)
  sellingPrice?: number; // Selling price in Naira (₦)
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
  cost?: number; // Cost price in Naira (₦)
  sellingPrice?: number; // Selling price in Naira (₦)
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
  cost?: number; // Cost price in Naira
  sellingPrice?: number; // Selling price in Naira
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
  customMessage?: string;
  repeatReminders?: boolean;
  repeatInterval?: number; // minutes
  smartReminders?: boolean; // adaptive reminders based on patient behavior
  allowSnooze?: boolean;
  snoozeOptions?: number[]; // minutes
  notifyCaregiver?: boolean;
  caregiverContact?: string;
}

export interface MedicationMonitoringSettings {
  adherenceMonitoring: boolean;
  refillReminders: boolean;
  interactionChecking: boolean;
  refillThreshold?: number; // percentage of medication remaining to trigger refill
  missedDoseThreshold?: number; // consecutive missed doses to trigger alert
  adherenceReporting?: boolean; // enable periodic adherence reports
  reportFrequency?: 'daily' | 'weekly' | 'monthly';
  alertOnLowAdherence?: boolean;
  lowAdherenceThreshold?: number; // percentage below which to alert
  stockoutPrediction?: boolean; // predict and alert before stockout
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

  // Enhanced Analytics endpoints with Naira currency support
  getAdherenceAnalytics: async (
    patientId: string,
    period: string = '6months'
  ): Promise<{
    monthlyAdherence: { month: string; adherence: number }[];
    averageAdherence: number;
    trendDirection: 'up' | 'down' | 'stable';
    complianceDays: { day: string; count: number }[];
    missedDoses: { day: string; count: number }[];
    adherenceByTimeOfDay: { time: string; adherence: number }[];
    costsData?: {
      saved: number;
      potential: number;
      formattedSaved: string;
      formattedPotential: string;
    };
    currencyCode?: string;
    currencySymbol?: string;
  }> => {
    const response = await api.get(
      `/medication-analytics/adherence/${patientId}`,
      {
        params: { period },
      }
    );
    return {
      ...response.data,
      currencyCode: 'NGN',
      currencySymbol: '₦',
    };
  },

  getPrescriptionPatternAnalytics: async (
    patientId: string
  ): Promise<{
    medicationsByCategory: {
      category: string;
      count: number;
      cost?: number;
      formattedCost?: string;
    }[];
    medicationsByRoute: {
      route: string;
      count: number;
      cost?: number;
      formattedCost?: string;
    }[];
    prescriptionFrequency: { month: string; count: number }[];
    topPrescribers: { prescriber: string; count: number }[];
    medicationDurationTrends: { duration: string; count: number }[];
    seasonalPrescriptionPatterns: { season: string; count: number }[];
    costByMonth?: { month: string; cost: number; formattedCost: string }[];
    currencyCode?: string;
    currencySymbol?: string;
  }> => {
    const response = await api.get(
      `/medication-analytics/prescriptions/${patientId}`
    );
    return {
      ...response.data,
      currencyCode: 'NGN',
      currencySymbol: '₦',
    };
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
      severityLevel: 'minor' | 'moderate' | 'severe';
      recommendedAction: string;
      potentialCosts?: number;
      formattedPotentialCosts?: string;
    }[];
    riskFactorsByMedication: { medication: string; riskScore: number }[];
    interactionsByBodySystem: { system: string; count: number }[];
    financialImpact?: {
      potentialCost: number;
      formattedPotentialCost: string;
      preventedCost: number;
      formattedPreventedCost: string;
    };
    currencyCode?: string;
    currencySymbol?: string;
  }> => {
    const response = await api.get(
      `/medication-analytics/interactions/${patientId}`
    );
    return {
      ...response.data,
      currencyCode: 'NGN',
      currencySymbol: '₦',
    };
  },

  getMedicationCostAnalytics: async (
    patientId: string
  ): Promise<{
    monthlyCosts: { month: string; totalCost: number; formattedCost: string }[];
    costByCategory: { category: string; cost: number; formattedCost: string }[];
    totalCost: number;
    formattedTotalCost: string;
    currency: {
      code: string;
      symbol: string;
    };
    // New fields for the updated API
    monthlyFinancials?: {
      month: string;
      cost: number;
      revenue: number;
      profit: number;
      formattedCost: string;
      formattedRevenue: string;
      formattedProfit: string;
    }[];
    financialsByCategory?: {
      category: string;
      cost: number;
      revenue: number;
      profit: number;
      formattedCost: string;
      formattedRevenue: string;
      formattedProfit: string;
    }[];
    topProfitableMedications?: {
      medicationName: string;
      profit: number;
      formattedProfit: string;
      profitMargin: number;
      formattedProfitMargin: string;
    }[];
    totalRevenue?: number;
    totalProfit?: number;
    profitMargin?: number;
    formattedTotalRevenue?: string;
    formattedTotalProfit?: string;
    formattedProfitMargin?: string;
  }> => {
    const response = await api.get(
      `/medication-analytics/costs/${patientId}`
    );
    return response.data;
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
    adherenceTrend: 'increasing' | 'decreasing' | 'stable';
    costAnalysis: {
      totalMonthlyCost: number;
      formattedMonthlyCost: string;
      costByCategory: {
        category: string;
        cost: number;
        formattedCost: string;
      }[];
      insuranceCoverageRate: number;
    };
    medicationComplexity: {
      complexityScore: number; // 0-100 scale
      doseFrequency: number; // average daily doses
      uniqueScheduleCount: number; // number of different schedules
    };
    currency?: {
      code: string;
      symbol: string;
    };
  }> => {
    const response = await api.get(
      `/medication-analytics/dashboard/${patientId}`
    );
    return {
      ...response.data,
      currency: {
        code: 'NGN',
        symbol: '₦',
      },
    };
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
      reminderSettings?: Partial<MedicationReminderSettings>;
      monitoringSettings?: Partial<MedicationMonitoringSettings>;
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
    contact: string,
    testMessage?: string
  ): Promise<{ success: boolean; message: string; details?: string }> => {
    const response = await api.post(
      `/medication-management/settings/${patientId}/test-notification`,
      {
        type,
        contact,
        testMessage,
      }
    );
    return response.data;
  },
};

export default medicationManagementService;
