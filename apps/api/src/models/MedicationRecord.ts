import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IMedicationRecord extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId; // ref Patient, indexed
  phase: 'past' | 'current';
  medicationName: string;
  purposeIndication?: string;
  dose?: string; // e.g., 500 mg
  frequency?: string; // e.g., bd, tid
  route?: string; // e.g., PO
  duration?: string; // e.g., 5 days
  startDate?: Date;
  endDate?: Date;
  adherence?: 'good' | 'poor' | 'unknown';
  notes?: string;
  isManual?: boolean; // Flag to indicate if medication was manually entered
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const medicationRecordSchema = new Schema(
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
    phase: {
      type: String,
      enum: ['past', 'current'],
      required: [true, 'Phase is required'],
      index: true,
    },
    medicationName: {
      type: String,
      required: [true, 'Medication name is required'],
      trim: true,
      maxlength: [100, 'Medication name cannot exceed 100 characters'],
    },
    purposeIndication: {
      type: String,
      trim: true,
      maxlength: [200, 'Purpose/indication cannot exceed 200 characters'],
    },
    dose: {
      type: String,
      trim: true,
      maxlength: [50, 'Dose cannot exceed 50 characters'],
      validate: {
        validator: function (value: string) {
          if (value) {
            // Common dose patterns: numbers with units (mg, g, ml, etc.)
            const dosePattern =
              /^\d+(\.\d+)?\s*(mg|g|ml|mcg|units?|tablets?|capsules?|drops?|puffs?|sachets?)$/i;
            return dosePattern.test(value) || value.length <= 50;
          }
          return true;
        },
        message: 'Invalid dose format',
      },
    },
    frequency: {
      type: String,
      trim: true,
      maxlength: [50, 'Frequency cannot exceed 50 characters'],
      validate: {
        validator: function (value: string) {
          if (value) {
            // Common frequency patterns: od, bd, tid, qid, prn, etc.
            const freqPattern =
              /^(od|bd|tid|qid|q[1-9]h|q[1-2][0-9]h|prn|stat|sos|nocte|mane|as needed|once daily|twice daily|three times daily|four times daily)$/i;
            return freqPattern.test(value) || value.length <= 50;
          }
          return true;
        },
        message: 'Invalid frequency format',
      },
    },
    route: {
      type: String,
      trim: true,
      maxlength: [20, 'Route cannot exceed 20 characters'],
      validate: {
        validator: function (value: string) {
          if (value) {
            // Common routes: PO, IV, IM, SC, SL, PR, PV, topical, etc.
            const routePattern =
              /^(PO|IV|IM|SC|SL|PR|PV|topical|inhalation|nasal|ophthalmic|otic|rectal|vaginal|transdermal)$/i;
            return routePattern.test(value) || value.length <= 20;
          }
          return true;
        },
        message: 'Invalid route format',
      },
    },
    duration: {
      type: String,
      trim: true,
      maxlength: [50, 'Duration cannot exceed 50 characters'],
    },
    startDate: {
      type: Date,
      validate: {
        validator: function (value: Date) {
          if (value) {
            // Start date should not be too far in the future
            const futureLimit = new Date();
            futureLimit.setDate(futureLimit.getDate() + 7); // Max 7 days in future
            return value <= futureLimit;
          }
          return true;
        },
        message: 'Start date cannot be more than 7 days in the future',
      },
    },
    endDate: {
      type: Date,
      validate: {
        validator: function (this: IMedicationRecord, value: Date) {
          if (value && this.startDate) {
            // End date should be after start date
            return value >= this.startDate;
          }
          return true;
        },
        message: 'End date must be after start date',
      },
    },
    adherence: {
      type: String,
      enum: ['good', 'poor', 'unknown'],
      default: 'unknown',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    isManual: {
      type: Boolean,
      default: false, // Default to false (database entry)
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(medicationRecordSchema);

// Apply tenancy guard plugin
medicationRecordSchema.plugin(tenancyGuardPlugin, {
  pharmacyIdField: 'workplaceId',
});

// Indexes for efficient querying
medicationRecordSchema.index({ workplaceId: 1, patientId: 1, phase: 1 });
medicationRecordSchema.index({ workplaceId: 1, medicationName: 1 });
medicationRecordSchema.index({ workplaceId: 1, isDeleted: 1 });
medicationRecordSchema.index({ phase: 1, startDate: -1 });
medicationRecordSchema.index({ adherence: 1 });
medicationRecordSchema.index({ createdAt: -1 });

// Virtual to populate patient details
medicationRecordSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for medication status
medicationRecordSchema
  .virtual('status')
  .get(function (this: IMedicationRecord) {
    if (this.phase === 'past') {
      return 'completed';
    }

    if (this.endDate) {
      const now = new Date();
      if (now > this.endDate) {
        return 'expired';
      }
    }

    return 'active';
  });

// Virtual for treatment duration in days
medicationRecordSchema
  .virtual('treatmentDurationDays')
  .get(function (this: IMedicationRecord) {
    if (this.startDate && this.endDate) {
      const diffTime = Math.abs(
        this.endDate.getTime() - this.startDate.getTime()
      );
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return null;
  });

// Pre-save validation and normalization
medicationRecordSchema.pre('save', function (this: IMedicationRecord) {
  // Normalize medication name
  if (this.medicationName) {
    this.medicationName = this.medicationName.trim();
  }

  // Auto-set phase based on dates
  if (this.endDate && this.endDate < new Date()) {
    this.phase = 'past';
  }

  // Validate current medications have start date
  if (this.phase === 'current' && !this.startDate) {
    this.startDate = new Date(); // Default to today
  }
});

// Static method to find medications for a patient
medicationRecordSchema.statics.findByPatient = function (
  patientId: mongoose.Types.ObjectId,
  phase?: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query: any = { patientId };
  if (phase) {
    query.phase = phase;
  }

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ phase: 1, startDate: -1 });
};

// Static method to find current medications
medicationRecordSchema.statics.findCurrentMedications = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { phase: 'current' };

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ startDate: -1 });
};

// Static method to search by medication name
medicationRecordSchema.statics.searchByName = function (
  searchTerm: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    medicationName: new RegExp(searchTerm, 'i'), // Case-insensitive search
  };

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ medicationName: 1 });
};

// Instance methods
medicationRecordSchema.methods.isCurrent = function (
  this: IMedicationRecord
): boolean {
  return (
    this.phase === 'current' && (!this.endDate || this.endDate >= new Date())
  );
};

medicationRecordSchema.methods.markAsCompleted = function (
  this: IMedicationRecord,
  endDate?: Date
): void {
  this.phase = 'past';
  this.endDate = endDate || new Date();
};

medicationRecordSchema.methods.extendTreatment = function (
  this: IMedicationRecord,
  newEndDate: Date
): void {
  if (this.phase === 'current') {
    this.endDate = newEndDate;
  }
};

medicationRecordSchema.methods.updateAdherence = function (
  this: IMedicationRecord,
  adherence: 'good' | 'poor' | 'unknown',
  notes?: string
): void {
  this.adherence = adherence;
  if (notes) {
    this.notes = notes;
  }
};

// Method to get formatted dose and frequency
medicationRecordSchema.methods.getFormattedDosing = function (
  this: IMedicationRecord
): string {
  const parts = [];
  if (this.dose) parts.push(this.dose);
  if (this.frequency) parts.push(this.frequency);
  if (this.route) parts.push(this.route);
  return parts.join(' ');
};

export default mongoose.model<IMedicationRecord>(
  'MedicationRecord',
  medicationRecordSchema
);
