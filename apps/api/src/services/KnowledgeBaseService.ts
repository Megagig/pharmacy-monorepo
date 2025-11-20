import mongoose from 'mongoose';
import { KnowledgeBaseArticle, IKnowledgeBaseArticle } from '../models/KnowledgeBaseArticle';
import { RedisCacheService } from './RedisCacheService';
import logger from '../utils/logger';

export interface ArticleFilters {
  status?: string[];
  category?: string;
  subcategory?: string;
  tags?: string[];
  authorId?: string;
  isPublic?: boolean;
  search?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ArticlePagination {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedArticles {
  articles: IKnowledgeBaseArticle[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface KnowledgeBaseMetrics {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalViews: number;
  averageHelpfulnessScore: number;
  articlesByCategory: { category: string; count: number }[];
  topViewedArticles: { title: string; viewCount: number; slug: string }[];
  recentlyUpdated: { title: string; updatedAt: Date; slug: string }[];
}

export interface SearchResult {
  articles: IKnowledgeBaseArticle[];
  totalCount: number;
  searchTime: number;
  suggestions?: string[];
}

/**
 * KnowledgeBaseService - Handles knowledge base article management
 * Provides article creation, search, categorization, and analytics
 */
export class KnowledgeBaseService {
  private static instance: KnowledgeBaseService;
  private cacheService: RedisCacheService;
  private readonly CACHE_TTL = 10 * 60; // 10 minutes

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
  }

  public static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
    }
    return KnowledgeBaseService.instance;
  }

  /**
   * Create a new knowledge base article
   */
  async createArticle(articleData: {
    title: string;
    content: string;
    excerpt: string;
    category: string;
    subcategory?: string;
    tags?: string[];
    authorId: string;
    status?: 'draft' | 'published';
    isPublic?: boolean;
    metaDescription?: string;
    searchKeywords?: string[];
    scheduledPublishAt?: Date;
  }): Promise<IKnowledgeBaseArticle> {
    try {
      // Generate slug from title
      const slug = this.generateSlug(articleData.title);

      // Check if slug already exists
      const existingArticle = await KnowledgeBaseArticle.findOne({ slug });
      if (existingArticle) {
        throw new Error('An article with this title already exists');
      }

      // Get author information
      const User = mongoose.model('User');
      const author = await User.findById(articleData.authorId);
      if (!author) {
        throw new Error('Author not found');
      }

      const article = new KnowledgeBaseArticle({
        title: articleData.title,
        slug,
        content: articleData.content,
        excerpt: articleData.excerpt,
        category: articleData.category,
        subcategory: articleData.subcategory,
        tags: articleData.tags || [],
        authorId: articleData.authorId,
        authorName: `${author.firstName} ${author.lastName}`,
        status: articleData.status || 'draft',
        isPublic: articleData.isPublic !== false, // Default to true
        metaDescription: articleData.metaDescription,
        searchKeywords: articleData.searchKeywords || [],
        scheduledPublishAt: articleData.scheduledPublishAt
      });

      await article.save();

      // Clear cache
      await this.clearArticleCache();

      logger.info('Knowledge base article created', {
        articleId: article._id,
        title: article.title,
        authorId: articleData.authorId,
        status: article.status
      });

      return article;
    } catch (error) {
      logger.error('Error creating knowledge base article:', error);
      throw new Error('Failed to create knowledge base article');
    }
  }

  /**
   * Get articles with filtering and pagination
   */
  async getArticles(filters: ArticleFilters, pagination: ArticlePagination): Promise<PaginatedArticles> {
    try {
      const cacheKey = `kb:articles:${JSON.stringify(filters)}:${JSON.stringify(pagination)}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      // Build query
      const query = this.buildArticleQuery(filters);

      // Build sort
      const sort: any = {};
      if (pagination.sortBy) {
        sort[pagination.sortBy] = pagination.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.publishedAt = -1; // Default sort by newest published first
        sort.createdAt = -1;
      }

      // Execute query with pagination
      const skip = (pagination.page - 1) * pagination.limit;

      const [articles, totalCount] = await Promise.all([
        KnowledgeBaseArticle.find(query)
          .sort(sort)
          .skip(skip)
          .limit(pagination.limit)
          .populate('authorId', 'firstName lastName email')
          .lean(),
        KnowledgeBaseArticle.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / pagination.limit);

      const result = {
        articles: articles as IKnowledgeBaseArticle[],
        pagination: {
          currentPage: pagination.page,
          totalPages,
          totalCount,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1
        }
      };

      // Cache result
      await this.cacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

      return result;
    } catch (error) {
      logger.error('Error fetching articles:', error);
      throw new Error('Failed to fetch articles');
    }
  }

  /**
   * Get article by ID or slug
   */
  async getArticle(identifier: string, incrementView: boolean = false): Promise<IKnowledgeBaseArticle | null> {
    try {
      const cacheKey = `kb:article:${identifier}`;

      // Try cache first (only if not incrementing view)
      if (!incrementView) {
        const cached = await this.cacheService.get(cacheKey);
        if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
          return cached as any;
        }
      }

      // Determine if identifier is ObjectId or slug
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      const query = isObjectId ? { _id: identifier } : { slug: identifier };

      const article = await KnowledgeBaseArticle.findOne(query)
        .populate('authorId', 'firstName lastName email')
        .populate('relatedArticles', 'title slug excerpt category');

      if (article && incrementView) {
        // Increment view count
        await (article as any).incrementViewCount();
        // Clear cache after view increment
        await this.cacheService.del(cacheKey);
      } else if (article) {
        // Cache the result
        await this.cacheService.set(cacheKey, article, { ttl: this.CACHE_TTL });
      }

      return article;
    } catch (error) {
      logger.error('Error fetching article:', error);
      throw new Error('Failed to fetch article');
    }
  }

  /**
   * Update article
   */
  async updateArticle(
    articleId: string,
    updates: Partial<IKnowledgeBaseArticle>,
    updatedById: string
  ): Promise<IKnowledgeBaseArticle> {
    try {
      const article = await KnowledgeBaseArticle.findById(articleId);
      if (!article) {
        throw new Error('Article not found');
      }

      // Update fields
      Object.assign(article, updates);

      // Set edit tracking
      article.lastEditedBy = new mongoose.Types.ObjectId(updatedById);
      article.lastEditedAt = new Date();

      // If slug is being updated, check for conflicts
      if (updates.slug && updates.slug !== article.slug) {
        const existingArticle = await KnowledgeBaseArticle.findOne({
          slug: updates.slug,
          _id: { $ne: articleId }
        });
        if (existingArticle) {
          throw new Error('An article with this slug already exists');
        }
      }

      await article.save();

      // Clear cache
      await this.clearArticleCache();

      logger.info('Knowledge base article updated', {
        articleId,
        updatedBy: updatedById,
        updatedFields: Object.keys(updates)
      });

      return article;
    } catch (error) {
      logger.error('Error updating article:', error);
      throw new Error('Failed to update article');
    }
  }

  /**
   * Delete article
   */
  async deleteArticle(articleId: string, deletedById: string): Promise<void> {
    try {
      const article = await KnowledgeBaseArticle.findById(articleId);
      if (!article) {
        throw new Error('Article not found');
      }

      await KnowledgeBaseArticle.deleteOne({ _id: articleId });

      // Remove from related articles
      await KnowledgeBaseArticle.updateMany(
        { relatedArticles: articleId },
        { $pull: { relatedArticles: articleId } }
      );

      // Clear cache
      await this.clearArticleCache();

      logger.info('Knowledge base article deleted', {
        articleId,
        title: article.title,
        deletedBy: deletedById
      });
    } catch (error) {
      logger.error('Error deleting article:', error);
      throw new Error('Failed to delete article');
    }
  }

  /**
   * Search articles with full-text search
   */
  async searchArticles(
    searchQuery: string,
    filters?: Partial<ArticleFilters>,
    pagination?: Partial<ArticlePagination>
  ): Promise<SearchResult> {
    try {
      const startTime = Date.now();

      // Build search query
      const query: any = {
        $text: { $search: searchQuery },
        status: 'published',
        isPublic: true,
        ...this.buildArticleQuery(filters || {})
      };

      // Pagination
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const skip = (page - 1) * limit;

      // Execute search
      const [articles, totalCount] = await Promise.all([
        KnowledgeBaseArticle.find(query, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' }, viewCount: -1 })
          .skip(skip)
          .limit(limit)
          .populate('authorId', 'firstName lastName')
          .lean(),
        KnowledgeBaseArticle.countDocuments(query)
      ]);

      const searchTime = Date.now() - startTime;

      // Generate search suggestions if no results
      let suggestions: string[] = [];
      if (articles.length === 0) {
        suggestions = await this.generateSearchSuggestions(searchQuery);
      }

      logger.info('Knowledge base search performed', {
        query: searchQuery,
        resultsCount: articles.length,
        searchTime
      });

      return {
        articles: articles as IKnowledgeBaseArticle[],
        totalCount,
        searchTime,
        suggestions
      };
    } catch (error) {
      logger.error('Error searching articles:', error);
      throw new Error('Failed to search articles');
    }
  }

  /**
   * Get article categories
   */
  async getCategories(): Promise<{ category: string; subcategories: string[]; count: number }[]> {
    try {
      const cacheKey = 'kb:categories';

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const result = await KnowledgeBaseArticle.aggregate([
        { $match: { status: 'published', isPublic: true } },
        {
          $group: {
            _id: {
              category: '$category',
              subcategory: '$subcategory'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.category',
            subcategories: {
              $push: {
                $cond: [
                  { $ne: ['$_id.subcategory', null] },
                  '$_id.subcategory',
                  '$$REMOVE'
                ]
              }
            },
            count: { $sum: '$count' }
          }
        },
        {
          $project: {
            category: '$_id',
            subcategories: 1,
            count: 1,
            _id: 0
          }
        },
        { $sort: { category: 1 } }
      ]);

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, result, { ttl: 3600 });

      return result;
    } catch (error) {
      logger.error('Error fetching categories:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Get popular tags
   */
  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    try {
      const cacheKey = `kb:tags:${limit}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const result = await KnowledgeBaseArticle.aggregate([
        { $match: { status: 'published', isPublic: true } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $project: { tag: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, result, { ttl: 3600 });

      return result;
    } catch (error) {
      logger.error('Error fetching popular tags:', error);
      throw new Error('Failed to fetch popular tags');
    }
  }

  /**
   * Get knowledge base metrics
   */
  async getKnowledgeBaseMetrics(): Promise<KnowledgeBaseMetrics> {
    try {
      const cacheKey = 'kb:metrics';

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      // Parallel execution of metric calculations
      const [
        totalArticles,
        publishedArticles,
        draftArticles,
        totalViews,
        avgHelpfulness,
        categoryStats,
        topViewed,
        recentlyUpdated
      ] = await Promise.all([
        KnowledgeBaseArticle.countDocuments(),
        KnowledgeBaseArticle.countDocuments({ status: 'published' }),
        KnowledgeBaseArticle.countDocuments({ status: 'draft' }),
        this.getTotalViews(),
        this.getAverageHelpfulnessScore(),
        this.getArticlesByCategory(),
        this.getTopViewedArticles(5),
        this.getRecentlyUpdatedArticles(5)
      ]);

      const metrics: KnowledgeBaseMetrics = {
        totalArticles,
        publishedArticles,
        draftArticles,
        totalViews,
        averageHelpfulnessScore: avgHelpfulness,
        articlesByCategory: categoryStats,
        topViewedArticles: topViewed,
        recentlyUpdated
      };

      // Cache for 15 minutes
      await this.cacheService.set(cacheKey, metrics, { ttl: 900 });

      return metrics;
    } catch (error) {
      logger.error('Error calculating knowledge base metrics:', error);
      throw new Error('Failed to calculate knowledge base metrics');
    }
  }

  /**
   * Vote on article helpfulness
   */
  async voteOnArticle(articleId: string, isHelpful: boolean): Promise<IKnowledgeBaseArticle> {
    try {
      const article = await KnowledgeBaseArticle.findById(articleId);
      if (!article) {
        throw new Error('Article not found');
      }

      if (isHelpful) {
        article.helpfulVotes += 1;
      } else {
        article.notHelpfulVotes += 1;
      }

      await article.save();

      // Clear cache
      await this.clearArticleCache();

      logger.info('Article vote recorded', {
        articleId,
        isHelpful,
        helpfulVotes: article.helpfulVotes,
        notHelpfulVotes: article.notHelpfulVotes
      });

      return article;
    } catch (error) {
      logger.error('Error voting on article:', error);
      throw new Error('Failed to vote on article');
    }
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(articleId: string, limit: number = 5): Promise<IKnowledgeBaseArticle[]> {
    try {
      const article = await KnowledgeBaseArticle.findById(articleId);
      if (!article) {
        throw new Error('Article not found');
      }

      // Find related articles based on category, tags, and keywords
      const relatedArticles = await KnowledgeBaseArticle.find({
        _id: { $ne: articleId },
        status: 'published',
        isPublic: true,
        $or: [
          { category: article.category },
          { tags: { $in: article.tags } },
          { searchKeywords: { $in: article.searchKeywords } }
        ]
      })
        .sort({ viewCount: -1, publishedAt: -1 })
        .limit(limit)
        .select('title slug excerpt category viewCount publishedAt');

      return relatedArticles;
    } catch (error) {
      logger.error('Error fetching related articles:', error);
      throw new Error('Failed to fetch related articles');
    }
  }

  // Private helper methods

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private buildArticleQuery(filters: ArticleFilters): any {
    const query: any = {};

    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.subcategory) {
      query.subcategory = filters.subcategory;
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.authorId) {
      query.authorId = filters.authorId;
    }

    if (filters.isPublic !== undefined) {
      query.isPublic = filters.isPublic;
    }

    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.startDate,
        $lte: filters.dateRange.endDate
      };
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    return query;
  }

  private async getTotalViews(): Promise<number> {
    const result = await KnowledgeBaseArticle.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
    ]);
    return result.length > 0 ? result[0].totalViews : 0;
  }

  private async getAverageHelpfulnessScore(): Promise<number> {
    const result = await KnowledgeBaseArticle.aggregate([
      {
        $match: {
          $or: [
            { helpfulVotes: { $gt: 0 } },
            { notHelpfulVotes: { $gt: 0 } }
          ]
        }
      },
      {
        $project: {
          helpfulnessScore: {
            $multiply: [
              {
                $divide: [
                  '$helpfulVotes',
                  { $add: ['$helpfulVotes', '$notHelpfulVotes'] }
                ]
              },
              100
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgHelpfulness: { $avg: '$helpfulnessScore' }
        }
      }
    ]);

    return result.length > 0 ? Math.round(result[0].avgHelpfulness) : 0;
  }

  private async getArticlesByCategory(): Promise<{ category: string; count: number }[]> {
    return await KnowledgeBaseArticle.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);
  }

  private async getTopViewedArticles(limit: number): Promise<{ title: string; viewCount: number; slug: string }[]> {
    return await KnowledgeBaseArticle.find(
      { status: 'published', isPublic: true },
      { title: 1, viewCount: 1, slug: 1 }
    )
      .sort({ viewCount: -1 })
      .limit(limit)
      .lean();
  }

  private async getRecentlyUpdatedArticles(limit: number): Promise<{ title: string; updatedAt: Date; slug: string }[]> {
    return await KnowledgeBaseArticle.find(
      { status: 'published', isPublic: true },
      { title: 1, updatedAt: 1, slug: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  private async generateSearchSuggestions(query: string): Promise<string[]> {
    // Simple suggestion generation based on popular tags and categories
    const [tags, categories] = await Promise.all([
      this.getPopularTags(10),
      this.getCategories()
    ]);

    const suggestions: string[] = [];

    // Add similar tags
    tags.forEach(tag => {
      if (tag.tag.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(tag.tag.toLowerCase())) {
        suggestions.push(tag.tag);
      }
    });

    // Add similar categories
    categories.forEach(cat => {
      if (cat.category.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(cat.category.toLowerCase())) {
        suggestions.push(cat.category);
      }
    });

    return suggestions.slice(0, 5);
  }

  private async clearArticleCache(): Promise<void> {
    try {
      await this.cacheService.delPattern('kb:*');
    } catch (error) {
      logger.error('Error clearing article cache:', error);
    }
  }
}

export default KnowledgeBaseService;