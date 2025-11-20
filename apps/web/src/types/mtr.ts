// MTR (Medication Therapy Review) Types
import { ApiResponse } from './patientManagement';

// Base MTR interfaces matching backend models
export interface MTRMedicationEntry {
    drugName: string;
    genericName?: string;
    strength: {
        value: number;
        unit: string;
    };
    dosageForm: string;
    instructions: {
        dose: string;
        frequency: string;
        route: string;
        duration?: string;
    };
    category: 'prescribed' | 'otc' | 'herbal' | 'supplement';
    prescriber?: {
        name: string;
        license?: string;
        contact?: string;
    };
    startDate: string;
    endDate?: string;
    indication: string;
    adherenceScore?: number;
    notes?: string;
}

export interface TherapyRecommendation {
    type: 'discontinue' | 'adjust_dose' | 'switch_therapy' | 'add_therapy' | 'monitor';
    medication?: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
    expectedOutcome: string;
}

export interface MonitoringParameter {
    parameter: string;
    frequency: string;
    targetValue?: string;
    notes?: string;
}

export interface TherapyGoal {
    description: string;
    targetDate?: string;
    achieved: boolean;
    achievedDate?: string;
}

export interface TherapyPlan {
    problems: string[]; // DrugTherapyProblem IDs
    recommendations: TherapyRecommendation[];
    monitoringPlan: MonitoringParameter[];
    counselingPoints: string[];
    goals: TherapyGoal[];
    timeline: string;
    pharmacistNotes: string;
}

export interface ClinicalOutcomes {
    problemsResolved: number;
    medicationsOptimized: number;
    adherenceImproved: boolean;
    adverseEventsReduced: boolean;
    costSavings?: number;
    qualityOfLifeImproved?: boolean;
    clinicalParametersImproved?: boolean;
}

export interface WorkflowStep {
    completed: boolean;
    completedAt?: string;
    data?: unknown;
}

export interface MedicationTherapyReview {
    _id: string;
    workplaceId: string;
    patientId: string;
    pharmacistId: string;
    reviewNumber: string;
    status: 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
    priority: 'routine' | 'urgent' | 'high_risk';
    reviewType: 'initial' | 'follow_up' | 'annual' | 'targeted';

    // Workflow steps
    steps: {
        patientSelection: WorkflowStep;
        medicationHistory: WorkflowStep;
        therapyAssessment: WorkflowStep;
        planDevelopment: WorkflowStep;
        interventions: WorkflowStep;
        followUp: WorkflowStep;
    };

    // Clinical data
    medications: MTRMedicationEntry[];
    problems: string[]; // DrugTherapyProblem IDs
    plan?: TherapyPlan;
    interventions: string[]; // MTRIntervention IDs
    followUps: string[]; // MTRFollowUp IDs

    // Outcomes
    clinicalOutcomes: ClinicalOutcomes;

    // Scheduling
    startedAt: string;
    completedAt?: string;
    nextReviewDate?: string;
    estimatedDuration?: number;

    // Additional metadata
    referralSource?: string;
    reviewReason?: string;
    patientConsent: boolean;
    confidentialityAgreed: boolean;

    // Audit fields
    createdBy: string;
    updatedBy?: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;

    // Virtual fields
    completionPercentage?: number;
    durationDays?: number;
    isOverdue?: boolean;
}

export interface DrugTherapyProblem {
    _id: string;
    workplaceId: string;
    patientId: string;
    visitId?: string;
    reviewId?: string;

    // Problem classification
    category: 'indication' | 'effectiveness' | 'safety' | 'adherence';
    subcategory: string;
    type: 'unnecessary' | 'wrongDrug' | 'doseTooLow' | 'doseTooHigh' | 'adverseReaction' |
    'inappropriateAdherence' | 'needsAdditional' | 'interaction' | 'duplication' |
    'contraindication' | 'monitoring';
    severity: 'critical' | 'major' | 'moderate' | 'minor';

    // Clinical details
    description: string;
    clinicalSignificance: string;
    affectedMedications: string[];
    relatedConditions: string[];

    // Assessment
    evidenceLevel: 'definite' | 'probable' | 'possible' | 'unlikely';
    riskFactors: string[];

    // Resolution tracking
    status: 'identified' | 'addressed' | 'monitoring' | 'resolved' | 'not_applicable';
    resolution?: {
        action: string;
        outcome: string;
        resolvedAt?: string;
        resolvedBy?: string;
    };

    // Audit fields
    identifiedBy: string;
    identifiedAt: string;
    createdBy: string;
    updatedBy?: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface MTRIntervention {
    _id: string;
    workplaceId: string;
    reviewId: string;
    patientId: string;

    // Intervention details
    type: 'recommendation' | 'counseling' | 'monitoring' | 'communication' | 'education';
    category: 'medication_change' | 'adherence_support' | 'monitoring_plan' | 'patient_education';
    description: string;
    rationale: string;

    // Target and method
    targetAudience: 'patient' | 'prescriber' | 'caregiver' | 'healthcare_team';
    communicationMethod: 'verbal' | 'written' | 'phone' | 'email' | 'fax' | 'in_person';

    // Outcome tracking
    outcome: 'accepted' | 'rejected' | 'modified' | 'pending' | 'not_applicable';
    outcomeDetails: string;
    acceptanceRate?: number;

    // Follow-up requirements
    followUpRequired: boolean;
    followUpDate?: string;
    followUpCompleted: boolean;

    // Documentation
    documentation: string;
    attachments: string[];

    // Priority and urgency
    priority: 'high' | 'medium' | 'low';
    urgency: 'immediate' | 'within_24h' | 'within_week' | 'routine';

    // Audit fields
    pharmacistId: string;
    performedAt: string;
    createdBy: string;
    updatedBy?: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface MTRFollowUp {
    _id: string;
    workplaceId: string;
    reviewId: string;
    patientId: string;

    // Follow-up details
    type: 'phone_call' | 'appointment' | 'lab_review' | 'adherence_check' | 'outcome_assessment';
    priority: 'high' | 'medium' | 'low';
    description: string;
    objectives: string[];

    // Scheduling
    scheduledDate: string;
    estimatedDuration: number;
    assignedTo: string;

    // Status tracking
    status: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'rescheduled' | 'cancelled';
    completedAt?: string;
    rescheduledFrom?: string;
    rescheduledReason?: string;

    // Outcomes
    outcome?: {
        status: 'successful' | 'partially_successful' | 'unsuccessful';
        notes: string;
        nextActions: string[];
        nextFollowUpDate?: string;
        adherenceImproved?: boolean;
        problemsResolved?: string[];
        newProblemsIdentified?: string[];
    };

    // Related interventions
    relatedInterventions: string[];

    // Audit fields
    createdBy: string;
    updatedBy?: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

// API Request/Response types
export interface CreateMTRData {
    patientId: string;
    reviewType?: 'initial' | 'follow_up' | 'annual' | 'targeted';
    priority?: 'routine' | 'urgent' | 'high_risk';
    referralSource?: string;
    reviewReason?: string;
    estimatedDuration?: number;
    patientConsent?: boolean;
    confidentialityAgreed?: boolean;
}

export interface UpdateMTRData {
    status?: 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
    priority?: 'routine' | 'urgent' | 'high_risk';
    medications?: MTRMedicationEntry[];
    plan?: TherapyPlan;
    patientConsent?: boolean;
    confidentialityAgreed?: boolean;
    nextReviewDate?: string;
    referralSource?: string;
    reviewReason?: string;
    estimatedDuration?: number;
}

export interface CreateDTPData {
    patientId: string;
    reviewId?: string;
    visitId?: string;
    category: 'indication' | 'effectiveness' | 'safety' | 'adherence';
    subcategory: string;
    type: 'unnecessary' | 'wrongDrug' | 'doseTooLow' | 'doseTooHigh' | 'adverseReaction' |
    'inappropriateAdherence' | 'needsAdditional' | 'interaction' | 'duplication' |
    'contraindication' | 'monitoring';
    severity: 'critical' | 'major' | 'moderate' | 'minor';
    description: string;
    clinicalSignificance: string;
    affectedMedications: string[];
    relatedConditions?: string[];
    evidenceLevel: 'definite' | 'probable' | 'possible' | 'unlikely';
    riskFactors?: string[];
}

export interface UpdateDTPData {
    category?: 'indication' | 'effectiveness' | 'safety' | 'adherence';
    subcategory?: string;
    type?: 'unnecessary' | 'wrongDrug' | 'doseTooLow' | 'doseTooHigh' | 'adverseReaction' |
    'inappropriateAdherence' | 'needsAdditional' | 'interaction' | 'duplication' |
    'contraindication' | 'monitoring';
    severity?: 'critical' | 'major' | 'moderate' | 'minor';
    description?: string;
    clinicalSignificance?: string;
    affectedMedications?: string[];
    relatedConditions?: string[];
    evidenceLevel?: 'definite' | 'probable' | 'possible' | 'unlikely';
    riskFactors?: string[];
    status?: 'identified' | 'addressed' | 'monitoring' | 'resolved' | 'not_applicable';
    resolution?: {
        action: string;
        outcome: string;
    };
}

export interface CreateInterventionData {
    reviewId: string;
    patientId: string;
    type: 'recommendation' | 'counseling' | 'monitoring' | 'communication' | 'education';
    category: 'medication_change' | 'adherence_support' | 'monitoring_plan' | 'patient_education';
    description: string;
    rationale: string;
    targetAudience: 'patient' | 'prescriber' | 'caregiver' | 'healthcare_team';
    communicationMethod: 'verbal' | 'written' | 'phone' | 'email' | 'fax' | 'in_person';
    documentation: string;
    priority?: 'high' | 'medium' | 'low';
    urgency?: 'immediate' | 'within_24h' | 'within_week' | 'routine';
    followUpRequired?: boolean;
    followUpDate?: string;
}

export interface UpdateInterventionData {
    type?: 'recommendation' | 'counseling' | 'monitoring' | 'communication' | 'education';
    category?: 'medication_change' | 'adherence_support' | 'monitoring_plan' | 'patient_education';
    description?: string;
    rationale?: string;
    targetAudience?: 'patient' | 'prescriber' | 'caregiver' | 'healthcare_team';
    communicationMethod?: 'verbal' | 'written' | 'phone' | 'email' | 'fax' | 'in_person';
    outcome?: 'accepted' | 'rejected' | 'modified' | 'pending' | 'not_applicable';
    outcomeDetails?: string;
    documentation?: string;
    priority?: 'high' | 'medium' | 'low';
    urgency?: 'immediate' | 'within_24h' | 'within_week' | 'routine';
    followUpRequired?: boolean;
    followUpDate?: string;
    followUpCompleted?: boolean;
}

export interface CreateFollowUpData {
    reviewId: string;
    patientId: string;
    type: 'phone_call' | 'appointment' | 'lab_review' | 'adherence_check' | 'outcome_assessment';
    description: string;
    objectives: string[];
    scheduledDate: string;
    estimatedDuration: number;
    assignedTo: string;
    priority?: 'high' | 'medium' | 'low';
    relatedInterventions?: string[];
}

export interface UpdateFollowUpData {
    type?: 'phone_call' | 'appointment' | 'lab_review' | 'adherence_check' | 'outcome_assessment';
    description?: string;
    objectives?: string[];
    scheduledDate?: string;
    estimatedDuration?: number;
    assignedTo?: string;
    priority?: 'high' | 'medium' | 'low';
    status?: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'rescheduled' | 'cancelled';
    outcome?: {
        status: 'successful' | 'partially_successful' | 'unsuccessful';
        notes: string;
        nextActions: string[];
        nextFollowUpDate?: string;
        adherenceImproved?: boolean;
        problemsResolved?: string[];
        newProblemsIdentified?: string[];
    };
    relatedInterventions?: string[];
}

// Search and filter types
export interface MTRSearchParams {
    patientId?: string;
    pharmacistId?: string;
    status?: string;
    priority?: string;
    reviewType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface DTPSearchParams {
    patientId?: string;
    reviewId?: string;
    category?: string;
    type?: string;
    severity?: string;
    status?: string;
    evidenceLevel?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface InterventionSearchParams {
    reviewId?: string;
    patientId?: string;
    pharmacistId?: string;
    type?: string;
    category?: string;
    outcome?: string;
    priority?: string;
    urgency?: string;
    followUpRequired?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface FollowUpSearchParams {
    reviewId?: string;
    patientId?: string;
    assignedTo?: string;
    type?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// API Response types
export interface MTRListResponse extends ApiResponse {
    data: {
        results: MedicationTherapyReview[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface MTRResponse extends ApiResponse {
    data: {
        review: MedicationTherapyReview;
    };
}

export interface DTPListResponse extends ApiResponse {
    data: {
        results: DrugTherapyProblem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface DTPResponse extends ApiResponse {
    data: {
        problem: DrugTherapyProblem;
    };
}

export interface InterventionListResponse extends ApiResponse {
    data: {
        results: MTRIntervention[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface InterventionResponse extends ApiResponse {
    data: {
        intervention: MTRIntervention;
    };
}

export interface FollowUpListResponse extends ApiResponse {
    data: {
        results: MTRFollowUp[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface FollowUpResponse extends ApiResponse {
    data: {
        followUp: MTRFollowUp;
    };
}

// ===============================
// REPORTS AND ANALYTICS TYPES
// ===============================

export interface MTRSummaryReport {
    summary: {
        totalReviews: number;
        completedReviews: number;
        inProgressReviews: number;
        cancelledReviews: number;
        onHoldReviews: number;
        completionRate: number;
        avgCompletionTime: number;
        totalProblemsResolved: number;
        totalMedicationsOptimized: number;
        adherenceImprovedCount: number;
        adverseEventsReducedCount: number;
        totalCostSavings: number;
    };
    distributions: {
        reviewType: Array<{ _id: string; count: number }>;
        priority: Array<{ _id: string; count: number }>;
    };
    trends: {
        monthly: Array<{
            _id: { year: number; month: number };
            totalReviews: number;
            completedReviews: number;
            avgCompletionTime: number;
        }>;
    };
}

export interface InterventionEffectivenessReport {
    summary: {
        totalInterventions: number;
        acceptedInterventions: number;
        rejectedInterventions: number;
        modifiedInterventions: number;
        pendingInterventions: number;
        overallAcceptanceRate: number;
    };
    effectiveness: {
        byType: Array<{
            _id: string;
            totalInterventions: number;
            acceptedInterventions: number;
            acceptanceRate: number;
        }>;
        byCategory: Array<{
            _id: string;
            totalInterventions: number;
            acceptedInterventions: number;
            acceptanceRate: number;
        }>;
    };
    pharmacistPerformance: Array<{
        _id: string;
        pharmacistName: string;
        totalInterventions: number;
        acceptedInterventions: number;
        acceptanceRate: number;
    }>;
}

export interface PharmacistPerformanceReport {
    pharmacistPerformance: Array<{
        _id: string;
        pharmacistName: string;
        totalReviews: number;
        completedReviews: number;
        completionRate: number;
        avgCompletionTime: number;
        totalProblemsIdentified: number;
        totalProblemsResolved: number;
        problemResolutionRate: number;
        totalMedicationsOptimized: number;
        totalCostSavings: number;
        totalInterventions: number;
        acceptedInterventions: number;
        interventionAcceptanceRate: number;
        efficiencyScore: number;
        qualityScore: number;
    }>;
    summary: {
        totalPharmacists: number;
        avgQualityScore: number;
        topPerformer: unknown;
    };
}

export interface QualityAssuranceReport {
    completionTimeAnalysis: Array<{
        _id: string;
        avgCompletionTime: number;
        minCompletionTime: number;
        maxCompletionTime: number;
        count: number;
    }>;
    problemPatterns: Array<{
        _id: {
            category: string;
            severity: string;
        };
        count: number;
        resolvedCount: number;
        resolutionRate: number;
    }>;
    followUpCompliance: {
        totalFollowUps: number;
        completedFollowUps: number;
        missedFollowUps: number;
        rescheduledFollowUps: number;
        complianceRate: number;
    };
    documentationQuality: {
        totalReviews: number;
        reviewsWithCompletePlans: number;
        reviewsWithMedications: number;
        reviewsWithProblems: number;
        planCompletionRate: number;
        medicationDocumentationRate: number;
        problemIdentificationRate: number;
    };
    qualityMetrics: {
        avgPlanCompletionRate: number;
        avgFollowUpCompliance: number;
        avgProblemResolutionRate: number;
    };
}

export interface OutcomeMetricsReport {
    summary: {
        totalReviews: number;
        totalProblemsResolved: number;
        totalMedicationsOptimized: number;
        adherenceImprovedCount: number;
        adverseEventsReducedCount: number;
        qualityOfLifeImprovedCount: number;
        clinicalParametersImprovedCount: number;
        totalCostSavings: number;
        avgProblemsPerReview: number;
        avgMedicationsPerReview: number;
        adherenceImprovementRate: number;
        adverseEventReductionRate: number;
    };
    outcomesByType: Array<{
        _id: string;
        totalReviews: number;
        avgProblemsResolved: number;
        avgMedicationsOptimized: number;
        adherenceImprovedRate: number;
        avgCostSavings: number;
    }>;
    trends: {
        monthly: Array<{
            _id: { year: number; month: number };
            totalReviews: number;
            totalProblemsResolved: number;
            totalMedicationsOptimized: number;
            totalCostSavings: number;
        }>;
    };
}

export interface ReportFilters {
    startDate?: string;
    endDate?: string;
    pharmacistId?: string;
    patientId?: string;
    reviewType?: string;
    priority?: string;
    interventionType?: string;
}