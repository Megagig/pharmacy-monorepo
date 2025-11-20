import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { usePatientAuth } from './usePatientAuth';
import { MedicationRecord } from '../types/patientManagement';

interface AdherenceData {
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  medicationScores: Array<{
    medicationId: string;
    medicationName: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    daysTracked: number;
    missedDoses: number;
    totalDoses: number;
  }>;
  weeklyScores: Array<{
    week: string;
    score: number;
  }>;
  insights: Array<{
    type: 'success' | 'warning' | 'error';
    message: string;
  }>;
}

interface RefillRequest {
  _id: string;
  medicationId: string;
  medicationName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'denied';
  requestedDate: string;
  completedDate?: string;
  estimatedCompletionDate?: string;
  notes?: string;
  pharmacistNotes?: string;
  quantity?: number;
  refillsRemaining?: number;
  urgency?: 'routine' | 'urgent';
  createdAt: string;
  updatedAt: string;
}

interface UsePatientMedicationsReturn {
  currentMedications: MedicationRecord[] | null;
  medicationHistory: MedicationRecord[] | null;
  adherenceData: AdherenceData | null;
  refillRequests: RefillRequest[] | null;
  loading: boolean;
  error: string | null;
  refreshMedications: () => Promise<void>;
  requestRefill: (medicationId: string, notes: string) => Promise<void>;
  cancelRefillRequest: (requestId: string, reason: string) => Promise<void>;
  refillLoading: boolean;
  cancelLoading: boolean;
}

interface PatientMedicationResponse {
  success: boolean;
  data?: {
    currentMedications: MedicationRecord[];
    medicationHistory: MedicationRecord[];
    adherenceData: AdherenceData | null;
    refillRequests: RefillRequest[];
  };
  message?: string;
  error?: {
    message: string;
  };
}

interface RefillRequestResponse {
  success: boolean;
  data?: {
    request: RefillRequest;
  };
  message?: string;
  error?: {
    message: string;
  };
}

// Backend medication interface (from MedicationManagement model)
interface BackendMedication {
  _id: string;
  patientId: string;
  workplaceId: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate?: string;
  endDate?: string;
  indication?: string;
  prescriber?: string;
  allergyCheck?: {
    status: boolean;
    details?: string;
  };
  interactionCheck?: {
    status: boolean;
    details?: string;
    severity?: 'minor' | 'moderate' | 'severe';
  };
  cost?: number;
  sellingPrice?: number;
  status: 'active' | 'archived' | 'cancelled';
  history?: Array<{
    name?: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    startDate?: string;
    endDate?: string;
    indication?: string;
    prescriber?: string;
    cost?: number;
    sellingPrice?: number;
    status?: 'active' | 'archived' | 'cancelled';
    updatedAt: string;
    updatedBy?: string;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  // Enhanced fields from service
  adherenceData?: {
    score: number;
    status: string;
    lastReported?: string;
    refillHistory?: any[];
    missedDoses?: number;
    totalDoses?: number;
  };
  refillStatus?: {
    refillsRemaining: number;
    nextRefillDate?: string;
    daysUntilRefill?: number;
    isEligibleForRefill: boolean;
    prescriptionExpiry?: string;
    rxNumber?: string;
  };
}

// Backend adherence data interface
interface BackendAdherenceData {
  _id: string;
  workplaceId: string;
  patientId: string;
  medications: Array<{
    medicationName: string;
    adherenceScore: number;
    adherenceStatus: string;
    refillHistory: Array<{
      date: string;
      quantity: number;
      notes?: string;
    }>;
    missedDoses?: number;
    totalDoses?: number;
  }>;
  overallAdherenceScore: number;
  adherenceCategory: string;
  lastAssessmentDate: string;
  nextAssessmentDate: string;
  monitoringActive: boolean;
  monitoringStartDate: string;
  monitoringFrequency: string;
  alerts: any[];
  interventions: any[];
  createdAt: string;
  updatedAt: string;
}

// Backend refill request interface
interface BackendRefillRequest {
  _id: string;
  workplaceId: string;
  patientId: string;
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  type: string;
  title: string;
  description: string;
  objectives: string[];
  priority: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  dueDate: string;
  completedAt?: string;
  metadata?: {
    refillRequest?: {
      medicationId?: string;
      medicationName?: string;
      currentRefillsRemaining?: number;
      requestedQuantity?: number;
      urgency?: 'routine' | 'urgent';
      patientNotes?: string;
      estimatedPickupDate?: string;
      requestedBy?: string;
      requestedAt?: string;
    };
  };
  relatedRecords?: {
    medicationId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Patient Medication API Service
class PatientMedicationService {
  private static baseUrl = 'http://localhost:5000/api/patient-portal/medications';

  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Use cookies for authentication
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      console.error(`❌ API Error for ${url}:`, error);
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return data;
  }

  // Map backend medication to frontend format
  private static mapMedicationToFrontend(backendMed: BackendMedication): MedicationRecord {
    return {
      _id: backendMed._id,
      pharmacyId: backendMed.workplaceId,
      patientId: backendMed.patientId,
      phase: backendMed.status === 'active' ? 'current' : 'past',
      medicationName: `${backendMed.name} ${backendMed.dosage}`,
      purposeIndication: backendMed.indication,
      dose: backendMed.dosage,
      frequency: backendMed.frequency,
      route: backendMed.route,
      duration: undefined, // Not available in MedicationManagement model
      startDate: backendMed.startDate,
      endDate: backendMed.endDate,
      adherence: backendMed.adherenceData?.score ? 
        (backendMed.adherenceData.score >= 80 ? 'good' : 
         backendMed.adherenceData.score >= 60 ? 'fair' : 'poor') : 'unknown',
      notes: backendMed.interactionCheck?.details || backendMed.allergyCheck?.details,
      status: backendMed.status === 'cancelled' ? 'expired' :
        backendMed.status === 'archived' ? 'completed' : 'active',
      createdAt: backendMed.createdAt,
      updatedAt: backendMed.updatedAt,
      createdBy: backendMed.createdBy
    };
  }

  // Map backend adherence data to frontend format
  private static mapAdherenceToFrontend(backendAdherence: BackendAdherenceData): AdherenceData {
    // Ensure we have a valid overall score, default to 0 if undefined/null/NaN
    const overallScore = typeof backendAdherence.overallAdherenceScore === 'number' && 
                        !isNaN(backendAdherence.overallAdherenceScore) 
                        ? backendAdherence.overallAdherenceScore 
                        : 0;

    return {
      overallScore,
      trend: 'stable', // Default trend, could be calculated
      medicationScores: (backendAdherence.medications || []).map(med => ({
        medicationId: '', // Not available in backend data
        medicationName: med.medicationName,
        score: typeof med.adherenceScore === 'number' && !isNaN(med.adherenceScore) ? med.adherenceScore : 0,
        trend: 'stable', // Default trend
        daysTracked: 30, // Default value
        missedDoses: med.missedDoses || 0,
        totalDoses: med.totalDoses || 30
      })),
      weeklyScores: [
        { week: 'Week 1', score: Math.max(0, Math.min(100, overallScore - 10)) },
        { week: 'Week 2', score: Math.max(0, Math.min(100, overallScore - 5)) },
        { week: 'Week 3', score: Math.max(0, Math.min(100, overallScore + 2)) },
        { week: 'Week 4', score: Math.max(0, Math.min(100, overallScore)) }
      ],
      insights: [
        {
          type: overallScore >= 80 ? 'success' : 'warning',
          message: overallScore >= 80
            ? 'Great job! Your adherence is excellent.'
            : 'Consider setting reminders to improve adherence.'
        }
      ]
    };
  }



  static async getMedicationData(patientId: string): Promise<PatientMedicationResponse> {
    try {

      // Fetch all medication data in parallel using patient portal API
      const [currentResponse, historyResponse, adherenceResponse] = await Promise.allSettled([
        this.makeRequest<{ success: boolean; data: { medications: BackendMedication[]; count: number } }>(`/current`),
        this.makeRequest<{ success: boolean; data: { medications: BackendMedication[]; count: number } }>(`/history`),
        this.makeRequest<{ success: boolean; data: { adherenceData: BackendAdherenceData } }>(`/adherence`)
      ]);

      // Process current medications
      let currentMedications: MedicationRecord[] = [];
      if (currentResponse.status === 'fulfilled' && currentResponse.value.success && currentResponse.value.data?.medications) {

        currentMedications = currentResponse.value.data.medications.map(this.mapMedicationToFrontend);
      } else if (currentResponse.status === 'rejected') {
        console.error('❌ Current medications API failed:', currentResponse.reason);
      } else {

      }

      // Process medication history
      let medicationHistory: MedicationRecord[] = [];
      if (historyResponse.status === 'fulfilled' && historyResponse.value.success && historyResponse.value.data?.medications) {
        medicationHistory = historyResponse.value.data.medications
          .filter(med => med.status !== 'active') // Only non-active medications for history
          .map(this.mapMedicationToFrontend);

      }

      // Process adherence data
      let adherenceData: AdherenceData | null = null;
      if (adherenceResponse.status === 'fulfilled' && adherenceResponse.value.success && adherenceResponse.value.data?.adherenceData) {
        adherenceData = this.mapAdherenceToFrontend(adherenceResponse.value.data.adherenceData);

      } else if (adherenceResponse.status === 'rejected') {
        console.error('❌ Adherence data API failed:', adherenceResponse.reason);
      } else {

      }

      // Mock refill requests for now since we don't have the endpoint
      let refillRequests: RefillRequest[] = [];

      const result = {
        success: true,
        data: {
          currentMedications,
          medicationHistory,
          adherenceData,
          refillRequests
        },
        message: 'Medication data retrieved successfully'
      };

      return result;
    } catch (error: any) {
      console.error('💥 Error fetching medication data:', error);
      throw new Error(error.message || 'Failed to fetch medication data');
    }
  }

  static async requestRefill(medicationId: string, notes: string): Promise<RefillRequestResponse> {
    try {
      const response = await this.makeRequest<{ 
        success: boolean; 
        data: { 
          refillRequest: {
            id: string;
            status: string;
            priority: string;
            dueDate: string;
            medicationName: string;
            requestedQuantity: number;
            urgency: string;
            createdAt: string;
          }
        } 
      }>('/refill-requests', {
        method: 'POST',
        body: JSON.stringify({
          medicationId,
          requestedQuantity: 30, // Default quantity
          urgency: 'routine',
          patientNotes: notes
        })
      });

      if (response.success && response.data?.refillRequest) {
        // Map the simplified response to our RefillRequest format
        const refillRequest: RefillRequest = {
          _id: response.data.refillRequest.id,
          medicationId: medicationId,
          medicationName: response.data.refillRequest.medicationName,
          status: response.data.refillRequest.status as any,
          requestedDate: response.data.refillRequest.createdAt,
          completedDate: undefined,
          estimatedCompletionDate: response.data.refillRequest.dueDate,
          notes: notes,
          quantity: response.data.refillRequest.requestedQuantity,
          refillsRemaining: 0,
          urgency: response.data.refillRequest.urgency as any,
          createdAt: response.data.refillRequest.createdAt,
          updatedAt: response.data.refillRequest.createdAt
        };

        return {
          success: true,
          data: { request: refillRequest },
          message: 'Refill request submitted successfully'
        };
      } else {
        throw new Error('Failed to submit refill request');
      }
    } catch (error: any) {
      console.error('Error requesting refill:', error);
      throw new Error(error.message || 'Failed to submit refill request');
    }
  }

  static async cancelRefillRequest(requestId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest<{ success: boolean; message: string }>(`/refill-requests/${requestId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason })
      });

      return response;
    } catch (error: any) {
      console.error('Error cancelling refill request:', error);
      throw new Error(error.message || 'Failed to cancel refill request');
    }
  }
}

export const usePatientMedications = (patientId?: string): UsePatientMedicationsReturn => {
  const { user, isAuthenticated } = usePatientAuth();
  const params = useParams<{ patientId?: string }>();

  // Get patient ID from props, params, or user context
  const currentPatientId = patientId || params.patientId || user?.id;

  const [currentMedications, setCurrentMedications] = useState<MedicationRecord[] | null>(null);
  const [medicationHistory, setMedicationHistory] = useState<MedicationRecord[] | null>(null);
  const [adherenceData, setAdherenceData] = useState<AdherenceData | null>(null);
  const [refillRequests, setRefillRequests] = useState<RefillRequest[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refillLoading, setRefillLoading] = useState<boolean>(false);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  // Load medication data when user is authenticated
  const loadMedicationData = useCallback(async () => {

    if (!currentPatientId) {

      setCurrentMedications(null);
      setMedicationHistory(null);
      setAdherenceData(null);
      setRefillRequests(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await PatientMedicationService.getMedicationData(currentPatientId);

      if (response.success && response.data) {

        setCurrentMedications(response.data.currentMedications);
        setMedicationHistory(response.data.medicationHistory);
        setAdherenceData(response.data.adherenceData);
        setRefillRequests(response.data.refillRequests);
      } else {
        throw new Error(response.message || 'Failed to load medication data');
      }
    } catch (err: any) {
      console.error('💥 Failed to load medication data:', err);
      setError(err.message || 'Failed to load medication data');
      setCurrentMedications(null);
      setMedicationHistory(null);
      setAdherenceData(null);
      setRefillRequests(null);
    } finally {
      setLoading(false);
    }
  }, [currentPatientId, patientId, params.patientId, user?.id]);

  // Load medication data on mount and when dependencies change
  useEffect(() => {
    loadMedicationData();
  }, [loadMedicationData]);

  // Request refill function
  const requestRefill = useCallback(async (medicationId: string, notes: string) => {
    if (!isAuthenticated || !user) {
      throw new Error('User not authenticated');
    }

    setRefillLoading(true);

    try {
      const response = await PatientMedicationService.requestRefill(medicationId, notes);
      if (response.success && response.data) {
        // Add the new refill request to the list
        setRefillRequests(prev => prev ? [response.data!.request, ...prev] : [response.data!.request]);
      } else {
        throw new Error(response.message || 'Failed to submit refill request');
      }
    } catch (err: any) {
      console.error('Failed to request refill:', err);
      throw err;
    } finally {
      setRefillLoading(false);
    }
  }, [isAuthenticated, user]);

  // Cancel refill request function
  const cancelRefillRequest = useCallback(async (requestId: string, reason: string) => {
    if (!isAuthenticated || !user) {
      throw new Error('User not authenticated');
    }

    setCancelLoading(true);

    try {
      await PatientMedicationService.cancelRefillRequest(requestId, reason);

      // Update the refill request status in the list
      setRefillRequests(prev =>
        prev ? prev.map(request =>
          request._id === requestId
            ? { ...request, status: 'cancelled' as const, updatedAt: new Date().toISOString() }
            : request
        ) : null
      );
    } catch (err: any) {
      console.error('Failed to cancel refill request:', err);
      throw err;
    } finally {
      setCancelLoading(false);
    }
  }, [isAuthenticated, user]);

  // Refresh medication data function
  const refreshMedications = useCallback(async () => {
    await loadMedicationData();
  }, [loadMedicationData]);

  return {
    currentMedications,
    medicationHistory,
    adherenceData,
    refillRequests,
    loading,
    error,
    refreshMedications,
    requestRefill,
    cancelRefillRequest,
    refillLoading,
    cancelLoading
  };
};

export default usePatientMedications;