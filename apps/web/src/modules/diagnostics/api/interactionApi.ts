import { apiClient } from '../../../lib/api';
import type {
    DrugInteraction,
    AllergyAlert,
    Contraindication,
    ApiResponse
} from '../types';

const API_BASE = '/api/interactions';

export const interactionApi = {
    // Check drug interactions
    checkInteractions: async (data: {
        medications: string[];
        patientAllergies?: string[];
    }): Promise<ApiResponse<{
        interactions: DrugInteraction[];
        allergicReactions: AllergyAlert[];
        contraindications: Contraindication[];
    }>> => {
        return apiClient.post(`${API_BASE}/check`, data);
    },

    // Get drug information
    getDrugInfo: async (drugName: string): Promise<ApiResponse<{
        rxcui?: string;
        name: string;
        brandNames: string[];
        genericName?: string;
        drugClass?: string;
        indications: string[];
        contraindications: string[];
        sideEffects: string[];
        dosageForm?: string;
        strength?: string;
        route?: string;
    }>> => {
        return apiClient.get(`${API_BASE}/drug-info?name=${encodeURIComponent(drugName)}`);
    },

    // Search drugs
    searchDrugs: async (query: string, limit: number = 10): Promise<ApiResponse<Array<{
        rxcui: string;
        name: string;
        synonym?: string;
        tty?: string;
    }>>> => {
        return apiClient.get(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    },

    // Check allergy contraindications
    checkAllergies: async (data: {
        medications: string[];
        allergies: string[];
    }): Promise<ApiResponse<AllergyAlert[]>> => {
        return apiClient.post(`${API_BASE}/check-allergies`, data);
    },

    // Get interaction details
    getInteractionDetails: async (
        drug1: string,
        drug2: string
    ): Promise<ApiResponse<{
        interaction: DrugInteraction;
        clinicalStudies?: Array<{
            title: string;
            summary: string;
            url?: string;
        }>;
        guidelines?: Array<{
            organization: string;
            recommendation: string;
            evidenceLevel?: string;
        }>;
    }>> => {
        return apiClient.get(`${API_BASE}/details?drug1=${encodeURIComponent(drug1)}&drug2=${encodeURIComponent(drug2)}`);
    },

    // Get drug class interactions
    getClassInteractions: async (drugClass: string): Promise<ApiResponse<Array<{
        interactingClass: string;
        severity: 'minor' | 'moderate' | 'major';
        description: string;
        examples: Array<{
            drug1: string;
            drug2: string;
        }>;
    }>>> => {
        return apiClient.get(`${API_BASE}/class-interactions?class=${encodeURIComponent(drugClass)}`);
    },

    // Get food interactions
    getFoodInteractions: async (drugName: string): Promise<ApiResponse<Array<{
        food: string;
        interaction: string;
        severity: 'minor' | 'moderate' | 'major';
        recommendation: string;
    }>>> => {
        return apiClient.get(`${API_BASE}/food-interactions?drug=${encodeURIComponent(drugName)}`);
    },

    // Get pregnancy/lactation information
    getPregnancyInfo: async (drugName: string): Promise<ApiResponse<{
        pregnancyCategory?: string;
        pregnancyRisk: string;
        lactationRisk: string;
        recommendations: {
            pregnancy: string;
            lactation: string;
        };
    }>> => {
        return apiClient.get(`${API_BASE}/pregnancy-info?drug=${encodeURIComponent(drugName)}`);
    }
};