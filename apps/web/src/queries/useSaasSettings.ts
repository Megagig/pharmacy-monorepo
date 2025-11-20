import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import saasService, {
  SystemMetrics,
  SystemHealth,
  Activity,
  UserFilters,
  Pagination,
  PaginatedUsers,
  FeatureFlagTargeting,
  SecuritySettings,
  UserSession,
} from '../services/saasService';

// Query keys
export const saasKeys = {
  all: ['saas'] as const,
  overview: () => [...saasKeys.all, 'overview'] as const,
  metrics: () => [...saasKeys.overview(), 'metrics'] as const,
  health: () => [...saasKeys.overview(), 'health'] as const,
  activities: () => [...saasKeys.overview(), 'activities'] as const,
  users: () => [...saasKeys.all, 'users'] as const,
  usersList: (filters: UserFilters, pagination: Pagination) => 
    [...saasKeys.users(), 'list', { filters, pagination }] as const,
  featureFlags: () => [...saasKeys.all, 'feature-flags'] as const,
  security: () => [...saasKeys.all, 'security'] as const,
  securitySettings: () => [...saasKeys.security(), 'settings'] as const,
  sessions: () => [...saasKeys.security(), 'sessions'] as const,
};

// System Overview Queries
export const useSystemMetrics = () => {
  return useQuery({
    queryKey: saasKeys.metrics(),
    queryFn: () => saasService.getSystemMetrics(),
    refetchInterval: 30000, // Refetch every 30 seconds for real-time data
  });
};

export const useSystemHealth = () => {
  return useQuery({
    queryKey: saasKeys.health(),
    queryFn: () => saasService.getSystemHealth(),
    refetchInterval: 15000, // Refetch every 15 seconds for health monitoring
  });
};

export const useRecentActivities = () => {
  return useQuery({
    queryKey: saasKeys.activities(),
    queryFn: () => saasService.getRecentActivities(),
    refetchInterval: 60000, // Refetch every minute
  });
};

// User Management Queries
export const useUsers = (filters: UserFilters = {}, pagination: Pagination = { page: 1, limit: 20 }) => {
  return useQuery({
    queryKey: saasKeys.usersList(filters, pagination),
    queryFn: () => saasService.getUsers(filters, pagination),
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId, workspaceId }: { userId: string; roleId: string; workspaceId?: string }) =>
      saasService.updateUserRole(userId, roleId, workspaceId),
    onSuccess: () => {
      // Invalidate users queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useSuspendUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      saasService.suspendUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useReactivateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => saasService.reactivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useBulkAssignRoles = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userIds, roleId }: { userIds: string[]; roleId: string }) =>
      saasService.bulkAssignRoles(userIds, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useImpersonateUser = () => {
  return useMutation({
    mutationFn: (targetUserId: string) => saasService.impersonateUser(targetUserId),
  });
};

export const useApproveUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => saasService.approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useRejectUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      saasService.rejectUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useBulkApproveUsers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: string[]) => saasService.bulkApproveUsers(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useBulkRejectUsers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userIds, reason }: { userIds: string[]; reason?: string }) =>
      saasService.bulkRejectUsers(userIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useBulkSuspendUsers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userIds, reason }: { userIds: string[]; reason: string }) =>
      saasService.bulkSuspendUsers(userIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
      role: string;
      workplaceId?: string;
      phone?: string;
    }) => saasService.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.users() });
    },
  });
};

// Feature Flags Queries
export const useSaasFeatureFlags = () => {
  return useQuery({
    queryKey: saasKeys.featureFlags(),
    queryFn: () => saasService.getFeatureFlags(),
  });
};

export const useUpdateFeatureFlagTargeting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ flagId, targeting }: { flagId: string; targeting: FeatureFlagTargeting }) =>
      saasService.updateFeatureFlagTargeting(flagId, targeting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.featureFlags() });
    },
  });
};

// Security Queries
export const useSecuritySettings = () => {
  return useQuery({
    queryKey: saasKeys.securitySettings(),
    queryFn: () => saasService.getSecuritySettings(),
  });
};

export const useUpdatePasswordPolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (policy: SecuritySettings['passwordPolicy']) =>
      saasService.updatePasswordPolicy(policy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.securitySettings() });
    },
  });
};

export const useActiveSessions = () => {
  return useQuery({
    queryKey: saasKeys.sessions(),
    queryFn: () => saasService.getActiveSessions(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useTerminateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => saasService.terminateSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasKeys.sessions() });
    },
  });
};

// Main hook that provides all SaaS settings functionality
export const useSaasSettings = () => {
  return {
    // System Overview
    getSystemMetrics: saasService.getSystemMetrics.bind(saasService),
    getSystemHealth: saasService.getSystemHealth.bind(saasService),
    getRecentActivities: saasService.getRecentActivities.bind(saasService),

    // User Management
    getUsers: saasService.getUsers.bind(saasService),
    updateUserRole: saasService.updateUserRole.bind(saasService),
    suspendUser: saasService.suspendUser.bind(saasService),
    reactivateUser: saasService.reactivateUser.bind(saasService),
    bulkAssignRoles: saasService.bulkAssignRoles.bind(saasService),
    impersonateUser: saasService.impersonateUser.bind(saasService),

    // Feature Flags
    getFeatureFlags: saasService.getFeatureFlags.bind(saasService),
    updateFeatureFlagTargeting: saasService.updateFeatureFlagTargeting.bind(saasService),
    getFeatureFlagUsageMetrics: saasService.getFeatureFlagUsageMetrics.bind(saasService),

    // Security
    getSecuritySettings: saasService.getSecuritySettings.bind(saasService),
    updatePasswordPolicy: saasService.updatePasswordPolicy.bind(saasService),
    updateAccountLockout: saasService.updateAccountLockout.bind(saasService),
    getActiveSessions: saasService.getActiveSessions.bind(saasService),
    terminateSession: saasService.terminateSession.bind(saasService),
    getSecurityAuditLogs: saasService.getSecurityAuditLogs.bind(saasService),
    lockUserAccount: saasService.lockUserAccount.bind(saasService),
    unlockUserAccount: saasService.unlockUserAccount.bind(saasService),
    getSecurityDashboard: saasService.getSecurityDashboard.bind(saasService),

    // Analytics
    getSubscriptionAnalytics: saasService.getSubscriptionAnalytics.bind(saasService),
    getPharmacyUsageReports: saasService.getPharmacyUsageReports.bind(saasService),
    getClinicalOutcomesReport: saasService.getClinicalOutcomesReport.bind(saasService),
    exportReport: saasService.exportReport.bind(saasService),
    scheduleReport: saasService.scheduleReport.bind(saasService),

    // Notifications
    getNotificationChannels: saasService.getNotificationChannels.bind(saasService),
    updateNotificationChannel: saasService.updateNotificationChannel.bind(saasService),
    getNotificationRules: saasService.getNotificationRules.bind(saasService),
    createNotificationRule: saasService.createNotificationRule.bind(saasService),
    updateNotificationRule: saasService.updateNotificationRule.bind(saasService),
    deleteNotificationRule: saasService.deleteNotificationRule.bind(saasService),
    toggleNotificationRule: saasService.toggleNotificationRule.bind(saasService),
    getNotificationTemplates: saasService.getNotificationTemplates.bind(saasService),
    createNotificationTemplate: saasService.createNotificationTemplate.bind(saasService),
    updateNotificationTemplate: saasService.updateNotificationTemplate.bind(saasService),
    deleteNotificationTemplate: saasService.deleteNotificationTemplate.bind(saasService),
    getNotificationHistory: saasService.getNotificationHistory.bind(saasService),
    sendTestNotification: saasService.sendTestNotification.bind(saasService),

    // Audit
    getAuditLogs: saasService.getAuditLogs.bind(saasService),
    getAuditSummary: saasService.getAuditSummary.bind(saasService),
    generateComplianceReport: saasService.generateComplianceReport.bind(saasService),
    reviewAuditLog: saasService.reviewAuditLog.bind(saasService),
    getFlaggedAuditLogs: saasService.getFlaggedAuditLogs.bind(saasService),
    exportAuditLogs: saasService.exportAuditLogs.bind(saasService),
  };
};