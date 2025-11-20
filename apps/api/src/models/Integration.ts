import mongoose, { Document, Schema } from 'mongoose';

export interface IIntegration extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'webhook' | 'api' | 'database' | 'file_sync' | 'email' | 'sms' | 'custom';
  provider: string;
  configuration: {
    endpoint?: string;
    apiKey?: string;
    credentials?: Record<string, any>;
    settings: Record<string, any>;
  };
  mapping: {
    sourceField: string;
    targetField: string;
    transformation?: string;
  }[];
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  isActive: boolean;
  lastSync?: Date;
  lastSyncStatus?: 'success' | 'failed' | 'partial';
  lastSyncError?: string;
  statistics: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    recordsProcessed: number;
    lastSyncDuration: number; // in milliseconds
  };
  filters: {
    conditions: {
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
      value: any;
    }[];
    logicalOperator: 'AND' | 'OR';
  };
  errorHandling: {
    onError: 'stop' | 'continue' | 'retry';
    maxRetries: number;
    retryDelay: number; // in seconds
    notifyOnError: boolean;
    errorWebhook?: string;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>({
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
  type: {
    type: String,
    required: true,
    enum: ['webhook', 'api', 'database', 'file_sync', 'email', 'sms', 'custom'],
    index: true
  },
  provider: {
    type: String,
    required: true,
    trim: true
  },
  configuration: {
    endpoint: String,
    apiKey: String,
    credentials: {
      type: Schema.Types.Mixed,
      default: {}
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  mapping: [{
    sourceField: {
      type: String,
      required: true
    },
    targetField: {
      type: String,
      required: true
    },
    transformation: String
  }],
  syncDirection: {
    type: String,
    enum: ['inbound', 'outbound', 'bidirectional'],
    required: true,
    index: true
  },
  syncFrequency: {
    type: String,
    enum: ['realtime', 'hourly', 'daily', 'weekly', 'manual'],
    default: 'manual',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastSync: Date,
  lastSyncStatus: {
    type: String,
    enum: ['success', 'failed', 'partial']
  },
  lastSyncError: String,
  statistics: {
    totalSyncs: {
      type: Number,
      default: 0
    },
    successfulSyncs: {
      type: Number,
      default: 0
    },
    failedSyncs: {
      type: Number,
      default: 0
    },
    recordsProcessed: {
      type: Number,
      default: 0
    },
    lastSyncDuration: {
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
  errorHandling: {
    onError: {
      type: String,
      enum: ['stop', 'continue', 'retry'],
      default: 'stop'
    },
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
    notifyOnError: {
      type: Boolean,
      default: true
    },
    errorWebhook: String
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
IntegrationSchema.index({ userId: 1, isActive: 1 });
IntegrationSchema.index({ type: 1, provider: 1 });
IntegrationSchema.index({ syncFrequency: 1, isActive: 1 });
IntegrationSchema.index({ lastSync: -1 });

// Methods
IntegrationSchema.methods.updateSyncStatistics = function(
  success: boolean,
  recordsProcessed: number = 0,
  duration: number = 0,
  error?: string
): void {
  this.statistics.totalSyncs += 1;
  this.statistics.recordsProcessed += recordsProcessed;
  this.statistics.lastSyncDuration = duration;
  
  if (success) {
    this.statistics.successfulSyncs += 1;
    this.lastSyncStatus = 'success';
    this.lastSyncError = undefined;
  } else {
    this.statistics.failedSyncs += 1;
    this.lastSyncStatus = 'failed';
    this.lastSyncError = error;
  }
  
  this.lastSync = new Date();
};

IntegrationSchema.methods.shouldSync = function(): boolean {
  if (!this.isActive) {
    return false;
  }
  
  if (this.syncFrequency === 'manual' || this.syncFrequency === 'realtime') {
    return false; // These are triggered manually or by events
  }
  
  if (!this.lastSync) {
    return true; // Never synced before
  }
  
  const now = new Date();
  const lastSync = new Date(this.lastSync);
  const timeDiff = now.getTime() - lastSync.getTime();
  
  switch (this.syncFrequency) {
    case 'hourly':
      return timeDiff >= 60 * 60 * 1000; // 1 hour
    case 'daily':
      return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
    case 'weekly':
      return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
    default:
      return false;
  }
};

IntegrationSchema.methods.applyMapping = function(sourceData: any): any {
  const mappedData: any = {};
  
  this.mapping.forEach((map: any) => {
    let value = this.getNestedValue(sourceData, map.sourceField);
    
    // Apply transformation if specified
    if (map.transformation && value !== undefined) {
      value = this.applyTransformation(value, map.transformation);
    }
    
    this.setNestedValue(mappedData, map.targetField, value);
  });
  
  return mappedData;
};

IntegrationSchema.methods.getNestedValue = function(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

IntegrationSchema.methods.setNestedValue = function(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
};

IntegrationSchema.methods.applyTransformation = function(value: any, transformation: string): any {
  try {
    // Simple transformation functions
    switch (transformation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      default:
        // For more complex transformations, you could use a safe eval or function parser
        return value;
    }
  } catch (error) {
    console.error('Transformation error:', error);
    return value;
  }
};

export default mongoose.model<IIntegration>('Integration', IntegrationSchema);