import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface CreateReminderData {
  patientId: string;
  medicationId?: string;
  medicationName: string;
  dosage: string;
  instructions?: string;
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
  times: string[];
  daysOfWeek?: number[];
  customSchedule?: string;
  startDate: string;
  endDate?: string;
  missedDoseThreshold?: number;
  notifyPharmacistOnMissed?: boolean;
  pharmacistId?: string;
}

export interface UpdateReminderData {
  medicationName?: string;
  dosage?: string;
  instructions?: string;
  frequency?: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
  times?: string[];
  daysOfWeek?: number[];
  customSchedule?: string;
  endDate?: string;
  isActive?: boolean;
  isPaused?: boolean;
  missedDoseThreshold?: number;
  notifyPharmacistOnMissed?: boolean;
  pharmacistId?: string;
}

export interface ReminderFilters {
  patientId?: string;
  isActive?: boolean;
  isPaused?: boolean;
  medicationId?: string;
  startDate?: string;
  endDate?: string;
}

export const reminderApi = {
  /**
   * Create a new reminder
   */
  createReminder: async (data: CreateReminderData) => {
    const response = await axios.post(`${API_BASE_URL}/chat/reminders`, data);
    return response.data;
  },

  /**
   * Get reminders with filters
   */
  getReminders: async (filters?: ReminderFilters) => {
    const response = await axios.get(`${API_BASE_URL}/chat/reminders`, {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get reminder by ID
   */
  getReminderById: async (id: string) => {
    const response = await axios.get(`${API_BASE_URL}/chat/reminders/${id}`);
    return response.data;
  },

  /**
   * Update reminder
   */
  updateReminder: async (id: string, data: UpdateReminderData) => {
    const response = await axios.put(`${API_BASE_URL}/chat/reminders/${id}`, data);
    return response.data;
  },

  /**
   * Delete reminder
   */
  deleteReminder: async (id: string) => {
    const response = await axios.delete(`${API_BASE_URL}/chat/reminders/${id}`);
    return response.data;
  },

  /**
   * Confirm medication taken
   */
  confirmMedication: async (id: string, scheduledTime: string) => {
    const response = await axios.post(`${API_BASE_URL}/chat/reminders/${id}/confirm`, {
      scheduledTime,
    });
    return response.data;
  },
};

export default reminderApi;
