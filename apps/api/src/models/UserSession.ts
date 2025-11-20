import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceInfo {
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  isMobile: boolean;
}

export interface ILocationInfo {
  ipAddress: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  isp?: string;
}

export interface ISecurityFlags {
  isSuspicious: boolean;
  isFromNewDevice: boolean;
  isFromNewLocation: boolean;
  hasFailedAttempts: boolean;
  riskScore: number; // 0-100
}

export interface IUserSession extends Document {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  workspaceId?: mongoose.Types.ObjectId;
  deviceInfo: IDeviceInfo;
  locationInfo: ILocationInfo;
  securityFlags: ISecurityFlags;
  loginTime: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  logoutTime?: Date;
  logoutReason?: 'manual' | 'timeout' | 'admin_terminated' | 'security_breach' | 'expired';
  refreshTokens: string[];
  failedAttempts: number;
  createdAt: Date;
  updatedAt: Date;

  // Convenience properties for backward compatibility
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  terminatedAt?: Date;
  terminationReason?: string;
}

const deviceInfoSchema = new Schema<IDeviceInfo>({
  userAgent: {
    type: String,
    required: true,
  },
  browser: {
    type: String,
    required: true,
  },
  os: {
    type: String,
    required: true,
  },
  device: {
    type: String,
    required: true,
  },
  isMobile: {
    type: Boolean,
    required: true,
    default: false,
  },
}, { _id: false });

const locationInfoSchema = new Schema<ILocationInfo>({
  ipAddress: {
    type: String,
    required: true,
    validate: {
      validator: function (ip: string) {
        // Basic IP validation
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'localhost' || ip === '127.0.0.1';
      },
      message: 'Invalid IP address format',
    },
  },
  country: String,
  region: String,
  city: String,
  timezone: String,
  isp: String,
}, { _id: false });

const securityFlagsSchema = new Schema<ISecurityFlags>({
  isSuspicious: {
    type: Boolean,
    required: true,
    default: false,
  },
  isFromNewDevice: {
    type: Boolean,
    required: true,
    default: false,
  },
  isFromNewLocation: {
    type: Boolean,
    required: true,
    default: false,
  },
  hasFailedAttempts: {
    type: Boolean,
    required: true,
    default: false,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0,
  },
}, { _id: false });

const userSessionSchema = new Schema<IUserSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      index: true,
    },
    deviceInfo: {
      type: deviceInfoSchema,
      required: true,
    },
    locationInfo: {
      type: locationInfoSchema,
      required: true,
    },
    securityFlags: {
      type: securityFlagsSchema,
      required: true,
    },
    loginTime: {
      type: Date,
      required: true,
      index: true,
    },
    lastActivity: {
      type: Date,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    logoutTime: {
      type: Date,
    },
    logoutReason: {
      type: String,
      enum: ['manual', 'timeout', 'admin_terminated', 'security_breach', 'expired'],
    },
    refreshTokens: [{
      type: String,
    }],
    failedAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'usersessions',
  }
);

// Compound indexes for efficient queries
userSessionSchema.index({ userId: 1, isActive: 1 });
userSessionSchema.index({ userId: 1, loginTime: -1 });
userSessionSchema.index({ sessionId: 1, isActive: 1 });
userSessionSchema.index({ expiresAt: 1, isActive: 1 });
userSessionSchema.index({ 'locationInfo.ipAddress': 1, userId: 1 });
userSessionSchema.index({ 'securityFlags.isSuspicious': 1, isActive: 1 });

// TTL index to automatically delete expired sessions
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
userSessionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.refreshTokens; // Don't expose refresh tokens in JSON
  return obj;
};

userSessionSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt || !this.isActive;
};

userSessionSchema.methods.updateActivity = function (): void {
  this.lastActivity = new Date();
};

userSessionSchema.methods.terminate = function (reason: string, adminId?: mongoose.Types.ObjectId): void {
  this.isActive = false;
  this.logoutTime = new Date();
  this.logoutReason = reason as any;
  this.refreshTokens = [];
};

userSessionSchema.methods.calculateRiskScore = function (): number {
  let score = 0;

  if (this.securityFlags.isFromNewDevice) score += 20;
  if (this.securityFlags.isFromNewLocation) score += 30;
  if (this.failedAttempts > 0) score += this.failedAttempts * 10;
  if (this.securityFlags.hasFailedAttempts) score += 15;

  // Check for suspicious patterns
  const sessionDuration = (new Date().getTime() - this.loginTime.getTime()) / (1000 * 60 * 60); // hours
  if (sessionDuration > 24) score += 10; // Long sessions are slightly suspicious

  return Math.min(100, score);
};

userSessionSchema.methods.getDuration = function (): number {
  const endTime = this.logoutTime || new Date();
  return (endTime.getTime() - this.loginTime.getTime()) / (1000 * 60); // in minutes
};

// Static methods
userSessionSchema.statics.getActiveSessions = function (userId: mongoose.Types.ObjectId) {
  return this.find({ userId, isActive: true }).sort({ lastActivity: -1 });
};

userSessionSchema.statics.getSuspiciousSessions = function () {
  return this.find({
    isActive: true,
    $or: [
      { 'securityFlags.isSuspicious': true },
      { 'securityFlags.riskScore': { $gte: 70 } }
    ]
  }).populate('userId', 'email firstName lastName');
};

userSessionSchema.statics.terminateUserSessions = function (userId: mongoose.Types.ObjectId, reason: string) {
  return this.updateMany(
    { userId, isActive: true },
    {
      $set: {
        isActive: false,
        logoutTime: new Date(),
        logoutReason: reason,
        refreshTokens: []
      }
    }
  );
};

// Add virtual properties for backward compatibility
userSessionSchema.virtual('ipAddress').get(function () {
  return this.locationInfo?.ipAddress;
});

userSessionSchema.virtual('userAgent').get(function () {
  return this.deviceInfo?.userAgent;
});

userSessionSchema.virtual('location').get(function () {
  const loc = this.locationInfo;
  return loc ? `${loc.city || ''}, ${loc.region || ''}, ${loc.country || ''}`.replace(/^,\s*|,\s*$/g, '') : '';
});

userSessionSchema.virtual('terminatedAt').get(function () {
  return this.logoutTime;
});

userSessionSchema.virtual('terminationReason').get(function () {
  return this.logoutReason;
});

// Add virtual properties to JSON output
userSessionSchema.set('toJSON', { virtuals: true });
userSessionSchema.set('toObject', { virtuals: true });

export const UserSession = mongoose.model<IUserSession>('UserSession', userSessionSchema);