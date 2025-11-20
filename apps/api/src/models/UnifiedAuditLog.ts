import mongoose, { Document, Schema } from 'mongoose';

/**
 * Unified Audit Log Model
 * Centralized audit trail capturing ALL activities across the application
 * Visible to super admins with comprehensive user and entity details
 */

export interface IUserDetails {
    userId: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    workplaceRole?: string;
    avatarUrl?: string;
}

export interface IWorkplaceDetails {
    workplaceId: mongoose.Types.ObjectId;
    name: string;
    type?: string;
}

export interface ITargetEntityDetails {
    entityType: string;
    entityId: mongoose.Types.ObjectId;
    entityName: string;
    additionalInfo?: Record<string, any>;
}

export interface IChangeDetails {
    field: string;
    oldValue: any;
    newValue: any;
}

export interface IUnifiedAuditLog extends Document {
    // User Information (Populated for readability)
    userId: mongoose.Types.ObjectId;
    userDetails: IUserDetails;

    // Workplace Context
    workplaceId?: mongoose.Types.ObjectId;
    workplaceDetails?: IWorkplaceDetails;

    // Activity Classification
    activityType:
    | 'authentication'
    | 'authorization'
    | 'user_management'
    | 'patient_management'
    | 'medication_management'
    | 'mtr_session'
    | 'clinical_intervention'
    | 'communication'
    | 'workspace_management'
    | 'security_event'
    | 'system_configuration'
    | 'file_operation'
    | 'report_generation'
    | 'audit_export'
    | 'diagnostic_ai'
    | 'subscription_management'
    | 'payment_transaction'
    | 'compliance_event'
    | 'data_export'
    | 'data_import'
    | 'other';

    action: string; // e.g., "USER_LOGIN", "PATIENT_CREATED", "MEDICATION_PRESCRIBED"
    description: string; // Human-readable description

    // Target Entity (What was affected)
    targetEntity?: ITargetEntityDetails;

    // Changes Made
    changes?: IChangeDetails[];

    // Additional Context
    metadata?: Record<string, any>;

    // Request Information
    ipAddress?: string;
    userAgent?: string;
    requestMethod?: string;
    requestPath?: string;
    responseStatus?: number;

    // Risk & Compliance
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    complianceCategory?: 'HIPAA' | 'SOX' | 'GDPR' | 'PCI_DSS' | 'GENERAL';

    // Event Status
    success: boolean;
    errorMessage?: string;
    errorStack?: string;

    // Timestamps
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;

    // Review & Flagging
    flagged: boolean;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    reviewNotes?: string;

    // Session Tracking
    sessionId?: string;

    // Geographic Information
    location?: {
        country?: string;
        region?: string;
        city?: string;
    };

    // Methods
    getFormattedDescription(): string;
    getRiskBadgeColor(): string;
}

const unifiedAuditLogSchema = new Schema<IUnifiedAuditLog>(
    {
        // User Information
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            // Not required here - will be populated by pre-save hook for auth routes
            index: true,
        },
        userDetails: {
            userId: {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
            firstName: {
                type: String,
            },
            lastName: {
                type: String,
            },
            email: {
                type: String,
            },
            role: {
                type: String,
            },
            workplaceRole: String,
            avatarUrl: String,
        },

        // Workplace Context
        workplaceId: {
            type: Schema.Types.ObjectId,
            ref: 'Workplace',
            index: true,
        },
        workplaceDetails: {
            workplaceId: {
                type: Schema.Types.ObjectId,
                ref: 'Workplace',
            },
            name: String,
            type: String,
        },

        // Activity Classification
        activityType: {
            type: String,
            required: [true, 'Activity type is required'],
            enum: [
                'authentication',
                'authorization',
                'user_management',
                'patient_management',
                'medication_management',
                'mtr_session',
                'clinical_intervention',
                'communication',
                'workspace_management',
                'security_event',
                'system_configuration',
                'file_operation',
                'report_generation',
                'audit_export',
                'diagnostic_ai',
                'subscription_management',
                'payment_transaction',
                'compliance_event',
                'data_export',
                'data_import',
                'other',
            ],
            index: true,
        },

        action: {
            type: String,
            required: [true, 'Action is required'],
            index: true,
        },

        description: {
            type: String,
            required: [true, 'Description is required'],
        },

        // Target Entity
        targetEntity: {
            entityType: {
                type: String,
                index: true,
            },
            entityId: {
                type: Schema.Types.ObjectId,
                index: true,
            },
            entityName: String,
            additionalInfo: Schema.Types.Mixed,
        },

        // Changes Made
        changes: [
            {
                field: {
                    type: String,
                    required: true,
                },
                oldValue: Schema.Types.Mixed,
                newValue: Schema.Types.Mixed,
            },
        ],

        // Additional Context
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },

        // Request Information
        ipAddress: {
            type: String,
            index: true,
        },
        userAgent: String,
        requestMethod: String,
        requestPath: String,
        responseStatus: Number,

        // Risk & Compliance
        riskLevel: {
            type: String,
            required: true,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'low',
            index: true,
        },
        complianceCategory: {
            type: String,
            enum: ['HIPAA', 'SOX', 'GDPR', 'PCI_DSS', 'GENERAL'],
            index: true,
        },

        // Event Status
        success: {
            type: Boolean,
            required: true,
            default: true,
            index: true,
        },
        errorMessage: String,
        errorStack: String,

        // Timestamps
        timestamp: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },

        // Review & Flagging
        flagged: {
            type: Boolean,
            default: false,
            index: true,
        },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedAt: Date,
        reviewNotes: String,

        // Session Tracking
        sessionId: {
            type: String,
            index: true,
        },

        // Geographic Information
        location: {
            country: String,
            region: String,
            city: String,
        },
    },
    {
        timestamps: true,
        collection: 'unified_audit_logs',
    }
);

// Compound Indexes for Performance
unifiedAuditLogSchema.index({ timestamp: -1 }); // Recent activities
unifiedAuditLogSchema.index({ userId: 1, timestamp: -1 }); // User activities
unifiedAuditLogSchema.index({ workplaceId: 1, timestamp: -1 }); // Workplace activities
unifiedAuditLogSchema.index({ activityType: 1, timestamp: -1 }); // Activity type filtering
unifiedAuditLogSchema.index({ riskLevel: 1, timestamp: -1 }); // Risk monitoring
unifiedAuditLogSchema.index({ success: 1, timestamp: -1 }); // Failed activities
unifiedAuditLogSchema.index({ flagged: 1, timestamp: -1 }); // Flagged activities
unifiedAuditLogSchema.index({ 'targetEntity.entityType': 1, 'targetEntity.entityId': 1 }); // Entity tracking
unifiedAuditLogSchema.index({ action: 1, timestamp: -1 }); // Action filtering

// Text index for search
unifiedAuditLogSchema.index({
    description: 'text',
    action: 'text',
    'userDetails.firstName': 'text',
    'userDetails.lastName': 'text',
    'userDetails.email': 'text',
});

// Instance Methods
unifiedAuditLogSchema.methods.getFormattedDescription = function (): string {
    return this.description;
};

unifiedAuditLogSchema.methods.getRiskBadgeColor = function (): string {
    const colors = {
        low: 'success',
        medium: 'warning',
        high: 'error',
        critical: 'error',
    };
    return colors[this.riskLevel] || 'default';
};

// Static Methods
unifiedAuditLogSchema.statics.getActivityStats = async function (
    workplaceId?: mongoose.Types.ObjectId,
    startDate?: Date,
    endDate?: Date
) {
    const matchStage: any = {};

    if (workplaceId) {
        matchStage.workplaceId = workplaceId;
    }

    if (startDate && endDate) {
        matchStage.timestamp = { $gte: startDate, $lte: endDate };
    }

    return this.aggregate([
        { $match: matchStage },
        {
            $facet: {
                totalActivities: [{ $count: 'count' }],
                activityByType: [
                    {
                        $group: {
                            _id: '$activityType',
                            count: { $sum: 1 },
                        },
                    },
                ],
                activityByRisk: [
                    {
                        $group: {
                            _id: '$riskLevel',
                            count: { $sum: 1 },
                        },
                    },
                ],
                failedActivities: [
                    { $match: { success: false } },
                    { $count: 'count' },
                ],
                flaggedActivities: [
                    { $match: { flagged: true } },
                    { $count: 'count' },
                ],
                topUsers: [
                    {
                        $group: {
                            _id: '$userId',
                            count: { $sum: 1 },
                            userDetails: { $first: '$userDetails' },
                        },
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 },
                ],
            },
        },
    ]);
};

// Pre-save hook to ensure userDetails and workplaceDetails are populated
unifiedAuditLogSchema.pre('save', async function (next) {
    if (this.isNew) {
        // Ensure userDetails are populated if userId exists
        if (this.userId && (!this.userDetails || !this.userDetails.email)) {
            const User = mongoose.model('User');
            const user = await User.findById(this.userId).select(
                'firstName lastName email role workplaceRole profilePicture'
            );

            if (user) {
                this.userDetails = {
                    userId: this.userId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role,
                    workplaceRole: user.workplaceRole,
                    avatarUrl: user.profilePicture,
                };
            }
        }

        // Ensure workplaceDetails are populated if workplaceId exists
        if (this.workplaceId && (!this.workplaceDetails || !this.workplaceDetails.name)) {
            const Workplace = mongoose.model('Workplace');
            const workplace = await Workplace.findById(this.workplaceId).select('name type');

            if (workplace) {
                this.workplaceDetails = {
                    workplaceId: this.workplaceId,
                    name: workplace.name,
                    type: workplace.type,
                };
            }
        }
    }

    next();
});

const UnifiedAuditLog = mongoose.model<IUnifiedAuditLog>(
    'UnifiedAuditLog',
    unifiedAuditLogSchema
);

export default UnifiedAuditLog;
