import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeSeriesData {
  date: Date;
  value: number;
}

export interface IRoleDistribution {
  role: string;
  count: number;
  percentage: number;
}

export interface ISubscriptionDistribution {
  planName: string;
  count: number;
  percentage: number;
}

export interface IGeographicData {
  country: string;
  state?: string;
  city?: string;
  count: number;
  percentage: number;
}

export interface IUserAnalytics extends Document {
  date: Date;
  registrationTrend: ITimeSeriesData[];
  activationRate: number;
  churnRate: number;
  usersByRole: IRoleDistribution[];
  usersBySubscription: ISubscriptionDistribution[];
  geographicDistribution: IGeographicData[];
  totalRegistrations: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  averageSessionDuration: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  calculateTotalUsers(): number;
  getEngagementRate(): number;
}

const timeSeriesDataSchema = new Schema<ITimeSeriesData>({
  date: {
    type: Date,
    required: true,
  },
  value: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const roleDistributionSchema = new Schema<IRoleDistribution>({
  role: {
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
}, { _id: false });

const subscriptionDistributionSchema = new Schema<ISubscriptionDistribution>({
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
}, { _id: false });

const geographicDataSchema = new Schema<IGeographicData>({
  country: {
    type: String,
    required: true,
  },
  state: {
    type: String,
  },
  city: {
    type: String,
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
}, { _id: false });

const userAnalyticsSchema = new Schema<IUserAnalytics>(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    registrationTrend: [timeSeriesDataSchema],
    activationRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    churnRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    usersByRole: [roleDistributionSchema],
    usersBySubscription: [subscriptionDistributionSchema],
    geographicDistribution: [geographicDataSchema],
    totalRegistrations: {
      type: Number,
      required: true,
      min: 0,
    },
    activeUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    inactiveUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    suspendedUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    averageSessionDuration: {
      type: Number,
      required: true,
      min: 0,
    },
    dailyActiveUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    weeklyActiveUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyActiveUsers: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'useranalytics',
  }
);

// Indexes for time-series queries
userAnalyticsSchema.index({ date: -1 });
userAnalyticsSchema.index({ createdAt: -1 });
userAnalyticsSchema.index({ date: 1, createdAt: 1 });

// Compound indexes for efficient queries
userAnalyticsSchema.index({ date: -1, activationRate: -1 });
userAnalyticsSchema.index({ date: -1, churnRate: -1 });

// TTL index to automatically delete old analytics after 2 years
userAnalyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Methods
userAnalyticsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

userAnalyticsSchema.methods.calculateTotalUsers = function (this: IUserAnalytics): number {
  return this.activeUsers + this.inactiveUsers + this.suspendedUsers;
};

userAnalyticsSchema.methods.getEngagementRate = function (this: IUserAnalytics): number {
  const totalUsers = this.calculateTotalUsers();
  return totalUsers > 0 ? (this.activeUsers / totalUsers) * 100 : 0;
};

export const UserAnalytics = mongoose.model<IUserAnalytics>('UserAnalytics', userAnalyticsSchema);