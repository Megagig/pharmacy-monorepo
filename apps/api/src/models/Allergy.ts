import mongoose, { Document, Schema } from 'mongoose';
import {
  tenancyGuardPlugin,
  addAuditFields,
  SEVERITY_LEVELS,
} from '../utils/tenancyGuard';

export interface IAllergy extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId; // ref Patient, indexed
  substance: string; // drug/food/environment
  reaction?: string; // e.g., rash, anaphylaxis
  severity?: 'mild' | 'moderate' | 'severe';
  notedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const allergySchema = new Schema(
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
    substance: {
      type: String,
      required: [true, 'Allergy substance is required'],
      trim: true,
      maxlength: [100, 'Substance name cannot exceed 100 characters'],
    },
    reaction: {
      type: String,
      trim: true,
      maxlength: [200, 'Reaction description cannot exceed 200 characters'],
    },
    severity: {
      type: String,
      enum: SEVERITY_LEVELS,
      default: 'mild',
    },
    notedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(allergySchema);

// Apply tenancy guard plugin
allergySchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Indexes for efficient querying
allergySchema.index({ workplaceId: 1, patientId: 1 });
allergySchema.index({ workplaceId: 1, substance: 1 });
allergySchema.index({ workplaceId: 1, isDeleted: 1 });
allergySchema.index({ severity: 1 });
allergySchema.index({ createdAt: -1 });

// Compound index to prevent duplicate allergies for the same patient
allergySchema.index(
  { workplaceId: 1, patientId: 1, substance: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);

// Virtual to populate patient details
allergySchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save validation
allergySchema.pre('save', function (this: IAllergy) {
  // Ensure notedAt is set
  if (!this.notedAt) {
    this.notedAt = new Date();
  }

  // Normalize substance name
  if (this.substance) {
    this.substance = this.substance.trim();
  }
});

// Static method to find allergies for a patient
allergySchema.statics.findByPatient = function (
  patientId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query: any = { patientId };
  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId });
  }
  return this.find(query);
};

// Static method to find by substance
allergySchema.statics.findBySubstance = function (
  substance: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    substance: new RegExp(substance, 'i'), // Case-insensitive search
  };

  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId });
  }
  return this.find(query);
};

// Instance method to check if allergy is critical
allergySchema.methods.isCritical = function (this: IAllergy): boolean {
  return this.severity === 'severe';
};

export default mongoose.model<IAllergy>('Allergy', allergySchema);
