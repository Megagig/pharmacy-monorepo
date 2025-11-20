/**
 * Feature Flag Model
 * 
 * Stores feature flag configuration for the application
 */

import mongoose, { Document, Schema } from 'mongoose';

// Enhanced interfaces for advanced feature flag functionality
export interface ITargetingRules {
  pharmacies?: string[];
  userGroups?: string[];
  percentage?: number;
  conditions?: {
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
    userAttributes?: Record<string, any>;
    workspaceAttributes?: Record<string, any>;
  };
}

export interface IUsageMetrics {
  totalUsers: number;
  activeUsers: number;
  usagePercentage: number;
  lastUsed: Date;
  usageByPlan?: Array<{
    plan: string;
    userCount: number;
    percentage: number;
  }>;
  usageByWorkspace?: Array<{
    workspaceId: string;
    workspaceName: string;
    userCount: number;
  }>;
}

export interface IFeatureFlag extends Document {
  // Core fields (existing - backward compatible)
  name: string;
  key: string;
  description?: string;
  isActive: boolean;
  allowedTiers: string[];
  allowedRoles: string[];
  customRules?: {
    requiredLicense?: boolean;
    maxUsers?: number;
    // Enhanced: Add targeting rules to customRules for backward compatibility
    targeting?: ITargetingRules;
    [key: string]: any;
  };
  metadata?: {
    category: string;
    priority: string;
    tags: string[];
    // Enhanced: Add display and marketing metadata
    displayOrder?: number;
    marketingDescription?: string;
    isMarketingFeature?: boolean;
    icon?: string;
    [key: string]: any;
  };
  
  // Enhanced fields (new - optional for backward compatibility)
  targetingRules?: ITargetingRules;
  usageMetrics?: IUsageMetrics;
  
  // Audit fields (existing)
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  allowedTiers: [{
    type: String,
    trim: true,
  }],
  allowedRoles: [{
    type: String,
    trim: true,
  }],
  customRules: {
    type: Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    category: {
      type: String,
      default: 'core',
    },
    priority: {
      type: String,
      default: 'medium',
    },
    tags: [{
      type: String,
      trim: true,
    }],
    // Enhanced: Marketing and display metadata
    displayOrder: {
      type: Number,
      default: 0,
    },
    marketingDescription: {
      type: String,
      trim: true,
    },
    isMarketingFeature: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String,
      trim: true,
    },
  },
  
  // Enhanced: Advanced targeting rules (optional for backward compatibility)
  targetingRules: {
    pharmacies: [{
      type: String,
      trim: true,
    }],
    userGroups: [{
      type: String,
      trim: true,
    }],
    percentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    conditions: {
      dateRange: {
        startDate: {
          type: Date,
        },
        endDate: {
          type: Date,
        },
      },
      userAttributes: {
        type: Schema.Types.Mixed,
      },
      workspaceAttributes: {
        type: Schema.Types.Mixed,
      },
    },
  },
  
  // Enhanced: Usage metrics (optional, calculated fields)
  usageMetrics: {
    totalUsers: {
      type: Number,
      default: 0,
    },
    activeUsers: {
      type: Number,
      default: 0,
    },
    usagePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastUsed: {
      type: Date,
    },
    usageByPlan: [{
      plan: String,
      userCount: Number,
      percentage: Number,
    }],
    usageByWorkspace: [{
      workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
      },
      workspaceName: String,
      userCount: Number,
    }],
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for efficient queries
FeatureFlagSchema.index({ key: 1, isActive: 1 });
FeatureFlagSchema.index({ 'metadata.category': 1, isActive: 1 });
FeatureFlagSchema.index({ allowedTiers: 1, isActive: 1 });

// Enhanced: Additional indexes for new functionality
FeatureFlagSchema.index({ 'metadata.isMarketingFeature': 1, isActive: 1 });
FeatureFlagSchema.index({ 'metadata.displayOrder': 1 });
FeatureFlagSchema.index({ 'targetingRules.pharmacies': 1 });
FeatureFlagSchema.index({ 'targetingRules.userGroups': 1 });
FeatureFlagSchema.index({ 'usageMetrics.lastUsed': -1 });

// Update the updatedAt field on save
FeatureFlagSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const FeatureFlag = mongoose.model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);
export default FeatureFlag;
export { FeatureFlag };
