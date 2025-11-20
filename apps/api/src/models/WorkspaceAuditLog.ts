import mongoose, { Document, Schema } from 'mongoose';

export interface AuditLogDetails {
  before?: any;
  after?: any;
  reason?: string;
  metadata?: any;
}

export interface IWorkspaceAuditLog extends Document {
  workplaceId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  targetId?: mongoose.Types.ObjectId;
  action: string;
  category: 'member' | 'role' | 'permission' | 'invite' | 'auth' | 'settings';
  details: AuditLogDetails;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  getFormattedTimestamp(): string;
  getSeverityColor(): string;
}

const workspaceAuditLogSchema = new Schema<IWorkspaceAuditLog>(
  {
    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workplace',
      required: [true, 'Workplace ID is required'],
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is required'],
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: [
        // Member actions
        'member_added',
        'member_removed',
        'member_suspended',
        'member_activated',
        'member_updated',
        'member_viewed',
        'member_list_viewed',
        'member_search_performed',
        
        // Role actions
        'role_assigned',
        'role_changed',
        'role_removed',
        'role_viewed',
        
        // Permission actions
        'permission_granted',
        'permission_revoked',
        'permission_updated',
        'permission_viewed',
        
        // Invite actions
        'invite_generated',
        'invite_sent',
        'invite_accepted',
        'invite_rejected',
        'invite_revoked',
        'invite_expired',
        'invite_viewed',
        
        // Approval actions
        'member_approved',
        'member_rejected',
        'approval_pending',
        
        // Auth actions
        'login_attempt',
        'login_success',
        'login_failed',
        'logout',
        'access_denied',
        'unauthorized_attempt',
        
        // Settings actions
        'settings_updated',
        'settings_viewed',
        'workspace_updated',
      ],
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['member', 'role', 'permission', 'invite', 'auth', 'settings'],
      index: true,
    },
    details: {
      before: {
        type: Schema.Types.Mixed,
      },
      after: {
        type: Schema.Types.Mixed,
      },
      reason: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      metadata: {
        type: Schema.Types.Mixed,
      },
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'workspace_audit_logs',
  }
);

// Indexes for performance optimization
workspaceAuditLogSchema.index({ workplaceId: 1, timestamp: -1 });
workspaceAuditLogSchema.index({ workplaceId: 1, actorId: 1, timestamp: -1 });
workspaceAuditLogSchema.index({ workplaceId: 1, targetId: 1, timestamp: -1 });
workspaceAuditLogSchema.index({ workplaceId: 1, category: 1, timestamp: -1 });
workspaceAuditLogSchema.index({ workplaceId: 1, action: 1, timestamp: -1 });
workspaceAuditLogSchema.index({ workplaceId: 1, severity: 1, timestamp: -1 });

// Compound indexes for common queries
workspaceAuditLogSchema.index({
  workplaceId: 1,
  category: 1,
  action: 1,
  timestamp: -1,
});
workspaceAuditLogSchema.index({
  workplaceId: 1,
  actorId: 1,
  category: 1,
  timestamp: -1,
});
workspaceAuditLogSchema.index({
  workplaceId: 1,
  targetId: 1,
  action: 1,
  timestamp: -1,
});
workspaceAuditLogSchema.index({
  workplaceId: 1,
  severity: 1,
  category: 1,
  timestamp: -1,
});

// TTL index to automatically remove logs after 90 days
workspaceAuditLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Static methods
workspaceAuditLogSchema.statics.logAction = async function (params: {
  workplaceId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  targetId?: mongoose.Types.ObjectId;
  action: string;
  category: string;
  details?: AuditLogDetails;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}) {
  const log = new this({
    workplaceId: params.workplaceId,
    actorId: params.actorId,
    targetId: params.targetId,
    action: params.action,
    category: params.category,
    details: params.details || {},
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    severity: params.severity || 'medium',
    timestamp: new Date(),
  });

  await log.save();
  return log;
};

workspaceAuditLogSchema.statics.getRecentLogs = function (
  workplaceId: mongoose.Types.ObjectId,
  limit: number = 50
) {
  return this.find({ workplaceId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', 'firstName lastName email')
    .populate('targetId', 'firstName lastName email');
};

workspaceAuditLogSchema.statics.getLogsByCategory = function (
  workplaceId: mongoose.Types.ObjectId,
  category: string,
  limit: number = 50
) {
  return this.find({ workplaceId, category })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', 'firstName lastName email')
    .populate('targetId', 'firstName lastName email');
};

workspaceAuditLogSchema.statics.getLogsByActor = function (
  workplaceId: mongoose.Types.ObjectId,
  actorId: mongoose.Types.ObjectId,
  limit: number = 50
) {
  return this.find({ workplaceId, actorId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', 'firstName lastName email')
    .populate('targetId', 'firstName lastName email');
};

workspaceAuditLogSchema.statics.getLogsByTarget = function (
  workplaceId: mongoose.Types.ObjectId,
  targetId: mongoose.Types.ObjectId,
  limit: number = 50
) {
  return this.find({ workplaceId, targetId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', 'firstName lastName email')
    .populate('targetId', 'firstName lastName email');
};

workspaceAuditLogSchema.statics.getLogsByDateRange = function (
  workplaceId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date,
  limit: number = 100
) {
  return this.find({
    workplaceId,
    timestamp: { $gte: startDate, $lte: endDate },
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', 'firstName lastName email')
    .populate('targetId', 'firstName lastName email');
};

workspaceAuditLogSchema.statics.getHighSeverityLogs = function (
  workplaceId: mongoose.Types.ObjectId,
  limit: number = 50
) {
  return this.find({
    workplaceId,
    severity: { $in: ['high', 'critical'] },
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', 'firstName lastName email')
    .populate('targetId', 'firstName lastName email');
};

workspaceAuditLogSchema.statics.countLogsByCategory = function (
  workplaceId: mongoose.Types.ObjectId
) {
  return this.aggregate([
    { $match: { workplaceId } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

workspaceAuditLogSchema.statics.countLogsByAction = function (
  workplaceId: mongoose.Types.ObjectId,
  category?: string
) {
  const match: any = { workplaceId };
  if (category) {
    match.category = category;
  }

  return this.aggregate([
    { $match: match },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

// Instance methods
workspaceAuditLogSchema.methods.getFormattedTimestamp = function (): string {
  return this.timestamp.toISOString();
};

workspaceAuditLogSchema.methods.getSeverityColor = function (): string {
  const colors: Record<string, string> = {
    low: 'green',
    medium: 'yellow',
    high: 'orange',
    critical: 'red',
  };
  return colors[this.severity] || 'gray';
};

export const WorkspaceAuditLog = mongoose.model<IWorkspaceAuditLog>(
  'WorkspaceAuditLog',
  workspaceAuditLogSchema
);

export default WorkspaceAuditLog;
