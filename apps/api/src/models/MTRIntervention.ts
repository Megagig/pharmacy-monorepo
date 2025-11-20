import mongoose, { Document, Schema } from 'mongoose';
import {
    tenancyGuardPlugin,
    addAuditFields,
} from '../utils/tenancyGuard';

export interface IMTRIntervention extends Document {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    reviewId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;

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
    followUpDate?: Date;
    followUpCompleted: boolean;

    // Documentation
    documentation: string;
    attachments: string[];

    // Priority and urgency
    priority: 'high' | 'medium' | 'low';
    urgency: 'immediate' | 'within_24h' | 'within_week' | 'routine';

    // Audit fields (added by addAuditFields)
    pharmacistId: mongoose.Types.ObjectId;
    performedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Virtual properties
    daysSinceIntervention: number;
    followUpStatus: string;
    isEffective: boolean;

    // Instance methods
    isOverdue(): boolean;
    markCompleted(outcome: string, details?: string): void;
    requiresFollowUp(): boolean;
}

const mtrInterventionSchema = new Schema(
    {
        workplaceId: {
            type: Schema.Types.ObjectId,
            ref: 'Workplace',
            required: true,
            index: true,
        },
        reviewId: {
            type: Schema.Types.ObjectId,
            ref: 'MedicationTherapyReview',
            required: true,
            index: true,
        },
        patientId: {
            type: Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
            index: true,
        },

        // Intervention details
        type: {
            type: String,
            enum: ['recommendation', 'counseling', 'monitoring', 'communication', 'education'],
            required: true,
            index: true,
        },
        category: {
            type: String,
            enum: ['medication_change', 'adherence_support', 'monitoring_plan', 'patient_education'],
            required: true,
            index: true,
        },
        description: {
            type: String,
            required: [true, 'Intervention description is required'],
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        rationale: {
            type: String,
            required: [true, 'Intervention rationale is required'],
            trim: true,
            maxlength: [1000, 'Rationale cannot exceed 1000 characters'],
        },

        // Target and method
        targetAudience: {
            type: String,
            enum: ['patient', 'prescriber', 'caregiver', 'healthcare_team'],
            required: true,
            index: true,
        },
        communicationMethod: {
            type: String,
            enum: ['verbal', 'written', 'phone', 'email', 'fax', 'in_person'],
            required: true,
            index: true,
        },

        // Outcome tracking
        outcome: {
            type: String,
            enum: ['accepted', 'rejected', 'modified', 'pending', 'not_applicable'],
            default: 'pending',
            required: true,
            index: true,
        },
        outcomeDetails: {
            type: String,
            trim: true,
            maxlength: [1000, 'Outcome details cannot exceed 1000 characters'],
        },
        acceptanceRate: {
            type: Number,
            min: [0, 'Acceptance rate cannot be negative'],
            max: [100, 'Acceptance rate cannot exceed 100'],
        },

        // Follow-up requirements
        followUpRequired: {
            type: Boolean,
            default: false,
            index: true,
        },
        followUpDate: {
            type: Date,
            validate: {
                validator: function (this: IMTRIntervention, value: Date) {
                    if (value && this.followUpRequired) {
                        return value > this.performedAt;
                    }
                    return true;
                },
                message: 'Follow-up date must be after intervention date',
            },
            index: true,
        },
        followUpCompleted: {
            type: Boolean,
            default: false,
            index: true,
        },

        // Documentation
        documentation: {
            type: String,
            required: [true, 'Documentation is required'],
            trim: true,
            maxlength: [2000, 'Documentation cannot exceed 2000 characters'],
        },
        attachments: [
            {
                type: String,
                trim: true,
                maxlength: [500, 'Attachment path cannot exceed 500 characters'],
            },
        ],

        // Priority and urgency
        priority: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium',
            required: true,
            index: true,
        },
        urgency: {
            type: String,
            enum: ['immediate', 'within_24h', 'within_week', 'routine'],
            default: 'routine',
            required: true,
            index: true,
        },

        // Pharmacist and timing
        pharmacistId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        performedAt: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(mtrInterventionSchema);

// Apply tenancy guard plugin
mtrInterventionSchema.plugin(tenancyGuardPlugin, {
    pharmacyIdField: 'workplaceId',
});

// Indexes for efficient querying
mtrInterventionSchema.index({ workplaceId: 1, reviewId: 1, type: 1 });
mtrInterventionSchema.index({ workplaceId: 1, patientId: 1, outcome: 1 });
mtrInterventionSchema.index({ workplaceId: 1, pharmacistId: 1 });
mtrInterventionSchema.index({ workplaceId: 1, category: 1 });
mtrInterventionSchema.index({ workplaceId: 1, isDeleted: 1 });
mtrInterventionSchema.index({ outcome: 1, performedAt: -1 });
mtrInterventionSchema.index({ followUpRequired: 1, followUpDate: 1 });
mtrInterventionSchema.index({ followUpCompleted: 1 }, { sparse: true });
mtrInterventionSchema.index({ priority: 1, urgency: 1 });
mtrInterventionSchema.index({ createdAt: -1 });

// Virtual for days since intervention
mtrInterventionSchema.virtual('daysSinceIntervention').get(function (this: IMTRIntervention) {
    const diffTime = Math.abs(Date.now() - this.performedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for follow-up status
mtrInterventionSchema.virtual('followUpStatus').get(function (this: IMTRIntervention) {
    if (!this.followUpRequired) return 'not_required';
    if (this.followUpCompleted) return 'completed';
    if (this.followUpDate && this.followUpDate < new Date()) return 'overdue';
    return 'pending';
});

// Virtual for intervention effectiveness
mtrInterventionSchema.virtual('isEffective').get(function (this: IMTRIntervention) {
    return ['accepted', 'modified'].includes(this.outcome);
});

// Instance methods
mtrInterventionSchema.methods.isOverdue = function (this: IMTRIntervention): boolean {
    if (!this.followUpRequired || this.followUpCompleted) return false;
    if (!this.followUpDate) return false;
    return this.followUpDate < new Date();
};

mtrInterventionSchema.methods.markCompleted = function (
    this: IMTRIntervention,
    outcome: string,
    details?: string
): void {
    this.outcome = outcome as any;
    if (details) {
        this.outcomeDetails = details;
    }

    // If follow-up was required and outcome is positive, mark follow-up as completed
    if (this.followUpRequired && ['accepted', 'modified'].includes(outcome)) {
        this.followUpCompleted = true;
    }
};

mtrInterventionSchema.methods.requiresFollowUp = function (this: IMTRIntervention): boolean {
    return this.followUpRequired && !this.followUpCompleted;
};

// Pre-save middleware
mtrInterventionSchema.pre('save', function (this: IMTRIntervention) {
    // Validate follow-up date if follow-up is required
    if (this.followUpRequired && !this.followUpDate) {
        // Auto-set follow-up date based on urgency
        const daysToAdd = {
            immediate: 1,
            within_24h: 1,
            within_week: 7,
            routine: 14,
        };

        const days = daysToAdd[this.urgency] || 14;
        this.followUpDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // Clear follow-up date if not required
    if (!this.followUpRequired) {
        this.followUpDate = undefined;
        this.followUpCompleted = false;
    }

    // Validate high priority interventions have proper documentation
    if (this.priority === 'high' && this.documentation.length < 50) {
        throw new Error('High priority interventions require detailed documentation (minimum 50 characters)');
    }
});

// Static method to find interventions by review
mtrInterventionSchema.statics.findByReview = function (
    reviewId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { reviewId };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ priority: 1, performedAt: -1 });
};

// Static method to find interventions by patient
mtrInterventionSchema.statics.findByPatient = function (
    patientId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { patientId };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ performedAt: -1 });
};

// Static method to find pending interventions
mtrInterventionSchema.statics.findPending = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { outcome: 'pending' };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ priority: 1, urgency: 1, performedAt: 1 });
};

// Static method to find overdue follow-ups
mtrInterventionSchema.statics.findOverdueFollowUps = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = {
        followUpRequired: true,
        followUpCompleted: false,
        followUpDate: { $lt: new Date() },
    };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ followUpDate: 1 });
};

// Static method to get intervention statistics
mtrInterventionSchema.statics.getStatistics = async function (
    workplaceId?: mongoose.Types.ObjectId,
    dateRange?: { start: Date; end: Date }
) {
    const matchStage: any = {};

    if (workplaceId) {
        matchStage.workplaceId = workplaceId;
    }

    if (dateRange) {
        matchStage.performedAt = {
            $gte: dateRange.start,
            $lte: dateRange.end,
        };
    }

    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalInterventions: { $sum: 1 },
                acceptedInterventions: {
                    $sum: { $cond: [{ $eq: ['$outcome', 'accepted'] }, 1, 0] },
                },
                rejectedInterventions: {
                    $sum: { $cond: [{ $eq: ['$outcome', 'rejected'] }, 1, 0] },
                },
                modifiedInterventions: {
                    $sum: { $cond: [{ $eq: ['$outcome', 'modified'] }, 1, 0] },
                },
                pendingInterventions: {
                    $sum: { $cond: [{ $eq: ['$outcome', 'pending'] }, 1, 0] },
                },
                interventionsByType: {
                    $push: {
                        type: '$type',
                        category: '$category',
                        outcome: '$outcome',
                    },
                },
                interventionsByPriority: {
                    $push: {
                        priority: '$priority',
                        urgency: '$urgency',
                        outcome: '$outcome',
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                totalInterventions: 1,
                acceptedInterventions: 1,
                rejectedInterventions: 1,
                modifiedInterventions: 1,
                pendingInterventions: 1,
                acceptanceRate: {
                    $cond: [
                        { $gt: ['$totalInterventions', 0] },
                        {
                            $multiply: [
                                {
                                    $divide: [
                                        { $add: ['$acceptedInterventions', '$modifiedInterventions'] },
                                        '$totalInterventions',
                                    ],
                                },
                                100,
                            ],
                        },
                        0,
                    ],
                },
                interventionsByType: 1,
                interventionsByPriority: 1,
            },
        },
    ];

    const result = await this.aggregate(pipeline);
    return (
        result[0] || {
            totalInterventions: 0,
            acceptedInterventions: 0,
            rejectedInterventions: 0,
            modifiedInterventions: 0,
            pendingInterventions: 0,
            acceptanceRate: 0,
            interventionsByType: [],
            interventionsByPriority: [],
        }
    );
};

export default mongoose.model<IMTRIntervention>('MTRIntervention', mtrInterventionSchema);