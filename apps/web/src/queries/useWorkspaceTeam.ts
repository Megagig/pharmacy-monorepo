/**
 * TanStack Query hooks for Workspace Team Management
 * Provides hooks for managing workspace members, invites, and audit logs
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import workspaceTeamService from '../services/workspaceTeamService';
import type {
  MemberFilters,
  AuditFilters,
  InviteFilters,
  Pagination,
  UpdateMemberRoleRequest,
  SuspendMemberRequest,
  RemoveMemberRequest,
  GenerateInviteRequest,
  ApproveMemberRequest,
  RejectMemberRequest,
} from '../types/workspace';

// Query keys factory
export const workspaceTeamKeys = {
  all: ['workspace', 'team'] as const,
  
  // Members
  members: () => [...workspaceTeamKeys.all, 'members'] as const,
  membersList: (filters: MemberFilters, pagination: Pagination) =>
    [...workspaceTeamKeys.members(), 'list', { filters, pagination }] as const,
  
  // Invites
  invites: () => [...workspaceTeamKeys.all, 'invites'] as const,
  invitesList: (filters: InviteFilters) =>
    [...workspaceTeamKeys.invites(), 'list', { filters }] as const,
  
  // Pending members
  pending: () => [...workspaceTeamKeys.all, 'pending'] as const,
  
  // Audit logs
  audit: () => [...workspaceTeamKeys.all, 'audit'] as const,
  auditList: (filters: AuditFilters, pagination: Pagination) =>
    [...workspaceTeamKeys.audit(), 'list', { filters, pagination }] as const,
  
  // Stats
  stats: () => [...workspaceTeamKeys.all, 'stats'] as const,
};

// ============================================================================
// Member Management Hooks
// ============================================================================

/**
 * Hook to fetch workspace members with filters and pagination
 */
export const useWorkspaceMembers = (
  filters: MemberFilters = {},
  pagination: Pagination = { page: 1, limit: 20 }
) => {
  return useQuery({
    queryKey: workspaceTeamKeys.membersList(filters, pagination),
    queryFn: () => workspaceTeamService.getMembers(filters, pagination),
  });
};

/**
 * Hook to update a member's role
 */
export const useUpdateMemberRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data: UpdateMemberRoleRequest;
    }) => workspaceTeamService.updateMemberRole(memberId, data),
    onSuccess: () => {
      // Invalidate members list to refetch with updated data
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.members() });
      // Invalidate audit logs as role changes are logged
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats as active member count may change
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

/**
 * Hook to remove a member from the workspace
 */
export const useRemoveMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data?: RemoveMemberRequest;
    }) => workspaceTeamService.removeMember(memberId, data),
    onSuccess: () => {
      // Invalidate members list
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.members() });
      // Invalidate audit logs
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

/**
 * Hook to suspend a member
 */
export const useSuspendMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data: SuspendMemberRequest;
    }) => workspaceTeamService.suspendMember(memberId, data),
    onSuccess: () => {
      // Invalidate members list to show updated status
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.members() });
      // Invalidate audit logs
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats as active member count changes
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

/**
 * Hook to activate a suspended member
 */
export const useActivateMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      workspaceTeamService.activateMember(memberId),
    onSuccess: () => {
      // Invalidate members list to show updated status
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.members() });
      // Invalidate audit logs
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats as active member count changes
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

// ============================================================================
// Invite Management Hooks
// ============================================================================

/**
 * Hook to fetch workspace invites with optional filters
 */
export const useWorkspaceInvites = (filters: InviteFilters = {}) => {
  return useQuery({
    queryKey: workspaceTeamKeys.invitesList(filters),
    queryFn: () => workspaceTeamService.getInvites(filters),
  });
};

/**
 * Hook to generate a new invite link
 */
export const useGenerateInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateInviteRequest) =>
      workspaceTeamService.generateInvite(data),
    onSuccess: () => {
      // Invalidate invites list to show new invite
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.invites() });
      // Invalidate audit logs
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

/**
 * Hook to revoke an invite link
 */
export const useRevokeInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) =>
      workspaceTeamService.revokeInvite(inviteId),
    onSuccess: () => {
      // Invalidate invites list to show updated status
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.invites() });
      // Invalidate audit logs
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

// ============================================================================
// Pending Member Approval Hooks
// ============================================================================

/**
 * Hook to fetch pending member approvals
 */
export const usePendingMembers = () => {
  return useQuery({
    queryKey: workspaceTeamKeys.pending(),
    queryFn: () => workspaceTeamService.getPendingMembers(),
  });
};

/**
 * Hook to approve a pending member
 */
export const useApproveMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data?: ApproveMemberRequest;
    }) => workspaceTeamService.approveMember(memberId, data),
    onSuccess: () => {
      // Invalidate pending members list
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.pending() });
      // Invalidate members list as new member is now active
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.members() });
      // Invalidate audit logs
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

/**
 * Hook to reject a pending member
 */
export const useRejectMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data?: RejectMemberRequest;
    }) => workspaceTeamService.rejectMember(memberId, data),
    onSuccess: () => {
      // Invalidate pending members list
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.pending() });
      // Invalidate audit logs
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.audit() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: workspaceTeamKeys.stats() });
    },
  });
};

// ============================================================================
// Audit Trail Hooks
// ============================================================================

/**
 * Hook to fetch audit logs with filters and pagination
 */
export const useAuditLogs = (
  filters: AuditFilters = {},
  pagination: Pagination = { page: 1, limit: 20 }
) => {
  return useQuery({
    queryKey: workspaceTeamKeys.auditList(filters, pagination),
    queryFn: () => workspaceTeamService.getAuditLogs(filters, pagination),
  });
};

/**
 * Hook to export audit logs as CSV
 */
export const useExportAuditLogs = () => {
  return useMutation({
    mutationFn: (filters: AuditFilters = {}) =>
      workspaceTeamService.exportAuditLogs(filters),
  });
};

// ============================================================================
// Statistics Hook
// ============================================================================

/**
 * Hook to fetch workspace statistics
 */
export const useWorkspaceStats = () => {
  return useQuery({
    queryKey: workspaceTeamKeys.stats(),
    queryFn: () => workspaceTeamService.getWorkspaceStats(),
    refetchInterval: 60000, // Refetch every minute for updated stats
  });
};
