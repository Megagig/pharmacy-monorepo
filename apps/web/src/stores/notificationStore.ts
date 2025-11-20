import { create } from 'zustand';
import notificationService, { Notification, NotificationFilters, NotificationPreferences } from '../services/notificationService';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    preferences: NotificationPreferences | null;

    // Actions
    fetchNotifications: (filters?: NotificationFilters) => Promise<void>;
    fetchUnreadCount: () => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markMultipleAsRead: (notificationIds: string[]) => Promise<void>;
    dismissNotification: (notificationId: string) => Promise<void>;
    fetchPreferences: () => Promise<void>;
    updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
    addNotification: (notification: Notification) => void;
    clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    preferences: null,

    /**
     * Fetch user notifications
     */
    fetchNotifications: async (filters?: NotificationFilters) => {
        set({ loading: true, error: null });
        try {
            const result = await notificationService.getUserNotifications(filters);
            set({
                notifications: result.notifications,
                unreadCount: result.unreadCount,
                loading: false,
            });
        } catch (error: any) {
            console.error('Error fetching notifications:', error);
            set({
                error: error.response?.data?.message || 'Failed to fetch notifications',
                loading: false,
            });
        }
    },

    /**
     * Fetch unread count
     */
    fetchUnreadCount: async () => {
        try {
            const count = await notificationService.getUnreadCount();
            set({ unreadCount: count });
        } catch (error: any) {
            console.error('Error fetching unread count:', error);
            set({ error: error.response?.data?.message || 'Failed to fetch unread count' });
        }
    },

    /**
     * Mark notification as read
     */
    markAsRead: async (notificationId: string) => {
        try {
            await notificationService.markAsRead(notificationId);

            // Update local state
            const notifications = get().notifications.map((notif) =>
                notif._id === notificationId
                    ? { ...notif, isRead: true, readAt: new Date().toISOString(), status: 'read' as const }
                    : notif
            );

            const unreadCount = notifications.filter((n) => !n.isRead).length;

            set({ notifications, unreadCount });
        } catch (error: any) {
            console.error('Error marking notification as read:', error);
            set({ error: error.response?.data?.message || 'Failed to mark notification as read' });
        }
    },

    /**
     * Mark multiple notifications as read
     */
    markMultipleAsRead: async (notificationIds: string[]) => {
        try {
            await notificationService.markMultipleAsRead(notificationIds);

            // Update local state
            const notifications = get().notifications.map((notif) =>
                notificationIds.includes(notif._id)
                    ? { ...notif, isRead: true, readAt: new Date().toISOString(), status: 'read' as const }
                    : notif
            );

            const unreadCount = notifications.filter((n) => !n.isRead).length;

            set({ notifications, unreadCount });
        } catch (error: any) {
            console.error('Error marking multiple notifications as read:', error);
            set({ error: error.response?.data?.message || 'Failed to mark notifications as read' });
        }
    },

    /**
     * Dismiss a notification
     */
    dismissNotification: async (notificationId: string) => {
        try {
            await notificationService.dismissNotification(notificationId);

            // Remove from local state
            const notifications = get().notifications.filter((n) => n._id !== notificationId);
            const unreadCount = notifications.filter((n) => !n.isRead).length;

            set({ notifications, unreadCount });
        } catch (error: any) {
            console.error('Error dismissing notification:', error);
            set({ error: error.response?.data?.message || 'Failed to dismiss notification' });
        }
    },

    /**
     * Fetch user preferences
     */
    fetchPreferences: async () => {
        try {
            const preferences = await notificationService.getPreferences();
            set({ preferences });
        } catch (error: any) {
            console.error('Error fetching preferences:', error);
            set({ error: error.response?.data?.message || 'Failed to fetch preferences' });
        }
    },

    /**
     * Update user preferences
     */
    updatePreferences: async (newPreferences: Partial<NotificationPreferences>) => {
        try {
            const preferences = await notificationService.updatePreferences(newPreferences);
            set({ preferences });
        } catch (error: any) {
            console.error('Error updating preferences:', error);
            set({ error: error.response?.data?.message || 'Failed to update preferences' });
        }
    },

    /**
     * Add a new notification (for real-time updates)
     */
    addNotification: (notification: Notification) => {
        const notifications = [notification, ...get().notifications];
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        set({ notifications, unreadCount });
    },

    /**
     * Clear all notifications
     */
    clearNotifications: () => {
        set({ notifications: [], unreadCount: 0, error: null });
    },
}));
