import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface ModerationFilters {
  status?: 'pending' | 'reviewed' | 'dismissed';
  reason?: string;
  before?: string;
  after?: string;
  limit?: number;
  offset?: number;
}

export const moderationApi = {
  /**
   * Get moderation queue (flagged messages)
   */
  async getModerationQueue(filters: ModerationFilters = {}) {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.reason) params.append('reason', filters.reason);
    if (filters.before) params.append('before', filters.before);
    if (filters.after) params.append('after', filters.after);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await axios.get(
      `${API_BASE_URL}/chat/moderation/queue?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },

  /**
   * Report a message
   */
  async reportMessage(
    messageId: string,
    reason: 'inappropriate' | 'spam' | 'harassment' | 'privacy_violation' | 'other',
    description?: string
  ) {
    const response = await axios.post(
      `${API_BASE_URL}/chat/messages/${messageId}/report`,
      { reason, description },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },

  /**
   * Dismiss a flag
   */
  async dismissFlag(messageId: string, flagId: string, reviewNotes?: string) {
    const response = await axios.post(
      `${API_BASE_URL}/chat/messages/${messageId}/flags/${flagId}/dismiss`,
      { reviewNotes },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },

  /**
   * Delete a message (admin)
   */
  async deleteMessage(messageId: string) {
    const response = await axios.delete(
      `${API_BASE_URL}/chat/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data;
  },

  /**
   * Get communication analytics
   */
  async getAnalytics(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await axios.get(
      `${API_BASE_URL}/chat/analytics?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },
};
