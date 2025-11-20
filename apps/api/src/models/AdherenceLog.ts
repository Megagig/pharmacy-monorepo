import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IAdherenceLog extends Document {
  _id: mongoose.Types.ObjectId;
  medicationId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  refillDate: Date;
  adherenceScore: number;
  pillCount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
}

const adherenceLogSchema = new Schema<IAdherenceLog>(
  {
    medicationId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicationManagement',
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    refillDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    adherenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    pillCount: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add auditing fields
addAuditFields(adherenceLogSchema);

// Apply tenancy guard plugin
adherenceLogSchema.plugin(tenancyGuardPlugin);

// Create compound index for medication and refill date
adherenceLogSchema.index({ medicationId: 1, refillDate: 1 });

// Create compound index for patient and refill date for quick lookups
adherenceLogSchema.index({ patientId: 1, refillDate: -1 });

export default mongoose.model<IAdherenceLog>(
  'AdherenceLog',
  adherenceLogSchema
);
