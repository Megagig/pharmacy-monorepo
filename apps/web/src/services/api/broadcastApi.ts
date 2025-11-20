import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface CreateBroadcastData {
  title: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  audienceType: 'all' | 'roles' | 'specific';
  roles?: string[];
  userIds?: string[];
}

export const broadcastApi = {
  /**
   * Create a broadcast message
   */
  createBroadcast: async (data: CreateBroadcastData) => {
    const response = await axios.post(`${API_BASE_URL}/chat/broadcasts`, data);
    return response.data;
  },

  /**
   * Get broadcast list
   */
  getBroadcasts: async () => {
    const response = await axios.get(`${API_BASE_URL}/chat/broadcasts`);
    return response.data;
  },

  /**
   * Get broadcast statistics
   */
  getBroadcastStats: async (broadcastId: string) => {
    const response = await axios.get(`${API_BASE_URL}/chat/broadcasts/${broadcastId}/stats`);
    return response.data;
  },
};

export default broadcastApi;
