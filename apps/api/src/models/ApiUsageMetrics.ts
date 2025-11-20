import mongoose, { Document, Schema } from 'mongoose';

export interface IApiUsageMetrics extends Document {
  endpoint: string;
  method: string;
  version: string;
  userId?: mongoose.Types.ObjectId;
  apiKeyId?: string;
  timestamp: Date;
  responseTime: number;
  statusCode: number;
  requestSize: number;
  responseSize: number;
  userAgent?: string;
  ipAddress: string;
  errorMessage?: string;
  metadata: Record<string, any>;
}

const ApiUsageMetricsSchema = new Schema<IApiUsageMetrics>({
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    index: true
  },
  version: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  apiKeyId: {
    type: String,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  responseTime: {
    type: Number,
    required: true
  },
  statusCode: {
    type: Number,
    required: true,
    index: true
  },
  requestSize: {
    type: Number,
    default: 0
  },
  responseSize: {
    type: Number,
    default: 0
  },
  userAgent: String,
  ipAddress: {
    type: String,
    required: true
  },
  errorMessage: String,
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: false // We use our own timestamp field
});

// Compound indexes for efficient querying
ApiUsageMetricsSchema.index({ endpoint: 1, method: 1, timestamp: -1 });
ApiUsageMetricsSchema.index({ userId: 1, timestamp: -1 });
ApiUsageMetricsSchema.index({ apiKeyId: 1, timestamp: -1 });
ApiUsageMetricsSchema.index({ statusCode: 1, timestamp: -1 });
ApiUsageMetricsSchema.index({ timestamp: -1 }); // For time-based queries

// TTL index to automatically delete old metrics (90 days)
ApiUsageMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model<IApiUsageMetrics>('ApiUsageMetrics', ApiUsageMetricsSchema);