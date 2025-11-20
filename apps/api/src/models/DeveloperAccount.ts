import mongoose, { Document, Schema } from 'mongoose';

export interface IDeveloperAccount extends Document {
  userId: mongoose.Types.ObjectId;
  companyName?: string;
  website?: string;
  description?: string;
  contactEmail: string;
  contactPhone?: string;
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  apiQuota: {
    monthly: number;
    daily: number;
    perMinute: number;
  };
  usage: {
    currentMonth: number;
    currentDay: number;
    lastReset: Date;
  };
  subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  onboardingCompleted: boolean;
  onboardingSteps: {
    profileSetup: boolean;
    emailVerification: boolean;
    firstApiKey: boolean;
    firstApiCall: boolean;
    documentationRead: boolean;
  };
  preferences: {
    emailNotifications: boolean;
    webhookNotifications: boolean;
    maintenanceAlerts: boolean;
    usageAlerts: boolean;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DeveloperAccountSchema = new Schema<IDeveloperAccount>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  companyName: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true;
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Website must be a valid URL'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  contactPhone: {
    type: String,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  apiQuota: {
    monthly: {
      type: Number,
      default: 10000
    },
    daily: {
      type: Number,
      default: 1000
    },
    perMinute: {
      type: Number,
      default: 60
    }
  },
  usage: {
    currentMonth: {
      type: Number,
      default: 0
    },
    currentDay: {
      type: Number,
      default: 0
    },
    lastReset: {
      type: Date,
      default: Date.now
    }
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    default: 'free',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'pending',
    index: true
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  onboardingSteps: {
    profileSetup: {
      type: Boolean,
      default: false
    },
    emailVerification: {
      type: Boolean,
      default: false
    },
    firstApiKey: {
      type: Boolean,
      default: false
    },
    firstApiCall: {
      type: Boolean,
      default: false
    },
    documentationRead: {
      type: Boolean,
      default: false
    }
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    webhookNotifications: {
      type: Boolean,
      default: true
    },
    maintenanceAlerts: {
      type: Boolean,
      default: true
    },
    usageAlerts: {
      type: Boolean,
      default: true
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
DeveloperAccountSchema.index({ contactEmail: 1 });
DeveloperAccountSchema.index({ subscriptionTier: 1, status: 1 });
DeveloperAccountSchema.index({ createdAt: -1 });

// Methods
DeveloperAccountSchema.methods.checkOnboardingProgress = function(): number {
  const steps = this.onboardingSteps;
  const completedSteps = Object.values(steps).filter(Boolean).length;
  const totalSteps = Object.keys(steps).length;
  return Math.round((completedSteps / totalSteps) * 100);
};

DeveloperAccountSchema.methods.isWithinQuota = function(requestCount: number = 1): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Reset daily usage if it's a new day
  if (this.usage.lastReset < today) {
    this.usage.currentDay = 0;
    this.usage.lastReset = now;
  }
  
  // Reset monthly usage if it's a new month
  if (this.usage.lastReset < thisMonth) {
    this.usage.currentMonth = 0;
  }
  
  return (
    this.usage.currentMonth + requestCount <= this.apiQuota.monthly &&
    this.usage.currentDay + requestCount <= this.apiQuota.daily
  );
};

DeveloperAccountSchema.methods.incrementUsage = function(requestCount: number = 1): void {
  this.usage.currentMonth += requestCount;
  this.usage.currentDay += requestCount;
};

export default mongoose.model<IDeveloperAccount>('DeveloperAccount', DeveloperAccountSchema);