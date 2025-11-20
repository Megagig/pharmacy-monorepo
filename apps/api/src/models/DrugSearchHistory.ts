import mongoose, { Document, Schema } from 'mongoose';

export interface IDrugSearchHistory extends Document {
  user: mongoose.Types.ObjectId;
  workplace?: mongoose.Types.ObjectId;
  searchTerm: string;
  searchType: 'drug_search' | 'interaction_check' | 'monograph_view' | 'adverse_effects' | 'formulary_search';
  resultsFound: number;
  selectedResult?: {
    rxcui?: string;
    drugName: string;
    source: string;
  };
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  searchMetadata?: {
    filters?: any;
    sortBy?: string;
    page?: number;
    limit?: number;
  };
  responseTime?: number; // in milliseconds
  createdAt: Date;
  updatedAt: Date;
}

const drugSearchHistorySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workplace: {
    type: Schema.Types.ObjectId,
    ref: 'Workplace',
    index: true
  },
  searchTerm: {
    type: String,
    required: [true, 'Search term is required'],
    trim: true,
    index: true
  },
  searchType: {
    type: String,
    enum: ['drug_search', 'interaction_check', 'monograph_view', 'adverse_effects', 'formulary_search'],
    required: true,
    index: true
  },
  resultsFound: {
    type: Number,
    required: true,
    min: 0
  },
  selectedResult: {
    rxcui: String,
    drugName: {
      type: String,
      required: true
    },
    source: {
      type: String,
      required: true
    }
  },
  sessionId: String,
  ipAddress: String,
  userAgent: String,
  searchMetadata: {
    filters: Schema.Types.Mixed,
    sortBy: String,
    page: Number,
    limit: Number
  },
  responseTime: Number
}, { timestamps: true });

// Compound indexes for analytics and user experience
drugSearchHistorySchema.index({ user: 1, searchType: 1, createdAt: -1 });
drugSearchHistorySchema.index({ workplace: 1, searchType: 1, createdAt: -1 });
drugSearchHistorySchema.index({ searchTerm: 1, searchType: 1, resultsFound: 1 });
drugSearchHistorySchema.index({ createdAt: -1 }); // For cleanup and analytics

export default mongoose.model<IDrugSearchHistory>('DrugSearchHistory', drugSearchHistorySchema);