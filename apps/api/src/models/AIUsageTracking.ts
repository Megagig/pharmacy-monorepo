import mongoose, { Document, Schema } from 'mongoose';

export interface IAIUsageRecord extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  feature: 'ai_diagnostics' | 'lab_interpretation' | 'medication_recommendations' | 'therapy_recommendations' | 'clinical_decision_support';
  aiModel: string; // Changed from 'model' to 'aiModel' to avoid conflict with Mongoose Document
  requestType: 'analysis' | 'interpretation' | 'recommendation' | 'interaction_check';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestDuration: number; // in milliseconds
  success: boolean;
  errorMessage?: string;
  metadata?: {
    patientId?: string;
    caseId?: string;
    complexity?: 'low' | 'medium' | 'high' | 'critical';
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const aiUsageRecordSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    feature: {
      type: String,
      enum: ['ai_diagnostics', 'lab_interpretation', 'medication_recommendations', 'therapy_recommendations', 'clinical_decision_support'],
      required: true,
      index: true,
    },
    aiModel: {
      type: String,
      required: true,
    },
    requestType: {
      type: String,
      enum: ['analysis', 'interpretation', 'recommendation', 'interaction_check'],
      required: true,
    },
    inputTokens: {
      type: Number,
      required: true,
      min: 0,
    },
    outputTokens: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTokens: {
      type: Number,
      required: true,
      min: 0,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    requestDuration: {
      type: Number,
      required: true,
      min: 0,
    },
    success: {
      type: Boolean,
      required: true,
      default: true,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
aiUsageRecordSchema.index({ workspaceId: 1, createdAt: -1 });
aiUsageRecordSchema.index({ feature: 1, createdAt: -1 });
aiUsageRecordSchema.index({ createdAt: -1 });
aiUsageRecordSchema.index({ workspaceId: 1, feature: 1, createdAt: -1 });

export default mongoose.model<IAIUsageRecord>('AIUsageRecord', aiUsageRecordSchema);