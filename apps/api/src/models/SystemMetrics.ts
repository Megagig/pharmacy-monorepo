import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemMetrics extends Document {
  timestamp: Date;
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  activeSubscriptions: number;
  totalWorkspaces: number;
  monthlyRevenue: number;
  systemUptime: string;
  activeFeatureFlags: number;
  pendingLicenses: number;
  supportTickets: {
    open: number;
    resolved: number;
    critical: number;
  };
  systemHealth: {
    database: {
      status: 'healthy' | 'warning' | 'critical';
      responseTime: number;
      connections: number;
    };
    api: {
      status: 'healthy' | 'warning' | 'critical';
      responseTime: number;
      requestsPerMinute: number;
    };
    memory: {
      status: 'healthy' | 'warning' | 'critical';
      usage: number;
      available: number;
    };
    cache: {
      status: 'healthy' | 'warning' | 'critical';
      hitRate: number;
      connections: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const systemMetricsSchema = new Schema<ISystemMetrics>(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    totalUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    activeUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    newUsersToday: {
      type: Number,
      required: true,
      min: 0,
    },
    activeSubscriptions: {
      type: Number,
      required: true,
      min: 0,
    },
    totalWorkspaces: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyRevenue: {
      type: Number,
      required: true,
      min: 0,
    },
    systemUptime: {
      type: String,
      required: true,
    },
    activeFeatureFlags: {
      type: Number,
      required: true,
      min: 0,
    },
    pendingLicenses: {
      type: Number,
      required: true,
      min: 0,
    },
    supportTickets: {
      open: {
        type: Number,
        required: true,
        min: 0,
      },
      resolved: {
        type: Number,
        required: true,
        min: 0,
      },
      critical: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    systemHealth: {
      database: {
        status: {
          type: String,
          enum: ['healthy', 'warning', 'critical'],
          required: true,
        },
        responseTime: {
          type: Number,
          required: true,
          min: 0,
        },
        connections: {
          type: Number,
          required: true,
          min: 0,
        },
      },
      api: {
        status: {
          type: String,
          enum: ['healthy', 'warning', 'critical'],
          required: true,
        },
        responseTime: {
          type: Number,
          required: true,
          min: 0,
        },
        requestsPerMinute: {
          type: Number,
          required: true,
          min: 0,
        },
      },
      memory: {
        status: {
          type: String,
          enum: ['healthy', 'warning', 'critical'],
          required: true,
        },
        usage: {
          type: Number,
          required: true,
          min: 0,
        },
        available: {
          type: Number,
          required: true,
          min: 0,
        },
      },
      cache: {
        status: {
          type: String,
          enum: ['healthy', 'warning', 'critical'],
          required: true,
        },
        hitRate: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        connections: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    },
  },
  {
    timestamps: true,
    collection: 'systemmetrics',
  }
);

// Indexes for time-series queries
systemMetricsSchema.index({ timestamp: -1 });
systemMetricsSchema.index({ createdAt: -1 });
systemMetricsSchema.index({ timestamp: 1, createdAt: 1 });

// TTL index to automatically delete old metrics after 1 year
systemMetricsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

// Methods
systemMetricsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export const SystemMetrics = mongoose.model<ISystemMetrics>('SystemMetrics', systemMetricsSchema);