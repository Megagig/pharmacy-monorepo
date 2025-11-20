import { apiClient } from './apiClient';

// ========================================
// TYPES & INTERFACES
// ========================================

export interface LabIntegration {
  _id: string;
  workplaceId: string;
  patientId: string | {
    _id: string;
    firstName: string;
    lastName: string;
    otherNames?: string;
    mrn?: string;
    age?: number;
    gender?: string;
    phone?: string;
    email?: string;
  };
  pharmacistId: string;
  labResultIds: string[];
  source: 'manual_entry' | 'pdf_upload' | 'image_upload' | 'fhir_import' | 'lis_integration';
  sourceMetadata?: {
    labName?: string;
    reportId?: string;
    uploadedFileName?: string;
    uploadMethod?: string;
    fhirResourceId?: string;
  };
  aiInterpretation?: AIInterpretation;
  aiProcessingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  aiProcessingError?: string;
  therapyRecommendations: TherapyRecommendation[];
  safetyChecks: SafetyCheck[];
  pharmacistReview?: PharmacistReview;
  medicationAdjustments: MedicationAdjustment[];
  status: 'draft' | 'pending_interpretation' | 'pending_review' | 'pending_approval' | 'approved' | 'implemented' | 'completed' | 'cancelled';
  urgency?: 'stat' | 'urgent' | 'routine';
  priority?: 'routine' | 'urgent' | 'critical'; // Deprecated - use urgency instead
  patientConsent?: {
    consentGiven: boolean;
    consentDate: Date;
    consentMethod: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AIInterpretation {
  summary: string;
  clinicalSignificance: 'normal' | 'abnormal_minor' | 'abnormal_significant' | 'critical';
  confidence: number;
  differentialDiagnosis?: string[];
  recommendedActions: string[];
  interpretedAt: Date;
  modelUsed: string;
}

export interface TherapyRecommendation {
  medicationName: string;
  action: 'start' | 'stop' | 'adjust_dose' | 'monitor' | 'continue';
  currentDose?: string;
  recommendedDose?: string;
  rationale: string;
  evidenceLevel: 'high' | 'moderate' | 'low';
  priority: 'critical' | 'high' | 'medium' | 'low';
  targetLabValues?: {
    testCode: string;
    targetRange: string;
  };
}

export interface SafetyCheck {
  checkType: 'allergy' | 'drug_interaction' | 'contraindication' | 'renal_dosing' | 'hepatic_dosing' | 'duplicate_therapy';
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  description: string;
  affectedMedications: string[];
  recommendation: string;
  checkedAt: Date;
}

export interface PharmacistReview {
  reviewedBy: string | {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewedAt: Date;
  decision: 'approved' | 'rejected' | 'modified' | 'escalated';
  clinicalNotes: string;
  modifications?: string;
  rejectionReason?: string;
  escalationReason?: string;
  escalatedTo?: string;
}

export interface MedicationAdjustment {
  medicationId: string;
  medicationName: string;
  adjustmentType: 'dose_change' | 'frequency_change' | 'discontinuation' | 'new_medication';
  previousValue?: string;
  newValue: string;
  implementedBy: string;
  implementedAt: Date;
  patientNotified: boolean;
}

export interface LabTrendData {
  testCode: string;
  testName: string;
  unit: string;
  referenceRange: string;
  dataPoints: {
    date: Date;
    value: number;
    isAbnormal: boolean;
    therapyMarker?: {
      medicationName: string;
      action: string;
    };
  }[];
  trend: 'improving' | 'stable' | 'worsening';
  percentChange: number;
}

export interface CreateLabIntegrationRequest {
  patientId: string;
  labResultIds: string[];
  source: 'manual_entry' | 'pdf_upload' | 'image_upload' | 'fhir_import' | 'lis_integration';
  urgency?: 'stat' | 'urgent' | 'routine';
  notes?: string;
  indication?: string;
  clinicalQuestion?: string;
  labName?: string;
  reportId?: string;
  receivedAt?: Date;
  targetRange?: {
    parameter: string;
    target: string;
    goal: string;
  };
}

export interface ApproveRecommendationsRequest {
  decision: 'approved' | 'rejected' | 'modified' | 'escalated';
  clinicalNotes: string;
  modifications?: string;
  rejectionReason?: string;
  escalationReason?: string;
  escalatedTo?: string;
}

export interface ImplementAdjustmentsRequest {
  adjustments: {
    medicationId: string;
    medicationName: string;
    adjustmentType: 'dose_change' | 'frequency_change' | 'discontinuation' | 'new_medication';
    previousValue?: string;
    newValue: string;
  }[];
  notifyPatient: boolean;
}

// ========================================
// LAB INTEGRATION SERVICE
// ========================================

class LabIntegrationService {
  private baseUrl = '/lab-integration';

  /**
   * Create a new lab integration case
   */
  async createLabIntegration(data: CreateLabIntegrationRequest): Promise<LabIntegration> {
    console.log('Creating lab integration with data:', data);
    try {
      const response = await apiClient.post<{ success: boolean; data: LabIntegration }>(
        this.baseUrl,
        data
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Lab integration creation failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        requestData: data
      });
      throw error;
    }
  }

  /**
   * Get lab integration by ID
   */
  async getLabIntegrationById(id: string): Promise<LabIntegration> {
    const response = await apiClient.get<{ success: boolean; data: LabIntegration }>(
      `${this.baseUrl}/${id}`
    );
    return response.data.data;
  }

  /**
   * Get lab integrations for a patient
   */
  async getLabIntegrationsByPatient(patientId: string): Promise<LabIntegration[]> {
    const response = await apiClient.get<{ success: boolean; data: LabIntegration[] }>(
      `${this.baseUrl}/patient/${patientId}`
    );
    return response.data.data;
  }

  /**
   * Get pending reviews for the current workplace
   */
  async getPendingReviews(): Promise<LabIntegration[]> {
    const response = await apiClient.get<{ success: boolean; data: LabIntegration[] }>(
      `${this.baseUrl}/pending-reviews`
    );
    return response.data.data;
  }

  /**
   * Get critical cases requiring immediate attention
   */
  async getCriticalCases(): Promise<LabIntegration[]> {
    const response = await apiClient.get<{ success: boolean; data: LabIntegration[] }>(
      `${this.baseUrl}/critical-cases`
    );
    return response.data.data;
  }

  /**
   * Get cases requiring escalation
   */
  async getCasesRequiringEscalation(): Promise<LabIntegration[]> {
    const response = await apiClient.get<{ success: boolean; data: LabIntegration[] }>(
      `${this.baseUrl}/escalation-required`
    );
    return response.data.data;
  }

  /**
   * Get approved lab integration cases
   */
  async getApprovedCases(): Promise<LabIntegration[]> {
    const response = await apiClient.get<{ success: boolean; data: LabIntegration[] }>(
      `${this.baseUrl}/approved`
    );
    return response.data.data;
  }

  /**
   * Request AI interpretation for a lab integration
   */
  async requestAIInterpretation(id: string): Promise<LabIntegration> {
    const response = await apiClient.post<{ success: boolean; data: LabIntegration }>(
      `${this.baseUrl}/${id}/request-interpretation`
    );
    return response.data.data;
  }

  /**
   * Approve or reject therapy recommendations
   */
  async approveRecommendations(
    id: string,
    data: ApproveRecommendationsRequest
  ): Promise<LabIntegration> {
    const response = await apiClient.post<{ success: boolean; data: LabIntegration }>(
      `${this.baseUrl}/${id}/approve`,
      data
    );
    return response.data.data;
  }

  /**
   * Implement medication adjustments
   */
  async implementAdjustments(
    id: string,
    data: ImplementAdjustmentsRequest
  ): Promise<LabIntegration> {
    const response = await apiClient.post<{ success: boolean; data: LabIntegration }>(
      `${this.baseUrl}/${id}/implement`,
      data
    );
    return response.data.data;
  }

  /**
   * Get lab trends for a patient
   */
  async getLabTrends(
    patientId: string,
    testCode: string,
    daysBack: number = 90
  ): Promise<LabTrendData> {
    const response = await apiClient.get<{ success: boolean; data: LabTrendData }>(
      `${this.baseUrl}/patient/${patientId}/trends/${testCode}`,
      { params: { daysBack } }
    );
    return response.data.data;
  }
}

export const labIntegrationService = new LabIntegrationService();
export default labIntegrationService;

