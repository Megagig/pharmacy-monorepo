import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  Member,
  WorkspaceInvite,
  WorkspaceAuditLog,
  MemberFilters,
  AuditFilters,
  Pagination,
  GenerateInviteRequest,
  UpdateMemberRoleRequest,
  SuspendMemberRequest,
} from '../../types/workspace';

// Create mock axios instance before importing the service
const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: {
      use: vi.fn(),
    },
    response: {
      use: vi.fn(),
    },
  },
};

const mockIsAxiosError = vi.fn((error: any) => {
  return error && error.response !== undefined;
});

// Mock axios and apiClient
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockApiClient),
    isAxiosError: mockIsAxiosError,
  },
  isAxiosError: mockIsAxiosError,
}));

vi.mock('../apiClient', () => ({
  apiClient: mockApiClient,
}));

// Import service after mocking
const { default: workspaceTeamService } = await import('../workspaceTeamService');

describe('workspaceTeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMembers', () => {
    it('should fetch members with default pagination', async () => {
      const mockMembers: Member[] = [
        {
          _id: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          workplaceRole: 'Pharmacist',
          status: 'active',
          joinedAt: new Date('2024-01-01'),
          permissions: ['read:patients', 'write:prescriptions'],
        },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            members: mockMembers,
            pagination: {
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.getMembers();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/members?page=1&limit=20'
      );
      expect(result.members).toEqual(mockMembers);
      expect(result.pagination.total).toBe(1);
    });

    it('should fetch members with filters and custom pagination', async () => {
      const filters: MemberFilters = {
        search: 'john',
        role: 'Pharmacist',
        status: 'active',
      };
      const pagination: Pagination = { page: 2, limit: 10 };

      const mockResponse = {
        data: {
          success: true,
          data: {
            members: [],
            pagination: {
              page: 2,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      await workspaceTeamService.getMembers(filters, pagination);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/members?page=2&limit=10&search=john&role=Pharmacist&status=active'
      );
    });

    it('should throw error when API returns success: false', async () => {
      const mockResponse = {
        data: {
          success: false,
          message: 'Unauthorized access',
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      await expect(workspaceTeamService.getMembers()).rejects.toThrow(
        'Unauthorized access'
      );
    });

    it('should handle network errors', async () => {
      const networkError = {
        response: {
          data: {
            message: 'Network connection failed',
          },
        },
      };

      mockApiClient.get.mockRejectedValue(networkError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(workspaceTeamService.getMembers()).rejects.toThrow(
        'Network connection failed'
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      const memberId = 'member-123';
      const updateData: UpdateMemberRoleRequest = {
        workplaceRole: 'Cashier',
        reason: 'Promotion',
      };

      const mockMember: Member = {
        _id: memberId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        workplaceRole: 'Cashier',
        status: 'active',
        joinedAt: new Date('2024-01-01'),
        permissions: ['read:patients'],
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            member: mockMember,
          },
        },
      };

      mockApiClient.put.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.updateMemberRole(
        memberId,
        updateData
      );

      expect(mockApiClient.put).toHaveBeenCalledWith(
        `/workspace/team/members/${memberId}`,
        updateData
      );
      expect(result).toEqual(mockMember);
    });

    it('should throw error when update fails', async () => {
      const memberId = 'member-123';
      const updateData: UpdateMemberRoleRequest = {
        workplaceRole: 'Owner',
      };

      const mockResponse = {
        data: {
          success: false,
          message: 'Cannot assign Owner role',
        },
      };

      mockApiClient.put.mockResolvedValue(mockResponse);

      await expect(
        workspaceTeamService.updateMemberRole(memberId, updateData)
      ).rejects.toThrow();
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      const memberId = 'member-123';
      const removeData = { reason: 'Left organization' };

      const mockResponse = {
        data: {
          success: true,
          message: 'Member removed successfully',
        },
      };

      mockApiClient.delete.mockResolvedValue(mockResponse);

      await workspaceTeamService.removeMember(memberId, removeData);

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        `/workspace/team/members/${memberId}`,
        { data: removeData }
      );
    });

    it('should handle removal without reason', async () => {
      const memberId = 'member-123';

      const mockResponse = {
        data: {
          success: true,
          message: 'Member removed successfully',
        },
      };

      mockApiClient.delete.mockResolvedValue(mockResponse);

      await workspaceTeamService.removeMember(memberId);

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        `/workspace/team/members/${memberId}`,
        { data: {} }
      );
    });
  });

  describe('suspendMember', () => {
    it('should suspend member with reason', async () => {
      const memberId = 'member-123';
      const suspendData: SuspendMemberRequest = {
        reason: 'Policy violation',
      };

      const mockMember: Member = {
        _id: memberId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workplaceRole: 'Pharmacist',
        status: 'suspended',
        joinedAt: new Date('2024-01-01'),
        permissions: [],
        suspensionReason: 'Policy violation',
        suspendedAt: new Date(),
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            member: mockMember,
          },
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.suspendMember(
        memberId,
        suspendData
      );

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/workspace/team/members/${memberId}/suspend`,
        suspendData
      );
      expect(result.status).toBe('suspended');
      expect(result.suspensionReason).toBe('Policy violation');
    });

    it('should throw error when suspension fails', async () => {
      const memberId = 'member-123';
      const suspendData: SuspendMemberRequest = {
        reason: 'Test',
      };

      const mockResponse = {
        data: {
          success: false,
          message: 'Cannot suspend workspace owner',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await expect(
        workspaceTeamService.suspendMember(memberId, suspendData)
      ).rejects.toThrow();
    });
  });

  describe('activateMember', () => {
    it('should activate suspended member', async () => {
      const memberId = 'member-123';

      const mockMember: Member = {
        _id: memberId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workplaceRole: 'Pharmacist',
        status: 'active',
        joinedAt: new Date('2024-01-01'),
        permissions: ['read:patients'],
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            member: mockMember,
          },
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.activateMember(memberId);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/workspace/team/members/${memberId}/activate`
      );
      expect(result.status).toBe('active');
    });
  });

  describe('getInvites', () => {
    it('should fetch all invites', async () => {
      const mockInvites: WorkspaceInvite[] = [
        {
          _id: '1',
          workplaceId: 'workplace-1',
          inviteToken: 'token-123',
          email: 'newuser@example.com',
          workplaceRole: 'Pharmacist',
          status: 'pending',
          invitedBy: 'owner-1',
          expiresAt: new Date('2024-12-31'),
          maxUses: 1,
          usedCount: 0,
          requiresApproval: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            invites: mockInvites,
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.getInvites();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/invites?'
      );
      expect(result.invites).toEqual(mockInvites);
    });

    it('should fetch invites with status filter', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            invites: [],
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      await workspaceTeamService.getInvites({ status: 'expired' });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/invites?status=expired'
      );
    });
  });

  describe('generateInvite', () => {
    it('should generate invite link successfully', async () => {
      const inviteData: GenerateInviteRequest = {
        email: 'newuser@example.com',
        workplaceRole: 'Pharmacist',
        expiresInDays: 7,
        maxUses: 1,
        requiresApproval: true,
        personalMessage: 'Welcome to our team!',
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            invite: {
              _id: 'invite-123',
              inviteToken: 'token-abc',
              inviteUrl: 'https://app.example.com/signup?invite=token-abc',
              expiresAt: new Date('2024-12-31'),
            },
          },
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.generateInvite(inviteData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/workspace/team/invites',
        inviteData
      );
      expect(result.invite.inviteToken).toBe('token-abc');
      expect(result.invite.inviteUrl).toContain('token-abc');
    });

    it('should throw error when invite generation fails', async () => {
      const inviteData: GenerateInviteRequest = {
        email: 'invalid@example.com',
        workplaceRole: 'Pharmacist',
        expiresInDays: 7,
        maxUses: 1,
        requiresApproval: false,
      };

      const mockResponse = {
        data: {
          success: false,
          message: 'Email already invited',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await expect(
        workspaceTeamService.generateInvite(inviteData)
      ).rejects.toThrow();
    });
  });

  describe('revokeInvite', () => {
    it('should revoke invite successfully', async () => {
      const inviteId = 'invite-123';

      const mockResponse = {
        data: {
          success: true,
          message: 'Invite revoked successfully',
        },
      };

      mockApiClient.delete.mockResolvedValue(mockResponse);

      await workspaceTeamService.revokeInvite(inviteId);

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        `/workspace/team/invites/${inviteId}`
      );
    });
  });

  describe('getPendingMembers', () => {
    it('should fetch pending members', async () => {
      const mockPendingMembers: Member[] = [
        {
          _id: '1',
          firstName: 'Pending',
          lastName: 'User',
          email: 'pending@example.com',
          workplaceRole: 'Pharmacist',
          status: 'pending',
          joinedAt: new Date('2024-01-01'),
          permissions: [],
        },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            pendingMembers: mockPendingMembers,
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.getPendingMembers();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/invites/pending'
      );
      expect(result.pendingMembers).toEqual(mockPendingMembers);
    });
  });

  describe('approveMember', () => {
    it('should approve pending member', async () => {
      const memberId = 'member-123';
      const approveData = { workplaceRole: 'Cashier' as const };

      const mockMember: Member = {
        _id: memberId,
        firstName: 'Approved',
        lastName: 'User',
        email: 'approved@example.com',
        workplaceRole: 'Cashier',
        status: 'active',
        joinedAt: new Date('2024-01-01'),
        permissions: ['read:patients'],
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            member: mockMember,
          },
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.approveMember(
        memberId,
        approveData
      );

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/workspace/team/invites/${memberId}/approve`,
        approveData
      );
      expect(result.status).toBe('active');
    });

    it('should approve member without role override', async () => {
      const memberId = 'member-123';

      const mockMember: Member = {
        _id: memberId,
        firstName: 'Approved',
        lastName: 'User',
        email: 'approved@example.com',
        workplaceRole: 'Pharmacist',
        status: 'active',
        joinedAt: new Date('2024-01-01'),
        permissions: ['read:patients'],
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            member: mockMember,
          },
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await workspaceTeamService.approveMember(memberId);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/workspace/team/invites/${memberId}/approve`,
        {}
      );
    });
  });

  describe('rejectMember', () => {
    it('should reject pending member with reason', async () => {
      const memberId = 'member-123';
      const rejectData = { reason: 'Incomplete credentials' };

      const mockResponse = {
        data: {
          success: true,
          message: 'Member rejected successfully',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await workspaceTeamService.rejectMember(memberId, rejectData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/workspace/team/invites/${memberId}/reject`,
        rejectData
      );
    });

    it('should reject member without reason', async () => {
      const memberId = 'member-123';

      const mockResponse = {
        data: {
          success: true,
          message: 'Member rejected successfully',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await workspaceTeamService.rejectMember(memberId);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/workspace/team/invites/${memberId}/reject`,
        {}
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should fetch audit logs with default pagination', async () => {
      const mockLogs: WorkspaceAuditLog[] = [
        {
          _id: '1',
          workplaceId: 'workplace-1',
          actorId: {
            _id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
          },
          action: 'member_suspended',
          category: 'member',
          details: {
            reason: 'Policy violation',
          },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date('2024-01-01'),
          severity: 'high',
        },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            logs: mockLogs,
            pagination: {
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.getAuditLogs();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/audit?page=1&limit=20'
      );
      expect(result.logs).toEqual(mockLogs);
    });

    it('should fetch audit logs with filters', async () => {
      const filters: AuditFilters = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        actorId: 'user-1',
        category: 'member',
        action: 'member_suspended',
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            logs: [],
            pagination: {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            },
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      await workspaceTeamService.getAuditLogs(filters);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/audit?page=1&limit=20&startDate=2024-01-01&endDate=2024-12-31&actorId=user-1&category=member&action=member_suspended'
      );
    });
  });

  describe('exportAuditLogs', () => {
    it('should export audit logs as CSV', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });

      mockApiClient.get.mockResolvedValue({ data: mockBlob });

      const result = await workspaceTeamService.exportAuditLogs();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/audit/export?',
        { responseType: 'blob' }
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export audit logs with filters', async () => {
      const filters: AuditFilters = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });

      mockApiClient.get.mockResolvedValue({ data: mockBlob });

      await workspaceTeamService.exportAuditLogs(filters);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/workspace/team/audit/export?startDate=2024-01-01&endDate=2024-12-31',
        { responseType: 'blob' }
      );
    });
  });

  describe('getWorkspaceStats', () => {
    it('should fetch workspace statistics', async () => {
      const mockStats = {
        totalMembers: 10,
        activeMembers: 8,
        pendingApprovals: 2,
        activeInvites: 3,
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockStats,
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await workspaceTeamService.getWorkspaceStats();

      expect(mockApiClient.get).toHaveBeenCalledWith('/workspace/team/stats');
      expect(result).toEqual(mockStats);
    });

    it('should throw error when stats fetch fails', async () => {
      const mockResponse = {
        data: {
          success: false,
          message: 'Failed to calculate stats',
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      await expect(workspaceTeamService.getWorkspaceStats()).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle axios errors with response data message', async () => {
      const axiosError = {
        response: {
          data: {
            message: 'Detailed error from server',
          },
        },
      };

      mockApiClient.get.mockRejectedValue(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(workspaceTeamService.getMembers()).rejects.toThrow(
        'Detailed error from server'
      );
    });

    it('should handle axios errors without response data message', async () => {
      const axiosError = {
        response: {
          data: {},
        },
      };

      mockApiClient.get.mockRejectedValue(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(workspaceTeamService.getMembers()).rejects.toThrow(
        'Failed to fetch members'
      );
    });

    it('should rethrow non-axios errors', async () => {
      const genericError = new Error('Generic error');

      mockApiClient.get.mockRejectedValue(genericError);
      mockIsAxiosError.mockReturnValue(false);

      await expect(workspaceTeamService.getMembers()).rejects.toThrow(
        'Generic error'
      );
    });
  });
});
