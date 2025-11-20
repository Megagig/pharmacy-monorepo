import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

/**
 * Therapy Recommendation Interface
 * Represents AI-generated or pharmacist-created therapy recommendations
 */
export interface ITherapyRecommendation {
    medicationName: string;
    rxcui?: string;
    action: 'start' | 'stop' | 'adjust_dose' | 'monitor' | 'continue';
    currentDose?: string;
    recommendedDose?: string;
    rationale: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    evidenceLevel?: 'strong' | 'moderate' | 'weak';
    references?: string[];
}

/**
 * Safety Check Result Interface
 * Captures drug interaction, allergy, and contraindication checks
 */
export interface ISafetyCheck {
    checkType: 'drug_interaction' | 'allergy' | 'contraindication' | 'renal_dosing' | 'hepatic_dosing' | 'duplicate_therapy';
    severity: 'critical' | 'major' | 'moderate' | 'minor';
    description: string;
    affectedMedications: string[];
    recommendation: string;
    source: string;
    timestamp: Date;
}

/**
 * AI Interpretation Result Interface
 * Stores structured AI analysis of lab results
 */
export interface IAIInterpretation {
    interpretation: string;
    clinicalSignificance: 'critical' | 'significant' | 'moderate' | 'minimal' | 'normal';
    confidence: number; // 0-100
    differentialDiagnosis?: string[];
    therapeuticImplications: string[];
    monitoringRecommendations: string[];
    redFlags?: Array<{
        flag: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        action: string;
    }>;
    processingTime: number;
    modelUsed: string;
    promptVersion?: string;
    interpretedAt?: Date;

    // Patient-Friendly Interpretation
    patientExplanation?: string; // AI-generated patient-friendly explanation
    patientExplanationApproved?: boolean; // Pharmacist approval status
    patientExplanationModified?: boolean; // Whether pharmacist modified AI explanation
    patientExplanationVisibleToPatient?: boolean; // Whether patient can see this explanation
}

/**
 * Pharmacist Review Interface
 * Captures pharmacist's review and decision on AI recommendations
 */
export interface IPharmacistReview {
    reviewedBy: mongoose.Types.ObjectId;
    reviewedAt: Date;
    decision: 'approved' | 'modified' | 'rejected' | 'escalated';
    modifications?: string;
    rejectionReason?: string;
    escalationReason?: string;
    escalatedTo?: mongoose.Types.ObjectId; // Physician or senior pharmacist
    clinicalNotes: string;
    signedOff: boolean;
}

/**
 * Medication Adjustment Interface
 * Tracks actual medication changes made based on lab results
 */
export interface IMedicationAdjustment {
    medicationId?: mongoose.Types.ObjectId;
    medicationName: string;
    adjustmentType: 'dose_increase' | 'dose_decrease' | 'frequency_change' | 'discontinuation' | 'new_medication' | 'formulation_change';
    previousRegimen?: string;
    newRegimen: string;
    effectiveDate: Date;
    reason: string;
    approvedBy: mongoose.Types.ObjectId;
    patientNotified: boolean;
    patientConsentObtained: boolean;
}

/**
 * Lab Integration Document Interface
 * Main model for Lab Result Integration with Therapy Management
 */
export interface ILabIntegration extends Document {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    pharmacistId: mongoose.Types.ObjectId;
    locationId?: string;

    // Lab Result References
    labResultIds: mongoose.Types.ObjectId[]; // References to LabResult documents
    labOrderId?: mongoose.Types.ObjectId; // Reference to LabOrder if applicable

    // Source and Provenance
    source: 'manual_entry' | 'pdf_upload' | 'image_upload' | 'fhir_import' | 'lis_integration';
    uploadedFiles?: Array<{
        fileType: 'pdf' | 'image' | 'hl7' | 'fhir';
        fileName: string;
        fileUrl: string;
        uploadedAt: Date;
    }>;
    labName?: string;
    reportId?: string;
    receivedAt: Date;

    // Clinical Context
    indication?: string;
    clinicalQuestion?: string;
    targetRange?: {
        parameter: string;
        target: string;
        goal: string;
    };
    urgency: 'stat' | 'urgent' | 'routine';

    // AI Analysis
    aiInterpretation?: IAIInterpretation;
    aiProcessingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
    aiProcessingError?: string;

    // Patient-Friendly Interpretation
    patientInterpretation?: {
        explanation: string; // Patient-friendly explanation of lab results
        keyFindings: string[]; // Simple bullet points of key findings
        recommendations: string[]; // Patient-actionable recommendations
        generatedBy: 'ai' | 'pharmacist' | 'hybrid';
        approvedBy?: mongoose.Types.ObjectId; // Pharmacist who approved
        approvedAt?: Date;
        visibleToPatient: boolean;
        lastModified: Date;
        modifiedBy: mongoose.Types.ObjectId;
    };

    // Safety Checks
    safetyChecks: ISafetyCheck[];
    safetyCheckStatus: 'pending' | 'completed' | 'failed';
    criticalSafetyIssues: boolean;

    // Therapy Recommendations
    therapyRecommendations: ITherapyRecommendation[];
    recommendationSource: 'ai_generated' | 'pharmacist_created' | 'hybrid';

    // Pharmacist Review
    pharmacistReview?: IPharmacistReview;
    reviewStatus: 'pending_review' | 'under_review' | 'reviewed' | 'approved' | 'rejected' | 'escalated';

    // Medication Adjustments
    medicationAdjustments: IMedicationAdjustment[];
    adjustmentsImplemented: boolean;

    // Monitoring and Follow-up
    followUpRequired: boolean;
    followUpDate?: Date;
    followUpInstructions?: string;
    nextLabDate?: Date;
    monitoringPlan?: string;

    // Trend Analysis
    trendAnalysis?: {
        parameter: string;
        direction: 'improving' | 'stable' | 'worsening';
        percentChange?: number;
        comparisonPeriod?: string;
        clinicalImplication: string;
    };

    // Patient Communication
    patientNotified: boolean;
    patientNotificationDate?: Date;
    patientConsentObtained: boolean;
    patientConsentDate?: Date;
    patientEducationProvided: boolean;

    // Escalation
    requiresPhysicianEscalation: boolean;
    physicianNotified: boolean;
    physicianNotificationDate?: Date;
    physicianResponse?: string;
    physicianResponseDate?: Date;

    // Status and Workflow
    status: 'draft' | 'pending_interpretation' | 'pending_review' | 'pending_approval' | 'approved' | 'implemented' | 'completed' | 'cancelled';
    completedAt?: Date;
    cancelledAt?: Date;
    cancellationReason?: string;

    // Audit Fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    // Virtual properties
    daysSinceReceived: number;
    isOverdue: boolean;
    hasCriticalFindings: boolean;

    // Instance methods
    requestAIInterpretation(): Promise<void>;
    performSafetyChecks(): Promise<void>;
    submitForReview(pharmacistId: mongoose.Types.ObjectId): Promise<void>;
    approveRecommendations(reviewData: IPharmacistReview): Promise<void>;
    rejectRecommendations(reviewData: IPharmacistReview): Promise<void>;
    implementAdjustments(adjustments: IMedicationAdjustment[]): Promise<void>;
    escalateToPhysician(reason: string, physicianId?: mongoose.Types.ObjectId): Promise<void>;
    markAsCompleted(): Promise<void>;
}

// Sub-schemas
const therapyRecommendationSchema = new Schema({
    medicationName: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Medication name cannot exceed 200 characters']
    },
    rxcui: {
        type: String,
        trim: true
    },
    action: {
        type: String,
        enum: ['start', 'stop', 'adjust_dose', 'monitor', 'continue'],
        required: true
    },
    currentDose: {
        type: String,
        trim: true
    },
    recommendedDose: {
        type: String,
        trim: true
    },
    rationale: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, 'Rationale cannot exceed 1000 characters']
    },
    priority: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        required: true,
        default: 'medium'
    },
    evidenceLevel: {
        type: String,
        enum: ['strong', 'moderate', 'weak']
    },
    references: [String]
}, { _id: false });

const safetyCheckSchema = new Schema({
    checkType: {
        type: String,
        enum: ['drug_interaction', 'allergy', 'contraindication', 'renal_dosing', 'hepatic_dosing', 'duplicate_therapy'],
        required: true
    },
    severity: {
        type: String,
        enum: ['critical', 'major', 'moderate', 'minor'],
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    affectedMedications: [String],
    recommendation: {
        type: String,
        required: true,
        trim: true
    },
    source: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const aiInterpretationSchema = new Schema({
    interpretation: {
        type: String,
        required: true,
        trim: true
    },
    clinicalSignificance: {
        type: String,
        enum: ['critical', 'significant', 'moderate', 'minimal', 'normal'],
        required: true
    },
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    differentialDiagnosis: [String],
    therapeuticImplications: [String],
    monitoringRecommendations: [String],
    redFlags: [{
        flag: String,
        severity: {
            type: String,
            enum: ['critical', 'high', 'medium', 'low']
        },
        action: String
    }],
    processingTime: Number,
    modelUsed: String,
    promptVersion: String,
    interpretedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const pharmacistReviewSchema = new Schema({
    reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewedAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    decision: {
        type: String,
        enum: ['approved', 'modified', 'rejected', 'escalated'],
        required: true
    },
    modifications: {
        type: String,
        trim: true
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    escalationReason: {
        type: String,
        trim: true
    },
    escalatedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    clinicalNotes: {
        type: String,
        required: true,
        trim: true,
        maxlength: [2000, 'Clinical notes cannot exceed 2000 characters']
    },
    signedOff: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const medicationAdjustmentSchema = new Schema({
    medicationId: {
        type: Schema.Types.ObjectId,
        ref: 'Medication'
    },
    medicationName: {
        type: String,
        required: true,
        trim: true
    },
    adjustmentType: {
        type: String,
        enum: ['dose_increase', 'dose_decrease', 'frequency_change', 'discontinuation', 'new_medication', 'formulation_change'],
        required: true
    },
    previousRegimen: {
        type: String,
        trim: true
    },
    newRegimen: {
        type: String,
        required: true,
        trim: true
    },
    effectiveDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    patientNotified: {
        type: Boolean,
        default: false
    },
    patientConsentObtained: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const uploadedFileSchema = new Schema({
    fileType: {
        type: String,
        enum: ['pdf', 'image', 'hl7', 'fhir'],
        required: true
    },
    fileName: {
        type: String,
        required: true,
        trim: true
    },
    fileUrl: {
        type: String,
        required: true,
        trim: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const targetRangeSchema = new Schema({
    parameter: {
        type: String,
        required: true,
        trim: true
    },
    target: {
        type: String,
        required: true,
        trim: true
    },
    goal: {
        type: String,
        required: true,
        trim: true
    }
}, { _id: false });

const trendAnalysisSchema = new Schema({
    parameter: {
        type: String,
        required: true,
        trim: true
    },
    direction: {
        type: String,
        enum: ['improving', 'stable', 'worsening'],
        required: true
    },
    percentChange: Number,
    comparisonPeriod: String,
    clinicalImplication: {
        type: String,
        required: true,
        trim: true
    }
}, { _id: false });

// Main Lab Integration Schema
const labIntegrationSchema = new Schema({
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true
    },
    pharmacistId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    locationId: {
        type: String,
        index: true,
        sparse: true
    },

    // Lab Result References
    labResultIds: [{
        type: Schema.Types.ObjectId,
        ref: 'LabResult'
    }],
    labOrderId: {
        type: Schema.Types.ObjectId,
        ref: 'LabOrder',
        index: true,
        sparse: true
    },

    // Source and Provenance
    source: {
        type: String,
        enum: ['manual_entry', 'pdf_upload', 'image_upload', 'fhir_import', 'lis_integration'],
        required: true,
        default: 'manual_entry'
    },
    uploadedFiles: [uploadedFileSchema],
    labName: {
        type: String,
        trim: true,
        maxlength: [200, 'Lab name cannot exceed 200 characters']
    },
    reportId: {
        type: String,
        trim: true,
        index: true,
        sparse: true
    },
    receivedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },

    // Clinical Context
    indication: {
        type: String,
        trim: true,
        maxlength: [500, 'Indication cannot exceed 500 characters']
    },
    clinicalQuestion: {
        type: String,
        trim: true,
        maxlength: [500, 'Clinical question cannot exceed 500 characters']
    },
    targetRange: targetRangeSchema,
    urgency: {
        type: String,
        enum: ['stat', 'urgent', 'routine'],
        default: 'routine',
        index: true
    },

    // AI Analysis
    aiInterpretation: aiInterpretationSchema,
    aiProcessingStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'skipped'],
        default: 'pending',
        index: true
    },
    aiProcessingError: {
        type: String,
        trim: true
    },

    // Patient-Friendly Interpretation
    patientInterpretation: {
        explanation: {
            type: String,
            trim: true,
            maxlength: [2000, 'Patient explanation cannot exceed 2000 characters']
        },
        keyFindings: [{
            type: String,
            trim: true,
            maxlength: [200, 'Key finding cannot exceed 200 characters']
        }],
        recommendations: [{
            type: String,
            trim: true,
            maxlength: [300, 'Recommendation cannot exceed 300 characters']
        }],
        generatedBy: {
            type: String,
            enum: ['ai', 'pharmacist', 'hybrid'],
            default: 'ai'
        },
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: {
            type: Date
        },
        visibleToPatient: {
            type: Boolean,
            default: false,
            index: true
        },
        lastModified: {
            type: Date,
            default: Date.now
        },
        modifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false
        }
    },

    // Safety Checks
    safetyChecks: [safetyCheckSchema],
    safetyCheckStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    criticalSafetyIssues: {
        type: Boolean,
        default: false,
        index: true
    },

    // Therapy Recommendations
    therapyRecommendations: [therapyRecommendationSchema],
    recommendationSource: {
        type: String,
        enum: ['ai_generated', 'pharmacist_created', 'hybrid'],
        default: 'ai_generated'
    },

    // Pharmacist Review
    pharmacistReview: pharmacistReviewSchema,
    reviewStatus: {
        type: String,
        enum: ['pending_review', 'under_review', 'reviewed', 'approved', 'rejected', 'escalated'],
        default: 'pending_review',
        index: true
    },

    // Medication Adjustments
    medicationAdjustments: [medicationAdjustmentSchema],
    adjustmentsImplemented: {
        type: Boolean,
        default: false
    },

    // Monitoring and Follow-up
    followUpRequired: {
        type: Boolean,
        default: false,
        index: true
    },
    followUpDate: {
        type: Date,
        index: true
    },
    followUpInstructions: {
        type: String,
        trim: true,
        maxlength: [1000, 'Follow-up instructions cannot exceed 1000 characters']
    },
    nextLabDate: {
        type: Date,
        index: true
    },
    monitoringPlan: {
        type: String,
        trim: true,
        maxlength: [1000, 'Monitoring plan cannot exceed 1000 characters']
    },

    // Trend Analysis
    trendAnalysis: trendAnalysisSchema,

    // Patient Communication
    patientNotified: {
        type: Boolean,
        default: false
    },
    patientNotificationDate: Date,
    patientConsentObtained: {
        type: Boolean,
        default: false
    },
    patientConsentDate: Date,
    patientEducationProvided: {
        type: Boolean,
        default: false
    },

    // Escalation
    requiresPhysicianEscalation: {
        type: Boolean,
        default: false,
        index: true
    },
    physicianNotified: {
        type: Boolean,
        default: false
    },
    physicianNotificationDate: Date,
    physicianResponse: {
        type: String,
        trim: true
    },
    physicianResponseDate: Date,

    // Status and Workflow
    status: {
        type: String,
        enum: ['draft', 'pending_interpretation', 'pending_review', 'pending_approval', 'approved', 'implemented', 'completed', 'cancelled'],
        default: 'draft',
        index: true
    },
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(labIntegrationSchema);

// Apply tenancy guard plugin
labIntegrationSchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Compound indexes for efficient querying
labIntegrationSchema.index({ workplaceId: 1, patientId: 1, createdAt: -1 });
labIntegrationSchema.index({ workplaceId: 1, status: 1, createdAt: -1 });
labIntegrationSchema.index({ workplaceId: 1, reviewStatus: 1 });
labIntegrationSchema.index({ workplaceId: 1, urgency: 1, status: 1 });
labIntegrationSchema.index({ workplaceId: 1, followUpRequired: 1, followUpDate: 1 });
labIntegrationSchema.index({ workplaceId: 1, requiresPhysicianEscalation: 1 });
labIntegrationSchema.index({ workplaceId: 1, criticalSafetyIssues: 1 });
labIntegrationSchema.index({ pharmacistId: 1, status: 1 });
labIntegrationSchema.index({ reportId: 1 }, { sparse: true });

// Text index for searching
labIntegrationSchema.index({
    indication: 'text',
    clinicalQuestion: 'text',
    'aiInterpretation.interpretation': 'text',
    'pharmacistReview.clinicalNotes': 'text'
});

// Virtual properties
labIntegrationSchema.virtual('daysSinceReceived').get(function (this: ILabIntegration) {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.receivedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

labIntegrationSchema.virtual('isOverdue').get(function (this: ILabIntegration) {
    if (!this.followUpDate) return false;
    return new Date() > this.followUpDate && this.status !== 'completed';
});

labIntegrationSchema.virtual('hasCriticalFindings').get(function (this: ILabIntegration) {
    return this.criticalSafetyIssues ||
        this.aiInterpretation?.clinicalSignificance === 'critical' ||
        this.therapyRecommendations.some(rec => rec.priority === 'critical');
});

// Instance methods
labIntegrationSchema.methods.requestAIInterpretation = async function (this: ILabIntegration): Promise<void> {
    this.aiProcessingStatus = 'pending';
    this.status = 'pending_interpretation';
    await this.save();
};

labIntegrationSchema.methods.performSafetyChecks = async function (this: ILabIntegration): Promise<void> {
    this.safetyCheckStatus = 'pending';
    await this.save();
};

labIntegrationSchema.methods.submitForReview = async function (
    this: ILabIntegration,
    pharmacistId: mongoose.Types.ObjectId
): Promise<void> {
    this.pharmacistId = pharmacistId;
    this.reviewStatus = 'pending_review';
    this.status = 'pending_review';
    await this.save();
};

labIntegrationSchema.methods.approveRecommendations = async function (
    this: ILabIntegration,
    reviewData: IPharmacistReview
): Promise<void> {
    this.pharmacistReview = reviewData;
    this.reviewStatus = 'approved';
    this.status = 'approved';
    await this.save();
};

labIntegrationSchema.methods.rejectRecommendations = async function (
    this: ILabIntegration,
    reviewData: IPharmacistReview
): Promise<void> {
    this.pharmacistReview = reviewData;
    this.reviewStatus = 'rejected';
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancellationReason = reviewData.rejectionReason || 'Rejected by pharmacist';
    await this.save();
};

labIntegrationSchema.methods.implementAdjustments = async function (
    this: ILabIntegration,
    adjustments: IMedicationAdjustment[]
): Promise<void> {
    this.medicationAdjustments = adjustments;
    this.adjustmentsImplemented = true;
    this.status = 'implemented';
    await this.save();
};

labIntegrationSchema.methods.escalateToPhysician = async function (
    this: ILabIntegration,
    reason: string,
    physicianId?: mongoose.Types.ObjectId
): Promise<void> {
    this.requiresPhysicianEscalation = true;
    this.reviewStatus = 'escalated';
    if (this.pharmacistReview) {
        this.pharmacistReview.escalationReason = reason;
        if (physicianId) {
            this.pharmacistReview.escalatedTo = physicianId;
        }
    }
    await this.save();
};

labIntegrationSchema.methods.markAsCompleted = async function (this: ILabIntegration): Promise<void> {
    this.status = 'completed';
    this.completedAt = new Date();
    await this.save();
};

// Static methods
labIntegrationSchema.statics.findByPatient = function (
    workplaceId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId
) {
    return this.find({
        workplaceId,
        patientId,
        isDeleted: false
    }).sort({ receivedAt: -1 });
};

labIntegrationSchema.statics.findPendingReviews = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        reviewStatus: 'pending_review',
        isDeleted: false
    }).sort({ urgency: 1, receivedAt: 1 });
};

labIntegrationSchema.statics.findCriticalCases = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        $or: [
            { criticalSafetyIssues: true },
            { 'aiInterpretation.clinicalSignificance': 'critical' },
            { urgency: 'stat' }
        ],
        status: { $nin: ['completed', 'cancelled'] },
        isDeleted: false
    }).sort({ receivedAt: 1 });
};

labIntegrationSchema.statics.findRequiringEscalation = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        requiresPhysicianEscalation: true,
        physicianNotified: false,
        isDeleted: false
    }).sort({ receivedAt: 1 });
};

labIntegrationSchema.statics.findApprovedCases = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        status: { $in: ['approved', 'implemented', 'completed'] },
        isDeleted: false
    })
        .populate({
            path: 'patientId',
            select: 'firstName lastName otherNames mrn age gender phone email'
        })
        .populate({
            path: 'pharmacistReview.reviewedBy',
            select: 'firstName lastName email'
        })
        .sort({ updatedAt: -1 });
};

// Pre-save middleware
labIntegrationSchema.pre('save', function (this: ILabIntegration, next) {
    // Auto-set critical safety issues flag
    if (this.safetyChecks && this.safetyChecks.length > 0) {
        this.criticalSafetyIssues = this.safetyChecks.some(
            check => check.severity === 'critical' || check.severity === 'major'
        );
    }

    // Auto-set physician escalation for critical findings
    if (this.aiInterpretation?.clinicalSignificance === 'critical' && !this.requiresPhysicianEscalation) {
        this.requiresPhysicianEscalation = true;
    }

    next();
});

// Static method interface
interface ILabIntegrationModel extends mongoose.Model<ILabIntegration> {
    findByPatient(
        workplaceId: mongoose.Types.ObjectId,
        patientId: mongoose.Types.ObjectId
    ): mongoose.Query<ILabIntegration[], ILabIntegration>;
    findPendingReviews(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ILabIntegration[], ILabIntegration>;
    findCriticalCases(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ILabIntegration[], ILabIntegration>;
    findRequiringEscalation(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ILabIntegration[], ILabIntegration>;
    findApprovedCases(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ILabIntegration[], ILabIntegration>;
}

const LabIntegration = mongoose.model<ILabIntegration, ILabIntegrationModel>('LabIntegration', labIntegrationSchema);

export default LabIntegration;

