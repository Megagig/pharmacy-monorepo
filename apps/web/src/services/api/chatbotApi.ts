import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface ChatbotMessageRequest {
  sessionId: string;
  message: string;
  userId?: string;
  workplaceId?: string;
}

export interface ChatbotResponse {
  message: string;
  confidence: number;
  suggestedActions?: Array<{
    type: 'escalate' | 'faq' | 'link' | 'consultation';
    label: string;
    data?: any;
  }>;
  requiresEscalation: boolean;
}

export const chatbotApi = {
  /**
   * Send message to chatbot
   */
  sendMessage: async (data: ChatbotMessageRequest): Promise<{ success: boolean; data: ChatbotResponse }> => {
    const response = await axios.post(`${API_BASE_URL}/chatbot/message`, data);
    return response.data;
  },

  /**
   * Escalate conversation to human
   */
  escalate: async (sessionId: string, reason: string) => {
    const response = await axios.post(`${API_BASE_URL}/chatbot/escalate`, {
      sessionId,
      reason,
    });
    return response.data;
  },

  /**
   * Get chatbot analytics
   */
  getAnalytics: async (startDate?: string, endDate?: string) => {
    const response = await axios.get(`${API_BASE_URL}/chatbot/analytics`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  /**
   * Clear chatbot session
   */
  clearSession: async (sessionId: string) => {
    const response = await axios.delete(`${API_BASE_URL}/chatbot/session/${sessionId}`);
    return response.data;
  },
};

export default chatbotApi;
