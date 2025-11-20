import api from '../../../lib/api';
import type {
    DiagnosticRequest,
    DiagnosticResult,
    DiagnosticRequestForm,
    ApiResponse,
    PaginatedResponse,
    DiagnosticHistoryParams
} from '../types';

const API_BASE = '/api/diagnostics';

export const diagnosticApi = {
    // Create new diagnostic request
    createRequest: async (data: DiagnosticRequestForm): Promise<ApiResponse<DiagnosticRequest>> => {
        const response = await api.post(`${API_BASE}`, data);
        return response.data;
    },

    // Get diagnostic result by request ID
    getResult: async (requestId: string): Promise<ApiResponse<DiagnosticResult>> => {
        const response = await api.get(`${API_BASE}/${requestId}`);
        return response.data;
    },

    // Get diagnostic request by ID
    getRequest: async (requestId: string): Promise<ApiResponse<DiagnosticRequest>> => {
        const response = await api.get(`${API_BASE}/requests/${requestId}`);
        return response.data;
    },

    // Get patient diagnostic history
    getHistory: async (params: DiagnosticHistoryParams): Promise<PaginatedResponse<DiagnosticRequest>> => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });

        const response = await api.get(`${API_BASE}/history?${searchParams.toString()}`);
        return response.data;
    },

    // Approve diagnostic result
    approveResult: async (resultId: string): Promise<ApiResponse<DiagnosticResult>> => {
        const response = await api.post(`${API_BASE}/results/${resultId}/approve`);
        return response.data;
    },

    // Modify diagnostic result
    modifyResult: async (
        resultId: string,
        modifications: string
    ): Promise<ApiResponse<DiagnosticResult>> => {
        const response = await api.post(`${API_BASE}/results/${resultId}/modify`, {
            modifications
        });
        return response.data;
    },

    // Reject diagnostic result
    rejectResult: async (
        resultId: string,
        rejectionReason: string
    ): Promise<ApiResponse<DiagnosticResult>> => {
        const response = await api.post(`${API_BASE}/results/${resultId}/reject`, {
            rejectionReason
        });
        return response.data;
    },

    // Cancel diagnostic request
    cancelRequest: async (requestId: string): Promise<ApiResponse<DiagnosticRequest>> => {
        const response = await api.post(`${API_BASE}/requests/${requestId}/cancel`);
        return response.data;
    },

    // Get processing status
    getStatus: async (requestId: string): Promise<ApiResponse<{
        status: string;
        progress?: number;
        message?: string;
        estimatedCompletion?: string;
    }>> => {
        const response = await api.get(`${API_BASE}/requests/${requestId}/status`);
        return response.data;
    },

    // Get diagnostic analytics
    getAnalytics: async (params?: {
        dateFrom?: string;
        dateTo?: string;
        patientId?: string;
    }): Promise<ApiResponse<{
        totalRequests: number;
        completedRequests: number;
        averageProcessingTime: number;
        averageConfidenceScore: number;
        topDiagnoses: Array<{
            condition: string;
            count: number;
            averageConfidence: number;
        }>;
        pharmacistReviewStats: {
            approvedCount: number;
            modifiedCount: number;
            rejectedCount: number;
            averageReviewTime: number;
        };
    }>> => {
        const searchParams = new URLSearchParams();

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            });
        }

        const response = await api.get(`${API_BASE}/analytics?${searchParams.toString()}`);
        return response.data;
    }
};