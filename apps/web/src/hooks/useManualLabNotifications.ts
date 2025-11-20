import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '../services/api';
import { useAuth } from './useAuth';

// Types
interface CriticalAlert {
    id: string;
    type: 'critical_result' | 'red_flag_detected' | 'urgent_referral_needed' | 'drug_interaction';
    severity: 'critical' | 'major' | 'moderate';
    orderId: string;
    patientId: string;
    patientName: string;
    patientMRN?: string;
    message: string;
    details: any;
    requiresImmediate: boolean;
    timestamp: string;
    acknowledged?: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    aiInterpretation?: any;
}

interface NotificationPreferences {
    criticalAlerts: boolean;
    resultNotifications: boolean;
    orderReminders: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
}

interface NotificationStats {
    totalScheduled: number;
    sent: number;
    pending: number;
    failed: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    byPriority: Record<string, number>;
}

// Custom hook for manual lab notifications
export const useManualLabNotifications = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [pollingEnabled, setPollingEnabled] = useState(true);

    // Fetch critical alerts
    const {
        data: alertsData,
        isLoading: alertsLoading,
        error: alertsError,
        refetch: refetchAlerts,
    } = useQuery({
        queryKey: ['manualLabAlerts', user?.workplaceId],
        queryFn: async () => {
            const response = await apiHelpers.get('/manual-lab-notifications/alerts');
            return response.data;
        },
        enabled: !!user?.workplaceId,
        refetchInterval: pollingEnabled ? 30000 : false, // Poll every 30 seconds
        refetchIntervalInBackground: true,
    });

    // Fetch notification preferences
    const {
        data: preferencesData,
        isLoading: preferencesLoading,
        error: preferencesError,
    } = useQuery({
        queryKey: ['notificationPreferences', user?._id],
        queryFn: async () => {
            const response = await apiHelpers.get('/manual-lab-notifications/preferences');
            return response.data;
        },
        enabled: !!user?._id,
    });

    // Fetch notification statistics
    const {
        data: statsData,
        isLoading: statsLoading,
    } = useQuery({
        queryKey: ['notificationStats', user?.workplaceId],
        queryFn: async () => {
            const response = await apiHelpers.get('/manual-lab-notifications/stats');
            return response.data;
        },
        enabled: !!user?.workplaceId,
        refetchInterval: 60000, // Refresh stats every minute
    });

    // Acknowledge alert mutation
    const acknowledgeAlertMutation = useMutation({
        mutationFn: async (alertId: string) => {
            const response = await apiHelpers.post(`/manual-lab-notifications/alerts/${alertId}/acknowledge`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manualLabAlerts'] });
        },
    });

    // Dismiss alert mutation
    const dismissAlertMutation = useMutation({
        mutationFn: async (alertId: string) => {
            const response = await apiHelpers.post(`/manual-lab-notifications/alerts/${alertId}/dismiss`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manualLabAlerts'] });
        },
    });

    // Update preferences mutation
    const updatePreferencesMutation = useMutation({
        mutationFn: async (preferences: Partial<NotificationPreferences>) => {
            const response = await apiHelpers.put('/manual-lab-notifications/preferences', preferences);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
        },
    });

    // Send test notification mutation
    const sendTestNotificationMutation = useMutation({
        mutationFn: async (type: 'email' | 'sms') => {
            const response = await apiHelpers.post('/manual-lab-notifications/test', { type });
            return response.data;
        },
    });

    // Callback functions
    const acknowledgeAlert = useCallback(async (alertId: string) => {
        try {
            await acknowledgeAlertMutation.mutateAsync(alertId);
            return { success: true };
        } catch (error) {
            console.error('Error acknowledging alert:', error);
            return { success: false, error };
        }
    }, [acknowledgeAlertMutation]);

    const dismissAlert = useCallback(async (alertId: string) => {
        try {
            await dismissAlertMutation.mutateAsync(alertId);
            return { success: true };
        } catch (error) {
            console.error('Error dismissing alert:', error);
            return { success: false, error };
        }
    }, [dismissAlertMutation]);

    const updatePreferences = useCallback(async (preferences: Partial<NotificationPreferences>) => {
        try {
            await updatePreferencesMutation.mutateAsync(preferences);
            return { success: true };
        } catch (error) {
            console.error('Error updating preferences:', error);
            return { success: false, error };
        }
    }, [updatePreferencesMutation]);

    const sendTestNotification = useCallback(async (type: 'email' | 'sms') => {
        try {
            await sendTestNotificationMutation.mutateAsync(type);
            return { success: true };
        } catch (error) {
            console.error('Error sending test notification:', error);
            return { success: false, error };
        }
    }, [sendTestNotificationMutation]);

    // Enable/disable polling
    const enablePolling = useCallback(() => {
        setPollingEnabled(true);
    }, []);

    const disablePolling = useCallback(() => {
        setPollingEnabled(false);
    }, []);

    // Manual refresh
    const refreshAlerts = useCallback(() => {
        refetchAlerts();
    }, [refetchAlerts]);

    // Get critical alerts count
    const criticalAlertsCount = alertsData?.data?.filter(
        (alert: CriticalAlert) => alert.severity === 'critical' && !alert.acknowledged
    ).length || 0;

    // Get unacknowledged alerts count
    const unacknowledgedAlertsCount = alertsData?.data?.filter(
        (alert: CriticalAlert) => !alert.acknowledged
    ).length || 0;

    // Check if user has critical alerts
    const hasCriticalAlerts = criticalAlertsCount > 0;

    // Check if notifications are enabled
    const notificationsEnabled = preferencesData?.data?.criticalAlerts !== false;

    return {
        // Data
        alerts: (alertsData?.data || []) as CriticalAlert[],
        preferences: preferencesData?.data as NotificationPreferences | undefined,
        stats: statsData?.data as NotificationStats | undefined,

        // Loading states
        alertsLoading,
        preferencesLoading,
        statsLoading,

        // Error states
        alertsError,
        preferencesError,

        // Mutation states
        acknowledging: acknowledgeAlertMutation.isPending,
        dismissing: dismissAlertMutation.isPending,
        updatingPreferences: updatePreferencesMutation.isPending,
        sendingTest: sendTestNotificationMutation.isPending,

        // Actions
        acknowledgeAlert,
        dismissAlert,
        updatePreferences,
        sendTestNotification,
        refreshAlerts,
        enablePolling,
        disablePolling,

        // Computed values
        criticalAlertsCount,
        unacknowledgedAlertsCount,
        hasCriticalAlerts,
        notificationsEnabled,
        pollingEnabled,
    };
};

// Hook for triggering notifications from lab order components
export const useManualLabNotificationTriggers = () => {
    const queryClient = useQueryClient();

    // Trigger critical alert
    const triggerCriticalAlert = useMutation({
        mutationFn: async (alertData: {
            type: string;
            severity: string;
            orderId: string;
            patientId: string;
            message: string;
            details: any;
            requiresImmediate: boolean;
            aiInterpretation?: any;
        }) => {
            const response = await apiHelpers.post('/manual-lab-notifications/trigger-alert', alertData);
            return response.data;
        },
        onSuccess: () => {
            // Refresh alerts after triggering
            queryClient.invalidateQueries({ queryKey: ['manualLabAlerts'] });
        },
    });

    // Trigger AI interpretation complete notification
    const triggerAIInterpretationComplete = useMutation({
        mutationFn: async (data: {
            orderId: string;
            patientId: string;
            pharmacistId: string;
            interpretation: any;
        }) => {
            const response = await apiHelpers.post('/manual-lab-notifications/ai-complete', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manualLabAlerts'] });
        },
    });

    // Trigger patient result notification
    const triggerPatientResultNotification = useMutation({
        mutationFn: async (data: {
            orderId: string;
            patientId: string;
            includeInterpretation?: boolean;
        }) => {
            const response = await apiHelpers.post('/manual-lab-notifications/patient-result', data);
            return response.data;
        },
    });

    return {
        triggerCriticalAlert: triggerCriticalAlert.mutateAsync,
        triggerAIInterpretationComplete: triggerAIInterpretationComplete.mutateAsync,
        triggerPatientResultNotification: triggerPatientResultNotification.mutateAsync,

        // Loading states
        triggeringAlert: triggerCriticalAlert.isPending,
        triggeringAIComplete: triggerAIInterpretationComplete.isPending,
        triggeringPatientResult: triggerPatientResultNotification.isPending,
    };
};

// Hook for notification delivery tracking
export const useNotificationDeliveryTracking = (orderId?: string) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['notificationDelivery', orderId],
        queryFn: async () => {
            const response = await apiHelpers.get(`/manual-lab-notifications/delivery/${orderId}`);
            return response.data;
        },
        enabled: !!orderId,
        refetchInterval: 10000, // Check delivery status every 10 seconds
    });

    return {
        deliveryStatus: data?.data,
        loading: isLoading,
        error,
    };
};

export default useManualLabNotifications;