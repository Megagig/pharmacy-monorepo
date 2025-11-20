import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IInteractionDetail {
  drug1: {
    name: string;
    rxcui?: string;
    medicationId?: mongoose.Types.ObjectId;
  };
  drug2: {
    name: string;
    rxcui?: string;
    medicationId?: mongoose.Types.ObjectId;
  };
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  description: string;
  clinicalSignificance?: string;
  managementRecommendation?: string;
  source: string;
  sourceUrl?: string;
}

export interface IDrugInteraction extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  
  // Medications being checked
  medications: Array<{
    medicationId?: mongoose.Types.ObjectId;
    name: string;
    rxcui?: string;
    dosage?: string;
    frequency?: string;
  }>;
  
  // Found interactions
  interactions: IInteractionDetail[];
  
  // Review status
  status: 'pending' | 'reviewed' | 'approved' | 'modified' | 'rejected' | 'monitoring';
  
  // Pharmacist review
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  pharmacistNotes?: string;
  reviewDecision?: {
    action: 'approve' | 'modify' | 'reject' | 'monitor';
    reason: string;
    modificationSuggestions?: string;
    monitoringParameters?: string;
  };
  
  // Patient communication
  patientNotified: boolean;
  patientNotificationDate?: Date;
  patientAcknowledged: boolean;
  patientAcknowledgedDate?: Date;
  
  // Critical interaction flags
  hasCriticalInteraction: boolean;
  hasContraindication: boolean;
  requiresPharmacistReview: boolean;
  
  // Check metadata
  checkType: 'manual' | 'automatic' | 'scheduled';
  checkTrigger?: string; // What triggered the check
  apiSource: string; // RxNorm, etc.
  
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;

  // Instance methods
  markAsReviewed(reviewerId: mongoose.Types.ObjectId, decision: any, notes?: string): Promise<IDrugInteraction>;
  notifyPatient(): Promise<IDrugInteraction>;
  acknowledgeByPatient(): Promise<IDrugInteraction>;
}

export interface IDrugInteractionModel extends mongoose.Model<IDrugInteraction> {
  // Static methods
  findPendingReviews(workplaceId: mongoose.Types.ObjectId): mongoose.Query<IDrugInteraction[], IDrugInteraction>;
  findCriticalInteractions(workplaceId: mongoose.Types.ObjectId, timeRange?: { from: Date; to: Date }): mongoose.Query<IDrugInteraction[], IDrugInteraction>;
  findByPatient(patientId: mongoose.Types.ObjectId, includeResolved?: boolean): mongoose.Query<IDrugInteraction[], IDrugInteraction>;
}

const interactionDetailSchema = new Schema<IInteractionDetail>({
  drug1: {
    name: { type: String, required: true },
    rxcui: { type: String },
    medicationId: { type: Schema.Types.ObjectId, ref: 'Medication' }
  },
  drug2: {
    name: { type: String, required: true },
    rxcui: { type: String },
    medicationId: { type: Schema.Types.ObjectId, ref: 'Medication' }
  },
  severity: {
    type: String,
    enum: ['contraindicated', 'major', 'moderate', 'minor'],
    required: true
  },
  description: { type: String, required: true },
  clinicalSignificance: { type: String },
  managementRecommendation: { type: String },
  source: { type: String, required: true },
  sourceUrl: { type: String }
});

const drugInteractionSchema = new Schema<IDrugInteraction>(
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
    medications: [{
      medicationId: { type: Schema.Types.ObjectId, ref: 'MedicationManagement' },
      name: { type: String, required: true },
      rxcui: { type: String },
      dosage: { type: String },
      frequency: { type: String }
    }],
    interactions: [interactionDetailSchema],
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'approved', 'modified', 'rejected', 'monitoring'],
      default: 'pending',
      index: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    pharmacistNotes: {
      type: String,
      trim: true
    },
    reviewDecision: {
      action: {
        type: String,
        enum: ['approve', 'modify', 'reject', 'monitor']
      },
      reason: { type: String },
      modificationSuggestions: { type: String },
      monitoringParameters: { type: String }
    },
    patientNotified: {
      type: Boolean,
      default: false
    },
    patientNotificationDate: {
      type: Date
    },
    patientAcknowledged: {
      type: Boolean,
      default: false
    },
    patientAcknowledgedDate: {
      type: Date
    },
    hasCriticalInteraction: {
      type: Boolean,
      default: false,
      index: true
    },
    hasContraindication: {
      type: Boolean,
      default: false,
      index: true
    },
    requiresPharmacistReview: {
      type: Boolean,
      default: true,
      index: true
    },
    checkType: {
      type: String,
      enum: ['manual', 'automatic', 'scheduled'],
      default: 'manual'
    },
    checkTrigger: {
      type: String
    },
    apiSource: {
      type: String,
      default: 'RxNorm'
    }
  },
  {
    timestamps: true,
  }
);

// Add auditing fields
addAuditFields(drugInteractionSchema);

// Apply tenancy guard plugin
drugInteractionSchema.plugin(tenancyGuardPlugin);

// Indexes for efficient queries
drugInteractionSchema.index({ patientId: 1, status: 1 });
drugInteractionSchema.index({ workplaceId: 1, requiresPharmacistReview: 1 });
drugInteractionSchema.index({ reviewedBy: 1, reviewedAt: -1 });
drugInteractionSchema.index({ hasCriticalInteraction: 1 });
drugInteractionSchema.index({ createdAt: -1 });

// Methods
drugInteractionSchema.methods.markAsReviewed = function(
  reviewerId: mongoose.Types.ObjectId, 
  decision: any, 
  notes?: string
) {
  this.status = 'reviewed';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewDecision = decision;
  this.pharmacistNotes = notes;
  this.updatedBy = reviewerId;
  return this.save();
};

drugInteractionSchema.methods.notifyPatient = function() {
  this.patientNotified = true;
  this.patientNotificationDate = new Date();
  return this.save();
};

drugInteractionSchema.methods.acknowledgeByPatient = function() {
  this.patientAcknowledged = true;
  this.patientAcknowledgedDate = new Date();
  return this.save();
};

// Static methods for common queries
drugInteractionSchema.statics.findPendingReviews = function(workplaceId: mongoose.Types.ObjectId) {
  return this.find({
    workplaceId,
    requiresPharmacistReview: true,
    status: 'pending'
  }).populate('patientId', 'firstName lastName')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

drugInteractionSchema.statics.findCriticalInteractions = function(
  workplaceId: mongoose.Types.ObjectId,
  timeRange?: { from: Date; to: Date }
) {
  const query: any = {
    workplaceId,
    $or: [
      { hasCriticalInteraction: true },
      { hasContraindication: true }
    ]
  };
  
  if (timeRange) {
    query.createdAt = { $gte: timeRange.from, $lte: timeRange.to };
  }
  
  return this.find(query)
    .populate('patientId', 'firstName lastName')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

drugInteractionSchema.statics.findByPatient = function(
  patientId: mongoose.Types.ObjectId,
  includeResolved = false
) {
  const query: any = { patientId };
  
  if (!includeResolved) {
    query.status = { $in: ['pending', 'monitoring'] };
  }
  
  return this.find(query)
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

export default mongoose.model<IDrugInteraction, IDrugInteractionModel>('DrugInteraction', drugInteractionSchema);