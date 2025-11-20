import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpSearchAnalytics extends Document {
  // Search query information
  query: string;
  normalizedQuery: string; // Lowercase, trimmed version for analysis

  // User information
  userId?: mongoose.Types.ObjectId;
  userRole?: string;
  sessionId?: string;

  // Search context
  category?: string;
  contentType?: 'all' | 'articles' | 'faqs' | 'videos';
  filters?: {
    difficulty?: string;
    tags?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };

  // Results information
  resultsCount: number;
  hasResults: boolean;
  topResultId?: mongoose.Types.ObjectId;
  topResultType?: 'article' | 'faq' | 'video';
  topResultTitle?: string;

  // User interaction
  clickedResults: Array<{
    resultId: mongoose.Types.ObjectId;
    resultType: 'article' | 'faq' | 'video';
    resultTitle: string;
    position: number; // Position in search results (1-based)
    clickedAt: Date;
  }>;

  // Search performance
  searchDurationMs: number;

  // Metadata
  userAgent?: string;
  ipAddress?: string;
  referer?: string;

  // Analytics flags
  isSuccessful: boolean; // Did user find what they were looking for?
  wasHelpful?: boolean; // User feedback on search results

  createdAt: Date;
  updatedAt: Date;
}

const helpSearchAnalyticsSchema = new Schema<IHelpSearchAnalytics>(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userRole: {
      type: String,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ['all', 'articles', 'faqs', 'videos'],
      default: 'all',
      index: true,
    },
    filters: {
      difficulty: String,
      tags: [String],
      dateRange: {
        start: Date,
        end: Date,
      },
    },
    resultsCount: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    hasResults: {
      type: Boolean,
      required: true,
      index: true,
    },
    topResultId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    topResultType: {
      type: String,
      enum: ['article', 'faq', 'video'],
    },
    topResultTitle: {
      type: String,
      trim: true,
    },
    clickedResults: [{
      resultId: {
        type: Schema.Types.ObjectId,
        required: true,
      },
      resultType: {
        type: String,
        enum: ['article', 'faq', 'video'],
        required: true,
      },
      resultTitle: {
        type: String,
        required: true,
        trim: true,
      },
      position: {
        type: Number,
        required: true,
        min: 1,
      },
      clickedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    searchDurationMs: {
      type: Number,
      required: true,
      min: 0,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    referer: {
      type: String,
      trim: true,
    },
    isSuccessful: {
      type: Boolean,
      default: false,
      index: true,
    },
    wasHelpful: {
      type: Boolean,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'helpsearchanalytics',
  }
);

// Indexes for analytics queries
helpSearchAnalyticsSchema.index({ createdAt: -1 });
helpSearchAnalyticsSchema.index({ normalizedQuery: 1, createdAt: -1 });
helpSearchAnalyticsSchema.index({ hasResults: 1, createdAt: -1 });
helpSearchAnalyticsSchema.index({ isSuccessful: 1, createdAt: -1 });
helpSearchAnalyticsSchema.index({ userRole: 1, createdAt: -1 });
helpSearchAnalyticsSchema.index({ contentType: 1, createdAt: -1 });

// TTL index to automatically delete old records (after 2 years)
helpSearchAnalyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Pre-save middleware
helpSearchAnalyticsSchema.pre('save', function (next) {
  // Normalize query for analysis
  if (this.isModified('query')) {
    this.normalizedQuery = this.query.toLowerCase().trim();
  }

  // Determine if search was successful based on clicks
  if (this.clickedResults && this.clickedResults.length > 0) {
    this.isSuccessful = true;
  }

  next();
});

// Methods
helpSearchAnalyticsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Add clicked result
helpSearchAnalyticsSchema.methods.addClickedResult = function (
  resultId: mongoose.Types.ObjectId,
  resultType: 'article' | 'faq' | 'video',
  resultTitle: string,
  position: number
): Promise<IHelpSearchAnalytics> {
  this.clickedResults.push({
    resultId,
    resultType,
    resultTitle,
    position,
    clickedAt: new Date(),
  });
  this.isSuccessful = true;
  return this.save();
};

// Mark as helpful/not helpful
helpSearchAnalyticsSchema.methods.setHelpfulness = function (wasHelpful: boolean): Promise<IHelpSearchAnalytics> {
  this.wasHelpful = wasHelpful;
  return this.save();
};

// Static methods for analytics
helpSearchAnalyticsSchema.statics.getPopularQueries = async function (
  limit: number = 10,
  dateRange?: { start: Date; end: Date }
): Promise<Array<{ query: string; count: number; successRate: number }>> {
  const matchStage: any = {};

  if (dateRange) {
    matchStage.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$normalizedQuery',
        count: { $sum: 1 },
        successfulSearches: {
          $sum: { $cond: ['$isSuccessful', 1, 0] }
        },
        originalQuery: { $first: '$query' },
      },
    },
    {
      $project: {
        query: '$originalQuery',
        count: 1,
        successRate: {
          $multiply: [
            { $divide: ['$successfulSearches', '$count'] },
            100
          ]
        },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
};

helpSearchAnalyticsSchema.statics.getSearchTrends = async function (
  dateRange: { start: Date; end: Date },
  interval: 'day' | 'week' | 'month' = 'day'
): Promise<Array<{ date: Date; searches: number; successfulSearches: number }>> {
  const groupFormat = interval === 'day' ? '%Y-%m-%d' :
    interval === 'week' ? '%Y-%U' : '%Y-%m';

  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: dateRange.start,
          $lte: dateRange.end,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupFormat,
            date: '$createdAt',
          },
        },
        searches: { $sum: 1 },
        successfulSearches: {
          $sum: { $cond: ['$isSuccessful', 1, 0] }
        },
      },
    },
    {
      $project: {
        date: '$_id',
        searches: 1,
        successfulSearches: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);
};

helpSearchAnalyticsSchema.statics.getZeroResultQueries = async function (
  limit: number = 20,
  dateRange?: { start: Date; end: Date }
): Promise<Array<{ query: string; count: number; lastSearched: Date }>> {
  const matchStage: any = { hasResults: false };

  if (dateRange) {
    matchStage.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$normalizedQuery',
        count: { $sum: 1 },
        lastSearched: { $max: '$createdAt' },
        originalQuery: { $first: '$query' },
      },
    },
    {
      $project: {
        query: '$originalQuery',
        count: 1,
        lastSearched: 1,
      },
    },
    { $sort: { count: -1, lastSearched: -1 } },
    { $limit: limit },
  ]);
};

// Add interface for static methods
interface IHelpSearchAnalyticsModel extends mongoose.Model<IHelpSearchAnalytics> {
  getPopularQueries(limit?: number, dateRange?: { start: Date; end: Date }): Promise<Array<{ query: string; count: number; successRate: number }>>;
  getSearchTrends(dateRange: { start: Date; end: Date }, interval?: 'day' | 'week' | 'month'): Promise<Array<{ date: Date; searches: number; successfulSearches: number }>>;
  getZeroResultQueries(limit?: number, dateRange?: { start: Date; end: Date }): Promise<Array<{ query: string; count: number; lastSearched: Date }>>;
}

export const HelpSearchAnalytics = mongoose.model<IHelpSearchAnalytics, IHelpSearchAnalyticsModel>('HelpSearchAnalytics', helpSearchAnalyticsSchema);
export default HelpSearchAnalytics;