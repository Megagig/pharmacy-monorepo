import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

// Interface for static methods
interface IMTRAuditLogModel extends mongoose.Model<IMTRAuditLog> {
  findWithFilters(
    workplaceId: mongoose.Types.ObjectId,
    filters?: {
      userId?: mongoose.Types.ObjectId;
      action?: string;
      resourceType?: string;
      complianceCategory?: string;
      riskLevel?: string;
      patientId?: mongoose.Types.ObjectId;
      reviewId?: mongoose.Types.ObjectId;
      startDate?: Date;
      endDate?: Date;
      ipAddress?: string;
    },
    options?: {
      page?: number;
      limit?: number;
      sort?: string;
    }
  ): mongoose.Query<IMTRAuditLog[], IMTRAuditLog>;

  getAuditStatistics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: { start: Date; end: Date }
  ): Promise<any>;

  findHighRiskActivities(
    workplaceId: mongoose.Types.ObjectId,
    hours?: number
  ): mongoose.Query<IMTRAuditLog[], IMTRAuditLog>;

  findSuspiciousActivities(
    workplaceId: mongoose.Types.ObjectId,
    hours?: number
  ): mongoose.Aggregate<any[]>;

  createAuditLog(auditData: Partial<IMTRAuditLog>): Promise<IMTRAuditLog>;
}

export interface IMTRAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;

  // Audit metadata
  action: string;
  resourceType:
    | 'MedicationTherapyReview'
    | 'DrugTherapyProblem'
    | 'MTRIntervention'
    | 'MTRFollowUp'
    | 'Patient'
    | 'User'
    | 'ClinicalNote'
    | 'DiagnosticCase';
  resourceId: mongoose.Types.ObjectId;

  // User and session information
  userId: mongoose.Types.ObjectId;
  userRole: string;
  sessionId?: string;

  // Request information
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestUrl?: string;

  // Change tracking
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];

  // Clinical context
  patientId?: mongoose.Types.ObjectId;
  reviewId?: mongoose.Types.ObjectId;

  // Compliance and regulatory
  complianceCategory:
    | 'clinical_documentation'
    | 'patient_safety'
    | 'data_access'
    | 'system_security'
    | 'workflow_compliance';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Additional details
  details: any;
  errorMessage?: string;
  duration?: number; // Request duration in milliseconds

  // Audit fields
  timestamp: Date;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtual properties
  actionDisplay: string;
  riskLevelDisplay: string;
  complianceCategoryDisplay: string;
}

const mtrAuditLogSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },

    // Audit metadata
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      maxlength: [100, 'Action cannot exceed 100 characters'],
      index: true,
    },
    resourceType: {
      type: String,
      enum: [
        'MedicationTherapyReview',
        'DrugTherapyProblem',
        'MTRIntervention',
        'MTRFollowUp',
        'Patient',
        'User',
        'ClinicalNote',
        'DiagnosticCase',
      ],
      required: [true, 'Resource type is required'],
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Resource ID is required'],
      index: true,
    },

    // User and session information
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    userRole: {
      type: String,
      required: [true, 'User role is required'],
      trim: true,
      maxlength: [50, 'User role cannot exceed 50 characters'],
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      maxlength: [100, 'Session ID cannot exceed 100 characters'],
      index: true,
    },

    // Request information
    ipAddress: {
      type: String,
      trim: true,
      maxlength: [45, 'IP address cannot exceed 45 characters'], // IPv6 max length
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User agent cannot exceed 500 characters'],
    },
    requestMethod: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      index: true,
    },
    requestUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'Request URL cannot exceed 500 characters'],
    },

    // Change tracking
    oldValues: {
      type: Schema.Types.Mixed,
    },
    newValues: {
      type: Schema.Types.Mixed,
    },
    changedFields: [
      {
        type: String,
        trim: true,
        maxlength: [100, 'Field name cannot exceed 100 characters'],
      },
    ],

    // Clinical context
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      index: true,
    },
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicationTherapyReview',
      index: true,
    },

    // Compliance and regulatory
    complianceCategory: {
      type: String,
      enum: [
        'clinical_documentation',
        'patient_safety',
        'data_access',
        'system_security',
        'workflow_compliance',
      ],
      required: [true, 'Compliance category is required'],
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      required: true,
      index: true,
    },

    // Additional details
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: [1000, 'Error message cannot exceed 1000 characters'],
    },
    duration: {
      type: Number,
      min: [0, 'Duration cannot be negative'],
    },

    // Timestamp
    timestamp: {
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

// Add audit fields (createdBy, isDeleted)
addAuditFields(mtrAuditLogSchema);

// Apply tenancy guard plugin
mtrAuditLogSchema.plugin(tenancyGuardPlugin, {
  pharmacyIdField: 'workplaceId',
});

// Indexes for efficient querying
mtrAuditLogSchema.index({ workplaceId: 1, timestamp: -1 });
mtrAuditLogSchema.index({ workplaceId: 1, userId: 1, timestamp: -1 });
mtrAuditLogSchema.index({ workplaceId: 1, action: 1, timestamp: -1 });
mtrAuditLogSchema.index({ workplaceId: 1, resourceType: 1, timestamp: -1 });
mtrAuditLogSchema.index({
  workplaceId: 1,
  complianceCategory: 1,
  timestamp: -1,
});
mtrAuditLogSchema.index({ workplaceId: 1, riskLevel: 1, timestamp: -1 });
mtrAuditLogSchema.index({ workplaceId: 1, patientId: 1, timestamp: -1 });
mtrAuditLogSchema.index({ workplaceId: 1, reviewId: 1, timestamp: -1 });
mtrAuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
mtrAuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
mtrAuditLogSchema.index({ sessionId: 1, timestamp: -1 });
mtrAuditLogSchema.index({ createdAt: -1 });

// Compound indexes for common queries
mtrAuditLogSchema.index({
  workplaceId: 1,
  action: 1,
  resourceType: 1,
  timestamp: -1,
});
mtrAuditLogSchema.index({
  workplaceId: 1,
  userId: 1,
  complianceCategory: 1,
  timestamp: -1,
});

// Virtual for human-readable action
mtrAuditLogSchema.virtual('actionDisplay').get(function (this: IMTRAuditLog) {
  const actionMap: { [key: string]: string } = {
    CREATE_MTR_SESSION: 'Created MTR Session',
    UPDATE_MTR_SESSION: 'Updated MTR Session',
    DELETE_MTR_SESSION: 'Deleted MTR Session',
    COMPLETE_MTR_SESSION: 'Completed MTR Session',
    CREATE_MTR_PROBLEM: 'Identified Drug Therapy Problem',
    UPDATE_MTR_PROBLEM: 'Updated Drug Therapy Problem',
    RESOLVE_MTR_PROBLEM: 'Resolved Drug Therapy Problem',
    DELETE_MTR_PROBLEM: 'Deleted Drug Therapy Problem',
    CREATE_MTR_INTERVENTION: 'Recorded Intervention',
    UPDATE_MTR_INTERVENTION: 'Updated Intervention',
    DELETE_MTR_INTERVENTION: 'Deleted Intervention',
    CREATE_MTR_FOLLOWUP: 'Scheduled Follow-up',
    UPDATE_MTR_FOLLOWUP: 'Updated Follow-up',
    COMPLETE_MTR_FOLLOWUP: 'Completed Follow-up',
    DELETE_MTR_FOLLOWUP: 'Deleted Follow-up',
    ACCESS_PATIENT_DATA: 'Accessed Patient Data',
    EXPORT_MTR_DATA: 'Exported MTR Data',
    LOGIN: 'User Login',
    LOGOUT: 'User Logout',
    FAILED_LOGIN: 'Failed Login Attempt',
  };

  return actionMap[this.action] || this.action;
});

// Virtual for risk level display
mtrAuditLogSchema
  .virtual('riskLevelDisplay')
  .get(function (this: IMTRAuditLog) {
    const riskMap = {
      low: 'Low Risk',
      medium: 'Medium Risk',
      high: 'High Risk',
      critical: 'Critical Risk',
    };

    return riskMap[this.riskLevel];
  });

// Virtual for compliance category display
mtrAuditLogSchema
  .virtual('complianceCategoryDisplay')
  .get(function (this: IMTRAuditLog) {
    const categoryMap = {
      clinical_documentation: 'Clinical Documentation',
      patient_safety: 'Patient Safety',
      data_access: 'Data Access',
      system_security: 'System Security',
      workflow_compliance: 'Workflow Compliance',
    };

    return categoryMap[this.complianceCategory];
  });

// Static method to create audit log entry
mtrAuditLogSchema.statics.createAuditLog = async function (
  auditData: Partial<IMTRAuditLog>
): Promise<IMTRAuditLog> {
  const auditLog = new this(auditData);
  return await auditLog.save();
};

// Static method to find audit logs with filters
mtrAuditLogSchema.statics.findWithFilters = function (
  workplaceId: mongoose.Types.ObjectId,
  filters: {
    userId?: mongoose.Types.ObjectId;
    action?: string;
    resourceType?: string;
    complianceCategory?: string;
    riskLevel?: string;
    patientId?: mongoose.Types.ObjectId;
    reviewId?: mongoose.Types.ObjectId;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
  } = {},
  options: {
    page?: number;
    limit?: number;
    sort?: string;
  } = {}
) {
  const query: any = { workplaceId };

  // Apply filters
  if (filters.userId) query.userId = filters.userId;
  if (filters.action) query.action = filters.action;
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.complianceCategory)
    query.complianceCategory = filters.complianceCategory;
  if (filters.riskLevel) query.riskLevel = filters.riskLevel;
  if (filters.patientId) query.patientId = filters.patientId;
  if (filters.reviewId) query.reviewId = filters.reviewId;
  if (filters.ipAddress) query.ipAddress = filters.ipAddress;

  // Date range filter
  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = filters.startDate;
    if (filters.endDate) query.timestamp.$lte = filters.endDate;
  }

  // Build query
  const baseQuery = this.find(query)
    .populate('userId', 'firstName lastName email role')
    .populate('patientId', 'firstName lastName mrn')
    .populate('reviewId', 'reviewNumber status');

  // Apply sorting
  const sortBy = options.sort || '-timestamp';
  baseQuery.sort(sortBy);

  // Apply pagination
  if (options.page && options.limit) {
    const skip = (options.page - 1) * options.limit;
    baseQuery.skip(skip).limit(options.limit);
  }

  return baseQuery;
};

// Static method to get audit statistics
mtrAuditLogSchema.statics.getAuditStatistics = async function (
  workplaceId: mongoose.Types.ObjectId,
  dateRange?: { start: Date; end: Date }
) {
  const matchStage: any = { workplaceId };

  if (dateRange) {
    matchStage.timestamp = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        actionsByType: {
          $push: {
            action: '$action',
            resourceType: '$resourceType',
            complianceCategory: '$complianceCategory',
            riskLevel: '$riskLevel',
          },
        },
        riskDistribution: {
          $push: '$riskLevel',
        },
        complianceDistribution: {
          $push: '$complianceCategory',
        },
        avgDuration: { $avg: '$duration' },
        errorCount: {
          $sum: { $cond: [{ $ne: ['$errorMessage', null] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalLogs: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        actionsByType: 1,
        riskDistribution: 1,
        complianceDistribution: 1,
        avgDurationMs: { $round: ['$avgDuration', 2] },
        errorCount: 1,
        errorRate: {
          $cond: [
            { $gt: ['$totalLogs', 0] },
            { $multiply: [{ $divide: ['$errorCount', '$totalLogs'] }, 100] },
            0,
          ],
        },
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  return (
    result[0] || {
      totalLogs: 0,
      uniqueUserCount: 0,
      actionsByType: [],
      riskDistribution: [],
      complianceDistribution: [],
      avgDurationMs: 0,
      errorCount: 0,
      errorRate: 0,
    }
  );
};

// Static method to find high-risk activities
mtrAuditLogSchema.statics.findHighRiskActivities = function (
  workplaceId: mongoose.Types.ObjectId,
  hours: number = 24
) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.find({
    workplaceId,
    riskLevel: { $in: ['high', 'critical'] },
    timestamp: { $gte: startTime },
  })
    .populate('userId', 'firstName lastName email')
    .populate('patientId', 'firstName lastName mrn')
    .sort({ timestamp: -1 });
};

// Static method to find suspicious activities
mtrAuditLogSchema.statics.findSuspiciousActivities = function (
  workplaceId: mongoose.Types.ObjectId,
  hours: number = 24
) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        workplaceId,
        timestamp: { $gte: startTime },
      },
    },
    {
      $group: {
        _id: {
          userId: '$userId',
          ipAddress: '$ipAddress',
        },
        actionCount: { $sum: 1 },
        uniqueActions: { $addToSet: '$action' },
        errorCount: {
          $sum: { $cond: [{ $ne: ['$errorMessage', null] }, 1, 0] },
        },
        firstActivity: { $min: '$timestamp' },
        lastActivity: { $max: '$timestamp' },
      },
    },
    {
      $match: {
        $or: [
          { actionCount: { $gt: 100 } }, // High activity volume
          { errorCount: { $gt: 10 } }, // High error rate
          { 'uniqueActions.10': { $exists: true } }, // Many different actions
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id.userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $project: {
        userId: '$_id.userId',
        ipAddress: '$_id.ipAddress',
        actionCount: 1,
        uniqueActionCount: { $size: '$uniqueActions' },
        errorCount: 1,
        errorRate: {
          $multiply: [{ $divide: ['$errorCount', '$actionCount'] }, 100],
        },
        firstActivity: 1,
        lastActivity: 1,
        user: { $arrayElemAt: ['$user', 0] },
      },
    },
    { $sort: { actionCount: -1 } },
  ]);
};

export default mongoose.model<IMTRAuditLog, IMTRAuditLogModel>(
  'MTRAuditLog',
  mtrAuditLogSchema
);
