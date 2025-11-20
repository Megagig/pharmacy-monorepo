import mongoose, { Document, Schema } from 'mongoose';

export interface IDrugCache extends Document {
  rxcui?: string;
  drugName: string;
  genericName?: string;
  brandNames?: string[];
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  apiSource: 'rxnorm' | 'dailymed' | 'openfda' | 'rxnav';
  apiResponseData: any; // Store raw API response for caching
  searchTerms: string[]; // Terms that lead to this drug for search optimization
  lastUpdated: Date;
  expiresAt: Date;
  isActive: boolean;
  therapeuticClass?: string;
  dea?: string;
  ndc?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const drugCacheSchema = new Schema({
  rxcui: {
    type: String,
    index: true,
    sparse: true
  },
  drugName: {
    type: String,
    required: [true, 'Drug name is required'],
    trim: true,
    index: true
  },
  genericName: {
    type: String,
    trim: true,
    index: true
  },
  brandNames: [String],
  strength: String,
  dosageForm: String,
  manufacturer: String,
  apiSource: {
    type: String,
    enum: ['rxnorm', 'dailymed', 'openfda', 'rxnav'],
    required: true,
    index: true
  },
  apiResponseData: {
    type: Schema.Types.Mixed,
    required: true
  },
  searchTerms: [{
    type: String,
    index: true
  }],
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  therapeuticClass: String,
  dea: String,
  ndc: [String]
}, { timestamps: true });

// Compound indexes for efficient searching
drugCacheSchema.index({ drugName: 'text', genericName: 'text', searchTerms: 'text' });
drugCacheSchema.index({ apiSource: 1, rxcui: 1 });
drugCacheSchema.index({ isActive: 1, expiresAt: 1 });

export default mongoose.model<IDrugCache>('DrugCache', drugCacheSchema);