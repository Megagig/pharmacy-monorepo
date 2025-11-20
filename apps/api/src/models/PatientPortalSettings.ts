import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IPatientPortalSettings extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  isEnabled: boolean;
  requireApproval: boolean;
  
  allowedFeatures: {
    messaging: boolean;
    appointments: boolean;
    medications: boolean;
    vitals: boolean;
    labResults: boolean;
    billing: boolean;
    educationalResources: boolean;
    healthRecords: boolean;
  };
  
  appointmentSettings: {
    allowBooking: boolean;
    advanceBookingDays: number;
    cancellationHours: number;
    allowRescheduling: boolean;
    requireApproval: boolean;
    availableTimeSlots: Array<{
      dayOfWeek: number; // 0-6 (Sunday-Saturday)
      startTime: string; // HH:mm format
      endTime: string; // HH:mm format
      isActive: boolean;
    }>;
    bufferMinutes: number; // Buffer time between appointments
  };
  
  messagingSettings: {
    allowPatientInitiated: boolean;
    allowAttachments: boolean;
    maxAttachmentSize: number; // in MB
    allowedFileTypes: string[];
    autoResponseEnabled: boolean;
    autoResponseMessage?: string;
    businessHours: {
      enabled: boolean;
      timezone: string;
      schedule: Array<{
        dayOfWeek: number; // 0-6 (Sunday-Saturday)
        startTime: string; // HH:mm format
        endTime: string; // HH:mm format
        isActive: boolean;
      }>;
    };
  };
  
  notificationSettings: {
    appointmentReminders: {
      enabled: boolean;
      reminderTimes: number[]; // Hours before appointment
      channels: ('email' | 'sms' | 'push' | 'whatsapp')[];
    };
    medicationReminders: {
      enabled: boolean;
      defaultTimes: string[]; // HH:mm format
      channels: ('email' | 'sms' | 'push' | 'whatsapp')[];
    };
    refillReminders: {
      enabled: boolean;
      daysBeforeEmpty: number;
      channels: ('email' | 'sms' | 'push' | 'whatsapp')[];
    };
    labResultNotifications: {
      enabled: boolean;
      channels: ('email' | 'sms' | 'push')[];
    };
    generalNotifications: {
      enabled: boolean;
      channels: ('email' | 'sms' | 'push')[];
    };
  };
  
  customization: {
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string;
    favicon?: string;
    welcomeMessage?: string;
    footerText?: string;
    contactInfo: {
      phone?: string;
      email?: string;
      address?: string;
      website?: string;
    };
    socialMedia: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
  };
  
  securitySettings: {
    sessionTimeout: number; // in minutes
    requireTwoFactor: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    allowedLoginAttempts: number;
    lockoutDuration: number; // in minutes
  };
  
  billingSettings: {
    allowOnlinePayments: boolean;
    paymentMethods: ('card' | 'bank_transfer' | 'mobile_money')[];
    currency: string;
    taxRate?: number;
    invoiceSettings: {
      autoGenerate: boolean;
      dueDate: number; // days after service
      reminderDays: number[];
    };
  };
  
  analyticsSettings: {
    trackPageViews: boolean;
    trackUserActions: boolean;
    retentionPeriod: number; // in days
    allowDataExport: boolean;
  };
  
  maintenanceMode: {
    enabled: boolean;
    message?: string;
    allowedRoles: string[];
    scheduledStart?: Date;
    scheduledEnd?: Date;
  };
  
  // Audit fields
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  isFeatureEnabled(feature: keyof IPatientPortalSettings['allowedFeatures']): boolean;
  updateFeature(feature: keyof IPatientPortalSettings['allowedFeatures'], enabled: boolean): void;
  getBusinessHours(dayOfWeek: number): { startTime: string; endTime: string } | null;
  isWithinBusinessHours(date?: Date): boolean;
  validateSettings(): { isValid: boolean; errors: string[] };
}

const patientPortalSettingsSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: [true, 'Workplace ID is required'],
      unique: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    requireApproval: {
      type: Boolean,
      default: true,
      required: true,
    },
    
    allowedFeatures: {
      messaging: { type: Boolean, default: true },
      appointments: { type: Boolean, default: true },
      medications: { type: Boolean, default: true },
      vitals: { type: Boolean, default: true },
      labResults: { type: Boolean, default: true },
      billing: { type: Boolean, default: false },
      educationalResources: { type: Boolean, default: true },
      healthRecords: { type: Boolean, default: true },
    },
    
    appointmentSettings: {
      allowBooking: { type: Boolean, default: true },
      advanceBookingDays: {
        type: Number,
        default: 30,
        min: [1, 'Advance booking days must be at least 1'],
        max: [365, 'Advance booking days cannot exceed 365'],
      },
      cancellationHours: {
        type: Number,
        default: 24,
        min: [1, 'Cancellation hours must be at least 1'],
        max: [168, 'Cancellation hours cannot exceed 168 (1 week)'],
      },
      allowRescheduling: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: false },
      availableTimeSlots: [
        {
          dayOfWeek: {
            type: Number,
            required: true,
            min: [0, 'Day of week must be between 0-6'],
            max: [6, 'Day of week must be between 0-6'],
          },
          startTime: {
            type: String,
            required: true,
            validate: {
              validator: function (time: string) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
              },
              message: 'Start time must be in HH:mm format',
            },
          },
          endTime: {
            type: String,
            required: true,
            validate: {
              validator: function (time: string) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
              },
              message: 'End time must be in HH:mm format',
            },
          },
          isActive: { type: Boolean, default: true },
        },
      ],
      bufferMinutes: {
        type: Number,
        default: 15,
        min: [0, 'Buffer minutes cannot be negative'],
        max: [120, 'Buffer minutes cannot exceed 120'],
      },
    },
    
    messagingSettings: {
      allowPatientInitiated: { type: Boolean, default: true },
      allowAttachments: { type: Boolean, default: true },
      maxAttachmentSize: {
        type: Number,
        default: 5, // 5MB
        min: [1, 'Max attachment size must be at least 1MB'],
        max: [50, 'Max attachment size cannot exceed 50MB'],
      },
      allowedFileTypes: {
        type: [String],
        default: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
        validate: {
          validator: function (types: string[]) {
            const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'txt', 'csv'];
            return types.every(type => allowedTypes.includes(type.toLowerCase()));
          },
          message: 'Invalid file type specified',
        },
      },
      autoResponseEnabled: { type: Boolean, default: false },
      autoResponseMessage: {
        type: String,
        maxlength: [500, 'Auto response message cannot exceed 500 characters'],
      },
      businessHours: {
        enabled: { type: Boolean, default: false },
        timezone: {
          type: String,
          default: 'Africa/Lagos',
        },
        schedule: [
          {
            dayOfWeek: {
              type: Number,
              required: true,
              min: [0, 'Day of week must be between 0-6'],
              max: [6, 'Day of week must be between 0-6'],
            },
            startTime: {
              type: String,
              required: true,
              validate: {
                validator: function (time: string) {
                  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
                },
                message: 'Start time must be in HH:mm format',
              },
            },
            endTime: {
              type: String,
              required: true,
              validate: {
                validator: function (time: string) {
                  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
                },
                message: 'End time must be in HH:mm format',
              },
            },
            isActive: { type: Boolean, default: true },
          },
        ],
      },
    },
    
    notificationSettings: {
      appointmentReminders: {
        enabled: { type: Boolean, default: true },
        reminderTimes: {
          type: [Number],
          default: [24, 2], // 24 hours and 2 hours before
          validate: {
            validator: function (times: number[]) {
              return times.every(time => time > 0 && time <= 168); // Max 1 week
            },
            message: 'Reminder times must be between 1 and 168 hours',
          },
        },
        channels: {
          type: [String],
          enum: ['email', 'sms', 'push', 'whatsapp'],
          default: ['email', 'push'],
        },
      },
      medicationReminders: {
        enabled: { type: Boolean, default: true },
        defaultTimes: {
          type: [String],
          default: ['08:00', '20:00'],
          validate: {
            validator: function (times: string[]) {
              return times.every(time => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time));
            },
            message: 'Default times must be in HH:mm format',
          },
        },
        channels: {
          type: [String],
          enum: ['email', 'sms', 'push', 'whatsapp'],
          default: ['push', 'sms'],
        },
      },
      refillReminders: {
        enabled: { type: Boolean, default: true },
        daysBeforeEmpty: {
          type: Number,
          default: 7,
          min: [1, 'Days before empty must be at least 1'],
          max: [30, 'Days before empty cannot exceed 30'],
        },
        channels: {
          type: [String],
          enum: ['email', 'sms', 'push', 'whatsapp'],
          default: ['email', 'push'],
        },
      },
      labResultNotifications: {
        enabled: { type: Boolean, default: true },
        channels: {
          type: [String],
          enum: ['email', 'sms', 'push'],
          default: ['email', 'push'],
        },
      },
      generalNotifications: {
        enabled: { type: Boolean, default: true },
        channels: {
          type: [String],
          enum: ['email', 'sms', 'push'],
          default: ['email'],
        },
      },
    },
    
    customization: {
      primaryColor: {
        type: String,
        validate: {
          validator: function (color: string) {
            if (!color) return true; // Optional field
            return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
          },
          message: 'Primary color must be a valid hex color',
        },
      },
      secondaryColor: {
        type: String,
        validate: {
          validator: function (color: string) {
            if (!color) return true; // Optional field
            return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
          },
          message: 'Secondary color must be a valid hex color',
        },
      },
      logo: {
        type: String,
        validate: {
          validator: function (url: string) {
            if (!url) return true; // Optional field
            return /^https?:\/\/.+\.(jpg|jpeg|png|svg|webp)$/i.test(url);
          },
          message: 'Logo must be a valid image URL',
        },
      },
      favicon: {
        type: String,
        validate: {
          validator: function (url: string) {
            if (!url) return true; // Optional field
            return /^https?:\/\/.+\.(ico|png)$/i.test(url);
          },
          message: 'Favicon must be a valid .ico or .png URL',
        },
      },
      welcomeMessage: {
        type: String,
        maxlength: [500, 'Welcome message cannot exceed 500 characters'],
      },
      footerText: {
        type: String,
        maxlength: [200, 'Footer text cannot exceed 200 characters'],
      },
      contactInfo: {
        phone: {
          type: String,
          validate: {
            validator: function (phone: string) {
              if (!phone) return true; // Optional field
              return /^\+234[0-9]{10}$/.test(phone);
            },
            message: 'Phone must be in Nigerian format (+234XXXXXXXXXX)',
          },
        },
        email: {
          type: String,
          lowercase: true,
          validate: {
            validator: function (email: string) {
              if (!email) return true; // Optional field
              return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
            },
            message: 'Please enter a valid email',
          },
        },
        address: {
          type: String,
          maxlength: [300, 'Address cannot exceed 300 characters'],
        },
        website: {
          type: String,
          validate: {
            validator: function (url: string) {
              if (!url) return true; // Optional field
              return /^https?:\/\/.+\..+/.test(url);
            },
            message: 'Website must be a valid URL',
          },
        },
      },
      socialMedia: {
        facebook: {
          type: String,
          validate: {
            validator: function (url: string) {
              if (!url) return true; // Optional field
              return /^https?:\/\/(www\.)?facebook\.com\/.+/.test(url);
            },
            message: 'Facebook URL must be a valid Facebook profile/page URL',
          },
        },
        twitter: {
          type: String,
          validate: {
            validator: function (url: string) {
              if (!url) return true; // Optional field
              return /^https?:\/\/(www\.)?twitter\.com\/.+/.test(url);
            },
            message: 'Twitter URL must be a valid Twitter profile URL',
          },
        },
        instagram: {
          type: String,
          validate: {
            validator: function (url: string) {
              if (!url) return true; // Optional field
              return /^https?:\/\/(www\.)?instagram\.com\/.+/.test(url);
            },
            message: 'Instagram URL must be a valid Instagram profile URL',
          },
        },
        linkedin: {
          type: String,
          validate: {
            validator: function (url: string) {
              if (!url) return true; // Optional field
              return /^https?:\/\/(www\.)?linkedin\.com\/.+/.test(url);
            },
            message: 'LinkedIn URL must be a valid LinkedIn profile/company URL',
          },
        },
      },
    },
    
    securitySettings: {
      sessionTimeout: {
        type: Number,
        default: 480, // 8 hours in minutes
        min: [30, 'Session timeout must be at least 30 minutes'],
        max: [1440, 'Session timeout cannot exceed 24 hours'],
      },
      requireTwoFactor: { type: Boolean, default: false },
      passwordPolicy: {
        minLength: {
          type: Number,
          default: 8,
          min: [6, 'Minimum password length must be at least 6'],
          max: [50, 'Minimum password length cannot exceed 50'],
        },
        requireUppercase: { type: Boolean, default: true },
        requireLowercase: { type: Boolean, default: true },
        requireNumbers: { type: Boolean, default: true },
        requireSpecialChars: { type: Boolean, default: false },
      },
      allowedLoginAttempts: {
        type: Number,
        default: 5,
        min: [3, 'Allowed login attempts must be at least 3'],
        max: [10, 'Allowed login attempts cannot exceed 10'],
      },
      lockoutDuration: {
        type: Number,
        default: 30, // 30 minutes
        min: [5, 'Lockout duration must be at least 5 minutes'],
        max: [1440, 'Lockout duration cannot exceed 24 hours'],
      },
    },
    
    billingSettings: {
      allowOnlinePayments: { type: Boolean, default: false },
      paymentMethods: {
        type: [String],
        enum: ['card', 'bank_transfer', 'mobile_money'],
        default: ['card'],
      },
      currency: {
        type: String,
        default: 'NGN',
        enum: ['NGN', 'USD', 'EUR', 'GBP'],
      },
      taxRate: {
        type: Number,
        min: [0, 'Tax rate cannot be negative'],
        max: [100, 'Tax rate cannot exceed 100%'],
      },
      invoiceSettings: {
        autoGenerate: { type: Boolean, default: true },
        dueDate: {
          type: Number,
          default: 30, // 30 days
          min: [1, 'Due date must be at least 1 day'],
          max: [365, 'Due date cannot exceed 365 days'],
        },
        reminderDays: {
          type: [Number],
          default: [7, 3, 1], // 7, 3, and 1 day before due date
          validate: {
            validator: function (days: number[]) {
              return days.every(day => day > 0 && day <= 365);
            },
            message: 'Reminder days must be between 1 and 365',
          },
        },
      },
    },
    
    analyticsSettings: {
      trackPageViews: { type: Boolean, default: true },
      trackUserActions: { type: Boolean, default: true },
      retentionPeriod: {
        type: Number,
        default: 365, // 1 year
        min: [30, 'Retention period must be at least 30 days'],
        max: [2555, 'Retention period cannot exceed 7 years'],
      },
      allowDataExport: { type: Boolean, default: true },
    },
    
    maintenanceMode: {
      enabled: { type: Boolean, default: false },
      message: {
        type: String,
        maxlength: [500, 'Maintenance message cannot exceed 500 characters'],
      },
      allowedRoles: {
        type: [String],
        default: ['admin', 'super_admin'],
        enum: ['admin', 'super_admin', 'pharmacist', 'technician'],
      },
      scheduledStart: Date,
      scheduledEnd: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields
addAuditFields(patientPortalSettingsSchema);

// Apply tenancy guard plugin
patientPortalSettingsSchema.plugin(tenancyGuardPlugin);

// Indexes
patientPortalSettingsSchema.index({ workplaceId: 1 }, { unique: true });
patientPortalSettingsSchema.index({ isEnabled: 1 });
patientPortalSettingsSchema.index({ 'maintenanceMode.enabled': 1 });
patientPortalSettingsSchema.index({ createdAt: -1 });

// Virtual for active features count
patientPortalSettingsSchema.virtual('activeFeaturesCount').get(function (this: IPatientPortalSettings) {
  return Object.values(this.allowedFeatures).filter(Boolean).length;
});

// Virtual for business hours status
patientPortalSettingsSchema.virtual('businessHoursActive').get(function (this: IPatientPortalSettings) {
  return this.messagingSettings.businessHours.enabled && 
         this.messagingSettings.businessHours.schedule.some(slot => slot.isActive);
});

// Pre-save validation
patientPortalSettingsSchema.pre('save', function (this: IPatientPortalSettings) {
  // Validate appointment time slots
  if (this.appointmentSettings.availableTimeSlots) {
    for (const slot of this.appointmentSettings.availableTimeSlots) {
      const startTime = slot.startTime.split(':').map(Number);
      const endTime = slot.endTime.split(':').map(Number);
      const startMinutes = startTime[0] * 60 + startTime[1];
      const endMinutes = endTime[0] * 60 + endTime[1];
      
      if (startMinutes >= endMinutes) {
        throw new Error(`Invalid time slot: start time must be before end time for day ${slot.dayOfWeek}`);
      }
    }
  }
  
  // Validate business hours
  if (this.messagingSettings.businessHours.schedule) {
    for (const schedule of this.messagingSettings.businessHours.schedule) {
      const startTime = schedule.startTime.split(':').map(Number);
      const endTime = schedule.endTime.split(':').map(Number);
      const startMinutes = startTime[0] * 60 + startTime[1];
      const endMinutes = endTime[0] * 60 + endTime[1];
      
      if (startMinutes >= endMinutes) {
        throw new Error(`Invalid business hours: start time must be before end time for day ${schedule.dayOfWeek}`);
      }
    }
  }
  
  // Validate maintenance mode schedule
  if (this.maintenanceMode.scheduledStart && this.maintenanceMode.scheduledEnd) {
    if (this.maintenanceMode.scheduledStart >= this.maintenanceMode.scheduledEnd) {
      throw new Error('Maintenance mode: scheduled start must be before scheduled end');
    }
  }
  
  // Ensure at least one notification channel is enabled for each notification type
  const notificationTypes = [
    'appointmentReminders',
    'medicationReminders',
    'refillReminders',
    'labResultNotifications',
    'generalNotifications'
  ];
  
  for (const type of notificationTypes) {
    const setting = this.notificationSettings[type as keyof typeof this.notificationSettings];
    if (setting.enabled && (!setting.channels || setting.channels.length === 0)) {
      throw new Error(`At least one notification channel must be enabled for ${type}`);
    }
  }
});

// Instance method to check if feature is enabled
patientPortalSettingsSchema.methods.isFeatureEnabled = function (
  this: IPatientPortalSettings,
  feature: keyof IPatientPortalSettings['allowedFeatures']
): boolean {
  return this.isEnabled && this.allowedFeatures[feature];
};

// Instance method to update feature
patientPortalSettingsSchema.methods.updateFeature = function (
  this: IPatientPortalSettings,
  feature: keyof IPatientPortalSettings['allowedFeatures'],
  enabled: boolean
): void {
  this.allowedFeatures[feature] = enabled;
};

// Instance method to get business hours for a specific day
patientPortalSettingsSchema.methods.getBusinessHours = function (
  this: IPatientPortalSettings,
  dayOfWeek: number
): { startTime: string; endTime: string } | null {
  if (!this.messagingSettings.businessHours.enabled) {
    return null;
  }
  
  const schedule = this.messagingSettings.businessHours.schedule.find(
    s => s.dayOfWeek === dayOfWeek && s.isActive
  );
  
  return schedule ? { startTime: schedule.startTime, endTime: schedule.endTime } : null;
};

// Instance method to check if current time is within business hours
patientPortalSettingsSchema.methods.isWithinBusinessHours = function (
  this: IPatientPortalSettings,
  date: Date = new Date()
): boolean {
  if (!this.messagingSettings.businessHours.enabled) {
    return true; // Always within business hours if not enabled
  }
  
  const dayOfWeek = date.getDay();
  const businessHours = this.getBusinessHours(dayOfWeek);
  
  if (!businessHours) {
    return false; // No business hours set for this day
  }
  
  const currentTime = date.toTimeString().slice(0, 5); // HH:mm format
  return currentTime >= businessHours.startTime && currentTime <= businessHours.endTime;
};

// Instance method to validate all settings
patientPortalSettingsSchema.methods.validateSettings = function (
  this: IPatientPortalSettings
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if at least one feature is enabled
  const enabledFeatures = Object.values(this.allowedFeatures).filter(Boolean);
  if (enabledFeatures.length === 0) {
    errors.push('At least one feature must be enabled');
  }
  
  // Validate appointment settings if appointments are enabled
  if (this.allowedFeatures.appointments) {
    if (this.appointmentSettings.allowBooking && this.appointmentSettings.availableTimeSlots.length === 0) {
      errors.push('Available time slots must be configured if appointment booking is enabled');
    }
  }
  
  // Validate messaging settings if messaging is enabled
  if (this.allowedFeatures.messaging) {
    if (this.messagingSettings.allowAttachments && this.messagingSettings.allowedFileTypes.length === 0) {
      errors.push('Allowed file types must be specified if attachments are enabled');
    }
  }
  
  // Validate billing settings if billing is enabled
  if (this.allowedFeatures.billing) {
    if (this.billingSettings.allowOnlinePayments && this.billingSettings.paymentMethods.length === 0) {
      errors.push('Payment methods must be specified if online payments are enabled');
    }
  }
  
  // Validate customization
  if (this.customization.primaryColor && this.customization.secondaryColor) {
    if (this.customization.primaryColor === this.customization.secondaryColor) {
      errors.push('Primary and secondary colors should be different');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Static method to get default settings
patientPortalSettingsSchema.statics.getDefaultSettings = function (workplaceId: mongoose.Types.ObjectId) {
  return {
    workplaceId,
    isEnabled: true,
    requireApproval: true,
    allowedFeatures: {
      messaging: true,
      appointments: true,
      medications: true,
      vitals: true,
      labResults: true,
      billing: false,
      educationalResources: true,
      healthRecords: true,
    },
    appointmentSettings: {
      allowBooking: true,
      advanceBookingDays: 30,
      cancellationHours: 24,
      allowRescheduling: true,
      requireApproval: false,
      availableTimeSlots: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }, // Monday
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true }, // Tuesday
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true }, // Wednesday
        { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true }, // Thursday
        { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true }, // Friday
      ],
      bufferMinutes: 15,
    },
    messagingSettings: {
      allowPatientInitiated: true,
      allowAttachments: true,
      maxAttachmentSize: 5,
      allowedFileTypes: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      autoResponseEnabled: false,
      businessHours: {
        enabled: false,
        timezone: 'Africa/Lagos',
        schedule: [],
      },
    },
    notificationSettings: {
      appointmentReminders: {
        enabled: true,
        reminderTimes: [24, 2],
        channels: ['email', 'push'],
      },
      medicationReminders: {
        enabled: true,
        defaultTimes: ['08:00', '20:00'],
        channels: ['push', 'sms'],
      },
      refillReminders: {
        enabled: true,
        daysBeforeEmpty: 7,
        channels: ['email', 'push'],
      },
      labResultNotifications: {
        enabled: true,
        channels: ['email', 'push'],
      },
      generalNotifications: {
        enabled: true,
        channels: ['email'],
      },
    },
    customization: {
      contactInfo: {},
      socialMedia: {},
    },
    securitySettings: {
      sessionTimeout: 480,
      requireTwoFactor: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
      },
      allowedLoginAttempts: 5,
      lockoutDuration: 30,
    },
    billingSettings: {
      allowOnlinePayments: false,
      paymentMethods: ['card'],
      currency: 'NGN',
      invoiceSettings: {
        autoGenerate: true,
        dueDate: 30,
        reminderDays: [7, 3, 1],
      },
    },
    analyticsSettings: {
      trackPageViews: true,
      trackUserActions: true,
      retentionPeriod: 365,
      allowDataExport: true,
    },
    maintenanceMode: {
      enabled: false,
      allowedRoles: ['admin', 'super_admin'],
    },
  };
};

export default mongoose.model<IPatientPortalSettings>('PatientPortalSettings', patientPortalSettingsSchema);