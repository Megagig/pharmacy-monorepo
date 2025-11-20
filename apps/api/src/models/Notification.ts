import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface INotificationData {
    conversationId?: mongoose.Types.ObjectId;
    messageId?: mongoose.Types.ObjectId;
    senderId?: mongoose.Types.ObjectId;
    patientId?: mongoose.Types.ObjectId;
    interventionId?: mongoose.Types.ObjectId;
    consultationRequestId?: mongoose.Types.ObjectId;
    pharmacistId?: mongoose.Types.ObjectId;
    reminderId?: mongoose.Types.ObjectId;
    appointmentId?: mongoose.Types.ObjectId;
    followUpTaskId?: mongoose.Types.ObjectId;
    requestId?: mongoose.Types.ObjectId;
    diagnosticCaseId?: mongoose.Types.ObjectId;
    labResultId?: mongoose.Types.ObjectId;
    visitId?: mongoose.Types.ObjectId;
    vitalsId?: mongoose.Types.ObjectId;
    medicationName?: string;
    dosage?: string;
    scheduledTime?: Date;
    frequency?: string;
    times?: string[];
    priority?: string;
    reason?: string;
    waitTime?: number;
    escalationLevel?: number;
    actionUrl?: string;
    approvedQuantity?: number;
    denialReason?: string;
    patientName?: string;
    testName?: string;
    resultStatus?: string;
    metadata?: Record<string, any>;
}

export interface INotificationDeliveryChannels {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
}

export interface INotificationDeliveryStatus {
    channel: 'inApp' | 'email' | 'sms' | 'push';
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
    sentAt?: Date;
    deliveredAt?: Date;
    failureReason?: string;
    attempts: number;
    lastAttemptAt?: Date;
}

export interface INotification extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    type: 'new_message' | 'mention' | 'therapy_update' | 'clinical_alert' |
    'conversation_invite' | 'file_shared' | 'intervention_assigned' |
    'patient_query' | 'urgent_message' | 'system_notification' |
    'consultation_request' | 'consultation_accepted' | 'consultation_completed' | 'consultation_escalated' |
    'medication_reminder' | 'missed_medication' | 'reminder_setup' | 'flagged_message' |
    'appointment_reminder' | 'appointment_confirmed' | 'appointment_rescheduled' |
    'appointment_cancelled' | 'followup_task_assigned' | 'followup_task_overdue' |
    'medication_refill_due' | 'adherence_check_reminder' |
    'account_approved' | 'account_suspended' | 'account_reactivated' |
    'refill_approved' | 'refill_denied' | 'refill_assigned' |
    'lab_result_available' | 'lab_result_interpretation' | 'vitals_verified' | 'visit_summary_available';
    title: string;
    content: string;
    data: INotificationData;
    priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
    status: 'unread' | 'read' | 'dismissed' | 'archived';
    deliveryChannels: INotificationDeliveryChannels;
    deliveryStatus: INotificationDeliveryStatus[];

    // Scheduling
    scheduledFor?: Date;
    sentAt?: Date;
    readAt?: Date;
    dismissedAt?: Date;

    // Grouping and batching
    groupKey?: string; // For grouping similar notifications
    batchId?: string; // For batch processing

    // Expiration
    expiresAt?: Date;

    // Audit and tenancy
    workplaceId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    markAsRead(): void;
    markAsDismissed(): void;
    updateDeliveryStatus(channel: string, status: string, details?: any): void;
    isExpired(): boolean;
    canRetryDelivery(channel: string): boolean;
    getDeliveryStatusForChannel(channel: string): INotificationDeliveryStatus | null;
}

const notificationDataSchema = new Schema({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        index: true,
    },
    messageId: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
        index: true,
    },
    senderId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        index: true,
    },
    interventionId: {
        type: Schema.Types.ObjectId,
        ref: 'ClinicalIntervention',
        index: true,
    },
    consultationRequestId: {
        type: Schema.Types.ObjectId,
        ref: 'ConsultationRequest',
        index: true,
    },
    pharmacistId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    priority: {
        type: String,
    },
    reason: {
        type: String,
    },
    waitTime: {
        type: Number,
    },
    escalationLevel: {
        type: Number,
    },
    reminderId: {
        type: Schema.Types.ObjectId,
        ref: 'Reminder',
        index: true,
    },
    appointmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
        index: true,
    },
    followUpTaskId: {
        type: Schema.Types.ObjectId,
        ref: 'FollowUpTask',
        index: true,
    },
    requestId: {
        type: Schema.Types.ObjectId,
        index: true,
    },
    diagnosticCaseId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticCase',
        index: true,
    },
    labResultId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticCase',
        index: true,
    },
    visitId: {
        type: Schema.Types.ObjectId,
        ref: 'Visit',
        index: true,
    },
    vitalsId: {
        type: Schema.Types.ObjectId,
        index: true,
    },
    medicationName: {
        type: String,
    },
    dosage: {
        type: String,
    },
    scheduledTime: {
        type: Date,
    },
    frequency: {
        type: String,
    },
    times: {
        type: [String],
    },
    actionUrl: {
        type: String,
        validate: {
            validator: function (url: string) {
                return !url || /^\/|^https?:\/\//.test(url);
            },
            message: 'Invalid action URL format',
        },
    },
    testName: {
        type: String,
    },
    resultStatus: {
        type: String,
    },
    patientName: {
        type: String,
    },
    metadata: {
        type: Schema.Types.Mixed,
    },
}, { _id: false });

const notificationDeliveryChannelsSchema = new Schema({
    inApp: {
        type: Boolean,
        default: true,
    },
    email: {
        type: Boolean,
        default: false,
    },
    sms: {
        type: Boolean,
        default: false,
    },
    push: {
        type: Boolean,
        default: true,
    },
}, { _id: false });

const notificationDeliveryStatusSchema = new Schema({
    channel: {
        type: String,
        enum: ['inApp', 'email', 'sms', 'push'],
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'bounced'],
        default: 'pending',
        required: true,
    },
    sentAt: Date,
    deliveredAt: Date,
    failureReason: {
        type: String,
        maxlength: [500, 'Failure reason cannot exceed 500 characters'],
    },
    attempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 5, // Maximum retry attempts
    },
    lastAttemptAt: Date,
}, { _id: false });

const notificationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: [
            'new_message', 'mention', 'therapy_update', 'clinical_alert',
            'conversation_invite', 'file_shared', 'intervention_assigned',
            'patient_query', 'urgent_message', 'system_notification',
            'consultation_request', 'consultation_accepted', 'consultation_completed', 'consultation_escalated',
            'medication_reminder', 'missed_medication', 'reminder_setup', 'flagged_message',
            'appointment_reminder', 'appointment_confirmed', 'appointment_rescheduled',
            'appointment_cancelled', 'followup_task_assigned', 'followup_task_overdue',
            'medication_refill_due', 'adherence_check_reminder',
            'account_approved', 'account_suspended', 'account_reactivated',
            'refill_approved', 'refill_denied', 'refill_assigned',
            'lab_result_available', 'lab_result_interpretation', 'vitals_verified', 'visit_summary_available'
        ],
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Notification title cannot exceed 200 characters'],
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, 'Notification content cannot exceed 1000 characters'],
    },
    data: {
        type: notificationDataSchema,
        required: true,
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent', 'critical'],
        default: 'normal',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['unread', 'read', 'dismissed', 'archived'],
        default: 'unread',
        required: true,
        index: true,
    },
    deliveryChannels: {
        type: notificationDeliveryChannelsSchema,
        required: true,
    },
    deliveryStatus: [notificationDeliveryStatusSchema],

    // Scheduling
    scheduledFor: {
        type: Date,
        index: true,
        validate: {
            validator: function (date: Date) {
                return !date || date >= new Date();
            },
            message: 'Scheduled date cannot be in the past',
        },
    },
    sentAt: {
        type: Date,
        index: true,
    },
    readAt: {
        type: Date,
        index: true,
    },
    dismissedAt: {
        type: Date,
        index: true,
    },

    // Grouping and batching
    groupKey: {
        type: String,
        index: true,
        maxlength: [100, 'Group key cannot exceed 100 characters'],
    },
    batchId: {
        type: String,
        index: true,
        maxlength: [100, 'Batch ID cannot exceed 100 characters'],
    },

    // Expiration
    expiresAt: {
        type: Date,
        index: true,
        validate: {
            validator: function (date: Date) {
                return !date || date > new Date();
            },
            message: 'Expiration date must be in the future',
        },
    },

    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(notificationSchema);

// Apply tenancy guard plugin
notificationSchema.plugin(tenancyGuardPlugin);

// Indexes for optimal query performance
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, status: 1 });
notificationSchema.index({ workplaceId: 1, type: 1, priority: 1 });
notificationSchema.index({ workplaceId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ groupKey: 1, userId: 1 });
notificationSchema.index({ batchId: 1 });
notificationSchema.index({ 'data.conversationId': 1, userId: 1 });
notificationSchema.index({ 'data.patientId': 1, userId: 1 });

// Compound indexes for common queries
notificationSchema.index({ userId: 1, priority: 1, status: 1, createdAt: -1 });
notificationSchema.index({ workplaceId: 1, type: 1, scheduledFor: 1 });
notificationSchema.index({ 'deliveryStatus.channel': 1, 'deliveryStatus.status': 1 });

// TTL index for expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for delivery success rate
notificationSchema.virtual('deliverySuccessRate').get(function (this: INotification) {
    if (this.deliveryStatus.length === 0) return 0;

    const successfulDeliveries = this.deliveryStatus.filter(
        status => ['sent', 'delivered'].includes(status.status)
    ).length;

    return (successfulDeliveries / this.deliveryStatus.length) * 100;
});

// Virtual for total delivery attempts
notificationSchema.virtual('totalDeliveryAttempts').get(function (this: INotification) {
    return this.deliveryStatus.reduce((total, status) => total + status.attempts, 0);
});

// Virtual for is urgent
notificationSchema.virtual('isUrgent').get(function (this: INotification) {
    return ['urgent', 'critical'].includes(this.priority);
});

// Instance methods
notificationSchema.methods.markAsRead = function (this: INotification): void {
    if (this.status === 'unread') {
        this.status = 'read';
        this.readAt = new Date();
    }
};

notificationSchema.methods.markAsDismissed = function (this: INotification): void {
    this.status = 'dismissed';
    this.dismissedAt = new Date();
};

notificationSchema.methods.updateDeliveryStatus = function (
    this: INotification,
    channel: string,
    status: string,
    details: any = {}
): void {
    let deliveryStatus = this.deliveryStatus.find(ds => ds.channel === channel);

    if (!deliveryStatus) {
        deliveryStatus = {
            channel: channel as any,
            status: status as any,
            attempts: 0,
        };
        this.deliveryStatus.push(deliveryStatus);
    }

    deliveryStatus.status = status as any;
    deliveryStatus.lastAttemptAt = new Date();

    if (status === 'sent') {
        deliveryStatus.sentAt = new Date();
        deliveryStatus.attempts += 1;
    } else if (status === 'delivered') {
        deliveryStatus.deliveredAt = new Date();
    } else if (['failed', 'bounced'].includes(status)) {
        deliveryStatus.attempts += 1;
        deliveryStatus.failureReason = details.reason || 'Unknown error';
    }
};

notificationSchema.methods.isExpired = function (this: INotification): boolean {
    return !!(this.expiresAt && this.expiresAt <= new Date());
};

notificationSchema.methods.canRetryDelivery = function (
    this: INotification,
    channel: string
): boolean {
    const deliveryStatus = this.getDeliveryStatusForChannel(channel);

    if (!deliveryStatus) return true;

    // Don't retry if already delivered or bounced
    if (['delivered', 'bounced'].includes(deliveryStatus.status)) {
        return false;
    }

    // Don't retry if max attempts reached
    if (deliveryStatus.attempts >= 5) {
        return false;
    }

    // Don't retry if notification is expired
    if (this.isExpired()) {
        return false;
    }

    return true;
};

notificationSchema.methods.getDeliveryStatusForChannel = function (
    this: INotification,
    channel: string
): INotificationDeliveryStatus | null {
    return this.deliveryStatus.find(ds => ds.channel === channel) || null;
};

// Pre-save middleware for validation and defaults
notificationSchema.pre('save', function (this: INotification) {
    // Set default expiration for certain notification types
    if (!this.expiresAt) {
        const now = new Date();
        switch (this.type) {
            case 'system_notification':
                this.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
                break;
            case 'clinical_alert':
            case 'urgent_message':
                this.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
                break;
            default:
                this.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
        }
    }

    // Initialize delivery status for enabled channels
    if (this.isNew) {
        const enabledChannels: string[] = [];

        if (this.deliveryChannels.inApp) enabledChannels.push('inApp');
        if (this.deliveryChannels.email) enabledChannels.push('email');
        if (this.deliveryChannels.sms) enabledChannels.push('sms');
        if (this.deliveryChannels.push) enabledChannels.push('push');

        this.deliveryStatus = enabledChannels.map(channel => ({
            channel: channel as any,
            status: 'pending' as any,
            attempts: 0,
        }));
    }

    // Set sentAt if not scheduled
    if (!this.scheduledFor && !this.sentAt) {
        this.sentAt = new Date();
    }

    // Generate group key for similar notifications
    if (!this.groupKey) {
        this.groupKey = `${this.type}_${this.data.conversationId || this.data.patientId || 'general'}`;
    }
});

// Static methods
notificationSchema.statics.findUnreadByUser = function (
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    options: any = {}
) {
    const { limit = 50, type, priority } = options;

    const query: any = {
        userId,
        workplaceId,
        status: 'unread',
    };

    if (type) {
        query.type = type;
    }

    if (priority) {
        query.priority = priority;
    }

    return this.find(query)
        .populate('data.senderId', 'firstName lastName role')
        .populate('data.conversationId', 'title type')
        .populate('data.patientId', 'firstName lastName mrn')
        .sort({ priority: -1, createdAt: -1 })
        .limit(limit);
};

notificationSchema.statics.findScheduledForDelivery = function (date: Date = new Date()) {
    return this.find({
        scheduledFor: { $lte: date },
        status: 'unread',
        'deliveryStatus.status': { $in: ['pending', 'failed'] },
    })
        .populate('userId', 'notificationPreferences email phone')
        .sort({ priority: -1, scheduledFor: 1 });
};

notificationSchema.statics.markExpiredAsArchived = function () {
    return this.updateMany(
        {
            expiresAt: { $lte: new Date() },
            status: { $ne: 'archived' },
        },
        {
            $set: {
                status: 'archived',
                updatedAt: new Date(),
            },
        }
    );
};

notificationSchema.statics.getUnreadCountByUser = function (
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
) {
    return this.countDocuments({
        userId,
        workplaceId,
        status: 'unread',
    });
};

notificationSchema.statics.getNotificationStats = function (
    workplaceId: mongoose.Types.ObjectId,
    dateRange: { start: Date; end: Date }
) {
    return this.aggregate([
        {
            $match: {
                workplaceId,
                createdAt: {
                    $gte: dateRange.start,
                    $lte: dateRange.end,
                },
            },
        },
        {
            $group: {
                _id: {
                    type: '$type',
                    status: '$status',
                    priority: '$priority',
                },
                count: { $sum: 1 },
                avgDeliveryTime: {
                    $avg: {
                        $subtract: ['$readAt', '$sentAt'],
                    },
                },
            },
        },
        {
            $sort: { '_id.priority': -1, count: -1 },
        },
    ]);
};

export default mongoose.model<INotification>('Notification', notificationSchema);