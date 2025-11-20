/**
 * Health Blog Service - Public API
 * Handles public-facing blog functionality for the patient portal landing page
 * Requirements: 1.4, 1.5, 1.7
 */

import mongoose from 'mongoose';
import HealthBlogPost, { IHealthBlogPost } from '../models/HealthBlogPost';
import logger from '../utils/logger';
import { createNotFoundError, createValidationError } from '../utils/responseHelpers';

export interface BlogPostFilters {
  category?: string;
  tags?: string[];
  featured?: boolean;
  search?: string;
}

export interface PaginationOptions {
  limit?: number;
  skip?: number;
  page?: number;
}

export interface BlogPostSummary {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  featuredImage: {
    url: string;
    alt: string;
    caption?: string;
  };
  category: string;
  tags: string[];
  author: {
    name: string;
    avatar?: string;
  };
  readTime: number;
  publishedAt?: Date;
  viewCount: number;
  isFeatured: boolean;
  url: string;
  readTimeDisplay: string;
}

export interface BlogPostDetails extends BlogPostSummary {
  content: string;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords: string[];
  };
  relatedPosts: BlogPostSummary[];
  wordCount: number;
}

export interface BlogSearchResult {
  posts: BlogPostSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    categories: Array<{ category: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
  };
}

export class HealthBlogService {
  /**
   * Get published blog posts with pagination and filtering
   * Requirement: 1.4, 1.5
   */
  static async getPublishedPosts(
    filters: BlogPostFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<BlogSearchResult> {
    try {
      const page = pagination.page || 1;
      const limit = Math.min(pagination.limit || 12, 50); // Max 50 posts per page
      const skip = pagination.skip || (page - 1) * limit;

      // Build query for published posts
      const query: any = {
        status: 'published',
        isDeleted: false,
      };

      // Apply filters
      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (filters.featured !== undefined) {
        query.isFeatured = filters.featured;
      }

      // Handle search query
      let searchQuery = null;
      if (filters.search && filters.search.trim()) {
        searchQuery = filters.search.trim();
        query.$text = { $search: searchQuery };
      }

      // Execute main query
      let postsQuery = HealthBlogPost.find(query)
        .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount isFeatured')
        .sort(searchQuery ? { score: { $meta: 'textScore' }, publishedAt: -1 } : { publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const [posts, total] = await Promise.all([
        postsQuery.exec(),
        HealthBlogPost.countDocuments(query),
      ]);

      // Get filter aggregations (categories and tags)
      const [categoryAggregation, tagAggregation] = await Promise.all([
        this.getCategoryAggregation(),
        this.getTagAggregation(),
      ]);

      // Format posts
      const formattedPosts: BlogPostSummary[] = posts.map(post => ({
        _id: post._id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        featuredImage: post.featuredImage,
        category: post.category,
        tags: post.tags,
        author: post.author,
        readTime: post.readTime,
        publishedAt: post.publishedAt,
        viewCount: post.viewCount,
        isFeatured: post.isFeatured,
        url: `/blog/${post.slug}`,
        readTimeDisplay: `${post.readTime} min read`,
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        posts: formattedPosts,
        pagination: {
          total,
          page,
          limit,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: {
          categories: categoryAggregation,
          tags: tagAggregation,
        },
      };
    } catch (error) {
      logger.error('Error getting published posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Get a single blog post by slug
   * Requirement: 1.4, 1.5
   */
  static async getPostBySlug(slug: string): Promise<BlogPostDetails | null> {
    try {
      if (!slug || typeof slug !== 'string') {
        throw createValidationError('Valid slug is required');
      }

      const post = await HealthBlogPost.findOne({
        slug: slug.toLowerCase().trim(),
        status: 'published',
        isDeleted: false,
      }).lean();

      if (!post) {
        return null;
      }

      // Get related posts
      const relatedPosts = await this.getRelatedPostsByPost(post, 3);

      // Format the complete post
      const formattedPost: BlogPostDetails = {
        _id: post._id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        featuredImage: post.featuredImage,
        category: post.category,
        tags: post.tags,
        author: post.author,
        readTime: post.readTime,
        publishedAt: post.publishedAt,
        viewCount: post.viewCount,
        isFeatured: post.isFeatured,
        seo: post.seo,
        url: `/blog/${post.slug}`,
        readTimeDisplay: `${post.readTime} min read`,
        wordCount: this.calculateWordCount(post.content),
        relatedPosts,
      };

      return formattedPost;
    } catch (error) {
      logger.error('Error getting post by slug:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug,
      });
      throw error;
    }
  }

  /**
   * Get featured blog posts for landing page
   * Requirement: 1.4
   */
  static async getFeaturedPosts(limit: number = 3): Promise<BlogPostSummary[]> {
    try {
      const posts = await HealthBlogPost.find({
        status: 'published',
        isFeatured: true,
        isDeleted: false,
      })
        .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount isFeatured')
        .sort({ publishedAt: -1 })
        .limit(Math.min(limit, 10)) // Max 10 featured posts
        .lean();

      return posts.map(post => ({
        _id: post._id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        featuredImage: post.featuredImage,
        category: post.category,
        tags: post.tags,
        author: post.author,
        readTime: post.readTime,
        publishedAt: post.publishedAt,
        viewCount: post.viewCount,
        isFeatured: post.isFeatured,
        url: `/blog/${post.slug}`,
        readTimeDisplay: `${post.readTime} min read`,
      }));
    } catch (error) {
      logger.error('Error getting featured posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw error;
    }
  }

  /**
   * Get related posts for a specific post
   * Requirement: 1.5
   */
  static async getRelatedPosts(
    postId: mongoose.Types.ObjectId,
    limit: number = 3
  ): Promise<BlogPostSummary[]> {
    try {
      const post = await HealthBlogPost.findOne({
        _id: postId,
        status: 'published',
        isDeleted: false,
      });

      if (!post) {
        throw createNotFoundError('Blog post', postId.toString());
      }

      return await this.getRelatedPostsByPost(post, limit);
    } catch (error) {
      logger.error('Error getting related posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: postId.toString(),
        limit,
      });
      throw error;
    }
  }

  /**
   * Search blog posts with advanced filtering
   * Requirement: 1.7
   */
  static async searchPosts(
    searchQuery: string,
    filters: BlogPostFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<BlogSearchResult> {
    try {
      if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length < 2) {
        throw createValidationError('Search query must be at least 2 characters long');
      }

      return await this.getPublishedPosts(
        {
          ...filters,
          search: searchQuery.trim(),
        },
        pagination
      );
    } catch (error) {
      logger.error('Error searching posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        searchQuery,
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Increment view count for a blog post
   * Requirement: 1.7
   */
  static async incrementViewCount(postId: mongoose.Types.ObjectId): Promise<number> {
    try {
      const result = await HealthBlogPost.findOneAndUpdate(
        {
          _id: postId,
          status: 'published',
          isDeleted: false,
        },
        {
          $inc: { viewCount: 1 },
        },
        {
          new: true,
          select: 'viewCount',
        }
      );

      if (!result) {
        logger.warn('Attempted to increment view count for non-existent or unpublished post:', {
          postId: postId.toString(),
        });
        return 0;
      }

      return result.viewCount;
    } catch (error) {
      logger.error('Error incrementing view count:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: postId.toString(),
      });
      // Don't throw error for view count increment failures
      return 0;
    }
  }

  /**
   * Get blog categories with post counts
   */
  static async getCategories(): Promise<Array<{ category: string; count: number; label: string }>> {
    try {
      const categories = await this.getCategoryAggregation();

      // Add human-readable labels
      const categoryLabels: Record<string, string> = {
        nutrition: 'Nutrition & Diet',
        wellness: 'Wellness & Lifestyle',
        medication: 'Medication Management',
        chronic_diseases: 'Chronic Disease Management',
        preventive_care: 'Preventive Care',
        mental_health: 'Mental Health & Wellbeing',
      };

      return categories.map(cat => ({
        ...cat,
        label: categoryLabels[cat.category] || cat.category,
      }));
    } catch (error) {
      logger.error('Error getting categories:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get popular blog posts (by view count)
   */
  static async getPopularPosts(limit: number = 5): Promise<BlogPostSummary[]> {
    try {
      const posts = await HealthBlogPost.find({
        status: 'published',
        isDeleted: false,
      })
        .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount isFeatured')
        .sort({ viewCount: -1, publishedAt: -1 })
        .limit(Math.min(limit, 10)) // Max 10 popular posts
        .lean();

      return posts.map(post => ({
        _id: post._id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        featuredImage: post.featuredImage,
        category: post.category,
        tags: post.tags,
        author: post.author,
        readTime: post.readTime,
        publishedAt: post.publishedAt,
        viewCount: post.viewCount,
        isFeatured: post.isFeatured,
        url: `/blog/${post.slug}`,
        readTimeDisplay: `${post.readTime} min read`,
      }));
    } catch (error) {
      logger.error('Error getting popular posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw error;
    }
  }

  /**
   * Get recent blog posts
   */
  static async getRecentPosts(limit: number = 6): Promise<BlogPostSummary[]> {
    try {
      const posts = await HealthBlogPost.find({
        status: 'published',
        isDeleted: false,
      })
        .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount isFeatured')
        .sort({ publishedAt: -1 })
        .limit(Math.min(limit, 20)) // Max 20 recent posts
        .lean();

      return posts.map(post => ({
        _id: post._id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        featuredImage: post.featuredImage,
        category: post.category,
        tags: post.tags,
        author: post.author,
        readTime: post.readTime,
        publishedAt: post.publishedAt,
        viewCount: post.viewCount,
        isFeatured: post.isFeatured,
        url: `/blog/${post.slug}`,
        readTimeDisplay: `${post.readTime} min read`,
      }));
    } catch (error) {
      logger.error('Error getting recent posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw error;
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Get category aggregation with post counts
   */
  private static async getCategoryAggregation(): Promise<Array<{ category: string; count: number }>> {
    try {
      const aggregation = await HealthBlogPost.aggregate([
        {
          $match: {
            status: 'published',
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            _id: 0,
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return aggregation;
    } catch (error) {
      logger.error('Error getting category aggregation:', error);
      return [];
    }
  }

  /**
   * Get tag aggregation with post counts
   */
  private static async getTagAggregation(): Promise<Array<{ tag: string; count: number }>> {
    try {
      const aggregation = await HealthBlogPost.aggregate([
        {
          $match: {
            status: 'published',
            isDeleted: false,
          },
        },
        {
          $unwind: '$tags',
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            tag: '$_id',
            count: 1,
            _id: 0,
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 20, // Top 20 tags
        },
      ]);

      return aggregation;
    } catch (error) {
      logger.error('Error getting tag aggregation:', error);
      return [];
    }
  }

  /**
   * Get related posts for a given post
   */
  private static async getRelatedPostsByPost(
    post: IHealthBlogPost,
    limit: number
  ): Promise<BlogPostSummary[]> {
    try {
      // First try to get manually set related posts
      if (post.relatedPosts && post.relatedPosts.length > 0) {
        const relatedPosts = await HealthBlogPost.find({
          _id: { $in: post.relatedPosts },
          status: 'published',
          isDeleted: false,
        })
          .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount isFeatured')
          .limit(limit)
          .lean();

        if (relatedPosts.length >= limit) {
          return relatedPosts.map(relatedPost => ({
            _id: relatedPost._id,
            title: relatedPost.title,
            slug: relatedPost.slug,
            excerpt: relatedPost.excerpt,
            featuredImage: relatedPost.featuredImage,
            category: relatedPost.category,
            tags: relatedPost.tags,
            author: relatedPost.author,
            readTime: relatedPost.readTime,
            publishedAt: relatedPost.publishedAt,
            viewCount: relatedPost.viewCount,
            isFeatured: relatedPost.isFeatured,
            url: `/blog/${relatedPost.slug}`,
            readTimeDisplay: `${relatedPost.readTime} min read`,
          }));
        }
      }

      // If not enough manual related posts, find by category and tags
      const query: any = {
        _id: { $ne: post._id },
        status: 'published',
        isDeleted: false,
        $or: [
          { category: post.category },
          { tags: { $in: post.tags } },
        ],
      };

      const relatedPosts = await HealthBlogPost.find(query)
        .select('title slug excerpt featuredImage category tags author readTime publishedAt viewCount isFeatured')
        .sort({ publishedAt: -1 })
        .limit(limit)
        .lean();

      return relatedPosts.map(relatedPost => ({
        _id: relatedPost._id,
        title: relatedPost.title,
        slug: relatedPost.slug,
        excerpt: relatedPost.excerpt,
        featuredImage: relatedPost.featuredImage,
        category: relatedPost.category,
        tags: relatedPost.tags,
        author: relatedPost.author,
        readTime: relatedPost.readTime,
        publishedAt: relatedPost.publishedAt,
        viewCount: relatedPost.viewCount,
        isFeatured: relatedPost.isFeatured,
        url: `/blog/${relatedPost.slug}`,
        readTimeDisplay: `${relatedPost.readTime} min read`,
      }));
    } catch (error) {
      logger.error('Error getting related posts by post:', error);
      return [];
    }
  }

  /**
   * Get all available blog tags with post counts
   * Requirement: 1.7
   */
  static async getTags(limit: number = 20): Promise<Array<{ _id: string; count: number }>> {
    try {
      const tags = await HealthBlogPost.aggregate([
        {
          $match: {
            status: 'published',
            isDeleted: false,
          },
        },
        {
          $unwind: '$tags',
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1, _id: 1 },
        },
        {
          $limit: Math.min(limit, 100), // Max 100 tags
        },
      ]);

      logger.info('Blog tags retrieved successfully', {
        limit,
        resultCount: tags.length,
      });

      return tags;
    } catch (error) {
      logger.error('Error getting blog tags:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw error;
    }
  }

  /**
   * Calculate word count from HTML content
   */
  private static calculateWordCount(content: string): number {
    if (!content) return 0;

    // Remove HTML tags and count words
    const plainText = content.replace(/<[^>]*>/g, '');
    return plainText.trim().split(/\s+/).length;
  }
}

export default HealthBlogService;