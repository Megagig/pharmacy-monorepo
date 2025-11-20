/**
 * Health Blog Controller - Public API
 * Handles public-facing blog endpoints for the patient portal landing page
 * Requirements: 1.4, 1.5, 1.6, 1.7
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import HealthBlogService, { BlogPostFilters, PaginationOptions } from '../services/HealthBlogService';
import logger from '../utils/logger';
import { sendSuccess, sendError, asyncHandler } from '../utils/responseHelpers';

export class HealthBlogController {
  /**
   * Get published blog posts with query parameters
   * GET /api/public/blog/posts
   * Requirements: 1.4, 1.5
   */
  static getPublishedPosts = asyncHandler(async (req: Request, res: Response) => {
    // Parse query parameters
    const filters: BlogPostFilters = {
      category: req.query.category as string,
      tags: req.query.tags ?
        (Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string]) :
        undefined,
      featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      search: req.query.search as string,
    };

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;

    // Validate pagination parameters
    if (page < 1) {
      sendError(res, 'VALIDATION_ERROR', 'Page number must be greater than 0', 400);
      return;
    }

    if (limit < 1 || limit > 50) {
      sendError(res, 'VALIDATION_ERROR', 'Limit must be between 1 and 50', 400);
      return;
    }

    const pagination: PaginationOptions = { page, limit };

    const result = await HealthBlogService.getPublishedPosts(filters, pagination);

    logger.info('Blog posts retrieved successfully', {
      filters,
      pagination,
      resultCount: result.posts.length,
      total: result.pagination.total,
    });

    sendSuccess(res, result, 'Blog posts retrieved successfully');
  });

  /**
   * Get a single blog post by slug
   * GET /api/public/blog/posts/:slug
   * Requirements: 1.4, 1.5
   */
  static getPostBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      sendError(res, 'VALIDATION_ERROR', 'Valid slug is required', 400);
      return;
    }

    const post = await HealthBlogService.getPostBySlug(slug);

    if (!post) {
      sendError(res, 'NOT_FOUND', 'Blog post not found', 404);
      return;
    }

    logger.info('Blog post retrieved by slug', {
      slug,
      postId: post._id.toString(),
      title: post.title,
    });

    sendSuccess(res, post, 'Blog post retrieved successfully');
  });

  /**
   * Get featured blog posts for landing page
   * GET /api/public/blog/featured
   * Requirements: 1.4
   */
  static getFeaturedPosts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 3;

      if (limit < 1 || limit > 10) {
        sendError(res, 'VALIDATION_ERROR', 'Limit must be between 1 and 10', 400);
        return;
      }

      const posts = await HealthBlogService.getFeaturedPosts(limit);

      logger.info('Featured blog posts retrieved', {
        limit,
        resultCount: posts.length,
      });

      sendSuccess(res, posts, 'Featured blog posts retrieved successfully');
    } catch (error) {
      logger.error('Error getting featured blog posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit: req.query.limit,
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve featured blog posts', 500);
    }
  });

  /**
   * Get related posts for a specific post
   * GET /api/public/blog/posts/:slug/related
   * Requirements: 1.5
   */
  static getRelatedPosts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const limit = parseInt(req.query.limit as string) || 3;

      if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
        sendError(res, 'VALIDATION_ERROR', 'Valid slug is required', 400);
        return;
      }

      if (limit < 1 || limit > 10) {
        sendError(res, 'VALIDATION_ERROR', 'Limit must be between 1 and 10', 400);
        return;
      }

      // First, get the post to find its ID
      const post = await HealthBlogService.getPostBySlug(slug);

      if (!post) {
        sendError(res, 'NOT_FOUND', 'Blog post not found', 404);
        return;
      }

      const relatedPosts = await HealthBlogService.getRelatedPosts(post._id, limit);

      logger.info('Related blog posts retrieved', {
        slug,
        postId: post._id.toString(),
        limit,
        resultCount: relatedPosts.length,
      });

      sendSuccess(res, relatedPosts, 'Related blog posts retrieved successfully');
    } catch (error) {
      logger.error('Error getting related blog posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug: req.params.slug,
        limit: req.query.limit,
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve related blog posts', 500);
    }
  });

  /**
   * Get blog categories with post counts
   * GET /api/public/blog/categories
   * Requirements: 1.7
   */
  static getCategories = asyncHandler(async (req: Request, res: Response) => {
    try {
      const categories = await HealthBlogService.getCategories();

      logger.info('Blog categories retrieved', {
        categoryCount: categories.length,
      });

      sendSuccess(res, categories, 'Blog categories retrieved successfully');
    } catch (error) {
      logger.error('Error getting blog categories:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve blog categories', 500);
    }
  });

  /**
   * Get all available blog tags with post counts
   * GET /api/public/blog/tags
   * Requirements: 1.7
   */
  static getTags = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      // Validate limit
      if (limit < 1 || limit > 100) {
        sendError(res, 'VALIDATION_ERROR', 'Limit must be between 1 and 100', 400);
        return;
      }

      const tags = await HealthBlogService.getTags(limit);

      logger.info('Blog tags retrieved successfully', {
        limit,
        resultCount: tags.length,
      });

      sendSuccess(res, tags, 'Blog tags retrieved successfully');
    } catch (error: any) {
      logger.error('Error retrieving blog tags', { error: error.message });
      sendError(res, 'SERVER_ERROR', 'Error retrieving blog tags', 500);
    }
  });

  /**
   * Get popular blog posts by view count
   * GET /api/public/blog/popular
   * Requirements: 1.7
   */
  static getPopularPosts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;

      if (limit < 1 || limit > 10) {
        sendError(res, 'VALIDATION_ERROR', 'Limit must be between 1 and 10', 400);
        return;
      }

      const posts = await HealthBlogService.getPopularPosts(limit);

      logger.info('Popular blog posts retrieved', {
        limit,
        resultCount: posts.length,
      });

      sendSuccess(res, { posts }, 'Popular blog posts retrieved successfully');
    } catch (error) {
      logger.error('Error getting popular blog posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit: req.query.limit,
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve popular blog posts', 500);
    }
  });

  /**
   * Get recent blog posts
   * GET /api/public/blog/recent
   * Requirements: 1.7
   */
  static getRecentPosts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;

      if (limit < 1 || limit > 20) {
        sendError(res, 'VALIDATION_ERROR', 'Limit must be between 1 and 20', 400);
        return;
      }

      const posts = await HealthBlogService.getRecentPosts(limit);

      logger.info('Recent blog posts retrieved', {
        limit,
        resultCount: posts.length,
      });

      sendSuccess(res, { posts }, 'Recent blog posts retrieved successfully');
    } catch (error) {
      logger.error('Error getting recent blog posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit: req.query.limit,
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve recent blog posts', 500);
    }
  });

  /**
   * Increment view count for a blog post
   * POST /api/public/blog/posts/:slug/view
   * Requirements: 1.7
   */
  static incrementViewCount = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
        sendError(res, 'VALIDATION_ERROR', 'Valid slug is required', 400);
        return;
      }

      // First, get the post to find its ID
      const post = await HealthBlogService.getPostBySlug(slug);

      if (!post) {
        sendError(res, 'NOT_FOUND', 'Blog post not found', 404);
        return;
      }

      // Increment view count (this method doesn't throw errors for view count failures)
      const viewCount = await HealthBlogService.incrementViewCount(post._id);

      logger.info('Blog post view count incremented', {
        slug,
        postId: post._id.toString(),
        title: post.title,
        newViewCount: viewCount,
      });

      sendSuccess(res, { viewCount }, 'View count incremented successfully');
    } catch (error) {
      logger.error('Error incrementing view count:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug: req.params.slug,
      });

      sendError(res, 'SERVER_ERROR', 'Failed to increment view count', 500);
    }
  });

  /**
   * Search blog posts with advanced filtering
   * GET /api/public/blog/search
   * Requirements: 1.7
   */
  static searchPosts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.q as string;

      if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length < 2) {
        sendError(res, 'VALIDATION_ERROR', 'Search query must be at least 2 characters long', 400);
        return;
      }

      const filters: BlogPostFilters = {
        category: req.query.category as string,
        tags: req.query.tags ?
          (Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string]) :
          undefined,
        featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      };

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;

      // Validate pagination parameters
      if (page < 1) {
        sendError(res, 'VALIDATION_ERROR', 'Page number must be greater than 0', 400);
        return;
      }

      if (limit < 1 || limit > 50) {
        sendError(res, 'VALIDATION_ERROR', 'Limit must be between 1 and 50', 400);
        return;
      }

      const pagination: PaginationOptions = { page, limit };

      const result = await HealthBlogService.searchPosts(searchQuery, filters, pagination);

      logger.info('Blog posts search completed', {
        searchQuery,
        filters,
        pagination,
        resultCount: result.posts.length,
        total: result.pagination.total,
      });

      sendSuccess(res, result, 'Blog posts search completed successfully');
    } catch (error) {
      logger.error('Error searching blog posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query,
      });

      sendError(res, 'SERVER_ERROR', 'Failed to search blog posts', 500);
    }
  });
}

export default HealthBlogController;