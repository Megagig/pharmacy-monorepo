import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IReminderTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  
  // Template details
  name: string;
  type: 'appointment' | 'medication_refill' | 'adherence_check' | 'clinical_followup' | 'preventive_care';
  category: 'pre_appointment' | 'post_appointment' | 'medication' | 'clinical' | 'general';
  
  // Channels and timing
  channels: Array<'email' | 'sms' | 'push' | 'whatsapp'>;
  timing: {
    unit: 'minutes' | 'hours' | 'days' | 'weeks';
    value: number;
    relativeTo: 'before_appointment' | 'after_appointment' | 'before_due_date' | 'after_event';
  };
  
  // Message templates
  messageTemplates: {
    email?: {
      subject: string;
      body: string;
      htmlBody?: string;
    };
    sms?: {
      message: string;
    };
    push?: {
      title: string;
      body: string;
      actionUrl?: string;
    };
    whatsapp?: {
      message: string;
      templateId?: string;
    };
  };
  
  // Conditions
  conditions?: {
    appointmentTypes?: string[];
    patientAgeRange?: { min?: number; max?: number };
    patientConditions?: string[];
    customRules?: Record<string, any>;
  };
  
  // Status
  isActive: boolean;
  isDefault: boolean;
  
  // Usage tracking
  usageStats: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    lastUsedAt?: Date;
  };
  
  // Audit fields
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderTemplateSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: [true, 'Workplace ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: ['appointment', 'medication_refill', 'adherence_check', 'clinical_followup', 'preventive_care'],
      required: [true, 'Template type is required'],
      index: true,
    },
    category: {
      type: String,
      enum: ['pre_appointment', 'post_appointment', 'medication', 'clinical', 'general'],
      required: [true, 'Template category is required'],
      index: true,
    },
    channels: {
      type: [String],
      enum: ['email', 'sms', 'push', 'whatsapp'],
      required: [true, 'At least one channel is required'],
      validate: {
        validator: function (channels: string[]) {
          return channels && channels.length > 0 && channels.length <= 4;
        },
        message: 'Must have 1-4 channels',
      },
    },
    timing: {
      unit: {
        type: String,
        enum: ['minutes', 'hours', 'days', 'weeks'],
        required: [true, 'Timing unit is required'],
      },
      value: {
        type: Number,
        required: [true, 'Timing value is required'],
        min: [1, 'Timing value must be at least 1'],
        max: [52, 'Timing value cannot exceed 52 (weeks)'],
      },
      relativeTo: {
        type: String,
        enum: ['before_appointment', 'after_appointment', 'before_due_date', 'after_event'],
        required: [true, 'Relative timing is required'],
      },
    },
    messageTemplates: {
      email: {
        subject: {
          type: String,
          trim: true,
          maxlength: [200, 'Email subject cannot exceed 200 characters'],
        },
        body: {
          type: String,
          trim: true,
          maxlength: [5000, 'Email body cannot exceed 5000 characters'],
        },
        htmlBody: {
          type: String,
          maxlength: [10000, 'HTML body cannot exceed 10000 characters'],
        },
      },
      sms: {
        message: {
          type: String,
          trim: true,
          maxlength: [160, 'SMS message cannot exceed 160 characters'],
        },
      },
      push: {
        title: {
          type: String,
          trim: true,
          maxlength: [100, 'Push title cannot exceed 100 characters'],
        },
        body: {
          type: String,
          trim: true,
          maxlength: [200, 'Push body cannot exceed 200 characters'],
        },
        actionUrl: {
          type: String,
          trim: true,
        },
      },
      whatsapp: {
        message: {
          type: String,
          trim: true,
          maxlength: [1000, 'WhatsApp message cannot exceed 1000 characters'],
        },
        templateId: {
          type: String,
          trim: true,
        },
      },
    },
    conditions: {
      appointmentTypes: [String],
      patientAgeRange: {
        min: {
          type: Number,
          min: 0,
          max: 150,
        },
        max: {
          type: Number,
          min: 0,
          max: 150,
        },
      },
      patientConditions: [String],
      customRules: Schema.Types.Mixed,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    usageStats: {
      totalSent: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalDelivered: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalFailed: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastUsedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields
addAuditFields(reminderTemplateSchema);

// Apply tenancy guard plugin
reminderTemplateSchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Indexes for efficient querying
reminderTemplateSchema.index({ workplaceId: 1, type: 1, isActive: 1 });
reminderTemplateSchema.index({ workplaceId: 1, isDefault: 1 });
reminderTemplateSchema.index({ isActive: 1, type: 1 });
reminderTemplateSchema.index({ createdAt: -1 });

// Virtual for delivery success rate
reminderTemplateSchema.virtual('deliverySuccessRate').get(function (this: IReminderTemplate) {
  if (this.usageStats.totalSent === 0) return 0;
  
  return Math.round((this.usageStats.totalDelivered / this.usageStats.totalSent) * 100);
});

// Virtual for failure rate
reminderTemplateSchema.virtual('failureRate').get(function (this: IReminderTemplate) {
  if (this.usageStats.totalSent === 0) return 0;
  
  return Math.round((this.usageStats.totalFailed / this.usageStats.totalSent) * 100);
});

// Virtual for has email template
reminderTemplateSchema.virtual('hasEmailTemplate').get(function (this: IReminderTemplate) {
  return !!(this.messageTemplates?.email?.subject && this.messageTemplates?.email?.body);
});

// Virtual for has sms template
reminderTemplateSchema.virtual('hasSmsTemplate').get(function (this: IReminderTemplate) {
  return !!this.messageTemplates?.sms?.message;
});

// Virtual for has push template
reminderTemplateSchema.virtual('hasPushTemplate').get(function (this: IReminderTemplate) {
  return !!(this.messageTemplates?.push?.title && this.messageTemplates?.push?.body);
});

// Virtual for has whatsapp template
reminderTemplateSchema.virtual('hasWhatsappTemplate').get(function (this: IReminderTemplate) {
  return !!this.messageTemplates?.whatsapp?.message;
});

// Virtual for timing in milliseconds
reminderTemplateSchema.virtual('timingInMilliseconds').get(function (this: IReminderTemplate) {
  const { unit, value } = this.timing;
  
  const multipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };
  
  return value * multipliers[unit];
});

// Pre-save validation
reminderTemplateSchema.pre('save', function (this: IReminderTemplate) {
  // Validate that at least one message template exists for selected channels
  for (const channel of this.channels) {
    if (channel === 'email' && !this.get('hasEmailTemplate')) {
      throw new Error('Email template is required when email channel is selected');
    }
    if (channel === 'sms' && !this.get('hasSmsTemplate')) {
      throw new Error('SMS template is required when SMS channel is selected');
    }
    if (channel === 'push' && !this.get('hasPushTemplate')) {
      throw new Error('Push template is required when push channel is selected');
    }
    if (channel === 'whatsapp' && !this.get('hasWhatsappTemplate')) {
      throw new Error('WhatsApp template is required when WhatsApp channel is selected');
    }
  }
  
  // Validate age range if provided
  if (this.conditions?.patientAgeRange) {
    const { min, max } = this.conditions.patientAgeRange;
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error('Minimum age cannot be greater than maximum age');
    }
  }
  
  // Only one default template per type per workplace
  if (this.isDefault && this.isModified('isDefault')) {
    // This will be handled in the service layer to avoid race conditions
  }
});

// Static method to find by type
reminderTemplateSchema.statics.findByType = function (
  type: string,
  workplaceId?: mongoose.Types.ObjectId,
  activeOnly: boolean = true
) {
  const query: any = { type };
  
  if (activeOnly) {
    query.isActive = true;
  }
  
  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ isDefault: -1, name: 1 });
  }
  
  return this.find(query).sort({ isDefault: -1, name: 1 });
};

// Static method to find default template
reminderTemplateSchema.statics.findDefault = function (
  type: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    type,
    isDefault: true,
    isActive: true,
  };
  
  if (workplaceId) {
    return this.findOne(query).setOptions({ workplaceId });
  }
  
  return this.findOne(query);
};

// Static method to find by category
reminderTemplateSchema.statics.findByCategory = function (
  category: string,
  workplaceId?: mongoose.Types.ObjectId,
  activeOnly: boolean = true
) {
  const query: any = { category };
  
  if (activeOnly) {
    query.isActive = true;
  }
  
  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ name: 1 });
  }
  
  return this.find(query).sort({ name: 1 });
};

// Static method to find templates for specific appointment type
reminderTemplateSchema.statics.findForAppointmentType = function (
  appointmentType: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    type: 'appointment',
    isActive: true,
    $or: [
      { 'conditions.appointmentTypes': appointmentType },
      { 'conditions.appointmentTypes': { $exists: false } },
      { 'conditions.appointmentTypes': { $size: 0 } },
    ],
  };
  
  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ isDefault: -1, name: 1 });
  }
  
  return this.find(query).sort({ isDefault: -1, name: 1 });
};

// Instance method to render message with placeholders
reminderTemplateSchema.methods.renderMessage = function (
  this: IReminderTemplate,
  channel: 'email' | 'sms' | 'push' | 'whatsapp',
  placeholders: Record<string, any>
): any {
  const template = this.messageTemplates[channel];
  
  if (!template) {
    throw new Error(`No ${channel} template found`);
  }
  
  const replacePlaceholders = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return placeholders[key] !== undefined ? String(placeholders[key]) : match;
    });
  };
  
  if (channel === 'email') {
    const emailTemplate = template as { subject: string; body: string; htmlBody?: string; };
    return {
      subject: replacePlaceholders(emailTemplate.subject || ''),
      body: replacePlaceholders(emailTemplate.body || ''),
      htmlBody: emailTemplate.htmlBody ? replacePlaceholders(emailTemplate.htmlBody) : undefined,
    };
  } else if (channel === 'sms' || channel === 'whatsapp') {
    const messageTemplate = template as { message: string; templateId?: string; };
    return {
      message: replacePlaceholders(messageTemplate.message || ''),
      templateId: messageTemplate.templateId,
    };
  } else if (channel === 'push') {
    const pushTemplate = template as { title: string; body: string; actionUrl?: string; };
    return {
      title: replacePlaceholders(pushTemplate.title || ''),
      body: replacePlaceholders(pushTemplate.body || ''),
      actionUrl: pushTemplate.actionUrl,
    };
  }
};

// Instance method to check if template matches conditions
reminderTemplateSchema.methods.matchesConditions = function (
  this: IReminderTemplate,
  context: {
    appointmentType?: string;
    patientAge?: number;
    patientConditions?: string[];
  }
): boolean {
  if (!this.conditions) return true;
  
  // Check appointment type
  if (
    this.conditions.appointmentTypes &&
    this.conditions.appointmentTypes.length > 0 &&
    context.appointmentType
  ) {
    if (!this.conditions.appointmentTypes.includes(context.appointmentType)) {
      return false;
    }
  }
  
  // Check patient age range
  if (this.conditions.patientAgeRange && context.patientAge !== undefined) {
    const { min, max } = this.conditions.patientAgeRange;
    if (min !== undefined && context.patientAge < min) return false;
    if (max !== undefined && context.patientAge > max) return false;
  }
  
  // Check patient conditions
  if (
    this.conditions.patientConditions &&
    this.conditions.patientConditions.length > 0 &&
    context.patientConditions
  ) {
    const hasMatchingCondition = this.conditions.patientConditions.some(condition =>
      context.patientConditions!.includes(condition)
    );
    if (!hasMatchingCondition) return false;
  }
  
  return true;
};

// Instance method to increment usage stats
reminderTemplateSchema.methods.incrementSent = function (this: IReminderTemplate) {
  this.usageStats.totalSent += 1;
  this.usageStats.lastUsedAt = new Date();
};

// Instance method to increment delivered count
reminderTemplateSchema.methods.incrementDelivered = function (this: IReminderTemplate) {
  this.usageStats.totalDelivered += 1;
};

// Instance method to increment failed count
reminderTemplateSchema.methods.incrementFailed = function (this: IReminderTemplate) {
  this.usageStats.totalFailed += 1;
};

// Instance method to calculate scheduled time
reminderTemplateSchema.methods.calculateScheduledTime = function (
  this: IReminderTemplate,
  referenceDate: Date
): Date {
  const timingMs = this.get('timingInMilliseconds');
  
  if (this.timing.relativeTo === 'before_appointment' || this.timing.relativeTo === 'before_due_date') {
    return new Date(referenceDate.getTime() - timingMs);
  } else {
    return new Date(referenceDate.getTime() + timingMs);
  }
};

export default mongoose.model<IReminderTemplate>('ReminderTemplate', reminderTemplateSchema);
