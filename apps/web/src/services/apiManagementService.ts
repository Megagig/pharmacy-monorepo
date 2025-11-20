import { api } from '../lib/api';

/**
 * API Management Service
 * Handles API endpoint management, API keys, and usage analytics
 */

// Types
export interface ApiEndpoint {
    id: string;
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    version: string;
    description: string;
    category: string;
    parameters?: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'object' | 'array';
        required: boolean;
        description: string;
    }>;
    responses?: Array<{
        statusCode: number;
        description: string;
    }>;
    authentication?: {
        required: boolean;
        type: 'bearer' | 'api_key' | 'basic';
        scopes?: string[];
    };
    rateLimit?: {
        requests: number;
        window: number;
    };
    deprecated: boolean;
    tags?: string[];
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ApiKey {
    keyId: string;
    name: string;
    description?: string;
    userId: string;
    scopes: string[];
    rateLimit?: {
        requests: number;
        window: number;
    };
    expiresAt?: Date;
    allowedIPs?: string[];
    allowedDomains?: string[];
    environment: 'development' | 'staging' | 'production';
    isActive: boolean;
    lastUsed?: Date;
    createdAt: Date;
}

export interface ApiUsageAnalytics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    byEndpoint: Array<{
        endpoint: string;
        method: string;
        requests: number;
        avgResponseTime: number;
    }>;
    byStatusCode: Record<string, number>;
    trends: Array<{
        timestamp: string;
        requests: number;
        errors: number;
    }>;
}

class ApiManagementService {
    private baseUrl = '/admin/api-management';

    // Endpoint Management
    async getEndpoints(params?: {
        category?: string;
        version?: string;
        deprecated?: boolean;
        isPublic?: boolean;
        tags?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ endpoints: ApiEndpoint[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/endpoints`, { params });
        return response.data;
    }

    async createOrUpdateEndpoint(data: Omit<ApiEndpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiEndpoint> {
        const response = await api.post(`${this.baseUrl}/endpoints`, data);
        return response.data;
    }

    async deleteEndpoint(id: string): Promise<{ success: boolean }> {
        const response = await api.delete(`${this.baseUrl}/endpoints/${id}`);
        return response.data;
    }

    async generateOpenApiSpec(): Promise<any> {
        const response = await api.get(`${this.baseUrl}/openapi-spec`);
        return response.data;
    }

    // API Key Management
    async getApiKeys(params?: {
        userId?: string;
        environment?: 'development' | 'staging' | 'production';
        isActive?: boolean;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ apiKeys: ApiKey[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/api-keys`, { params });
        return response.data;
    }

    async createApiKey(data: {
        name: string;
        description?: string;
        userId: string;
        scopes: string[];
        rateLimit?: { requests: number; window: number };
        expiresAt?: string;
        allowedIPs?: string[];
        allowedDomains?: string[];
        environment: 'development' | 'staging' | 'production';
    }): Promise<{ apiKey: ApiKey; key: string }> {
        const response = await api.post(`${this.baseUrl}/api-keys`, data);
        return response.data;
    }

    async revokeApiKey(keyId: string): Promise<{ success: boolean }> {
        const response = await api.delete(`${this.baseUrl}/api-keys/${keyId}`);
        return response.data;
    }

    // Analytics
    async getUsageAnalytics(params?: {
        endpoint?: string;
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
        userId?: string;
        apiKeyId?: string;
        startDate?: string;
        endDate?: string;
        statusCode?: number;
        groupBy?: 'hour' | 'day' | 'week' | 'month';
    }): Promise<ApiUsageAnalytics> {
        const response = await api.get(`${this.baseUrl}/analytics`, { params });
        return response.data;
    }

    async getApiVersions(): Promise<string[]> {
        const response = await api.get(`${this.baseUrl}/versions`);
        return response.data;
    }

    async getApiCategories(): Promise<string[]> {
        const response = await api.get(`${this.baseUrl}/categories`);
        return response.data;
    }
}

export default new ApiManagementService();
