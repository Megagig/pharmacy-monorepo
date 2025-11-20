import mongoose, { Document, Schema } from 'mongoose';

export interface IAIUsageLimits extends Document {
  workspaceId: mongoose.Types.ObjectId;
  subscriptionTier: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
  limits: {
    requestsPerMonth: number;
    costBudgetPerMonth: number; // in USD
    dailyRequestLimit?: number;
  };
  currentUsage: {
    month: string; // YYYY-MM format
    requestCount: number;
    totalCost: number;
    lastResetDate: Date;
  };
  suspended: boolean;
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: mongoose.Types.ObjectId;
  customLimits?: {
    requestsPerMonth?: number;
    costBudgetPerMonth?: number;
    dailyRequestLimit?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const aiUsageLimitsSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      unique: true,
      index: true,
    },
    subscriptionTier: {
      type: String,
      enum: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
      required: true,
    },
    limits: {
      requestsPerMonth: {
        type: Number,
        required: true,
        min: 0,
      },
      costBudgetPerMonth: {
        type: Number,
        required: true,
        min: 0,
      },
      dailyRequestLimit: {
        type: Number,
        min: 0,
      },
    },
    currentUsage: {
      month: {
        type: String,
        required: true,
      },
      requestCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalCost: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
    },
    suspended: {
      type: Boolean,
      default: false,
      index: true,
    },
    suspensionReason: {
      type: String,
    },
    suspendedAt: {
      type: Date,
    },
    suspendedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    customLimits: {
      requestsPerMonth: {
        type: Number,
        min: 0,
      },
      costBudgetPerMonth: {
        type: Number,
        min: 0,
      },
      dailyRequestLimit: {
        type: Number,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
aiUsageLimitsSchema.index({ subscriptionTier: 1 });
aiUsageLimitsSchema.index({ suspended: 1 });
aiUsageLimitsSchema.index({ 'currentUsage.month': 1 });

export default mongoose.model<IAIUsageLimits>('AIUsageLimits', aiUsageLimitsSchema);