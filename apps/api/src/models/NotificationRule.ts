import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

interface NotificationAction {
  type: 'send_notification';
  channel: string;
  template: string;
  recipients: string[];
  delay?: number;
}

export interface INotificationRule extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  trigger: string;
  conditions: RuleCondition[];
  actions: NotificationAction[];
  isActive: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldownPeriod: number;
  maxExecutions: number;
  executionCount: number;
  lastExecuted?: Date;
  workplaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationRuleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    trigger: { type: String, required: true, index: true },
    conditions: [{ type: Schema.Types.Mixed }],
    actions: [{ type: Schema.Types.Mixed }],
    isActive: { type: Boolean, default: true, required: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      required: true,
    },
    cooldownPeriod: { type: Number, default: 0, min: 0 },
    maxExecutions: { type: Number, default: -1 },
    executionCount: { type: Number, default: 0, min: 0 },
    lastExecuted: { type: Date },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

addAuditFields(notificationRuleSchema);
notificationRuleSchema.plugin(tenancyGuardPlugin);
notificationRuleSchema.index({ workplaceId: 1, isActive: 1 });

const NotificationRule = mongoose.model<INotificationRule>('NotificationRule', notificationRuleSchema);

export default NotificationRule;
export { NotificationRule };
