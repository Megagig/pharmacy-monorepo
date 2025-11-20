import mongoose, { Document, Schema } from 'mongoose';

export interface ITherapyPlan extends Document {
  user: mongoose.Types.ObjectId;
  patient: mongoose.Types.ObjectId;
  workplace?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'completed' | 'discontinued';
  drugs: Array<{
    rxcui?: string;
    drugName: string;
    genericName?: string;
    strength?: string;
    dosageForm?: string;
    indication: string;
    dosing: {
      dose?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
    };
    monitoring?: {
      parameters?: string[];
      frequency?: string;
      notes?: string;
    };
    alternatives?: Array<{
      rxcui?: string;
      drugName: string;
      reason: string;
      therapeuticEquivalence?: boolean;
    }>;
    interactions?: Array<{
      interactingDrug: string;
      severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
      description: string;
      management?: string;
    }>;
    adverseEffects?: Array<{
      effect: string;
      frequency?: string;
      severity?: 'mild' | 'moderate' | 'severe';
      management?: string;
    }>;
    contraindications?: string[];
    precautions?: string[];
    patientCounseling?: string[];
    addedAt: Date;
    addedBy: mongoose.Types.ObjectId;
  }>;
  guidelines?: Array<{
    title: string;
    content: string;
    source: string;
    url?: string;
    dateAccessed?: Date;
  }>;
  clinicalNotes?: string;
  reviewDates?: Array<{
    date: Date;
    reviewedBy: mongoose.Types.ObjectId;
    notes?: string;
    changes?: string[];
  }>;
  isTemplate: boolean;
  sharedWith?: Array<{
    user: mongoose.Types.ObjectId;
    permission: 'view' | 'edit';
    sharedAt: Date;
  }>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const therapyPlanSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  workplace: {
    type: Schema.Types.ObjectId,
    ref: 'Workplace',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Therapy plan name is required'],
    trim: true
  },
  description: String,
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'discontinued'],
    default: 'draft',
    index: true
  },
  drugs: [{
    rxcui: String,
    drugName: {
      type: String,
      required: true,
      trim: true
    },
    genericName: String,
    strength: String,
    dosageForm: String,
    indication: {
      type: String,
      required: true
    },
    dosing: {
      dose: String,
      frequency: String,
      duration: String,
      instructions: String
    },
    monitoring: {
      parameters: [String],
      frequency: String,
      notes: String
    },
    alternatives: [{
      rxcui: String,
      drugName: {
        type: String,
        required: true
      },
      reason: {
        type: String,
        required: true
      },
      therapeuticEquivalence: Boolean
    }],
    interactions: [{
      interactingDrug: {
        type: String,
        required: true
      },
      severity: {
        type: String,
        enum: ['minor', 'moderate', 'major', 'contraindicated'],
        required: true
      },
      description: {
        type: String,
        required: true
      },
      management: String
    }],
    adverseEffects: [{
      effect: {
        type: String,
        required: true
      },
      frequency: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      management: String
    }],
    contraindications: [String],
    precautions: [String],
    patientCounseling: [String],
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  guidelines: [{
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    source: {
      type: String,
      required: true
    },
    url: String,
    dateAccessed: Date
  }],
  clinicalNotes: String,
  reviewDates: [{
    date: {
      type: Date,
      required: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: String,
    changes: [String]
  }],
  isTemplate: {
    type: Boolean,
    default: false,
    index: true
  },
  sharedWith: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permission: {
      type: String,
      enum: ['view', 'edit'],
      required: true
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String]
}, { timestamps: true });

// Compound indexes for efficient queries
therapyPlanSchema.index({ user: 1, status: 1, createdAt: -1 });
therapyPlanSchema.index({ patient: 1, status: 1 });
therapyPlanSchema.index({ workplace: 1, isTemplate: 1 });
therapyPlanSchema.index({ 'drugs.drugName': 'text', name: 'text', description: 'text' });
therapyPlanSchema.index({ tags: 1 });

export default mongoose.model<ITherapyPlan>('TherapyPlan', therapyPlanSchema);