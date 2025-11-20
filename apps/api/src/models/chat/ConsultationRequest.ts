import mongoose, { Document, Schema } from 'mongoose';

/**
 * ConsultationRequest Model
 * 
 * Allows patients to request consultations with pharmacists
 */

export interface IConsultationRequest extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  
  // Request details
  reason: string;
  priority: 'normal' | 'urgent';
  requestedAt: Date; // Alias for createdAt
  
  // Assignment
  assignedTo?: mongoose.Types.ObjectId; // Pharmacist who accepted
  acceptedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  
  // Resulting conversation
  conversationId?: mongoose.Types.ObjectId;
  
  // Escalation tracking
  escalationCount: number;
  escalationLevel: number; // Alias for escalationCount
  lastEscalatedAt?: Date;
  
  // Metadata
  workplaceId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  accept(pharmacistId: mongoose.Types.ObjectId): Promise<this>;
  complete(): Promise<this>;
  cancel(reason?: string): Promise<this>;
  escalate(): Promise<this>;
  isExpired(): boolean;
  needsEscalation(): boolean;
}

export interface IConsultationRequestModel extends mongoose.Model<IConsultationRequest> {
  findPending(workplaceId: string): Promise<any[]>;
  findByPatient(patientId: string, workplaceId: string): Promise<any[]>;
  findByPharmacist(pharmacistId: string, workplaceId: string): Promise<any[]>;
  findNeedingEscalation(workplaceId: string): Promise<IConsultationRequest[]>;
}

const ConsultationRequestSchema = new Schema<IConsultationRequest>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'completed', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent'],
      default: 'normal',
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatConversation',
      index: true,
    },
    escalationCount: {
      type: Number,
      default: 0,
    },
    lastEscalatedAt: {
      type: Date,
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
  }
);

// Compound indexes for common queries
ConsultationRequestSchema.index({ workplaceId: 1, status: 1, priority: -1, createdAt: -1 });
ConsultationRequestSchema.index({ patientId: 1, status: 1 });
ConsultationRequestSchema.index({ assignedTo: 1, status: 1 });
ConsultationRequestSchema.index({ status: 1, createdAt: 1 }); // For escalation queries

// Instance methods
ConsultationRequestSchema.methods.accept = function (pharmacistId: mongoose.Types.ObjectId) {
  this.status = 'accepted';
  this.assignedTo = pharmacistId;
  this.acceptedAt = new Date();
  return this.save();
};

ConsultationRequestSchema.methods.complete = function () {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

ConsultationRequestSchema.methods.cancel = function (reason?: string) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  if (reason) {
    this.cancellationReason = reason;
  }
  return this.save();
};

ConsultationRequestSchema.methods.escalate = function () {
  this.escalationCount += 1;
  this.lastEscalatedAt = new Date();
  return this.save();
};

ConsultationRequestSchema.methods.isExpired = function (): boolean {
  // Consider request expired if pending for more than 30 minutes
  if (this.status !== 'pending') return false;
  
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  return this.createdAt < thirtyMinutesAgo;
};

ConsultationRequestSchema.methods.needsEscalation = function (): boolean {
  // Escalate if pending for more than 5 minutes and not yet escalated
  // Or if escalated but still pending after another 5 minutes
  if (this.status !== 'pending') return false;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  if (this.escalationCount === 0) {
    return this.createdAt < fiveMinutesAgo;
  } else if (this.lastEscalatedAt) {
    return this.lastEscalatedAt < fiveMinutesAgo;
  }
  
  return false;
};

// Static methods
ConsultationRequestSchema.statics.findPending = function (workplaceId: string) {
  return this.find({
    workplaceId: new mongoose.Types.ObjectId(workplaceId),
    status: 'pending',
  })
    .sort({ priority: -1, createdAt: 1 }) // Urgent first, then oldest first
    .populate('patientId', 'firstName lastName email phone')
    .lean();
};

ConsultationRequestSchema.statics.findByPatient = function (
  patientId: string,
  workplaceId: string
) {
  return this.find({
    patientId: new mongoose.Types.ObjectId(patientId),
    workplaceId: new mongoose.Types.ObjectId(workplaceId),
  })
    .sort({ createdAt: -1 })
    .populate('assignedTo', 'firstName lastName')
    .lean();
};

ConsultationRequestSchema.statics.findByPharmacist = function (
  pharmacistId: string,
  workplaceId: string
) {
  return this.find({
    assignedTo: new mongoose.Types.ObjectId(pharmacistId),
    workplaceId: new mongoose.Types.ObjectId(workplaceId),
  })
    .sort({ createdAt: -1 })
    .populate('patientId', 'firstName lastName')
    .lean();
};

ConsultationRequestSchema.statics.findNeedingEscalation = function (workplaceId: string) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  return this.find({
    workplaceId: new mongoose.Types.ObjectId(workplaceId),
    status: 'pending',
    $or: [
      // Never escalated and older than 5 minutes
      {
        escalationCount: 0,
        createdAt: { $lt: fiveMinutesAgo },
      },
      // Escalated but still pending after another 5 minutes
      {
        escalationCount: { $gt: 0 },
        lastEscalatedAt: { $lt: fiveMinutesAgo },
      },
    ],
  });
};

// Virtual properties for aliases
ConsultationRequestSchema.virtual('requestedAt').get(function(this: IConsultationRequest) {
  return this.createdAt;
});

ConsultationRequestSchema.virtual('escalationLevel').get(function(this: IConsultationRequest) {
  return this.escalationCount;
});

// Ensure virtuals are included in JSON
ConsultationRequestSchema.set('toJSON', { virtuals: true });
ConsultationRequestSchema.set('toObject', { virtuals: true });

export const ConsultationRequest = mongoose.model<IConsultationRequest, IConsultationRequestModel>(
  'ConsultationRequest',
  ConsultationRequestSchema
);

export default ConsultationRequest;
