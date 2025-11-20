import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  locationId?: string;
  
  // Patient and assignment
  patientId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  
  // Appointment details
  type: 'mtm_session' | 'chronic_disease_review' | 'new_medication_consultation' | 
        'vaccination' | 'health_check' | 'smoking_cessation' | 'general_followup';
  title: string;
  description?: string;
  
  // Scheduling
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  timezone: string;
  
  // Status tracking
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 
          'cancelled' | 'no_show' | 'rescheduled';
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  confirmedAt?: Date;
  confirmedBy?: mongoose.Types.ObjectId;
  
  // Completion tracking
  completedAt?: Date;
  outcome?: {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    visitCreated: boolean;
    visitId?: mongoose.Types.ObjectId;
  };
  
  // Cancellation tracking
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  
  // Rescheduling tracking
  rescheduledFrom?: Date;
  rescheduledTo?: Date;
  rescheduledReason?: string;
  rescheduledBy?: mongoose.Types.ObjectId;
  rescheduledAt?: Date;
  
  // Recurring appointments
  isRecurring: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    interval: number;
    endDate?: Date;
    endAfterOccurrences?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
  recurringSeriesId?: mongoose.Types.ObjectId;
  isRecurringException: boolean;
  
  // Reminders
  reminders: Array<{
    type: 'email' | 'sms' | 'push' | 'whatsapp';
    scheduledFor: Date;
    sent: boolean;
    sentAt?: Date;
    deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed';
    failureReason?: string;
  }>;
  
  // Related records
  relatedRecords: {
    visitId?: mongoose.Types.ObjectId;
    mtrSessionId?: mongoose.Types.ObjectId;
    clinicalInterventionId?: mongoose.Types.ObjectId;
    diagnosticCaseId?: mongoose.Types.ObjectId;
    followUpTaskId?: mongoose.Types.ObjectId;
  };
  
  // Patient preferences
  patientPreferences?: {
    preferredChannel: 'email' | 'sms' | 'whatsapp' | 'phone';
    language: string;
    specialRequirements?: string;
  };
  
  // Metadata
  metadata?: {
    source: 'manual' | 'patient_portal' | 'automated_trigger' | 'recurring';
    triggerEvent?: string;
    customFields?: Record<string, any>;
    confirmationToken?: string;
    confirmationTokenExpiry?: Date;
  };
  
  // Audit fields
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  reschedule(newDate: Date, newTime: string, reason: string, rescheduledBy: mongoose.Types.ObjectId): void;
  cancel(reason: string, cancelledBy: mongoose.Types.ObjectId): void;
  complete(outcome: IAppointment['outcome']): void;
  confirm(confirmedBy?: mongoose.Types.ObjectId): void;
}

// Static methods interface
export interface IAppointmentModel extends mongoose.Model<IAppointment> {
  findByPatient(
    patientId: mongoose.Types.ObjectId,
    options?: { status?: string; limit?: number; workplaceId?: mongoose.Types.ObjectId }
  ): Promise<IAppointment[]>;
  
  findByPharmacist(
    pharmacistId: mongoose.Types.ObjectId,
    options?: { status?: string; startDate?: Date; endDate?: Date; workplaceId?: mongoose.Types.ObjectId }
  ): Promise<IAppointment[]>;
  
  findUpcoming(days?: number, workplaceId?: mongoose.Types.ObjectId): Promise<IAppointment[]>;
  
  checkConflict(
    pharmacistId: mongoose.Types.ObjectId,
    scheduledDate: Date,
    scheduledTime: string,
    duration: number,
    excludeAppointmentId?: mongoose.Types.ObjectId
  ): Promise<{ hasConflict: boolean; conflictingAppointment?: IAppointment }>;
}

const appointmentSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: [true, 'Workplace ID is required'],
      index: true,
    },
    locationId: {
      type: String,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned pharmacist is required'],
      index: true,
    },
    type: {
      type: String,
      enum: [
        'mtm_session',
        'chronic_disease_review',
        'new_medication_consultation',
        'vaccination',
        'health_check',
        'smoking_cessation',
        'general_followup',
      ],
      required: [true, 'Appointment type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Appointment title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
      index: true,
      validate: {
        validator: function (value: Date) {
          // Allow past dates for historical records, but warn in business logic
          return value instanceof Date && !isNaN(value.getTime());
        },
        message: 'Invalid scheduled date',
      },
    },
    scheduledTime: {
      type: String,
      required: [true, 'Scheduled time is required'],
      validate: {
        validator: function (value: string) {
          // HH:mm format validation
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: 'Time must be in HH:mm format (e.g., 09:30)',
      },
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [5, 'Duration must be at least 5 minutes'],
      max: [480, 'Duration cannot exceed 8 hours'],
      default: 30,
    },
    timezone: {
      type: String,
      default: 'Africa/Lagos',
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'],
      default: 'scheduled',
      required: true,
      index: true,
    },
    confirmationStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'declined'],
      default: 'pending',
    },
    confirmedAt: Date,
    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: Date,
    outcome: {
      status: {
        type: String,
        enum: ['successful', 'partially_successful', 'unsuccessful'],
      },
      notes: {
        type: String,
        maxlength: [2000, 'Outcome notes cannot exceed 2000 characters'],
      },
      nextActions: [String],
      visitCreated: {
        type: Boolean,
        default: false,
      },
      visitId: {
        type: Schema.Types.ObjectId,
        ref: 'Visit',
      },
    },
    cancelledAt: Date,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: {
      type: String,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },
    rescheduledFrom: Date,
    rescheduledTo: Date,
    rescheduledReason: {
      type: String,
      maxlength: [500, 'Reschedule reason cannot exceed 500 characters'],
    },
    rescheduledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rescheduledAt: Date,
    isRecurring: {
      type: Boolean,
      default: false,
      index: true,
    },
    recurrencePattern: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'],
      },
      interval: {
        type: Number,
        min: 1,
        max: 12,
      },
      endDate: Date,
      endAfterOccurrences: {
        type: Number,
        min: 1,
        max: 100,
      },
      daysOfWeek: {
        type: [Number],
        validate: {
          validator: function (days: number[]) {
            return days.every(day => day >= 0 && day <= 6);
          },
          message: 'Days of week must be between 0 (Sunday) and 6 (Saturday)',
        },
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
      },
    },
    recurringSeriesId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    isRecurringException: {
      type: Boolean,
      default: false,
    },
    reminders: [
      {
        type: {
          type: String,
          enum: ['email', 'sms', 'push', 'whatsapp'],
          required: true,
        },
        scheduledFor: {
          type: Date,
          required: true,
        },
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: Date,
        deliveryStatus: {
          type: String,
          enum: ['pending', 'sent', 'delivered', 'failed'],
          default: 'pending',
        },
        failureReason: String,
      },
    ],
    relatedRecords: {
      visitId: {
        type: Schema.Types.ObjectId,
        ref: 'Visit',
      },
      mtrSessionId: {
        type: Schema.Types.ObjectId,
        ref: 'MedicationTherapyReview',
      },
      clinicalInterventionId: {
        type: Schema.Types.ObjectId,
        ref: 'ClinicalIntervention',
      },
      diagnosticCaseId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticCase',
      },
      followUpTaskId: {
        type: Schema.Types.ObjectId,
        ref: 'FollowUpTask',
      },
    },
    patientPreferences: {
      preferredChannel: {
        type: String,
        enum: ['email', 'sms', 'whatsapp', 'phone'],
      },
      language: {
        type: String,
        default: 'en',
      },
      specialRequirements: String,
    },
    metadata: {
      source: {
        type: String,
        enum: ['manual', 'patient_portal', 'automated_trigger', 'recurring'],
        default: 'manual',
      },
      triggerEvent: String,
      customFields: Schema.Types.Mixed,
      confirmationToken: String,
      confirmationTokenExpiry: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields
addAuditFields(appointmentSchema);

// Apply tenancy guard plugin
appointmentSchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Compound indexes for efficient querying
appointmentSchema.index({ workplaceId: 1, scheduledDate: 1, status: 1 });
appointmentSchema.index({ workplaceId: 1, patientId: 1, scheduledDate: -1 });
appointmentSchema.index({ workplaceId: 1, assignedTo: 1, scheduledDate: 1 });
appointmentSchema.index({ workplaceId: 1, type: 1, status: 1 });
appointmentSchema.index({ workplaceId: 1, locationId: 1, scheduledDate: 1 });
appointmentSchema.index({ recurringSeriesId: 1, scheduledDate: 1 });
appointmentSchema.index({ status: 1, scheduledDate: 1 });
appointmentSchema.index({ 'reminders.scheduledFor': 1, 'reminders.sent': 1 });
appointmentSchema.index({ createdAt: -1 });

// Indexes for related records (critical for engagement integration performance)
appointmentSchema.index({ 'relatedRecords.diagnosticCaseId': 1 });
appointmentSchema.index({ 'relatedRecords.mtrSessionId': 1 });
appointmentSchema.index({ 'relatedRecords.clinicalInterventionId': 1 });
appointmentSchema.index({ 'relatedRecords.followUpTaskId': 1 });
appointmentSchema.index({ 'relatedRecords.visitId': 1 });

// Virtual for patient details
appointmentSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for assigned pharmacist details
appointmentSchema.virtual('pharmacist', {
  ref: 'User',
  localField: 'assignedTo',
  foreignField: '_id',
  justOne: true,
});

// Virtual for appointment datetime
appointmentSchema.virtual('appointmentDateTime').get(function (this: IAppointment) {
  if (!this.scheduledDate || !this.scheduledTime) return null;
  
  const [hours, minutes] = this.scheduledTime.split(':').map(Number);
  const dateTime = new Date(this.scheduledDate);
  dateTime.setHours(hours, minutes, 0, 0);
  
  return dateTime;
});

// Virtual for end time
appointmentSchema.virtual('endDateTime').get(function (this: IAppointment) {
  const startTime = this.get('appointmentDateTime');
  if (!startTime) return null;
  
  return new Date(startTime.getTime() + this.duration * 60000);
});

// Virtual for is past
appointmentSchema.virtual('isPast').get(function (this: IAppointment) {
  const endTime = this.get('endDateTime');
  if (!endTime) return false;
  
  return endTime < new Date();
});

// Virtual for is today
appointmentSchema.virtual('isToday').get(function (this: IAppointment) {
  if (!this.scheduledDate) return false;
  
  const today = new Date();
  const appointmentDate = new Date(this.scheduledDate);
  
  return (
    appointmentDate.getDate() === today.getDate() &&
    appointmentDate.getMonth() === today.getMonth() &&
    appointmentDate.getFullYear() === today.getFullYear()
  );
});

// Virtual for pending reminders count
appointmentSchema.virtual('pendingRemindersCount').get(function (this: IAppointment) {
  if (!this.reminders || this.reminders.length === 0) return 0;
  return this.reminders.filter(r => !r.sent).length;
});

// Pre-save validation
appointmentSchema.pre('save', function (this: IAppointment) {
  // Validate recurring pattern if isRecurring is true
  if (this.isRecurring && !this.recurrencePattern) {
    throw new Error('Recurrence pattern is required for recurring appointments');
  }
  
  // Validate outcome is provided when status is completed
  if (this.status === 'completed' && !this.outcome) {
    throw new Error('Outcome is required when marking appointment as completed');
  }
  
  // Validate cancellation reason when status is cancelled
  if (this.status === 'cancelled' && !this.cancellationReason) {
    throw new Error('Cancellation reason is required when cancelling appointment');
  }
  
  // Set confirmation status based on status
  if (this.status === 'confirmed' && this.confirmationStatus === 'pending') {
    this.confirmationStatus = 'confirmed';
    this.confirmedAt = new Date();
  }
});

// Static method to find appointments by patient
appointmentSchema.statics.findByPatient = function (
  patientId: mongoose.Types.ObjectId,
  options?: { status?: string; limit?: number; workplaceId?: mongoose.Types.ObjectId }
) {
  const query: any = { patientId };
  
  if (options?.status) {
    query.status = options.status;
  }
  
  let baseQuery;
  if (options?.workplaceId) {
    baseQuery = this.find(query).setOptions({ workplaceId: options.workplaceId });
  } else {
    baseQuery = this.find(query);
  }
  
  baseQuery = baseQuery.sort({ scheduledDate: -1 });
  
  if (options?.limit) {
    baseQuery = baseQuery.limit(options.limit);
  }
  
  return baseQuery;
};

// Static method to find appointments by pharmacist
appointmentSchema.statics.findByPharmacist = function (
  pharmacistId: mongoose.Types.ObjectId,
  options?: { status?: string; startDate?: Date; endDate?: Date; workplaceId?: mongoose.Types.ObjectId }
) {
  const query: any = { assignedTo: pharmacistId };
  
  if (options?.status) {
    query.status = options.status;
  }
  
  if (options?.startDate || options?.endDate) {
    query.scheduledDate = {};
    if (options.startDate) query.scheduledDate.$gte = options.startDate;
    if (options.endDate) query.scheduledDate.$lte = options.endDate;
  }
  
  if (options?.workplaceId) {
    return this.find(query).setOptions({ workplaceId: options.workplaceId }).sort({ scheduledDate: 1 });
  }
  
  return this.find(query).sort({ scheduledDate: 1 });
};

// Static method to find upcoming appointments
appointmentSchema.statics.findUpcoming = function (
  days: number = 7,
  workplaceId?: mongoose.Types.ObjectId
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);
  
  const query = {
    scheduledDate: { $gte: today, $lte: futureDate },
    status: { $in: ['scheduled', 'confirmed'] },
  };
  
  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ scheduledDate: 1 });
  }
  
  return this.find(query).sort({ scheduledDate: 1 });
};

// Static method to check for conflicts
appointmentSchema.statics.checkConflict = async function (
  pharmacistId: mongoose.Types.ObjectId,
  scheduledDate: Date,
  scheduledTime: string,
  duration: number,
  excludeAppointmentId?: mongoose.Types.ObjectId
) {
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const startDateTime = new Date(scheduledDate);
  startDateTime.setHours(hours, minutes, 0, 0);
  
  const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
  
  const query: any = {
    assignedTo: pharmacistId,
    scheduledDate: scheduledDate,
    status: { $nin: ['cancelled', 'no_show'] },
  };
  
  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }
  
  const existingAppointments = await this.find(query);
  
  for (const appointment of existingAppointments) {
    const existingStart = appointment.get('appointmentDateTime');
    const existingEnd = appointment.get('endDateTime');
    
    if (!existingStart || !existingEnd) continue;
    
    // Check for overlap
    if (
      (startDateTime >= existingStart && startDateTime < existingEnd) ||
      (endDateTime > existingStart && endDateTime <= existingEnd) ||
      (startDateTime <= existingStart && endDateTime >= existingEnd)
    ) {
      return { hasConflict: true, conflictingAppointment: appointment };
    }
  }
  
  return { hasConflict: false };
};

// Instance method to reschedule
appointmentSchema.methods.reschedule = function (
  this: IAppointment,
  newDate: Date,
  newTime: string,
  reason: string,
  rescheduledBy: mongoose.Types.ObjectId
) {
  this.rescheduledFrom = this.scheduledDate;
  this.scheduledDate = newDate;
  this.scheduledTime = newTime;
  this.rescheduledReason = reason;
  this.rescheduledBy = rescheduledBy;
  this.rescheduledAt = new Date();
  this.status = 'rescheduled';
};

// Instance method to cancel
appointmentSchema.methods.cancel = function (
  this: IAppointment,
  reason: string,
  cancelledBy: mongoose.Types.ObjectId
) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = new Date();
};

// Instance method to complete
appointmentSchema.methods.complete = function (
  this: IAppointment,
  outcome: IAppointment['outcome']
) {
  this.status = 'completed';
  this.outcome = outcome;
  this.completedAt = new Date();
};

// Instance method to confirm
appointmentSchema.methods.confirm = function (
  this: IAppointment,
  confirmedBy?: mongoose.Types.ObjectId
) {
  this.status = 'confirmed';
  this.confirmationStatus = 'confirmed';
  this.confirmedAt = new Date();
  if (confirmedBy) {
    this.confirmedBy = confirmedBy;
  }
};

// Add sync middleware for MTR integration
import { addAppointmentSyncMiddleware } from '../middlewares/engagementSync';
addAppointmentSyncMiddleware(appointmentSchema);

export default mongoose.model<IAppointment, IAppointmentModel>('Appointment', appointmentSchema);
