import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IMedicationHistory {
  name?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: Date;
  endDate?: Date;
  indication?: string;
  prescriber?: string;
  cost?: number; // Cost price in Naira
  sellingPrice?: number; // Selling price in Naira
  status?: 'active' | 'archived' | 'cancelled';
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
  notes?: string;
}

export interface IMedicationManagement extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate?: Date;
  endDate?: Date;
  indication?: string;
  prescriber?: string;
  allergyCheck: {
    status: boolean;
    details?: string;
  };
  interactionCheck?: {
    status: boolean;
    details?: string;
    severity?: 'minor' | 'moderate' | 'severe';
  };
  cost?: number; // Cost price in Naira
  sellingPrice?: number; // Selling price in Naira
  status: 'active' | 'archived' | 'cancelled';
  history: IMedicationHistory[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
}

const medicationHistorySchema = new Schema<IMedicationHistory>({
  name: { type: String },
  dosage: { type: String },
  frequency: { type: String },
  route: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  indication: { type: String },
  prescriber: { type: String },
  cost: { type: Number }, // Cost price in Naira
  sellingPrice: { type: Number }, // Selling price in Naira
  status: {
    type: String,
    enum: ['active', 'archived', 'cancelled'],
  },
  updatedAt: { type: Date, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
});

const medicationManagementSchema = new Schema<IMedicationManagement>(
  {
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    frequency: {
      type: String,
      required: true,
      trim: true,
    },
    route: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    indication: {
      type: String,
      trim: true,
    },
    prescriber: {
      type: String,
      trim: true,
    },
    cost: {
      type: Number,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    allergyCheck: {
      status: {
        type: Boolean,
        default: false,
      },
      details: {
        type: String,
        trim: true,
      },
    },
    interactionCheck: {
      status: {
        type: Boolean,
        default: false,
      },
      details: {
        type: String,
        trim: true,
      },
      severity: {
        type: String,
        enum: ['minor', 'moderate', 'severe'],
      },
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'cancelled'],
      default: 'active',
    },
    history: [medicationHistorySchema],
  },
  {
    timestamps: true,
  }
);

// Add auditing fields
addAuditFields(medicationManagementSchema);

// Apply tenancy guard plugin
medicationManagementSchema.plugin(tenancyGuardPlugin);

// Create compound index for patient and status
medicationManagementSchema.index({ patientId: 1, status: 1 });

export default mongoose.model<IMedicationManagement>(
  'MedicationManagement',
  medicationManagementSchema
);
