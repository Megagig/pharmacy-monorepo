import api from '../../../lib/api';
import type {
    LabOrder,
    LabResult,
    LabOrderForm,
    LabResultForm,
    ApiResponse,
    PaginatedResponse,
    LabOrderParams,
    LabResultParams
} from '../types';

const API_BASE = '/api/lab';

export const labApi = {
    // Lab Orders
    createOrder: async (data: LabOrderForm): Promise<ApiResponse<LabOrder>> => {
        const response = await api.post(`${API_BASE}/orders`, data);
        return response.data;
    },

    getOrders: async (params: LabOrderParams = {}): Promise<PaginatedResponse<LabOrder>> => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });

        const response = await api.get(`${API_BASE}/orders?${searchParams.toString()}`);
        return response.data;
    },

    getOrder: async (orderId: string): Promise<ApiResponse<LabOrder>> => {
        const response = await api.get(`${API_BASE}/orders/${orderId}`);
        return response.data;
    },

    updateOrderStatus: async (
        orderId: string,
        status: LabOrder['status']
    ): Promise<ApiResponse<LabOrder>> => {
        const response = await api.patch(`${API_BASE}/orders/${orderId}/status`, { status });
        return response.data;
    },

    cancelOrder: async (orderId: string): Promise<ApiResponse<LabOrder>> => {
        const response = await api.post(`${API_BASE}/orders/${orderId}/cancel`);
        return response.data;
    },

    // Lab Results
    addResult: async (data: LabResultForm): Promise<ApiResponse<LabResult>> => {
        const response = await api.post(`${API_BASE}/results`, data);
        return response.data;
    },

    getResults: async (params: LabResultParams = {}): Promise<PaginatedResponse<LabResult>> => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });

        const response = await api.get(`${API_BASE}/results?${searchParams.toString()}`);
        return response.data;
    },

    getResult: async (resultId: string): Promise<ApiResponse<LabResult>> => {
        const response = await api.get(`${API_BASE}/results/${resultId}`);
        return response.data;
    },

    updateResult: async (
        resultId: string,
        data: Partial<LabResultForm>
    ): Promise<ApiResponse<LabResult>> => {
        const response = await api.patch(`${API_BASE}/results/${resultId}`, data);
        return response.data;
    },

    deleteResult: async (resultId: string): Promise<ApiResponse<null>> => {
        const response = await api.delete(`${API_BASE}/results/${resultId}`);
        return response.data;
    },

    // Trend Analysis
    getTrends: async (
        patientId: string,
        testCode: string,
        days: number = 90
    ): Promise<ApiResponse<{
        testCode: string;
        testName: string;
        unit?: string;
        referenceRange: {
            low?: number;
            high?: number;
            text?: string;
        };
        results: Array<{
            value: string;
            numericValue?: number;
            interpretation: string;
            performedAt: string;
            flags: string[];
        }>;
        trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
        summary: {
            latestValue: string;
            latestInterpretation: string;
            changeFromPrevious?: number;
            abnormalCount: number;
            totalCount: number;
        };
    }>> => {
        const response = await api.get(`${API_BASE}/trends/${patientId}/${testCode}?days=${days}`);
        return response.data;
    },

    // Critical Results
    getCriticalResults: async (workplaceId?: string): Promise<ApiResponse<LabResult[]>> => {
        const params = workplaceId ? `?workplaceId=${workplaceId}` : '';
        const response = await api.get(`${API_BASE}/results/critical${params}`);
        return response.data;
    },

    // Abnormal Results
    getAbnormalResults: async (
        patientId: string,
        days: number = 30
    ): Promise<ApiResponse<LabResult[]>> => {
        const response = await api.get(`${API_BASE}/results/abnormal/${patientId}?days=${days}`);
        return response.data;
    },

    // FHIR Integration
    importFHIR: async (data: {
        fhirBundle: any;
        patientMapping: {
            fhirPatientId: string;
            internalPatientId: string;
        };
    }): Promise<ApiResponse<LabResult[]>> => {
        const response = await api.post(`${API_BASE}/import/fhir`, data);
        return response.data;
    },

    exportOrder: async (orderId: string): Promise<ApiResponse<{
        fhirResource: any;
        exportedAt: string;
    }>> => {
        const response = await api.post(`${API_BASE}/orders/${orderId}/export`);
        return response.data;
    },

    // Lab Test Catalog
    getTestCatalog: async (search?: string): Promise<ApiResponse<Array<{
        code: string;
        name: string;
        loincCode?: string;
        category: string;
        description?: string;
        referenceRange?: {
            low?: number;
            high?: number;
            text?: string;
            unit?: string;
        };
    }>>> => {
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        const response = await api.get(`${API_BASE}/catalog${params}`);
        return response.data;
    },

    // Reference Ranges
    getReferenceRanges: async (testCode: string): Promise<ApiResponse<{
        testCode: string;
        testName: string;
        ranges: Array<{
            ageGroup?: string;
            gender?: string;
            low?: number;
            high?: number;
            unit?: string;
            text?: string;
        }>;
    }>> => {
        const response = await api.get(`${API_BASE}/reference-ranges/${testCode}`);
        return response.data;
    }
};