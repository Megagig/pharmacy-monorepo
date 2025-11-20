import { apiClient } from '../../../lib/apiClient';

export interface CreateClinicalNoteFromDiagnosticRequest {
    diagnosticRequestId: string;
    diagnosticResultId?: string;
    patientId: string;
    noteData?: {
        title?: string;
        content?: {
            subjective?: string;
            objective?: string;
            assessment?: string;
            plan?: string;
        };
        type?: 'consultation' | 'medication_review' | 'follow_up' | 'adverse_event' | 'other';
        priority?: 'low' | 'medium' | 'high';
        followUpRequired?: boolean;
        followUpDate?: Date;
        tags?: string[];
        recommendations?: string[];
    };
}

export interface AddDiagnosticDataToMTRRequest {
    diagnosticRequestId: string;
    diagnosticResultId?: string;
    patientId: string;
}

export interface CreateMTRFromDiagnosticRequest {
    diagnosticRequestId: string;
    diagnosticResultId?: string;
    patientId: string;
    mtrData?: {
        priority?: 'routine' | 'urgent' | 'high_risk';
        reviewReason?: string;
    };
}

export interface TimelineOptions {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}

export interface TimelineEvent {
    type: 'diagnostic' | 'clinical_note' | 'mtr';
    id: string;
    date: string;
    title: string;
    summary: string;
    priority?: string;
    status?: string;
    data: any;
}

export interface CrossReferenceResult {
    relatedClinicalNotes: any[];
    relatedMTRs: any[];
    correlations: Array<{
        type: 'medication_match' | 'symptom_match' | 'diagnosis_match';
        recordType: 'clinical_note' | 'mtr';
        recordId: string;
        correlation: string;
        confidence: number;
    }>;
}

export interface IntegrationOptions {
    canCreateClinicalNote: boolean;
    canCreateMTR: boolean;
    existingMTRs: Array<{
        id: string;
        reviewNumber: string;
        status: string;
        priority: string;
        canEnrich: boolean;
    }>;
    correlations: Array<{
        type: string;
        recordType: string;
        recordId: string;
        correlation: string;
        confidence: number;
    }>;
    recommendations: string[];
}

export const diagnosticIntegrationApi = {
    /**
     * Create clinical note from diagnostic results
     */
    async createClinicalNoteFromDiagnostic(data: CreateClinicalNoteFromDiagnosticRequest) {
        const response = await apiClient.post('/diagnostics/integration/clinical-note', data);
        return response.data;
    },

    /**
     * Add diagnostic data to existing MTR
     */
    async addDiagnosticDataToMTR(mtrId: string, data: AddDiagnosticDataToMTRRequest) {
        const response = await apiClient.post(`/diagnostics/integration/mtr/${mtrId}/enrich`, data);
        return response.data;
    },

    /**
     * Create new MTR from diagnostic results
     */
    async createMTRFromDiagnostic(data: CreateMTRFromDiagnosticRequest) {
        const response = await apiClient.post('/diagnostics/integration/mtr', data);
        return response.data;
    },

    /**
     * Get unified patient timeline with diagnostic events
     */
    async getUnifiedPatientTimeline(patientId: string, options: TimelineOptions = {}) {
        const params = new URLSearchParams();

        if (options.startDate) {
            params.append('startDate', options.startDate.toISOString());
        }
        if (options.endDate) {
            params.append('endDate', options.endDate.toISOString());
        }
        if (options.limit) {
            params.append('limit', options.limit.toString());
        }

        const response = await apiClient.get(
            `/diagnostics/integration/timeline/${patientId}?${params.toString()}`
        );
        return response.data;
    },

    /**
     * Cross-reference diagnostic data with existing clinical records
     */
    async crossReferenceWithExistingRecords(diagnosticRequestId: string): Promise<{ data: CrossReferenceResult }> {
        const response = await apiClient.get(
            `/diagnostics/integration/cross-reference/${diagnosticRequestId}`
        );
        return response.data;
    },

    /**
     * Get integration options for a diagnostic result
     */
    async getIntegrationOptions(diagnosticRequestId: string): Promise<{ data: IntegrationOptions }> {
        const response = await apiClient.get(
            `/diagnostics/integration/options/${diagnosticRequestId}`
        );
        return response.data;
    },
};