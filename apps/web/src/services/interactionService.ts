import axios from 'axios';

// Safe environment variable access for Vite
const getEnvVar = (key: string, defaultValue: string): string => {
  try {
    return (import.meta.env as any)?.[key] || defaultValue;
  } catch {
    return defaultValue;
  }
};

const API_BASE_URL = getEnvVar('VITE_API_BASE_URL', 'http://localhost:5000/api');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface MedicationInput {
  medicationId?: string;
  name: string;
  rxcui?: string;
  dosage?: string;
  frequency?: string;
}

export interface InteractionCheckRequest {
  patientId: string;
  medications: MedicationInput[];
  checkType?: 'manual' | 'automatic' | 'scheduled';
  checkTrigger?: string;
}

export interface ReviewInteractionRequest {
  action: 'approve' | 'modify' | 'reject' | 'monitor';
  reason: string;
  modificationSuggestions?: string;
  monitoringParameters?: string;
  notes?: string;
}

export class InteractionService {
  /**
   * Check interactions for a list of medications
   */
  async checkInteractions(request: InteractionCheckRequest): Promise<any> {
    const response = await api.post('/interactions/check', request);
    return response.data;
  }

  /**
   * Check interactions for all active medications of a patient
   */
  async checkPatientMedications(patientId: string, checkType: string = 'manual'): Promise<any> {
    const response = await api.post('/interactions/check-patient', {
      patientId,
      checkType,
    });
    return response.data;
  }

  /**
   * Batch check interactions for multiple patients
   */
  async batchCheckInteractions(patientIds: string[]): Promise<any> {
    const response = await api.post('/interactions/batch-check', {
      patientIds,
    });
    return response.data;
  }

  /**
   * Get interaction details by ID
   */
  async getInteraction(interactionId: string): Promise<any> {
    const response = await api.get(`/interactions/${interactionId}`);
    return response.data;
  }

  /**
   * Get patient interaction history
   */
  async getPatientInteractions(
    patientId: string,
    includeResolved: boolean = false,
    limit: number = 50
  ): Promise<any> {
    const response = await api.get(`/interactions/patient/${patientId}`, {
      params: { includeResolved, limit },
    });
    return response.data;
  }

  /**
   * Get pending interactions requiring pharmacist review
   */
  async getPendingReviews(limit: number = 100): Promise<any> {
    const response = await api.get('/interactions/pending-reviews', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get critical interactions for dashboard
   */
  async getCriticalInteractions(from?: string, to?: string): Promise<any> {
    const params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const response = await api.get('/interactions/critical', { params });
    return response.data;
  }

  /**
   * Review an interaction (pharmacist action)
   */
  async reviewInteraction(interactionId: string, review: ReviewInteractionRequest): Promise<any> {
    const response = await api.post(`/interactions/${interactionId}/review`, review);
    return response.data;
  }

  /**
   * Mark interaction as acknowledged by patient
   */
  async acknowledgeInteraction(interactionId: string): Promise<any> {
    const response = await api.post(`/interactions/${interactionId}/acknowledge`);
    return response.data;
  }

  /**
   * Get interaction analytics and statistics
   */
  async getInteractionAnalytics(from?: string, to?: string): Promise<any> {
    const params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const response = await api.get('/interactions/analytics', { params });
    return response.data;
  }
}

// Create singleton instance
export const interactionService = new InteractionService();
export default interactionService;