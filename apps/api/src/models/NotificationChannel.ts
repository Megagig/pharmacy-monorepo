import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface INotificationChannel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  enabled: boolean;
  config: {
    provider?: string;
    apiKey?: string;
    fromAddress?: string;
    fromNumber?: string;
    webhookUrl?: string;
    [key: string]: any;
  };
  dailyLimit: number;
  monthlyLimit: number;
  workplaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationChannelSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Channel name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: ['email', 'sms', 'push', 'whatsapp'],
      required: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    config: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    dailyLimit: {
      type: Number,
      required: true,
      min: [0, 'Daily limit cannot be negative'],
      default: 10000,
    },
    monthlyLimit: {
      type: Number,
      required: true,
      min: [0, 'Monthly limit cannot be negative'],
      default: 300000,
    },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields
addAuditFields(notificationChannelSchema);

// Apply tenancy guard plugin
notificationChannelSchema.plugin(tenancyGuardPlugin);

// Indexes
notificationChannelSchema.index({ workplaceId: 1, type: 1 });
notificationChannelSchema.index({ workplaceId: 1, enabled: 1 });

const NotificationChannel = mongoose.model<INotificationChannel>('NotificationChannel', notificationChannelSchema);

export default NotificationChannel;
export { NotificationChannel };
