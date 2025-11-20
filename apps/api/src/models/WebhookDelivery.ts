import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookDelivery extends Document {
  webhookId: mongoose.Types.ObjectId;
  eventType: string;
  eventId: string;
  payload: any;
  url: string;
  httpMethod: string;
  headers: Record<string, string>;
  attempts: {
    attemptNumber: number;
    timestamp: Date;
    responseStatus?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    responseTime: number;
    error?: string;
    success: boolean;
  }[];
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  nextRetryAt?: Date;
  finalizedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>({
  webhookId: {
    type: Schema.Types.ObjectId,
    ref: 'Webhook',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  eventId: {
    type: String,
    required: true,
    index: true
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  httpMethod: {
    type: String,
    default: 'POST',
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  headers: {
    type: Schema.Types.Mixed,
    default: {}
  },
  attempts: [{
    attemptNumber: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    responseStatus: Number,
    responseHeaders: {
      type: Schema.Types.Mixed,
      default: {}
    },
    responseBody: String,
    responseTime: {
      type: Number,
      required: true
    },
    error: String,
    success: {
      type: Boolean,
      required: true
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  nextRetryAt: {
    type: Date,
    index: true
  },
  finalizedAt: Date,
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
WebhookDeliverySchema.index({ webhookId: 1, status: 1 });
WebhookDeliverySchema.index({ eventType: 1, createdAt: -1 });
WebhookDeliverySchema.index({ nextRetryAt: 1 });
WebhookDeliverySchema.index({ createdAt: -1 });

// TTL index to automatically delete old deliveries (90 days)
WebhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Methods
WebhookDeliverySchema.methods.addAttempt = function(
  attemptData: {
    responseStatus?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    responseTime: number;
    error?: string;
    success: boolean;
  }
): void {
  const attemptNumber = this.attempts.length + 1;
  
  this.attempts.push({
    attemptNumber,
    timestamp: new Date(),
    ...attemptData
  });
  
  if (attemptData.success) {
    this.status = 'delivered';
    this.finalizedAt = new Date();
    this.nextRetryAt = undefined;
  }
};

WebhookDeliverySchema.methods.scheduleRetry = function(
  retryDelay: number,
  backoffMultiplier: number = 2
): void {
  const attemptNumber = this.attempts.length;
  const delay = retryDelay * Math.pow(backoffMultiplier, attemptNumber - 1);
  this.nextRetryAt = new Date(Date.now() + delay * 1000);
};

WebhookDeliverySchema.methods.markAsFailed = function(): void {
  this.status = 'failed';
  this.finalizedAt = new Date();
  this.nextRetryAt = undefined;
};

WebhookDeliverySchema.methods.cancel = function(): void {
  this.status = 'cancelled';
  this.finalizedAt = new Date();
  this.nextRetryAt = undefined;
};

WebhookDeliverySchema.methods.getLastAttempt = function() {
  return this.attempts[this.attempts.length - 1];
};

WebhookDeliverySchema.methods.isRetryable = function(maxRetries: number): boolean {
  return this.attempts.length < maxRetries && this.status === 'pending';
};

export default mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);