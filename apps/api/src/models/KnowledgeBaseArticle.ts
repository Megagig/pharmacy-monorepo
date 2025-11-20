import mongoose, { Document, Schema } from 'mongoose';

export interface IKnowledgeBaseArticle extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt: string;

  // Organization
  category: string;
  subcategory?: string;
  tags: string[];

  // Status and visibility
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean; // Public articles visible to all users

  // Author information
  authorId: mongoose.Types.ObjectId;
  authorName: string;

  // Content management
  version: number;
  lastEditedBy?: mongoose.Types.ObjectId;
  lastEditedAt?: Date;

  // Analytics
  viewCount: number;
  helpfulVotes: number;
  notHelpfulVotes: number;

  // SEO and search
  metaDescription?: string;
  searchKeywords: string[];

  // Related content
  relatedArticles: mongoose.Types.ObjectId[];

  // Publishing
  publishedAt?: Date;
  scheduledPublishAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  getHelpfulnessScore(): number;
  isVisible(): boolean;
  incrementViewCount(): Promise<IKnowledgeBaseArticle>;
}

const knowledgeBaseArticleSchema = new Schema<IKnowledgeBaseArticle>(
  {
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subcategory: {
      type: String,
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
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      required: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastEditedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastEditedAt: {
      type: Date,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    notHelpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    metaDescription: {
      type: String,
      maxlength: 160,
      trim: true,
    },
    searchKeywords: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    relatedArticles: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeBaseArticle',
    }],
    publishedAt: {
      type: Date,
      index: true,
    },
    scheduledPublishAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'knowledgebasearticles',
  }
);

// Indexes for search and filtering
knowledgeBaseArticleSchema.index({ status: 1, isPublic: 1 });
knowledgeBaseArticleSchema.index({ category: 1, status: 1 });
knowledgeBaseArticleSchema.index({ publishedAt: -1 });
knowledgeBaseArticleSchema.index({ viewCount: -1 });
knowledgeBaseArticleSchema.index({ tags: 1 });

// Full-text search index
knowledgeBaseArticleSchema.index({
  title: 'text',
  content: 'text',
  excerpt: 'text',
  tags: 'text',
  searchKeywords: 'text'
});

// Pre-save middleware to generate slug and handle publishing
knowledgeBaseArticleSchema.pre('save', function (next) {
  // Generate slug from title if not provided
  if (this.isNew && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Update version number on content changes
  if (this.isModified('content') && !this.isNew) {
    this.version += 1;
    this.lastEditedAt = new Date();
  }

  next();
});

// Methods
knowledgeBaseArticleSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Calculate helpfulness score
knowledgeBaseArticleSchema.methods.getHelpfulnessScore = function (): number {
  const total = this.helpfulVotes + this.notHelpfulVotes;
  if (total === 0) return 0;
  return Math.round((this.helpfulVotes / total) * 100);
};

// Check if article is published and visible
knowledgeBaseArticleSchema.methods.isVisible = function (): boolean {
  return this.status === 'published' &&
    (!this.scheduledPublishAt || this.scheduledPublishAt <= new Date());
};

// Increment view count
knowledgeBaseArticleSchema.methods.incrementViewCount = function (): Promise<IKnowledgeBaseArticle> {
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
};

export const KnowledgeBaseArticle = mongoose.model<IKnowledgeBaseArticle>('KnowledgeBaseArticle', knowledgeBaseArticleSchema);