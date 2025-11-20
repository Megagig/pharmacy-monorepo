import mongoose, { Document, Schema } from 'mongoose';
import {
    tenancyGuardPlugin,
    addAuditFields,
} from '../utils/tenancyGuard';

export interface IFollowUpReminder {
    type: 'email' | 'sms' | 'push' | 'system';
    scheduledFor: Date;
    sent: boolean;
    sentAt?: Date;
    recipientId?: mongoose.Types.ObjectId;
    message?: string;
}

export interface IFollowUpOutcome {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    nextFollowUpDate?: Date;
    adherenceImproved?: boolean;
    problemsResolved?: string[];
    newProblemsIdentified?: string[];
}

export interface IMTRFollowUp extends Document {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    reviewId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;

    // Follow-up details
    type: 'phone_call' | 'appointment' | 'lab_review' | 'adherence_check' | 'outcome_assessment';
    priority: 'high' | 'medium' | 'low';
    description: string;
    objectives: string[];

    // Scheduling
    scheduledDate: Date;
    estimatedDuration: number; // in minutes
    assignedTo: mongoose.Types.ObjectId;

    // Status tracking
    status: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'rescheduled' | 'cancelled';
    completedAt?: Date;
    rescheduledFrom?: Date;
    rescheduledReason?: string;

    // Reminders
    reminders: IFollowUpReminder[];

    // Outcomes
    outcome?: IFollowUpOutcome;

    // Related interventions
    relatedInterventions: mongoose.Types.ObjectId[];

    // Related appointment (for integration with appointment system)
    appointmentId?: mongoose.Types.ObjectId;

    // Audit fields (added by addAuditFields)
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Virtual properties
    daysUntilFollowUp: number | null;
    daysSinceScheduled: number;
    reminderStatus: string;

    // Instance methods
    isOverdue(): boolean;
    canReschedule(): boolean;
    markCompleted(outcome: IFollowUpOutcome): void;
    scheduleReminder(type: string, scheduledFor: Date): void;
    scheduleDefaultReminders(): void;
    reschedule(newDate: Date, reason?: string): void;
}

const mtrFollowUpSchema = new Schema(
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

        // Follow-up details
        type: {
            type: String,
            enum: ['phone_call', 'appointment', 'lab_review', 'adherence_check', 'outcome_assessment'],
            required: true,
            index: true,
        },
        priority: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium',
            required: true,
            index: true,
        },
        description: {
            type: String,
            required: [true, 'Follow-up description is required'],
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        objectives: [
            {
                type: String,
                trim: true,
                maxlength: [300, 'Objective cannot exceed 300 characters'],
            },
        ],

        // Scheduling
        scheduledDate: {
            type: Date,
            required: true,
            index: true,
            validate: {
                validator: function (value: Date) {
                    // Scheduled date should be in the future (with some tolerance for immediate scheduling)
                    return value >= new Date(Date.now() - 60 * 60 * 1000); // Allow 1 hour in the past
                },
                message: 'Scheduled date cannot be in the past',
            },
        },
        estimatedDuration: {
            type: Number,
            required: true,
            min: [5, 'Duration must be at least 5 minutes'],
            max: [480, 'Duration cannot exceed 8 hours'],
            default: 30,
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Status tracking
        status: {
            type: String,
            enum: ['scheduled', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled'],
            default: 'scheduled',
            required: true,
            index: true,
        },
        completedAt: {
            type: Date,
            validate: {
                validator: function (this: IMTRFollowUp, value: Date) {
                    if (value && this.status === 'completed') {
                        return value >= this.scheduledDate;
                    }
                    return true;
                },
                message: 'Completion date cannot be before scheduled date',
            },
            index: true,
        },
        rescheduledFrom: {
            type: Date,
            index: true,
        },
        rescheduledReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Reschedule reason cannot exceed 500 characters'],
        },

        // Reminders
        reminders: [
            {
                type: {
                    type: String,
                    enum: ['email', 'sms', 'push', 'system'],
                    required: true,
                },
                scheduledFor: {
                    type: Date,
                    required: true,
                },
                sent: {
                    type: Boolean,
                    default: false,
                },
                sentAt: Date,
                recipientId: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                },
                message: {
                    type: String,
                    trim: true,
                    maxlength: [500, 'Reminder message cannot exceed 500 characters'],
                },
            },
        ],

        // Outcomes
        outcome: {
            status: {
                type: String,
                enum: ['successful', 'partially_successful', 'unsuccessful'],
            },
            notes: {
                type: String,
                trim: true,
                maxlength: [2000, 'Outcome notes cannot exceed 2000 characters'],
            },
            nextActions: [
                {
                    type: String,
                    trim: true,
                    maxlength: [300, 'Next action cannot exceed 300 characters'],
                },
            ],
            nextFollowUpDate: Date,
            adherenceImproved: Boolean,
            problemsResolved: [
                {
                    type: String,
                    trim: true,
                    maxlength: [200, 'Problem description cannot exceed 200 characters'],
                },
            ],
            newProblemsIdentified: [
                {
                    type: String,
                    trim: true,
                    maxlength: [200, 'Problem description cannot exceed 200 characters'],
                },
            ],
        },

        // Related interventions
        relatedInterventions: [
            {
                type: Schema.Types.ObjectId,
                ref: 'MTRIntervention',
                index: true,
            },
        ],

        // Related appointment (for integration with appointment system)
        appointmentId: {
            type: Schema.Types.ObjectId,
            ref: 'Appointment',
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
addAuditFields(mtrFollowUpSchema);

// Apply tenancy guard plugin
mtrFollowUpSchema.plugin(tenancyGuardPlugin, {
    pharmacyIdField: 'workplaceId',
});

// Indexes for efficient querying
mtrFollowUpSchema.index({ workplaceId: 1, reviewId: 1, status: 1 });
mtrFollowUpSchema.index({ workplaceId: 1, patientId: 1, scheduledDate: 1 });
mtrFollowUpSchema.index({ workplaceId: 1, assignedTo: 1, status: 1 });
mtrFollowUpSchema.index({ workplaceId: 1, type: 1 });
mtrFollowUpSchema.index({ workplaceId: 1, priority: 1 });
mtrFollowUpSchema.index({ workplaceId: 1, isDeleted: 1 });
mtrFollowUpSchema.index({ status: 1, scheduledDate: 1 });
mtrFollowUpSchema.index({ scheduledDate: 1, assignedTo: 1 });
mtrFollowUpSchema.index({ completedAt: -1 }, { sparse: true });
mtrFollowUpSchema.index({ createdAt: -1 });

// Compound index for reminder scheduling
mtrFollowUpSchema.index({ 'reminders.scheduledFor': 1, 'reminders.sent': 1 });

// Virtual for days until follow-up
mtrFollowUpSchema.virtual('daysUntilFollowUp').get(function (this: IMTRFollowUp) {
    if (this.status === 'completed' || this.status === 'cancelled') return null;

    const diffTime = this.scheduledDate.getTime() - Date.now();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for follow-up duration in days since scheduled
mtrFollowUpSchema.virtual('daysSinceScheduled').get(function (this: IMTRFollowUp) {
    const diffTime = Math.abs(Date.now() - this.scheduledDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for overdue status
mtrFollowUpSchema.virtual('overdueStatus').get(function (this: IMTRFollowUp) {
    if (['completed', 'cancelled'].includes(this.status)) return false;
    return this.scheduledDate < new Date();
});

// Virtual for reminder status
mtrFollowUpSchema.virtual('reminderStatus').get(function (this: IMTRFollowUp) {
    const totalReminders = this.reminders.length;
    const sentReminders = this.reminders.filter(r => r.sent).length;

    if (totalReminders === 0) return 'none';
    if (sentReminders === 0) return 'pending';
    if (sentReminders === totalReminders) return 'all_sent';
    return 'partial';
});

// Instance methods
mtrFollowUpSchema.methods.isOverdue = function (this: IMTRFollowUp): boolean {
    if (['completed', 'cancelled'].includes(this.status)) return false;
    return this.scheduledDate < new Date();
};

mtrFollowUpSchema.methods.canReschedule = function (this: IMTRFollowUp): boolean {
    return ['scheduled', 'missed'].includes(this.status);
};

mtrFollowUpSchema.methods.markCompleted = function (
    this: IMTRFollowUp,
    outcome: IFollowUpOutcome
): void {
    this.status = 'completed';
    this.completedAt = new Date();
    this.outcome = outcome;
};

mtrFollowUpSchema.methods.scheduleReminder = function (
    this: IMTRFollowUp,
    type: string,
    scheduledFor: Date
): void {
    this.reminders.push({
        type: type as any,
        scheduledFor,
        sent: false,
    });
};

mtrFollowUpSchema.methods.reschedule = function (
    this: IMTRFollowUp,
    newDate: Date,
    reason?: string
): void {
    if (!this.canReschedule()) {
        throw new Error('Follow-up cannot be rescheduled in current status');
    }

    this.rescheduledFrom = this.scheduledDate;
    this.scheduledDate = newDate;
    this.status = 'scheduled';
    if (reason) {
        this.rescheduledReason = reason;
    }

    // Clear existing reminders and create new ones
    this.reminders = [];
    this.scheduleDefaultReminders();
};

// Method to schedule default reminders
mtrFollowUpSchema.methods.scheduleDefaultReminders = function (this: IMTRFollowUp): void {
    const reminderTimes = [
        { days: 1, type: 'system' },
        { hours: 2, type: 'email' },
    ];

    reminderTimes.forEach(({ days, hours, type }) => {
        const reminderTime = new Date(this.scheduledDate);
        if (days) {
            reminderTime.setDate(reminderTime.getDate() - days);
        } else if (hours) {
            reminderTime.setHours(reminderTime.getHours() - hours);
        }

        if (reminderTime > new Date()) {
            this.scheduleReminder(type, reminderTime);
        }
    });
};

// Pre-save middleware
mtrFollowUpSchema.pre('save', function (this: IMTRFollowUp) {
    // Auto-set completion date when status changes to completed
    if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }

    // Clear completion date when status changes from completed
    if (this.isModified('status') && this.status !== 'completed') {
        this.completedAt = undefined;
    }

    // Validate outcome is provided when status is completed
    if (this.status === 'completed' && (!this.outcome || !this.outcome.status)) {
        throw new Error('Outcome is required when follow-up is completed');
    }

    // Schedule default reminders for new follow-ups
    if (this.isNew && this.status === 'scheduled' && this.reminders.length === 0) {
        this.scheduleDefaultReminders();
    }

    // Validate high priority follow-ups have objectives
    if (this.priority === 'high' && this.objectives.length === 0) {
        throw new Error('High priority follow-ups must have at least one objective');
    }
});

// Static method to find follow-ups by review
mtrFollowUpSchema.statics.findByReview = function (
    reviewId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { reviewId };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: 1 });
};

// Static method to find follow-ups by patient
mtrFollowUpSchema.statics.findByPatient = function (
    patientId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { patientId };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: -1 });
};

// Static method to find scheduled follow-ups
mtrFollowUpSchema.statics.findScheduled = function (
    workplaceId?: mongoose.Types.ObjectId,
    dateRange?: { start: Date; end: Date }
) {
    const query: any = { status: 'scheduled' };

    if (dateRange) {
        query.scheduledDate = {
            $gte: dateRange.start,
            $lte: dateRange.end,
        };
    }

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: 1, priority: 1 });
};

// Static method to find overdue follow-ups
mtrFollowUpSchema.statics.findOverdue = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = {
        status: { $in: ['scheduled', 'in_progress'] },
        scheduledDate: { $lt: new Date() },
    };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: 1, priority: 1 });
};

// Static method to find follow-ups assigned to user
mtrFollowUpSchema.statics.findByAssignee = function (
    assignedTo: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId,
    status?: string
) {
    const query: any = { assignedTo };
    if (status) {
        query.status = status;
    }

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: 1, priority: 1 });
};

// Static method to find pending reminders
mtrFollowUpSchema.statics.findPendingReminders = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = {
        'reminders.sent': false,
        'reminders.scheduledFor': { $lte: new Date() },
        status: { $in: ['scheduled', 'in_progress'] },
    };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ 'reminders.scheduledFor': 1 });
};

// Static method to get follow-up statistics
mtrFollowUpSchema.statics.getStatistics = async function (
    workplaceId?: mongoose.Types.ObjectId,
    dateRange?: { start: Date; end: Date }
) {
    const matchStage: any = {};

    if (workplaceId) {
        matchStage.workplaceId = workplaceId;
    }

    if (dateRange) {
        matchStage.scheduledDate = {
            $gte: dateRange.start,
            $lte: dateRange.end,
        };
    }

    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalFollowUps: { $sum: 1 },
                scheduledFollowUps: {
                    $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] },
                },
                completedFollowUps: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
                },
                missedFollowUps: {
                    $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] },
                },
                overdueFollowUps: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $in: ['$status', ['scheduled', 'in_progress']] },
                                    { $lt: ['$scheduledDate', new Date()] },
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
                followUpsByType: {
                    $push: {
                        type: '$type',
                        status: '$status',
                        priority: '$priority',
                    },
                },
                avgDurationMinutes: { $avg: '$estimatedDuration' },
            },
        },
        {
            $project: {
                _id: 0,
                totalFollowUps: 1,
                scheduledFollowUps: 1,
                completedFollowUps: 1,
                missedFollowUps: 1,
                overdueFollowUps: 1,
                completionRate: {
                    $cond: [
                        { $gt: ['$totalFollowUps', 0] },
                        { $multiply: [{ $divide: ['$completedFollowUps', '$totalFollowUps'] }, 100] },
                        0,
                    ],
                },
                followUpsByType: 1,
                avgDurationMinutes: { $round: ['$avgDurationMinutes', 1] },
            },
        },
    ];

    const result = await this.aggregate(pipeline);
    return (
        result[0] || {
            totalFollowUps: 0,
            scheduledFollowUps: 0,
            completedFollowUps: 0,
            missedFollowUps: 0,
            overdueFollowUps: 0,
            completionRate: 0,
            followUpsByType: [],
            avgDurationMinutes: 0,
        }
    );
};

// Note: Sync middleware for appointment integration will be added separately
// to avoid circular dependency issues

export default mongoose.model<IMTRFollowUp>('MTRFollowUp', mtrFollowUpSchema);