import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReportAuditLog extends Document {
    _id: string;
    eventType: string;
    reportType?: string;
    reportId?: mongoose.Types.ObjectId;
    templateId?: mongoose.Types.ObjectId;
    scheduleId?: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    eventDetails: {
        action: string;
        resource: string;
        resourceId?: string;
        filters?: Record<string, any>;
        exportFormat?: string;
        recipients?: string[];
        duration?: number; // in milliseconds
        recordCount?: number;
        fileSize?: number; // in bytes
        success: boolean;
        errorMessage?: string;
        metadata?: Record<string, any>;
    };
    compliance: {
        dataAccessed: string[]; // Types of data accessed
        sensitiveData: boolean;
        retentionPeriod?: number; // in days
        anonymized: boolean;
        encryptionUsed: boolean;
        accessJustification?: string;
    };
    performance: {
        queryTime?: number; // in milliseconds
        renderTime?: number; // in milliseconds
        exportTime?: number; // in milliseconds
        memoryUsage?: number; // in MB
        cpuUsage?: number; // percentage
    };
    geolocation?: {
        country?: string;
        region?: string;
        city?: string;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
    };
    deviceInfo?: {
        deviceType: 'desktop' | 'mobile' | 'tablet' | 'server';
        operatingSystem?: string;
        browser?: string;
        screenResolution?: string;
    };
    riskScore: number; // 0-100, calculated risk score
    flagged: boolean;
    flagReason?: string;
    reviewStatus?: 'pending' | 'reviewed' | 'approved' | 'rejected';
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    reviewNotes?: string;
    relatedEvents?: mongoose.Types.ObjectId[]; // Related audit log entries
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface IReportAuditLogModel extends Model<IReportAuditLog> {
    logEvent(eventData: Partial<IReportAuditLog>): Promise<IReportAuditLog>;
    getSecuritySummary(workplaceId: string, days?: number): Promise<any>;
    getUserActivity(userId: string, workplaceId: string, days?: number): Promise<IReportAuditLog[]>;
    getComplianceReport(workplaceId: string, startDate: Date, endDate: Date): Promise<any>;
}

const ReportAuditLogSchema = new Schema<IReportAuditLog>({
    eventType: {
        type: String,
        required: true,
        enum: [
            'REPORT_VIEWED',
            'REPORT_GENERATED',
            'REPORT_EXPORTED',
            'REPORT_SCHEDULED',
            'REPORT_SHARED',
            'TEMPLATE_CREATED',
            'TEMPLATE_MODIFIED',
            'TEMPLATE_DELETED',
            'TEMPLATE_CLONED',
            'SCHEDULE_CREATED',
            'SCHEDULE_MODIFIED',
            'SCHEDULE_DELETED',
            'SCHEDULE_EXECUTED',
            'SCHEDULE_PAUSED',
            'SCHEDULE_RESUMED',
            'DATA_ACCESS',
            'FILTER_APPLIED',
            'PERMISSION_CHANGED',
            'BULK_EXPORT',
            'API_ACCESS',
            'UNAUTHORIZED_ACCESS',
            'SYSTEM_ERROR'
        ],
        index: true
    },
    reportType: {
        type: String,
        enum: [
            'patient-outcomes',
            'pharmacist-interventions',
            'therapy-effectiveness',
            'quality-improvement',
            'regulatory-compliance',
            'cost-effectiveness',
            'trend-forecasting',
            'operational-efficiency',
            'medication-inventory',
            'patient-demographics',
            'adverse-events',
            'custom'
        ],
        index: true
    },
    reportId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReportTemplate',
        index: true
    },
    scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReportSchedule',
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    workplaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        index: true
    },
    ipAddress: {
        type: String,
        index: true
    },
    userAgent: {
        type: String
    },
    eventDetails: {
        action: {
            type: String,
            required: true,
            enum: [
                'CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'SHARE',
                'SCHEDULE', 'EXECUTE', 'PAUSE', 'RESUME', 'CLONE', 'ACCESS'
            ]
        },
        resource: {
            type: String,
            required: true,
            enum: [
                'REPORT', 'TEMPLATE', 'SCHEDULE', 'DATA', 'FILTER',
                'PERMISSION', 'EXPORT', 'API', 'SYSTEM'
            ]
        },
        resourceId: { type: String },
        filters: { type: Schema.Types.Mixed },
        exportFormat: {
            type: String,
            enum: ['pdf', 'csv', 'excel', 'json']
        },
        recipients: [{ type: String }],
        duration: { type: Number, min: 0 },
        recordCount: { type: Number, min: 0 },
        fileSize: { type: Number, min: 0 },
        success: { type: Boolean, required: true, index: true },
        errorMessage: { type: String },
        metadata: { type: Schema.Types.Mixed }
    },
    compliance: {
        dataAccessed: [{
            type: String,
            enum: [
                'PATIENT_DATA', 'FINANCIAL_DATA', 'CLINICAL_DATA',
                'PHARMACIST_DATA', 'MEDICATION_DATA', 'AUDIT_DATA',
                'DEMOGRAPHIC_DATA', 'PERFORMANCE_DATA', 'SYSTEM_DATA'
            ]
        }],
        sensitiveData: { type: Boolean, required: true, index: true },
        retentionPeriod: { type: Number, min: 1 }, // in days
        anonymized: { type: Boolean, required: true },
        encryptionUsed: { type: Boolean, required: true },
        accessJustification: { type: String, maxlength: 500 }
    },
    performance: {
        queryTime: { type: Number, min: 0 },
        renderTime: { type: Number, min: 0 },
        exportTime: { type: Number, min: 0 },
        memoryUsage: { type: Number, min: 0 },
        cpuUsage: { type: Number, min: 0, max: 100 }
    },
    geolocation: {
        country: { type: String },
        region: { type: String },
        city: { type: String },
        coordinates: {
            latitude: { type: Number, min: -90, max: 90 },
            longitude: { type: Number, min: -180, max: 180 }
        }
    },
    deviceInfo: {
        deviceType: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'server'],
            default: 'desktop'
        },
        operatingSystem: { type: String },
        browser: { type: String },
        screenResolution: { type: String }
    },
    riskScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0,
        index: true
    },
    flagged: {
        type: Boolean,
        default: false,
        index: true
    },
    flagReason: {
        type: String,
        enum: [
            'HIGH_RISK_SCORE',
            'UNUSUAL_ACCESS_PATTERN',
            'BULK_DATA_ACCESS',
            'OFF_HOURS_ACCESS',
            'GEOGRAPHIC_ANOMALY',
            'MULTIPLE_FAILED_ATTEMPTS',
            'SENSITIVE_DATA_ACCESS',
            'UNAUTHORIZED_EXPORT',
            'SUSPICIOUS_ACTIVITY',
            'POLICY_VIOLATION'
        ]
    },
    reviewStatus: {
        type: String,
        enum: ['pending', 'reviewed', 'approved', 'rejected'],
        index: true
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, maxlength: 1000 },
    relatedEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReportAuditLog'
    }],
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }]
}, {
    timestamps: true,
    collection: 'reportauditlogs'
});

// Indexes for performance optimization
ReportAuditLogSchema.index({ workplaceId: 1, createdAt: -1 });
ReportAuditLogSchema.index({ userId: 1, createdAt: -1 });
ReportAuditLogSchema.index({ eventType: 1, createdAt: -1 });
ReportAuditLogSchema.index({ reportType: 1, createdAt: -1 });
ReportAuditLogSchema.index({ 'eventDetails.success': 1, createdAt: -1 });
ReportAuditLogSchema.index({ 'compliance.sensitiveData': 1, createdAt: -1 });
ReportAuditLogSchema.index({ riskScore: -1, createdAt: -1 });
ReportAuditLogSchema.index({ flagged: 1, reviewStatus: 1 });
ReportAuditLogSchema.index({ ipAddress: 1, createdAt: -1 });
ReportAuditLogSchema.index({ sessionId: 1, createdAt: -1 });

// Compound indexes for common queries
ReportAuditLogSchema.index({
    workplaceId: 1,
    eventType: 1,
    createdAt: -1
});

ReportAuditLogSchema.index({
    workplaceId: 1,
    userId: 1,
    'eventDetails.success': 1,
    createdAt: -1
});

ReportAuditLogSchema.index({
    workplaceId: 1,
    'compliance.sensitiveData': 1,
    riskScore: -1,
    createdAt: -1
});

// Text search index
ReportAuditLogSchema.index({
    'eventDetails.errorMessage': 'text',
    'compliance.accessJustification': 'text',
    'reviewNotes': 'text',
    'tags': 'text'
});

// TTL index for automatic cleanup (keep logs for 7 years by default)
ReportAuditLogSchema.index({
    createdAt: 1
}, {
    expireAfterSeconds: 7 * 365 * 24 * 60 * 60 // 7 years
});

// Virtual for risk level
ReportAuditLogSchema.virtual('riskLevel').get(function () {
    if (this.riskScore >= 80) return 'critical';
    if (this.riskScore >= 60) return 'high';
    if (this.riskScore >= 40) return 'medium';
    if (this.riskScore >= 20) return 'low';
    return 'minimal';
});

// Virtual for event summary
ReportAuditLogSchema.virtual('eventSummary').get(function () {
    return `${this.eventDetails.action} ${this.eventDetails.resource}${this.eventDetails.resourceId ? ` (${this.eventDetails.resourceId})` : ''}`;
});

// Pre-save middleware for risk calculation
ReportAuditLogSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('eventDetails') || this.isModified('compliance')) {
        this.riskScore = (this as any).calculateRiskScore();

        // Auto-flag high-risk events
        if (this.riskScore >= 70) {
            this.flagged = true;
            if (!this.flagReason) {
                this.flagReason = 'HIGH_RISK_SCORE';
            }
        }
    }

    next();
});

// Instance methods
ReportAuditLogSchema.methods.calculateRiskScore = function (): number {
    let score = 0;

    // Base score for event type
    const eventTypeScores: Record<string, number> = {
        'UNAUTHORIZED_ACCESS': 50,
        'BULK_EXPORT': 30,
        'DATA_ACCESS': 20,
        'REPORT_EXPORTED': 15,
        'PERMISSION_CHANGED': 25,
        'TEMPLATE_DELETED': 20,
        'SCHEDULE_DELETED': 20,
        'SYSTEM_ERROR': 10
    };

    score += eventTypeScores[this.eventType] || 5;

    // Sensitive data access
    if (this.compliance.sensitiveData) {
        score += 20;
    }

    // Failed operations
    if (!this.eventDetails.success) {
        score += 15;
    }

    // Large data exports
    if (this.eventDetails.recordCount && this.eventDetails.recordCount > 1000) {
        score += 10;
    }

    // Off-hours access (assuming business hours are 8 AM - 6 PM)
    const hour = this.createdAt.getHours();
    if (hour < 8 || hour > 18) {
        score += 10;
    }

    // Weekend access
    const day = this.createdAt.getDay();
    if (day === 0 || day === 6) {
        score += 5;
    }

    // Multiple recipients for exports
    if (this.eventDetails.recipients && this.eventDetails.recipients.length > 5) {
        score += 10;
    }

    // Non-anonymized sensitive data
    if (this.compliance.sensitiveData && !this.compliance.anonymized) {
        score += 15;
    }

    // No encryption for sensitive data
    if (this.compliance.sensitiveData && !this.compliance.encryptionUsed) {
        score += 20;
    }

    return Math.min(100, Math.max(0, score));
};

ReportAuditLogSchema.methods.flag = function (reason: string, reviewerId?: mongoose.Types.ObjectId) {
    this.flagged = true;
    this.flagReason = reason;
    this.reviewStatus = 'pending';
    if (reviewerId) {
        this.reviewedBy = reviewerId;
    }
    return this.save();
};

ReportAuditLogSchema.methods.review = function (
    status: 'approved' | 'rejected',
    reviewerId: mongoose.Types.ObjectId,
    notes?: string
) {
    this.reviewStatus = status;
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    if (notes) {
        this.reviewNotes = notes;
    }
    return this.save();
};

// Static methods
ReportAuditLogSchema.statics.logEvent = function (eventData: Partial<IReportAuditLog>) {
    const auditLog = new this(eventData);
    return auditLog.save();
};

ReportAuditLogSchema.statics.getSecuritySummary = function (workplaceId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
        {
            $match: {
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: null,
                totalEvents: { $sum: 1 },
                flaggedEvents: { $sum: { $cond: ['$flagged', 1, 0] } },
                failedEvents: { $sum: { $cond: [{ $not: '$eventDetails.success' }, 1, 0] } },
                sensitiveDataAccess: { $sum: { $cond: ['$compliance.sensitiveData', 1, 0] } },
                avgRiskScore: { $avg: '$riskScore' },
                highRiskEvents: { $sum: { $cond: [{ $gte: ['$riskScore', 70] }, 1, 0] } },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueIPs: { $addToSet: '$ipAddress' }
            }
        },
        {
            $addFields: {
                uniqueUserCount: { $size: '$uniqueUsers' },
                uniqueIPCount: { $size: '$uniqueIPs' },
                flaggedPercentage: { $multiply: [{ $divide: ['$flaggedEvents', '$totalEvents'] }, 100] },
                failureRate: { $multiply: [{ $divide: ['$failedEvents', '$totalEvents'] }, 100] }
            }
        },
        {
            $project: {
                uniqueUsers: 0,
                uniqueIPs: 0
            }
        }
    ]);
};

ReportAuditLogSchema.statics.getUserActivity = function (userId: string, workplaceId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.find({
        userId: new mongoose.Types.ObjectId(userId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        createdAt: { $gte: startDate }
    })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('templateId', 'name')
        .populate('scheduleId', 'name');
};

ReportAuditLogSchema.statics.getComplianceReport = function (workplaceId: string, startDate: Date, endDate: Date) {
    return this.aggregate([
        {
            $match: {
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    eventType: '$eventType',
                    sensitiveData: '$compliance.sensitiveData'
                },
                count: { $sum: 1 },
                avgRiskScore: { $avg: '$riskScore' },
                flaggedCount: { $sum: { $cond: ['$flagged', 1, 0] } }
            }
        },
        {
            $sort: { count: -1 }
        }
    ]);
};

export default mongoose.model<IReportAuditLog, IReportAuditLogModel>('ReportAuditLog', ReportAuditLogSchema);
