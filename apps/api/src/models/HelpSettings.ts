import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpSettings extends Document {
  // Contact Information
  whatsappNumber: string;
  supportEmail: string;
  supportPhone?: string;
  
  // Business Hours
  businessHours: {
    timezone: string;
    monday: { start: string; end: string; isOpen: boolean };
    tuesday: { start: string; end: string; isOpen: boolean };
    wednesday: { start: string; end: string; isOpen: boolean };
    thursday: { start: string; end: string; isOpen: boolean };
    friday: { start: string; end: string; isOpen: boolean };
    saturday: { start: string; end: string; isOpen: boolean };
    sunday: { start: string; end: string; isOpen: boolean };
  };
  
  // System Status
  systemStatus: {
    status: 'operational' | 'maintenance' | 'partial_outage' | 'major_outage';
    message?: string;
    lastUpdated: Date;
    updatedBy: mongoose.Types.ObjectId;
  };
  
  // Feature Toggles
  features: {
    enableLiveChat: boolean;
    enableWhatsappSupport: boolean;
    enableVideoTutorials: boolean;
    enableFeedbackSystem: boolean;
    enablePDFGeneration: boolean;
    enableSearchAnalytics: boolean;
  };
  
  // Content Settings
  contentSettings: {
    defaultLanguage: string;
    supportedLanguages: string[];
    autoPublishArticles: boolean;
    requireApprovalForFAQs: boolean;
    enableContentVersioning: boolean;
  };
  
  // Notification Settings
  notifications: {
    emailNotifications: boolean;
    slackWebhookUrl?: string;
    notifyOnNewFeedback: boolean;
    notifyOnCriticalFeedback: boolean;
    feedbackNotificationEmails: string[];
  };
  
  // Analytics Settings
  analytics: {
    trackUserBehavior: boolean;
    trackSearchQueries: boolean;
    trackVideoWatchTime: boolean;
    retentionPeriodDays: number;
  };
  
  // Customization
  customization: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    customCSS?: string;
    welcomeMessage: string;
    footerText: string;
  };
  
  // Auto-responses
  autoResponses: {
    enableAutoResponses: boolean;
    commonResponses: Array<{
      trigger: string;
      response: string;
      isActive: boolean;
    }>;
  };
  
  // Maintenance
  lastUpdatedBy: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const helpSettingsSchema = new Schema<IHelpSettings>(
  {
    whatsappNumber: {
      type: String,
      required: true,
      trim: true,
      default: '+2348060374755',
    },
    supportEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'support@pharmacycopilot.ng',
    },
    supportPhone: {
      type: String,
      trim: true,
    },
    businessHours: {
      timezone: {
        type: String,
        default: 'Africa/Lagos',
      },
      monday: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        isOpen: { type: Boolean, default: true },
      },
      tuesday: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        isOpen: { type: Boolean, default: true },
      },
      wednesday: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        isOpen: { type: Boolean, default: true },
      },
      thursday: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        isOpen: { type: Boolean, default: true },
      },
      friday: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        isOpen: { type: Boolean, default: true },
      },
      saturday: {
        start: { type: String, default: '10:00' },
        end: { type: String, default: '16:00' },
        isOpen: { type: Boolean, default: true },
      },
      sunday: {
        start: { type: String, default: '10:00' },
        end: { type: String, default: '16:00' },
        isOpen: { type: Boolean, default: false },
      },
    },
    systemStatus: {
      status: {
        type: String,
        enum: ['operational', 'maintenance', 'partial_outage', 'major_outage'],
        default: 'operational',
      },
      message: String,
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    features: {
      enableLiveChat: { type: Boolean, default: true },
      enableWhatsappSupport: { type: Boolean, default: true },
      enableVideoTutorials: { type: Boolean, default: true },
      enableFeedbackSystem: { type: Boolean, default: true },
      enablePDFGeneration: { type: Boolean, default: true },
      enableSearchAnalytics: { type: Boolean, default: true },
    },
    contentSettings: {
      defaultLanguage: { type: String, default: 'en' },
      supportedLanguages: { type: [String], default: ['en'] },
      autoPublishArticles: { type: Boolean, default: false },
      requireApprovalForFAQs: { type: Boolean, default: true },
      enableContentVersioning: { type: Boolean, default: true },
    },
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      slackWebhookUrl: String,
      notifyOnNewFeedback: { type: Boolean, default: true },
      notifyOnCriticalFeedback: { type: Boolean, default: true },
      feedbackNotificationEmails: { type: [String], default: [] },
    },
    analytics: {
      trackUserBehavior: { type: Boolean, default: true },
      trackSearchQueries: { type: Boolean, default: true },
      trackVideoWatchTime: { type: Boolean, default: true },
      retentionPeriodDays: { type: Number, default: 365 },
    },
    customization: {
      primaryColor: { type: String, default: '#1976d2' },
      secondaryColor: { type: String, default: '#dc004e' },
      logoUrl: String,
      customCSS: String,
      welcomeMessage: { 
        type: String, 
        default: 'How can we help you today?' 
      },
      footerText: { 
        type: String, 
        default: 'Need more help? Contact our support team.' 
      },
    },
    autoResponses: {
      enableAutoResponses: { type: Boolean, default: false },
      commonResponses: [{
        trigger: String,
        response: String,
        isActive: { type: Boolean, default: true },
      }],
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'helpsettings',
  }
);

// Ensure only one settings document exists
helpSettingsSchema.index({}, { unique: true });

// Pre-save middleware
helpSettingsSchema.pre('save', function (next) {
  // Update system status timestamp when status changes
  if (this.isModified('systemStatus.status') || this.isModified('systemStatus.message')) {
    this.systemStatus.lastUpdated = new Date();
  }

  next();
});

// Methods
helpSettingsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Check if support is currently available
helpSettingsSchema.methods.isSupportAvailable = function (): boolean {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()]; // Get day name
  const currentTime = now.toTimeString().substring(0, 5); // e.g., '14:30'
  
  const daySchedule = this.businessHours[currentDay as keyof typeof this.businessHours];
  
  if (!daySchedule || !daySchedule.isOpen) {
    return false;
  }
  
  return currentTime >= daySchedule.start && currentTime <= daySchedule.end;
};

// Get WhatsApp link
helpSettingsSchema.methods.getWhatsAppLink = function (message?: string): string {
  const encodedMessage = message ? encodeURIComponent(message) : '';
  const number = this.whatsappNumber.replace(/[^\d]/g, ''); // Remove non-digits
  return `https://wa.me/${number}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
};

// Static method to get or create settings
helpSettingsSchema.statics.getSettings = async function (): Promise<IHelpSettings> {
  let settings = await this.findOne();
  
  if (!settings) {
    settings = await this.create({});
  }
  
  return settings;
};

// Add interface for static methods
interface IHelpSettingsModel extends mongoose.Model<IHelpSettings> {
  getSettings(): Promise<IHelpSettings>;
}

export const HelpSettings = mongoose.model<IHelpSettings, IHelpSettingsModel>('HelpSettings', helpSettingsSchema);
export default HelpSettings;