import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin } from '../utils/tenancyGuard';

export interface ICommunicationAuditLogDetails {
    conversationId?: mongoose.Types.ObjectId;
    messageId?: mongoose.Types.ObjectId;
    patientId?: mongoose.Types.ObjectId;
    participantIds?: mongoose.Types.ObjectId[];
    fileId?: string;
    fileName?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    metadata?: Record<string, any>;
}

export interface ICommunicationAuditLog extends Document {
    _id: mongoose.Types.ObjectId;
    action: 'message_sent' | 'message_read' | 'message_edited' | 'message_deleted' |
    'conversation_created' | 'conversation_updated' | 'conversation_archived' |
    'participant_added' | 'participant_removed' | 'participant_left' |
    'file_uploaded' | 'file_downloaded' | 'file_deleted' |
    'notification_sent' | 'notification_read' | 'encryption_key_rotated' |
    'conversation_exported' | 'bulk_message_delete' | 'conversation_search' |
    'message_search' | 'clinical_context_updated' | 'priority_changed';

    userId: mongoose.Types.ObjectId;
    targetId: mongoose.Types.ObjectId; // conversation, message, or user ID
    targetType: 'conversation' | 'message' | 'user' | 'file' | 'notification';

    details: ICommunicationAuditLogDetails;

    // Request context
    ipAddress: string;
    userAgent: string;
    sessionId?: string;

    // Risk and compliance
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    complianceCategory: 'communication_security' | 'data_access' | 'patient_privacy' |
    'message_integrity' | 'file_security' | 'audit_trail' |
    'encryption_compliance' | 'notification_delivery';

    // Tenancy
    workplaceId: mongoose.Types.ObjectId;

    // Timing
    timestamp: Date;

    // Additional metadata
    success: boolean;
    errorMessage?: string;
    duration?: number; // Operation duration in milliseconds

    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    setRiskLevel(): void;
    isHighRisk(): boolean;
    getFormattedDetails(): string;
}

export interface ICommunicationAuditLogModel extends mongoose.Model<ICommunicationAuditLog> {
    logAction(
        action: string,
        userId: mongoose.Types.ObjectId,
        targetId: mongoose.Types.ObjectId,
        targetType: string,
        details: ICommunicationAuditLogDetails,
        context: {
            workplaceId: mongoose.Types.ObjectId;
            ipAddress: string;
            userAgent: string;
            sessionId?: string;
            success?: boolean;
            errorMessage?: string;
            duration?: number;
        }
    ): Promise<ICommunicationAuditLog>;
    
    findByConversation(
        conversationId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        options?: any
    ): Promise<ICommunicationAuditLog[]>;
    
    findHighRiskActivities(
        workplaceId: mongoose.Types.ObjectId,
        timeRange: { start: Date; end: Date }
    ): Promise<ICommunicationAuditLog[]>;
    
    getComplianceReport(
        workplaceId: mongoose.Types.ObjectId,
        dateRange: { start: Date; end: Date }
    ): Promise<any[]>;
    
    getUserActivitySummary(
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        dateRange: { start: Date; end: Date }
    ): Promise<any[]>;
}

const communicationAuditLogDetailsSchema = new Schema({
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
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        index: true,
    },
    participantIds: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],
    fileId: {
        type: String,
        index: true,
    },
    fileName: {
        type: String,
        maxlength: [255, 'File name cannot exceed 255 characters'],
    },
    oldValues: {
        type: Schema.Types.Mixed,
    },
    newValues: {
        type: Schema.Types.Mixed,
    },
    metadata: {
        type: Schema.Types.Mixed,
    },
}, { _id: false });

const communicationAuditLogSchema = new Schema({
    action: {
        type: String,
        enum: [
            'message_sent', 'message_read', 'message_edited', 'message_deleted',
            'conversation_created', 'conversation_updated', 'conversation_archived',
            'participant_added', 'participant_removed', 'participant_left',
            'file_uploaded', 'file_downloaded', 'file_deleted',
            'notification_sent', 'notification_read', 'encryption_key_rotated',
            'conversation_exported', 'bulk_message_delete', 'conversation_search',
            'message_search', 'clinical_context_updated', 'priority_changed'
        ],
        required: true,
        index: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    targetId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    targetType: {
        type: String,
        enum: ['conversation', 'message', 'user', 'file', 'notification'],
        required: true,
        index: true,
    },
    details: {
        type: communicationAuditLogDetailsSchema,
        required: true,
    },

    // Request context
    ipAddress: {
        type: String,
        required: true,
        validate: {
            validator: function (ip: string) {
                // Basic IP validation (IPv4 and IPv6)
                const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip === '127.0.0.1';
            },
            message: 'Invalid IP address format',
        },
    },
    userAgent: {
        type: String,
        required: true,
        maxlength: [1000, 'User agent cannot exceed 1000 characters'],
    },
    sessionId: {
        type: String,
        index: true,
        maxlength: [100, 'Session ID cannot exceed 100 characters'],
    },

    // Risk and compliance
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        index: true,
        default: 'low',
    },
    complianceCategory: {
        type: String,
        enum: [
            'communication_security', 'data_access', 'patient_privacy',
            'message_integrity', 'file_security', 'audit_trail',
            'encryption_compliance', 'notification_delivery'
        ],
        required: true,
        index: true,
        default: 'audit_trail',
    },

    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true,
    },

    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: -1, // Descending index for recent logs
    },

    success: {
        type: Boolean,
        default: true,
        required: true,
        index: true,
    },
    errorMessage: {
        type: String,
        maxlength: [1000, 'Error message cannot exceed 1000 characters'],
    },
    duration: {
        type: Number,
        min: [0, 'Duration cannot be negative'],
        max: [300000, 'Duration cannot exceed 5 minutes'], // 5 minutes max
    },
}, {
    timestamps: true,
    collection: 'communication_audit_logs',
});

// Apply tenancy guard plugin
communicationAuditLogSchema.plugin(tenancyGuardPlugin);

// Indexes for optimal query performance
communicationAuditLogSchema.index({ workplaceId: 1, timestamp: -1 });
communicationAuditLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
communicationAuditLogSchema.index({ targetId: 1, targetType: 1, timestamp: -1 });
communicationAuditLogSchema.index({ action: 1, timestamp: -1 });
communicationAuditLogSchema.index({ riskLevel: 1, timestamp: -1 });
communicationAuditLogSchema.index({ complianceCategory: 1, timestamp: -1 });
communicationAuditLogSchema.index({ success: 1, timestamp: -1 });
communicationAuditLogSchema.index({ sessionId: 1, timestamp: -1 });

// Compound indexes for common queries
communicationAuditLogSchema.index({ workplaceId: 1, action: 1, success: 1, timestamp: -1 });
communicationAuditLogSchema.index({ userId: 1, riskLevel: 1, timestamp: -1 });
communicationAuditLogSchema.index({ workplaceId: 1, complianceCategory: 1, timestamp: -1 });
communicationAuditLogSchema.index({ 'details.conversationId': 1, timestamp: -1 });
communicationAuditLogSchema.index({ 'details.patientId': 1, timestamp: -1 });

// TTL index for automatic cleanup (keep logs for 7 years for compliance)
communicationAuditLogSchema.index({ timestamp: 1 }, {
    expireAfterSeconds: 7 * 365 * 24 * 60 * 60 // 7 years
});

// Virtual for formatted timestamp
communicationAuditLogSchema.virtual('formattedTimestamp').get(function (this: ICommunicationAuditLog) {
    return this.timestamp.toISOString();
});

// Virtual for is recent (within last 24 hours)
communicationAuditLogSchema.virtual('isRecent').get(function (this: ICommunicationAuditLog) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.timestamp > oneDayAgo;
});

// Instance methods
communicationAuditLogSchema.methods.setRiskLevel = function (this: ICommunicationAuditLog): void {
    // Auto-determine risk level based on action and context
    const highRiskActions = [
        'message_deleted', 'conversation_archived', 'participant_removed',
        'file_deleted', 'bulk_message_delete', 'encryption_key_rotated'
    ];

    const mediumRiskActions = [
        'message_edited', 'conversation_updated', 'participant_added',
        'file_uploaded', 'clinical_context_updated', 'priority_changed'
    ];

    const criticalRiskActions = [
        'conversation_exported'
    ];

    if (criticalRiskActions.includes(this.action)) {
        this.riskLevel = 'critical';
    } else if (highRiskActions.includes(this.action)) {
        this.riskLevel = 'high';
    } else if (mediumRiskActions.includes(this.action)) {
        this.riskLevel = 'medium';
    } else {
        this.riskLevel = 'low';
    }

    // Increase risk level if operation failed
    if (!this.success && this.riskLevel === 'low') {
        this.riskLevel = 'medium';
    }

    // Increase risk level for patient-related actions
    if (this.details.patientId && this.riskLevel === 'low') {
        this.riskLevel = 'medium';
    }
};

communicationAuditLogSchema.methods.isHighRisk = function (this: ICommunicationAuditLog): boolean {
    return ['high', 'critical'].includes(this.riskLevel);
};

communicationAuditLogSchema.methods.getFormattedDetails = function (this: ICommunicationAuditLog): string {
    const details = [];

    if (this.details.conversationId) {
        details.push(`Conversation: ${this.details.conversationId}`);
    }

    if (this.details.messageId) {
        details.push(`Message: ${this.details.messageId}`);
    }

    if (this.details.patientId) {
        details.push(`Patient: ${this.details.patientId}`);
    }

    if (this.details.fileName) {
        details.push(`File: ${this.details.fileName}`);
    }

    if (this.details.participantIds && this.details.participantIds.length > 0) {
        details.push(`Participants: ${this.details.participantIds.length}`);
    }

    if (this.errorMessage) {
        details.push(`Error: ${this.errorMessage}`);
    }

    return details.join(', ');
};

// Ensure defaults before validation runs
communicationAuditLogSchema.pre('validate', function (this: ICommunicationAuditLog) {
    // Auto-set risk level if not provided
    if (!this.riskLevel) {
        this.setRiskLevel();
    }

    // Set compliance category based on action if not provided
    if (!this.complianceCategory) {
        const actionToCategoryMap: Record<string, 'communication_security' | 'data_access' | 'patient_privacy' | 'message_integrity' | 'file_security' | 'audit_trail' | 'encryption_compliance' | 'notification_delivery'> = {
            'message_sent': 'communication_security',
            'message_read': 'data_access',
            'message_edited': 'message_integrity',
            'message_deleted': 'message_integrity',
            'conversation_created': 'communication_security',
            'conversation_updated': 'communication_security',
            'conversation_archived': 'audit_trail',
            'participant_added': 'patient_privacy',
            'participant_removed': 'patient_privacy',
            'participant_left': 'audit_trail',
            'file_uploaded': 'file_security',
            'file_downloaded': 'file_security',
            'file_deleted': 'file_security',
            'notification_sent': 'notification_delivery',
            'notification_read': 'notification_delivery',
            'encryption_key_rotated': 'encryption_compliance',
            'conversation_exported': 'data_access',
            'bulk_message_delete': 'message_integrity',
            'conversation_search': 'data_access',
            'message_search': 'data_access',
            'clinical_context_updated': 'patient_privacy',
            'priority_changed': 'communication_security',
        };

        this.complianceCategory = actionToCategoryMap[this.action] || 'audit_trail';
    }
});

// Static methods
communicationAuditLogSchema.statics.logAction = async function (
    action: string,
    userId: mongoose.Types.ObjectId,
    targetId: mongoose.Types.ObjectId,
    targetType: string,
    details: ICommunicationAuditLogDetails,
    context: {
        workplaceId: mongoose.Types.ObjectId;
        ipAddress: string;
        userAgent: string;
        sessionId?: string;
        success?: boolean;
        errorMessage?: string;
        duration?: number;
    }
) {
    const auditLog = new this({
        action,
        userId,
        targetId,
        targetType,
        details,
        workplaceId: context.workplaceId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        success: context.success !== false,
        errorMessage: context.errorMessage,
        duration: context.duration,
    });

    return await auditLog.save();
};

communicationAuditLogSchema.statics.findByConversation = function (
    conversationId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    options: any = {}
) {
    const { limit = 100, startDate, endDate } = options;

    const query: any = {
        workplaceId,
        'details.conversationId': conversationId,
    };

    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
    }

    return this.find(query)
        .populate('userId', 'firstName lastName role')
        .sort({ timestamp: -1 })
        .limit(limit);
};

communicationAuditLogSchema.statics.findHighRiskActivities = function (
    workplaceId: mongoose.Types.ObjectId,
    timeRange: { start: Date; end: Date }
) {
    return this.find({
        workplaceId,
        riskLevel: { $in: ['high', 'critical'] },
        timestamp: {
            $gte: timeRange.start,
            $lte: timeRange.end,
        },
    })
        .populate('userId', 'firstName lastName role')
        .sort({ timestamp: -1 });
};

communicationAuditLogSchema.statics.getComplianceReport = function (
    workplaceId: mongoose.Types.ObjectId,
    dateRange: { start: Date; end: Date }
) {
    return this.aggregate([
        {
            $match: {
                workplaceId,
                timestamp: {
                    $gte: dateRange.start,
                    $lte: dateRange.end,
                },
            },
        },
        {
            $group: {
                _id: {
                    complianceCategory: '$complianceCategory',
                    riskLevel: '$riskLevel',
                    success: '$success',
                },
                count: { $sum: 1 },
                avgDuration: { $avg: '$duration' },
                actions: { $addToSet: '$action' },
            },
        },
        {
            $sort: { '_id.riskLevel': -1, count: -1 },
        },
    ]);
};

communicationAuditLogSchema.statics.getUserActivitySummary = function (
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    dateRange: { start: Date; end: Date }
) {
    return this.aggregate([
        {
            $match: {
                userId,
                workplaceId,
                timestamp: {
                    $gte: dateRange.start,
                    $lte: dateRange.end,
                },
            },
        },
        {
            $group: {
                _id: '$action',
                count: { $sum: 1 },
                lastActivity: { $max: '$timestamp' },
                successRate: {
                    $avg: { $cond: ['$success', 1, 0] },
                },
            },
        },
        {
            $sort: { count: -1 },
        },
    ]);
};

export default mongoose.model<ICommunicationAuditLog, ICommunicationAuditLogModel>('CommunicationAuditLog', communicationAuditLogSchema);