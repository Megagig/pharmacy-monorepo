import mongoose, { Document, Schema } from 'mongoose';
import * as crypto from 'crypto';

export interface IWorkspaceInvite extends Document {
  workplaceId: mongoose.Types.ObjectId;
  inviteToken: string;
  email: string;
  workplaceRole: 'Owner' | 'Staff' | 'Pharmacist' | 'Cashier' | 'Technician' | 'Assistant';
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';
  invitedBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  revokedAt?: Date;
  revokedBy?: mongoose.Types.ObjectId;
  maxUses: number;
  usedCount: number;
  requiresApproval: boolean;
  personalMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  isExpired(): boolean;
  canBeUsed(): boolean;
  markAsAccepted(userId: mongoose.Types.ObjectId): void;
  markAsRejected(userId: mongoose.Types.ObjectId, reason?: string): void;
  revoke(userId: mongoose.Types.ObjectId): void;
  incrementUsage(): void;
}

const workspaceInviteSchema = new Schema<IWorkspaceInvite>(
  {
    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workplace',
      required: [true, 'Workplace ID is required'],
      index: true,
    },
    inviteToken: {
      type: String,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
      index: true,
    },
    workplaceRole: {
      type: String,
      enum: ['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'],
      required: [true, 'Workplace role is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviter ID is required'],
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    revokedAt: {
      type: Date,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    maxUses: {
      type: Number,
      required: [true, 'Max uses is required'],
      default: 1,
      min: [1, 'Max uses must be at least 1'],
      max: [100, 'Max uses cannot exceed 100'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    personalMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    collection: 'workspace_invites',
  }
);

// Indexes for performance optimization
workspaceInviteSchema.index({ inviteToken: 1 }, { unique: true });
workspaceInviteSchema.index({ workplaceId: 1, status: 1 });
workspaceInviteSchema.index({ workplaceId: 1, email: 1 });
workspaceInviteSchema.index({ expiresAt: 1 });
workspaceInviteSchema.index({ invitedBy: 1, createdAt: -1 });

// Compound indexes for common queries
workspaceInviteSchema.index({ workplaceId: 1, status: 1, createdAt: -1 });
workspaceInviteSchema.index({ email: 1, status: 1 });
workspaceInviteSchema.index({ workplaceId: 1, requiresApproval: 1, status: 1 });

// TTL index to automatically remove expired invites after 90 days
workspaceInviteSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Instance methods
workspaceInviteSchema.methods.isExpired = function (): boolean {
  return this.expiresAt < new Date() || this.status === 'expired';
};

workspaceInviteSchema.methods.canBeUsed = function (): boolean {
  return (
    this.status === 'pending' &&
    !this.isExpired() &&
    this.usedCount < this.maxUses
  );
};

workspaceInviteSchema.methods.markAsAccepted = function (
  userId: mongoose.Types.ObjectId
): void {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
};

workspaceInviteSchema.methods.markAsRejected = function (
  userId: mongoose.Types.ObjectId,
  reason?: string
): void {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  this.rejectedBy = userId;
  if (reason) {
    this.rejectionReason = reason;
  }
};

workspaceInviteSchema.methods.revoke = function (
  userId: mongoose.Types.ObjectId
): void {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = userId;
};

workspaceInviteSchema.methods.incrementUsage = function (): void {
  this.usedCount += 1;
  if (this.usedCount >= this.maxUses) {
    this.status = 'accepted';
  }
};

// Static methods
workspaceInviteSchema.statics.findActiveByToken = function (token: string) {
  return this.findOne({ inviteToken: token, status: 'pending' });
};

workspaceInviteSchema.statics.countPendingForWorkspace = function (
  workplaceId: mongoose.Types.ObjectId
) {
  return this.countDocuments({ workplaceId, status: 'pending' });
};

workspaceInviteSchema.statics.expireOldInvites = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: now },
    },
    {
      $set: { status: 'expired' },
    }
  );
  return result;
};

// Pre-save middleware to generate invite token
workspaceInviteSchema.pre<IWorkspaceInvite>('save', function (next) {
  if (this.isNew && !this.inviteToken) {
    // Generate a secure random token
    this.inviteToken = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Pre-save middleware to validate expiration date
workspaceInviteSchema.pre<IWorkspaceInvite>('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    // Default to 7 days from now
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  // Ensure expiration date is in the future
  if (this.isNew && this.expiresAt <= new Date()) {
    return next(new Error('Expiration date must be in the future'));
  }
  
  next();
});

// Pre-save middleware to validate used count
workspaceInviteSchema.pre<IWorkspaceInvite>('save', function (next) {
  if (this.usedCount > this.maxUses) {
    return next(new Error('Used count cannot exceed max uses'));
  }
  next();
});

export const WorkspaceInvite = mongoose.model<IWorkspaceInvite>(
  'WorkspaceInvite',
  workspaceInviteSchema
);

export default WorkspaceInvite;
