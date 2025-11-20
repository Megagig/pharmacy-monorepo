import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IFollowUpTask extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  locationId?: string;
  
  // Patient and assignment
  patientId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  
  // Task details
  type: 'medication_start_followup' | 'lab_result_review' | 'hospital_discharge_followup' |
        'medication_change_followup' | 'chronic_disease_monitoring' | 'adherence_check' |
        'refill_reminder' | 'preventive_care' | 'general_followup' | 'medication_refill_request';
  title: string;
  description: string;
  objectives: string[];
  
  // Priority and scheduling
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  dueDate: Date;
  estimatedDuration?: number;
  
  // Status tracking
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue' | 'converted_to_appointment';
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  
  // Outcome
  outcome?: {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    appointmentCreated: boolean;
    appointmentId?: mongoose.Types.ObjectId;
  };
  
  // Trigger information
  trigger: {
    type: 'manual' | 'medication_start' | 'lab_result' | 'hospital_discharge' |
          'medication_change' | 'scheduled_monitoring' | 'missed_appointment' | 'system_rule';
    sourceId?: mongoose.Types.ObjectId;
    sourceType?: string;
    triggerDate: Date;
    triggerDetails?: Record<string, any>;
  };
  
  // Related records
  relatedRecords: {
    medicationId?: mongoose.Types.ObjectId;
    labResultId?: mongoose.Types.ObjectId;
    clinicalInterventionId?: mongoose.Types.ObjectId;
    mtrSessionId?: mongoose.Types.ObjectId;
    appointmentId?: mongoose.Types.ObjectId;
    diagnosticCaseId?: mongoose.Types.ObjectId;
  };
  
  // Metadata for different task types
  metadata?: {
    refillRequest?: {
      medicationId: mongoose.Types.ObjectId;
      medicationName: string;
      currentRefillsRemaining: number;
      requestedQuantity: number;
      patientNotes?: string;
      urgency: 'routine' | 'urgent';
      estimatedPickupDate?: Date;
      requestedBy: mongoose.Types.ObjectId; // Patient who requested
      requestedAt: Date;
      pharmacistNotes?: string;
      approvedQuantity?: number;
      denialReason?: string;
      prescriptionRequired?: boolean;
    };
    // Other metadata types can be added here for different task types
    [key: string]: any;
  };
  
  // Escalation tracking
  escalationHistory: Array<{
    escalatedAt: Date;
    escalatedBy: mongoose.Types.ObjectId;
    fromPriority: string;
    toPriority: string;
    reason: string;
  }>;
  
  // Reminders
  remindersSent: Array<{
    sentAt: Date;
    channel: 'email' | 'sms' | 'push' | 'system';
    recipientId: mongoose.Types.ObjectId;
  }>;
  
  // Audit fields
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  escalate(
    newPriority: IFollowUpTask['priority'],
    reason: string,
    escalatedBy: mongoose.Types.ObjectId
  ): void;
  complete(
    outcome: IFollowUpTask['outcome'],
    completedBy: mongoose.Types.ObjectId
  ): void;
  convertToAppointment(appointmentId: mongoose.Types.ObjectId): void;
  addReminder(
    channel: 'email' | 'sms' | 'push' | 'system',
    recipientId: mongoose.Types.ObjectId
  ): void;
  isCriticallyOverdue(days?: number): boolean;
  
  // Refill request specific methods
  approveRefillRequest(
    approvedQuantity: number,
    pharmacistId: mongoose.Types.ObjectId,
    pharmacistNotes?: string
  ): void;
  denyRefillRequest(
    denialReason: string,
    pharmacistId: mongoose.Types.ObjectId
  ): void;
  requireNewPrescription(
    pharmacistId: mongoose.Types.ObjectId,
    notes?: string
  ): void;
  isRefillEligible(): boolean;
  getRefillRequestDetails(): any;
}

const followUpTaskSchema = new Schema(
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
        'medication_start_followup',
        'lab_result_review',
        'hospital_discharge_followup',
        'medication_change_followup',
        'chronic_disease_monitoring',
        'adherence_check',
        'refill_reminder',
        'preventive_care',
        'general_followup',
        'medication_refill_request',
      ],
      required: [true, 'Follow-up type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Task description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    objectives: {
      type: [String],
      validate: {
        validator: function (objectives: string[]) {
          return objectives && objectives.length > 0 && objectives.length <= 10;
        },
        message: 'Must have 1-10 objectives',
      },
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent', 'critical'],
      default: 'medium',
      required: true,
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
      validate: {
        validator: function (value: Date) {
          return value instanceof Date && !isNaN(value.getTime());
        },
        message: 'Invalid due date',
      },
    },
    estimatedDuration: {
      type: Number,
      min: [5, 'Duration must be at least 5 minutes'],
      max: [480, 'Duration cannot exceed 8 hours'],
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'converted_to_appointment'],
      default: 'pending',
      required: true,
      index: true,
    },
    completedAt: Date,
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
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
      appointmentCreated: {
        type: Boolean,
        default: false,
      },
      appointmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
      },
    },
    trigger: {
      type: {
        type: String,
        enum: [
          'manual',
          'medication_start',
          'lab_result',
          'hospital_discharge',
          'medication_change',
          'scheduled_monitoring',
          'missed_appointment',
          'system_rule',
        ],
        required: true,
      },
      sourceId: {
        type: Schema.Types.ObjectId,
      },
      sourceType: String,
      triggerDate: {
        type: Date,
        required: true,
      },
      triggerDetails: Schema.Types.Mixed,
    },
    relatedRecords: {
      medicationId: {
        type: Schema.Types.ObjectId,
        ref: 'Medication',
      },
      labResultId: {
        type: Schema.Types.ObjectId,
      },
      clinicalInterventionId: {
        type: Schema.Types.ObjectId,
        ref: 'ClinicalIntervention',
      },
      mtrSessionId: {
        type: Schema.Types.ObjectId,
        ref: 'MedicationTherapyReview',
      },
      appointmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
      },
      diagnosticCaseId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticCase',
      },
    },
    
    metadata: {
      refillRequest: {
        medicationId: {
          type: Schema.Types.ObjectId,
          ref: 'Medication',
          required: function(this: IFollowUpTask) {
            return this.type === 'medication_refill_request';
          },
        },
        medicationName: {
          type: String,
          required: function(this: IFollowUpTask) {
            return this.type === 'medication_refill_request';
          },
          trim: true,
          maxlength: [200, 'Medication name cannot exceed 200 characters'],
        },
        currentRefillsRemaining: {
          type: Number,
          required: function(this: IFollowUpTask) {
            return this.type === 'medication_refill_request';
          },
          min: [0, 'Refills remaining cannot be negative'],
          max: [12, 'Refills remaining cannot exceed 12'],
        },
        requestedQuantity: {
          type: Number,
          required: function(this: IFollowUpTask) {
            return this.type === 'medication_refill_request';
          },
          min: [1, 'Requested quantity must be at least 1'],
          max: [365, 'Requested quantity cannot exceed 365 days supply'],
        },
        patientNotes: {
          type: String,
          trim: true,
          maxlength: [1000, 'Patient notes cannot exceed 1000 characters'],
        },
        urgency: {
          type: String,
          enum: {
            values: ['routine', 'urgent'],
            message: 'Urgency must be routine or urgent',
          },
          default: 'routine',
          required: function(this: IFollowUpTask) {
            return this.type === 'medication_refill_request';
          },
        },
        estimatedPickupDate: {
          type: Date,
          validate: {
            validator: function (value: Date) {
              if (!value) return true; // Optional field
              return value >= new Date();
            },
            message: 'Estimated pickup date cannot be in the past',
          },
        },
        requestedBy: {
          type: Schema.Types.ObjectId,
          ref: 'PatientUser',
          required: function(this: IFollowUpTask) {
            return this.type === 'medication_refill_request';
          },
        },
        requestedAt: {
          type: Date,
          required: function(this: IFollowUpTask) {
            return this.type === 'medication_refill_request';
          },
          default: Date.now,
        },
        pharmacistNotes: {
          type: String,
          trim: true,
          maxlength: [1000, 'Pharmacist notes cannot exceed 1000 characters'],
        },
        approvedQuantity: {
          type: Number,
          min: [0, 'Approved quantity cannot be negative'],
          max: [365, 'Approved quantity cannot exceed 365 days supply'],
        },
        denialReason: {
          type: String,
          trim: true,
          maxlength: [500, 'Denial reason cannot exceed 500 characters'],
        },
        prescriptionRequired: {
          type: Boolean,
          default: false,
        },
      },
    },
    escalationHistory: [
      {
        escalatedAt: {
          type: Date,
          required: true,
        },
        escalatedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        fromPriority: {
          type: String,
          required: true,
        },
        toPriority: {
          type: String,
          required: true,
        },
        reason: {
          type: String,
          required: true,
          maxlength: [500, 'Escalation reason cannot exceed 500 characters'],
        },
      },
    ],
    remindersSent: [
      {
        sentAt: {
          type: Date,
          required: true,
        },
        channel: {
          type: String,
          enum: ['email', 'sms', 'push', 'system'],
          required: true,
        },
        recipientId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields
addAuditFields(followUpTaskSchema);

// Apply tenancy guard plugin
followUpTaskSchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Compound indexes for efficient querying
followUpTaskSchema.index({ workplaceId: 1, status: 1, dueDate: 1 });
followUpTaskSchema.index({ workplaceId: 1, patientId: 1, status: 1 });
followUpTaskSchema.index({ workplaceId: 1, assignedTo: 1, status: 1, priority: -1 });
followUpTaskSchema.index({ workplaceId: 1, type: 1, status: 1 });
followUpTaskSchema.index({ status: 1, dueDate: 1 });
followUpTaskSchema.index({ 'trigger.type': 1, 'trigger.sourceId': 1 });
followUpTaskSchema.index({ createdAt: -1 });

// Indexes for refill requests
followUpTaskSchema.index({ type: 1, 'metadata.refillRequest.urgency': 1, status: 1 });
followUpTaskSchema.index({ type: 1, 'metadata.refillRequest.medicationId': 1 });
followUpTaskSchema.index({ type: 1, 'metadata.refillRequest.requestedBy': 1 });
followUpTaskSchema.index({ type: 1, 'metadata.refillRequest.requestedAt': -1 });

// Indexes for related records (critical for engagement integration performance)
followUpTaskSchema.index({ 'relatedRecords.diagnosticCaseId': 1 });
followUpTaskSchema.index({ 'relatedRecords.clinicalInterventionId': 1 });
followUpTaskSchema.index({ 'relatedRecords.mtrSessionId': 1 });
followUpTaskSchema.index({ 'relatedRecords.appointmentId': 1 });
followUpTaskSchema.index({ 'relatedRecords.medicationId': 1 });

// Virtual for patient details
followUpTaskSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for assigned pharmacist details
followUpTaskSchema.virtual('pharmacist', {
  ref: 'User',
  localField: 'assignedTo',
  foreignField: '_id',
  justOne: true,
});

// Virtual for is overdue
followUpTaskSchema.virtual('isOverdue').get(function (this: IFollowUpTask) {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  
  return this.dueDate < new Date();
});

// Virtual for days until due
followUpTaskSchema.virtual('daysUntilDue').get(function (this: IFollowUpTask) {
  const now = new Date();
  const diffTime = this.dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Virtual for days overdue
followUpTaskSchema.virtual('daysOverdue').get(function (this: IFollowUpTask) {
  if (!this.get('isOverdue')) return 0;
  
  const now = new Date();
  const diffTime = now.getTime() - this.dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Virtual for escalation count
followUpTaskSchema.virtual('escalationCount').get(function (this: IFollowUpTask) {
  return this.escalationHistory?.length || 0;
});

// Virtual for has been escalated
followUpTaskSchema.virtual('hasBeenEscalated').get(function (this: IFollowUpTask) {
  return this.escalationHistory && this.escalationHistory.length > 0;
});

// Pre-save validation and auto-status update
followUpTaskSchema.pre('save', function (this: IFollowUpTask) {
  // Trim and filter empty objectives
  if (this.objectives) {
    this.objectives = this.objectives
      .map((obj) => obj.trim())
      .filter((obj) => obj.length > 0);
  }
  
  // Auto-update status to overdue if past due date
  if (
    this.status === 'pending' &&
    this.dueDate < new Date()
  ) {
    this.status = 'overdue';
  }
  
  // Validate outcome is provided when status is completed
  if (this.status === 'completed' && !this.outcome) {
    throw new Error('Outcome is required when marking task as completed');
  }
  
  // Validate objectives
  if (!this.objectives || this.objectives.length === 0) {
    throw new Error('At least one objective is required');
  }
  
  // Validate refill request specific fields
  if (this.type === 'medication_refill_request') {
    if (!this.metadata?.refillRequest) {
      throw new Error('Refill request metadata is required for medication refill request tasks');
    }
    
    const refillData = this.metadata.refillRequest;
    
    // Validate that requested quantity doesn't exceed reasonable limits
    if (refillData.requestedQuantity > refillData.currentRefillsRemaining * 30) {
      throw new Error('Requested quantity exceeds reasonable limits based on remaining refills');
    }
    
    // Validate estimated pickup date is not too far in the future
    if (refillData.estimatedPickupDate) {
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + 90); // 90 days max
      
      if (refillData.estimatedPickupDate > maxFutureDate) {
        throw new Error('Estimated pickup date cannot be more than 90 days in the future');
      }
    }
    
    // Set appropriate priority based on urgency and refills remaining
    if (refillData.urgency === 'urgent' || refillData.currentRefillsRemaining <= 1) {
      this.priority = 'high';
    } else if (refillData.currentRefillsRemaining <= 3) {
      this.priority = 'medium';
    }
  }
});

// Static method to find tasks by patient
followUpTaskSchema.statics.findByPatient = function (
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
  
  baseQuery = baseQuery.sort({ priority: -1, dueDate: 1 });
  
  if (options?.limit) {
    baseQuery = baseQuery.limit(options.limit);
  }
  
  return baseQuery;
};

// Static method to find tasks by pharmacist
followUpTaskSchema.statics.findByPharmacist = function (
  pharmacistId: mongoose.Types.ObjectId,
  options?: { status?: string; priority?: string; workplaceId?: mongoose.Types.ObjectId }
) {
  const query: any = { assignedTo: pharmacistId };
  
  if (options?.status) {
    query.status = options.status;
  }
  
  if (options?.priority) {
    query.priority = options.priority;
  }
  
  if (options?.workplaceId) {
    return this.find(query)
      .setOptions({ workplaceId: options.workplaceId })
      .sort({ priority: -1, dueDate: 1 });
  }
  
  return this.find(query).sort({ priority: -1, dueDate: 1 });
};

// Static method to find overdue tasks
followUpTaskSchema.statics.findOverdue = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    dueDate: { $lt: new Date() },
    status: { $in: ['pending', 'in_progress', 'overdue'] },
  };
  
  if (workplaceId) {
    return this.find(query)
      .setOptions({ workplaceId })
      .sort({ priority: -1, dueDate: 1 });
  }
  
  return this.find(query).sort({ priority: -1, dueDate: 1 });
};

// Static method to find due soon tasks
followUpTaskSchema.statics.findDueSoon = function (
  days: number = 3,
  workplaceId?: mongoose.Types.ObjectId
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);
  
  const query = {
    dueDate: { $gte: today, $lte: futureDate },
    status: { $in: ['pending', 'in_progress'] },
  };
  
  if (workplaceId) {
    return this.find(query)
      .setOptions({ workplaceId })
      .sort({ priority: -1, dueDate: 1 });
  }
  
  return this.find(query).sort({ priority: -1, dueDate: 1 });
};

// Static method to find by trigger
followUpTaskSchema.statics.findByTrigger = function (
  triggerType: string,
  sourceId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    'trigger.type': triggerType,
    'trigger.sourceId': sourceId,
  };
  
  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId });
  }
  
  return this.find(query);
};

// Static method to find refill requests
followUpTaskSchema.statics.findRefillRequests = function (
  workplaceId?: mongoose.Types.ObjectId,
  options?: {
    status?: string;
    urgency?: string;
    patientId?: mongoose.Types.ObjectId;
    medicationId?: mongoose.Types.ObjectId;
    limit?: number;
    skip?: number;
  }
) {
  const query: any = {
    type: 'medication_refill_request',
  };
  
  if (options?.status) {
    query.status = options.status;
  }
  
  if (options?.urgency) {
    query['metadata.refillRequest.urgency'] = options.urgency;
  }
  
  if (options?.patientId) {
    query.patientId = options.patientId;
  }
  
  if (options?.medicationId) {
    query['metadata.refillRequest.medicationId'] = options.medicationId;
  }
  
  let baseQuery;
  if (workplaceId) {
    baseQuery = this.find(query).setOptions({ workplaceId });
  } else {
    baseQuery = this.find(query);
  }
  
  baseQuery = baseQuery
    .populate('patientId', 'firstName lastName phone email')
    .populate('assignedTo', 'firstName lastName')
    .populate('metadata.refillRequest.medicationId', 'name strength dosageForm')
    .sort({ 'metadata.refillRequest.urgency': -1, createdAt: -1 });
  
  if (options?.skip) {
    baseQuery = baseQuery.skip(options.skip);
  }
  
  if (options?.limit) {
    baseQuery = baseQuery.limit(options.limit);
  }
  
  return baseQuery;
};

// Static method to find urgent refill requests
followUpTaskSchema.statics.findUrgentRefillRequests = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    type: 'medication_refill_request',
    status: { $in: ['pending', 'in_progress'] },
    'metadata.refillRequest.urgency': 'urgent',
  };
  
  if (workplaceId) {
    return this.find(query)
      .setOptions({ workplaceId })
      .populate('patientId', 'firstName lastName phone')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: 1 }); // Oldest first for urgent requests
  }
  
  return this.find(query)
    .populate('patientId', 'firstName lastName phone')
    .populate('assignedTo', 'firstName lastName')
    .sort({ createdAt: 1 });
};

// Static method to create refill request task
followUpTaskSchema.statics.createRefillRequest = function (
  refillRequestData: {
    workplaceId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    assignedTo: mongoose.Types.ObjectId;
    medicationId: mongoose.Types.ObjectId;
    medicationName: string;
    currentRefillsRemaining: number;
    requestedQuantity: number;
    urgency?: 'routine' | 'urgent';
    patientNotes?: string;
    estimatedPickupDate?: Date;
    requestedBy: mongoose.Types.ObjectId;
  }
) {
  const taskData = {
    workplaceId: refillRequestData.workplaceId,
    patientId: refillRequestData.patientId,
    assignedTo: refillRequestData.assignedTo,
    type: 'medication_refill_request',
    title: `Refill Request: ${refillRequestData.medicationName}`,
    description: `Patient has requested a refill for ${refillRequestData.medicationName}. ${refillRequestData.requestedQuantity} units requested.`,
    objectives: [
      'Review refill eligibility',
      'Verify remaining refills',
      'Process refill request',
      'Notify patient of decision',
    ],
    priority: refillRequestData.urgency === 'urgent' ? 'high' : 'medium',
    dueDate: new Date(Date.now() + (refillRequestData.urgency === 'urgent' ? 24 : 72) * 60 * 60 * 1000), // 1 day for urgent, 3 days for routine
    trigger: {
      type: 'manual',
      sourceId: refillRequestData.medicationId,
      sourceType: 'Medication',
      triggerDate: new Date(),
      triggerDetails: {
        source: 'patient_portal',
        requestedBy: refillRequestData.requestedBy,
      },
    },
    relatedRecords: {
      medicationId: refillRequestData.medicationId,
    },
    metadata: {
      refillRequest: {
        medicationId: refillRequestData.medicationId,
        medicationName: refillRequestData.medicationName,
        currentRefillsRemaining: refillRequestData.currentRefillsRemaining,
        requestedQuantity: refillRequestData.requestedQuantity,
        urgency: refillRequestData.urgency || 'routine',
        patientNotes: refillRequestData.patientNotes,
        estimatedPickupDate: refillRequestData.estimatedPickupDate,
        requestedBy: refillRequestData.requestedBy,
        requestedAt: new Date(),
      },
    },
    createdBy: refillRequestData.requestedBy,
  };
  
  return this.create(taskData);
};

// Instance method to escalate priority
followUpTaskSchema.methods.escalate = function (
  this: IFollowUpTask,
  newPriority: IFollowUpTask['priority'],
  reason: string,
  escalatedBy: mongoose.Types.ObjectId
) {
  const oldPriority = this.priority;
  
  this.escalationHistory.push({
    escalatedAt: new Date(),
    escalatedBy,
    fromPriority: oldPriority,
    toPriority: newPriority,
    reason,
  });
  
  this.priority = newPriority;
};

// Instance method to complete task
followUpTaskSchema.methods.complete = function (
  this: IFollowUpTask,
  outcome: IFollowUpTask['outcome'],
  completedBy: mongoose.Types.ObjectId
) {
  this.status = 'completed';
  this.outcome = outcome;
  this.completedAt = new Date();
  this.completedBy = completedBy;
};

// Instance method to convert to appointment
followUpTaskSchema.methods.convertToAppointment = function (
  this: IFollowUpTask,
  appointmentId: mongoose.Types.ObjectId
) {
  this.status = 'converted_to_appointment';
  
  if (!this.outcome) {
    this.outcome = {
      status: 'successful',
      notes: 'Converted to appointment',
      nextActions: [],
      appointmentCreated: true,
      appointmentId,
    };
  } else {
    this.outcome.appointmentCreated = true;
    this.outcome.appointmentId = appointmentId;
  }
  
  if (!this.relatedRecords) {
    this.relatedRecords = {};
  }
  this.relatedRecords.appointmentId = appointmentId;
};

// Instance method to add reminder
followUpTaskSchema.methods.addReminder = function (
  this: IFollowUpTask,
  channel: 'email' | 'sms' | 'push' | 'system',
  recipientId: mongoose.Types.ObjectId
) {
  this.remindersSent.push({
    sentAt: new Date(),
    channel,
    recipientId,
  });
};

// Instance method to check if critically overdue
followUpTaskSchema.methods.isCriticallyOverdue = function (
  this: IFollowUpTask,
  days: number = 7
): boolean {
  const daysOverdue = this.get('daysOverdue');
  return daysOverdue > days;
};

// Refill request specific methods
followUpTaskSchema.methods.approveRefillRequest = function (
  this: IFollowUpTask,
  approvedQuantity: number,
  pharmacistId: mongoose.Types.ObjectId,
  pharmacistNotes?: string
): void {
  if (this.type !== 'medication_refill_request') {
    throw new Error('This method can only be called on refill request tasks');
  }
  
  if (!this.metadata?.refillRequest) {
    throw new Error('Refill request metadata is missing');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = pharmacistId;
  
  this.metadata.refillRequest.approvedQuantity = approvedQuantity;
  if (pharmacistNotes) {
    this.metadata.refillRequest.pharmacistNotes = pharmacistNotes;
  }
  
  this.outcome = {
    status: 'successful',
    notes: `Refill approved for ${approvedQuantity} units`,
    nextActions: ['Prepare medication for pickup', 'Notify patient'],
    appointmentCreated: false,
  };
};

followUpTaskSchema.methods.denyRefillRequest = function (
  this: IFollowUpTask,
  denialReason: string,
  pharmacistId: mongoose.Types.ObjectId
): void {
  if (this.type !== 'medication_refill_request') {
    throw new Error('This method can only be called on refill request tasks');
  }
  
  if (!this.metadata?.refillRequest) {
    throw new Error('Refill request metadata is missing');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = pharmacistId;
  
  this.metadata.refillRequest.denialReason = denialReason;
  
  this.outcome = {
    status: 'unsuccessful',
    notes: `Refill denied: ${denialReason}`,
    nextActions: ['Notify patient of denial', 'Suggest alternatives if applicable'],
    appointmentCreated: false,
  };
};

followUpTaskSchema.methods.requireNewPrescription = function (
  this: IFollowUpTask,
  pharmacistId: mongoose.Types.ObjectId,
  notes?: string
): void {
  if (this.type !== 'medication_refill_request') {
    throw new Error('This method can only be called on refill request tasks');
  }
  
  if (!this.metadata?.refillRequest) {
    throw new Error('Refill request metadata is missing');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = pharmacistId;
  
  this.metadata.refillRequest.prescriptionRequired = true;
  if (notes) {
    this.metadata.refillRequest.pharmacistNotes = notes;
  }
  
  this.outcome = {
    status: 'partially_successful',
    notes: 'New prescription required from doctor',
    nextActions: ['Contact doctor for new prescription', 'Schedule appointment if needed'],
    appointmentCreated: false,
  };
};

followUpTaskSchema.methods.isRefillEligible = function (this: IFollowUpTask): boolean {
  if (this.type !== 'medication_refill_request') {
    return false;
  }
  
  if (!this.metadata?.refillRequest) {
    return false;
  }
  
  const refillData = this.metadata.refillRequest;
  
  // Check if there are refills remaining
  if (refillData.currentRefillsRemaining <= 0) {
    return false;
  }
  
  // Check if task is still pending
  if (this.status !== 'pending' && this.status !== 'in_progress') {
    return false;
  }
  
  return true;
};

followUpTaskSchema.methods.getRefillRequestDetails = function (this: IFollowUpTask): any {
  if (this.type !== 'medication_refill_request') {
    return null;
  }
  
  if (!this.metadata?.refillRequest) {
    return null;
  }
  
  const refillData = this.metadata.refillRequest;
  
  return {
    medicationName: refillData.medicationName,
    requestedQuantity: refillData.requestedQuantity,
    currentRefillsRemaining: refillData.currentRefillsRemaining,
    urgency: refillData.urgency,
    patientNotes: refillData.patientNotes,
    requestedAt: refillData.requestedAt,
    estimatedPickupDate: refillData.estimatedPickupDate,
    isEligible: this.isRefillEligible(),
    status: this.status,
    approvedQuantity: refillData.approvedQuantity,
    denialReason: refillData.denialReason,
    pharmacistNotes: refillData.pharmacistNotes,
    prescriptionRequired: refillData.prescriptionRequired,
  };
};

export default mongoose.model<IFollowUpTask>('FollowUpTask', followUpTaskSchema);
