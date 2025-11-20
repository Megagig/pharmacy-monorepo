import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  defaultValue?: any;
}

export interface INotificationTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  channel: 'email' | 'sms' | 'push' | 'whatsapp';
  subject?: string;
  body: string;
  variables: TemplateVariable[];
  isActive: boolean;
  category: string;
  workplaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    channel: {
      type: String,
      enum: ['email', 'sms', 'push', 'whatsapp'],
      required: true,
      index: true,
    },
    subject: { type: String, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    variables: [{ type: Schema.Types.Mixed }],
    isActive: { type: Boolean, default: true, required: true },
    category: { type: String, required: true, trim: true, index: true },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

addAuditFields(notificationTemplateSchema);
notificationTemplateSchema.plugin(tenancyGuardPlugin);
notificationTemplateSchema.index({ workplaceId: 1, channel: 1 });

const NotificationTemplate = mongoose.model<INotificationTemplate>('NotificationTemplate', notificationTemplateSchema);

export default NotificationTemplate;
export { NotificationTemplate };
