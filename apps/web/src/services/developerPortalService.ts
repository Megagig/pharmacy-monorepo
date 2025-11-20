import { api } from '../lib/api';

/**
 * Developer Portal Service
 * Handles developer account management, API documentation, and sandbox testing
 */

// Types
export interface DeveloperAccount {
    id: string;
    userId: string;
    companyName?: string;
    website?: string;
    description?: string;
    contactEmail: string;
    contactPhone?: string;
    status: 'active' | 'suspended' | 'pending';
    subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise';
    isVerified: boolean;
    preferences: {
        emailNotifications: boolean;
        webhookNotifications: boolean;
        maintenanceAlerts: boolean;
        usageAlerts: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface ApiDocumentation {
    id: string;
    endpointId: string;
    title: string;
    description: string;
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    tags: string[];
    examples: Array<{
        language: string;
        code: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

export interface SandboxSession {
    sessionId: string;
    name: string;
    description?: string;
    environment: 'sandbox' | 'testing';
    configuration: {
        timeout: number;
        retryAttempts: number;
    };
    isActive: boolean;
    createdAt: Date;
    expiresAt: Date;
}

class DeveloperPortalService {
    private baseUrl = '/developer-portal';

    // Account Management
    async verifyDeveloperAccount(token: string): Promise<{ success: boolean }> {
        const response = await api.post(`${this.baseUrl}/verify/${token}`);
        return response.data;
    }

    async getCurrentDeveloperAccount(): Promise<DeveloperAccount> {
        const response = await api.get(`${this.baseUrl}/account`);
        return response.data;
    }

    async createOrUpdateDeveloperAccount(data: Partial<DeveloperAccount>): Promise<DeveloperAccount> {
        const response = await api.post(`${this.baseUrl}/account`, data);
        return response.data;
    }

    async resendVerification(): Promise<{ success: boolean }> {
        const response = await api.post(`${this.baseUrl}/resend-verification`);
        return response.data;
    }

    async getOnboardingProgress(): Promise<{
        steps: Array<{ name: string; completed: boolean }>;
        progress: number;
    }> {
        const response = await api.get(`${this.baseUrl}/onboarding`);
        return response.data;
    }

    async updateOnboardingStep(step: string, completed?: boolean): Promise<{ success: boolean }> {
        const response = await api.post(`${this.baseUrl}/onboarding/${step}`, { completed });
        return response.data;
    }

    // Documentation
    async getApiDocumentation(params?: {
        category?: string;
        difficulty?: 'beginner' | 'intermediate' | 'advanced';
        tags?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ documentation: ApiDocumentation[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/documentation`, { params });
        return response.data;
    }

    async getDocumentationByEndpoint(endpointId: string): Promise<ApiDocumentation> {
        const response = await api.get(`${this.baseUrl}/documentation/endpoint/${endpointId}`);
        return response.data;
    }

    async getDocumentationCategories(): Promise<string[]> {
        const response = await api.get(`${this.baseUrl}/documentation/categories`);
        return response.data;
    }

    async getDocumentationTags(): Promise<string[]> {
        const response = await api.get(`${this.baseUrl}/documentation/tags`);
        return response.data;
    }

    async generateCodeExamples(endpointId: string, apiKey: string): Promise<{
        examples: Array<{ language: string; code: string }>;
    }> {
        const response = await api.get(`${this.baseUrl}/code-examples/${endpointId}`, {
            params: { apiKey }
        });
        return response.data;
    }

    // Sandbox
    async createSandboxSession(data: {
        name: string;
        description?: string;
        environment?: 'sandbox' | 'testing';
        configuration?: {
            timeout?: number;
            retryAttempts?: number;
        };
    }): Promise<SandboxSession> {
        const response = await api.post(`${this.baseUrl}/sandbox/sessions`, data);
        return response.data;
    }

    async getSandboxSessions(params?: {
        environment?: 'sandbox' | 'testing';
        isActive?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{ sessions: SandboxSession[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/sandbox/sessions`, { params });
        return response.data;
    }

    async getSandboxSession(sessionId: string): Promise<SandboxSession> {
        const response = await api.get(`${this.baseUrl}/sandbox/sessions/${sessionId}`);
        return response.data;
    }

    async executeApiTest(sessionId: string, data: {
        endpoint: string;
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
        headers?: Record<string, string>;
        body?: any;
        variables?: Record<string, any>;
    }): Promise<{
        success: boolean;
        statusCode: number;
        response: any;
        responseTime: number;
    }> {
        const response = await api.post(`${this.baseUrl}/sandbox/sessions/${sessionId}/test`, data);
        return response.data;
    }

    async getDeveloperApiKeys(): Promise<{ apiKeys: any[] }> {
        const response = await api.get(`${this.baseUrl}/api-keys`);
        return response.data;
    }

    // Admin Methods
    async getDeveloperAccounts(params?: {
        status?: 'active' | 'suspended' | 'pending';
        subscriptionTier?: 'free' | 'basic' | 'pro' | 'enterprise';
        isVerified?: boolean;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ accounts: DeveloperAccount[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/admin/accounts`, { params });
        return response.data;
    }
}

export default new DeveloperPortalService();
