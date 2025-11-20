import mongoose, { Document, Schema } from 'mongoose';

export interface ITenantBranding {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontFamily?: string;
  customCss?: string;
}

export interface ITenantLimits {
  maxUsers: number;
  maxPatients: number;
  storageLimit: number; // in MB
  apiCallsPerMonth: number;
  maxWorkspaces: number;
  maxIntegrations: number;
}

export interface ITenantIntegration {
  name: string;
  type: 'ehr' | 'pos' | 'insurance' | 'payment' | 'analytics' | 'other';
  provider: string;
  isActive: boolean;
  configuration: Record<string, any>;
  lastSyncAt?: Date;
  syncStatus: 'success' | 'failed' | 'pending' | 'disabled';
  errorMessage?: string;
}

export interface ITenantUsageMetrics {
  currentUsers: number;
  currentPatients: number;
  storageUsed: number; // in MB
  apiCallsThisMonth: number;
  lastCalculatedAt: Date;
}

export interface ITenant extends Document {
  name: string;
  slug: string; // URL-friendly identifier
  type: 'pharmacy' | 'clinic' | 'hospital' | 'chain';
  status: 'active' | 'suspended' | 'pending' | 'trial' | 'cancelled';
  subscriptionPlan: mongoose.Types.ObjectId;
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'trialing';
  trialEndsAt?: Date;
  billingCycle: 'monthly' | 'yearly';
  
  // Contact Information
  contactInfo: {
    email: string;
    phone?: string;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    website?: string;
  };

  // Owner/Admin Information
  primaryContact: {
    userId: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };

  // Tenant Configuration
  settings: {
    timezone: string;
    currency: string;
    language: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };

  branding: ITenantBranding;
  limits: ITenantLimits;
  features: string[]; // Array of enabled feature flags
  integrations: ITenantIntegration[];
  usageMetrics: ITenantUsageMetrics;

  // Compliance and Security
  complianceSettings: {
    dataRetentionDays: number;
    auditLogsEnabled: boolean;
    encryptionEnabled: boolean;
    backupEnabled: boolean;
    gdprCompliant: boolean;
  };

  // Billing Information
  billingInfo: {
    customerId?: string; // External billing system ID
    paymentMethodId?: string;
    lastPaymentAt?: Date;
    nextBillingAt?: Date;
    outstandingBalance: number;
  };

  // Metadata
  metadata: Record<string, any>;
  tags: string[];
  
  // Timestamps and Audit
  createdBy: mongoose.Types.ObjectId;
  lastModifiedBy: mongoose.Types.ObjectId;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tenantBrandingSchema = new Schema<ITenantBranding>({
  logo: {
    type: String,
  },
  primaryColor: {
    type: String,
    required: true,
    default: '#3B82F6',
    validate: {
      validator: function(color: string) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
      },
      message: 'Invalid color format. Use hex format (#RRGGBB or #RGB)',
    },
  },
  secondaryColor: {
    type: String,
    required: true,
    default: '#6B7280',
    validate: {
      validator: function(color: string) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
      },
      message: 'Invalid color format. Use hex format (#RRGGBB or #RGB)',
    },
  },
  accentColor: {
    type: String,
    validate: {
      validator: function(color: string) {
        return !color || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
      },
      message: 'Invalid color format. Use hex format (#RRGGBB or #RGB)',
    },
  },
  fontFamily: {
    type: String,
    default: 'Inter, sans-serif',
  },
  customCss: {
    type: String,
  },
}, { _id: false });

const tenantLimitsSchema = new Schema<ITenantLimits>({
  maxUsers: {
    type: Number,
    required: true,
    min: 1,
    default: 10,
  },
  maxPatients: {
    type: Number,
    required: true,
    min: 0,
    default: 1000,
  },
  storageLimit: {
    type: Number,
    required: true,
    min: 100, // 100MB minimum
    default: 5000, // 5GB default
  },
  apiCallsPerMonth: {
    type: Number,
    required: true,
    min: 1000,
    default: 10000,
  },
  maxWorkspaces: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  maxIntegrations: {
    type: Number,
    required: true,
    min: 0,
    default: 5,
  },
}, { _id: false });

const tenantIntegrationSchema = new Schema<ITenantIntegration>({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['ehr', 'pos', 'insurance', 'payment', 'analytics', 'other'],
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    required: true,
    default: false,
  },
  configuration: {
    type: Schema.Types.Mixed,
    required: true,
    default: {},
  },
  lastSyncAt: {
    type: Date,
  },
  syncStatus: {
    type: String,
    enum: ['success', 'failed', 'pending', 'disabled'],
    required: true,
    default: 'disabled',
  },
  errorMessage: {
    type: String,
  },
}, { _id: false });

const tenantUsageMetricsSchema = new Schema<ITenantUsageMetrics>({
  currentUsers: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  currentPatients: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  storageUsed: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  apiCallsThisMonth: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  lastCalculatedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
}, { _id: false });

const tenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(slug: string) {
          return /^[a-z0-9-]+$/.test(slug);
        },
        message: 'Slug can only contain lowercase letters, numbers, and hyphens',
      },
    },
    type: {
      type: String,
      enum: ['pharmacy', 'clinic', 'hospital', 'chain'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending', 'trial', 'cancelled'],
      required: true,
      default: 'pending',
      index: true,
    },
    subscriptionPlan: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'past_due', 'cancelled', 'trialing'],
      required: true,
      default: 'trialing',
      index: true,
    },
    trialEndsAt: {
      type: Date,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
      default: 'monthly',
    },
    contactInfo: {
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        validate: {
          validator: function(email: string) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          },
          message: 'Invalid email format',
        },
      },
      phone: {
        type: String,
        trim: true,
      },
      address: {
        street: {
          type: String,
          required: true,
          trim: true,
        },
        city: {
          type: String,
          required: true,
          trim: true,
        },
        state: {
          type: String,
          required: true,
          trim: true,
        },
        country: {
          type: String,
          required: true,
          trim: true,
        },
        postalCode: {
          type: String,
          required: true,
          trim: true,
        },
      },
      website: {
        type: String,
        trim: true,
      },
    },
    primaryContact: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },
    settings: {
      timezone: {
        type: String,
        required: true,
        default: 'UTC',
      },
      currency: {
        type: String,
        required: true,
        default: 'USD',
        uppercase: true,
        validate: {
          validator: function(currency: string) {
            return /^[A-Z]{3}$/.test(currency);
          },
          message: 'Currency must be a 3-letter ISO code',
        },
      },
      language: {
        type: String,
        required: true,
        default: 'en',
        lowercase: true,
      },
      dateFormat: {
        type: String,
        required: true,
        default: 'MM/DD/YYYY',
      },
      timeFormat: {
        type: String,
        enum: ['12h', '24h'],
        required: true,
        default: '12h',
      },
    },
    branding: {
      type: tenantBrandingSchema,
      required: true,
    },
    limits: {
      type: tenantLimitsSchema,
      required: true,
    },
    features: [{
      type: String,
      trim: true,
    }],
    integrations: [tenantIntegrationSchema],
    usageMetrics: {
      type: tenantUsageMetricsSchema,
      required: true,
    },
    complianceSettings: {
      dataRetentionDays: {
        type: Number,
        required: true,
        min: 30,
        max: 2555, // 7 years
        default: 2555,
      },
      auditLogsEnabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      encryptionEnabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      backupEnabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      gdprCompliant: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    billingInfo: {
      customerId: {
        type: String,
      },
      paymentMethodId: {
        type: String,
      },
      lastPaymentAt: {
        type: Date,
      },
      nextBillingAt: {
        type: Date,
      },
      outstandingBalance: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tags: [{
      type: String,
      trim: true,
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastActivity: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'tenants',
  }
);

// Indexes
tenantSchema.index({ slug: 1 }, { unique: true });
tenantSchema.index({ status: 1, type: 1 });
tenantSchema.index({ subscriptionStatus: 1 });
tenantSchema.index({ 'contactInfo.email': 1 });
tenantSchema.index({ 'primaryContact.userId': 1 });
tenantSchema.index({ tags: 1 });
tenantSchema.index({ lastActivity: -1 });
tenantSchema.index({ createdAt: -1 });

// Compound indexes
tenantSchema.index({ status: 1, subscriptionStatus: 1 });
tenantSchema.index({ type: 1, status: 1, createdAt: -1 });

// Methods
tenantSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  // Don't expose sensitive billing information
  if (obj.billingInfo) {
    delete obj.billingInfo.paymentMethodId;
  }
  return obj;
};

tenantSchema.methods.isActive = function (): boolean {
  return this.status === 'active' && 
         (this.subscriptionStatus === 'active' || this.subscriptionStatus === 'trialing');
};

tenantSchema.methods.isTrialExpired = function (): boolean {
  return this.subscriptionStatus === 'trialing' && 
         this.trialEndsAt && 
         new Date() > this.trialEndsAt;
};

tenantSchema.methods.hasFeature = function (featureName: string): boolean {
  return this.features.includes(featureName);
};

tenantSchema.methods.isWithinLimits = function (): { withinLimits: boolean; violations: string[] } {
  const violations: string[] = [];

  if (this.usageMetrics.currentUsers > this.limits.maxUsers) {
    violations.push(`User limit exceeded: ${this.usageMetrics.currentUsers}/${this.limits.maxUsers}`);
  }

  if (this.usageMetrics.currentPatients > this.limits.maxPatients) {
    violations.push(`Patient limit exceeded: ${this.usageMetrics.currentPatients}/${this.limits.maxPatients}`);
  }

  if (this.usageMetrics.storageUsed > this.limits.storageLimit) {
    violations.push(`Storage limit exceeded: ${this.usageMetrics.storageUsed}MB/${this.limits.storageLimit}MB`);
  }

  if (this.usageMetrics.apiCallsThisMonth > this.limits.apiCallsPerMonth) {
    violations.push(`API calls limit exceeded: ${this.usageMetrics.apiCallsThisMonth}/${this.limits.apiCallsPerMonth}`);
  }

  return {
    withinLimits: violations.length === 0,
    violations,
  };
};

tenantSchema.methods.updateUsageMetrics = function (metrics: Partial<ITenantUsageMetrics>): void {
  Object.assign(this.usageMetrics, metrics);
  this.usageMetrics.lastCalculatedAt = new Date();
};

tenantSchema.methods.addIntegration = function (integration: Omit<ITenantIntegration, 'isActive' | 'syncStatus'>): void {
  if (this.integrations.length >= this.limits.maxIntegrations) {
    throw new Error('Integration limit exceeded');
  }

  this.integrations.push({
    ...integration,
    isActive: false,
    syncStatus: 'disabled',
  });
};

tenantSchema.methods.updateIntegrationStatus = function (integrationName: string, status: ITenantIntegration['syncStatus'], errorMessage?: string): void {
  const integration = this.integrations.find(i => i.name === integrationName);
  if (integration) {
    integration.syncStatus = status;
    integration.lastSyncAt = new Date();
    if (errorMessage) {
      integration.errorMessage = errorMessage;
    } else {
      integration.errorMessage = undefined;
    }
  }
};

tenantSchema.methods.suspend = function (reason?: string): void {
  this.status = 'suspended';
  this.lastActivity = new Date();
  if (reason) {
    this.metadata.suspensionReason = reason;
    this.metadata.suspendedAt = new Date();
  }
};

tenantSchema.methods.reactivate = function (): void {
  this.status = 'active';
  this.lastActivity = new Date();
  if (this.metadata.suspensionReason) {
    delete this.metadata.suspensionReason;
    delete this.metadata.suspendedAt;
  }
};

// Static methods
tenantSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug: slug.toLowerCase() });
};

tenantSchema.statics.findActiveTenants = function () {
  return this.find({ 
    status: 'active', 
    subscriptionStatus: { $in: ['active', 'trialing'] } 
  });
};

tenantSchema.statics.findExpiredTrials = function () {
  return this.find({
    subscriptionStatus: 'trialing',
    trialEndsAt: { $lt: new Date() },
  });
};

tenantSchema.statics.getTenantStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalTenants: { $sum: 1 },
        activeTenants: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        trialTenants: { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'trialing'] }, 1, 0] } },
        suspendedTenants: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        tenantsByType: {
          $push: '$type'
        },
      },
    },
  ]);
};

tenantSchema.statics.findTenantsExceedingLimits = function () {
  return this.find({
    $or: [
      { $expr: { $gt: ['$usageMetrics.currentUsers', '$limits.maxUsers'] } },
      { $expr: { $gt: ['$usageMetrics.currentPatients', '$limits.maxPatients'] } },
      { $expr: { $gt: ['$usageMetrics.storageUsed', '$limits.storageLimit'] } },
      { $expr: { $gt: ['$usageMetrics.apiCallsThisMonth', '$limits.apiCallsPerMonth'] } },
    ],
  });
};

tenantSchema.statics.createTenant = function (tenantData: Partial<ITenant>, adminId: mongoose.Types.ObjectId) {
  // Generate slug from name if not provided
  if (!tenantData.slug && tenantData.name) {
    tenantData.slug = tenantData.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Set default branding
  if (!tenantData.branding) {
    tenantData.branding = {
      primaryColor: '#3B82F6',
      secondaryColor: '#6B7280',
    };
  }

  // Set default limits
  if (!tenantData.limits) {
    tenantData.limits = {
      maxUsers: 10,
      maxPatients: 1000,
      storageLimit: 5000,
      apiCallsPerMonth: 10000,
      maxWorkspaces: 1,
      maxIntegrations: 5,
    };
  }

  // Set default usage metrics
  if (!tenantData.usageMetrics) {
    tenantData.usageMetrics = {
      currentUsers: 0,
      currentPatients: 0,
      storageUsed: 0,
      apiCallsThisMonth: 0,
      lastCalculatedAt: new Date(),
    };
  }

  return this.create({
    ...tenantData,
    createdBy: adminId,
    lastModifiedBy: adminId,
  });
};

export const Tenant = mongoose.model<ITenant>('Tenant', tenantSchema);