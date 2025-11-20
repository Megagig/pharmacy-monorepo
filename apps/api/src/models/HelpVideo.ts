import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpVideo extends Document {
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl?: string;
  
  // Organization
  category: string;
  subcategory?: string;
  tags: string[];
  
  // Status and visibility
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  
  // Author information
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  
  // Content management
  version: number;
  lastEditedBy?: mongoose.Types.ObjectId;
  lastEditedAt?: Date;
  
  // Video metadata
  duration?: string; // e.g., "5:30"
  durationSeconds?: number;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  
  // Analytics
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  watchTimeTotal: number; // in seconds
  averageWatchTime: number; // in seconds
  
  // SEO and search
  searchKeywords: string[];
  
  // Related content
  relatedVideos: mongoose.Types.ObjectId[];
  relatedArticles: mongoose.Types.ObjectId[];
  
  // Priority and ordering
  priority: 'low' | 'medium' | 'high' | 'featured';
  displayOrder: number;
  isFeatured: boolean;
  
  // Publishing
  publishedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const helpVideoSchema = new Schema<IHelpVideo>(
  {
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    youtubeUrl: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v: string) {
          return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(v);
        },
        message: 'Please provide a valid YouTube URL'
      }
    },
    youtubeVideoId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    thumbnailUrl: {
      type: String,
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
    duration: {
      type: String,
      trim: true,
    },
    durationSeconds: {
      type: Number,
      min: 0,
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dislikeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    watchTimeTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageWatchTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    searchKeywords: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    relatedVideos: [{
      type: Schema.Types.ObjectId,
      ref: 'HelpVideo',
    }],
    relatedArticles: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeBaseArticle',
    }],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'featured'],
      default: 'medium',
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'helpvideos',
  }
);

// Indexes for search and filtering
helpVideoSchema.index({ status: 1, isPublic: 1 });
helpVideoSchema.index({ category: 1, status: 1 });
helpVideoSchema.index({ difficulty: 1, status: 1 });
helpVideoSchema.index({ priority: 1, displayOrder: 1 });
helpVideoSchema.index({ isFeatured: 1, publishedAt: -1 });
helpVideoSchema.index({ publishedAt: -1 });
helpVideoSchema.index({ viewCount: -1 });
helpVideoSchema.index({ tags: 1 });

// Full-text search index
helpVideoSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
  searchKeywords: 'text'
});

// Helper function to extract YouTube video ID
const extractVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// Pre-save middleware
helpVideoSchema.pre('save', function (next) {
  // Extract YouTube video ID from URL
  if (this.isModified('youtubeUrl')) {
    const videoId = extractVideoId(this.youtubeUrl);
    if (videoId) {
      this.youtubeVideoId = videoId;
      // Generate thumbnail URL if not provided
      if (!this.thumbnailUrl) {
        this.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
  }

  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Update version number on content changes
  if ((this.isModified('title') || this.isModified('description') || this.isModified('youtubeUrl')) && !this.isNew) {
    this.version += 1;
    this.lastEditedAt = new Date();
  }

  next();
});

// Methods
helpVideoSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Extract YouTube video ID from URL (static method)
helpVideoSchema.statics.extractVideoId = function (url: string): string | null {
  return extractVideoId(url);
};

// Calculate engagement score
helpVideoSchema.methods.getEngagementScore = function (): number {
  const total = this.likeCount + this.dislikeCount;
  if (total === 0) return 0;
  return Math.round((this.likeCount / total) * 100);
};

// Check if video is published and visible
helpVideoSchema.methods.isVisible = function (): boolean {
  return this.status === 'published';
};

// Increment view count
helpVideoSchema.methods.incrementViewCount = function (): Promise<IHelpVideo> {
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
};

// Update watch time
helpVideoSchema.methods.updateWatchTime = function (watchTimeSeconds: number): Promise<IHelpVideo> {
  this.watchTimeTotal = (this.watchTimeTotal || 0) + watchTimeSeconds;
  // Recalculate average watch time
  if (this.viewCount > 0) {
    this.averageWatchTime = this.watchTimeTotal / this.viewCount;
  }
  return this.save();
};

export const HelpVideo = mongoose.model<IHelpVideo>('HelpVideo', helpVideoSchema);
export default HelpVideo;