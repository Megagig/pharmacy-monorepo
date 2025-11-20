import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IMTRMedicationEntry {
  drugName: string;
  genericName?: string;
  strength: {
    value: number;
    unit: string;
  };
  dosageForm: string;
  instructions: {
    dose: string;
    frequency: string;
    route: string;
    duration?: string;
  };
  category: 'prescribed' | 'otc' | 'herbal' | 'supplement';
  prescriber?: {
    name: string;
    license?: string;
    contact?: string;
  };
  startDate: Date;
  endDate?: Date;
  indication: string;
  adherenceScore?: number;
  notes?: string;
}

export interface ITherapyPlan {
  problems: mongoose.Types.ObjectId[]; // DrugTherapyProblem refs
  recommendations: {
    type:
    | 'discontinue'
    | 'adjust_dose'
    | 'switch_therapy'
    | 'add_therapy'
    | 'monitor';
    medication?: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
    expectedOutcome: string;
  }[];
  monitoringPlan: {
    parameter: string;
    frequency: string;
    targetValue?: string;
    notes?: string;
  }[];
  counselingPoints: string[];
  goals: {
    description: string;
    targetDate?: Date;
    achieved: boolean;
    achievedDate?: Date;
  }[];
  timeline: string;
  pharmacistNotes: string;
}

export interface IClinicalOutcomes {
  problemsResolved: number;
  medicationsOptimized: number;
  adherenceImproved: boolean;
  adverseEventsReduced: boolean;
  costSavings?: number;
  qualityOfLifeImproved?: boolean;
  clinicalParametersImproved?: boolean;
}

export interface IMedicationTherapyReview extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  pharmacistId: mongoose.Types.ObjectId;

  // Review metadata
  reviewNumber: string; // Auto-generated unique identifier
  status: 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  priority: 'routine' | 'urgent' | 'high_risk';
  reviewType: 'initial' | 'follow_up' | 'annual' | 'targeted';

  // Workflow steps tracking
  steps: {
    patientSelection: {
      completed: boolean;
      completedAt?: Date;
      data?: any;
    };
    medicationHistory: {
      completed: boolean;
      completedAt?: Date;
      data?: any;
    };
    therapyAssessment: {
      completed: boolean;
      completedAt?: Date;
      data?: any;
    };
    planDevelopment: {
      completed: boolean;
      completedAt?: Date;
      data?: any;
    };
    interventions: {
      completed: boolean;
      completedAt?: Date;
      data?: any;
    };
    followUp: {
      completed: boolean;
      completedAt?: Date;
      data?: any;
    };
  };

  // Clinical data
  medications: IMTRMedicationEntry[];
  problems: mongoose.Types.ObjectId[]; // DrugTherapyProblem refs
  plan?: ITherapyPlan;
  interventions: mongoose.Types.ObjectId[]; // MTRIntervention refs
  followUps: mongoose.Types.ObjectId[]; // MTRFollowUp refs

  // Outcomes tracking
  clinicalOutcomes: IClinicalOutcomes;

  // Scheduling and timing
  startedAt: Date;
  completedAt?: Date;
  nextReviewDate?: Date;
  estimatedDuration?: number; // in minutes

  // Additional metadata
  referralSource?: string;
  reviewReason?: string;
  patientConsent: boolean;
  confidentialityAgreed: boolean;

  // Audit fields (added by addAuditFields)
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtual properties
  durationDays: number;
  isOverdue: boolean;

  // Instance methods
  getCompletionPercentage(): number;
  getNextStep(): string | null;
  canComplete(): boolean;
  markStepComplete(stepName: string, data?: any): void;
  generateReviewNumber(): string;
}
const medicationTherapyReviewSchema = new Schema(
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
    pharmacistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Review metadata
    reviewNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'cancelled', 'on_hold'],
      default: 'in_progress',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'high_risk'],
      default: 'routine',
      required: true,
      index: true,
    },
    reviewType: {
      type: String,
      enum: ['initial', 'follow_up', 'annual', 'targeted'],
      default: 'initial',
      required: true,
      index: true,
    },

    // Workflow steps
    steps: {
      patientSelection: {
        completed: { type: Boolean, default: false },
        completedAt: Date,
        data: Schema.Types.Mixed,
      },
      medicationHistory: {
        completed: { type: Boolean, default: false },
        completedAt: Date,
        data: Schema.Types.Mixed,
      },
      therapyAssessment: {
        completed: { type: Boolean, default: false },
        completedAt: Date,
        data: Schema.Types.Mixed,
      },
      planDevelopment: {
        completed: { type: Boolean, default: false },
        completedAt: Date,
        data: Schema.Types.Mixed,
      },
      interventions: {
        completed: { type: Boolean, default: false },
        completedAt: Date,
        data: Schema.Types.Mixed,
      },
      followUp: {
        completed: { type: Boolean, default: false },
        completedAt: Date,
        data: Schema.Types.Mixed,
      },
    },

    // Clinical data
    medications: [
      {
        drugName: {
          type: String,
          required: true,
          trim: true,
          maxlength: [200, 'Drug name cannot exceed 200 characters'],
        },
        genericName: {
          type: String,
          trim: true,
          maxlength: [200, 'Generic name cannot exceed 200 characters'],
        },
        strength: {
          value: {
            type: Number,
            required: true,
            min: [0, 'Strength value cannot be negative'],
          },
          unit: {
            type: String,
            required: true,
            trim: true,
            maxlength: [20, 'Unit cannot exceed 20 characters'],
          },
        },
        dosageForm: {
          type: String,
          required: true,
          trim: true,
          maxlength: [50, 'Dosage form cannot exceed 50 characters'],
        },
        instructions: {
          dose: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, 'Dose cannot exceed 100 characters'],
          },
          frequency: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, 'Frequency cannot exceed 100 characters'],
          },
          route: {
            type: String,
            required: true,
            trim: true,
            maxlength: [50, 'Route cannot exceed 50 characters'],
          },
          duration: {
            type: String,
            trim: true,
            maxlength: [100, 'Duration cannot exceed 100 characters'],
          },
        },
        category: {
          type: String,
          enum: ['prescribed', 'otc', 'herbal', 'supplement'],
          required: true,
          index: true,
        },
        prescriber: {
          name: {
            type: String,
            trim: true,
            maxlength: [100, 'Prescriber name cannot exceed 100 characters'],
          },
          license: {
            type: String,
            trim: true,
            maxlength: [50, 'License cannot exceed 50 characters'],
          },
          contact: {
            type: String,
            trim: true,
            maxlength: [100, 'Contact cannot exceed 100 characters'],
          },
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: Date,
        indication: {
          type: String,
          required: true,
          trim: true,
          maxlength: [200, 'Indication cannot exceed 200 characters'],
        },
        adherenceScore: {
          type: Number,
          min: [0, 'Adherence score cannot be negative'],
          max: [100, 'Adherence score cannot exceed 100'],
        },
        notes: {
          type: String,
          trim: true,
          maxlength: [500, 'Notes cannot exceed 500 characters'],
        },
      },
    ],

    problems: [
      {
        type: Schema.Types.ObjectId,
        ref: 'DrugTherapyProblem',
        index: true,
      },
    ],

    plan: {
      problems: [
        {
          type: Schema.Types.ObjectId,
          ref: 'DrugTherapyProblem',
        },
      ],
      recommendations: [
        {
          type: {
            type: String,
            enum: [
              'discontinue',
              'adjust_dose',
              'switch_therapy',
              'add_therapy',
              'monitor',
            ],
            required: true,
          },
          medication: {
            type: String,
            trim: true,
            maxlength: [200, 'Medication name cannot exceed 200 characters'],
          },
          rationale: {
            type: String,
            required: true,
            trim: true,
            maxlength: [1000, 'Rationale cannot exceed 1000 characters'],
          },
          priority: {
            type: String,
            enum: ['high', 'medium', 'low'],
            required: true,
          },
          expectedOutcome: {
            type: String,
            required: true,
            trim: true,
            maxlength: [500, 'Expected outcome cannot exceed 500 characters'],
          },
        },
      ],
      monitoringPlan: [
        {
          parameter: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, 'Parameter cannot exceed 100 characters'],
          },
          frequency: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, 'Frequency cannot exceed 100 characters'],
          },
          targetValue: {
            type: String,
            trim: true,
            maxlength: [100, 'Target value cannot exceed 100 characters'],
          },
          notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Notes cannot exceed 500 characters'],
          },
        },
      ],
      counselingPoints: [
        {
          type: String,
          trim: true,
          maxlength: [500, 'Counseling point cannot exceed 500 characters'],
        },
      ],
      goals: [
        {
          description: {
            type: String,
            required: true,
            trim: true,
            maxlength: [300, 'Goal description cannot exceed 300 characters'],
          },
          targetDate: Date,
          achieved: {
            type: Boolean,
            default: false,
          },
          achievedDate: Date,
        },
      ],
      timeline: {
        type: String,
        trim: true,
        maxlength: [500, 'Timeline cannot exceed 500 characters'],
      },
      pharmacistNotes: {
        type: String,
        trim: true,
        maxlength: [2000, 'Pharmacist notes cannot exceed 2000 characters'],
      },
    },

    interventions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MTRIntervention',
        index: true,
      },
    ],

    followUps: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MTRFollowUp',
        index: true,
      },
    ],

    // Outcomes
    clinicalOutcomes: {
      problemsResolved: {
        type: Number,
        default: 0,
        min: [0, 'Problems resolved cannot be negative'],
      },
      medicationsOptimized: {
        type: Number,
        default: 0,
        min: [0, 'Medications optimized cannot be negative'],
      },
      adherenceImproved: {
        type: Boolean,
        default: false,
      },
      adverseEventsReduced: {
        type: Boolean,
        default: false,
      },
      costSavings: {
        type: Number,
        min: [0, 'Cost savings cannot be negative'],
      },
      qualityOfLifeImproved: {
        type: Boolean,
        default: false,
      },
      clinicalParametersImproved: {
        type: Boolean,
        default: false,
      },
    },

    // Scheduling
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: Date,
    nextReviewDate: Date,
    estimatedDuration: {
      type: Number,
      min: [0, 'Duration cannot be negative'],
    },

    // Additional metadata
    referralSource: {
      type: String,
      trim: true,
      maxlength: [100, 'Referral source cannot exceed 100 characters'],
    },
    reviewReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Review reason cannot exceed 500 characters'],
    },
    patientConsent: {
      type: Boolean,
      required: true,
      default: false,
    },
    confidentialityAgreed: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(medicationTherapyReviewSchema);

// Apply tenancy guard plugin
medicationTherapyReviewSchema.plugin(tenancyGuardPlugin, {
  pharmacyIdField: 'workplaceId',
});

// Indexes for efficient querying
medicationTherapyReviewSchema.index({
  workplaceId: 1,
  patientId: 1,
  status: 1,
});
medicationTherapyReviewSchema.index({ workplaceId: 1, pharmacistId: 1 });
medicationTherapyReviewSchema.index({ workplaceId: 1, reviewType: 1 });
medicationTherapyReviewSchema.index({ workplaceId: 1, priority: 1 });
medicationTherapyReviewSchema.index({ workplaceId: 1, isDeleted: 1 });
medicationTherapyReviewSchema.index({ status: 1, startedAt: -1 });
medicationTherapyReviewSchema.index({ nextReviewDate: 1 }, { sparse: true });
medicationTherapyReviewSchema.index({ completedAt: -1 }, { sparse: true });
medicationTherapyReviewSchema.index({ createdAt: -1 });

// Compound index for unique review numbers per workplace
medicationTherapyReviewSchema.index(
  { workplaceId: 1, reviewNumber: 1 },
  { unique: true }
);

// Virtual for completion percentage
medicationTherapyReviewSchema
  .virtual('completionPercentage')
  .get(function (this: IMedicationTherapyReview) {
    const steps = Object.values(this.steps);
    const completedSteps = steps.filter((step) => step.completed).length;
    return Math.round((completedSteps / steps.length) * 100);
  });

// Virtual for duration in days
medicationTherapyReviewSchema
  .virtual('durationDays')
  .get(function (this: IMedicationTherapyReview) {
    const endDate = this.completedAt || new Date();
    const diffTime = Math.abs(endDate.getTime() - this.startedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  });

// Virtual for overdue status
medicationTherapyReviewSchema
  .virtual('isOverdue')
  .get(function (this: IMedicationTherapyReview) {
    if (this.status === 'completed' || this.status === 'cancelled')
      return false;

    const daysSinceStart = Math.floor(
      (Date.now() - this.startedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Consider urgent/high_risk overdue after 1 day, routine after 7 days
    const overdueThreshold = this.priority === 'routine' ? 7 : 1;
    return daysSinceStart > overdueThreshold;
  });

// Instance methods
medicationTherapyReviewSchema.methods.getCompletionPercentage = function (
  this: IMedicationTherapyReview
): number {
  const steps = Object.values(this.steps);
  const completedSteps = steps.filter((step) => step.completed).length;
  return Math.round((completedSteps / steps.length) * 100);
};

medicationTherapyReviewSchema.methods.getNextStep = function (
  this: IMedicationTherapyReview
): string | null {
  const stepOrder = [
    'patientSelection',
    'medicationHistory',
    'therapyAssessment',
    'planDevelopment',
    'interventions',
    'followUp',
  ];

  for (const stepName of stepOrder) {
    if (!this.steps[stepName as keyof typeof this.steps].completed) {
      return stepName;
    }
  }
  return null;
};

medicationTherapyReviewSchema.methods.canComplete = function (
  this: IMedicationTherapyReview
): boolean {
  return Object.values(this.steps).every((step) => step.completed);
};

medicationTherapyReviewSchema.methods.markStepComplete = function (
  this: IMedicationTherapyReview,
  stepName: string,
  data?: any
): void {
  if (this.steps[stepName as keyof typeof this.steps]) {
    this.steps[stepName as keyof typeof this.steps].completed = true;
    this.steps[stepName as keyof typeof this.steps].completedAt = new Date();
    if (data) {
      this.steps[stepName as keyof typeof this.steps].data = data;
    }
  }
};

medicationTherapyReviewSchema.methods.generateReviewNumber = function (
  this: IMedicationTherapyReview
): string {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `MTR-${year}${month}-${randomSuffix}`;
};

// Pre-save middleware
medicationTherapyReviewSchema.pre(
  'save',
  function (this: IMedicationTherapyReview) {
    // Generate review number if not set
    if (this.isNew && !this.reviewNumber) {
      this.reviewNumber = this.generateReviewNumber();
    }

    // Auto-complete review if all steps are done AND status is explicitly being set to completed
    // Don't auto-complete just because steps are done - let the controller handle completion
    if (this.canComplete() && this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }

    // Validate patient consent
    // We can't directly access user context from a model hook
    // But we're tracking this info via createdByRole
    // which is populated during creation in mtrController
    if (!this.patientConsent && (this as any).createdByRole !== 'super_admin') {
      throw new Error('Patient consent is required to proceed with MTR');
    }

    // Validate confidentiality agreement
    if (
      !this.confidentialityAgreed &&
      (this as any).createdByRole !== 'super_admin'
    ) {
      throw new Error(
        'Confidentiality agreement is required to proceed with MTR'
      );
    }
  }
);

// Static method to generate next review number
medicationTherapyReviewSchema.statics.generateNextReviewNumber =
  async function (workplaceId: mongoose.Types.ObjectId, retryOffset: number = 0): Promise<string> {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const prefix = `MTR-${year}${month}`;

    // Use atomic operation with retry logic to prevent race conditions
    let attempts = 0;
    const maxAttempts = 10; // Increased attempts

    while (attempts < maxAttempts) {
      try {
        // Find ALL review numbers for this month/workplace to calculate next sequence
        const existingReviews = await this.find(
          {
            workplaceId,
            reviewNumber: { $regex: `^${prefix}` },
          },
          { reviewNumber: 1 },
          { bypassTenancyGuard: true }
        )
          .sort({ reviewNumber: -1 })
          .limit(100) // Get last 100 to ensure we have the highest
          .lean();

        // Extract all sequence numbers
        const sequences = existingReviews
          .map(review => {
            const match = review.reviewNumber?.match(/-(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(seq => seq > 0);

        // Find the highest sequence number and increment
        const maxSequence = sequences.length > 0 ? Math.max(...sequences) : 0;
        // Add both attempts and retryOffset to avoid collision across controller retries
        const nextSequence = maxSequence + 1 + attempts + retryOffset;

        const reviewNumber = `${prefix}-${nextSequence.toString().padStart(4, '0')}`;

        // Verify uniqueness before returning
        const exists = await this.findOne(
          {
            workplaceId,
            reviewNumber
          },
          null,
          { bypassTenancyGuard: true }
        ).lean();

        if (!exists) {
          return reviewNumber;
        }

        // If exists, increment attempts and try again
        attempts++;

        // Small random delay to reduce collision probability
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40));

      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          // Fallback: use timestamp to ensure uniqueness
          const timestamp = Date.now().toString().slice(-6);
          return `${prefix}-${timestamp}`;
        }

        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 80));
      }
    }

    // Final fallback: use timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  };

// Static method to find active reviews
medicationTherapyReviewSchema.statics.findActive = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = { status: { $in: ['in_progress', 'on_hold'] } };

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ priority: 1, startedAt: 1 }); // Urgent first, then by start date
};

// Static method to find overdue reviews
medicationTherapyReviewSchema.statics.findOverdue = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const routineThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const urgentThreshold = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

  const query = {
    status: { $in: ['in_progress', 'on_hold'] },
    $or: [
      { priority: 'routine', startedAt: { $lt: routineThreshold } },
      {
        priority: { $in: ['urgent', 'high_risk'] },
        startedAt: { $lt: urgentThreshold },
      },
    ],
  };

  const baseQuery = workplaceId
    ? this.find(query).setOptions({ workplaceId })
    : this.find(query);
  return baseQuery.sort({ priority: 1, startedAt: 1 });
};

export default mongoose.model<IMedicationTherapyReview>(
  'MedicationTherapyReview',
  medicationTherapyReviewSchema
);
