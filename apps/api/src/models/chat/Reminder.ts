import mongoose, { Document, Schema } from 'mongoose';

/**
 * Reminder Model
 * 
 * Handles automated medication reminders for patients
 */

export interface IReminderConfirmation {
  scheduledTime: Date;
  confirmedAt?: Date;
  status: 'pending' | 'confirmed' | 'missed';
  reminderSentAt?: Date;
  messageId?: mongoose.Types.ObjectId;
}

export interface IReminder extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Patient and medication
  patientId: mongoose.Types.ObjectId;
  medicationId?: mongoose.Types.ObjectId;
  medicationName: string;
  dosage: string;
  instructions?: string;
  
  // Schedule
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
  times: string[]; // Array of times in HH:MM format (e.g., ["08:00", "20:00"])
  daysOfWeek?: number[]; // For weekly reminders: 0=Sunday, 6=Saturday
  customSchedule?: string; // Cron expression for custom schedules
  
  // Duration
  startDate: Date;
  endDate?: Date;
  
  // Status
  isActive: boolean;
  isPaused: boolean;
  
  // Confirmation tracking
  confirmations: IReminderConfirmation[];
  missedDoseThreshold: number; // Minutes after scheduled time to mark as missed
  
  // Notifications
  notifyPharmacistOnMissed: boolean;
  pharmacistId?: mongoose.Types.ObjectId;
  
  // Metadata
  workplaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  getNextReminderTime(): Date | null;
  addConfirmation(scheduledTime: Date, confirmedAt?: Date): void;
  markAsMissed(scheduledTime: Date): void;
  getMissedDoses(days?: number): IReminderConfirmation[];
  getConfirmationRate(days?: number): number;
}

const reminderConfirmationSchema = new Schema({
  scheduledTime: {
    type: Date,
    required: true,
  },
  confirmedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'missed'],
    default: 'pending',
  },
  reminderSentAt: {
    type: Date,
  },
  messageId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatMessage',
  },
}, { _id: false });

const reminderSchema = new Schema<IReminder>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    medicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Medication',
      index: true,
    },
    medicationName: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    frequency: {
      type: String,
      enum: ['daily', 'twice_daily', 'three_times_daily', 'weekly', 'custom'],
      required: true,
      index: true,
    },
    times: {
      type: [String],
      required: true,
      validate: {
        validator: function(times: string[]) {
          return times.every(time => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time));
        },
        message: 'Times must be in HH:MM format',
      },
    },
    daysOfWeek: {
      type: [Number],
      validate: {
        validator: function(days: number[]) {
          return days.every(day => day >= 0 && day <= 6);
        },
        message: 'Days of week must be between 0 (Sunday) and 6 (Saturday)',
      },
    },
    customSchedule: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPaused: {
      type: Boolean,
      default: false,
      index: true,
    },
    confirmations: {
      type: [reminderConfirmationSchema],
      default: [],
    },
    missedDoseThreshold: {
      type: Number,
      default: 60, // 60 minutes
      min: 5,
      max: 240,
    },
    notifyPharmacistOnMissed: {
      type: Boolean,
      default: true,
    },
    pharmacistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
reminderSchema.index({ patientId: 1, isActive: 1, isPaused: 1 });
reminderSchema.index({ workplaceId: 1, isActive: 1 });
reminderSchema.index({ startDate: 1, endDate: 1 });

// Instance methods

/**
 * Get the next scheduled reminder time
 */
reminderSchema.methods.getNextReminderTime = function(): Date | null {
  const now = new Date();
  
  // Check if reminder is active and not paused
  if (!this.isActive || this.isPaused) {
    return null;
  }
  
  // Check if reminder has ended
  if (this.endDate && this.endDate < now) {
    return null;
  }
  
  // Check if reminder hasn't started yet
  if (this.startDate > now) {
    return this.startDate;
  }
  
  // Calculate next reminder based on frequency
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const nextTimes: Date[] = [];
  
  for (const timeStr of this.times) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const nextTime = new Date(today);
    nextTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    // Check day of week for weekly reminders
    if (this.frequency === 'weekly' && this.daysOfWeek && this.daysOfWeek.length > 0) {
      while (!this.daysOfWeek.includes(nextTime.getDay())) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
    }
    
    // Check if within end date
    if (!this.endDate || nextTime <= this.endDate) {
      nextTimes.push(nextTime);
    }
  }
  
  // Return the earliest next time
  if (nextTimes.length === 0) {
    return null;
  }
  
  return nextTimes.reduce((earliest, current) => 
    current < earliest ? current : earliest
  );
};

/**
 * Add a confirmation record
 */
reminderSchema.methods.addConfirmation = function(
  scheduledTime: Date,
  confirmedAt?: Date
): void {
  const confirmation: IReminderConfirmation = {
    scheduledTime,
    confirmedAt: confirmedAt || new Date(),
    status: 'confirmed',
    reminderSentAt: new Date(),
  };
  
  this.confirmations.push(confirmation);
};

/**
 * Mark a dose as missed
 */
reminderSchema.methods.markAsMissed = function(scheduledTime: Date): void {
  const existingConfirmation = this.confirmations.find(
    (c: IReminderConfirmation) => 
      c.scheduledTime.getTime() === scheduledTime.getTime()
  );
  
  if (existingConfirmation) {
    existingConfirmation.status = 'missed';
  } else {
    this.confirmations.push({
      scheduledTime,
      status: 'missed',
      reminderSentAt: new Date(),
    });
  }
};

/**
 * Get missed doses within a time period
 */
reminderSchema.methods.getMissedDoses = function(days: number = 7): IReminderConfirmation[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.confirmations.filter(
    (c: IReminderConfirmation) => 
      c.status === 'missed' && c.scheduledTime >= cutoffDate
  );
};

/**
 * Get confirmation rate (percentage of confirmed doses)
 */
reminderSchema.methods.getConfirmationRate = function(days: number = 7): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentConfirmations = this.confirmations.filter(
    (c: IReminderConfirmation) => c.scheduledTime >= cutoffDate
  );
  
  if (recentConfirmations.length === 0) {
    return 100; // No data means 100% by default
  }
  
  const confirmed = recentConfirmations.filter(
    (c: IReminderConfirmation) => c.status === 'confirmed'
  ).length;
  
  return Math.round((confirmed / recentConfirmations.length) * 100);
};

// Static methods

/**
 * Find active reminders for a patient
 */
reminderSchema.statics.findActiveForPatient = function(patientId: string) {
  return this.find({
    patientId: new mongoose.Types.ObjectId(patientId),
    isActive: true,
    isPaused: false,
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: new Date() } },
    ],
  }).sort({ createdAt: -1 });
};

/**
 * Find reminders due for sending
 */
reminderSchema.statics.findDueReminders = function(timeWindow: number = 5) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + timeWindow * 60 * 1000);
  
  return this.find({
    isActive: true,
    isPaused: false,
    startDate: { $lte: now },
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: now } },
    ],
  });
};

export const Reminder = mongoose.model<IReminder>('Reminder', reminderSchema);
export default Reminder;
