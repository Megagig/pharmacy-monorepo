/**
 * Health Blog Admin Service - Super Admin Management
 * Handles blog post creation, management, and analytics for Super Admins
 * Requirements: 2.2, 2.3, 2.4, 2.6, 2.9, 2.10
 */

import mongoose from 'mongoose';
import HealthBlogPost, { IHealthBlogPost } from '../models/HealthBlogPost';
import User, { IUser } from '../models/User';
import logger from '../utils/logger';
import { createNotFoundError, createValidationError, createBusinessRuleError } from '../utils/responseHelpers';
// Note: This would typically use a cloud storage service like Cloudinary or AWS S3
// For now, we'll create a simple interface for the upload functionality

export interface CreatePostData {
  title: string;
  excerpt: string;
  content: string;
  featuredImage: {
    url: string;
    alt: string;
    caption?: string;
  };
  category: IHealthBlogPost['category'];
  tags: string[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  isFeatured?: boolean;
  relatedPosts?: mongoose.Types.ObjectId[];
  publishImmediately?: boolean;
}

export interface UpdatePostData {
  title?: string;
  excerpt?: string;
  content?: string;
  featuredImage?: {
    url: string;
    alt: string;
    caption?: string;
  };
  category?: IHealthBlogPost['category'];
  tags?: string[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  isFeatured?: boolean;
  relatedPosts?: mongoose.Types.ObjectId[];
}

export interface AdminPostFilters {
  status?: IHealthBlogPost['status'] | IHealthBlogPost['status'][];
  category?: string;
  author?: mongoose.Types.ObjectId;
  isFeatured?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AdminPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BlogAnalytics {
  overview: {
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    archivedPosts: number;
    totalViews: number;
    averageReadTime: number;
  };
  topPosts: Array<{
    _id: mongoose.Types.ObjectId;
    title: string;
    slug: string;
    viewCount: number;
    publishedAt: Date;
  }>;
  categoryStats: Array<{
    category: string;
    count: number;
    totalViews: number;
  }>;
  publishingTrends: Array<{
    month: string;
    year: number;
    postsPublished: number;
    totalViews: number;
  }>;
  recentActivity: Array<{
    action: string;
    postTitle: string;
    postSlug: string;
    authorName: string;
    timestamp: Date;
  }>;
}

export interface ImageUploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

export class HealthBlogAdminService {
  /**
   * Create a new blog post
   * Requirement: 2.2, 2.3
   */
  static async createPost(
    postData: CreatePostData,
    authorId: mongoose.Types.ObjectId
  ): Promise<IHealthBlogPost> {
    try {
      // Validate author is a Super Admin
      const author = await User.findById(authorId);
      if (!author) {
        throw createNotFoundError('User', authorId.toString());
      }

      if (author.role !== 'super_admin') {
        throw createBusinessRuleError('Only Super Admins can create blog posts');
      }

      // Generate unique slug
      const baseSlug = this.generateSlug(postData.title);
      const uniqueSlug = await (HealthBlogPost as any).ensureUniqueSlug(baseSlug);

      // Create the blog post
      const blogPost = new HealthBlogPost({
        title: postData.title,
        slug: uniqueSlug,
        excerpt: postData.excerpt,
        content: postData.content,
        featuredImage: postData.featuredImage,
        category: postData.category,
        tags: postData.tags || [],
        author: {
          id: authorId,
          name: `${author.firstName} ${author.lastName}`,
          avatar: author.avatar,
        },
        status: postData.publishImmediately ? 'published' : 'draft',
        publishedAt: postData.publishImmediately ? new Date() : undefined,
        isFeatured: postData.isFeatured || false,
        seo: postData.seo || {},
        relatedPosts: postData.relatedPosts || [],
        createdBy: authorId,
      });

      await blogPost.save();

      logger.info('Blog post created successfully', {
        postId: blogPost._id.toString(),
        title: blogPost.title,
        slug: blogPost.slug,
        authorId: authorId.toString(),
        status: blogPost.status,
      });

      return blogPost;
    } catch (error) {
      logger.error('Error creating blog post:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postData: { ...postData, content: '[CONTENT_TRUNCATED]' },
        authorId: authorId.toString(),
      });
      throw error;
    }
  }

  /**
   * Update an existing blog post
   * Requirement: 2.3, 2.4
   */
  static async updatePost(
    postId: mongoose.Types.ObjectId,
    updateData: UpdatePostData,
    updatedBy: mongoose.Types.ObjectId
  ): Promise<IHealthBlogPost> {
    try {
      // Validate user is a Super Admin
      const user = await User.findById(updatedBy);
      if (!user || user.role !== 'super_admin') {
        throw createBusinessRuleError('Only Super Admins can update blog posts');
      }

      // Find the post
      const post = await HealthBlogPost.findOne({
        _id: postId,
        isDeleted: false,
      });

      if (!post) {
        throw createNotFoundError('Blog post', postId.toString());
      }

      // Update fields
      if (updateData.title && updateData.title !== post.title) {
        post.title = updateData.title;
        // Regenerate slug if title changed
        const baseSlug = this.generateSlug(updateData.title);
        post.slug = await (HealthBlogPost as any).ensureUniqueSlug(baseSlug, postId);
      }

      if (updateData.excerpt) post.excerpt = updateData.excerpt;
      if (updateData.content) post.content = updateData.content;
      if (updateData.featuredImage) post.featuredImage = updateData.featuredImage;
      if (updateData.category) post.category = updateData.category;
      if (updateData.tags) post.tags = updateData.tags;
      if (updateData.isFeatured !== undefined) post.isFeatured = updateData.isFeatured;
      if (updateData.relatedPosts) post.relatedPosts = updateData.relatedPosts;

      // Update SEO fields
      if (updateData.seo) {
        post.seo = {
          ...post.seo,
          ...updateData.seo,
        };
      }

      post.updatedBy = updatedBy;
      await post.save();

      logger.info('Blog post updated successfully', {
        postId: postId.toString(),
        title: post.title,
        updatedBy: updatedBy.toString(),
      });

      return post;
    } catch (error) {
      logger.error('Error updating blog post:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: postId.toString(),
        updatedBy: updatedBy.toString(),
      });
      throw error;
    }
  }

  /**
   * Delete a blog post (soft delete)
   * Requirement: 2.4
   */
  static async deletePost(
    postId: mongoose.Types.ObjectId,
    deletedBy: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      // Validate user is a Super Admin
      const user = await User.findById(deletedBy);
      if (!user || user.role !== 'super_admin') {
        throw createBusinessRuleError('Only Super Admins can delete blog posts');
      }

      // Find and soft delete the post
      const result = await HealthBlogPost.updateOne(
        {
          _id: postId,
          isDeleted: false,
        },
        {
          isDeleted: true,
          updatedBy: deletedBy,
        }
      );

      if (result.matchedCount === 0) {
        throw createNotFoundError('Blog post', postId.toString());
      }

      logger.info('Blog post deleted successfully', {
        postId: postId.toString(),
        deletedBy: deletedBy.toString(),
      });
    } catch (error) {
      logger.error('Error deleting blog post:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: postId.toString(),
        deletedBy: deletedBy.toString(),
      });
      throw error;
    }
  }

  /**
   * Publish a blog post
   * Requirement: 2.6
   */
  static async publishPost(
    postId: mongoose.Types.ObjectId,
    publishedBy: mongoose.Types.ObjectId
  ): Promise<IHealthBlogPost> {
    try {
      // Validate user is a Super Admin
      const user = await User.findById(publishedBy);
      if (!user || user.role !== 'super_admin') {
        throw createBusinessRuleError('Only Super Admins can publish blog posts');
      }

      // Find the post
      const post = await HealthBlogPost.findOne({
        _id: postId,
        isDeleted: false,
      });

      if (!post) {
        throw createNotFoundError('Blog post', postId.toString());
      }

      if (post.status === 'published') {
        throw createBusinessRuleError('Blog post is already published');
      }

      // Validate post is ready for publishing
      this.validatePostForPublishing(post);

      // Publish the post
      post.status = 'published';
      post.publishedAt = new Date();
      post.updatedBy = publishedBy;

      await post.save();

      logger.info('Blog post published successfully', {
        postId: postId.toString(),
        title: post.title,
        publishedBy: publishedBy.toString(),
      });

      return post;
    } catch (error) {
      logger.error('Error publishing blog post:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: postId.toString(),
        publishedBy: publishedBy.toString(),
      });
      throw error;
    }
  }

  /**
   * Unpublish a blog post
   * Requirement: 2.6
   */
  static async unpublishPost(
    postId: mongoose.Types.ObjectId,
    unpublishedBy: mongoose.Types.ObjectId
  ): Promise<IHealthBlogPost> {
    try {
      // Validate user is a Super Admin
      const user = await User.findById(unpublishedBy);
      if (!user || user.role !== 'super_admin') {
        throw createBusinessRuleError('Only Super Admins can unpublish blog posts');
      }

      // Find the post
      const post = await HealthBlogPost.findOne({
        _id: postId,
        isDeleted: false,
      });

      if (!post) {
        throw createNotFoundError('Blog post', postId.toString());
      }

      if (post.status !== 'published') {
        throw createBusinessRuleError('Only published posts can be unpublished');
      }

      // Unpublish the post
      post.status = 'draft';
      post.publishedAt = undefined;
      post.updatedBy = unpublishedBy;

      await post.save();

      logger.info('Blog post unpublished successfully', {
        postId: postId.toString(),
        title: post.title,
        unpublishedBy: unpublishedBy.toString(),
      });

      return post;
    } catch (error) {
      logger.error('Error unpublishing blog post:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: postId.toString(),
        unpublishedBy: unpublishedBy.toString(),
      });
      throw error;
    }
  }

  /**
   * Get all posts with admin filters and pagination
   * Requirement: 2.9
   */
  static async getAllPosts(
    filters: AdminPostFilters = {},
    pagination: AdminPaginationOptions = {}
  ): Promise<{
    posts: IHealthBlogPost[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const page = pagination.page || 1;
      const limit = Math.min(pagination.limit || 20, 100); // Max 100 posts per page
      const skip = (page - 1) * limit;
      const sortBy = pagination.sortBy || 'createdAt';
      const sortOrder = pagination.sortOrder === 'asc' ? 1 : -1;

      // Build query
      const query: any = {
        isDeleted: false,
      };

      // Apply filters
      if (filters.status) {
        query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
      }

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.author) {
        query['author.id'] = filters.author;
      }

      if (filters.isFeatured !== undefined) {
        query.isFeatured = filters.isFeatured;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          query.createdAt.$lte = filters.dateTo;
        }
      }

      // Handle search
      if (filters.search && filters.search.trim()) {
        query.$text = { $search: filters.search.trim() };
      }

      // Execute query
      const [posts, total] = await Promise.all([
        HealthBlogPost.find(query)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        HealthBlogPost.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        posts: posts as IHealthBlogPost[],
        pagination: {
          total,
          page,
          limit,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error getting all posts:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Upload featured image for blog post
   * Requirement: 2.10
   */
  static async uploadFeaturedImage(
    file: Express.Multer.File,
    uploadedBy: mongoose.Types.ObjectId
  ): Promise<ImageUploadResult> {
    try {
      // Validate user is a Super Admin
      const user = await User.findById(uploadedBy);
      if (!user || user.role !== 'super_admin') {
        throw createBusinessRuleError('Only Super Admins can upload blog images');
      }

      // Validate file
      if (!file) {
        throw createValidationError('No file provided');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw createValidationError('Invalid file type. Only JPEG, PNG, and WebP images are allowed');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw createValidationError('File size too large. Maximum size is 5MB');
      }

      // Upload to cloud storage (mock implementation)
      // In a real implementation, this would use Cloudinary, AWS S3, or similar service
      const uploadResult = {
        secure_url: `https://example.com/blog-images/${Date.now()}-${file.originalname}`,
        public_id: `blog-images/${Date.now()}-${file.originalname.split('.')[0]}`,
        width: 1200,
        height: 630,
        format: file.originalname.split('.').pop()?.toLowerCase() || 'jpg',
        bytes: file.size,
      };

      logger.info('Blog image uploaded successfully', {
        publicId: uploadResult.public_id,
        url: uploadResult.secure_url,
        uploadedBy: uploadedBy.toString(),
      });

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.bytes,
      };
    } catch (error) {
      logger.error('Error uploading blog image:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: file?.originalname,
        uploadedBy: uploadedBy.toString(),
      });
      throw error;
    }
  }

  /**
   * Get blog analytics for admin dashboard
   * Requirement: 2.9, 2.10
   */
  static async getBlogAnalytics(): Promise<BlogAnalytics> {
    try {
      // Get overview statistics
      const [
        totalPosts,
        publishedPosts,
        draftPosts,
        archivedPosts,
        viewsAggregation,
        readTimeAggregation,
      ] = await Promise.all([
        HealthBlogPost.countDocuments({ isDeleted: false }),
        HealthBlogPost.countDocuments({ status: 'published', isDeleted: false }),
        HealthBlogPost.countDocuments({ status: 'draft', isDeleted: false }),
        HealthBlogPost.countDocuments({ status: 'archived', isDeleted: false }),
        HealthBlogPost.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: null, totalViews: { $sum: '$viewCount' } } },
        ]),
        HealthBlogPost.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: null, averageReadTime: { $avg: '$readTime' } } },
        ]),
      ]);

      const totalViews = viewsAggregation[0]?.totalViews || 0;
      const averageReadTime = Math.round(readTimeAggregation[0]?.averageReadTime || 0);

      // Get top posts by views
      const topPosts = await HealthBlogPost.find({
        status: 'published',
        isDeleted: false,
      })
        .select('title slug viewCount publishedAt')
        .sort({ viewCount: -1 })
        .limit(10)
        .lean();

      // Get category statistics
      const categoryStats = await HealthBlogPost.aggregate([
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
            totalViews: { $sum: '$viewCount' },
          },
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            totalViews: 1,
            _id: 0,
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      // Get publishing trends (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const publishingTrends = await HealthBlogPost.aggregate([
        {
          $match: {
            status: 'published',
            publishedAt: { $gte: twelveMonthsAgo },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$publishedAt' },
              month: { $month: '$publishedAt' },
            },
            postsPublished: { $sum: 1 },
            totalViews: { $sum: '$viewCount' },
          },
        },
        {
          $project: {
            year: '$_id.year',
            month: {
              $arrayElemAt: [
                ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                '$_id.month',
              ],
            },
            postsPublished: 1,
            totalViews: 1,
            _id: 0,
          },
        },
        {
          $sort: { year: 1, '_id.month': 1 },
        },
      ]);

      // Get recent activity (last 20 actions)
      const recentActivity = await HealthBlogPost.find({
        isDeleted: false,
      })
        .select('title slug author.name status createdAt updatedAt publishedAt')
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean()
        .then(posts =>
          posts.map(post => ({
            action: this.getActivityAction(post),
            postTitle: post.title,
            postSlug: post.slug,
            authorName: post.author.name,
            timestamp: post.updatedAt || post.createdAt,
          }))
        );

      return {
        overview: {
          totalPosts,
          publishedPosts,
          draftPosts,
          archivedPosts,
          totalViews,
          averageReadTime,
        },
        topPosts: topPosts as any[],
        categoryStats,
        publishingTrends,
        recentActivity,
      };
    } catch (error) {
      logger.error('Error getting blog analytics:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Generate URL-friendly slug from title
   */
  private static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Validate post is ready for publishing
   */
  private static validatePostForPublishing(post: IHealthBlogPost): void {
    const errors: string[] = [];

    if (!post.title || post.title.trim().length < 5) {
      errors.push('Title must be at least 5 characters long');
    }

    if (!post.excerpt || post.excerpt.trim().length < 20) {
      errors.push('Excerpt must be at least 20 characters long');
    }

    if (!post.content || post.content.trim().length < 100) {
      errors.push('Content must be at least 100 characters long');
    }

    if (!post.featuredImage?.url) {
      errors.push('Featured image is required');
    }

    if (!post.category) {
      errors.push('Category is required');
    }

    if (errors.length > 0) {
      throw createValidationError(`Post validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Determine activity action based on post data
   */
  private static getActivityAction(post: any): string {
    if (post.status === 'published' && post.publishedAt) {
      return 'published';
    }
    if (post.status === 'draft') {
      return 'saved as draft';
    }
    if (post.status === 'archived') {
      return 'archived';
    }
    return 'updated';
  }
}

export default HealthBlogAdminService;