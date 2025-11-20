import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface ICarePlan extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  visitId?: mongoose.Types.ObjectId;
  goals: string[]; // (1)(2)(3)
  objectives: string[]; // (1..5)
  followUpDate?: Date;
  planQuality: 'adequate' | 'needsReview';
  dtpSummary?: 'resolved' | 'unresolved';
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const carePlanSchema = new Schema(
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
    goals: {
      type: [String],
      required: [true, 'At least one goal is required'],
      validate: [
        {
          validator: function (goals: string[]) {
            return goals && goals.length > 0 && goals.length <= 10;
          },
          message: 'Must have 1-10 goals',
        },
        {
          validator: function (goals: string[]) {
            return goals.every(
              (goal) => goal.trim().length >= 5 && goal.trim().length <= 200
            );
          },
          message: 'Each goal must be 5-200 characters long',
        },
      ],
    },
    objectives: {
      type: [String],
      required: [true, 'At least one objective is required'],
      validate: [
        {
          validator: function (objectives: string[]) {
            return (
              objectives && objectives.length > 0 && objectives.length <= 15
            );
          },
          message: 'Must have 1-15 objectives',
        },
        {
          validator: function (objectives: string[]) {
            return objectives.every(
              (obj) => obj.trim().length >= 5 && obj.trim().length <= 300
            );
          },
          message: 'Each objective must be 5-300 characters long',
        },
      ],
    },
    followUpDate: {
      type: Date,
      validate: {
        validator: function (value: Date) {
          if (value) {
            // Follow-up date should be in the future (within reasonable limits)
            const today = new Date();
            const maxDate = new Date();
            maxDate.setMonth(maxDate.getMonth() + 12); // Max 12 months in future

            return value > today && value <= maxDate;
          }
          return true;
        },
        message: 'Follow-up date must be in the future but within 12 months',
      },
      index: true,
    },
    planQuality: {
      type: String,
      enum: ['adequate', 'needsReview'],
      required: true,
      default: 'adequate',
      index: true,
    },
    dtpSummary: {
      type: String,
      enum: ['resolved', 'unresolved'],
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(carePlanSchema);

// Apply tenancy guard plugin
carePlanSchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Indexes for efficient querying
carePlanSchema.index({ workplaceId: 1, patientId: 1, createdAt: -1 });
carePlanSchema.index({ workplaceId: 1, visitId: 1 });
carePlanSchema.index({ workplaceId: 1, planQuality: 1 });
carePlanSchema.index({ workplaceId: 1, dtpSummary: 1 });
carePlanSchema.index({ workplaceId: 1, isDeleted: 1 });
carePlanSchema.index({ followUpDate: 1 }, { sparse: true });
carePlanSchema.index({ createdAt: -1 });

// Virtual to populate patient details
carePlanSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual to populate visit details
carePlanSchema.virtual('visit', {
  ref: 'Visit',
  localField: 'visitId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for follow-up status
carePlanSchema.virtual('followUpStatus').get(function (this: ICarePlan) {
  if (!this.followUpDate) {
    return 'no_followup';
  }

  const now = new Date();
  const followUpDate = this.followUpDate;

  if (followUpDate < now) {
    return 'overdue';
  } else if (
    followUpDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  ) {
    return 'due_soon'; // Due within 7 days
  } else {
    return 'scheduled';
  }
});

// Virtual for days until follow-up
carePlanSchema.virtual('daysUntilFollowUp').get(function (this: ICarePlan) {
  if (!this.followUpDate) {
    return null;
  }

  const now = new Date();
  const diffTime = this.followUpDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
});

// Virtual for plan completeness score
carePlanSchema.virtual('completenessScore').get(function (this: ICarePlan) {
  let score = 0;
  let maxScore = 100;

  // Goals (30 points)
  if (this.goals && this.goals.length > 0) {
    score += 20;
    if (this.goals.length >= 3) score += 10; // Bonus for multiple goals
  }

  // Objectives (30 points)
  if (this.objectives && this.objectives.length > 0) {
    score += 20;
    if (this.objectives.length >= 5) score += 10; // Bonus for detailed objectives
  }

  // Follow-up date (20 points)
  if (this.followUpDate) {
    score += 20;
  }

  // DTP summary (10 points)
  if (this.dtpSummary) {
    score += 10;
  }

  // Notes (10 points)
  if (this.notes && this.notes.trim().length > 20) {
    score += 10;
  }

  return Math.round((score / maxScore) * 100);
});

// Pre-save validation and normalization
carePlanSchema.pre('save', function (this: ICarePlan) {
  // Trim and filter empty goals
  if (this.goals) {
    this.goals = this.goals
      .map((goal) => goal.trim())
      .filter((goal) => goal.length > 0);
  }

  // Trim and filter empty objectives
  if (this.objectives) {
    this.objectives = this.objectives
      .map((obj) => obj.trim())
      .filter((obj) => obj.length > 0);
  }

  // Auto-set plan quality based on completeness
  const completeness = this.get('completenessScore');
  if (completeness < 70) {
    this.planQuality = 'needsReview';
  }

  // Validate that we have minimum requirements
  if (!this.goals || this.goals.length === 0) {
    throw new Error('At least one goal is required');
  }

  if (!this.objectives || this.objectives.length === 0) {
    throw new Error('At least one objective is required');
  }
});

// Static method to find care plans for a patient
carePlanSchema.statics.findByPatient = function (
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

  baseQuery = baseQuery.sort({ createdAt: -1 });

  if (limit) {
    baseQuery = baseQuery.limit(limit);
  }

  return baseQuery;
};

// Static method to find latest care plan for a patient
carePlanSchema.statics.findLatestByPatient = function (
  patientId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { patientId };

  if (workplaceId) {
    return this.findOne(query)
      .setOptions({ workplaceId })
      .sort({ createdAt: -1 });
  }
  return this.findOne(query).sort({ createdAt: -1 });
};

// Static method to find care plans by visit
carePlanSchema.statics.findByVisit = function (
  visitId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { visitId };

  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId });
  }
  return this.find(query);
};

// Static method to find care plans needing review
carePlanSchema.statics.findNeedingReview = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { planQuality: 'needsReview' };

  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId }).sort({ createdAt: -1 });
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find due follow-ups
carePlanSchema.statics.findDueFollowUps = function (
  daysAhead: number = 7,
  workplaceId?: mongoose.Types.ObjectId
) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const query = {
    followUpDate: {
      $gte: today,
      $lte: futureDate,
    },
  };

  if (workplaceId) {
    return this.find(query)
      .setOptions({ workplaceId })
      .sort({ followUpDate: 1 });
  }
  return this.find(query).sort({ followUpDate: 1 });
};

// Static method to find overdue follow-ups
carePlanSchema.statics.findOverdueFollowUps = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const today = new Date();

  const query = {
    followUpDate: { $lt: today },
  };

  if (workplaceId) {
    return this.find(query)
      .setOptions({ workplaceId })
      .sort({ followUpDate: 1 });
  }
  return this.find(query).sort({ followUpDate: 1 });
};

// Instance methods
carePlanSchema.methods.addGoal = function (
  this: ICarePlan,
  goal: string
): void {
  if (!this.goals) {
    this.goals = [];
  }

  const trimmedGoal = goal.trim();
  if (trimmedGoal.length >= 5 && trimmedGoal.length <= 200) {
    this.goals.push(trimmedGoal);
  } else {
    throw new Error('Goal must be 5-200 characters long');
  }
};

carePlanSchema.methods.addObjective = function (
  this: ICarePlan,
  objective: string
): void {
  if (!this.objectives) {
    this.objectives = [];
  }

  const trimmedObjective = objective.trim();
  if (trimmedObjective.length >= 5 && trimmedObjective.length <= 300) {
    this.objectives.push(trimmedObjective);
  } else {
    throw new Error('Objective must be 5-300 characters long');
  }
};

carePlanSchema.methods.removeGoal = function (
  this: ICarePlan,
  index: number
): void {
  if (this.goals && index >= 0 && index < this.goals.length) {
    this.goals.splice(index, 1);
  }
};

carePlanSchema.methods.removeObjective = function (
  this: ICarePlan,
  index: number
): void {
  if (this.objectives && index >= 0 && index < this.objectives.length) {
    this.objectives.splice(index, 1);
  }
};

carePlanSchema.methods.setFollowUp = function (
  this: ICarePlan,
  date: Date
): void {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 12);

  if (date > today && date <= maxDate) {
    this.followUpDate = date;
  } else {
    throw new Error(
      'Follow-up date must be in the future but within 12 months'
    );
  }
};

carePlanSchema.methods.markAsNeedingReview = function (
  this: ICarePlan,
  reason?: string
): void {
  this.planQuality = 'needsReview';
  if (reason) {
    this.notes = this.notes
      ? `${this.notes}\n\nReview needed: ${reason}`
      : `Review needed: ${reason}`;
  }
};

carePlanSchema.methods.markAsAdequate = function (this: ICarePlan): void {
  this.planQuality = 'adequate';
};

carePlanSchema.methods.isOverdue = function (this: ICarePlan): boolean {
  if (!this.followUpDate) {
    return false;
  }

  return this.followUpDate < new Date();
};

carePlanSchema.methods.isDueSoon = function (
  this: ICarePlan,
  days: number = 7
): boolean {
  if (!this.followUpDate) {
    return false;
  }

  const now = new Date();
  const dueDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return this.followUpDate <= dueDate && this.followUpDate >= now;
};

export default mongoose.model<ICarePlan>('CarePlan', carePlanSchema);
