import mongoose, { Document, Schema } from 'mongoose';

export interface IPlanDistribution {
  planId: mongoose.Types.ObjectId;
  planName: string;
  count: number;
  percentage: number;
  revenue: number;
}

export interface IRevenueByPlan {
  planId: mongoose.Types.ObjectId;
  planName: string;
  revenue: number;
  subscriptionCount: number;
  averageRevenuePerUser: number;
}

export interface IChurnAnalytics {
  totalChurned: number;
  churnRate: number;
  churnByPlan: {
    planId: mongoose.Types.ObjectId;
    planName: string;
    churnedCount: number;
    churnRate: number;
  }[];
  churnReasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];
}

export interface ISubscriptionAnalytics extends Document {
  date: Date;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  ltv: number; // Lifetime Value
  cac: number; // Customer Acquisition Cost
  churnRate: number;
  upgradeRate: number;
  downgradeRate: number;
  totalRevenue: number; // Added for revenue metrics
  revenueGrowth: number; // Added for revenue metrics
  averageRevenuePerUser: number; // Added for revenue metrics
  churnedSubscriptions: number; // Added for churn analytics
  planDistribution: IPlanDistribution[];
  revenueByPlan: IRevenueByPlan[];
  churnAnalytics: IChurnAnalytics;
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  canceledSubscriptions: number;
  newSubscriptions: number;
  renewedSubscriptions: number;
  averageSubscriptionValue: number;
  netRevenueRetention: number;
  grossRevenueRetention: number;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateGrowthRate(previousMrr: number): number;
  calculateLtvToCacRatio(): number;
  getHealthScore(): number;
}

const planDistributionSchema = new Schema<IPlanDistribution>({
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true,
  },
  planName: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    required: true,
    min: 0,
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  revenue: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const revenueByPlanSchema = new Schema<IRevenueByPlan>({
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true,
  },
  planName: {
    type: String,
    required: true,
  },
  revenue: {
    type: Number,
    required: true,
    min: 0,
  },
  subscriptionCount: {
    type: Number,
    required: true,
    min: 0,
  },
  averageRevenuePerUser: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const churnAnalyticsSchema = new Schema<IChurnAnalytics>({
  totalChurned: {
    type: Number,
    required: true,
    min: 0,
  },
  churnRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  churnByPlan: [{
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    churnedCount: {
      type: Number,
      required: true,
      min: 0,
    },
    churnRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  }],
  churnReasons: [{
    reason: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  }],
}, { _id: false });

const subscriptionAnalyticsSchema = new Schema<ISubscriptionAnalytics>(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    mrr: {
      type: Number,
      required: true,
      min: 0,
    },
    arr: {
      type: Number,
      required: true,
      min: 0,
    },
    ltv: {
      type: Number,
      required: true,
      min: 0,
    },
    cac: {
      type: Number,
      required: true,
      min: 0,
    },
    churnRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    upgradeRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    downgradeRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totalRevenue: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    revenueGrowth: {
      type: Number,
      required: false,
      default: 0,
    },
    averageRevenuePerUser: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    churnedSubscriptions: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    planDistribution: [planDistributionSchema],
    revenueByPlan: [revenueByPlanSchema],
    churnAnalytics: churnAnalyticsSchema,
    totalSubscriptions: {
      type: Number,
      required: true,
      min: 0,
    },
    activeSubscriptions: {
      type: Number,
      required: true,
      min: 0,
    },
    trialSubscriptions: {
      type: Number,
      required: true,
      min: 0,
    },
    canceledSubscriptions: {
      type: Number,
      required: true,
      min: 0,
    },
    newSubscriptions: {
      type: Number,
      required: true,
      min: 0,
    },
    renewedSubscriptions: {
      type: Number,
      required: true,
      min: 0,
    },
    averageSubscriptionValue: {
      type: Number,
      required: true,
      min: 0,
    },
    netRevenueRetention: {
      type: Number,
      required: true,
      min: 0,
    },
    grossRevenueRetention: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'subscriptionanalytics',
  }
);

// Indexes for time-series queries
subscriptionAnalyticsSchema.index({ date: -1 });
subscriptionAnalyticsSchema.index({ createdAt: -1 });
subscriptionAnalyticsSchema.index({ date: 1, createdAt: 1 });

// Compound indexes for efficient queries
subscriptionAnalyticsSchema.index({ date: -1, mrr: -1 });
subscriptionAnalyticsSchema.index({ date: -1, churnRate: -1 });
subscriptionAnalyticsSchema.index({ date: -1, arr: -1 });

// TTL index to automatically delete old analytics after 2 years
subscriptionAnalyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Methods
subscriptionAnalyticsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

subscriptionAnalyticsSchema.methods.calculateGrowthRate = function (this: ISubscriptionAnalytics, previousMrr: number): number {
  if (previousMrr === 0) return 0;
  return ((this.mrr - previousMrr) / previousMrr) * 100;
};

subscriptionAnalyticsSchema.methods.calculateLtvToCacRatio = function (this: ISubscriptionAnalytics): number {
  return this.cac > 0 ? this.ltv / this.cac : 0;
};

subscriptionAnalyticsSchema.methods.getHealthScore = function (this: ISubscriptionAnalytics): number {
  // Simple health score calculation based on key metrics
  const churnScore = Math.max(0, 100 - this.churnRate * 2);
  const ltvCacScore = Math.min(100, (this.calculateLtvToCacRatio() / 3) * 100);
  const retentionScore = (this.netRevenueRetention + this.grossRevenueRetention) / 2;

  return (churnScore + ltvCacScore + retentionScore) / 3;
};

export const SubscriptionAnalytics = mongoose.model<ISubscriptionAnalytics>('SubscriptionAnalytics', subscriptionAnalyticsSchema);