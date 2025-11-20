import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface ICondition extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  name: string; // e.g., Hypertension
  snomedId?: string;
  onsetDate?: Date;
  status?: 'active' | 'resolved' | 'remission';
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conditionSchema = new Schema(
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
    name: {
      type: String,
      required: [true, 'Condition name is required'],
      trim: true,
      maxlength: [100, 'Condition name cannot exceed 100 characters'],
    },
    snomedId: {
      type: String,
      trim: true,
      validate: {
        validator: function (value: string) {
          if (value) {
            // SNOMED CT identifier validation (numeric, typically 6-18 digits)
            return /^\d{6,18}$/.test(value);
          }
          return true;
        },
        message: 'Invalid SNOMED CT identifier format',
      },
      index: true,
    },
    onsetDate: {
      type: Date,
      validate: {
        validator: function (value: Date) {
          if (value) {
            // Cannot be in the future
            return value <= new Date();
          }
          return true;
        },
        message: 'Onset date cannot be in the future',
      },
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'remission'],
      default: 'active',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(conditionSchema);

// Apply tenancy guard plugin
conditionSchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Indexes for efficient querying
conditionSchema.index({ workplaceId: 1, patientId: 1 });
conditionSchema.index({ workplaceId: 1, name: 1 });
conditionSchema.index({ workplaceId: 1, status: 1 });
conditionSchema.index({ workplaceId: 1, isDeleted: 1 });
conditionSchema.index({ snomedId: 1 }, { sparse: true });
conditionSchema.index({ onsetDate: -1 });
conditionSchema.index({ createdAt: -1 });

// Compound index to prevent duplicate conditions for the same patient
conditionSchema.index(
  { workplaceId: 1, patientId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);

// Virtual to populate patient details
conditionSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save validation and normalization
conditionSchema.pre('save', function (this: ICondition) {
  // Normalize condition name
  if (this.name) {
    this.name = this.name.trim();
  }

  // If status is resolved or remission, ensure onset date is set
  if (
    (this.status === 'resolved' || this.status === 'remission') &&
    !this.onsetDate
  ) {
    // Set a reasonable default onset date (1 month ago) if not provided
    this.onsetDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
});

// Static method to find conditions for a patient
conditionSchema.statics.findByPatient = function (
  patientId: mongoose.Types.ObjectId,
  status?: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query: any = { patientId };
  if (status) {
    query.status = status;
  }

  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ onsetDate: -1 });
  }
  return this.find(query).sort({ onsetDate: -1 });
};

// Static method to find active conditions
conditionSchema.statics.findActiveConditions = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { status: 'active' };

  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ createdAt: -1 });
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to search by condition name
conditionSchema.statics.searchByName = function (
  searchTerm: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    name: new RegExp(searchTerm, 'i'), // Case-insensitive search
  };

  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ name: 1 });
  }
  return this.find(query).sort({ name: 1 });
};

// Instance methods
conditionSchema.methods.isActive = function (this: ICondition): boolean {
  return this.status === 'active';
};

conditionSchema.methods.resolve = function (
  this: ICondition,
  notes?: string
): void {
  this.status = 'resolved';
  if (notes) {
    this.notes = notes;
  }
};

conditionSchema.methods.setRemission = function (
  this: ICondition,
  notes?: string
): void {
  this.status = 'remission';
  if (notes) {
    this.notes = notes;
  }
};

// Virtual for duration (if resolved)
conditionSchema.virtual('duration').get(function (this: ICondition) {
  if (this.onsetDate && this.status === 'resolved') {
    const endDate = this.updatedAt || new Date();
    const diffTime = Math.abs(endDate.getTime() - this.onsetDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
});

export default mongoose.model<ICondition>('Condition', conditionSchema);
