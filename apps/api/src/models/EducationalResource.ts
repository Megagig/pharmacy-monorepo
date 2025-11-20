import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IEducationalResource extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId?: mongoose.Types.ObjectId; // null for global resources

  // Content details
  title: string;
  description: string;
  content: string;
  category: 'medication' | 'condition' | 'wellness' | 'faq' | 'prevention' | 'nutrition' | 'lifestyle';
  tags: string[];

  // Media information
  mediaType: 'article' | 'video' | 'infographic' | 'pdf' | 'audio' | 'interactive';
  mediaUrl?: string;
  thumbnail?: string;
  duration?: number; // For video/audio content in seconds
  fileSize?: number; // For downloadable content in bytes

  // Publishing and visibility
  isPublished: boolean;
  publishedAt?: Date;
  viewCount: number;
  downloadCount: number;

  // Targeting and personalization
  targetAudience: {
    conditions?: string[]; // Target specific medical conditions
    medications?: string[]; // Target specific medications
    ageGroups?: ('child' | 'teen' | 'adult' | 'senior')[]; // Target age groups
    demographics?: ('male' | 'female' | 'pregnant' | 'elderly')[]; // Target demographics
  };

  // Localization
  localizedFor: string; // 'nigeria', 'general', 'west_africa'
  language: string; // 'en', 'yo', 'ig', 'ha', 'fr'

  // Content metadata
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  readingTime?: number; // Estimated reading time in minutes
  lastReviewed?: Date;
  reviewedBy?: mongoose.Types.ObjectId;

  // SEO and discoverability
  slug: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];

  // Content relationships
  relatedResources: mongoose.Types.ObjectId[]; // ref: EducationalResource
  prerequisites: mongoose.Types.ObjectId[]; // Resources that should be read first
  followUpResources: mongoose.Types.ObjectId[]; // Recommended next resources

  // Engagement metrics
  ratings: {
    averageRating: number;
    totalRatings: number;
    ratingBreakdown: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
  };

  // Content validation
  isFactChecked: boolean;
  factCheckedBy?: mongoose.Types.ObjectId;
  factCheckedAt?: Date;
  sources: Array<{
    title: string;
    url?: string;
    author?: string;
    publishedDate?: Date;
    type: 'journal' | 'website' | 'book' | 'guideline' | 'study';
  }>;

  // Access control
  accessLevel: 'public' | 'patient_only' | 'premium' | 'staff_only';
  requiredSubscription?: string;

  // Dashboard display settings
  displayLocations: ('workspace_dashboard' | 'patient_dashboard' | 'education_page')[];
  isPinned: boolean;
  displayOrder: number;
  pinnedAt?: Date;

  // Scheduling settings
  scheduledStartDate?: Date;
  scheduledEndDate?: Date;
  isScheduled: boolean;

  // Analytics tracking
  analytics: {
    dashboardViews: number;
    dashboardClicks: number;
    educationPageViews: number;
    completionRate: number;
    averageTimeSpent: number;
    clickThroughRate: number;
    lastViewedAt?: Date;
  };

  // Recommendation settings
  recommendationScore: number;
  autoRecommend: boolean;
  recommendationCriteria?: {
    conditions?: string[];
    medications?: string[];
    ageGroups?: string[];
    minRiskScore?: number;
  };

  // Audit fields
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  generateSlug(): string;
  calculateReadingTime(): number;
  incrementViewCount(): Promise<void>;
  incrementDownloadCount(): Promise<void>;
  addRating(rating: number): void;
  getRelatedResources(limit?: number): Promise<IEducationalResource[]>;
  isAccessibleTo(userType: string, subscriptionLevel?: string): boolean;
  needsReview(): boolean;
  isCurrentlyScheduled(): boolean;
  trackDashboardView(): Promise<void>;
  trackDashboardClick(): Promise<void>;
  trackEducationPageView(): Promise<void>;
  updateAverageTimeSpent(timeSpentSeconds: number): Promise<void>;
  calculateRecommendationScore(userProfile?: {
    conditions?: string[];
    medications?: string[];
    ageGroup?: string;
  }): number;
}

// Model interface with static methods
export interface IEducationalResourceModel extends mongoose.Model<IEducationalResource> {
  ensureUniqueSlug(baseSlug: string, excludeId?: mongoose.Types.ObjectId): Promise<string>;
}

const educationalResourceSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      index: true,
      sparse: true, // Allow null values for global resources
    },

    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Resource description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    content: {
      type: String,
      required: [true, 'Resource content is required'],
      minlength: [50, 'Content must be at least 50 characters'],
    },
    category: {
      type: String,
      enum: {
        values: ['medication', 'condition', 'wellness', 'faq', 'prevention', 'nutrition', 'lifestyle'],
        message: 'Invalid category',
      },
      required: [true, 'Resource category is required'],
      index: true,
    },
    tags: {
      type: [String],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 15;
        },
        message: 'Cannot have more than 15 tags',
      },
      index: true,
    },

    mediaType: {
      type: String,
      enum: {
        values: ['article', 'video', 'infographic', 'pdf', 'audio', 'interactive'],
        message: 'Invalid media type',
      },
      required: [true, 'Media type is required'],
      index: true,
    },
    mediaUrl: {
      type: String,
      validate: {
        validator: function (url: string) {
          if (!url) return true; // Optional field
          return /^https?:\/\/.+/.test(url);
        },
        message: 'Media URL must be a valid URL',
      },
    },
    thumbnail: {
      type: String,
      validate: {
        validator: function (url: string) {
          if (!url) return true; // Optional field
          return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(url);
        },
        message: 'Thumbnail must be a valid image URL',
      },
    },
    duration: {
      type: Number,
      min: [1, 'Duration must be at least 1 second'],
      max: [86400, 'Duration cannot exceed 24 hours'],
    },
    fileSize: {
      type: Number,
      min: [1, 'File size must be at least 1 byte'],
      max: [104857600, 'File size cannot exceed 100MB'],
    },

    isPublished: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative'],
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: [0, 'Download count cannot be negative'],
    },

    targetAudience: {
      conditions: {
        type: [String],
        validate: {
          validator: function (conditions: string[]) {
            return conditions.length <= 20;
          },
          message: 'Cannot target more than 20 conditions',
        },
      },
      medications: {
        type: [String],
        validate: {
          validator: function (medications: string[]) {
            return medications.length <= 20;
          },
          message: 'Cannot target more than 20 medications',
        },
      },
      ageGroups: {
        type: [String],
        enum: ['child', 'teen', 'adult', 'senior'],
      },
      demographics: {
        type: [String],
        enum: ['male', 'female', 'pregnant', 'elderly'],
      },
    },

    localizedFor: {
      type: String,
      enum: {
        values: ['nigeria', 'general', 'west_africa'],
        message: 'Invalid localization',
      },
      default: 'general',
      required: true,
      index: true,
    },
    language: {
      type: String,
      enum: {
        values: ['en', 'yo', 'ig', 'ha', 'fr'],
        message: 'Invalid language',
      },
      default: 'en',
      required: true,
      index: true,
    },

    difficulty: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Invalid difficulty level',
      },
      default: 'beginner',
      required: true,
      index: true,
    },
    readingTime: {
      type: Number,
      min: [1, 'Reading time must be at least 1 minute'],
      max: [120, 'Reading time cannot exceed 120 minutes'],
    },
    lastReviewed: Date,
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: function (value: string) {
          return /^[a-z0-9-]+$/.test(value);
        },
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      },
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'Meta title cannot exceed 60 characters'],
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'Meta description cannot exceed 160 characters'],
    },
    keywords: {
      type: [String],
      validate: {
        validator: function (keywords: string[]) {
          return keywords.length <= 20;
        },
        message: 'Cannot have more than 20 keywords',
      },
    },

    relatedResources: {
      type: [Schema.Types.ObjectId],
      ref: 'EducationalResource',
      validate: {
        validator: function (resources: mongoose.Types.ObjectId[]) {
          return resources.length <= 10;
        },
        message: 'Cannot have more than 10 related resources',
      },
    },
    prerequisites: {
      type: [Schema.Types.ObjectId],
      ref: 'EducationalResource',
      validate: {
        validator: function (resources: mongoose.Types.ObjectId[]) {
          return resources.length <= 5;
        },
        message: 'Cannot have more than 5 prerequisites',
      },
    },
    followUpResources: {
      type: [Schema.Types.ObjectId],
      ref: 'EducationalResource',
      validate: {
        validator: function (resources: mongoose.Types.ObjectId[]) {
          return resources.length <= 10;
        },
        message: 'Cannot have more than 10 follow-up resources',
      },
    },

    ratings: {
      averageRating: {
        type: Number,
        default: 0,
        min: [0, 'Average rating cannot be negative'],
        max: [5, 'Average rating cannot exceed 5'],
      },
      totalRatings: {
        type: Number,
        default: 0,
        min: [0, 'Total ratings cannot be negative'],
      },
      ratingBreakdown: {
        1: { type: Number, default: 0, min: 0 },
        2: { type: Number, default: 0, min: 0 },
        3: { type: Number, default: 0, min: 0 },
        4: { type: Number, default: 0, min: 0 },
        5: { type: Number, default: 0, min: 0 },
      },
    },

    isFactChecked: {
      type: Boolean,
      default: false,
      required: true,
    },
    factCheckedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    factCheckedAt: Date,
    sources: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
          maxlength: [200, 'Source title cannot exceed 200 characters'],
        },
        url: {
          type: String,
          validate: {
            validator: function (url: string) {
              if (!url) return true; // Optional field
              return /^https?:\/\/.+/.test(url);
            },
            message: 'Source URL must be a valid URL',
          },
        },
        author: {
          type: String,
          trim: true,
          maxlength: [100, 'Author name cannot exceed 100 characters'],
        },
        publishedDate: Date,
        type: {
          type: String,
          enum: ['journal', 'website', 'book', 'guideline', 'study'],
          required: true,
        },
      },
    ],

    accessLevel: {
      type: String,
      enum: {
        values: ['public', 'patient_only', 'premium', 'staff_only'],
        message: 'Invalid access level',
      },
      default: 'public',
      required: true,
      index: true,
    },
    requiredSubscription: {
      type: String,
      validate: {
        validator: function (this: IEducationalResource, subscription: string) {
          // Required subscription only makes sense for premium content
          if (this.accessLevel === 'premium' && !subscription) {
            return false;
          }
          return true;
        },
        message: 'Required subscription must be specified for premium content',
      },
    },

    // Dashboard display settings
    displayLocations: {
      type: [String],
      enum: {
        values: ['workspace_dashboard', 'patient_dashboard', 'education_page'],
        message: 'Invalid display location',
      },
      default: ['education_page'],
      required: true,
      validate: {
        validator: function (locations: string[]) {
          return locations.length > 0 && locations.length <= 3;
        },
        message: 'Must have at least one display location and no more than three',
      },
    },
    isPinned: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative'],
      max: [9999, 'Display order cannot exceed 9999'],
    },
    pinnedAt: {
      type: Date,
      index: true,
    },

    // Scheduling settings
    scheduledStartDate: {
      type: Date,
      index: true,
    },
    scheduledEndDate: {
      type: Date,
      index: true,
    },
    isScheduled: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Analytics tracking
    analytics: {
      dashboardViews: {
        type: Number,
        default: 0,
        min: 0,
      },
      dashboardClicks: {
        type: Number,
        default: 0,
        min: 0,
      },
      educationPageViews: {
        type: Number,
        default: 0,
        min: 0,
      },
      completionRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      averageTimeSpent: {
        type: Number,
        default: 0,
        min: 0,
      },
      clickThroughRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      lastViewedAt: {
        type: Date,
      },
    },

    // Recommendation settings
    recommendationScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    autoRecommend: {
      type: Boolean,
      default: false,
      index: true,
    },
    recommendationCriteria: {
      conditions: [String],
      medications: [String],
      ageGroups: [String],
      minRiskScore: {
        type: Number,
        min: 0,
        max: 100,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields
addAuditFields(educationalResourceSchema);

// Apply tenancy guard plugin (optional for global resources)
educationalResourceSchema.plugin(tenancyGuardPlugin, {
  pharmacyIdField: 'workplaceId',
  allowGlobal: true // Allow resources without workplaceId
});

// Indexes for performance
educationalResourceSchema.index({ category: 1, isPublished: 1, language: 1 });
educationalResourceSchema.index({ tags: 1, isPublished: 1 });
educationalResourceSchema.index({ mediaType: 1, isPublished: 1 });
educationalResourceSchema.index({ difficulty: 1, isPublished: 1 });
educationalResourceSchema.index({ localizedFor: 1, language: 1, isPublished: 1 });
educationalResourceSchema.index({ accessLevel: 1, isPublished: 1 });
educationalResourceSchema.index({ viewCount: -1, isPublished: 1 });
educationalResourceSchema.index({ 'ratings.averageRating': -1, isPublished: 1 });
educationalResourceSchema.index({ publishedAt: -1, isPublished: 1 });
educationalResourceSchema.index({ 'targetAudience.conditions': 1 });
educationalResourceSchema.index({ 'targetAudience.medications': 1 });
educationalResourceSchema.index({ createdAt: -1 });
// Dashboard display indexes
educationalResourceSchema.index({ displayLocations: 1, isPublished: 1, isPinned: -1, displayOrder: 1 });
educationalResourceSchema.index({ isPinned: -1, displayOrder: 1, viewCount: -1 });
// Scheduling indexes
educationalResourceSchema.index({ isScheduled: 1, scheduledStartDate: 1, scheduledEndDate: 1 });
// Recommendation indexes
educationalResourceSchema.index({ autoRecommend: 1, recommendationScore: -1 });
educationalResourceSchema.index({ 'recommendationCriteria.conditions': 1 });
educationalResourceSchema.index({ 'recommendationCriteria.medications': 1 });

// Text index for search functionality
educationalResourceSchema.index({
  title: 'text',
  description: 'text',
  content: 'text',
  tags: 'text',
  keywords: 'text',
});

// Virtual for URL
educationalResourceSchema.virtual('url').get(function (this: IEducationalResource) {
  return `/resources/${this.slug}`;
});

// Virtual for reading time display
educationalResourceSchema.virtual('readingTimeDisplay').get(function (this: IEducationalResource) {
  if (this.readingTime) {
    return `${this.readingTime} min read`;
  }
  return null;
});

// Virtual for duration display
educationalResourceSchema.virtual('durationDisplay').get(function (this: IEducationalResource) {
  if (!this.duration) return null;

  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${minutes} min`;
  }
  return `${seconds} sec`;
});

// Virtual for file size display
educationalResourceSchema.virtual('fileSizeDisplay').get(function (this: IEducationalResource) {
  if (!this.fileSize) return null;

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = this.fileSize;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
});

// Virtual for engagement score
educationalResourceSchema.virtual('engagementScore').get(function (this: IEducationalResource) {
  const viewWeight = 1;
  const downloadWeight = 3;
  const ratingWeight = 2;

  const viewScore = this.viewCount * viewWeight;
  const downloadScore = this.downloadCount * downloadWeight;
  const ratingScore = this.ratings.averageRating * this.ratings.totalRatings * ratingWeight;

  return viewScore + downloadScore + ratingScore;
});

// Pre-save middleware
educationalResourceSchema.pre('save', function (this: IEducationalResource) {
  // Generate slug if not provided or title changed
  if (!this.slug || this.isModified('title')) {
    this.slug = this.generateSlug();
  }

  // Calculate reading time if content changed
  if (this.isModified('content') && this.mediaType === 'article') {
    this.readingTime = this.calculateReadingTime();
  }

  // Set published date when status changes to published
  if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Clear published date when unpublished
  if (this.isModified('isPublished') && !this.isPublished) {
    this.publishedAt = undefined;
  }

  // Set pinned date when pinned
  if (this.isModified('isPinned') && this.isPinned && !this.pinnedAt) {
    this.pinnedAt = new Date();
  }

  // Clear pinned date when unpinned
  if (this.isModified('isPinned') && !this.isPinned) {
    this.pinnedAt = undefined;
  }

  // Validate scheduling dates
  if (this.isScheduled) {
    if (!this.scheduledStartDate) {
      throw new Error('Scheduled start date is required when scheduling is enabled');
    }
    if (this.scheduledEndDate && this.scheduledEndDate < this.scheduledStartDate) {
      throw new Error('Scheduled end date must be after start date');
    }
  }

  // Calculate click-through rate
  if (this.analytics && this.analytics.dashboardViews > 0) {
    this.analytics.clickThroughRate = Math.round(
      (this.analytics.dashboardClicks / this.analytics.dashboardViews) * 100
    );
  }

  // Set meta fields if not provided
  if (!this.metaTitle) {
    this.metaTitle = this.title.substring(0, 60);
  }
  if (!this.metaDescription) {
    this.metaDescription = this.description.substring(0, 160);
  }

  // Clean up tags and keywords
  if (this.tags) {
    this.tags = this.tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .slice(0, 15);
  }

  if (this.keywords) {
    this.keywords = this.keywords
      .map(keyword => keyword.trim().toLowerCase())
      .filter(keyword => keyword.length > 0)
      .slice(0, 20);
  }
});

// Instance method to generate slug
educationalResourceSchema.methods.generateSlug = function (this: IEducationalResource): string {
  if (!this.title) return '';

  return this.title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Instance method to calculate reading time
educationalResourceSchema.methods.calculateReadingTime = function (this: IEducationalResource): number {
  if (!this.content) return 1;

  // Remove HTML tags and count words
  const plainText = this.content.replace(/<[^>]*>/g, '');
  const wordCount = plainText.trim().split(/\s+/).length;

  // Average reading speed: 200-250 words per minute
  const wordsPerMinute = 225;
  const readTime = Math.ceil(wordCount / wordsPerMinute);

  return Math.max(1, readTime);
};

// Instance method to increment view count
educationalResourceSchema.methods.incrementViewCount = async function (this: IEducationalResource): Promise<void> {
  await (this.constructor as mongoose.Model<IEducationalResource>).updateOne(
    { _id: this._id },
    { $inc: { viewCount: 1 } }
  );
  this.viewCount += 1;
};

// Instance method to increment download count
educationalResourceSchema.methods.incrementDownloadCount = async function (this: IEducationalResource): Promise<void> {
  await (this.constructor as mongoose.Model<IEducationalResource>).updateOne(
    { _id: this._id },
    { $inc: { downloadCount: 1 } }
  );
  this.downloadCount += 1;
};

// Instance method to add rating
educationalResourceSchema.methods.addRating = function (this: IEducationalResource, rating: number): void {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Update rating breakdown
  this.ratings.ratingBreakdown[rating as keyof typeof this.ratings.ratingBreakdown] += 1;
  this.ratings.totalRatings += 1;

  // Recalculate average rating
  const totalScore = Object.entries(this.ratings.ratingBreakdown).reduce(
    (sum, [rating, count]) => sum + (parseInt(rating) * count),
    0
  );

  this.ratings.averageRating = Math.round((totalScore / this.ratings.totalRatings) * 10) / 10;
};

// Instance method to get related resources
educationalResourceSchema.methods.getRelatedResources = async function (
  this: IEducationalResource,
  limit: number = 5
): Promise<IEducationalResource[]> {
  const EducationalResource = this.constructor as mongoose.Model<IEducationalResource>;

  // First try manually set related resources
  if (this.relatedResources && this.relatedResources.length > 0) {
    const relatedResources = await EducationalResource.find({
      _id: { $in: this.relatedResources },
      isPublished: true,
      isDeleted: false,
    })
      .select('title slug description thumbnail category mediaType readingTime viewCount ratings')
      .limit(limit);

    if (relatedResources.length >= limit) {
      return relatedResources;
    }
  }

  // Find by category and tags
  const query: any = {
    _id: { $ne: this._id },
    isPublished: true,
    isDeleted: false,
    $or: [
      { category: this.category },
      { tags: { $in: this.tags } },
    ],
  };

  // Prefer same workplace if applicable
  if (this.workplaceId) {
    query.$or.push({ workplaceId: this.workplaceId });
  }

  return await EducationalResource.find(query)
    .select('title slug description thumbnail category mediaType readingTime viewCount ratings')
    .sort({ viewCount: -1, 'ratings.averageRating': -1 })
    .limit(limit);
};

// Instance method to check access
educationalResourceSchema.methods.isAccessibleTo = function (
  this: IEducationalResource,
  userType: string,
  subscriptionLevel?: string
): boolean {
  switch (this.accessLevel) {
    case 'public':
      return true;
    case 'patient_only':
      return ['patient', 'staff', 'admin'].includes(userType);
    case 'premium':
      return subscriptionLevel === this.requiredSubscription || ['staff', 'admin'].includes(userType);
    case 'staff_only':
      return ['staff', 'admin'].includes(userType);
    default:
      return false;
  }
};

// Instance method to check if needs review
educationalResourceSchema.methods.needsReview = function (this: IEducationalResource): boolean {
  if (!this.lastReviewed) return true;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return this.lastReviewed < sixMonthsAgo;
};

// Instance method to check if currently scheduled
educationalResourceSchema.methods.isCurrentlyScheduled = function (this: IEducationalResource): boolean {
  if (!this.isScheduled) return false;
  
  const now = new Date();
  const hasStarted = !this.scheduledStartDate || this.scheduledStartDate <= now;
  const hasNotEnded = !this.scheduledEndDate || this.scheduledEndDate >= now;
  
  return hasStarted && hasNotEnded;
};

// Instance method to track dashboard view
educationalResourceSchema.methods.trackDashboardView = async function (this: IEducationalResource): Promise<void> {
  await (this.constructor as mongoose.Model<IEducationalResource>).updateOne(
    { _id: this._id },
    { 
      $inc: { 'analytics.dashboardViews': 1 },
      $set: { 'analytics.lastViewedAt': new Date() }
    }
  );
};

// Instance method to track dashboard click
educationalResourceSchema.methods.trackDashboardClick = async function (this: IEducationalResource): Promise<void> {
  await (this.constructor as mongoose.Model<IEducationalResource>).updateOne(
    { _id: this._id },
    { 
      $inc: { 'analytics.dashboardClicks': 1 },
      $set: { 'analytics.lastViewedAt': new Date() }
    }
  );
};

// Instance method to track education page view
educationalResourceSchema.methods.trackEducationPageView = async function (this: IEducationalResource): Promise<void> {
  await (this.constructor as mongoose.Model<IEducationalResource>).updateOne(
    { _id: this._id },
    { 
      $inc: { 'analytics.educationPageViews': 1 },
      $set: { 'analytics.lastViewedAt': new Date() }
    }
  );
};

// Instance method to update time spent
educationalResourceSchema.methods.updateAverageTimeSpent = async function (
  this: IEducationalResource,
  timeSpentSeconds: number
): Promise<void> {
  const totalViews = this.analytics.dashboardViews + this.analytics.educationPageViews;
  if (totalViews === 0) return;
  
  const currentTotal = this.analytics.averageTimeSpent * totalViews;
  const newAverage = Math.round((currentTotal + timeSpentSeconds) / (totalViews + 1));
  
  await (this.constructor as mongoose.Model<IEducationalResource>).updateOne(
    { _id: this._id },
    { $set: { 'analytics.averageTimeSpent': newAverage } }
  );
};

// Instance method to calculate recommendation score
educationalResourceSchema.methods.calculateRecommendationScore = function (
  this: IEducationalResource,
  userProfile?: {
    conditions?: string[];
    medications?: string[];
    ageGroup?: string;
  }
): number {
  let score = 0;
  
  // Base score from resource quality
  score += this.ratings.averageRating * 10; // 0-50 points
  score += Math.min(this.viewCount / 100, 20); // 0-20 points based on popularity
  
  // Boost for user-specific relevance
  if (userProfile && this.recommendationCriteria) {
    // Condition match
    if (userProfile.conditions && this.recommendationCriteria.conditions) {
      const matchingConditions = userProfile.conditions.filter(c =>
        this.recommendationCriteria?.conditions?.includes(c)
      );
      score += matchingConditions.length * 10; // 10 points per matching condition
    }
    
    // Medication match
    if (userProfile.medications && this.recommendationCriteria.medications) {
      const matchingMeds = userProfile.medications.filter(m =>
        this.recommendationCriteria?.medications?.includes(m)
      );
      score += matchingMeds.length * 5; // 5 points per matching medication
    }
    
    // Age group match
    if (userProfile.ageGroup && this.recommendationCriteria.ageGroups?.includes(userProfile.ageGroup)) {
      score += 10; // 10 points for age group match
    }
  }
  
  return Math.min(Math.round(score), 100);
};

// Static method to find published resources
educationalResourceSchema.statics.findPublished = function (
  options?: {
    category?: string;
    tags?: string[];
    mediaType?: string;
    difficulty?: string;
    language?: string;
    localizedFor?: string;
    accessLevel?: string;
    workplaceId?: mongoose.Types.ObjectId;
    limit?: number;
    skip?: number;
  }
) {
  const query: any = {
    isPublished: true,
    isDeleted: false,
  };

  if (options?.category) {
    query.category = options.category;
  }

  if (options?.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  if (options?.mediaType) {
    query.mediaType = options.mediaType;
  }

  if (options?.difficulty) {
    query.difficulty = options.difficulty;
  }

  if (options?.language) {
    query.language = options.language;
  }

  if (options?.localizedFor) {
    query.localizedFor = options.localizedFor;
  }

  if (options?.accessLevel) {
    query.accessLevel = options.accessLevel;
  }

  if (options?.workplaceId) {
    query.$or = [
      { workplaceId: options.workplaceId },
      { workplaceId: null }, // Include global resources
    ];
  }

  let queryBuilder = this.find(query)
    .select('title slug description thumbnail category mediaType difficulty language readingTime viewCount ratings publishedAt')
    .sort({ publishedAt: -1 });

  if (options?.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }

  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  return queryBuilder;
};

// Static method to search resources
educationalResourceSchema.statics.searchResources = function (
  searchQuery: string,
  options?: {
    category?: string;
    mediaType?: string;
    difficulty?: string;
    language?: string;
    accessLevel?: string;
    workplaceId?: mongoose.Types.ObjectId;
    limit?: number;
    skip?: number;
  }
) {
  const query: any = {
    isPublished: true,
    isDeleted: false,
    $text: { $search: searchQuery },
  };

  if (options?.category) {
    query.category = options.category;
  }

  if (options?.mediaType) {
    query.mediaType = options.mediaType;
  }

  if (options?.difficulty) {
    query.difficulty = options.difficulty;
  }

  if (options?.language) {
    query.language = options.language;
  }

  if (options?.accessLevel) {
    query.accessLevel = options.accessLevel;
  }

  if (options?.workplaceId) {
    query.$or = [
      { workplaceId: options.workplaceId },
      { workplaceId: null },
    ];
  }

  let queryBuilder = this.find(query)
    .select('title slug description thumbnail category mediaType difficulty language readingTime viewCount ratings score')
    .sort({ score: { $meta: 'textScore' }, viewCount: -1 });

  if (options?.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }

  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  return queryBuilder;
};

// Static method to get popular resources
educationalResourceSchema.statics.getPopularResources = function (
  workplaceId?: mongoose.Types.ObjectId,
  limit: number = 10
) {
  const query: any = {
    isPublished: true,
    isDeleted: false,
  };

  if (workplaceId) {
    query.$or = [
      { workplaceId },
      { workplaceId: null },
    ];
  }

  return this.find(query)
    .select('title slug description thumbnail category mediaType readingTime viewCount ratings')
    .sort({ viewCount: -1, 'ratings.averageRating': -1 })
    .limit(limit);
};

// Static method to ensure unique slug
educationalResourceSchema.statics.ensureUniqueSlug = async function (
  baseSlug: string,
  excludeId?: mongoose.Types.ObjectId
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query: any = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingResource = await this.findOne(query);
    if (!existingResource) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

export default mongoose.model<IEducationalResource, IEducationalResourceModel>('EducationalResource', educationalResourceSchema);