import apiClient from './apiClient';

export interface Notification {
    _id: string;
    userId: string;
    workplaceId: string;
    type: string;
    title: string;
    content: string;
    data?: Record<string, any>;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    status: 'pending' | 'sent' | 'read' | 'dismissed';
    deliveryChannels: Array<'in-app' | 'email' | 'sms' | 'push'>;
    isRead: boolean;
    readAt?: string;
    scheduledFor?: string;
    expiresAt?: string;
    groupKey?: string;
    createdAt: string;
    updatedAt: string;
}

export interface NotificationFilters {
    type?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}

export interface NotificationResult {
    notifications: Notification[];
    total: number;
    unreadCount: number;
    hasMore: boolean;
}

export interface NotificationPreferences {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
    types: {
        [key: string]: {
            inApp: boolean;
            email: boolean;
            sms: boolean;
            push: boolean;
        };
    };
}

const notificationService = {
    /**
     * Get user notifications with optional filters
     */
    async getUserNotifications(filters?: NotificationFilters): Promise<NotificationResult> {
        const queryParams = new URLSearchParams();

        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, String(value));
                }
            });
        }

        const response = await apiClient.get(`/notifications?${queryParams.toString()}`);
        return response.data.data;
    },

    /**
     * Get unread notification count
     */
    async getUnreadCount(): Promise<number> {
        const response = await apiClient.get('/notifications/unread-count');
        return response.data.data.count;
    },

    /**
     * Mark a single notification as read
     */
    async markAsRead(notificationId: string): Promise<void> {
        await apiClient.patch(`/notifications/${notificationId}/read`);
    },

    /**
     * Mark multiple notifications as read
     */
    async markMultipleAsRead(notificationIds: string[]): Promise<void> {
        await apiClient.patch('/notifications/mark-multiple-read', { notificationIds });
    },

    /**
     * Dismiss a notification
     */
    async dismissNotification(notificationId: string): Promise<void> {
        await apiClient.patch(`/notifications/${notificationId}/dismiss`);
    },

    /**
     * Get notification preferences
     */
    async getPreferences(): Promise<NotificationPreferences> {
        const response = await apiClient.get('/notifications/preferences');
        return response.data.data;
    },

    /**
     * Update notification preferences
     */
    async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
        const response = await apiClient.put('/notifications/preferences', preferences);
        return response.data.data;
    },

    /**
     * Get notification statistics
     */
    async getStatistics(): Promise<any> {
        const response = await apiClient.get('/notifications/statistics');
        return response.data.data;
    },

    /**
     * Create a new notification
     */
    async createNotification(data: {
        userId: string;
        title: string;
        content: string;
        type: string;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        data?: Record<string, any>;
        deliveryChannels?: Array<'in-app' | 'email' | 'sms' | 'push'>;
    }): Promise<Notification> {
        const response = await apiClient.post('/notifications', {
            ...data,
            priority: data.priority || 'normal',
            deliveryChannels: data.deliveryChannels || ['in-app'],
        });
        return response.data.data;
    },

    /**
     * Send a test notification (for testing purposes)
     */
    async sendTestNotification(title: string, content: string): Promise<void> {
        await apiClient.post('/notifications/test', { title, content });
    },
};

export default notificationService;
