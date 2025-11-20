import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey extends Document {
  keyId: string;
  hashedKey: string;
  name: string;
  description?: string;
  userId: mongoose.Types.ObjectId;
  scopes: string[];
  rateLimit: {
    requests: number;
    window: number; // in seconds
  };
  usage: {
    totalRequests: number;
    lastUsed?: Date;
    dailyUsage: {
      date: Date;
      requests: number;
    }[];
  };
  isActive: boolean;
  expiresAt?: Date;
  allowedIPs: string[];
  allowedDomains: string[];
  environment: 'development' | 'staging' | 'production';
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  generateKey(): string;
  validateKey(key: string): boolean;
  incrementUsage(): Promise<void>;
  isExpired(): boolean;
  isRateLimited(): boolean;
}

const ApiKeySchema = new Schema<IApiKey>({
  keyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hashedKey: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  scopes: [{
    type: String,
    required: true
  }],
  rateLimit: {
    requests: {
      type: Number,
      default: 1000
    },
    window: {
      type: Number,
      default: 3600 // 1 hour
    }
  },
  usage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    dailyUsage: [{
      date: {
        type: Date,
        required: true
      },
      requests: {
        type: Number,
        default: 0
      }
    }]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  allowedIPs: [String],
  allowedDomains: [String],
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: 'development',
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ApiKeySchema.index({ userId: 1, isActive: 1 });
ApiKeySchema.index({ expiresAt: 1 });
ApiKeySchema.index({ 'usage.dailyUsage.date': 1 });

// Methods
ApiKeySchema.methods.generateKey = function(): string {
  const key = crypto.randomBytes(32).toString('hex');
  this.keyId = `pk_${crypto.randomBytes(16).toString('hex')}`;
  this.hashedKey = crypto.createHash('sha256').update(key).digest('hex');
  return `${this.keyId}.${key}`;
};

ApiKeySchema.methods.validateKey = function(key: string): boolean {
  const hashedInput = crypto.createHash('sha256').update(key).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(this.hashedKey, 'hex'),
    Buffer.from(hashedInput, 'hex')
  );
};

ApiKeySchema.methods.incrementUsage = async function(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  this.usage.totalRequests += 1;
  this.usage.lastUsed = new Date();
  
  // Update daily usage
  const todayUsage = this.usage.dailyUsage.find(
    (usage: any) => usage.date.getTime() === today.getTime()
  );
  
  if (todayUsage) {
    todayUsage.requests += 1;
  } else {
    this.usage.dailyUsage.push({
      date: today,
      requests: 1
    });
    
    // Keep only last 30 days
    if (this.usage.dailyUsage.length > 30) {
      this.usage.dailyUsage = this.usage.dailyUsage.slice(-30);
    }
  }
  
  await this.save();
};

ApiKeySchema.methods.isExpired = function(): boolean {
  return this.expiresAt && this.expiresAt < new Date();
};

ApiKeySchema.methods.isRateLimited = function(): boolean {
  const windowStart = new Date(Date.now() - (this.rateLimit.window * 1000));
  const recentUsage = this.usage.dailyUsage
    .filter((usage: any) => usage.date >= windowStart)
    .reduce((total: number, usage: any) => total + usage.requests, 0);
  
  return recentUsage >= this.rateLimit.requests;
};

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);