import mongoose, { Document, Schema } from 'mongoose';

// Define interfaces for our models
interface DrugSearchHistoryDocument extends Document {
  userId: mongoose.Types.ObjectId;
  searchTerm: string;
  searchResults: any;
  createdAt: Date;
}

interface DrugDocument {
  rxCui?: string;
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  notes?: string;
  monograph?: any;
  interactions?: any;
  adverseEffects?: any;
  formularyInfo?: any;
}

interface TherapyPlanDocument extends Document {
  userId: mongoose.Types.ObjectId;
  planName: string;
  drugs: DrugDocument[];
  guidelines?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define schemas
const drugSearchHistorySchema = new Schema<DrugSearchHistoryDocument>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  searchTerm: {
    type: String,
    required: true,
    trim: true
  },
  searchResults: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const drugSchema = new Schema<DrugDocument>({
  rxCui: String,
  name: {
    type: String,
    required: true
  },
  dosage: String,
  frequency: String,
  route: String,
  notes: String,
  monograph: mongoose.Schema.Types.Mixed,
  interactions: mongoose.Schema.Types.Mixed,
  adverseEffects: mongoose.Schema.Types.Mixed,
  formularyInfo: mongoose.Schema.Types.Mixed
});

const therapyPlanSchema = new Schema<TherapyPlanDocument>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planName: {
    type: String,
    required: true,
    trim: true
  },
  drugs: [drugSchema],
  guidelines: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create and export models
export const DrugSearchHistory = mongoose.model<DrugSearchHistoryDocument>('DrugSearchHistory', drugSearchHistorySchema);
export const TherapyPlan = mongoose.model<TherapyPlanDocument>('TherapyPlan', therapyPlanSchema);