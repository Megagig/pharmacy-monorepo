import mongoose, { Document, Schema } from 'mongoose';

export interface IMedication extends Document {
  patient: mongoose.Types.ObjectId;
  pharmacist: mongoose.Types.ObjectId;
  drugName: string;
  genericName?: string;
  strength: {
    value?: number;
    unit?: string;
  };
  dosageForm: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'topical' | 'inhaler' | 'other';
  instructions: {
    dosage?: string;
    frequency?: string;
    duration?: string;
    specialInstructions?: string;
  };
  prescriber: {
    name?: string;
    npi?: string;
    contact?: string;
  };
  prescription: {
    rxNumber?: string;
    dateIssued?: Date;
    dateExpires?: Date;
    refillsRemaining?: number;
  };
  therapy: {
    indication?: string;
    goalOfTherapy?: string;
    monitoring?: string[];
  };
  interactions: Array<{
    interactingDrug?: string;
    severity?: 'minor' | 'moderate' | 'major';
    description?: string;
  }>;
  sideEffects: string[];
  status: 'active' | 'discontinued' | 'completed';
  adherence: {
    lastReported?: Date;
    score?: number;
  };
  isManual?: boolean; // Flag to indicate if medication was manually entered (not from database)
  createdAt: Date;
  updatedAt: Date;
}

const medicationSchema = new Schema({
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  pharmacist: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  drugName: {
    type: String,
    required: [true, 'Drug name is required'],
    trim: true
  },
  genericName: String,
  strength: {
    value: Number,
    unit: String // mg, ml, etc.
  },
  dosageForm: {
    type: String,
    enum: ['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'other'],
    required: true
  },
  instructions: {
    dosage: String,
    frequency: String,
    duration: String,
    specialInstructions: String
  },
  prescriber: {
    name: String,
    npi: String,
    contact: String
  },
  prescription: {
    rxNumber: String,
    dateIssued: Date,
    dateExpires: Date,
    refillsRemaining: { type: Number, default: 0 }
  },
  therapy: {
    indication: String,
    goalOfTherapy: String,
    monitoring: [String]
  },
  interactions: [{
    interactingDrug: String,
    severity: { type: String, enum: ['minor', 'moderate', 'major'] },
    description: String
  }],
  sideEffects: [String],
  status: {
    type: String,
    enum: ['active', 'discontinued', 'completed'],
    default: 'active'
  },
  adherence: {
    lastReported: Date,
    score: Number // 0-100
  },
  isManual: {
    type: Boolean,
    default: false // Default to false (database entry)
  }
}, { timestamps: true });

export default mongoose.model<IMedication>('Medication', medicationSchema);