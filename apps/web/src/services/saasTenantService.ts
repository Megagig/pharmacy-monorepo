import { api } from '../lib/api';

/**
 * SaaS Tenant Management Service
 * Handles tenant/workspace provisioning, management, and monitoring
 */

// Types
export interface Tenant {
    id: string;
    name: string;
    type: 'pharmacy' | 'clinic' | 'hospital' | 'enterprise';
    status: 'active' | 'suspended' | 'pending' | 'trial' | 'cancelled';
    subscriptionPlanId: string;
    subscriptionPlan?: {
        name: string;
        tier: string;
    };
    primaryContact: {
        name: string;
        email: string;
        phone?: string;
    };
    settings: {
        timezone?: string;
        currency?: string;
        language?: string;
    };
    limits: {
        maxUsers?: number;
        maxPatients?: number;
        storageLimit?: number;
    };
    usage: {
        users: number;
        patients: number;
        storage: number;
    };
    branding?: {
        primaryColor?: string;
        secondaryColor?: string;
        logo?: string;
        favicon?: string;
    };
    createdAt: Date;
    updatedAt: Date;
    lastActivity?: Date;
}

export interface TenantProvisionRequest {
    name: string;
    type: 'pharmacy' | 'clinic' | 'hospital' | 'enterprise';
    primaryContact: {
        name: string;
        email: string;
        phone?: string;
    };
    subscriptionPlanId: string;
    settings?: {
        timezone?: string;
        currency?: string;
        language?: string;
    };
    limits?: {
        maxUsers?: number;
        maxPatients?: number;
        storageLimit?: number;
    };
}

export interface TenantStatistics {
    total: number;
    active: number;
    suspended: number;
    trial: number;
    cancelled: number;
    byType: Record<string, number>;
    byPlan: Record<string, number>;
    recentActivity: Array<{
        tenantId: string;
        tenantName: string;
        action: string;
        timestamp: Date;
    }>;
}

class SaaSTenantService {
    private baseUrl = '/admin/saas/tenant-management';

    /**
     * Provision a new tenant workspace
     */
    async provisionTenant(data: TenantProvisionRequest): Promise<Tenant> {
        const response = await api.post(`${this.baseUrl}/tenants`, data);
        return response.data;
    }

    /**
     * Deprovision a tenant workspace
     */
    async deprovisionTenant(tenantId: string, options?: {
        deleteData?: boolean;
        reason?: string;
    }): Promise<{ success: boolean }> {
        const response = await api.delete(`${this.baseUrl}/tenants/${tenantId}`, { data: options });
        return response.data;
    }

    /**
     * Update tenant status
     */
    async updateTenantStatus(tenantId: string, status: Tenant['status'], reason?: string): Promise<Tenant> {
        const response = await api.put(`${this.baseUrl}/tenants/${tenantId}/status`, { status, reason });
        return response.data;
    }

    /**
     * Get tenant by ID
     */
    async getTenantById(tenantId: string, params?: {
        includeSettings?: boolean;
        includeUsage?: boolean;
        includeBranding?: boolean;
    }): Promise<Tenant> {
        const response = await api.get(`${this.baseUrl}/tenants/${tenantId}`, { params });
        return response.data;
    }

    /**
     * List tenants with filtering and pagination
     */
    async listTenants(params?: {
        status?: string | string[];
        type?: string | string[];
        subscriptionPlan?: string;
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        createdAfter?: string;
        createdBefore?: string;
        lastActivityAfter?: string;
        lastActivityBefore?: string;
    }): Promise<{ tenants: Tenant[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/tenants`, { params });
        return response.data;
    }

    /**
     * Update tenant usage metrics
     */
    async updateTenantUsage(tenantId: string, usage: Partial<Tenant['usage']>): Promise<Tenant> {
        const response = await api.put(`${this.baseUrl}/tenants/${tenantId}/usage`, usage);
        return response.data;
    }

    /**
     * Validate data isolation for a tenant
     */
    async validateDataIsolation(tenantId: string): Promise<{
        isValid: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        const response = await api.get(`${this.baseUrl}/tenants/${tenantId}/data-isolation/validate`);
        return response.data;
    }

    /**
     * Enforce data isolation for a tenant
     */
    async enforceDataIsolation(tenantId: string): Promise<{ success: boolean; fixed: number }> {
        const response = await api.post(`${this.baseUrl}/tenants/${tenantId}/data-isolation/enforce`);
        return response.data;
    }

    /**
     * Get tenant statistics
     */
    async getTenantStatistics(): Promise<TenantStatistics> {
        const response = await api.get(`${this.baseUrl}/statistics`);
        return response.data;
    }

    /**
     * Update tenant branding
     */
    async updateTenantBranding(tenantId: string, branding: Tenant['branding']): Promise<Tenant> {
        const response = await api.put(`${this.baseUrl}/tenants/${tenantId}/branding`, branding);
        return response.data;
    }

    /**
     * Update tenant limits and quotas
     */
    async updateTenantLimits(tenantId: string, limits: Tenant['limits']): Promise<Tenant> {
        const response = await api.put(`${this.baseUrl}/tenants/${tenantId}/limits`, limits);
        return response.data;
    }
}

export default new SaaSTenantService();
