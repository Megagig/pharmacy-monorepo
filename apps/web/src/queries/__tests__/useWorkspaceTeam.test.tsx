/**
 * Tests for Workspace Team Management TanStack Query Hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useWorkspaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
  useSuspendMember,
  useActivateMember,
  useWorkspaceInvites,
  useGenerateInvite,
  useRevokeInvite,
  usePendingMembers,
  useApproveMember,
  useRejectMember,
  useAuditLogs,
  useExportAuditLogs,
  useWorkspaceStats,
} from '../useWorkspaceTeam';
import type {
  MemberFilters,
  Pagination,
  UpdateMemberRoleRequest,
  SuspendMemberRequest,
  GenerateInviteRequest,
  AuditFilters,
} from '../../types/workspace';

// Mock the workspace team service
vi.mock('../../services/workspaceTeamService', () => ({
  default: {
    getMembers: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    suspendMember: vi.fn(),
    activateMember: vi.fn(),
    getInvites: vi.fn(),
    generateInvite: vi.fn(),
    revokeInvite: vi.fn(),
    getPendingMembers: vi.fn(),
    approveMember: vi.fn(),
    rejectMember: vi.fn(),
    getAuditLogs: vi.fn(),
    exportAuditLogs: vi.fn(),
    getWorkspaceStats: vi.fn(),
  },
}));

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Workspace Team Management Query Hooks', () => {
  let mockWorkspaceTeamService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockWorkspaceTeamService = (await import('../../services/workspaceTeamService')).default;
  });

  // ============================================================================
  // Member Management Hooks Tests
  // ============================================================================

  describe('useWorkspaceMembers', () => {
    it('should fetch members successfully with default pagination', async () => {
      const mockData = {
        members: [
          {
            _id: 'member1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            workplaceRole: 'Pharmacist',
            status: 'active',
            joinedAt: new Date('2024-01-01'),
            lastLoginAt: new Date('2024-10-10'),
            permissions: ['read_patients', 'write_prescriptions'],
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      mockWorkspaceTeamService.getMembers.mockResolvedValue(mockData);

      const { result } = renderHook(() => useWorkspaceMembers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockWorkspaceTeamService.getMembers).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 20 }
      );
    });

    it('should fetch members with filters and custom pagination', async () => {
      const filters: MemberFilters = {
        search: 'john',
        role: 'Pharmacist',
        status: 'active',
      };
      const pagination: Pagination = { page: 2, limit: 10 };

      const mockData = {
        members: [],
        pagination: {
          page: 2,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      };

      mockWorkspaceTeamService.getMembers.mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useWorkspaceMembers(filters, pagination),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.getMembers).toHaveBeenCalledWith(filters, pagination);
    });

    it('should handle errors when fetching members', async () => {
      mockWorkspaceTeamService.getMembers.mockRejectedValue(
        new Error('Failed to fetch members')
      );

      const { result } = renderHook(() => useWorkspaceMembers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Failed to fetch members'));
    });
  });

  describe('useUpdateMemberRole', () => {
    it('should update member role successfully', async () => {
      const mockMember = {
        _id: 'member1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workplaceRole: 'Admin',
        status: 'active',
      };

      const updateData: UpdateMemberRoleRequest = {
        workplaceRole: 'Admin',
        reason: 'Promotion',
      };

      mockWorkspaceTeamService.updateMemberRole.mockResolvedValue(mockMember);

      const { result } = renderHook(() => useUpdateMemberRole(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ memberId: 'member1', data: updateData });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.updateMemberRole).toHaveBeenCalledWith(
        'member1',
        updateData
      );
    });

    it('should handle errors when updating member role', async () => {
      mockWorkspaceTeamService.updateMemberRole.mockRejectedValue(
        new Error('Failed to update role')
      );

      const { result } = renderHook(() => useUpdateMemberRole(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        memberId: 'member1',
        data: { workplaceRole: 'Admin' },
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useRemoveMember', () => {
    it('should remove member successfully', async () => {
      mockWorkspaceTeamService.removeMember.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRemoveMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        memberId: 'member1',
        data: { reason: 'Left company' },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.removeMember).toHaveBeenCalledWith('member1', {
        reason: 'Left company',
      });
    });
  });

  describe('useSuspendMember', () => {
    it('should suspend member successfully', async () => {
      const mockMember = {
        _id: 'member1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workplaceRole: 'Pharmacist',
        status: 'suspended',
      };

      const suspendData: SuspendMemberRequest = {
        reason: 'Policy violation',
      };

      mockWorkspaceTeamService.suspendMember.mockResolvedValue(mockMember);

      const { result } = renderHook(() => useSuspendMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ memberId: 'member1', data: suspendData });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.suspendMember).toHaveBeenCalledWith(
        'member1',
        suspendData
      );
      expect(result.current.data).toEqual(mockMember);
    });
  });

  describe('useActivateMember', () => {
    it('should activate member successfully', async () => {
      const mockMember = {
        _id: 'member1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workplaceRole: 'Pharmacist',
        status: 'active',
      };

      mockWorkspaceTeamService.activateMember.mockResolvedValue(mockMember);

      const { result } = renderHook(() => useActivateMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('member1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.activateMember).toHaveBeenCalledWith('member1');
      expect(result.current.data).toEqual(mockMember);
    });
  });

  // ============================================================================
  // Invite Management Hooks Tests
  // ============================================================================

  describe('useWorkspaceInvites', () => {
    it('should fetch invites successfully', async () => {
      const mockData = {
        invites: [
          {
            _id: 'invite1',
            email: 'newuser@example.com',
            workplaceRole: 'Pharmacist',
            status: 'pending',
            expiresAt: new Date('2024-12-31'),
            usedCount: 0,
            maxUses: 1,
            requiresApproval: true,
            createdAt: new Date('2024-10-01'),
          },
        ],
      };

      mockWorkspaceTeamService.getInvites.mockResolvedValue(mockData);

      const { result } = renderHook(() => useWorkspaceInvites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockWorkspaceTeamService.getInvites).toHaveBeenCalledWith({});
    });

    it('should fetch invites with status filter', async () => {
      const mockData = { invites: [] };
      mockWorkspaceTeamService.getInvites.mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useWorkspaceInvites({ status: 'active' }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.getInvites).toHaveBeenCalledWith({ status: 'active' });
    });
  });

  describe('useGenerateInvite', () => {
    it('should generate invite successfully', async () => {
      const inviteData: GenerateInviteRequest = {
        email: 'newuser@example.com',
        workplaceRole: 'Pharmacist',
        expiresInDays: 7,
        maxUses: 1,
        requiresApproval: true,
        personalMessage: 'Welcome to our team!',
      };

      const mockResponse = {
        invite: {
          _id: 'invite1',
          inviteToken: 'abc123',
          expiresAt: new Date('2024-10-17'),
        },
        inviteUrl: 'https://app.example.com/signup?invite=abc123',
      };

      mockWorkspaceTeamService.generateInvite.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useGenerateInvite(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(inviteData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.generateInvite).toHaveBeenCalledWith(inviteData);
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe('useRevokeInvite', () => {
    it('should revoke invite successfully', async () => {
      mockWorkspaceTeamService.revokeInvite.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRevokeInvite(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('invite1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.revokeInvite).toHaveBeenCalledWith('invite1');
    });
  });

  // ============================================================================
  // Pending Member Approval Hooks Tests
  // ============================================================================

  describe('usePendingMembers', () => {
    it('should fetch pending members successfully', async () => {
      const mockData = {
        pendingMembers: [
          {
            _id: 'member1',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            workplaceRole: 'Pharmacist',
            createdAt: new Date('2024-10-01'),
            inviteToken: 'abc123',
          },
        ],
      };

      mockWorkspaceTeamService.getPendingMembers.mockResolvedValue(mockData);

      const { result } = renderHook(() => usePendingMembers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockWorkspaceTeamService.getPendingMembers).toHaveBeenCalled();
    });
  });

  describe('useApproveMember', () => {
    it('should approve member successfully', async () => {
      const mockMember = {
        _id: 'member1',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        workplaceRole: 'Pharmacist',
        status: 'active',
      };

      mockWorkspaceTeamService.approveMember.mockResolvedValue(mockMember);

      const { result } = renderHook(() => useApproveMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        memberId: 'member1',
        data: { workplaceRole: 'Pharmacist' },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.approveMember).toHaveBeenCalledWith('member1', {
        workplaceRole: 'Pharmacist',
      });
      expect(result.current.data).toEqual(mockMember);
    });

    it('should approve member without role override', async () => {
      const mockMember = {
        _id: 'member1',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        workplaceRole: 'Pharmacist',
        status: 'active',
      };

      mockWorkspaceTeamService.approveMember.mockResolvedValue(mockMember);

      const { result } = renderHook(() => useApproveMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ memberId: 'member1' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.approveMember).toHaveBeenCalledWith('member1', undefined);
    });
  });

  describe('useRejectMember', () => {
    it('should reject member successfully', async () => {
      mockWorkspaceTeamService.rejectMember.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRejectMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        memberId: 'member1',
        data: { reason: 'Does not meet requirements' },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.rejectMember).toHaveBeenCalledWith('member1', {
        reason: 'Does not meet requirements',
      });
    });
  });

  // ============================================================================
  // Audit Trail Hooks Tests
  // ============================================================================

  describe('useAuditLogs', () => {
    it('should fetch audit logs successfully', async () => {
      const mockData = {
        logs: [
          {
            _id: 'log1',
            actorId: {
              _id: 'user1',
              firstName: 'Admin',
              lastName: 'User',
            },
            targetId: {
              _id: 'member1',
              firstName: 'John',
              lastName: 'Doe',
            },
            action: 'role_changed',
            category: 'role',
            details: {
              before: 'Pharmacist',
              after: 'Admin',
              reason: 'Promotion',
            },
            timestamp: new Date('2024-10-10'),
            severity: 'medium',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
        },
      };

      mockWorkspaceTeamService.getAuditLogs.mockResolvedValue(mockData);

      const { result } = renderHook(() => useAuditLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockWorkspaceTeamService.getAuditLogs).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 20 }
      );
    });

    it('should fetch audit logs with filters', async () => {
      const filters: AuditFilters = {
        startDate: '2024-10-01',
        endDate: '2024-10-10',
        actorId: 'user1',
        category: 'role',
        action: 'role_changed',
      };

      const mockData = {
        logs: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
        },
      };

      mockWorkspaceTeamService.getAuditLogs.mockResolvedValue(mockData);

      const { result } = renderHook(() => useAuditLogs(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.getAuditLogs).toHaveBeenCalledWith(filters, {
        page: 1,
        limit: 20,
      });
    });
  });

  describe('useExportAuditLogs', () => {
    it('should export audit logs successfully', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      mockWorkspaceTeamService.exportAuditLogs.mockResolvedValue(mockBlob);

      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({});

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.exportAuditLogs).toHaveBeenCalledWith({});
      expect(result.current.data).toEqual(mockBlob);
    });

    it('should export audit logs with filters', async () => {
      const filters: AuditFilters = {
        startDate: '2024-10-01',
        endDate: '2024-10-10',
      };

      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      mockWorkspaceTeamService.exportAuditLogs.mockResolvedValue(mockBlob);

      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(filters);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockWorkspaceTeamService.exportAuditLogs).toHaveBeenCalledWith(filters);
    });
  });

  // ============================================================================
  // Statistics Hook Tests
  // ============================================================================

  describe('useWorkspaceStats', () => {
    it('should fetch workspace stats successfully', async () => {
      const mockStats = {
        totalMembers: 25,
        activeMembers: 20,
        suspendedMembers: 3,
        pendingApprovals: 2,
        activeInvites: 5,
        expiredInvites: 10,
      };

      mockWorkspaceTeamService.getWorkspaceStats.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useWorkspaceStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStats);
      expect(mockWorkspaceTeamService.getWorkspaceStats).toHaveBeenCalled();
    });

    it('should handle errors when fetching stats', async () => {
      mockWorkspaceTeamService.getWorkspaceStats.mockRejectedValue(
        new Error('Failed to fetch stats')
      );

      const { result } = renderHook(() => useWorkspaceStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Failed to fetch stats'));
    });
  });
});
