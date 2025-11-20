import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationUsage extends Document {
  _id: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  date: Date;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const notificationUsageSchema = new Schema(
  {
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'NotificationChannel',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Count cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
notificationUsageSchema.index({ channelId: 1, date: 1 }, { unique: true });

const NotificationUsage = mongoose.model<INotificationUsage>('NotificationUsage', notificationUsageSchema);

export default NotificationUsage;
export { NotificationUsage };
