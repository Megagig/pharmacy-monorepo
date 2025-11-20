import { apiClient } from './apiClient';

export interface NotificationPreferences {
    email: boolean;
    sms: boolean;
    push: boolean;
    followUpReminders: boolean;
    criticalAlerts: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
}

export interface CriticalAlert {
    type: 'drug_interaction' | 'contraindication' | 'high_severity_dtp' | 'overdue_follow_up';
    severity: 'critical' | 'major' | 'moderate';
    patientId: string;
    reviewId?: string;
    problemId?: string;
    message: string;
    details: unknown;
    requiresImmediate: boolean;
}

export interface NotificationStatistics {
    totalScheduled: number;
    sent: number;
    pending: number;
    failed: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
}

export interface FollowUpReminder {
    type: 'email' | 'sms' | 'push' | 'system';
    scheduledFor: string;
    sent: boolean;
    sentAt?: string;
    recipientId?: string;
    message?: string;
}

class MTRNotificationService {
    private baseUrl = '/api/mtr/notifications';

    /**
     * Get user notification preferences
     */
    async getNotificationPreferences(): Promise<NotificationPreferences> {
        const response = await apiClient.get(`${this.baseUrl}/preferences`);
        return response.data;
    }

    /**
     * Update user notification preferences
     */
    async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
        await apiClient.put(`${this.baseUrl}/preferences`, preferences);
    }

    /**
     * Schedule a follow-up reminder
     */
    async scheduleFollowUpReminder(
        followUpId: string,
        reminderType: 'email' | 'sms' = 'email',
        scheduledFor?: string
    ): Promise<void> {
        await apiClient.post(`${this.baseUrl}/follow-up/${followUpId}/reminder`, {
            reminderType,
            scheduledFor
        });
    }

    /**
     * Get reminders for a specific follow-up
     */
    async getFollowUpReminders(followUpId: string): Promise<FollowUpReminder[]> {
        const response = await apiClient.get(`${this.baseUrl}/follow-up/${followUpId}/reminders`);
        return response.data;
    }

    /**
     * Cancel a scheduled reminder
     */
    async cancelScheduledReminder(followUpId: string, reminderId: string): Promise<void> {
        await apiClient.delete(`${this.baseUrl}/follow-up/${followUpId}/reminder/${reminderId}`);
    }

    /**
     * Send a critical alert
     */
    async sendCriticalAlert(alert: CriticalAlert): Promise<void> {
        await apiClient.post(`${this.baseUrl}/alert/critical`, alert);
    }

    /**
     * Check drug interactions and send alerts if needed
     */
    async checkDrugInteractions(patientId: string, medications: unknown[]): Promise<unknown[]> {
        const response = await apiClient.post(`${this.baseUrl}/alert/drug-interactions`, {
            patientId,
            medications
        });
        return response.data;
    }

    /**
     * Send notification for high severity drug therapy problem
     */
    async notifyHighSeverityDTP(problemId: string): Promise<void> {
        await apiClient.post(`${this.baseUrl}/alert/high-severity-dtp/${problemId}`);
    }

    /**
     * Check for overdue follow-ups and send alerts
     */
    async checkOverdueFollowUps(): Promise<void> {
        await apiClient.post(`${this.baseUrl}/check-overdue`);
    }

    /**
     * Process pending reminders manually
     */
    async processPendingReminders(): Promise<void> {
        await apiClient.post(`${this.baseUrl}/process-pending`);
    }

    /**
     * Get notification statistics
     */
    async getNotificationStatistics(): Promise<NotificationStatistics> {
        const response = await apiClient.get(`${this.baseUrl}/statistics`);
        return response.data;
    }

    /**
     * Send a test notification
     */
    async sendTestNotification(type: 'email' | 'sms' = 'email'): Promise<void> {
        await apiClient.post(`${this.baseUrl}/test`, { type });
    }
}

export const mtrNotificationService = new MTRNotificationService();
export default mtrNotificationService;