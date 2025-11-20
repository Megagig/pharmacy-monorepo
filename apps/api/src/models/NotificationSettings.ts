import mongoose, { Document, Schema } from 'mongoose';

export interface IChannelConfig {
  enabled: boolean;
  provider?: string;
  apiKey?: string;
  apiSecret?: string;
  fromAddress?: string;
  fromName?: string;
  webhookUrl?: string;
  rateLimits: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // in seconds
    backoffMultiplier: number;
  };
}

export interface INotificationSettings extends Document {
  workspaceId?: mongoose.Types.ObjectId; // null for global settings
  channels: {
    email: IChannelConfig;
    sms: IChannelConfig;
    push: IChannelConfig;
    whatsapp: IChannelConfig;
    inApp: IChannelConfig;
  };
  globalSettings: {
    enableNotifications: boolean;
    quietHours: {
      enabled: boolean;
      startTime: string; // HH:MM format
      endTime: string; // HH:MM format
      timezone: string;
    };
    batchingEnabled: boolean;
    batchingInterval: number; // in minutes
    maxBatchSize: number;
  };
  deliveryPreferences: {
    priorityChannels: ('email' | 'sms' | 'push' | 'whatsapp' | 'inApp')[];
    fallbackEnabled: boolean;
    fallbackDelay: number; // in minutes
  };
  complianceSettings: {
    gdprCompliant: boolean;
    dataRetentionDays: number;
    consentRequired: boolean;
    unsubscribeEnabled: boolean;
  };
  isActive: boolean;
  lastModifiedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isChannelEnabled(channel: string): boolean;
  isInQuietHours(): boolean;
}

const channelConfigSchema = new Schema<IChannelConfig>({
  enabled: {
    type: Boolean,
    required: true,
    default: false,
  },
  provider: {
    type: String,
  },
  apiKey: {
    type: String,
  },
  apiSecret: {
    type: String,
  },
  fromAddress: {
    type: String,
  },
  fromName: {
    type: String,
  },
  webhookUrl: {
    type: String,
  },
  rateLimits: {
    perMinute: {
      type: Number,
      required: true,
      min: 1,
      default: 60,
    },
    perHour: {
      type: Number,
      required: true,
      min: 1,
      default: 1000,
    },
    perDay: {
      type: Number,
      required: true,
      min: 1,
      default: 10000,
    },
  },
  retryPolicy: {
    maxRetries: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 3,
    },
    retryDelay: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    backoffMultiplier: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 2,
    },
  },
}, { _id: false });

const notificationSettingsSchema = new Schema<INotificationSettings>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      index: true,
    },
    channels: {
      email: {
        type: channelConfigSchema,
        required: true,
      },
      sms: {
        type: channelConfigSchema,
        required: true,
      },
      push: {
        type: channelConfigSchema,
        required: true,
      },
      whatsapp: {
        type: channelConfigSchema,
        required: true,
      },
      inApp: {
        type: channelConfigSchema,
        required: true,
      },
    },
    globalSettings: {
      enableNotifications: {
        type: Boolean,
        required: true,
        default: true,
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
            validator: function (time: string) {
              return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
            },
            message: 'Invalid time format. Use HH:MM format.',
          },
          default: '22:00',
        },
        endTime: {
          type: String,
          validate: {
            validator: function (time: string) {
              return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
            },
            message: 'Invalid time format. Use HH:MM format.',
          },
          default: '08:00',
        },
        timezone: {
          type: String,
          required: true,
          default: 'UTC',
        },
      },
      batchingEnabled: {
        type: Boolean,
        required: true,
        default: false,
      },
      batchingInterval: {
        type: Number,
        required: true,
        min: 1,
        max: 1440, // 24 hours
        default: 15,
      },
      maxBatchSize: {
        type: Number,
        required: true,
        min: 1,
        max: 1000,
        default: 50,
      },
    },
    deliveryPreferences: {
      priorityChannels: [{
        type: String,
        enum: ['email', 'sms', 'push', 'whatsapp', 'inApp'],
      }],
      fallbackEnabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      fallbackDelay: {
        type: Number,
        required: true,
        min: 1,
        max: 60,
        default: 5,
      },
    },
    complianceSettings: {
      gdprCompliant: {
        type: Boolean,
        required: true,
        default: true,
      },
      dataRetentionDays: {
        type: Number,
        required: true,
        min: 30,
        max: 2555, // 7 years
        default: 365,
      },
      consentRequired: {
        type: Boolean,
        required: true,
        default: true,
      },
      unsubscribeEnabled: {
        type: Boolean,
        required: true,
        default: true,
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
    collection: 'notificationsettings',
  }
);

// Indexes
notificationSettingsSchema.index({ workspaceId: 1 });
notificationSettingsSchema.index({ isActive: 1 });
notificationSettingsSchema.index({ lastModifiedBy: 1 });
notificationSettingsSchema.index({ updatedAt: -1 });

// Ensure only one global settings document (workspaceId: null)
notificationSettingsSchema.index({ workspaceId: 1 }, { unique: true, sparse: true });

// Methods
notificationSettingsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  // Don't expose sensitive API keys and secrets
  if (obj.channels) {
    Object.keys(obj.channels).forEach(channel => {
      if (obj.channels[channel].apiKey) {
        obj.channels[channel].apiKey = '***';
      }
      if (obj.channels[channel].apiSecret) {
        obj.channels[channel].apiSecret = '***';
      }
    });
  }
  return obj;
};

notificationSettingsSchema.methods.isChannelEnabled = function (channel: string): boolean {
  return this.channels[channel]?.enabled && this.isActive;
};

notificationSettingsSchema.methods.isInQuietHours = function (timezone?: string): boolean {
  if (!this.globalSettings.quietHours.enabled) return false;

  const tz = timezone || this.globalSettings.quietHours.timezone;
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const startTime = this.globalSettings.quietHours.startTime;
  const endTime = this.globalSettings.quietHours.endTime;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }

  return currentTime >= startTime && currentTime <= endTime;
};

notificationSettingsSchema.methods.canSendNotification = function (channel: string, timezone?: string): boolean {
  if (!this.isChannelEnabled(channel)) return false;
  if (this.isInQuietHours(timezone)) return false;
  return true;
};

notificationSettingsSchema.methods.getNextAvailableChannel = function (preferredChannels: string[] = []): string | null {
  const allChannels = this.deliveryPreferences.priorityChannels.length > 0
    ? this.deliveryPreferences.priorityChannels
    : ['email', 'sms', 'push', 'whatsapp', 'inApp'];

  const channelsToCheck = preferredChannels.length > 0 ? preferredChannels : allChannels;

  for (const channel of channelsToCheck) {
    if (this.canSendNotification(channel)) {
      return channel;
    }
  }

  return null;
};

// Static methods
notificationSettingsSchema.statics.getGlobalSettings = function () {
  return this.findOne({ workspaceId: null });
};

notificationSettingsSchema.statics.getWorkspaceSettings = function (workspaceId: mongoose.Types.ObjectId) {
  return this.findOne({ workspaceId, isActive: true });
};

notificationSettingsSchema.statics.createDefaultSettings = function (workspaceId?: mongoose.Types.ObjectId, adminId?: mongoose.Types.ObjectId) {
  const defaultChannelConfig = {
    enabled: false,
    rateLimits: {
      perMinute: 60,
      perHour: 1000,
      perDay: 10000,
    },
    retryPolicy: {
      maxRetries: 3,
      retryDelay: 30,
      backoffMultiplier: 2,
    },
  };

  return this.create({
    workspaceId,
    channels: {
      email: { ...defaultChannelConfig, enabled: true },
      sms: defaultChannelConfig,
      push: defaultChannelConfig,
      whatsapp: defaultChannelConfig,
      inApp: { ...defaultChannelConfig, enabled: true },
    },
    globalSettings: {
      enableNotifications: true,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      },
      batchingEnabled: false,
      batchingInterval: 15,
      maxBatchSize: 50,
    },
    deliveryPreferences: {
      priorityChannels: ['email', 'inApp'],
      fallbackEnabled: true,
      fallbackDelay: 5,
    },
    complianceSettings: {
      gdprCompliant: true,
      dataRetentionDays: 365,
      consentRequired: true,
      unsubscribeEnabled: true,
    },
    lastModifiedBy: adminId,
  });
};

// Add instance methods
notificationSettingsSchema.methods.isChannelEnabled = function (channel: string): boolean {
  return this.channels[channel]?.enabled || false;
};

notificationSettingsSchema.methods.isInQuietHours = function (): boolean {
  if (!this.globalSettings.quietHours.enabled) return false;

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  return currentTime >= this.globalSettings.quietHours.startTime &&
    currentTime <= this.globalSettings.quietHours.endTime;
};

export const NotificationSettings = mongoose.model<INotificationSettings>('NotificationSettings', notificationSettingsSchema);