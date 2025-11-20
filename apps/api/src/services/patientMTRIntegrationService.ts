import mongoose, { Types } from 'mongoose';
import MedicationTherapyReview from '../models/MedicationTherapyReview';

// Simple error class
class AppError extends Error {
    constructor(message: string, public statusCode: number) {
        super(message);
        this.name = 'AppError';
    }
}

// ===============================
// TYPES AND INTERFACES
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
    recentMTRs: any[];
}

export interface MTRPatientData {
    patient: any;
    medications: any[];
    dtps: any[];
    mtrHistory: any[];
    activeMTR?: any;
}

export interface MTRMedicationSync {
    patientMedications: any[];
    mtrMedications: any[];
    syncStatus: 'synced' | 'needs_update' | 'conflicts';
    conflicts?: {
        field: string;
        patientValue: any;
        mtrValue: any;
        medication: string;
    }[];
}

/**
 * Service for integrating MTR with existing patient management system
 */
export class PatientMTRIntegrationService {
    // ===============================
    // PATIENT MTR SUMMARY
    // ===============================

    /**
     * Get MTR summary for a patient
     */
    async getPatientMTRSummary(
        patientId: string,
        workplaceId: string
    ): Promise<PatientMTRSummary> {
        try {
            // Mock implementation for now
            return {
                patientId,
                totalMTRSessions: 0,
                activeMTRSessions: 0,
                completedMTRSessions: 0,
                hasActiveMTR: false,
                mtrStatus: 'none',
                recentMTRs: [],
            };
        } catch (error) {
            console.error('Error getting patient MTR summary:', error);
            throw new AppError('Failed to get patient MTR summary', 500);
        }
    }

    /**
     * Get comprehensive patient data for MTR
     */
    async getPatientDataForMTR(
        patientId: string,
        workplaceId: string
    ): Promise<MTRPatientData> {
        try {
            // Mock implementation for now
            return {
                patient: { _id: patientId },
                medications: [],
                dtps: [],
                mtrHistory: [],
            };
        } catch (error) {
            console.error('Error getting patient data for MTR:', error);
            throw error instanceof AppError ? error : new AppError('Failed to get patient data for MTR', 500);
        }
    }

    /**
     * Sync medications between patient records and MTR
     */
    async syncMedicationsWithMTR(
        patientId: string,
        mtrId: string,
        workplaceId: string
    ): Promise<MTRMedicationSync> {
        try {
            // Mock implementation for now
            return {
                patientMedications: [],
                mtrMedications: [],
                syncStatus: 'synced',
            };
        } catch (error) {
            console.error('Error syncing medications with MTR:', error);
            throw error instanceof AppError ? error : new AppError('Failed to sync medications with MTR', 500);
        }
    }

    /**
     * Get MTR widgets data for patient dashboard
     */
    async getPatientDashboardMTRData(
        patientId: string,
        workplaceId: string
    ): Promise<{
        activeMTRs: any[];
        recentMTRs: any[];
        mtrSummary: PatientMTRSummary;
        pendingActions: any[];
    }> {
        try {
            // Convert patientId to ObjectId for queries
            const patientObjectId = mongoose.Types.ObjectId.isValid(patientId) 
                ? new mongoose.Types.ObjectId(patientId) 
                : patientId;

            // Get MTR sessions for the patient
            const mtrSessions = await MedicationTherapyReview.find({
                patientId: patientObjectId,
                workplaceId: new mongoose.Types.ObjectId(workplaceId)
            })
            .populate('pharmacistId', 'firstName lastName')
            .sort('-createdAt')
            .lean();

            // Filter active and recent MTRs
            const activeMTRs = mtrSessions.filter(session => 
                session.status === 'in_progress' || session.status === 'on_hold'
            );

            const recentMTRs = mtrSessions.slice(0, 5); // Get 5 most recent

            // Calculate completion percentage for each session
            const processedActiveMTRs = activeMTRs.map(session => ({
                ...session,
                completionPercentage: this.calculateCompletionPercentage(session),
                isOverdue: this.isSessionOverdue(session)
            }));

            const processedRecentMTRs = recentMTRs.map(session => ({
                ...session,
                completionPercentage: this.calculateCompletionPercentage(session),
                isOverdue: this.isSessionOverdue(session)
            }));

            // Get MTR summary
            const mtrSummary = await this.getPatientMTRSummary(patientId, workplaceId);

            // Get pending actions (simplified for now)
            const pendingActions = activeMTRs.map(session => ({
                type: 'review' as const,
                description: `Continue MTR session ${session.reviewNumber}`,
                priority: session.priority === 'high_risk' ? 'high' as const : 
                         session.priority === 'urgent' ? 'medium' as const : 'low' as const,
                dueDate: session.nextReviewDate
            }));

            return {
                activeMTRs: processedActiveMTRs,
                recentMTRs: processedRecentMTRs,
                mtrSummary,
                pendingActions,
            };
        } catch (error) {
            console.error('Error getting patient dashboard MTR data:', error);
            throw new AppError('Failed to get patient dashboard MTR data', 500);
        }
    }

    /**
     * Calculate completion percentage for an MTR session
     */
    private calculateCompletionPercentage(session: any): number {
        if (!session.steps) return 0;
        
        const stepNames = ['patientSelection', 'medicationHistory', 'therapyAssessment', 'planDevelopment', 'interventions', 'followUp'];
        const completedSteps = stepNames.filter(stepName => 
            session.steps[stepName] && session.steps[stepName].completed
        ).length;
        
        return Math.round((completedSteps / stepNames.length) * 100);
    }

    /**
     * Check if an MTR session is overdue
     */
    private isSessionOverdue(session: any): boolean {
        if (session.status === 'completed') return false;
        
        // Consider a session overdue if it's been in progress for more than 7 days
        const startDate = new Date(session.startedAt);
        const now = new Date();
        const daysDiff = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        
        return daysDiff > 7;
    }

    /**
     * Search patients with MTR filters
     */
    async searchPatientsWithMTR(
        params: any,
        workplaceId: string
    ): Promise<{
        results: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    }> {
        try {
            const page = parseInt(params.page) || 1;
            const limit = parseInt(params.limit) || 10;

            // Mock implementation for now
            return {
                results: [],
                total: 0,
                page,
                limit,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
            };
        } catch (error) {
            console.error('Error searching patients with MTR:', error);
            throw new AppError('Failed to search patients with MTR', 500);
        }
    }
}

export const patientMTRIntegrationService = new PatientMTRIntegrationService();