import { apiClient } from './apiClient';

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  enabled: boolean;
  config: {
    provider?: string;
    apiKey?: string;
    fromAddress?: string;
    fromNumber?: string;
    webhookUrl?: string;
  };
  dailyLimit: number;
  monthlyLimit: number;
  usage: {
    daily: number;
    monthly: number;
  };
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  conditions: any[];
  actions: any[];
  isActive: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldownPeriod: number;
  maxExecutions: number;
  executionCount: number;
  lastExecuted?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  channel: 'email' | 'sms' | 'push' | 'whatsapp';
  subject?: string;
  body: string;
  variables: any[];
  isActive: boolean;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class NotificationManagementService {
  private baseUrl = '/notification-management';

  // ============ CHANNELS ============

  async getChannels(): Promise<ApiResponse<{ channels: NotificationChannel[] }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/channels`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch channels',
      };
    }
  }

  async createChannel(data: Partial<NotificationChannel>): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/channels`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create channel',
      };
    }
  }

  async updateChannel(channelId: string, data: Partial<NotificationChannel>): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/channels/${channelId}`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update channel',
      };
    }
  }

  async deleteChannel(channelId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/channels/${channelId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete channel',
      };
    }
  }

  // ============ RULES ============

  async getRules(): Promise<ApiResponse<{ rules: NotificationRule[] }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/rules`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch rules',
      };
    }
  }

  async createRule(data: Partial<NotificationRule>): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/rules`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create rule',
      };
    }
  }

  async updateRule(ruleId: string, data: Partial<NotificationRule>): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/rules/${ruleId}`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update rule',
      };
    }
  }

  async deleteRule(ruleId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/rules/${ruleId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete rule',
      };
    }
  }

  async toggleRule(ruleId: string, isActive: boolean): Promise<ApiResponse> {
    try {
      const response = await apiClient.patch(`${this.baseUrl}/rules/${ruleId}/toggle`, { isActive });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to toggle rule',
      };
    }
  }

  // ============ TEMPLATES ============

  async getTemplates(): Promise<ApiResponse<{ templates: NotificationTemplate[] }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/templates`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch templates',
      };
    }
  }

  async createTemplate(data: Partial<NotificationTemplate>): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/templates`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create template',
      };
    }
  }

  async updateTemplate(templateId: string, data: Partial<NotificationTemplate>): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/templates/${templateId}`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update template',
      };
    }
  }

  async deleteTemplate(templateId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/templates/${templateId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete template',
      };
    }
  }

  // ============ HISTORY ============

  async getHistory(params?: { limit?: number; status?: string; channel?: string }): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/history`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch history',
      };
    }
  }

  // ============ TEST ============

  async sendTestNotification(data: { channelId: string; templateId: string; recipients: string[] }): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/test`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send test notification',
      };
    }
  }
}

export const notificationManagementService = new NotificationManagementService();
