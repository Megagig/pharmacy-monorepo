import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface CreatePrescriptionDiscussionData {
  prescriptionId: string;
  patientId: string;
  doctorId: string;
  prescriptionDetails?: {
    medicationName?: string;
    rxNumber?: string;
  };
}

export interface PrescriptionUpdateData {
  field: string;
  oldValue?: string;
  newValue: string;
}

export const prescriptionDiscussionApi = {
  /**
   * Create a prescription discussion
   */
  createDiscussion: async (data: CreatePrescriptionDiscussionData) => {
    const response = await axios.post(`${API_BASE_URL}/chat/prescription-discussions`, data);
    return response.data;
  },

  /**
   * Post prescription update to discussion
   */
  postUpdate: async (prescriptionId: string, updateData: PrescriptionUpdateData) => {
    const response = await axios.post(
      `${API_BASE_URL}/chat/prescription-discussions/${prescriptionId}/update`,
      updateData
    );
    return response.data;
  },

  /**
   * Resolve prescription discussion
   */
  resolveDiscussion: async (conversationId: string, resolutionNote?: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/chat/prescription-discussions/${conversationId}/resolve`,
      { resolutionNote }
    );
    return response.data;
  },

  /**
   * Get prescription discussion by prescription ID
   */
  getDiscussionByPrescriptionId: async (prescriptionId: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/chat/prescription-discussions/prescription/${prescriptionId}`
    );
    return response.data;
  },
};

export default prescriptionDiscussionApi;
