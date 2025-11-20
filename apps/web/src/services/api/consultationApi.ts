import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface CreateConsultationRequestData {
  patientId: string;
  reason: string;
  priority?: 'normal' | 'urgent';
  patientPhone?: string;
  patientEmail?: string;
  preferredContactMethod?: 'chat' | 'phone' | 'email';
}

export interface ConsultationRequest {
  _id: string;
  patientId: string;
  reason: string;
  priority: 'normal' | 'urgent';
  status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'escalated';
  assignedTo?: string;
  conversationId?: string;
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  escalatedAt?: string;
  escalationLevel: number;
  patientPhone?: string;
  patientEmail?: string;
  preferredContactMethod: 'chat' | 'phone' | 'email';
  workplaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationRequestFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
  patientId?: string;
  startDate?: string;
  endDate?: string;
}

export const consultationApi = {
  /**
   * Create a new consultation request
   */
  createRequest: async (data: CreateConsultationRequestData) => {
    const response = await axios.post(`${API_BASE_URL}/chat/consultations`, data);
    return response.data;
  },

  /**
   * Get consultation requests with filters
   */
  getRequests: async (filters?: ConsultationRequestFilters) => {
    const response = await axios.get(`${API_BASE_URL}/chat/consultations`, {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get pending consultation requests (pharmacist queue)
   */
  getPendingRequests: async () => {
    const response = await axios.get(`${API_BASE_URL}/chat/consultations/queue`);
    return response.data;
  },

  /**
   * Get consultation queue statistics
   */
  getQueueStats: async () => {
    const response = await axios.get(`${API_BASE_URL}/chat/consultations/stats`);
    return response.data;
  },

  /**
   * Get consultation request by ID
   */
  getRequestById: async (id: string) => {
    const response = await axios.get(`${API_BASE_URL}/chat/consultations/${id}`);
    return response.data;
  },

  /**
   * Accept consultation request
   */
  acceptRequest: async (id: string) => {
    const response = await axios.post(`${API_BASE_URL}/chat/consultations/${id}/accept`);
    return response.data;
  },

  /**
   * Complete consultation request
   */
  completeRequest: async (id: string) => {
    const response = await axios.post(`${API_BASE_URL}/chat/consultations/${id}/complete`);
    return response.data;
  },

  /**
   * Cancel consultation request
   */
  cancelRequest: async (id: string, reason?: string) => {
    const response = await axios.post(`${API_BASE_URL}/chat/consultations/${id}/cancel`, {
      reason,
    });
    return response.data;
  },

  /**
   * Escalate consultation request
   */
  escalateRequest: async (id: string, reason?: string) => {
    const response = await axios.post(`${API_BASE_URL}/chat/consultations/${id}/escalate`, {
      reason,
    });
    return response.data;
  },
};

export default consultationApi;
