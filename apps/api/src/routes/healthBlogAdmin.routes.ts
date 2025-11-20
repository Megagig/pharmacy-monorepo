/**
 * Health Blog Admin Routes
 * Handles Super Admin blog management endpoints
 * Requirements: 2.1-2.11
 */

import express from 'express';
import HealthBlogAdminController from '../controllers/healthBlogAdminController';
import { superAdminAuth, auditSuperAdminAction } from '../middlewares/superAdminAuth';
import { createBlogImageUpload } from '../middlewares/upload';
import { createRateLimiter } from '../middlewares/rateLimiting';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middlewares/validation';

const router = express.Router();

// Apply Super Admin authentication to all routes
router.use(superAdminAuth);

/**
 * @route POST /api/super-admin/blog/posts
 * @desc Create a new blog post
 * @access Private (Super Admin Only)
 */
router.post(
  '/posts',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit post creation
    message: 'Too many post creation requests, please try again later.',
  }),
  auditSuperAdminAction('CREATE_BLOG_POST'),
  [
    body('title')
      .isString()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('excerpt')
      .isString()
      .isLength({ min: 20, max: 500 })
      .withMessage('Excerpt must be between 20 and 500 characters'),
    body('content')
      .isString()
      .isLength({ min: 100 })
      .withMessage('Content must be at least 100 characters'),
    body('featuredImage.url')
      .isURL()
      .withMessage('Featured image URL must be valid'),
    body('featuredImage.alt')
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('Featured image alt text is required and must be under 200 characters'),
    body('category')
      .isIn(['nutrition', 'wellness', 'medication', 'chronic_diseases', 'preventive_care', 'mental_health'])
      .withMessage('Category must be one of the allowed values'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be a string between 1 and 50 characters'),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('isFeatured must be a boolean'),
    body('publishImmediately')
      .optional()
      .isBoolean()
      .withMessage('publishImmediately must be a boolean'),
    body('relatedPosts')
      .optional()
      .isArray()
      .withMessage('relatedPosts must be an array'),
    body('relatedPosts.*')
      .optional()
      .isMongoId()
      .withMessage('Each related post must be a valid MongoDB ObjectId'),
    body('seo.metaTitle')
      .optional()
      .isString()
      .isLength({ max: 60 })
      .withMessage('Meta title must be under 60 characters'),
    body('seo.metaDescription')
      .optional()
      .isString()
      .isLength({ max: 160 })
      .withMessage('Meta description must be under 160 characters'),
    body('seo.keywords')
      .optional()
      .isArray()
      .withMessage('SEO keywords must be an array'),
  ],
  validateRequest,
  HealthBlogAdminController.createPost
);

/**
 * @route GET /api/super-admin/blog/posts
 * @desc Get all blog posts with admin filters and pagination
 * @access Private (Super Admin Only)
 */
router.get(
  '/posts',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many admin blog requests, please try again later.',
  }),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['draft', 'published', 'archived'])
      .withMessage('Status must be draft, published, or archived'),
    query('category')
      .optional()
      .isIn(['nutrition', 'wellness', 'medication', 'chronic_diseases', 'preventive_care', 'mental_health'])
      .withMessage('Category must be one of the allowed values'),
    query('author')
      .optional()
      .isMongoId()
      .withMessage('Author must be a valid MongoDB ObjectId'),
    query('featured')
      .optional()
      .isBoolean()
      .withMessage('Featured must be a boolean'),
    query('search')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'publishedAt', 'title', 'viewCount'])
      .withMessage('SortBy must be one of the allowed fields'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('SortOrder must be asc or desc'),
  ],
  validateRequest,
  HealthBlogAdminController.getAllPosts
);

/**
 * @route GET /api/super-admin/blog/posts/:postId
 * @desc Get a single blog post by ID (admin view)
 * @access Private (Super Admin Only)
 */
router.get(
  '/posts/:postId',
  [
    param('postId')
      .isMongoId()
      .withMessage('Post ID must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  HealthBlogAdminController.getPostById
);

/**
 * @route PUT /api/super-admin/blog/posts/:postId
 * @desc Update an existing blog post
 * @access Private (Super Admin Only)
 */
router.put(
  '/posts/:postId',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Allow more updates than creates
    message: 'Too many post update requests, please try again later.',
  }),
  auditSuperAdminAction('UPDATE_BLOG_POST'),
  [
    param('postId')
      .isMongoId()
      .withMessage('Post ID must be a valid MongoDB ObjectId'),
    body('title')
      .optional()
      .isString()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('excerpt')
      .optional()
      .isString()
      .isLength({ min: 20, max: 500 })
      .withMessage('Excerpt must be between 20 and 500 characters'),
    body('content')
      .optional()
      .isString()
      .isLength({ min: 100 })
      .withMessage('Content must be at least 100 characters'),
    body('featuredImage.url')
      .optional()
      .isURL()
      .withMessage('Featured image URL must be valid'),
    body('featuredImage.alt')
      .optional()
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('Featured image alt text must be under 200 characters'),
    body('category')
      .optional()
      .isIn(['nutrition', 'wellness', 'medication', 'chronic_diseases', 'preventive_care', 'mental_health'])
      .withMessage('Category must be one of the allowed values'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be a string between 1 and 50 characters'),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('isFeatured must be a boolean'),
    body('relatedPosts')
      .optional()
      .isArray()
      .withMessage('relatedPosts must be an array'),
    body('relatedPosts.*')
      .optional()
      .isMongoId()
      .withMessage('Each related post must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  HealthBlogAdminController.updatePost
);

/**
 * @route DELETE /api/super-admin/blog/posts/:postId
 * @desc Delete a blog post (soft delete)
 * @access Private (Super Admin Only)
 */
router.delete(
  '/posts/:postId',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit deletions
    message: 'Too many delete requests, please try again later.',
  }),
  auditSuperAdminAction('DELETE_BLOG_POST'),
  [
    param('postId')
      .isMongoId()
      .withMessage('Post ID must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  HealthBlogAdminController.deletePost
);

/**
 * @route POST /api/super-admin/blog/posts/:postId/publish
 * @desc Publish a blog post
 * @access Private (Super Admin Only)
 */
router.post(
  '/posts/:postId/publish',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    message: 'Too many publish requests, please try again later.',
  }),
  auditSuperAdminAction('PUBLISH_BLOG_POST'),
  [
    param('postId')
      .isMongoId()
      .withMessage('Post ID must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  HealthBlogAdminController.publishPost
);

/**
 * @route POST /api/super-admin/blog/posts/:postId/unpublish
 * @desc Unpublish a blog post
 * @access Private (Super Admin Only)
 */
router.post(
  '/posts/:postId/unpublish',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    message: 'Too many unpublish requests, please try again later.',
  }),
  auditSuperAdminAction('UNPUBLISH_BLOG_POST'),
  [
    param('postId')
      .isMongoId()
      .withMessage('Post ID must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  HealthBlogAdminController.unpublishPost
);

/**
 * @route POST /api/super-admin/blog/posts/:postId/archive
 * @desc Archive a blog post
 * @access Private (Super Admin Only)
 */
router.post(
  '/posts/:postId/archive',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many archive requests, please try again later.',
  }),
  auditSuperAdminAction('ARCHIVE_BLOG_POST'),
  [
    param('postId')
      .isMongoId()
      .withMessage('Post ID must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  HealthBlogAdminController.archivePost
);

/**
 * @route POST /api/super-admin/blog/upload-image
 * @desc Upload featured image for blog post
 * @access Private (Super Admin Only)
 */
router.post(
  '/upload-image',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit image uploads
    message: 'Too many image upload requests, please try again later.',
  }),
  auditSuperAdminAction('UPLOAD_BLOG_IMAGE'),
  createBlogImageUpload().single('image'),
  HealthBlogAdminController.uploadFeaturedImage
);

/**
 * @route GET /api/super-admin/blog/analytics
 * @desc Get blog analytics for admin dashboard
 * @access Private (Super Admin Only)
 */
router.get(
  '/analytics',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many analytics requests, please try again later.',
  }),
  HealthBlogAdminController.getBlogAnalytics
);

/**
 * @route GET /api/super-admin/blog/stats
 * @desc Get blog statistics (lighter version of analytics)
 * @access Private (Super Admin Only)
 */
router.get(
  '/stats',
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many stats requests, please try again later.',
  }),
  HealthBlogAdminController.getBlogStats
);

export default router;