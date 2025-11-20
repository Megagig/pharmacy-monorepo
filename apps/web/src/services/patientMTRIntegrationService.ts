import { apiHelpers } from './api';
import { mtrService } from './mtrService';
import type {
    Patient,
    MedicationRecord,
    DrugTherapyProblem as PatientDTP,
    ApiResponse,
} from '../types/patientManagement';
import type {
    MedicationTherapyReview,
    MTRMedicationEntry,
    DrugTherapyProblem as MTRDTP,
} from '../types/mtr';

// ===============================
// PATIENT-MTR INTEGRATION SERVICE
// ===============================

export interface PatientMTRSummary {
    patientId: string;
    totalMTRSessions: number;
    activeMTRSessions: number;
    completedMTRSessions: number;
    lastMTRDate?: string;
    nextScheduledMTR?: string;
    hasActiveMTR: boolean;
    mtrStatus: 'none' | 'active' | 'overdue' | 'scheduled';
    recentMTRs: MedicationTherapyReview[];
}

export interface MTRPatientData {
    patient: Patient;
    medications: MedicationRecord[];
    dtps: PatientDTP[];
    mtrHistory: MedicationTherapyReview[];
    activeMTR?: MedicationTherapyReview;
}

export interface MTRMedicationSync {
    patientMedications: MedicationRecord[];
    mtrMedications: MTRMedicationEntry[];
    syncStatus: 'synced' | 'needs_update' | 'conflicts';
    conflicts?: {
        field: string;
        patientValue: unknown;
        mtrValue: unknown;
        medication: string;
    }[];
}

/**
 * Service for integrating MTR with existing patient management system
 */
export const patientMTRIntegrationService = {
    // ===============================
    // PATIENT MTR SUMMARY
    // ===============================

    /**
     * Get MTR summary for a patient
     */
    async getPatientMTRSummary(patientId: string): Promise<PatientMTRSummary> {
        try {
            const response = await apiHelpers.get<{
                summary: PatientMTRSummary;
            }>(`/patients/${patientId}/mtr/summary`);

            return response.data.data.summary;
        } catch (error: unknown) {
            console.error('Failed to get patient MTR summary:', error);

            // If it's a 404, 403, or 429 error, don't try fallback - just return empty summary
            if (error?.response?.status === 404 ||
                error?.response?.status === 403 ||
                error?.response?.status === 429) {
                return {
                    patientId,
                    totalMTRSessions: 0,
                    activeMTRSessions: 0,
                    completedMTRSessions: 0,
                    hasActiveMTR: false,
                    mtrStatus: 'none',
                    recentMTRs: [],
                };
            }

            // For other errors, try fallback but with error handling
            try {
                const mtrSessions = await mtrService.getMTRSessionsByPatient(patientId);
                const sessions = mtrSessions.results || [];

                const activeSessions = sessions.filter(s => s.status === 'in_progress');
                const completedSessions = sessions.filter(s => s.status === 'completed');
                const lastMTR = sessions.sort((a, b) =>
                    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
                )[0];

                let mtrStatus: PatientMTRSummary['mtrStatus'] = 'none';
                if (activeSessions.length > 0) {
                    const hasOverdue = activeSessions.some(s => s.isOverdue);
                    mtrStatus = hasOverdue ? 'overdue' : 'active';
                } else if (sessions.length > 0) {
                    mtrStatus = 'none';
                }

                return {
                    patientId,
                    totalMTRSessions: sessions.length,
                    activeMTRSessions: activeSessions.length,
                    completedMTRSessions: completedSessions.length,
                    lastMTRDate: lastMTR?.startedAt,
                    hasActiveMTR: activeSessions.length > 0,
                    mtrStatus,
                    recentMTRs: sessions.slice(0, 3),
                };
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                // Return empty summary if both primary and fallback fail
                return {
                    patientId,
                    totalMTRSessions: 0,
                    activeMTRSessions: 0,
                    completedMTRSessions: 0,
                    hasActiveMTR: false,
                    mtrStatus: 'none',
                    recentMTRs: [],
                };
            }
        }
    },

    /**
     * Get comprehensive patient data for MTR
     */
    async getPatientDataForMTR(patientId: string): Promise<MTRPatientData> {
        try {
            const response = await apiHelpers.get<{
                patientData: MTRPatientData;
            }>(`/patients/${patientId}/mtr/data`);

            return response.data.data.patientData;
        } catch (error) {
            console.error('Failed to get patient data for MTR:', error);
            throw error;
        }
    },

    // ===============================
    // MEDICATION SYNCHRONIZATION
    // ===============================

    /**
     * Sync medications between patient records and MTR
     */
    async syncMedicationsWithMTR(
        patientId: string,
        mtrId: string
    ): Promise<MTRMedicationSync> {
        try {
            const response = await apiHelpers.post<{
                syncResult: MTRMedicationSync;
            }>(`/patients/${patientId}/mtr/${mtrId}/sync-medications`);

            return response.data.data.syncResult;
        } catch (error) {
            console.error('Failed to sync medications with MTR:', error);
            throw error;
        }
    },

    /**
     * Import patient medications into MTR
     */
    async importPatientMedicationsToMTR(
        patientId: string,
        mtrId: string,
        medicationIds?: string[]
    ): Promise<MTRMedicationEntry[]> {
        try {
            const response = await apiHelpers.post<{
                medications: MTRMedicationEntry[];
            }>(`/patients/${patientId}/mtr/${mtrId}/import-medications`, {
                medicationIds,
            });

            return response.data.data.medications;
        } catch (error) {
            console.error('Failed to import patient medications to MTR:', error);
            throw error;
        }
    },

    /**
     * Export MTR medications to patient records
     */
    async exportMTRMedicationsToPatient(
        patientId: string,
        mtrId: string,
        medications: MTRMedicationEntry[]
    ): Promise<MedicationRecord[]> {
        try {
            const response = await apiHelpers.post<{
                medications: MedicationRecord[];
            }>(`/patients/${patientId}/mtr/${mtrId}/export-medications`, {
                medications,
            });

            return response.data.data.medications;
        } catch (error) {
            console.error('Failed to export MTR medications to patient:', error);
            throw error;
        }
    },

    // ===============================
    // DTP SYNCHRONIZATION
    // ===============================

    /**
     * Sync DTPs between patient records and MTR
     */
    async syncDTPsWithMTR(
        patientId: string,
        mtrId: string
    ): Promise<{
        patientDTPs: PatientDTP[];
        mtrDTPs: MTRDTP[];
        syncStatus: 'synced' | 'needs_update';
    }> {
        try {
            const response = await apiHelpers.post<{
                syncResult: {
                    patientDTPs: PatientDTP[];
                    mtrDTPs: MTRDTP[];
                    syncStatus: 'synced' | 'needs_update';
                };
            }>(`/patients/${patientId}/mtr/${mtrId}/sync-dtps`);

            return response.data.data.syncResult;
        } catch (error) {
            console.error('Failed to sync DTPs with MTR:', error);
            throw error;
        }
    },

    /**
     * Create patient DTP from MTR DTP
     */
    async createPatientDTPFromMTR(
        patientId: string,
        mtrDTPId: string
    ): Promise<PatientDTP> {
        try {
            const response = await apiHelpers.post<{
                dtp: PatientDTP;
            }>(`/patients/${patientId}/dtps/from-mtr/${mtrDTPId}`);

            return response.data.data.dtp;
        } catch (error) {
            console.error('Failed to create patient DTP from MTR:', error);
            throw error;
        }
    },

    // ===============================
    // MTR STATUS UPDATES
    // ===============================

    /**
     * Update patient MTR status indicators
     */
    async updatePatientMTRStatus(
        patientId: string,
        status: {
            hasActiveMTR: boolean;
            lastMTRDate?: string;
            nextScheduledMTR?: string;
            mtrStatus: 'none' | 'active' | 'overdue' | 'scheduled';
        }
    ): Promise<Patient> {
        try {
            const response = await apiHelpers.put<{
                patient: Patient;
            }>(`/patients/${patientId}/mtr-status`, status);

            return response.data.data.patient;
        } catch (error) {
            console.error('Failed to update patient MTR status:', error);
            throw error;
        }
    },

    // ===============================
    // CLINICAL NOTES INTEGRATION
    // ===============================

    /**
     * Add MTR summary to patient clinical notes
     */
    async addMTRSummaryToNotes(
        patientId: string,
        mtrId: string,
        summary: {
            problemsIdentified: number;
            interventionsMade: number;
            medicationsOptimized: number;
            followUpRequired: boolean;
            nextReviewDate?: string;
            pharmacistNotes?: string;
        }
    ): Promise<ApiResponse> {
        try {
            const response = await apiHelpers.post(
                `/patients/${patientId}/clinical-notes/mtr-summary`,
                {
                    mtrId,
                    summary,
                }
            );

            return response.data;
        } catch (error) {
            console.error('Failed to add MTR summary to notes:', error);
            throw error;
        }
    },

    // ===============================
    // PATIENT DASHBOARD INTEGRATION
    // ===============================

    /**
     * Get MTR widgets data for patient dashboard
     */
    async getPatientDashboardMTRData(patientId: string): Promise<{
        activeMTRs: MedicationTherapyReview[];
        recentMTRs: MedicationTherapyReview[];
        mtrSummary: PatientMTRSummary;
        pendingActions: {
            type: 'follow_up' | 'intervention' | 'review';
            description: string;
            dueDate?: string;
            priority: 'high' | 'medium' | 'low';
        }[];
    }> {
        try {
            const response = await apiHelpers.get<{
                dashboardData: {
                    activeMTRs: MedicationTherapyReview[];
                    recentMTRs: MedicationTherapyReview[];
                    mtrSummary: PatientMTRSummary;
                    pendingActions: {
                        type: 'follow_up' | 'intervention' | 'review';
                        description: string;
                        dueDate?: string;
                        priority: 'high' | 'medium' | 'low';
                    }[];
                };
            }>(`/patients/${patientId}/dashboard/mtr`);

            return response.data.data.dashboardData;
        } catch (error) {
            console.error('Failed to get patient dashboard MTR data:', error);
            throw error;
        }
    },

    // ===============================
    // BULK OPERATIONS
    // ===============================

    /**
     * Get MTR status for multiple patients
     */
    async getBulkPatientMTRStatus(
        patientIds: string[]
    ): Promise<Record<string, PatientMTRSummary>> {
        try {
            const response = await apiHelpers.post<{
                patientMTRStatus: Record<string, PatientMTRSummary>;
            }>('/patients/bulk/mtr-status', {
                patientIds,
            });

            return response.data.data.patientMTRStatus;
        } catch (error) {
            console.error('Failed to get bulk patient MTR status:', error);
            throw error;
        }
    },

    /**
     * Update MTR status for multiple patients
     */
    async updateBulkPatientMTRStatus(
        updates: Array<{
            patientId: string;
            hasActiveMTR: boolean;
            mtrStatus: 'none' | 'active' | 'overdue' | 'scheduled';
            lastMTRDate?: string;
        }>
    ): Promise<ApiResponse> {
        try {
            const response = await apiHelpers.put('/patients/bulk/mtr-status', {
                updates,
            });

            return response.data;
        } catch (error) {
            console.error('Failed to update bulk patient MTR status:', error);
            throw error;
        }
    },

    // ===============================
    // SEARCH AND FILTERING
    // ===============================

    /**
     * Search patients with MTR filters
     */
    async searchPatientsWithMTR(params: {
        hasActiveMTR?: boolean;
        mtrStatus?: 'none' | 'active' | 'overdue' | 'scheduled';
        lastMTRBefore?: string;
        lastMTRAfter?: string;
        needsReview?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
        results: (Patient & { mtrSummary: PatientMTRSummary })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    }> {
        try {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    searchParams.append(key, value.toString());
                }
            });

            const queryString = searchParams.toString();
            const url = `/patients/search/with-mtr${queryString ? `?${queryString}` : ''}`;

            const response = await apiHelpers.get<{
                results: (Patient & { mtrSummary: PatientMTRSummary })[];
                total: number;
                page: number;
                limit: number;
                totalPages: number;
                hasNext: boolean;
                hasPrev: boolean;
            }>(url);

            return response.data.data;
        } catch (error) {
            console.error('Failed to search patients with MTR:', error);
            throw error;
        }
    },
};