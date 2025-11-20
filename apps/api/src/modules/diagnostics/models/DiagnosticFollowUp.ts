import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface IFollowUpReminder {
    type: 'email' | 'sms' | 'push' | 'system';
    scheduledFor: Date;
    sent: boolean;
    sentAt?: Date;
    recipientId?: mongoose.Types.ObjectId;
    message?: string;
    channel?: string;
}

export interface IFollowUpOutcome {
    status: 'successful' | 'partially_successful' | 'unsuccessful' | 'no_show';
    notes: string;
    nextActions: string[];
    nextFollowUpDate?: Date;
    adherenceImproved?: boolean;
    symptomsResolved?: string[];
    newSymptomsIdentified?: string[];
    medicationChanges?: Array<{
        action: 'started' | 'stopped' | 'modified' | 'continued';
        medication: string;
        reason: string;
    }>;
    vitalSigns?: {
        bloodPressure?: string;
        heartRate?: number;
        temperature?: number;
        bloodGlucose?: number;
        weight?: number;
    };
    labResultsReviewed?: boolean;
    referralMade?: {
        specialty: string;
        urgency: 'immediate' | 'within_24h' | 'within_week' | 'routine';
        reason: string;
    };
}

export interface IDiagnosticFollowUp extends Document {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    diagnosticRequestId: mongoose.Types.ObjectId;
    diagnosticResultId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;

    // Follow-up details
    type: 'symptom_check' | 'medication_review' | 'lab_review' | 'adherence_check' | 'outcome_assessment' | 'referral_follow_up';
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

    // Related data
    relatedDiagnoses?: string[];
    relatedMedications?: string[];
    triggerConditions?: Array<{
        condition: string;
        threshold: string;
        action: string;
    }>;

    // Auto-scheduling rules
    autoScheduled: boolean;
    schedulingRule?: {
        basedOn: 'diagnosis_severity' | 'medication_type' | 'red_flags' | 'patient_risk' | 'manual';
        interval: number; // days
        maxFollowUps?: number;
        conditions?: string[];
    };

    // Audit fields (added by addAuditFields)
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Virtual properties
    daysUntilFollowUp: number | null;
    daysSinceScheduled: number;
    isOverdue: boolean;
    reminderStatus: string;

    // Instance methods
    markCompleted(outcome: IFollowUpOutcome): Promise<void>;
    scheduleReminder(type: string, scheduledFor: Date): void;
    reschedule(newDate: Date, reason?: string): void;
    canReschedule(): boolean;
    scheduleDefaultReminders(): void;
    calculateNextFollowUp(): Date | null;
}

export interface IDiagnosticFollowUpModel extends mongoose.Model<IDiagnosticFollowUp> {
    findByPatient(patientId: mongoose.Types.ObjectId, workplaceId?: mongoose.Types.ObjectId): mongoose.Query<IDiagnosticFollowUp[], IDiagnosticFollowUp>;
    findOverdue(workplaceId?: mongoose.Types.ObjectId): mongoose.Query<IDiagnosticFollowUp[], IDiagnosticFollowUp>;
    findScheduled(workplaceId?: mongoose.Types.ObjectId, dateRange?: { start: Date; end: Date }): mongoose.Query<IDiagnosticFollowUp[], IDiagnosticFollowUp>;
    findByAssignee(assignedTo: mongoose.Types.ObjectId, workplaceId?: mongoose.Types.ObjectId, status?: string): mongoose.Query<IDiagnosticFollowUp[], IDiagnosticFollowUp>;
}

const followUpReminderSchema = new Schema({
    type: {
        type: String,
        enum: ['email', 'sms', 'push', 'system'],
        required: true
    },
    scheduledFor: {
        type: Date,
        required: true
    },
    sent: {
        type: Boolean,
        default: false
    },
    sentAt: Date,
    recipientId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    message: {
        type: String,
        trim: true,
        maxlength: [500, 'Reminder message cannot exceed 500 characters']
    },
    channel: {
        type: String,
        trim: true,
        maxlength: [50, 'Channel cannot exceed 50 characters']
    }
}, { _id: false });

const followUpOutcomeSchema = new Schema({
    status: {
        type: String,
        enum: ['successful', 'partially_successful', 'unsuccessful', 'no_show'],
        required: true
    },
    notes: {
        type: String,
        required: true,
        trim: true,
        maxlength: [2000, 'Outcome notes cannot exceed 2000 characters']
    },
    nextActions: {
        type: [String],
        default: [],
        validate: {
            validator: function (actions: string[]) {
                return actions.every(action => action.trim().length > 0 && action.length <= 300);
            },
            message: 'Next actions must be non-empty and not exceed 300 characters each'
        }
    },
    nextFollowUpDate: Date,
    adherenceImproved: Boolean,
    symptomsResolved: {
        type: [String],
        default: []
    },
    newSymptomsIdentified: {
        type: [String],
        default: []
    },
    medicationChanges: [{
        action: {
            type: String,
            enum: ['started', 'stopped', 'modified', 'continued'],
            required: true
        },
        medication: {
            type: String,
            required: true,
            trim: true,
            maxlength: [200, 'Medication name cannot exceed 200 characters']
        },
        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: [300, 'Reason cannot exceed 300 characters']
        }
    }],
    vitalSigns: {
        bloodPressure: String,
        heartRate: Number,
        temperature: Number,
        bloodGlucose: Number,
        weight: Number
    },
    labResultsReviewed: {
        type: Boolean,
        default: false
    },
    referralMade: {
        specialty: {
            type: String,
            trim: true,
            maxlength: [100, 'Specialty cannot exceed 100 characters']
        },
        urgency: {
            type: String,
            enum: ['immediate', 'within_24h', 'within_week', 'routine']
        },
        reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Referral reason cannot exceed 500 characters']
        }
    }
}, { _id: false });

const diagnosticFollowUpSchema = new Schema({
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    diagnosticRequestId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticRequest',
        required: true,
        index: true
    },
    diagnosticResultId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticResult',
        required: true,
        index: true
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true
    },

    // Follow-up details
    type: {
        type: String,
        enum: ['symptom_check', 'medication_review', 'lab_review', 'adherence_check', 'outcome_assessment', 'referral_follow_up'],
        required: true,
        index: true
    },
    priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium',
        required: true,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    objectives: {
        type: [String],
        default: [],
        validate: {
            validator: function (objectives: string[]) {
                return objectives.every(obj => obj.trim().length > 0 && obj.length <= 300);
            },
            message: 'Objectives must be non-empty and not exceed 300 characters each'
        }
    },

    // Scheduling
    scheduledDate: {
        type: Date,
        required: true,
        index: true,
        validate: {
            validator: function (value: Date) {
                // Allow scheduling up to 1 hour in the past for flexibility
                return value >= new Date(Date.now() - 60 * 60 * 1000);
            },
            message: 'Scheduled date cannot be more than 1 hour in the past'
        }
    },
    estimatedDuration: {
        type: Number,
        required: true,
        min: [5, 'Duration must be at least 5 minutes'],
        max: [480, 'Duration cannot exceed 8 hours'],
        default: 30
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Status tracking
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled'],
        default: 'scheduled',
        required: true,
        index: true
    },
    completedAt: {
        type: Date,
        validate: {
            validator: function (this: IDiagnosticFollowUp, value: Date) {
                if (value && this.status === 'completed') {
                    return value >= this.scheduledDate;
                }
                return true;
            },
            message: 'Completion date cannot be before scheduled date'
        },
        index: true
    },
    rescheduledFrom: {
        type: Date,
        index: true
    },
    rescheduledReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Reschedule reason cannot exceed 500 characters']
    },

    // Reminders
    reminders: {
        type: [followUpReminderSchema],
        default: []
    },

    // Outcomes
    outcome: followUpOutcomeSchema,

    // Related data
    relatedDiagnoses: {
        type: [String],
        default: []
    },
    relatedMedications: {
        type: [String],
        default: []
    },
    triggerConditions: [{
        condition: {
            type: String,
            required: true,
            trim: true,
            maxlength: [200, 'Condition cannot exceed 200 characters']
        },
        threshold: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, 'Threshold cannot exceed 100 characters']
        },
        action: {
            type: String,
            required: true,
            trim: true,
            maxlength: [200, 'Action cannot exceed 200 characters']
        }
    }],

    // Auto-scheduling rules
    autoScheduled: {
        type: Boolean,
        default: false,
        index: true
    },
    schedulingRule: {
        basedOn: {
            type: String,
            enum: ['diagnosis_severity', 'medication_type', 'red_flags', 'patient_risk', 'manual']
        },
        interval: {
            type: Number,
            min: [1, 'Interval must be at least 1 day']
        },
        maxFollowUps: {
            type: Number,
            min: [1, 'Max follow-ups must be at least 1']
        },
        conditions: {
            type: [String],
            default: []
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(diagnosticFollowUpSchema);

// Apply tenancy guard plugin
diagnosticFollowUpSchema.plugin(tenancyGuardPlugin, {
    pharmacyIdField: 'workplaceId'
});

// Indexes for efficient querying
diagnosticFollowUpSchema.index({ workplaceId: 1, diagnosticRequestId: 1, status: 1 });
diagnosticFollowUpSchema.index({ workplaceId: 1, patientId: 1, scheduledDate: 1 });
diagnosticFollowUpSchema.index({ workplaceId: 1, assignedTo: 1, status: 1 });
diagnosticFollowUpSchema.index({ workplaceId: 1, type: 1, priority: 1 });
diagnosticFollowUpSchema.index({ workplaceId: 1, autoScheduled: 1 });
diagnosticFollowUpSchema.index({ workplaceId: 1, isDeleted: 1 });
diagnosticFollowUpSchema.index({ status: 1, scheduledDate: 1 });
diagnosticFollowUpSchema.index({ scheduledDate: 1, assignedTo: 1 });
diagnosticFollowUpSchema.index({ completedAt: -1 }, { sparse: true });
diagnosticFollowUpSchema.index({ createdAt: -1 });

// Compound index for reminder scheduling
diagnosticFollowUpSchema.index({ 'reminders.scheduledFor': 1, 'reminders.sent': 1 });

// Virtual for days until follow-up
diagnosticFollowUpSchema.virtual('daysUntilFollowUp').get(function (this: IDiagnosticFollowUp) {
    if (this.status === 'completed' || this.status === 'cancelled') return null;

    const diffTime = this.scheduledDate.getTime() - Date.now();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days since scheduled
diagnosticFollowUpSchema.virtual('daysSinceScheduled').get(function (this: IDiagnosticFollowUp) {
    const diffTime = Math.abs(Date.now() - this.scheduledDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for overdue status
diagnosticFollowUpSchema.virtual('isOverdue').get(function (this: IDiagnosticFollowUp) {
    if (['completed', 'cancelled'].includes(this.status)) return false;
    return this.scheduledDate < new Date();
});

// Virtual for reminder status
diagnosticFollowUpSchema.virtual('reminderStatus').get(function (this: IDiagnosticFollowUp) {
    const totalReminders = this.reminders.length;
    const sentReminders = this.reminders.filter(r => r.sent).length;

    if (totalReminders === 0) return 'none';
    if (sentReminders === 0) return 'pending';
    if (sentReminders === totalReminders) return 'all_sent';
    return 'partial';
});

// Instance methods
diagnosticFollowUpSchema.methods.markCompleted = async function (
    this: IDiagnosticFollowUp,
    outcome: IFollowUpOutcome
): Promise<void> {
    this.status = 'completed';
    this.completedAt = new Date();
    this.outcome = outcome;
    await this.save();
};

diagnosticFollowUpSchema.methods.scheduleReminder = function (
    this: IDiagnosticFollowUp,
    type: string,
    scheduledFor: Date
): void {
    this.reminders.push({
        type: type as any,
        scheduledFor,
        sent: false
    });
};

diagnosticFollowUpSchema.methods.canReschedule = function (this: IDiagnosticFollowUp): boolean {
    return ['scheduled', 'missed'].includes(this.status);
};

diagnosticFollowUpSchema.methods.reschedule = function (
    this: IDiagnosticFollowUp,
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
diagnosticFollowUpSchema.methods.scheduleDefaultReminders = function (this: IDiagnosticFollowUp): void {
    const reminderTimes = [
        { days: 1, type: 'system' },
        { hours: 2, type: 'email' }
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

// Method to calculate next follow-up date based on rules
diagnosticFollowUpSchema.methods.calculateNextFollowUp = function (this: IDiagnosticFollowUp): Date | null {
    if (!this.schedulingRule || !this.outcome) return null;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + this.schedulingRule.interval);

    // Check if we've reached max follow-ups
    if (this.schedulingRule.maxFollowUps) {
        // This would need to be checked against existing follow-ups count
        // Implementation would require counting existing follow-ups for this diagnostic
    }

    return nextDate;
};

// Pre-save middleware
diagnosticFollowUpSchema.pre('save', function (this: IDiagnosticFollowUp) {
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

// Static methods
diagnosticFollowUpSchema.statics.findByDiagnosticRequest = function (
    diagnosticRequestId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { diagnosticRequestId };
    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: 1 });
};

diagnosticFollowUpSchema.statics.findByPatient = function (
    patientId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { patientId };
    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: -1 });
};

diagnosticFollowUpSchema.statics.findScheduled = function (
    workplaceId?: mongoose.Types.ObjectId,
    dateRange?: { start: Date; end: Date }
) {
    const query: any = { status: 'scheduled' };

    if (dateRange) {
        query.scheduledDate = {
            $gte: dateRange.start,
            $lte: dateRange.end
        };
    }

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: 1, priority: 1 });
};

diagnosticFollowUpSchema.statics.findOverdue = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = {
        status: { $in: ['scheduled', 'in_progress'] },
        scheduledDate: { $lt: new Date() }
    };

    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ scheduledDate: 1, priority: 1 });
};

diagnosticFollowUpSchema.statics.findByAssignee = function (
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

export default mongoose.model<IDiagnosticFollowUp, IDiagnosticFollowUpModel>('DiagnosticFollowUp', diagnosticFollowUpSchema);