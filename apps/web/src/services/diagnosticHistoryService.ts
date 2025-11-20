import { apiClient } from './apiClient';

export interface DiagnosticHistoryItem {
  _id: string;
  patientId: string;
  caseId: string;
  diagnosticCaseId: string;
  pharmacistId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  analysisSnapshot: {
    differentialDiagnoses: {
      condition: string;
      probability: number;
      reasoning: string;
      severity: 'low' | 'medium' | 'high';
    }[];
    recommendedTests: {
      testName: string;
      priority: 'urgent' | 'routine' | 'optional';
      reasoning: string;
    }[];
    therapeuticOptions: {
      medication: string;
      dosage: string;
      frequency: string;
      duration: string;
      reasoning: string;
      safetyNotes: string[];
    }[];
    redFlags: {
      flag: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      action: string;
    }[];
    referralRecommendation?: {
      recommended: boolean;
      urgency: 'immediate' | 'within_24h' | 'routine';
      specialty: string;
      reason: string;
    };
    disclaimer: string;
    confidenceScore: number;
    processingTime: number;
  };
  clinicalContext: {
    symptoms: {
      subjective: string[];
      objective: string[];
      duration: string;
      severity: 'mild' | 'moderate' | 'severe';
      onset: 'acute' | 'chronic' | 'subacute';
    };
    vitalSigns?: {
      bloodPressure?: string;
      heartRate?: number;
      temperature?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
    };
    currentMedications?: {
      name: string;
      dosage: string;
      frequency: string;
    }[];
    labResults?: {
      testName: string;
      value: string;
      referenceRange: string;
      abnormal: boolean;
    }[];
  };
  notes: {
    _id: string;
    content: string;
    addedBy: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    addedAt: string;
    type: 'clinical' | 'follow_up' | 'review' | 'general';
  }[];
  followUp: {
    required: boolean;
    scheduledDate?: string;
    completed: boolean;
    completedDate?: string;
    outcome?: string;
    nextSteps?: string;
  };
  referral?: {
    generated: boolean;
    generatedAt?: string;
    specialty: string;
    urgency: 'immediate' | 'within_24h' | 'routine';
    status: 'pending' | 'sent' | 'acknowledged' | 'completed';
    sentAt?: string;
    acknowledgedAt?: string;
    completedAt?: string;
    feedback?: string;
  };
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticCase {
  _id: string;
  caseId: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
  };
  pharmacistId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  symptoms: {
    subjective: string[];
    objective: string[];
    duration: string;
    severity: 'mild' | 'moderate' | 'severe';
    onset: 'acute' | 'chronic' | 'subacute';
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticAnalytics {
  summary: {
    totalCases: number;
    averageConfidence: number;
    averageProcessingTime: number;
    completedCases: number;
    pendingFollowUps: number;
    referralsGenerated: number;
  };
  topDiagnoses: {
    condition: string;
    count: number;
    averageConfidence: number;
  }[];
  completionTrends: {
    _id: string;
    casesCreated: number;
    casesCompleted: number;
  }[];
  dateRange: {
    from: string | null;
    to: string | null;
  };
}

export interface DiagnosticReferral {
  _id: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
  };
  pharmacistId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  caseId: string;
  referral: {
    generated: boolean;
    generatedAt?: string;
    document?: {
      content: string;
      template: string;
      lastModified: string;
      modifiedBy: string;
    };
    specialty: string;
    urgency: 'immediate' | 'within_24h' | 'routine';
    status: 'pending' | 'sent' | 'acknowledged' | 'completed';
    sentAt?: string;
    acknowledgedAt?: string;
    completedAt?: string;
    feedback?: string;
  };
  analysisSnapshot: {
    referralRecommendation?: {
      recommended: boolean;
      urgency: 'immediate' | 'within_24h' | 'routine';
      specialty: string;
      reason: string;
    };
  };
  createdAt: string;
}

class DiagnosticHistoryService {
  /**
   * Get comprehensive diagnostic history for a patient
   */
  async getPatientHistory(
    patientId: string,
    options: {
      page?: number;
      limit?: number;
      includeArchived?: boolean;
    } = {}
  ): Promise<{
    history: DiagnosticHistoryItem[];
    pagination: {
      current: number;
      total: number;
      count: number;
      totalRecords: number;
    };
    patient: {
      id: string;
      name: string;
      age: number;
      gender: string;
    };
  }> {
    const { page = 1, limit = 10, includeArchived = false } = options;

    const response = await apiClient.get(
      `/diagnostics/patients/${patientId}/history`,
      {
        params: {
          page,
          limit,
          includeArchived,
        },
        timeout: 30000,
      }
    );

    return response.data.data;
  }

  /**
   * Add note to diagnostic history
   */
  async addNote(
    historyId: string,
    content: string,
    type: 'clinical' | 'follow_up' | 'review' | 'general' = 'general'
  ): Promise<{
    noteId: string;
    addedAt: string;
  }> {
    const response = await apiClient.post(
      `/diagnostics/history/${historyId}/notes`,
      {
        content,
        type,
      },
      {
        timeout: 15000,
      }
    );

    return response.data.data;
  }

  /**
   * Get diagnostic analytics
   */
  async getAnalytics(options: {
    dateFrom?: string;
    dateTo?: string;
    patientId?: string;
  } = {}): Promise<DiagnosticAnalytics> {
    const response = await apiClient.get('/diagnostics/analytics', {
      params: options,
      timeout: 30000,
    });

    return response.data.data;
  }

  /**
   * Get all diagnostic cases
   */
  async getAllCases(options: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    cases: DiagnosticCase[];
    pagination: {
      current: number;
      total: number;
      count: number;
      totalCases: number;
    };
    filters: {
      status?: string;
      patientId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      patientId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const response = await apiClient.get('/diagnostics/cases/all', {
      params: {
        page,
        limit,
        status,
        patientId,
        search,
        sortBy,
        sortOrder,
      },
      timeout: 30000,
    });

    return response.data.data;
  }

  /**
   * Get referrals data
   */
  async getReferrals(options: {
    page?: number;
    limit?: number;
    status?: string;
    specialty?: string;
  } = {}): Promise<{
    referrals: DiagnosticReferral[];
    pagination: {
      current: number;
      total: number;
      count: number;
      totalReferrals: number;
    };
    statistics: {
      pending: number;
      sent: number;
      acknowledged: number;
      completed: number;
    };
    filters: {
      status?: string;
      specialty?: string;
    };
  }> {
    const { page = 1, limit = 20, status, specialty } = options;

    const response = await apiClient.get('/diagnostics/referrals', {
      params: {
        page,
        limit,
        status,
        specialty,
      },
      timeout: 30000,
    });

    return response.data.data;
  }

  /**
   * Export diagnostic history as PDF
   */
  async exportHistoryAsPDF(
    historyId: string,
    purpose: 'referral' | 'patient_record' | 'consultation' | 'audit' = 'patient_record'
  ): Promise<Blob> {
    const response = await apiClient.get(
      `/diagnostics/history/${historyId}/export/pdf`,
      {
        params: { purpose },
        responseType: 'blob',
        timeout: 60000,
      }
    );

    return response.data;
  }

  /**
   * Generate referral document
   */
  async generateReferralDocument(
    historyId: string
  ): Promise<{
    documentUrl: string;
    referralId: string;
  }> {
    const response = await apiClient.post(
      `/diagnostics/history/${historyId}/referral/generate`,
      {},
      {
        timeout: 30000,
      }
    );

    return response.data.data;
  }

  /**
   * Compare diagnostic histories
   */
  async compareHistories(
    historyId1: string,
    historyId2: string
  ): Promise<{
    comparison: {
      diagnosisChanges: string[];
      confidenceChange: number;
      newSymptoms: string[];
      resolvedSymptoms: string[];
      medicationChanges: string[];
      improvementScore: number;
    };
    recommendations: string[];
  }> {
    const response = await apiClient.post(
      '/diagnostics/history/compare',
      {
        historyId1,
        historyId2,
      },
      {
        timeout: 30000,
      }
    );

    return response.data.data;
  }

  /**
   * Mark case for follow-up
   */
  async markCaseForFollowUp(caseId: string, data: {
    followUpDate: Date;
    reason: string;
    notes: string;
  }): Promise<any> {
    const response = await apiClient.post(`/diagnostics/cases/${caseId}/follow-up`, data);
    return response.data;
  }

  /**
   * Mark case as completed
   */
  async markCaseAsCompleted(caseId: string, data: {
    notes: string;
    finalRecommendation: string;
    counselingPoints: string[];
  }): Promise<any> {
    const response = await apiClient.post(`/diagnostics/cases/${caseId}/complete`, data);
    return response.data;
  }

  /**
   * Generate case referral document
   */
  async generateCaseReferralDocument(caseId: string, data: {
    notes: string;
    physicianInfo: any;
  }): Promise<any> {
    const response = await apiClient.post(`/diagnostics/cases/${caseId}/referral/generate`, data);
    return response.data;
  }

  /**
   * Update referral document
   */
  async updateReferralDocument(caseId: string, content: string): Promise<any> {

    try {
      const response = await apiClient.put(`/diagnostics/cases/${caseId}/referral/update`, { content });

      return response.data;
    } catch (error: any) {
      console.error('diagnosticHistoryService.updateReferralDocument: API call failed', {
        caseId,
        error,
        status: error?.response?.status,
        data: error?.response?.data
      });
      throw error;
    }
  }

  /**
   * Get follow-up cases
   */
  async getFollowUpCases(options: {
    page?: number;
    limit?: number;
    overdue?: boolean;
  } = {}): Promise<{
    cases: any[];
    pagination: {
      current: number;
      total: number;
      count: number;
      totalCases: number;
    };
  }> {
    const response = await apiClient.get('/diagnostics/follow-up', {
      params: options,
    });
    return response.data.data;
  }

  /**
   * Download referral document
   */
  async downloadReferralDocument(caseId: string, format: 'pdf' | 'docx' | 'text' = 'pdf'): Promise<{
    content: string;
    format: string;
    filename: string;
  }> {
    const response = await apiClient.get(`/diagnostics/cases/${caseId}/referral/download`, {
      params: { format },
    });
    return response.data.data;
  }

  /**
   * Send referral electronically
   */
  async sendReferralElectronically(caseId: string, data: {
    physicianName: string;
    physicianEmail: string;
    specialty?: string;
    institution?: string;
    notes?: string;
  }): Promise<any> {

    try {
      const response = await apiClient.post(`/diagnostics/cases/${caseId}/referral/send`, data);

      return response.data;
    } catch (error: any) {
      console.error('diagnosticHistoryService.sendReferralElectronically: API call failed', {
        caseId,
        error,
        status: error?.response?.status,
        data: error?.response?.data
      });
      throw error;
    }
  }

  /**
   * Delete referral
   */
  async deleteReferral(caseId: string): Promise<any> {
    const response = await apiClient.delete(`/diagnostics/cases/${caseId}/referral`);
    return response.data;
  }
}

export const diagnosticHistoryService = new DiagnosticHistoryService();
export default diagnosticHistoryService;