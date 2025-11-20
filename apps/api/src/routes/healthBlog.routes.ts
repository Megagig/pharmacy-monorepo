/**
 * Health Blog Public Routes
 * Handles public blog endpoints (no authentication required)
 * Requirements: 1.1-1.9
 */

import express from 'express';
import HealthBlogController from '../controllers/healthBlogController';
import { createRateLimiter } from '../middlewares/rateLimiting';

const router = express.Router();

/**
 * @route GET /api/public/blog/posts
 * @desc Get published blog posts with pagination and filtering
 * @access Public
 * @query page - Page number (default: 1)
 * @query limit - Posts per page (default: 10, max: 50)
 * @query category - Filter by category
 * @query tag - Filter by tag
 * @query search - Search in title and content
 * @query featured - Filter featured posts (true/false)
 */
router.get(
  '/posts',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many blog requests from this IP, please try again later.',
  }),
  HealthBlogController.getPublishedPosts
);

/**
 * @route GET /api/public/blog/posts/:slug
 * @desc Get a single blog post by slug
 * @access Public
 */
router.get(
  '/posts/:slug',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for individual post views
    message: 'Too many blog post requests from this IP, please try again later.',
  }),
  HealthBlogController.getPostBySlug
);

/**
 * @route GET /api/public/blog/featured
 * @desc Get featured blog posts
 * @access Public
 * @query limit - Number of featured posts (default: 3, max: 10)
 */
router.get(
  '/featured',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150,
    message: 'Too many featured posts requests from this IP, please try again later.',
  }),
  HealthBlogController.getFeaturedPosts
);

/**
 * @route GET /api/public/blog/posts/:slug/related
 * @desc Get related blog posts for a specific post
 * @access Public
 * @query limit - Number of related posts (default: 3, max: 10)
 */
router.get(
  '/posts/:slug/related',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150,
    message: 'Too many related posts requests from this IP, please try again later.',
  }),
  HealthBlogController.getRelatedPosts
);

/**
 * @route GET /api/public/blog/categories
 * @desc Get all available blog categories with post counts
 * @access Public
 */
router.get(
  '/categories',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many category requests from this IP, please try again later.',
  }),
  HealthBlogController.getCategories
);

/**
 * @route GET /api/public/blog/tags
 * @desc Get all available blog tags with post counts
 * @access Public
 * @query limit - Number of tags to return (default: 20, max: 100)
 */
router.get(
  '/tags',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many tag requests from this IP, please try again later.',
  }),
  HealthBlogController.getTags
);

/**
 * @route POST /api/public/blog/posts/:slug/view
 * @desc Increment view count for a blog post
 * @access Public
 */
router.post(
  '/posts/:slug/view',
  createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit view count increments per IP per hour
    message: 'Too many view count requests from this IP, please try again later.',
  }),
  HealthBlogController.incrementViewCount
);

/**
 * @route GET /api/public/blog/search
 * @desc Search blog posts
 * @access Public
 * @query q - Search query
 * @query category - Filter by category
 * @query tag - Filter by tag
 * @query page - Page number (default: 1)
 * @query limit - Posts per page (default: 10, max: 20)
 */
router.get(
  '/search',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many search requests from this IP, please try again later.',
  }),
  HealthBlogController.searchPosts
);

export default router;