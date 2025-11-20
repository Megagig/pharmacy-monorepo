import { api } from '../lib/api';

/**
 * SaaS Notifications Service
 * Handles notification channels, rules, templates, and history management
 */

// Types
export interface NotificationChannel {
    id: string;
    name: string;
    type: 'email' | 'sms' | 'push' | 'webhook';
    config: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationRule {
    id: string;
    name: string;
    description: string;
    trigger: string;
    conditions: Array<{
        field: string;
        operator: string;
        value: any;
    }>;
    actions: Array<{
        type: string;
        channelId: string;
        templateId?: string;
        config: Record<string, any>;
    }>;
    isActive: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    cooldown?: number;
    maxExecutions?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationTemplate {
    id: string;
    name: string;
    description: string;
    type: 'email' | 'sms' | 'push';
    subject?: string;
    body: string;
    variables: string[];
    category?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationHistory {
    id: string;
    ruleId: string;
    ruleName: string;
    channelId: string;
    channelType: string;
    recipient: string;
    status: 'sent' | 'failed' | 'pending';
    sentAt: Date;
    error?: string;
    metadata: Record<string, any>;
}

class SaaSNotificationsService {
    private baseUrl = '/admin/saas/notifications';

    // Channel Management
    async updateNotificationChannel(channelId: string, data: Partial<NotificationChannel>): Promise<NotificationChannel> {
        const response = await api.put(`${this.baseUrl}/channels/${channelId}`, data);
        return response.data;
    }

    // Rule Management
    async getNotificationRules(params?: {
        page?: number;
        limit?: number;
        isActive?: boolean;
        trigger?: string;
    }): Promise<{ rules: NotificationRule[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/rules`, { params });
        return response.data;
    }

    async createNotificationRule(data: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationRule> {
        const response = await api.post(`${this.baseUrl}/rules`, data);
        return response.data;
    }

    async updateNotificationRule(ruleId: string, data: Partial<NotificationRule>): Promise<NotificationRule> {
        const response = await api.put(`${this.baseUrl}/rules/${ruleId}`, data);
        return response.data;
    }

    async deleteNotificationRule(ruleId: string): Promise<{ success: boolean }> {
        const response = await api.delete(`${this.baseUrl}/rules/${ruleId}`);
        return response.data;
    }

    // Template Management
    async getNotificationTemplates(params?: {
        page?: number;
        limit?: number;
        type?: 'email' | 'sms' | 'push';
        category?: string;
        isActive?: boolean;
    }): Promise<{ templates: NotificationTemplate[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/templates`, { params });
        return response.data;
    }

    async createNotificationTemplate(data: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
        const response = await api.post(`${this.baseUrl}/templates`, data);
        return response.data;
    }

    async updateNotificationTemplate(templateId: string, data: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
        const response = await api.put(`${this.baseUrl}/templates/${templateId}`, data);
        return response.data;
    }

    async deleteNotificationTemplate(templateId: string): Promise<{ success: boolean }> {
        const response = await api.delete(`${this.baseUrl}/templates/${templateId}`);
        return response.data;
    }

    // History
    async getNotificationHistory(params?: {
        page?: number;
        limit?: number;
        status?: 'sent' | 'failed' | 'pending';
        startDate?: string;
        endDate?: string;
    }): Promise<{ history: NotificationHistory[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/history`, { params });
        return response.data;
    }

    // Test Notification
    async sendTestNotification(data: {
        channelId: string;
        templateId?: string;
        recipients: string[];
        subject?: string;
        body?: string;
        variables?: Record<string, any>;
    }): Promise<{ success: boolean; message: string }> {
        const response = await api.post(`${this.baseUrl}/test`, data);
        return response.data;
    }
}

export default new SaaSNotificationsService();
