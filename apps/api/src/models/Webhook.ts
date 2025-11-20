import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhook extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  headers: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // in seconds
    backoffMultiplier: number;
  };
  timeout: number; // in milliseconds
  lastTriggered?: Date;
  lastStatus?: 'success' | 'failed' | 'timeout';
  lastError?: string;
  statistics: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
  };
  filters: {
    conditions: {
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
      value: any;
    }[];
    logicalOperator: 'AND' | 'OR';
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSchema = new Schema<IWebhook>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  url: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'URL must be a valid HTTP or HTTPS URL'
    }
  },
  events: [{
    type: String,
    required: true,
    enum: [
      'user.created',
      'user.updated',
      'user.deleted',
      'order.created',
      'order.updated',
      'order.completed',
      'order.cancelled',
      'payment.succeeded',
      'payment.failed',
      'subscription.created',
      'subscription.updated',
      'subscription.cancelled',
      'invoice.created',
      'invoice.paid',
      'api.rate_limit_exceeded',
      'system.maintenance_scheduled',
      'custom.*'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  secret: {
    type: String,
    required: true
  },
  headers: {
    type: Schema.Types.Mixed,
    default: {}
  },
  retryPolicy: {
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    },
    retryDelay: {
      type: Number,
      default: 60, // 1 minute
      min: 1,
      max: 3600 // 1 hour
    },
    backoffMultiplier: {
      type: Number,
      default: 2,
      min: 1,
      max: 10
    }
  },
  timeout: {
    type: Number,
    default: 30000, // 30 seconds
    min: 1000,
    max: 300000 // 5 minutes
  },
  lastTriggered: Date,
  lastStatus: {
    type: String,
    enum: ['success', 'failed', 'timeout']
  },
  lastError: String,
  statistics: {
    totalDeliveries: {
      type: Number,
      default: 0
    },
    successfulDeliveries: {
      type: Number,
      default: 0
    },
    failedDeliveries: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  },
  filters: {
    conditions: [{
      field: {
        type: String,
        required: true
      },
      operator: {
        type: String,
        enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than'],
        required: true
      },
      value: Schema.Types.Mixed
    }],
    logicalOperator: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND'
    }
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
WebhookSchema.index({ userId: 1, isActive: 1 });
WebhookSchema.index({ events: 1, isActive: 1 });
WebhookSchema.index({ lastTriggered: -1 });

// Methods
WebhookSchema.methods.updateStatistics = function(responseTime: number, success: boolean): void {
  this.statistics.totalDeliveries += 1;
  
  if (success) {
    this.statistics.successfulDeliveries += 1;
    this.lastStatus = 'success';
  } else {
    this.statistics.failedDeliveries += 1;
    this.lastStatus = 'failed';
  }
  
  // Update average response time
  const totalSuccessful = this.statistics.successfulDeliveries;
  if (totalSuccessful > 0) {
    this.statistics.averageResponseTime = 
      ((this.statistics.averageResponseTime * (totalSuccessful - 1)) + responseTime) / totalSuccessful;
  }
  
  this.lastTriggered = new Date();
};

WebhookSchema.methods.shouldTrigger = function(eventType: string, eventData: any): boolean {
  // Check if webhook is active
  if (!this.isActive) {
    return false;
  }
  
  // Check if event type matches
  const eventMatches = this.events.some((event: string) => {
    if (event.endsWith('*')) {
      const prefix = event.slice(0, -1);
      return eventType.startsWith(prefix);
    }
    return event === eventType;
  });
  
  if (!eventMatches) {
    return false;
  }
  
  // Check filters
  if (this.filters.conditions.length === 0) {
    return true;
  }
  
  const conditionResults = this.filters.conditions.map((condition: any) => {
    const fieldValue = this.getNestedValue(eventData, condition.field);
    return this.evaluateCondition(fieldValue, condition.operator, condition.value);
  });
  
  if (this.filters.logicalOperator === 'AND') {
    return conditionResults.every(Boolean);
  } else {
    return conditionResults.some(Boolean);
  }
};

WebhookSchema.methods.getNestedValue = function(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

WebhookSchema.methods.evaluateCondition = function(fieldValue: any, operator: string, expectedValue: any): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === expectedValue;
    case 'not_equals':
      return fieldValue !== expectedValue;
    case 'contains':
      return String(fieldValue).includes(String(expectedValue));
    case 'not_contains':
      return !String(fieldValue).includes(String(expectedValue));
    case 'greater_than':
      return Number(fieldValue) > Number(expectedValue);
    case 'less_than':
      return Number(fieldValue) < Number(expectedValue);
    default:
      return false;
  }
};

export default mongoose.model<IWebhook>('Webhook', WebhookSchema);