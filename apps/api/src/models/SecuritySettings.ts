import mongoose, { Document, Schema } from 'mongoose';

export interface IPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // in days
  preventReuse: number; // number of previous passwords to prevent reuse
}

export interface ISessionSettings {
  maxDuration: number; // in minutes
  idleTimeout: number; // in minutes
  maxConcurrentSessions: number;
  requireReauthentication: boolean;
}

export interface IAccountLockout {
  maxFailedAttempts: number;
  lockoutDuration: number; // in minutes
  autoUnlock: boolean;
  notifyOnLockout: boolean;
}

export interface ITwoFactorAuth {
  enforced: boolean;
  methods: ('email' | 'sms' | 'authenticator')[];
  gracePeriod: number; // in days
  backupCodes: boolean;
}

export interface ISecuritySettings extends Document {
  passwordPolicy: IPasswordPolicy;
  sessionSettings: ISessionSettings;
  accountLockout: IAccountLockout;
  twoFactorAuth: ITwoFactorAuth;
  ipWhitelist: string[];
  allowedDomains: string[];
  securityNotifications: {
    newDeviceLogin: boolean;
    suspiciousActivity: boolean;
    passwordChanges: boolean;
    roleChanges: boolean;
  };
  auditRetention: {
    loginLogs: number; // in days
    actionLogs: number; // in days
    securityLogs: number; // in days
  };
  isActive: boolean;
  lastModifiedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const passwordPolicySchema = new Schema<IPasswordPolicy>({
  minLength: {
    type: Number,
    required: true,
    min: 6,
    max: 128,
    default: 8,
  },
  requireUppercase: {
    type: Boolean,
    required: true,
    default: true,
  },
  requireLowercase: {
    type: Boolean,
    required: true,
    default: true,
  },
  requireNumbers: {
    type: Boolean,
    required: true,
    default: true,
  },
  requireSpecialChars: {
    type: Boolean,
    required: true,
    default: true,
  },
  maxAge: {
    type: Number,
    required: true,
    min: 30,
    max: 365,
    default: 90,
  },
  preventReuse: {
    type: Number,
    required: true,
    min: 0,
    max: 24,
    default: 5,
  },
}, { _id: false });

const sessionSettingsSchema = new Schema<ISessionSettings>({
  maxDuration: {
    type: Number,
    required: true,
    min: 30,
    max: 43200, // 30 days in minutes
    default: 480, // 8 hours
  },
  idleTimeout: {
    type: Number,
    required: true,
    min: 5,
    max: 1440, // 24 hours in minutes
    default: 30,
  },
  maxConcurrentSessions: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 3,
  },
  requireReauthentication: {
    type: Boolean,
    required: true,
    default: false,
  },
}, { _id: false });

const accountLockoutSchema = new Schema<IAccountLockout>({
  maxFailedAttempts: {
    type: Number,
    required: true,
    min: 3,
    max: 20,
    default: 5,
  },
  lockoutDuration: {
    type: Number,
    required: true,
    min: 5,
    max: 1440, // 24 hours in minutes
    default: 30,
  },
  autoUnlock: {
    type: Boolean,
    required: true,
    default: true,
  },
  notifyOnLockout: {
    type: Boolean,
    required: true,
    default: true,
  },
}, { _id: false });

const twoFactorAuthSchema = new Schema<ITwoFactorAuth>({
  enforced: {
    type: Boolean,
    required: true,
    default: false,
  },
  methods: [{
    type: String,
    enum: ['email', 'sms', 'authenticator'],
    required: true,
  }],
  gracePeriod: {
    type: Number,
    required: true,
    min: 0,
    max: 30,
    default: 7,
  },
  backupCodes: {
    type: Boolean,
    required: true,
    default: true,
  },
}, { _id: false });

const securitySettingsSchema = new Schema<ISecuritySettings>(
  {
    passwordPolicy: {
      type: passwordPolicySchema,
      required: true,
    },
    sessionSettings: {
      type: sessionSettingsSchema,
      required: true,
    },
    accountLockout: {
      type: accountLockoutSchema,
      required: true,
    },
    twoFactorAuth: {
      type: twoFactorAuthSchema,
      required: true,
    },
    ipWhitelist: [{
      type: String,
      validate: {
        validator: function(ip: string) {
          // Basic IP validation (IPv4 and IPv6)
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'localhost';
        },
        message: 'Invalid IP address format',
      },
    }],
    allowedDomains: [{
      type: String,
      validate: {
        validator: function(domain: string) {
          // Basic domain validation
          const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
          return domainRegex.test(domain);
        },
        message: 'Invalid domain format',
      },
    }],
    securityNotifications: {
      newDeviceLogin: {
        type: Boolean,
        required: true,
        default: true,
      },
      suspiciousActivity: {
        type: Boolean,
        required: true,
        default: true,
      },
      passwordChanges: {
        type: Boolean,
        required: true,
        default: true,
      },
      roleChanges: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    auditRetention: {
      loginLogs: {
        type: Number,
        required: true,
        min: 30,
        max: 2555, // 7 years
        default: 365,
      },
      actionLogs: {
        type: Number,
        required: true,
        min: 30,
        max: 2555, // 7 years
        default: 730, // 2 years
      },
      securityLogs: {
        type: Number,
        required: true,
        min: 90,
        max: 2555, // 7 years
        default: 1095, // 3 years
      },
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
    collection: 'securitysettings',
  }
);

// Indexes
securitySettingsSchema.index({ isActive: 1 });
securitySettingsSchema.index({ lastModifiedBy: 1 });
securitySettingsSchema.index({ updatedAt: -1 });

// Methods
securitySettingsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

securitySettingsSchema.methods.validatePassword = function (password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const policy = this.passwordPolicy;

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

securitySettingsSchema.methods.isSessionExpired = function (sessionStart: Date, lastActivity: Date): boolean {
  const now = new Date();
  const sessionDuration = (now.getTime() - sessionStart.getTime()) / (1000 * 60); // in minutes
  const idleDuration = (now.getTime() - lastActivity.getTime()) / (1000 * 60); // in minutes

  return sessionDuration > this.sessionSettings.maxDuration || 
         idleDuration > this.sessionSettings.idleTimeout;
};

export const SecuritySettings = mongoose.model<ISecuritySettings>('SecuritySettings', securitySettingsSchema);