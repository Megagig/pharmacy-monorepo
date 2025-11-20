import mongoose, { Document, Schema } from 'mongoose';
import {
  tenancyGuardPlugin,
  addAuditFields,
  DTP_TYPES,
  DTP_CATEGORIES,
  DTP_SEVERITIES,
  EVIDENCE_LEVELS,
} from '../utils/tenancyGuard';

export interface IDrugTherapyProblem extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  visitId?: mongoose.Types.ObjectId;
  reviewId?: mongoose.Types.ObjectId; // MTR review reference

  // Problem classification
  category: 'indication' | 'effectiveness' | 'safety' | 'adherence';
  subcategory: string;
  type:
  | 'unnecessary'
  | 'wrongDrug'
  | 'doseTooLow'
  | 'doseTooHigh'
  | 'adverseReaction'
  | 'inappropriateAdherence'
  | 'needsAdditional'
  | 'interaction'
  | 'duplication'
  | 'contraindication'
  | 'monitoring';
  severity: 'critical' | 'major' | 'moderate' | 'minor';

  // Clinical details
  description: string;
  clinicalSignificance: string;
  affectedMedications: string[];
  relatedConditions: string[];

  // Assessment
  evidenceLevel: 'definite' | 'probable' | 'possible' | 'unlikely';
  riskFactors: string[];

  // Resolution tracking
  status: 'identified' | 'addressed' | 'monitoring' | 'resolved' | 'not_applicable';
  resolution?: {
    action: string;
    outcome: string;
    resolvedAt?: Date;
    resolvedBy?: mongoose.Types.ObjectId;
  };

  // Audit fields
  identifiedBy: mongoose.Types.ObjectId;
  identifiedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtual properties
  priority: string;
  typeDisplay: string;
  resolutionDurationDays: number | null;

  // Methods
  resolve(action: string, outcome: string, resolvedBy?: mongoose.Types.ObjectId): void;
  reopen(reopenedBy: mongoose.Types.ObjectId): void;
  isHighSeverity(): boolean;
  isCritical(): boolean;
  isOverdue(): boolean;
}

const drugTherapyProblemSchema = new Schema(
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
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicationTherapyReview',
      index: true,
    },

    // Problem classification
    category: {
      type: String,
      enum: DTP_CATEGORIES,
      required: [true, 'DTP category is required'],
      index: true,
    },
    subcategory: {
      type: String,
      trim: true,
      maxlength: [100, 'Subcategory cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: DTP_TYPES,
      required: [true, 'DTP type is required'],
      index: true,
    },
    severity: {
      type: String,
      enum: DTP_SEVERITIES,
      required: [true, 'DTP severity is required'],
      index: true,
    },

    // Clinical details
    description: {
      type: String,
      required: [true, 'DTP description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    clinicalSignificance: {
      type: String,
      required: [true, 'Clinical significance is required'],
      trim: true,
      maxlength: [1000, 'Clinical significance cannot exceed 1000 characters'],
    },
    affectedMedications: [
      {
        type: String,
        trim: true,
        maxlength: [200, 'Medication name cannot exceed 200 characters'],
      },
    ],
    relatedConditions: [
      {
        type: String,
        trim: true,
        maxlength: [200, 'Condition cannot exceed 200 characters'],
      },
    ],

    // Assessment
    evidenceLevel: {
      type: String,
      enum: EVIDENCE_LEVELS,
      required: [true, 'Evidence level is required'],
      index: true,
    },
    riskFactors: [
      {
        type: String,
        trim: true,
        maxlength: [200, 'Risk factor cannot exceed 200 characters'],
      },
    ],

    // Resolution tracking
    status: {
      type: String,
      enum: ['identified', 'addressed', 'monitoring', 'resolved', 'not_applicable'],
      default: 'identified',
      required: true,
      index: true,
    },
    resolution: {
      action: {
        type: String,
        trim: true,
        maxlength: [1000, 'Resolution action cannot exceed 1000 characters'],
      },
      outcome: {
        type: String,
        trim: true,
        maxlength: [1000, 'Resolution outcome cannot exceed 1000 characters'],
      },
      resolvedAt: Date,
      resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    },

    // Audit fields
    identifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    identifiedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(drugTherapyProblemSchema);

// Apply tenancy guard plugin
drugTherapyProblemSchema.plugin(tenancyGuardPlugin, {
  pharmacyIdField: 'workplaceId',
});

// Indexes for efficient querying
drugTherapyProblemSchema.index({ workplaceId: 1, patientId: 1, status: 1 });
drugTherapyProblemSchema.index({ workplaceId: 1, reviewId: 1 });
drugTherapyProblemSchema.index({ workplaceId: 1, type: 1, severity: 1 });
drugTherapyProblemSchema.index({ workplaceId: 1, category: 1 });
drugTherapyProblemSchema.index({ workplaceId: 1, visitId: 1 });
drugTherapyProblemSchema.index({ workplaceId: 1, isDeleted: 1 });
drugTherapyProblemSchema.index({ status: 1, identifiedAt: -1 });
drugTherapyProblemSchema.index({ severity: 1, status: 1 });
drugTherapyProblemSchema.index({ evidenceLevel: 1 });
drugTherapyProblemSchema.index({ 'resolution.resolvedAt': -1 }, { sparse: true });
drugTherapyProblemSchema.index({ identifiedBy: 1, identifiedAt: -1 });
drugTherapyProblemSchema.index({ createdAt: -1 });

// Virtual to populate patient details
drugTherapyProblemSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual to populate visit details
drugTherapyProblemSchema.virtual('visit', {
  ref: 'Visit',
  localField: 'visitId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for resolution duration
drugTherapyProblemSchema
  .virtual('resolutionDurationDays')
  .get(function (this: IDrugTherapyProblem) {
    if (this.resolution?.resolvedAt && this.identifiedAt) {
      const diffTime = Math.abs(
        this.resolution.resolvedAt.getTime() - this.identifiedAt.getTime()
      );
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return null;
  });

// Virtual for priority based on severity and evidence level
drugTherapyProblemSchema
  .virtual('priority')
  .get(function (this: IDrugTherapyProblem) {
    if (this.severity === 'critical') return 'high';
    if (this.severity === 'major' && ['definite', 'probable'].includes(this.evidenceLevel)) return 'high';
    if (this.severity === 'major') return 'medium';
    if (this.severity === 'moderate' && this.evidenceLevel === 'definite') return 'medium';
    return 'low';
  });

// Virtual for human-readable type
drugTherapyProblemSchema
  .virtual('typeDisplay')
  .get(function (this: IDrugTherapyProblem) {
    const typeMap: { [key: string]: string } = {
      unnecessary: 'Unnecessary Medication',
      wrongDrug: 'Wrong Drug/Indication',
      doseTooLow: 'Dose Too Low',
      doseTooHigh: 'Dose Too High',
      adverseReaction: 'Adverse Reaction',
      inappropriateAdherence: 'Inappropriate Adherence',
      needsAdditional: 'Needs Additional Medication',
      interaction: 'Drug Interaction',
      duplication: 'Duplicate Therapy',
      contraindication: 'Contraindication',
      monitoring: 'Monitoring Required',
    };

    return typeMap[this.type] || this.type;
  });

// Pre-save validation and business logic
drugTherapyProblemSchema.pre('save', function (this: IDrugTherapyProblem) {
  // Auto-set resolution details when status changes to resolved
  if (
    this.isModified('status') &&
    this.status === 'resolved' &&
    (!this.resolution || !this.resolution.resolvedAt)
  ) {
    if (!this.resolution) {
      this.resolution = {
        action: 'Status updated to resolved',
        outcome: 'Problem resolved',
        resolvedAt: new Date(),
      };
    } else {
      this.resolution.resolvedAt = new Date();
    }
  }

  // Clear resolution details when status changes from resolved
  if (this.isModified('status') && this.status !== 'resolved') {
    if (this.resolution) {
      this.resolution.resolvedAt = undefined;
    }
  }

  // Ensure critical/major severity DTPs have detailed descriptions
  if (
    ['critical', 'major'].includes(this.severity) &&
    this.description.trim().length < 20
  ) {
    throw new Error(
      `${this.severity} severity DTPs require detailed description (minimum 20 characters)`
    );
  }

  // Ensure clinical significance is provided for high evidence levels
  if (
    ['definite', 'probable'].includes(this.evidenceLevel) &&
    (!this.clinicalSignificance || this.clinicalSignificance.trim().length < 10)
  ) {
    throw new Error(
      `DTPs with ${this.evidenceLevel} evidence level require clinical significance explanation`
    );
  }
});

// Post-save hook to update patient's hasActiveDTP flag
drugTherapyProblemSchema.post(
  'save',
  async function (this: IDrugTherapyProblem) {
    try {
      const Patient = mongoose.model('Patient');

      // Count active DTPs for this patient (identified, addressed, monitoring)
      const activeDTPCount = await mongoose
        .model('DrugTherapyProblem')
        .countDocuments({
          patientId: this.patientId,
          workplaceId: this.workplaceId,
          status: { $in: ['identified', 'addressed', 'monitoring'] },
          isDeleted: { $ne: true },
        });

      // Update patient's hasActiveDTP flag
      await Patient.findByIdAndUpdate(
        this.patientId,
        { hasActiveDTP: activeDTPCount > 0 },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating patient hasActiveDTP flag:', error);
    }
  }
);

// Static method to find DTPs for a patient
drugTherapyProblemSchema.statics.findByPatient = function (
  patientId: mongoose.Types.ObjectId,
  status?: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query: any = { patientId };
  if (status) {
    query.status = status;
  }

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ status: 1, createdAt: -1 }); // Show unresolved first
};

// Static method to find DTPs by type
drugTherapyProblemSchema.statics.findByType = function (
  type: string,
  status?: string,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query: any = { type };
  if (status) {
    query.status = status;
  }

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ createdAt: -1 });
};

// Static method to find active DTPs (not resolved)
drugTherapyProblemSchema.statics.findActive = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { status: { $in: ['identified', 'addressed', 'monitoring'] } };

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ severity: 1, identifiedAt: -1 }); // Critical first, then by date
};

// Static method to find DTPs by MTR review
drugTherapyProblemSchema.statics.findByReview = function (
  reviewId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { reviewId };

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ severity: 1, identifiedAt: -1 });
};

// Static method to get DTP statistics
drugTherapyProblemSchema.statics.getStatistics = async function (
  workplaceId?: mongoose.Types.ObjectId,
  dateRange?: { start: Date; end: Date }
) {
  const matchStage: any = {};

  if (workplaceId) {
    matchStage.workplaceId = workplaceId;
  }

  if (dateRange) {
    matchStage.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDTPs: { $sum: 1 },
        unresolvedDTPs: {
          $sum: { $cond: [{ $eq: ['$status', 'unresolved'] }, 1, 0] },
        },
        resolvedDTPs: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
        },
        dtpsByType: {
          $push: {
            type: '$type',
            status: '$status',
          },
        },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'resolved'] },
              {
                $divide: [
                  { $subtract: ['$resolvedAt', '$createdAt'] },
                  1000 * 60 * 60 * 24, // Convert to days
                ],
              },
              null,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalDTPs: 1,
        unresolvedDTPs: 1,
        resolvedDTPs: 1,
        resolutionRate: {
          $cond: [
            { $gt: ['$totalDTPs', 0] },
            { $multiply: [{ $divide: ['$resolvedDTPs', '$totalDTPs'] }, 100] },
            0,
          ],
        },
        avgResolutionTimeDays: { $round: ['$avgResolutionTime', 1] },
        dtpsByType: 1,
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  return (
    result[0] || {
      totalDTPs: 0,
      unresolvedDTPs: 0,
      resolvedDTPs: 0,
      resolutionRate: 0,
      avgResolutionTimeDays: 0,
      dtpsByType: [],
    }
  );
};

// Instance methods
drugTherapyProblemSchema.methods.resolve = function (
  this: IDrugTherapyProblem,
  action: string,
  outcome: string,
  resolvedBy?: mongoose.Types.ObjectId
): void {
  this.status = 'resolved';
  this.resolution = {
    action,
    outcome,
    resolvedAt: new Date(),
    resolvedBy,
  };
  if (resolvedBy) {
    this.updatedBy = resolvedBy;
  }
};

drugTherapyProblemSchema.methods.reopen = function (
  this: IDrugTherapyProblem,
  reopenedBy?: mongoose.Types.ObjectId
): void {
  this.status = 'identified';
  if (this.resolution) {
    this.resolution.resolvedAt = undefined;
  }
  if (reopenedBy) {
    this.updatedBy = reopenedBy;
  }
};

drugTherapyProblemSchema.methods.isHighSeverity = function (
  this: IDrugTherapyProblem
): boolean {
  return ['critical', 'major'].includes(this.severity);
};

drugTherapyProblemSchema.methods.isCritical = function (
  this: IDrugTherapyProblem
): boolean {
  return this.severity === 'critical';
};

drugTherapyProblemSchema.methods.isOverdue = function (
  this: IDrugTherapyProblem
): boolean {
  if (this.status === 'resolved') return false;

  const daysSinceIdentification = Math.floor(
    (Date.now() - this.identifiedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Consider critical DTPs overdue after 1 day, major after 3 days, others after 7 days
  const overdueThresholds = {
    critical: 1,
    major: 3,
    moderate: 7,
    minor: 14,
  };

  const threshold = overdueThresholds[this.severity] || 7;
  return daysSinceIdentification > threshold;
};

export default mongoose.model<IDrugTherapyProblem>(
  'DrugTherapyProblem',
  drugTherapyProblemSchema
);
