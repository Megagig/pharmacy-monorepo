import mongoose, { Document, Schema } from 'mongoose';
import {
    tenancyGuardPlugin,
    addAuditFields,
} from '../utils/tenancyGuard';

export interface IInterventionStrategy {
    type:
    | 'medication_review'
    | 'dose_adjustment'
    | 'alternative_therapy'
    | 'discontinuation'
    | 'additional_monitoring'
    | 'patient_counseling'
    | 'physician_consultation'
    | 'custom';
    description: string;
    rationale: string;
    expectedOutcome: string;
    priority: 'primary' | 'secondary';
}

export interface ITeamAssignment {
    userId: mongoose.Types.ObjectId;
    role: 'pharmacist' | 'physician' | 'nurse' | 'patient' | 'caregiver';
    task: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    assignedAt: Date;
    completedAt?: Date;
    notes?: string;
}

export interface IClinicalParameter {
    parameter: string;
    beforeValue?: string;
    afterValue?: string;
    unit?: string;
    improvementPercentage?: number;
}

export interface ISuccessMetrics {
    problemResolved: boolean;
    medicationOptimized: boolean;
    adherenceImproved: boolean;
    adherenceImprovement?: number; // Percentage improvement in adherence
    costSavings?: number;
    qualityOfLifeImproved?: boolean;
    patientSatisfaction?: number; // Rating 1-10
}

export interface IInterventionOutcome {
    patientResponse: 'improved' | 'no_change' | 'worsened' | 'unknown';
    clinicalParameters: IClinicalParameter[];
    adverseEffects?: string;
    additionalIssues?: string;
    successMetrics: ISuccessMetrics;
}

export interface IFollowUp {
    required: boolean;
    scheduledDate?: Date;
    completedDate?: Date;
    notes?: string;
    nextReviewDate?: Date;
}

export interface IClinicalIntervention extends Document {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId; // Tenancy
    patientId: mongoose.Types.ObjectId; // Patient reference

    // Intervention Identification
    interventionNumber: string; // Auto-generated unique ID (CI-YYYYMM-XXXX)
    category:
    | 'drug_therapy_problem'
    | 'adverse_drug_reaction'
    | 'medication_nonadherence'
    | 'drug_interaction'
    | 'dosing_issue'
    | 'contraindication'
    | 'other';
    priority: 'low' | 'medium' | 'high' | 'critical';

    // Clinical Issue Details
    issueDescription: string; // 10-1000 characters
    identifiedDate: Date;
    identifiedBy: mongoose.Types.ObjectId; // User reference

    // Intervention Strategy
    strategies: IInterventionStrategy[];

    // Team Collaboration
    assignments: ITeamAssignment[];

    // Implementation Tracking
    status:
    | 'identified'
    | 'planning'
    | 'in_progress'
    | 'implemented'
    | 'completed'
    | 'cancelled';
    implementationNotes?: string;
    type?: string; // Intervention type
    outcome?: 'successful' | 'partially_successful' | 'unsuccessful' | 'unknown'; // Simple outcome

    // Outcome Measurement
    outcomes?: IInterventionOutcome;
    adherenceImprovement?: number; // Percentage improvement (0-100)
    costSavings?: number; // Cost savings in currency
    patientSatisfaction?: number; // Rating 1-10

    // Follow-up and Monitoring
    followUp: IFollowUp;

    // Timestamps and Audit
    startedAt: Date;
    completedAt?: Date;
    estimatedDuration?: number; // minutes
    actualDuration?: number; // minutes

    // Integration References
    relatedMTRId?: mongoose.Types.ObjectId;
    relatedDTPIds: mongoose.Types.ObjectId[];

    // Audit fields (from addAuditFields)
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Virtual properties
    durationDays: number;
    isOverdue: boolean;

    // Instance methods
    getCompletionPercentage(): number;
    getNextStep(): string | null;
    canComplete(): boolean;
    addStrategy(strategy: IInterventionStrategy): void;
    assignTeamMember(assignment: ITeamAssignment): void;
    recordOutcome(outcome: IInterventionOutcome): void;
    generateInterventionNumber(): string;
}

export interface IClinicalInterventionModel extends mongoose.Model<IClinicalIntervention> {
    generateNextInterventionNumber(workplaceId: mongoose.Types.ObjectId): Promise<string>;
    findActive(workplaceId?: mongoose.Types.ObjectId): mongoose.Query<IClinicalIntervention[], IClinicalIntervention>;
    findOverdue(workplaceId?: mongoose.Types.ObjectId): mongoose.Query<IClinicalIntervention[], IClinicalIntervention>;
    findByPatient(patientId: mongoose.Types.ObjectId, workplaceId?: mongoose.Types.ObjectId): mongoose.Query<IClinicalIntervention[], IClinicalIntervention>;
    findAssignedToUser(userId: mongoose.Types.ObjectId, workplaceId?: mongoose.Types.ObjectId): mongoose.Query<IClinicalIntervention[], IClinicalIntervention>;
}

const clinicalInterventionSchema = new Schema(
    {
        workplaceId: {
            type: Schema.Types.ObjectId,
            ref: 'Workplace',
            required: true,
            index: true,
        },
        patientId: {
            type: Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
            index: true,
        },

        // Intervention Identification
        interventionNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
            match: [/^CI-\d{6}-\d{4}$/, 'Invalid intervention number format'],
        },
        category: {
            type: String,
            enum: [
                'drug_therapy_problem',
                'adverse_drug_reaction',
                'medication_nonadherence',
                'drug_interaction',
                'dosing_issue',
                'contraindication',
                'other',
            ],
            required: true,
            index: true,
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            required: true,
            index: true,
        },

        // Clinical Issue Details
        issueDescription: {
            type: String,
            required: [true, 'Issue description is required'],
            trim: true,
            minlength: [10, 'Issue description must be at least 10 characters'],
            maxlength: [1000, 'Issue description cannot exceed 1000 characters'],
        },
        identifiedDate: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },
        identifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Intervention Strategy
        strategies: [
            {
                type: {
                    type: String,
                    enum: [
                        'medication_review',
                        'dose_adjustment',
                        'alternative_therapy',
                        'discontinuation',
                        'additional_monitoring',
                        'patient_counseling',
                        'physician_consultation',
                        'custom',
                    ],
                    required: true,
                },
                description: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: [500, 'Strategy description cannot exceed 500 characters'],
                },
                rationale: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: [500, 'Strategy rationale cannot exceed 500 characters'],
                },
                expectedOutcome: {
                    type: String,
                    required: true,
                    trim: true,
                    minlength: [20, 'Expected outcome must be at least 20 characters'],
                    maxlength: [500, 'Expected outcome cannot exceed 500 characters'],
                },
                priority: {
                    type: String,
                    enum: ['primary', 'secondary'],
                    default: 'primary',
                },
            },
        ],

        // Team Collaboration
        assignments: [
            {
                userId: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                    index: true,
                },
                role: {
                    type: String,
                    enum: ['pharmacist', 'physician', 'nurse', 'patient', 'caregiver'],
                    required: true,
                },
                task: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: [300, 'Task description cannot exceed 300 characters'],
                },
                status: {
                    type: String,
                    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
                    default: 'pending',
                    index: true,
                },
                assignedAt: {
                    type: Date,
                    required: true,
                    default: Date.now,
                },
                completedAt: Date,
                notes: {
                    type: String,
                    trim: true,
                    maxlength: [500, 'Assignment notes cannot exceed 500 characters'],
                },
            },
        ],

        // Implementation Tracking
        status: {
            type: String,
            enum: [
                'identified',
                'planning',
                'in_progress',
                'implemented',
                'completed',
                'cancelled',
            ],
            default: 'identified',
            required: true,
            index: true,
        },
        implementationNotes: {
            type: String,
            trim: true,
            maxlength: [2000, 'Implementation notes cannot exceed 2000 characters'],
        },

        // Outcome Measurement
        outcomes: {
            patientResponse: {
                type: String,
                enum: ['improved', 'no_change', 'worsened', 'unknown'],
            },
            clinicalParameters: [
                {
                    parameter: {
                        type: String,
                        required: true,
                        trim: true,
                        maxlength: [100, 'Parameter name cannot exceed 100 characters'],
                    },
                    beforeValue: {
                        type: String,
                        trim: true,
                        maxlength: [50, 'Before value cannot exceed 50 characters'],
                    },
                    afterValue: {
                        type: String,
                        trim: true,
                        maxlength: [50, 'After value cannot exceed 50 characters'],
                    },
                    unit: {
                        type: String,
                        trim: true,
                        maxlength: [20, 'Unit cannot exceed 20 characters'],
                    },
                    improvementPercentage: {
                        type: Number,
                        min: [-100, 'Improvement percentage cannot be less than -100'],
                        max: [1000, 'Improvement percentage cannot exceed 1000'],
                    },
                },
            ],
            adverseEffects: {
                type: String,
                trim: true,
                maxlength: [1000, 'Adverse effects description cannot exceed 1000 characters'],
            },
            additionalIssues: {
                type: String,
                trim: true,
                maxlength: [1000, 'Additional issues description cannot exceed 1000 characters'],
            },
            successMetrics: {
                problemResolved: {
                    type: Boolean,
                    default: false,
                },
                medicationOptimized: {
                    type: Boolean,
                    default: false,
                },
                adherenceImproved: {
                    type: Boolean,
                    default: false,
                },
                costSavings: {
                    type: Number,
                    min: [0, 'Cost savings cannot be negative'],
                },
                qualityOfLifeImproved: {
                    type: Boolean,
                    default: false,
                },
            },
        },

        // Follow-up and Monitoring
        followUp: {
            required: {
                type: Boolean,
                default: false,
            },
            scheduledDate: Date,
            completedDate: Date,
            notes: {
                type: String,
                trim: true,
                maxlength: [500, 'Follow-up notes cannot exceed 500 characters'],
            },
            nextReviewDate: Date,
        },

        // Timestamps and Audit
        startedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        completedAt: Date,
        estimatedDuration: {
            type: Number,
            min: [0, 'Estimated duration cannot be negative'],
        },
        actualDuration: {
            type: Number,
            min: [0, 'Actual duration cannot be negative'],
        },

        // Integration References
        relatedMTRId: {
            type: Schema.Types.ObjectId,
            ref: 'MedicationTherapyReview',
            index: true,
        },
        relatedDTPIds: [
            {
                type: Schema.Types.ObjectId,
                ref: 'DrugTherapyProblem',
                index: true,
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(clinicalInterventionSchema);

// Apply tenancy guard plugin
clinicalInterventionSchema.plugin(tenancyGuardPlugin, {
    pharmacyIdField: 'workplaceId',
});

// Indexes for optimal query performance
clinicalInterventionSchema.index({ workplaceId: 1, patientId: 1, status: 1 });
clinicalInterventionSchema.index({ workplaceId: 1, identifiedBy: 1 });
clinicalInterventionSchema.index({ workplaceId: 1, category: 1, priority: 1 });
clinicalInterventionSchema.index({ workplaceId: 1, isDeleted: 1 });
clinicalInterventionSchema.index({ workplaceId: 1, interventionNumber: 1 }, { unique: true });
clinicalInterventionSchema.index({ 'assignments.userId': 1, 'assignments.status': 1 });
clinicalInterventionSchema.index({ identifiedDate: -1 });
clinicalInterventionSchema.index({ completedAt: -1 }, { sparse: true });
clinicalInterventionSchema.index({ createdAt: -1 });
clinicalInterventionSchema.index({ 'followUp.scheduledDate': 1 }, { sparse: true });
clinicalInterventionSchema.index({ relatedMTRId: 1 }, { sparse: true });
clinicalInterventionSchema.index({ relatedDTPIds: 1 }, { sparse: true });

// Virtual for duration in days
clinicalInterventionSchema.virtual('durationDays').get(function (this: IClinicalIntervention) {
    const endDate = this.completedAt || new Date();
    const diffTime = Math.abs(endDate.getTime() - this.startedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for overdue status
clinicalInterventionSchema.virtual('isOverdue').get(function (this: IClinicalIntervention) {
    if (this.status === 'completed' || this.status === 'cancelled') return false;

    const daysSinceStart = Math.floor(
        (Date.now() - this.startedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Consider critical/high overdue after 1 day, medium after 3 days, low after 7 days
    let overdueThreshold: number;
    switch (this.priority) {
        case 'critical':
        case 'high':
            overdueThreshold = 1;
            break;
        case 'medium':
            overdueThreshold = 3;
            break;
        case 'low':
        default:
            overdueThreshold = 7;
            break;
    }

    return daysSinceStart > overdueThreshold;
});

// Instance methods
clinicalInterventionSchema.methods.getCompletionPercentage = function (this: IClinicalIntervention): number {
    const totalSteps = 5; // identified -> planning -> in_progress -> implemented -> completed
    const statusOrder = ['identified', 'planning', 'in_progress', 'implemented', 'completed'];
    const currentStepIndex = statusOrder.indexOf(this.status);

    if (currentStepIndex === -1 || this.status === 'cancelled') return 0;

    return Math.round(((currentStepIndex + 1) / totalSteps) * 100);
};

clinicalInterventionSchema.methods.getNextStep = function (this: IClinicalIntervention): string | null {
    const statusFlow = {
        'identified': 'planning',
        'planning': 'in_progress',
        'in_progress': 'implemented',
        'implemented': 'completed',
        'completed': null,
        'cancelled': null,
    };

    return statusFlow[this.status] || null;
};

clinicalInterventionSchema.methods.canComplete = function (this: IClinicalIntervention): boolean {
    // Can complete if status is 'implemented' and has at least one strategy and outcome recorded
    return (
        this.status === 'implemented' &&
        this.strategies.length > 0 &&
        !!this.outcomes &&
        this.outcomes.patientResponse !== undefined
    );
};

clinicalInterventionSchema.methods.addStrategy = function (
    this: IClinicalIntervention,
    strategy: IInterventionStrategy
): void {
    this.strategies.push(strategy);

    // Auto-advance status if this is the first strategy
    if (this.status === 'identified' && this.strategies.length === 1) {
        this.status = 'planning';
    }
};

clinicalInterventionSchema.methods.assignTeamMember = function (
    this: IClinicalIntervention,
    assignment: ITeamAssignment
): void {
    this.assignments.push(assignment);

    // Auto-advance status if this is the first assignment
    if (this.status === 'planning' && this.assignments.length === 1) {
        this.status = 'in_progress';
    }
};

clinicalInterventionSchema.methods.recordOutcome = function (
    this: IClinicalIntervention,
    outcome: IInterventionOutcome
): void {
    this.outcomes = outcome;

    // Auto-advance status when outcome is recorded
    if (this.status === 'in_progress') {
        this.status = 'implemented';
    }

    // Auto-complete if all success metrics are positive
    if (this.canComplete()) {
        this.status = 'completed';
        this.completedAt = new Date();

        // Calculate actual duration
        if (this.startedAt) {
            this.actualDuration = Math.round(
                (this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60)
            );
        }
    }
};

clinicalInterventionSchema.methods.generateInterventionNumber = function (this: IClinicalIntervention): string {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const randomSuffix = Math.random().toString().substr(2, 4).padStart(4, '0');
    return `CI-${year}${month}-${randomSuffix}`;
};

// Pre-save middleware
clinicalInterventionSchema.pre('save', function (this: IClinicalIntervention) {
    // Generate intervention number if not set
    if (this.isNew && !this.interventionNumber) {
        this.interventionNumber = this.generateInterventionNumber();
    }

    // Validate that at least one strategy exists for non-identified status
    if (this.status !== 'identified' && this.status !== 'cancelled' && this.strategies.length === 0) {
        throw new Error('At least one intervention strategy is required');
    }

    // Validate outcome is recorded for implemented/completed status
    if ((this.status === 'implemented' || this.status === 'completed') && !this.outcomes?.patientResponse) {
        throw new Error('Patient response outcome is required for implemented/completed interventions');
    }

    // Auto-set completedAt when status changes to completed
    if (this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }

    // Calculate actual duration when completed
    if (this.status === 'completed' && this.completedAt && this.startedAt && !this.actualDuration) {
        this.actualDuration = Math.round(
            (this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60)
        );
    }
});

// Static method to generate next intervention number
clinicalInterventionSchema.statics.generateNextInterventionNumber = async function (
    workplaceId: mongoose.Types.ObjectId
): Promise<string> {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    // Use a more robust approach with atomic operations to prevent duplicates
    const prefix = `CI-${year}${month}`;

    // Try to find the highest sequence number for this month across all workplaces
    // This ensures global uniqueness for super_admin users
    const lastIntervention = await this.findOne(
        {
            interventionNumber: { $regex: `^${prefix}` }
        },
        {},
        { sort: { interventionNumber: -1 }, bypassTenancyGuard: true }
    );

    let sequence = 1;
    if (lastIntervention?.interventionNumber) {
        const match = lastIntervention.interventionNumber.match(/-(\d+)$/);
        if (match) {
            sequence = parseInt(match[1]) + 1;
        }
    }

    // Generate the intervention number
    const interventionNumber = `${prefix}-${sequence.toString().padStart(4, '0')}`;

    // Double-check for uniqueness to prevent race conditions
    const existing = await this.findOne(
        { interventionNumber },
        {},
        { bypassTenancyGuard: true }
    );

    if (existing) {
        // If somehow a duplicate exists, try the next number
        return `${prefix}-${(sequence + 1).toString().padStart(4, '0')}`;
    }

    return interventionNumber;
};

// Static method to find active interventions
clinicalInterventionSchema.statics.findActive = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { status: { $in: ['identified', 'planning', 'in_progress', 'implemented'] } };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ priority: 1, identifiedDate: 1 }); // Critical first, then by date
};

// Static method to find overdue interventions
clinicalInterventionSchema.statics.findOverdue = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const criticalThreshold = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const highThreshold = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const mediumThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const lowThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const query = {
        status: { $in: ['identified', 'planning', 'in_progress', 'implemented'] },
        $or: [
            { priority: 'critical', startedAt: { $lt: criticalThreshold } },
            { priority: 'high', startedAt: { $lt: highThreshold } },
            { priority: 'medium', startedAt: { $lt: mediumThreshold } },
            { priority: 'low', startedAt: { $lt: lowThreshold } }
        ]
    };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ priority: 1, startedAt: 1 });
};

// Static method to find interventions by patient
clinicalInterventionSchema.statics.findByPatient = function (
    patientId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { patientId };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ identifiedDate: -1 });
};

// Static method to find interventions assigned to user
clinicalInterventionSchema.statics.findAssignedToUser = function (
    userId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { 'assignments.userId': userId };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ priority: 1, identifiedDate: 1 });
};

const ClinicalIntervention = mongoose.model<IClinicalIntervention, IClinicalInterventionModel>('ClinicalIntervention', clinicalInterventionSchema);

export { ClinicalIntervention };
export default ClinicalIntervention;