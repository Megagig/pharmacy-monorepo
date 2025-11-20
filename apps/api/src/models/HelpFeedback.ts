import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpFeedback extends Document {
  // User information
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName: string;
  
  // Feedback content
  type: 'general' | 'article' | 'faq' | 'video' | 'feature_request' | 'bug_report';
  rating: number; // 1-5 stars
  title: string;
  message: string;
  
  // Related content (if applicable)
  relatedContentType?: 'article' | 'faq' | 'video';
  relatedContentId?: mongoose.Types.ObjectId;
  relatedContentTitle?: string;
  
  // Categorization
  category: string;
  tags: string[];
  
  // Status and processing
  status: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Admin response
  adminResponse?: string;
  respondedBy?: mongoose.Types.ObjectId;
  respondedAt?: Date;
  
  // Internal notes (visible only to admins)
  internalNotes?: string;
  
  // Metadata
  userAgent?: string;
  ipAddress?: string;
  pageUrl?: string;
  
  // Follow-up
  isFollowUpRequired: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  
  // Analytics
  helpfulnessScore?: number; // If this feedback was helpful to others
  
  createdAt: Date;
  updatedAt: Date;
}

const helpFeedbackSchema = new Schema<IHelpFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['general', 'article', 'faq', 'video', 'feature_request', 'bug_report'],
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    relatedContentType: {
      type: String,
      enum: ['article', 'faq', 'video'],
    },
    relatedContentId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    relatedContentTitle: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    status: {
      type: String,
      enum: ['new', 'reviewed', 'in_progress', 'resolved', 'closed'],
      default: 'new',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    adminResponse: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    respondedAt: {
      type: Date,
    },
    internalNotes: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    pageUrl: {
      type: String,
      trim: true,
    },
    isFollowUpRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    followUpDate: {
      type: Date,
      index: true,
    },
    followUpNotes: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    helpfulnessScore: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: 'helpfeedback',
  }
);

// Indexes for search and filtering
helpFeedbackSchema.index({ status: 1, createdAt: -1 });
helpFeedbackSchema.index({ type: 1, status: 1 });
helpFeedbackSchema.index({ priority: 1, status: 1 });
helpFeedbackSchema.index({ rating: 1, createdAt: -1 });
helpFeedbackSchema.index({ category: 1, status: 1 });
helpFeedbackSchema.index({ isFollowUpRequired: 1, followUpDate: 1 });
helpFeedbackSchema.index({ relatedContentType: 1, relatedContentId: 1 });

// Full-text search index
helpFeedbackSchema.index({
  title: 'text',
  message: 'text',
  tags: 'text'
});

// Pre-save middleware
helpFeedbackSchema.pre('save', function (next) {
  // Set response timestamp when admin response is added
  if (this.isModified('adminResponse') && this.adminResponse && !this.respondedAt) {
    this.respondedAt = new Date();
  }

  // Auto-set priority based on rating for bug reports and feature requests
  if (this.isNew && (this.type === 'bug_report' || this.type === 'feature_request')) {
    if (this.rating <= 2) {
      this.priority = 'high';
    } else if (this.rating === 3) {
      this.priority = 'medium';
    } else {
      this.priority = 'low';
    }
  }

  next();
});

// Methods
helpFeedbackSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Check if feedback needs attention
helpFeedbackSchema.methods.needsAttention = function (): boolean {
  return this.status === 'new' || 
         (this.isFollowUpRequired && this.followUpDate && this.followUpDate <= new Date()) ||
         this.priority === 'critical';
};

// Mark as resolved
helpFeedbackSchema.methods.markAsResolved = function (adminId: mongoose.Types.ObjectId, response?: string): Promise<IHelpFeedback> {
  this.status = 'resolved';
  this.respondedBy = adminId;
  this.respondedAt = new Date();
  if (response) {
    this.adminResponse = response;
  }
  return this.save();
};

// Set follow-up
helpFeedbackSchema.methods.setFollowUp = function (date: Date, notes?: string): Promise<IHelpFeedback> {
  this.isFollowUpRequired = true;
  this.followUpDate = date;
  if (notes) {
    this.followUpNotes = notes;
  }
  return this.save();
};

export const HelpFeedback = mongoose.model<IHelpFeedback>('HelpFeedback', helpFeedbackSchema);
export default HelpFeedback;