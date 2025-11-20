import mongoose, { Document, Schema } from 'mongoose';

export interface ISecurityAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'user_management' | 'system' | 'tenant_management';
  details: Record<string, any>;
  riskScore: number;
  flagged: boolean;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  workspaceId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const securityAuditLogSchema = new Schema<ISecurityAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resource: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      validate: {
        validator: function(ip: string) {
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'localhost' || ip === '127.0.0.1';
        },
        message: 'Invalid IP address format',
      },
    },
    userAgent: {
      type: String,
      required: true,
    },
    location: {
      country: String,
      region: String,
      city: String,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    success: {
      type: Boolean,
      required: true,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['authentication', 'authorization', 'data_access', 'configuration', 'user_management', 'system', 'tenant_management'],
      required: true,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },
    flagged: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'securityauditlogs',
  }
);

// Compound indexes for efficient queries
securityAuditLogSchema.index({ timestamp: -1, severity: 1 });
securityAuditLogSchema.index({ userId: 1, timestamp: -1 });
securityAuditLogSchema.index({ category: 1, timestamp: -1 });
securityAuditLogSchema.index({ success: 1, timestamp: -1 });
securityAuditLogSchema.index({ flagged: 1, reviewedAt: 1 });
securityAuditLogSchema.index({ riskScore: -1, timestamp: -1 });
securityAuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
securityAuditLogSchema.index({ workspaceId: 1, timestamp: -1 });

// TTL index based on security settings retention policy
// This will be set dynamically based on security settings
securityAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 94608000 }); // 3 years default

// Methods
securityAuditLogSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

securityAuditLogSchema.methods.calculateRiskScore = function (): number {
  let score = 0;

  // Base score by category
  const categoryScores = {
    authentication: 20,
    authorization: 30,
    data_access: 25,
    configuration: 40,
    user_management: 35,
    system: 45,
  };

  score += categoryScores[this.category] || 10;

  // Increase score for failures
  if (!this.success) {
    score += 30;
  }

  // Increase score for sensitive actions
  const sensitiveActions = [
    'login_failed',
    'password_reset',
    'role_changed',
    'permission_granted',
    'user_created',
    'user_deleted',
    'data_export',
    'configuration_changed',
  ];

  if (sensitiveActions.some(action => this.action.toLowerCase().includes(action))) {
    score += 20;
  }

  // Check for suspicious patterns in details
  if (this.details) {
    if (this.details.multipleFailures) score += 25;
    if (this.details.newDevice) score += 15;
    if (this.details.newLocation) score += 20;
    if (this.details.offHours) score += 10;
  }

  return Math.min(100, score);
};

securityAuditLogSchema.methods.shouldFlag = function (): boolean {
  const riskScore = this.calculateRiskScore();
  
  // Auto-flag high-risk activities
  if (riskScore >= 70) return true;
  
  // Flag failed authentication attempts
  if (this.category === 'authentication' && !this.success) return true;
  
  // Flag critical severity events
  if (this.severity === 'critical') return true;
  
  return false;
};

securityAuditLogSchema.methods.markReviewed = function (reviewerId: mongoose.Types.ObjectId, notes?: string): void {
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  this.flagged = false; // Unflag after review
};

// Static methods
securityAuditLogSchema.statics.createLog = function (logData: Partial<ISecurityAuditLog>) {
  const log = new this(logData);
  (log as any).riskScore = (log as any).calculateRiskScore();
  (log as any).flagged = (log as any).shouldFlag();
  return log.save();
};

securityAuditLogSchema.statics.getFlaggedLogs = function (limit = 50) {
  return this.find({ flagged: true, reviewedAt: { $exists: false } })
    .sort({ riskScore: -1, timestamp: -1 })
    .limit(limit)
    .populate('userId', 'email firstName lastName')
    .populate('reviewedBy', 'email firstName lastName');
};

securityAuditLogSchema.statics.getSecuritySummary = function (timeRange: { start: Date; end: Date }) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: timeRange.start, $lte: timeRange.end }
      }
    },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        failedEvents: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
        flaggedEvents: { $sum: { $cond: ['$flagged', 1, 0] } },
        criticalEvents: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        averageRiskScore: { $avg: '$riskScore' },
        categoryCounts: {
          $push: '$category'
        }
      }
    }
  ]);
};

securityAuditLogSchema.statics.getUserActivity = function (userId: mongoose.Types.ObjectId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('action resource timestamp success severity riskScore');
};

securityAuditLogSchema.statics.getFailedLogins = function (timeRange: { start: Date; end: Date }) {
  return this.find({
    category: 'authentication',
    action: { $regex: /login.*failed/i },
    success: false,
    timestamp: { $gte: timeRange.start, $lte: timeRange.end }
  })
  .sort({ timestamp: -1 })
  .populate('userId', 'email firstName lastName');
};

// Pre-save middleware to auto-calculate risk score and flagging
securityAuditLogSchema.pre('save', function(next) {
  if (this.isNew) {
    (this as any).riskScore = (this as any).calculateRiskScore();
    (this as any).flagged = (this as any).shouldFlag();
  }
  next();
});

export const SecurityAuditLog = mongoose.model<ISecurityAuditLog>('SecurityAuditLog', securityAuditLogSchema);