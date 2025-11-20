import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkflowSettings {
  requireApproval: boolean;
  approvalWorkflow: {
    steps: {
      name: string;
      approverRole: string;
      required: boolean;
      order: number;
    }[];
  };
  autoAssignment: {
    enabled: boolean;
    rules: {
      condition: string;
      assignTo: string;
    }[];
  };
}

export interface INotificationPreferences {
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    inApp: boolean;
  };
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  categories: {
    system: boolean;
    billing: boolean;
    security: boolean;
    updates: boolean;
  };
}

export interface ISecurityPreferences {
  passwordPolicy: {
    enforceComplexity: boolean;
    minLength: number;
    requireMFA: boolean;
    sessionTimeout: number; // in minutes
  };
  accessControl: {
    ipWhitelist: string[];
    allowedDomains: string[];
    restrictToBusinessHours: boolean;
    businessHours: {
      start: string;
      end: string;
      timezone: string;
    };
  };
  auditSettings: {
    logAllActions: boolean;
    retentionDays: number;
    alertOnSuspiciousActivity: boolean;
  };
}

export interface IIntegrationSettings {
  apiAccess: {
    enabled: boolean;
    rateLimits: {
      requestsPerMinute: number;
      requestsPerHour: number;
      requestsPerDay: number;
    };
    allowedIPs: string[];
  };
  webhooks: {
    enabled: boolean;
    endpoints: {
      url: string;
      events: string[];
      secret: string;
      isActive: boolean;
    }[];
  };
  dataSync: {
    enabled: boolean;
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
    lastSyncAt?: Date;
    syncStatus: 'success' | 'failed' | 'pending';
  };
}

export interface ICustomization {
  theme: {
    mode: 'light' | 'dark' | 'auto';
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    borderRadius: 'none' | 'small' | 'medium' | 'large';
  };
  layout: {
    sidebarCollapsed: boolean;
    density: 'compact' | 'comfortable' | 'spacious';
    showBreadcrumbs: boolean;
    showQuickActions: boolean;
  };
  dashboard: {
    widgets: {
      id: string;
      type: string;
      position: { x: number; y: number; w: number; h: number };
      config: Record<string, any>;
      isVisible: boolean;
    }[];
    refreshInterval: number; // in seconds
  };
}

export interface ITenantSettings extends Document {
  tenantId: mongoose.Types.ObjectId;
  
  // Core Settings
  general: {
    tenantName: string;
    displayName: string;
    description?: string;
    timezone: string;
    locale: string;
    currency: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };

  // Feature Toggles
  features: {
    enabledModules: string[];
    betaFeatures: string[];
    experimentalFeatures: string[];
    customFeatures: Record<string, any>;
  };

  // Workflow Configuration
  workflows: {
    patientManagement: IWorkflowSettings;
    prescriptionProcessing: IWorkflowSettings;
    inventoryManagement: IWorkflowSettings;
    clinicalReviews: IWorkflowSettings;
  };

  // Notification Preferences
  notifications: INotificationPreferences;

  // Security Settings
  security: ISecurityPreferences;

  // Integration Configuration
  integrations: IIntegrationSettings;

  // UI Customization
  customization: ICustomization;

  // Business Rules
  businessRules: {
    operatingHours: {
      monday: { open: string; close: string; isOpen: boolean };
      tuesday: { open: string; close: string; isOpen: boolean };
      wednesday: { open: string; close: string; isOpen: boolean };
      thursday: { open: string; close: string; isOpen: boolean };
      friday: { open: string; close: string; isOpen: boolean };
      saturday: { open: string; close: string; isOpen: boolean };
      sunday: { open: string; close: string; isOpen: boolean };
    };
    holidays: {
      name: string;
      date: Date;
      isRecurring: boolean;
    }[];
    autoLogout: {
      enabled: boolean;
      idleTimeMinutes: number;
      warningTimeMinutes: number;
    };
  };

  // Compliance Settings
  compliance: {
    regulations: string[]; // e.g., ['HIPAA', 'GDPR', 'FDA']
    dataRetention: {
      patientRecords: number; // in years
      auditLogs: number; // in years
      backups: number; // in years
    };
    consentManagement: {
      required: boolean;
      types: string[];
      renewalPeriodDays: number;
    };
  };

  // Backup and Recovery
  backup: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    retentionDays: number;
    includeFiles: boolean;
    encryptBackups: boolean;
    lastBackupAt?: Date;
  };

  // Metadata
  version: number;
  isActive: boolean;
  lastModifiedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workflowSettingsSchema = new Schema<IWorkflowSettings>({
  requireApproval: {
    type: Boolean,
    required: true,
    default: false,
  },
  approvalWorkflow: {
    steps: [{
      name: {
        type: String,
        required: true,
      },
      approverRole: {
        type: String,
        required: true,
      },
      required: {
        type: Boolean,
        required: true,
        default: true,
      },
      order: {
        type: Number,
        required: true,
        min: 1,
      },
    }],
  },
  autoAssignment: {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    rules: [{
      condition: {
        type: String,
        required: true,
      },
      assignTo: {
        type: String,
        required: true,
      },
    }],
  },
}, { _id: false });

const notificationPreferencesSchema = new Schema<INotificationPreferences>({
  channels: {
    email: {
      type: Boolean,
      required: true,
      default: true,
    },
    sms: {
      type: Boolean,
      required: true,
      default: false,
    },
    push: {
      type: Boolean,
      required: true,
      default: true,
    },
    inApp: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  frequency: {
    type: String,
    enum: ['immediate', 'hourly', 'daily', 'weekly'],
    required: true,
    default: 'immediate',
  },
  quietHours: {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    startTime: {
      type: String,
      validate: {
        validator: function(time: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
        },
        message: 'Invalid time format. Use HH:MM format.',
      },
      default: '22:00',
    },
    endTime: {
      type: String,
      validate: {
        validator: function(time: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
        },
        message: 'Invalid time format. Use HH:MM format.',
      },
      default: '08:00',
    },
  },
  categories: {
    system: {
      type: Boolean,
      required: true,
      default: true,
    },
    billing: {
      type: Boolean,
      required: true,
      default: true,
    },
    security: {
      type: Boolean,
      required: true,
      default: true,
    },
    updates: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
}, { _id: false });

const securityPreferencesSchema = new Schema<ISecurityPreferences>({
  passwordPolicy: {
    enforceComplexity: {
      type: Boolean,
      required: true,
      default: true,
    },
    minLength: {
      type: Number,
      required: true,
      min: 6,
      max: 128,
      default: 8,
    },
    requireMFA: {
      type: Boolean,
      required: true,
      default: false,
    },
    sessionTimeout: {
      type: Number,
      required: true,
      min: 15,
      max: 1440, // 24 hours
      default: 480, // 8 hours
    },
  },
  accessControl: {
    ipWhitelist: [{
      type: String,
      validate: {
        validator: function(ip: string) {
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          return ipv4Regex.test(ip);
        },
        message: 'Invalid IP address format',
      },
    }],
    allowedDomains: [{
      type: String,
      validate: {
        validator: function(domain: string) {
          const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
          return domainRegex.test(domain);
        },
        message: 'Invalid domain format',
      },
    }],
    restrictToBusinessHours: {
      type: Boolean,
      required: true,
      default: false,
    },
    businessHours: {
      start: {
        type: String,
        default: '09:00',
      },
      end: {
        type: String,
        default: '17:00',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
    },
  },
  auditSettings: {
    logAllActions: {
      type: Boolean,
      required: true,
      default: true,
    },
    retentionDays: {
      type: Number,
      required: true,
      min: 30,
      max: 2555, // 7 years
      default: 365,
    },
    alertOnSuspiciousActivity: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
}, { _id: false });

const integrationSettingsSchema = new Schema<IIntegrationSettings>({
  apiAccess: {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    rateLimits: {
      requestsPerMinute: {
        type: Number,
        required: true,
        min: 1,
        default: 60,
      },
      requestsPerHour: {
        type: Number,
        required: true,
        min: 1,
        default: 1000,
      },
      requestsPerDay: {
        type: Number,
        required: true,
        min: 1,
        default: 10000,
      },
    },
    allowedIPs: [{
      type: String,
    }],
  },
  webhooks: {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    endpoints: [{
      url: {
        type: String,
        required: true,
      },
      events: [{
        type: String,
        required: true,
      }],
      secret: {
        type: String,
        required: true,
      },
      isActive: {
        type: Boolean,
        required: true,
        default: true,
      },
    }],
  },
  dataSync: {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    frequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      required: true,
      default: 'daily',
    },
    lastSyncAt: {
      type: Date,
    },
    syncStatus: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      required: true,
      default: 'pending',
    },
  },
}, { _id: false });

const customizationSchema = new Schema<ICustomization>({
  theme: {
    mode: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      required: true,
      default: 'light',
    },
    primaryColor: {
      type: String,
      required: true,
      default: '#3B82F6',
    },
    secondaryColor: {
      type: String,
      required: true,
      default: '#6B7280',
    },
    accentColor: {
      type: String,
      required: true,
      default: '#10B981',
    },
    borderRadius: {
      type: String,
      enum: ['none', 'small', 'medium', 'large'],
      required: true,
      default: 'medium',
    },
  },
  layout: {
    sidebarCollapsed: {
      type: Boolean,
      required: true,
      default: false,
    },
    density: {
      type: String,
      enum: ['compact', 'comfortable', 'spacious'],
      required: true,
      default: 'comfortable',
    },
    showBreadcrumbs: {
      type: Boolean,
      required: true,
      default: true,
    },
    showQuickActions: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  dashboard: {
    widgets: [{
      id: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        required: true,
      },
      position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        w: { type: Number, required: true },
        h: { type: Number, required: true },
      },
      config: {
        type: Schema.Types.Mixed,
        default: {},
      },
      isVisible: {
        type: Boolean,
        required: true,
        default: true,
      },
    }],
    refreshInterval: {
      type: Number,
      required: true,
      min: 30,
      max: 3600, // 1 hour
      default: 300, // 5 minutes
    },
  },
}, { _id: false });

const tenantSettingsSchema = new Schema<ITenantSettings>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    general: {
      tenantName: {
        type: String,
        required: true,
        trim: true,
      },
      displayName: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
      timezone: {
        type: String,
        required: true,
        default: 'UTC',
      },
      locale: {
        type: String,
        required: true,
        default: 'en-US',
      },
      currency: {
        type: String,
        required: true,
        default: 'USD',
        uppercase: true,
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
    features: {
      enabledModules: [{
        type: String,
        trim: true,
      }],
      betaFeatures: [{
        type: String,
        trim: true,
      }],
      experimentalFeatures: [{
        type: String,
        trim: true,
      }],
      customFeatures: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    workflows: {
      patientManagement: {
        type: workflowSettingsSchema,
        required: true,
      },
      prescriptionProcessing: {
        type: workflowSettingsSchema,
        required: true,
      },
      inventoryManagement: {
        type: workflowSettingsSchema,
        required: true,
      },
      clinicalReviews: {
        type: workflowSettingsSchema,
        required: true,
      },
    },
    notifications: {
      type: notificationPreferencesSchema,
      required: true,
    },
    security: {
      type: securityPreferencesSchema,
      required: true,
    },
    integrations: {
      type: integrationSettingsSchema,
      required: true,
    },
    customization: {
      type: customizationSchema,
      required: true,
    },
    businessRules: {
      operatingHours: {
        monday: { open: { type: String, default: '09:00' }, close: { type: String, default: '17:00' }, isOpen: { type: Boolean, default: true } },
        tuesday: { open: { type: String, default: '09:00' }, close: { type: String, default: '17:00' }, isOpen: { type: Boolean, default: true } },
        wednesday: { open: { type: String, default: '09:00' }, close: { type: String, default: '17:00' }, isOpen: { type: Boolean, default: true } },
        thursday: { open: { type: String, default: '09:00' }, close: { type: String, default: '17:00' }, isOpen: { type: Boolean, default: true } },
        friday: { open: { type: String, default: '09:00' }, close: { type: String, default: '17:00' }, isOpen: { type: Boolean, default: true } },
        saturday: { open: { type: String, default: '09:00' }, close: { type: String, default: '17:00' }, isOpen: { type: Boolean, default: false } },
        sunday: { open: { type: String, default: '09:00' }, close: { type: String, default: '17:00' }, isOpen: { type: Boolean, default: false } },
      },
      holidays: [{
        name: {
          type: String,
          required: true,
        },
        date: {
          type: Date,
          required: true,
        },
        isRecurring: {
          type: Boolean,
          required: true,
          default: false,
        },
      }],
      autoLogout: {
        enabled: {
          type: Boolean,
          required: true,
          default: true,
        },
        idleTimeMinutes: {
          type: Number,
          required: true,
          min: 5,
          max: 480, // 8 hours
          default: 30,
        },
        warningTimeMinutes: {
          type: Number,
          required: true,
          min: 1,
          max: 30,
          default: 5,
        },
      },
    },
    compliance: {
      regulations: [{
        type: String,
        trim: true,
      }],
      dataRetention: {
        patientRecords: {
          type: Number,
          required: true,
          min: 1,
          max: 50,
          default: 7,
        },
        auditLogs: {
          type: Number,
          required: true,
          min: 1,
          max: 10,
          default: 3,
        },
        backups: {
          type: Number,
          required: true,
          min: 1,
          max: 10,
          default: 2,
        },
      },
      consentManagement: {
        required: {
          type: Boolean,
          required: true,
          default: true,
        },
        types: [{
          type: String,
          trim: true,
        }],
        renewalPeriodDays: {
          type: Number,
          required: true,
          min: 30,
          max: 1095, // 3 years
          default: 365,
        },
      },
    },
    backup: {
      enabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: true,
        default: 'daily',
      },
      retentionDays: {
        type: Number,
        required: true,
        min: 7,
        max: 365,
        default: 30,
      },
      includeFiles: {
        type: Boolean,
        required: true,
        default: true,
      },
      encryptBackups: {
        type: Boolean,
        required: true,
        default: true,
      },
      lastBackupAt: {
        type: Date,
      },
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'tenantsettings',
  }
);

// Indexes
tenantSettingsSchema.index({ tenantId: 1 }, { unique: true });
tenantSettingsSchema.index({ isActive: 1 });
tenantSettingsSchema.index({ version: -1 });
tenantSettingsSchema.index({ lastModifiedBy: 1 });

// Methods
tenantSettingsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  // Don't expose sensitive webhook secrets
  if (obj.integrations?.webhooks?.endpoints) {
    obj.integrations.webhooks.endpoints.forEach((endpoint: any) => {
      if (endpoint.secret) {
        endpoint.secret = '***';
      }
    });
  }
  return obj;
};

tenantSettingsSchema.methods.isFeatureEnabled = function (featureName: string): boolean {
  return this.features.enabledModules.includes(featureName) ||
         this.features.betaFeatures.includes(featureName) ||
         this.features.experimentalFeatures.includes(featureName);
};

tenantSettingsSchema.methods.isOperatingHoursActive = function (dayOfWeek: string, currentTime?: Date): boolean {
  const day = this.businessRules.operatingHours[dayOfWeek.toLowerCase()];
  if (!day || !day.isOpen) return false;

  if (!currentTime) currentTime = new Date();
  
  const timeString = currentTime.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return timeString >= day.open && timeString <= day.close;
};

tenantSettingsSchema.methods.updateVersion = function (userId: mongoose.Types.ObjectId): void {
  this.version += 1;
  this.lastModifiedBy = userId;
};

tenantSettingsSchema.methods.enableFeature = function (featureName: string, featureType: 'enabled' | 'beta' | 'experimental' = 'enabled'): void {
  const targetArray = featureType === 'enabled' ? this.features.enabledModules :
                     featureType === 'beta' ? this.features.betaFeatures :
                     this.features.experimentalFeatures;

  if (!targetArray.includes(featureName)) {
    targetArray.push(featureName);
  }

  // Remove from other arrays if it exists
  const otherArrays = [this.features.enabledModules, this.features.betaFeatures, this.features.experimentalFeatures]
    .filter(arr => arr !== targetArray);
  
  otherArrays.forEach(arr => {
    const index = arr.indexOf(featureName);
    if (index > -1) {
      arr.splice(index, 1);
    }
  });
};

tenantSettingsSchema.methods.disableFeature = function (featureName: string): void {
  [this.features.enabledModules, this.features.betaFeatures, this.features.experimentalFeatures]
    .forEach(arr => {
      const index = arr.indexOf(featureName);
      if (index > -1) {
        arr.splice(index, 1);
      }
    });
};

// Static methods
tenantSettingsSchema.statics.findByTenantId = function (tenantId: mongoose.Types.ObjectId) {
  return this.findOne({ tenantId, isActive: true });
};

tenantSettingsSchema.statics.createDefaultSettings = function (tenantId: mongoose.Types.ObjectId, tenantName: string, adminId: mongoose.Types.ObjectId) {
  const defaultWorkflow = {
    requireApproval: false,
    approvalWorkflow: { steps: [] },
    autoAssignment: { enabled: false, rules: [] },
  };

  return this.create({
    tenantId,
    general: {
      tenantName,
      displayName: tenantName,
      timezone: 'UTC',
      locale: 'en-US',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    features: {
      enabledModules: ['patient-management', 'prescription-processing'],
      betaFeatures: [],
      experimentalFeatures: [],
      customFeatures: {},
    },
    workflows: {
      patientManagement: defaultWorkflow,
      prescriptionProcessing: defaultWorkflow,
      inventoryManagement: defaultWorkflow,
      clinicalReviews: defaultWorkflow,
    },
    notifications: {
      channels: { email: true, sms: false, push: true, inApp: true },
      frequency: 'immediate',
      quietHours: { enabled: false, startTime: '22:00', endTime: '08:00' },
      categories: { system: true, billing: true, security: true, updates: false },
    },
    security: {
      passwordPolicy: { enforceComplexity: true, minLength: 8, requireMFA: false, sessionTimeout: 480 },
      accessControl: { ipWhitelist: [], allowedDomains: [], restrictToBusinessHours: false, businessHours: { start: '09:00', end: '17:00', timezone: 'UTC' } },
      auditSettings: { logAllActions: true, retentionDays: 365, alertOnSuspiciousActivity: true },
    },
    integrations: {
      apiAccess: { enabled: false, rateLimits: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000 }, allowedIPs: [] },
      webhooks: { enabled: false, endpoints: [] },
      dataSync: { enabled: false, frequency: 'daily', syncStatus: 'pending' },
    },
    customization: {
      theme: { mode: 'light', primaryColor: '#3B82F6', secondaryColor: '#6B7280', accentColor: '#10B981', borderRadius: 'medium' },
      layout: { sidebarCollapsed: false, density: 'comfortable', showBreadcrumbs: true, showQuickActions: true },
      dashboard: { widgets: [], refreshInterval: 300 },
    },
    businessRules: {
      operatingHours: {
        monday: { open: '09:00', close: '17:00', isOpen: true },
        tuesday: { open: '09:00', close: '17:00', isOpen: true },
        wednesday: { open: '09:00', close: '17:00', isOpen: true },
        thursday: { open: '09:00', close: '17:00', isOpen: true },
        friday: { open: '09:00', close: '17:00', isOpen: true },
        saturday: { open: '09:00', close: '17:00', isOpen: false },
        sunday: { open: '09:00', close: '17:00', isOpen: false },
      },
      holidays: [],
      autoLogout: { enabled: true, idleTimeMinutes: 30, warningTimeMinutes: 5 },
    },
    compliance: {
      regulations: ['HIPAA'],
      dataRetention: { patientRecords: 7, auditLogs: 3, backups: 2 },
      consentManagement: { required: true, types: ['treatment', 'data-processing'], renewalPeriodDays: 365 },
    },
    backup: {
      enabled: true,
      frequency: 'daily',
      retentionDays: 30,
      includeFiles: true,
      encryptBackups: true,
    },
    lastModifiedBy: adminId,
  });
};

export const TenantSettings = mongoose.model<ITenantSettings>('TenantSettings', tenantSettingsSchema);