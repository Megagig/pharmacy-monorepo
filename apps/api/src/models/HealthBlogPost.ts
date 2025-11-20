import mongoose, { Document, Schema } from 'mongoose';
import { addAuditFields } from '../utils/tenancyGuard';

export interface IHealthBlogPost extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string; // auto-generated, unique
  excerpt: string;
  content: string; // rich text/markdown
  featuredImage: {
    url: string;
    alt: string;
    caption?: string;
  };
  category: 'nutrition' | 'wellness' | 'medication' | 'chronic_diseases' | 'preventive_care' | 'mental_health';
  tags: string[];
  author: {
    id: mongoose.Types.ObjectId; // ref: User (Super Admin)
    name: string;
    avatar?: string;
  };
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  readTime: number; // auto-calculated minutes
  viewCount: number;
  isFeatured: boolean;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords: string[];
  };
  relatedPosts: mongoose.Types.ObjectId[]; // ref: HealthBlogPost
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  generateSlug(): string;
  calculateReadTime(): number;
  incrementViewCount(): Promise<void>;
  getRelatedPosts(limit?: number): Promise<IHealthBlogPost[]>;
}

const healthBlogPostSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Blog post title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: true,
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
          // Validate slug format (lowercase, alphanumeric, hyphens only)
          return /^[a-z0-9-]+$/.test(value);
        },
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      },
    },
    excerpt: {
      type: String,
      required: [true, 'Blog post excerpt is required'],
      trim: true,
      minlength: [20, 'Excerpt must be at least 20 characters'],
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    content: {
      type: String,
      required: [true, 'Blog post content is required'],
      minlength: [100, 'Content must be at least 100 characters'],
    },
    featuredImage: {
      url: {
        type: String,
        required: [true, 'Featured image URL is required'],
        validate: {
          validator: function (value: string) {
            // Basic URL validation
            return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(value);
          },
          message: 'Featured image must be a valid image URL',
        },
      },
      alt: {
        type: String,
        required: [true, 'Featured image alt text is required'],
        trim: true,
        maxlength: [200, 'Alt text cannot exceed 200 characters'],
      },
      caption: {
        type: String,
        trim: true,
        maxlength: [300, 'Caption cannot exceed 300 characters'],
      },
    },
    category: {
      type: String,
      enum: {
        values: ['nutrition', 'wellness', 'medication', 'chronic_diseases', 'preventive_care', 'mental_health'],
        message: 'Invalid category. Must be one of: nutrition, wellness, medication, chronic_diseases, preventive_care, mental_health',
      },
      required: [true, 'Blog post category is required'],
      index: true,
    },
    tags: {
      type: [String],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 10;
        },
        message: 'Cannot have more than 10 tags',
      },
      index: true,
    },
    author: {
      id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Author ID is required'],
        index: true,
      },
      name: {
        type: String,
        required: [true, 'Author name is required'],
        trim: true,
        maxlength: [100, 'Author name cannot exceed 100 characters'],
      },
      avatar: {
        type: String,
        validate: {
          validator: function (value: string) {
            if (!value) return true; // Optional field
            return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(value);
          },
          message: 'Author avatar must be a valid image URL',
        },
      },
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: 'Status must be one of: draft, published, archived',
      },
      default: 'draft',
      required: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
      validate: {
        validator: function (this: IHealthBlogPost, value: Date) {
          // Published date is required when status is published
          if (this.status === 'published' && !value) {
            return false;
          }
          return true;
        },
        message: 'Published date is required when status is published',
      },
    },
    readTime: {
      type: Number,
      required: true,
      min: [1, 'Read time must be at least 1 minute'],
      max: [60, 'Read time cannot exceed 60 minutes'],
      default: 1,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative'],
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    seo: {
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
            return keywords.length <= 15;
          },
          message: 'Cannot have more than 15 SEO keywords',
        },
      },
    },
    relatedPosts: {
      type: [Schema.Types.ObjectId],
      ref: 'HealthBlogPost',
      validate: {
        validator: function (posts: mongoose.Types.ObjectId[]) {
          return posts.length <= 5;
        },
        message: 'Cannot have more than 5 related posts',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(healthBlogPostSchema);

// Indexes for performance
healthBlogPostSchema.index({ status: 1, publishedAt: -1 }); // For published posts listing
healthBlogPostSchema.index({ category: 1, status: 1, publishedAt: -1 }); // For category filtering
healthBlogPostSchema.index({ tags: 1, status: 1 }); // For tag filtering
healthBlogPostSchema.index({ isFeatured: 1, status: 1, publishedAt: -1 }); // For featured posts
healthBlogPostSchema.index({ viewCount: -1, status: 1 }); // For popular posts
healthBlogPostSchema.index({ 'author.id': 1, status: 1 }); // For author posts
healthBlogPostSchema.index({ createdAt: -1 }); // For admin listing
healthBlogPostSchema.index({ 'seo.keywords': 1 }); // For SEO search

// Text index for search functionality
healthBlogPostSchema.index({
  title: 'text',
  excerpt: 'text',
  content: 'text',
  tags: 'text',
  'seo.keywords': 'text',
});

// Virtual for URL-friendly slug
healthBlogPostSchema.virtual('url').get(function (this: IHealthBlogPost) {
  return `/blog/${this.slug}`;
});

// Virtual for reading time display
healthBlogPostSchema.virtual('readTimeDisplay').get(function (this: IHealthBlogPost) {
  return `${this.readTime} min read`;
});

// Virtual for published status check
healthBlogPostSchema.virtual('isPublished').get(function (this: IHealthBlogPost) {
  return this.status === 'published';
});

// Virtual for word count estimation
healthBlogPostSchema.virtual('wordCount').get(function (this: IHealthBlogPost) {
  if (!this.content) return 0;
  // Remove HTML tags and count words
  const plainText = this.content.replace(/<[^>]*>/g, '');
  return plainText.trim().split(/\s+/).length;
});

// Pre-save middleware
healthBlogPostSchema.pre('save', function (this: IHealthBlogPost) {
  // Generate slug if not provided or title changed
  if (!this.slug || this.isModified('title')) {
    this.slug = this.generateSlug();
  }

  // Calculate read time if content changed
  if (this.isModified('content')) {
    this.readTime = this.calculateReadTime();
  }

  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Clear published date when status changes from published
  if (this.isModified('status') && this.status !== 'published') {
    this.publishedAt = undefined;
  }

  // Ensure SEO fields are set
  if (!this.seo.metaTitle) {
    this.seo.metaTitle = this.title.substring(0, 60);
  }
  if (!this.seo.metaDescription) {
    this.seo.metaDescription = this.excerpt.substring(0, 160);
  }

  // Clean up tags and keywords
  if (this.tags) {
    this.tags = this.tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .slice(0, 10); // Limit to 10 tags
  }

  if (this.seo.keywords) {
    this.seo.keywords = this.seo.keywords
      .map(keyword => keyword.trim().toLowerCase())
      .filter(keyword => keyword.length > 0)
      .slice(0, 15); // Limit to 15 keywords
  }
});

// Instance method to generate slug
healthBlogPostSchema.methods.generateSlug = function (this: IHealthBlogPost): string {
  if (!this.title) return '';

  return this.title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Instance method to calculate read time
healthBlogPostSchema.methods.calculateReadTime = function (this: IHealthBlogPost): number {
  if (!this.content) return 1;

  // Remove HTML tags and count words
  const plainText = this.content.replace(/<[^>]*>/g, '');
  const wordCount = plainText.trim().split(/\s+/).length;

  // Average reading speed: 200-250 words per minute
  const wordsPerMinute = 225;
  const readTime = Math.ceil(wordCount / wordsPerMinute);

  return Math.max(1, readTime); // Minimum 1 minute
};

// Instance method to increment view count
healthBlogPostSchema.methods.incrementViewCount = async function (this: IHealthBlogPost): Promise<void> {
  const HealthBlogPost = this.constructor as mongoose.Model<IHealthBlogPost>;
  await HealthBlogPost.updateOne(
    { _id: this._id },
    { $inc: { viewCount: 1 } }
  );
  this.viewCount += 1;
};

// Instance method to get related posts
healthBlogPostSchema.methods.getRelatedPosts = async function (
  this: IHealthBlogPost,
  limit: number = 3
): Promise<IHealthBlogPost[]> {
  const HealthBlogPost = this.constructor as mongoose.Model<IHealthBlogPost>;

  // First try to get manually set related posts
  if (this.relatedPosts && this.relatedPosts.length > 0) {
    const relatedPosts = await HealthBlogPost.find({
      _id: { $in: this.relatedPosts },
      status: 'published',
      isDeleted: false,
    })
      .select('title slug excerpt featuredImage category readTime publishedAt viewCount')
      .limit(limit);

    if (relatedPosts.length >= limit) {
      return relatedPosts;
    }
  }

  // If not enough manual related posts, find by category and tags
  const query: any = {
    _id: { $ne: this._id },
    status: 'published',
    isDeleted: false,
    $or: [
      { category: this.category },
      { tags: { $in: this.tags } },
    ],
  };

  return await HealthBlogPost.find(query)
    .select('title slug excerpt featuredImage category readTime publishedAt viewCount')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Static method to find published posts
healthBlogPostSchema.statics.findPublished = function (
  options?: {
    category?: string;
    tags?: string[];
    featured?: boolean;
    limit?: number;
    skip?: number;
  }
) {
  const query: any = {
    status: 'published',
    isDeleted: false,
  };

  if (options?.category) {
    query.category = options.category;
  }

  if (options?.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  if (options?.featured !== undefined) {
    query.isFeatured = options.featured;
  }

  let queryBuilder = this.find(query)
    .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount isFeatured')
    .sort({ publishedAt: -1 });

  if (options?.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }

  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  return queryBuilder;
};

// Static method to search posts
healthBlogPostSchema.statics.searchPosts = function (
  searchQuery: string,
  options?: {
    category?: string;
    tags?: string[];
    limit?: number;
    skip?: number;
  }
) {
  const query: any = {
    status: 'published',
    isDeleted: false,
    $text: { $search: searchQuery },
  };

  if (options?.category) {
    query.category = options.category;
  }

  if (options?.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  let queryBuilder = this.find(query)
    .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount score')
    .sort({ score: { $meta: 'textScore' }, publishedAt: -1 });

  if (options?.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }

  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  return queryBuilder;
};

// Static method to ensure unique slug
healthBlogPostSchema.statics.ensureUniqueSlug = async function (
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

    const existingPost = await this.findOne(query);
    if (!existingPost) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

export default mongoose.model<IHealthBlogPost>('HealthBlogPost', healthBlogPostSchema);