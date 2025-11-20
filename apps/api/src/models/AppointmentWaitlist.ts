/**
 * Appointment Waitlist Model
 * 
 * Stores patients waiting for appointment slots
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IAppointmentWaitlist extends Document {
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  appointmentType: string;
  duration: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
  maxWaitDays: number;
  preferredPharmacistId?: mongoose.Types.ObjectId;
  preferredTimeSlots?: string[];
  preferredDays?: number[];
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  status: 'active' | 'fulfilled' | 'expired' | 'cancelled';
  createdAt: Date;
  expiresAt: Date;
  fulfilledAt?: Date;
  appointmentId?: mongoose.Types.ObjectId;
  notificationsSent?: Array<{
    sentAt: Date;
    channel: string;
    message: string;
  }>;
}

const AppointmentWaitlistSchema = new Schema<IAppointmentWaitlist>(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    appointmentType: {
      type: String,
      required: true,
      enum: [
        'mtm_session',
        'chronic_disease_review',
        'new_medication_consultation',
        'vaccination',
        'health_check',
        'smoking_cessation',
        'general_followup',
      ],
    },
    duration: {
      type: Number,
      required: true,
      min: 5,
      max: 480,
    },
    urgencyLevel: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    maxWaitDays: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
      default: 14,
    },
    preferredPharmacistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    preferredTimeSlots: [{
      type: String,
    }],
    preferredDays: [{
      type: Number,
      min: 0,
      max: 6,
    }],
    notificationPreferences: {
      email: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'fulfilled', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    fulfilledAt: {
      type: Date,
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    notificationsSent: [{
      sentAt: {
        type: Date,
        default: Date.now,
      },
      channel: {
        type: String,
        enum: ['email', 'sms', 'push'],
      },
      message: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
AppointmentWaitlistSchema.index({ workplaceId: 1, status: 1 });
AppointmentWaitlistSchema.index({ workplaceId: 1, urgencyLevel: 1, createdAt: 1 });
AppointmentWaitlistSchema.index({ workplaceId: 1, appointmentType: 1, status: 1 });
AppointmentWaitlistSchema.index({ expiresAt: 1, status: 1 }); // For cleanup jobs

// Auto-expire entries - commented out as it was causing issues with queries
// AppointmentWaitlistSchema.pre('find', function() {
//   // Automatically mark expired entries
//   const now = new Date();
//   this.updateMany(
//     {
//       status: 'active',
//       expiresAt: { $lt: now },
//     },
//     {
//       $set: { status: 'expired' },
//     }
//   );
// });

export const AppointmentWaitlist = mongoose.model<IAppointmentWaitlist>(
  'AppointmentWaitlist',
  AppointmentWaitlistSchema
);

export default AppointmentWaitlist;
