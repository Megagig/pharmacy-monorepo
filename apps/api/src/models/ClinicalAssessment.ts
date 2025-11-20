import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IVitals {
  bpSys?: number;
  bpDia?: number;
  rr?: number;
  tempC?: number;
  heartSounds?: string;
  pallor?: 'none' | 'mild' | 'moderate' | 'severe';
  dehydration?: 'none' | 'mild' | 'moderate' | 'severe';
}

export interface ILabs {
  pcv?: number; // Packed Cell Volume
  mcs?: string; // Microscopy, Culture & Sensitivity
  eucr?: string; // Electrolyte, Urea, Creatinine
  fbc?: string; // Full Blood Count
  fbs?: number; // Fasting Blood Sugar
  hba1c?: number; // HbA1c
  misc?: Record<string, string | number>; // Other miscellaneous lab values
}

export interface IClinicalAssessment extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  visitId?: mongoose.Types.ObjectId; // ref Visit
  vitals?: IVitals;
  labs?: ILabs;
  recordedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vitalsSchema = new Schema(
  {
    bpSys: {
      type: Number,
      min: [50, 'Systolic BP too low'],
      max: [300, 'Systolic BP too high'],
    },
    bpDia: {
      type: Number,
      min: [30, 'Diastolic BP too low'],
      max: [200, 'Diastolic BP too high'],
    },
    rr: {
      type: Number,
      min: [8, 'Respiratory rate too low'],
      max: [60, 'Respiratory rate too high'],
    },
    tempC: {
      type: Number,
      min: [30, 'Temperature too low'],
      max: [45, 'Temperature too high'],
    },
    heartSounds: {
      type: String,
      trim: true,
      maxlength: [200, 'Heart sounds description too long'],
    },
    pallor: {
      type: String,
      enum: ['none', 'mild', 'moderate', 'severe'],
    },
    dehydration: {
      type: String,
      enum: ['none', 'mild', 'moderate', 'severe'],
    },
  },
  { _id: false }
);

const labsSchema = new Schema(
  {
    pcv: {
      type: Number,
      min: [10, 'PCV too low'],
      max: [60, 'PCV too high'],
    },
    mcs: {
      type: String,
      trim: true,
      maxlength: [500, 'MCS result too long'],
    },
    eucr: {
      type: String,
      trim: true,
      maxlength: [500, 'EUCr result too long'],
    },
    fbc: {
      type: String,
      trim: true,
      maxlength: [500, 'FBC result too long'],
    },
    fbs: {
      type: Number,
      min: [30, 'FBS too low'],
      max: [600, 'FBS too high'],
    },
    hba1c: {
      type: Number,
      min: [3.0, 'HbA1c too low'],
      max: [20.0, 'HbA1c too high'],
    },
    misc: {
      type: Schema.Types.Mixed,
      validate: {
        validator: function (value: any) {
          if (value && typeof value === 'object') {
            // Ensure all keys are strings and values are strings or numbers
            return Object.keys(value).every(
              (key) =>
                typeof key === 'string' &&
                (typeof value[key] === 'string' ||
                  typeof value[key] === 'number')
            );
          }
          return true;
        },
        message:
          'Misc labs must be an object with string keys and string/number values',
      },
    },
  },
  { _id: false }
);

const clinicalAssessmentSchema = new Schema(
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
    visitId: {
      type: Schema.Types.ObjectId,
      ref: 'Visit',
      index: true,
    },
    vitals: vitalsSchema,
    labs: labsSchema,
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
      validate: {
        validator: function (value: Date) {
          // Cannot be more than 1 day in the future
          const futureLimit = new Date();
          futureLimit.setDate(futureLimit.getDate() + 1);
          return value <= futureLimit;
        },
        message: 'Recorded date cannot be more than 1 day in the future',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(clinicalAssessmentSchema);

// Apply tenancy guard plugin
clinicalAssessmentSchema.plugin(tenancyGuardPlugin, {
  pharmacyIdField: 'workplaceId',
});

// Indexes for efficient querying
clinicalAssessmentSchema.index({
  workplaceId: 1,
  patientId: 1,
  recordedAt: -1,
});
clinicalAssessmentSchema.index({ workplaceId: 1, visitId: 1 });
clinicalAssessmentSchema.index({ workplaceId: 1, isDeleted: 1 });
clinicalAssessmentSchema.index({ recordedAt: -1 });
clinicalAssessmentSchema.index({ createdAt: -1 });

// Virtual to populate patient details
clinicalAssessmentSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual to populate visit details
clinicalAssessmentSchema.virtual('visit', {
  ref: 'Visit',
  localField: 'visitId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for blood pressure reading
clinicalAssessmentSchema
  .virtual('bloodPressure')
  .get(function (this: IClinicalAssessment) {
    if (this.vitals?.bpSys && this.vitals?.bpDia) {
      return `${this.vitals.bpSys}/${this.vitals.bpDia}`;
    }
    return null;
  });

// Virtual for temperature in Fahrenheit
clinicalAssessmentSchema
  .virtual('tempF')
  .get(function (this: IClinicalAssessment) {
    if (this.vitals?.tempC) {
      return (this.vitals.tempC * 9) / 5 + 32;
    }
    return null;
  });

// Pre-save validation and normalization
clinicalAssessmentSchema.pre('save', function (this: IClinicalAssessment) {
  // Ensure at least vitals or labs are provided
  if (!this.vitals && !this.labs) {
    throw new Error('Either vitals or labs must be provided');
  }

  // Validate BP readings
  if (this.vitals?.bpSys && this.vitals?.bpDia) {
    if (this.vitals.bpSys <= this.vitals.bpDia) {
      throw new Error('Systolic BP must be higher than diastolic BP');
    }
  }

  // Round temperature to 1 decimal place
  if (this.vitals?.tempC) {
    this.vitals.tempC = Math.round(this.vitals.tempC * 10) / 10;
  }

  // Round lab values
  if (this.labs?.pcv) {
    this.labs.pcv = Math.round(this.labs.pcv * 10) / 10;
  }
  if (this.labs?.fbs) {
    this.labs.fbs = Math.round(this.labs.fbs);
  }
  if (this.labs?.hba1c) {
    this.labs.hba1c = Math.round(this.labs.hba1c * 10) / 10;
  }
});

// Static method to find assessments for a patient
clinicalAssessmentSchema.statics.findByPatient = function (
  patientId: mongoose.Types.ObjectId,
  limit?: number,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { patientId };

  let baseQuery;
  if (workplaceId) {
    baseQuery = this.find(query).setOptions({ workplaceId });
  } else {
    baseQuery = this.find(query);
  }

  baseQuery = baseQuery.sort({ recordedAt: -1 });

  if (limit) {
    baseQuery = baseQuery.limit(limit);
  }

  return baseQuery;
};

// Static method to find latest assessment for a patient
clinicalAssessmentSchema.statics.findLatestByPatient = function (
  patientId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { patientId };

  if (workplaceId) {
    return this.findOne(query)
      .setOptions({ workplaceId })
      .sort({ recordedAt: -1 });
  }
  return this.findOne(query).sort({ recordedAt: -1 });
};

// Static method to find assessments by visit
clinicalAssessmentSchema.statics.findByVisit = function (
  visitId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { visitId };

  if (workplaceId) {
    return this.find(query)
      .setOptions({ workplaceId })
      .sort({ recordedAt: -1 });
  }
  return this.find(query).sort({ recordedAt: -1 });
};

// Instance methods
clinicalAssessmentSchema.methods.hasVitals = function (
  this: IClinicalAssessment
): boolean {
  return !!(this.vitals && Object.keys(this.vitals).length > 0);
};

clinicalAssessmentSchema.methods.hasLabs = function (
  this: IClinicalAssessment
): boolean {
  return !!(this.labs && Object.keys(this.labs).length > 0);
};

clinicalAssessmentSchema.methods.getBPCategory = function (
  this: IClinicalAssessment
): string {
  if (this.vitals?.bpSys && this.vitals?.bpDia) {
    const sys = this.vitals.bpSys;
    const dia = this.vitals.bpDia;

    if (sys < 120 && dia < 80) return 'Normal';
    if (sys < 130 && dia < 80) return 'Elevated';
    if ((sys >= 130 && sys < 140) || (dia >= 80 && dia < 90))
      return 'Stage 1 Hypertension';
    if (sys >= 140 || dia >= 90) return 'Stage 2 Hypertension';
    if (sys >= 180 || dia >= 120) return 'Hypertensive Crisis';
  }
  return 'Unknown';
};

clinicalAssessmentSchema.methods.getDiabeticStatus = function (
  this: IClinicalAssessment
): string {
  if (this.labs?.fbs) {
    const fbs = this.labs.fbs;
    if (fbs < 100) return 'Normal';
    if (fbs >= 100 && fbs < 126) return 'Prediabetes';
    if (fbs >= 126) return 'Diabetes';
  }

  if (this.labs?.hba1c) {
    const hba1c = this.labs.hba1c;
    if (hba1c < 5.7) return 'Normal';
    if (hba1c >= 5.7 && hba1c < 6.5) return 'Prediabetes';
    if (hba1c >= 6.5) return 'Diabetes';
  }

  return 'Unknown';
};

export default mongoose.model<IClinicalAssessment>(
  'ClinicalAssessment',
  clinicalAssessmentSchema
);
