/**
 * Alert Hooks
 * React hooks for managing alerts
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../services/api/alertsApi';
import { PatientAlert, DashboardAlert, AlertFilters } from '../types/alerts';
import { useNotification } from './useNotification';

// Query keys
export const alertsKeys = {
  all: ['alerts'] as const,
  patient: (patientId: string) => [...alertsKeys.all, 'patient', patientId] as const,
  patientFiltered: (patientId: string, filters: AlertFilters) => 
    [...alertsKeys.patient(patientId), filters] as const,
  dashboard: () => [...alertsKeys.all, 'dashboard'] as const,
  dashboardFiltered: (filters: AlertFilters) => 
    [...alertsKeys.dashboard(), filters] as const,
  statistics: () => [...alertsKeys.all, 'statistics'] as const,
  monitoring: () => [...alertsKeys.all, 'monitoring'] as const,
};

// Patient Alerts Hook
export const usePatientAlerts = (
  patientId: string,
  filters?: AlertFilters,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) => {
  return useQuery({
    queryKey: alertsKeys.patientFiltered(patientId, filters || {}),
    queryFn: () => alertsApi.getPatientAlerts(patientId, filters),
    enabled: options?.enabled !== false && !!patientId,
    refetchInterval: options?.refetchInterval,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Dashboard Alerts Hook
export const useDashboardAlerts = (
  filters?: AlertFilters & { assignedToMe?: boolean },
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) => {
  return useQuery({
    queryKey: alertsKeys.dashboardFiltered(filters || {}),
    queryFn: () => alertsApi.getDashboardAlerts(filters),
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Alert Statistics Hook
export const useAlertStatistics = (
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) => {
  return useQuery({
    queryKey: alertsKeys.statistics(),
    queryFn: () => alertsApi.getAlertStatistics(),
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Monitoring Status Hook
export const useMonitoringStatus = (
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) => {
  return useQuery({
    queryKey: alertsKeys.monitoring(),
    queryFn: () => alertsApi.getMonitoringStatus(),
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Create Alert Mutation
export const useCreateAlert = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: alertsApi.createAlert,
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      if (variables.type === 'patient' && variables.alertData.patientId) {
        queryClient.invalidateQueries({
          queryKey: alertsKeys.patient(variables.alertData.patientId),
        });
      } else if (variables.type === 'dashboard') {
        queryClient.invalidateQueries({
          queryKey: alertsKeys.dashboard(),
        });
      }

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: alertsKeys.statistics(),
      });

      showNotification('Alert created successfully', 'success');
    },
    onError: (error: any) => {
      showNotification(
        error.response?.data?.message || 'Failed to create alert',
        'error'
      );
    },
  });
};

// Dismiss Alert Mutation
export const useDismissAlert = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason?: string }) =>
      alertsApi.dismissAlert(alertId, reason),
    onSuccess: (data, variables) => {
      // Invalidate all alert queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: alertsKeys.all,
      });

      showNotification('Alert dismissed successfully', 'success');
    },
    onError: (error: any) => {
      showNotification(
        error.response?.data?.message || 'Failed to dismiss alert',
        'error'
      );
    },
  });
};

// Trigger Clinical Monitoring Mutation
export const useTriggerClinicalMonitoring = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: alertsApi.triggerClinicalMonitoring,
    onSuccess: () => {
      // Invalidate monitoring status
      queryClient.invalidateQueries({
        queryKey: alertsKeys.monitoring(),
      });

      showNotification('Clinical monitoring triggered successfully', 'success');
    },
    onError: (error: any) => {
      showNotification(
        error.response?.data?.message || 'Failed to trigger clinical monitoring',
        'error'
      );
    },
  });
};

// Combined hook for alert management
export const useAlertManagement = (patientId?: string) => {
  const queryClient = useQueryClient();
  const dismissAlert = useDismissAlert();
  const createAlert = useCreateAlert();
  const triggerMonitoring = useTriggerClinicalMonitoring();

  const handleDismissAlert = async (alertId: string, reason?: string) => {
    await dismissAlert.mutateAsync({ alertId, reason });
  };

  const handleCreatePatientAlert = async (
    alertData: Partial<PatientAlert>
  ) => {
    if (!patientId) {
      throw new Error('Patient ID is required for patient alerts');
    }

    await createAlert.mutateAsync({
      type: 'patient',
      alertData: {
        ...alertData,
        patientId,
      },
    });
  };

  const handleCreateDashboardAlert = async (
    alertData: Partial<DashboardAlert>
  ) => {
    await createAlert.mutateAsync({
      type: 'dashboard',
      alertData,
    });
  };

  const handleTriggerMonitoring = async (workplaceId?: string, delay?: number) => {
    await triggerMonitoring.mutateAsync({ workplaceId, delay });
  };

  const refreshAlerts = () => {
    queryClient.invalidateQueries({
      queryKey: alertsKeys.all,
    });
  };

  return {
    dismissAlert: handleDismissAlert,
    createPatientAlert: handleCreatePatientAlert,
    createDashboardAlert: handleCreateDashboardAlert,
    triggerMonitoring: handleTriggerMonitoring,
    refreshAlerts,
    isLoading: dismissAlert.isPending || createAlert.isPending || triggerMonitoring.isPending,
  };
};

// Hook for real-time alert updates (using WebSocket or polling)
export const useRealTimeAlerts = (
  enabled: boolean = true,
  options?: {
    patientId?: string;
    pollInterval?: number;
  }
) => {
  const queryClient = useQueryClient();

  // Patient alerts with real-time updates
  const patientAlerts = usePatientAlerts(
    options?.patientId || '',
    {},
    {
      enabled: enabled && !!options?.patientId,
      refetchInterval: options?.pollInterval || 30000, // 30 seconds
    }
  );

  // Dashboard alerts with real-time updates
  const dashboardAlerts = useDashboardAlerts(
    {},
    {
      enabled,
      refetchInterval: options?.pollInterval || 60000, // 1 minute
    }
  );

  // Force refresh all alerts
  const forceRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: alertsKeys.all,
    });
  };

  return {
    patientAlerts,
    dashboardAlerts,
    forceRefresh,
    isLoading: patientAlerts.isLoading || dashboardAlerts.isLoading,
    hasErrors: patientAlerts.isError || dashboardAlerts.isError,
  };
};

// Hook for alert filtering and sorting
export const useAlertFilters = () => {
  const [filters, setFilters] = React.useState<AlertFilters>({});

  const updateFilter = (key: keyof AlertFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  };
};

export default {
  usePatientAlerts,
  useDashboardAlerts,
  useAlertStatistics,
  useMonitoringStatus,
  useCreateAlert,
  useDismissAlert,
  useTriggerClinicalMonitoring,
  useAlertManagement,
  useRealTimeAlerts,
  useAlertFilters,
};