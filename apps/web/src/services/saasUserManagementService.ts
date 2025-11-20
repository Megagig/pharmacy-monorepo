import { api } from '../lib/api';

/**
 * SaaS User Management Service
 * Handles advanced user management, bulk operations, and approvals
 */

// Types
export interface UserManagementFilters {
    role?: string;
    status?: string;
    workspaceId?: string;
    subscriptionPlan?: string;
    search?: string;
    lastLoginAfter?: string;
    lastLoginBefore?: string;
}

export interface BulkOperationResult {
    success: boolean;
    processed: number;
    failed: number;
    errors: string[];
}

class SaaSUserManagementService {
    private baseUrl = '/admin/saas/user-management';

    /**
     * Get all users with filtering and pagination
     */
    async getAllUsers(filters?: UserManagementFilters, pagination?: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{ users: any[]; pagination: any; filters: UserManagementFilters }> {
        const response = await api.get(`${this.baseUrl}/`, {
            params: { ...filters, ...pagination }
        });
        return response.data;
    }

    /**
     * Get user statistics
     */
    async getUserStatistics(timeRange?: '7d' | '30d' | '90d' | '1y'): Promise<{
        total: number;
        active: number;
        suspended: number;
        pending: number;
        byRole: Record<string, number>;
        byStatus: Record<string, number>;
        recentRegistrations: number;
    }> {
        const response = await api.get(`${this.baseUrl}/statistics`, {
            params: { timeRange }
        });
        return response.data;
    }

    /**
     * Search users
     */
    async searchUsers(query: string, filters?: {
        role?: string;
        status?: string;
        includeInactive?: boolean;
    }): Promise<{ users: any[] }> {
        const response = await api.post(`${this.baseUrl}/search`, {
            query,
            ...filters
        });
        return response.data;
    }

    /**
     * Bulk assign roles
     */
    async bulkAssignRoles(userIds: string[], roleId: string): Promise<BulkOperationResult> {
        const response = await api.post(`${this.baseUrl}/bulk-assign-roles`, {
            userIds,
            roleId
        });
        return response.data;
    }

    /**
     * Get user by ID
     */
    async getUserById(userId: string): Promise<any> {
        const response = await api.get(`${this.baseUrl}/${userId}`);
        return response.data;
    }

    /**
     * Update user role
     */
    async updateUserRole(userId: string, roleId: string, workspaceId?: string): Promise<void> {
        await api.put(`${this.baseUrl}/${userId}/role`, {
            roleId,
            workspaceId
        });
    }

    /**
     * Suspend user
     */
    async suspendUser(userId: string, reason: string): Promise<void> {
        await api.put(`${this.baseUrl}/${userId}/suspend`, { reason });
    }

    /**
     * Reactivate user
     */
    async reactivateUser(userId: string): Promise<void> {
        await api.put(`${this.baseUrl}/${userId}/reactivate`);
    }

    /**
     * Approve user
     */
    async approveUser(userId: string): Promise<void> {
        await api.put(`${this.baseUrl}/${userId}/approve`);
    }

    /**
     * Reject user
     */
    async rejectUser(userId: string, reason?: string): Promise<void> {
        await api.put(`${this.baseUrl}/${userId}/reject`, { reason });
    }

    /**
     * Bulk approve users
     */
    async bulkApproveUsers(userIds: string[]): Promise<BulkOperationResult> {
        const response = await api.post(`${this.baseUrl}/bulk-approve`, { userIds });
        return response.data;
    }

    /**
     * Bulk reject users
     */
    async bulkRejectUsers(userIds: string[], reason?: string): Promise<BulkOperationResult> {
        const response = await api.post(`${this.baseUrl}/bulk-reject`, {
            userIds,
            reason
        });
        return response.data;
    }

    /**
     * Bulk suspend users
     */
    async bulkSuspendUsers(userIds: string[], reason: string): Promise<BulkOperationResult> {
        const response = await api.post(`${this.baseUrl}/bulk-suspend`, {
            userIds,
            reason
        });
        return response.data;
    }

    /**
     * Create new user
     */
    async createUser(data: {
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        workspaceId?: string;
        phone?: string;
    }): Promise<any> {
        const response = await api.post(`${this.baseUrl}/`, data);
        return response.data;
    }
}

export default new SaaSUserManagementService();
