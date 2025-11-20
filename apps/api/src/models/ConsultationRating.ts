import mongoose, { Document, Schema } from 'mongoose';

export interface IRatingCategories {
  professionalism: number; // 1-5
  communication: number; // 1-5
  expertise: number; // 1-5
  timeliness: number; // 1-5
}

export interface IRatingResponse {
  text: string;
  respondedBy: mongoose.Types.ObjectId;
  respondedAt: Date;
}

export interface IConsultationRating extends Document {
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  pharmacistId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  
  rating: number; // Overall rating 1-5
  feedback?: string;
  
  categories: IRatingCategories;
  
  isAnonymous: boolean;
  
  response?: IRatingResponse;
  
  createdAt: Date;
  updatedAt: Date;

  // Methods
  getAverageRating(): number;
  canRespond(userId: string): boolean;
}

const ratingCategoriesSchema = new Schema({
  professionalism: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  communication: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  expertise: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  timeliness: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
}, { _id: false });

const ratingResponseSchema = new Schema({
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  respondedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  respondedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const consultationRatingSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    pharmacistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      index: true
    },
    
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    feedback: {
      type: String,
      maxlength: 2000
    },
    
    categories: {
      type: ratingCategoriesSchema,
      required: true
    },
    
    isAnonymous: {
      type: Boolean,
      default: false
    },
    
    response: ratingResponseSchema
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Instance methods
consultationRatingSchema.methods.getAverageRating = function (): number {
  const categories = this.categories;
  const sum = categories.professionalism + categories.communication + 
              categories.expertise + categories.timeliness;
  return Math.round((sum / 4) * 10) / 10; // Round to 1 decimal place
};

consultationRatingSchema.methods.canRespond = function (userId: string): boolean {
  // Only the rated pharmacist or workspace admins can respond
  return this.pharmacistId.toString() === userId && !this.response;
};

// Indexes for efficient querying
consultationRatingSchema.index({ workplaceId: 1, pharmacistId: 1, createdAt: -1 });
consultationRatingSchema.index({ workplaceId: 1, patientId: 1, createdAt: -1 });
consultationRatingSchema.index({ workplaceId: 1, rating: 1 });
consultationRatingSchema.index({ appointmentId: 1 }, { sparse: true });

// Compound index for analytics
consultationRatingSchema.index({ 
  workplaceId: 1, 
  pharmacistId: 1, 
  createdAt: -1,
  rating: 1 
});

export default mongoose.model<IConsultationRating>('ConsultationRating', consultationRatingSchema);