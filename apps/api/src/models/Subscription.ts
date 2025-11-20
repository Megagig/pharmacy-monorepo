import mongoose, { Document, Schema } from 'mongoose';

export interface UsageMetric {
  feature: string;
  count: number;
  lastUpdated: Date;
}

export interface PlanLimits {
  patients: number | null;
  users: number | null;
  locations: number | null;
  storage: number | null;
  apiCalls: number | null;
}

export interface ISubscription extends Document {
  // Changed from userId to workspaceId
  workspaceId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status:
  | 'trial'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'canceled'
  | 'suspended';
  tier: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
  startDate: Date;
  endDate: Date;
  trialEndDate?: Date;
  trialEndsAt?: Date; // Alias for trialEndDate
  isTrial?: boolean; // Computed property

  // Billing information
  amount?: number; // Subscription amount
  priceAtPurchase: number;
  billingCycle?: 'monthly' | 'yearly'; // Billing cycle
  billingInterval: 'monthly' | 'yearly';
  nextBillingDate?: Date;
  paymentHistory: mongoose.Types.ObjectId[];
  autoRenew: boolean;
  gracePeriodEnd?: Date;
  canceledAt?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;

  // Webhook and renewal tracking
  webhookEvents: {
    eventId: string;
    eventType: string;
    processedAt: Date;
    data: any;
  }[];
  renewalAttempts: {
    attemptedAt: Date;
    successful: boolean;
    error?: string;
  }[];

  // Feature and usage tracking
  features: string[]; // Cached features from plan
  customFeatures: string[]; // Additional features granted
  limits: PlanLimits; // Cached limits from plan
  usageMetrics: UsageMetric[];

  // Plan change management
  scheduledDowngrade?: {
    planId: mongoose.Types.ObjectId;
    effectiveDate: Date;
    scheduledAt: Date;
  };

  createdAt: Date;
  updatedAt: Date;
  isInGracePeriod(): boolean;
  isExpired(): boolean;
  canRenew(): boolean;
}

const subscriptionSchema = new Schema(
  {
    // Changed from userId to workspaceId
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'PricingPlan',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'trial',
        'active',
        'past_due',
        'expired',
        'canceled',
        'suspended',
      ],
      default: 'trial',
      index: true,
    },
    tier: {
      type: String,
      enum: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    trialEndDate: {
      type: Date,
      index: true,
    },

    // Billing information
    priceAtPurchase: {
      type: Number,
      required: true,
      min: 0,
    },
    billingInterval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    nextBillingDate: {
      type: Date,
      index: true,
    },
    paymentHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Payment',
      },
    ],
    autoRenew: {
      type: Boolean,
      default: true,
    },
    gracePeriodEnd: Date,
    canceledAt: {
      type: Date,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      sparse: true,
      index: true,
    },

    // Webhook and renewal tracking
    webhookEvents: [
      {
        eventId: {
          type: String,
          required: true,
        },
        eventType: {
          type: String,
          required: true,
        },
        processedAt: {
          type: Date,
          default: Date.now,
        },
        data: Schema.Types.Mixed,
      },
    ],
    renewalAttempts: [
      {
        attemptedAt: {
          type: Date,
          default: Date.now,
        },
        successful: {
          type: Boolean,
          required: true,
        },
        error: String,
      },
    ],

    // Feature and usage tracking
    features: [
      {
        type: String,
        index: true,
      },
    ],
    customFeatures: [
      {
        type: String,
        index: true,
      },
    ],
    limits: {
      patients: {
        type: Number,
        default: null,
      },
      users: {
        type: Number,
        default: null,
      },
      locations: {
        type: Number,
        default: null,
      },
      storage: {
        type: Number,
        default: null,
      },
      apiCalls: {
        type: Number,
        default: null,
      },
    },
    usageMetrics: [
      {
        feature: {
          type: String,
          required: true,
        },
        count: {
          type: Number,
          default: 0,
        },
        lastUpdated: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Plan change management
    scheduledDowngrade: {
      planId: {
        type: Schema.Types.ObjectId,
        ref: 'PricingPlan',
      },
      effectiveDate: Date,
      scheduledAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  { timestamps: true }
);

// Instance methods
subscriptionSchema.methods.isInGracePeriod = function (): boolean {
  return (
    this.status === 'grace_period' &&
    this.gracePeriodEnd &&
    new Date() <= this.gracePeriodEnd
  );
};

subscriptionSchema.methods.isExpired = function (): boolean {
  return new Date() > this.endDate && !this.isInGracePeriod();
};

subscriptionSchema.methods.canRenew = function (): boolean {
  return this.autoRenew && ['active', 'grace_period'].includes(this.status);
};

// Pre-save middleware to update status based on dates
subscriptionSchema.pre('save', function (next) {
  const now = new Date();

  if (this.isModified('endDate') || this.isNew) {
    if (now > this.endDate) {
      if (this.gracePeriodEnd && now <= this.gracePeriodEnd) {
        this.status = 'past_due';
      } else {
        this.status = 'expired';
      }
    }
  }

  next();
});

// Indexes for efficient queries
subscriptionSchema.index({ workspaceId: 1, status: 1 });
subscriptionSchema.index({ workspaceId: 1 }, { unique: true }); // One subscription per workspace
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ trialEndDate: 1, status: 1 });
subscriptionSchema.index({ nextBillingDate: 1, status: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });
subscriptionSchema.index({ tier: 1, status: 1 });

// Virtual properties for backward compatibility
subscriptionSchema.virtual('trialEndsAt').get(function () {
  return this.trialEndDate;
});

subscriptionSchema.virtual('trialEndsAt').set(function (value) {
  this.trialEndDate = value;
});

subscriptionSchema.virtual('isTrial').get(function () {
  return this.status === 'trial' || (this.trialEndDate && new Date() <= this.trialEndDate);
});

// Ensure virtual fields are serialized
subscriptionSchema.set('toJSON', { virtuals: true });
subscriptionSchema.set('toObject', { virtuals: true });

const Subscription = mongoose.model<ISubscription>(
  'Subscription',
  subscriptionSchema
);

export { Subscription };
export default Subscription;
