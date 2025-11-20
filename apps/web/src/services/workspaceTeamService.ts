/**
 * Workspace Team Service
 * Handles all API calls for workspace team management
 */

import axios, { AxiosError } from 'axios';
import { apiClient } from './apiClient';
import type {
  Member,
  MemberFilters,
  AuditFilters,
  InviteFilters,
  Pagination,
  GetMembersResponse,
  GetInvitesResponse,
  GetPendingMembersResponse,
  GetAuditLogsResponse,
  GenerateInviteResponse,
  UpdateMemberRoleRequest,
  SuspendMemberRequest,
  RemoveMemberRequest,
  GenerateInviteRequest,
  ApproveMemberRequest,
  RejectMemberRequest,
  WorkspaceStats,
  PendingLicense,
} from '../types/workspace';

/**
 * Workspace Team Service Class
 * Provides methods for managing workspace team members, invites, and audit logs
 */
class WorkspaceTeamService {
  private baseUrl = '/workspace/team';

  /**
   * Get all members in the workspace with optional filters and pagination
   */
  async getMembers(
    filters: MemberFilters = {},
    pagination: Pagination = { page: 1, limit: 20 }
  ): Promise<GetMembersResponse> {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      // Add filters if provided
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.role) {
        params.append('role', filters.role);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }

      const response = await apiClient.get(`${this.baseUrl}/members?${params}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch members');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to fetch members'
        );
      }
      throw error;
    }
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    memberId: string,
    data: UpdateMemberRoleRequest
  ): Promise<Member> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/members/${memberId}`,
        data
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update member role');
      }

      return response.data.data.member;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to update member role'
        );
      }
      throw error;
    }
  }

  /**
   * Remove a member from the workspace
   */
  async removeMember(
    memberId: string,
    data: RemoveMemberRequest = {}
  ): Promise<void> {
    try {
      const response = await apiClient.delete(
        `${this.baseUrl}/members/${memberId}`,
        { data }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to remove member');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to remove member'
        );
      }
      throw error;
    }
  }

  /**
   * Suspend a member
   */
  async suspendMember(
    memberId: string,
    data: SuspendMemberRequest
  ): Promise<Member> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/members/${memberId}/suspend`,
        data
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to suspend member');
      }

      return response.data.data.member;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to suspend member'
        );
      }
      throw error;
    }
  }

  /**
   * Activate a suspended member
   */
  async activateMember(memberId: string): Promise<Member> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/members/${memberId}/activate`
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to activate member');
      }

      return response.data.data.member;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to activate member'
        );
      }
      throw error;
    }
  }

  /**
   * Get all invites for the workspace
   */
  async getInvites(filters: InviteFilters = {}): Promise<GetInvitesResponse> {
    try {
      const params = new URLSearchParams();

      if (filters.status) {
        params.append('status', filters.status);
      }

      const response = await apiClient.get(
        `${this.baseUrl}/invites?${params}`
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch invites');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to fetch invites'
        );
      }
      throw error;
    }
  }

  /**
   * Generate a new invite link
   */
  async generateInvite(
    data: GenerateInviteRequest
  ): Promise<GenerateInviteResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/invites`, data);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to generate invite');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to generate invite'
        );
      }
      throw error;
    }
  }

  /**
   * Revoke an invite link
   */
  async revokeInvite(inviteId: string): Promise<void> {
    try {
      const response = await apiClient.delete(
        `${this.baseUrl}/invites/${inviteId}`
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to revoke invite');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to revoke invite'
        );
      }
      throw error;
    }
  }

  /**
   * Get pending member approvals
   */
  async getPendingMembers(): Promise<GetPendingMembersResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/invites/pending`);

      if (!response.data.success) {
        throw new Error(
          response.data.message || 'Failed to fetch pending members'
        );
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to fetch pending members'
        );
      }
      throw error;
    }
  }

  /**
   * Approve a pending member
   */
  async approveMember(
    memberId: string,
    data: ApproveMemberRequest = {}
  ): Promise<Member> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/invites/${memberId}/approve`,
        data
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to approve member');
      }

      return response.data.data.member;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to approve member'
        );
      }
      throw error;
    }
  }

  /**
   * Reject a pending member
   */
  async rejectMember(
    memberId: string,
    data: RejectMemberRequest = {}
  ): Promise<void> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/invites/${memberId}/reject`,
        data
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to reject member');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to reject member'
        );
      }
      throw error;
    }
  }

  /**
   * Get audit logs for the workspace
   */
  async getAuditLogs(
    filters: AuditFilters = {},
    pagination: Pagination = { page: 1, limit: 20 }
  ): Promise<GetAuditLogsResponse> {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      // Add filters if provided
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.actorId) {
        params.append('actorId', filters.actorId);
      }
      if (filters.category) {
        params.append('category', filters.category);
      }
      if (filters.action) {
        params.append('action', filters.action);
      }

      const response = await apiClient.get(`${this.baseUrl}/audit?${params}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch audit logs');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to fetch audit logs'
        );
      }
      throw error;
    }
  }

  /**
   * Export audit logs as CSV
   */
  async exportAuditLogs(filters: AuditFilters = {}): Promise<Blob> {
    try {
      const params = new URLSearchParams();

      // Add filters if provided
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.actorId) {
        params.append('actorId', filters.actorId);
      }
      if (filters.category) {
        params.append('category', filters.category);
      }
      if (filters.action) {
        params.append('action', filters.action);
      }

      const response = await apiClient.get(
        `${this.baseUrl}/audit/export?${params}`,
        {
          responseType: 'blob',
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to export audit logs'
        );
      }
      throw error;
    }
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(): Promise<WorkspaceStats> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`);

      if (!response.data.success) {
        throw new Error(
          response.data.message || 'Failed to fetch workspace stats'
        );
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to fetch workspace stats'
        );
      }
      throw error;
    }
  }

  /**
   * Get pending license approvals for the workspace
   */
  async getPendingLicenseApprovals(): Promise<PendingLicense[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/licenses/pending`);

      if (!response.data.success) {
        throw new Error(
          response.data.message || 'Failed to fetch pending license approvals'
        );
      }

      return response.data.data.pendingLicenses;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to fetch pending license approvals'
        );
      }
      throw error;
    }
  }

  /**
   * Approve a member's license
   */
  async approveMemberLicense(memberId: string): Promise<void> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/licenses/${memberId}/approve`
      );

      if (!response.data.success) {
        throw new Error(
          response.data.message || 'Failed to approve license'
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to approve license'
        );
      }
      throw error;
    }
  }

  /**
   * Reject a member's license
   */
  async rejectMemberLicense(memberId: string, reason: string): Promise<void> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/licenses/${memberId}/reject`,
        { reason }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.message || 'Failed to reject license'
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message || 'Failed to reject license'
        );
      }
      throw error;
    }
  }
}

// Export singleton instance
export const workspaceTeamService = new WorkspaceTeamService();
export default workspaceTeamService;
