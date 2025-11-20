/**
 * Health Blog Controller Integration Tests
 * Tests all public blog endpoints for the patient portal
 * Requirements: 1.4, 1.5, 1.6, 1.7
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import HealthBlogController from '../healthBlogController';
import HealthBlogService from '../../services/HealthBlogService';
import { patientManagementErrorHandler } from '../../utils/responseHelpers';

// Mock the HealthBlogService
jest.mock('../../services/HealthBlogService');
const mockHealthBlogService = HealthBlogService as jest.Mocked<typeof HealthBlogService>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('HealthBlogController Integration Tests', () => {
  let app: express.Application;
  const testDate = new Date('2025-11-04T23:56:49.041Z');

  beforeAll(() => {
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    
    // Setup routes
    app.get('/api/public/blog/posts', HealthBlogController.getPublishedPosts);
    app.get('/api/public/blog/posts/:slug', HealthBlogController.getPostBySlug);
    app.get('/api/public/blog/featured', HealthBlogController.getFeaturedPosts);
    app.get('/api/public/blog/posts/:slug/related', HealthBlogController.getRelatedPosts);
    app.get('/api/public/blog/categories', HealthBlogController.getCategories);
    app.get('/api/public/blog/popular', HealthBlogController.getPopularPosts);
    app.get('/api/public/blog/recent', HealthBlogController.getRecentPosts);
    app.post('/api/public/blog/posts/:slug/view', HealthBlogController.incrementViewCount);
    app.get('/api/public/blog/search', HealthBlogController.searchPosts);
    
    // Error handler
    app.use(patientManagementErrorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/public/blog/posts', () => {
    const mockBlogResult = {
      posts: [
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Test Blog Post',
          slug: 'test-blog-post',
          excerpt: 'This is a test blog post excerpt',
          featuredImage: {
            url: 'https://example.com/image.jpg',
            alt: 'Test image',
          },
          category: 'wellness',
          tags: ['health', 'wellness'],
          author: {
            name: 'Dr. Test Author',
            avatar: 'https://example.com/avatar.jpg',
          },
          readTime: 5,
          publishedAt: testDate,
          viewCount: 100,
          isFeatured: false,
          url: '/blog/test-blog-post',
          readTimeDisplay: '5 min read',
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 12,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      },
      filters: {
        categories: [{ category: 'wellness', count: 1 }],
        tags: [{ tag: 'health', count: 1 }],
      },
    };

    it('should get published posts successfully', async () => {
      mockHealthBlogService.getPublishedPosts.mockResolvedValue(mockBlogResult);

      const response = await request(app)
        .get('/api/public/blog/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        posts: expect.arrayContaining([
          expect.objectContaining({
            title: mockBlogResult.posts[0].title,
            slug: mockBlogResult.posts[0].slug,
            excerpt: mockBlogResult.posts[0].excerpt,
          })
        ]),
        pagination: mockBlogResult.pagination,
        filters: mockBlogResult.filters,
      });
      expect(response.body.message).toBe('Blog posts retrieved successfully');
      expect(mockHealthBlogService.getPublishedPosts).toHaveBeenCalledWith(
        {
          category: undefined,
          tags: undefined,
          featured: undefined,
          search: undefined,
        },
        {
          page: 1,
          limit: 12,
        }
      );
    });

    it('should handle query parameters correctly', async () => {
      mockHealthBlogService.getPublishedPosts.mockResolvedValue(mockBlogResult);

      await request(app)
        .get('/api/public/blog/posts')
        .query({
          category: 'wellness',
          tags: ['health', 'nutrition'],
          featured: 'true',
          search: 'test query',
          page: '2',
          limit: '6',
        })
        .expect(200);

      expect(mockHealthBlogService.getPublishedPosts).toHaveBeenCalledWith(
        {
          category: 'wellness',
          tags: ['health', 'nutrition'],
          featured: true,
          search: 'test query',
        },
        {
          page: 2,
          limit: 6,
        }
      );
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts')
        .query({ page: '0' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Page number must be greater than 0');
    });

    it('should limit maximum posts per page', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts')
        .query({ limit: '100' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Limit must be between 1 and 50');
      expect(mockHealthBlogService.getPublishedPosts).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockHealthBlogService.getPublishedPosts.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/public/blog/posts')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SERVER_ERROR');
      expect(response.body.error.message).toBe('Failed to retrieve blog posts');
    });
  });

  describe('GET /api/public/blog/posts/:slug', () => {
    const mockPost = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Blog Post',
      slug: 'test-blog-post',
      excerpt: 'This is a test blog post excerpt',
      content: '<p>This is the full blog post content</p>',
      featuredImage: {
        url: 'https://example.com/image.jpg',
        alt: 'Test image',
      },
      category: 'wellness',
      tags: ['health', 'wellness'],
      author: {
        name: 'Dr. Test Author',
        avatar: 'https://example.com/avatar.jpg',
      },
      readTime: 5,
      publishedAt: testDate,
      viewCount: 100,
      isFeatured: false,
      seo: {
        metaTitle: 'Test Blog Post - Health Tips',
        metaDescription: 'Learn about wellness in this comprehensive guide',
        keywords: ['health', 'wellness', 'tips'],
      },
      url: '/blog/test-blog-post',
      readTimeDisplay: '5 min read',
      wordCount: 250,
      relatedPosts: [],
    };

    it('should get post by slug successfully', async () => {
      mockHealthBlogService.getPostBySlug.mockResolvedValue(mockPost);

      const response = await request(app)
        .get('/api/public/blog/posts/test-blog-post')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post).toMatchObject({
        title: mockPost.title,
        slug: mockPost.slug,
        excerpt: mockPost.excerpt,
        content: mockPost.content,
      });
      expect(response.body.message).toBe('Blog post retrieved successfully');
      expect(mockHealthBlogService.getPostBySlug).toHaveBeenCalledWith('test-blog-post');
    });

    it('should return 404 for non-existent post', async () => {
      mockHealthBlogService.getPostBySlug.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/public/blog/posts/non-existent-post')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Blog post not found');
    });

    it('should validate slug parameter', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts/%20')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Valid slug is required');
    });

    it('should handle service errors', async () => {
      mockHealthBlogService.getPostBySlug.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/public/blog/posts/test-slug')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SERVER_ERROR');
      expect(response.body.error.message).toBe('Failed to retrieve blog post');
    });
  });

  describe('GET /api/public/blog/featured', () => {
    const mockFeaturedPosts = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Featured Post 1',
        slug: 'featured-post-1',
        excerpt: 'This is a featured post',
        featuredImage: {
          url: 'https://example.com/featured1.jpg',
          alt: 'Featured image 1',
        },
        category: 'wellness',
        tags: ['featured', 'health'],
        author: {
          name: 'Dr. Featured Author',
        },
        readTime: 3,
        publishedAt: testDate,
        viewCount: 500,
        isFeatured: true,
        url: '/blog/featured-post-1',
        readTimeDisplay: '3 min read',
      },
    ];

    it('should get featured posts successfully', async () => {
      mockHealthBlogService.getFeaturedPosts.mockResolvedValue(mockFeaturedPosts);

      const response = await request(app)
        .get('/api/public/blog/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toMatchObject([
        expect.objectContaining({
          title: mockFeaturedPosts[0].title,
          slug: mockFeaturedPosts[0].slug,
          isFeatured: true,
        })
      ]);
      expect(response.body.message).toBe('Featured blog posts retrieved successfully');
      expect(mockHealthBlogService.getFeaturedPosts).toHaveBeenCalledWith(3);
    });

    it('should handle custom limit parameter', async () => {
      mockHealthBlogService.getFeaturedPosts.mockResolvedValue(mockFeaturedPosts);

      await request(app)
        .get('/api/public/blog/featured')
        .query({ limit: '5' })
        .expect(200);

      expect(mockHealthBlogService.getFeaturedPosts).toHaveBeenCalledWith(5);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/public/blog/featured')
        .query({ limit: '15' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Limit must be between 1 and 10');
    });
  });

  describe('GET /api/public/blog/posts/:slug/related', () => {
    const mockPost = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Main Post',
      slug: 'main-post',
    };

    const mockRelatedPosts = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Related Post 1',
        slug: 'related-post-1',
        excerpt: 'This is a related post',
        featuredImage: {
          url: 'https://example.com/related1.jpg',
          alt: 'Related image 1',
        },
        category: 'wellness',
        tags: ['health'],
        author: { name: 'Dr. Author' },
        readTime: 4,
        publishedAt: testDate,
        viewCount: 200,
        isFeatured: false,
        url: '/blog/related-post-1',
        readTimeDisplay: '4 min read',
      },
    ];

    it('should get related posts successfully', async () => {
      mockHealthBlogService.getPostBySlug.mockResolvedValue(mockPost as any);
      mockHealthBlogService.getRelatedPosts.mockResolvedValue(mockRelatedPosts);

      const response = await request(app)
        .get('/api/public/blog/posts/main-post/related')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toMatchObject([
        expect.objectContaining({
          title: mockRelatedPosts[0].title,
          slug: mockRelatedPosts[0].slug,
        })
      ]);
      expect(response.body.message).toBe('Related blog posts retrieved successfully');
      expect(mockHealthBlogService.getPostBySlug).toHaveBeenCalledWith('main-post');
      expect(mockHealthBlogService.getRelatedPosts).toHaveBeenCalledWith(mockPost._id, 3);
    });

    it('should return 404 for non-existent main post', async () => {
      mockHealthBlogService.getPostBySlug.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/public/blog/posts/non-existent/related')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Blog post not found');
    });

    it('should validate slug parameter', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts/%20/related')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Valid slug is required');
    });
  });

  describe('GET /api/public/blog/categories', () => {
    const mockCategories = [
      { category: 'wellness', count: 5, label: 'Wellness & Lifestyle' },
      { category: 'nutrition', count: 3, label: 'Nutrition & Diet' },
      { category: 'medication', count: 2, label: 'Medication Management' },
    ];

    it('should get categories successfully', async () => {
      mockHealthBlogService.getCategories.mockResolvedValue(mockCategories);

      const response = await request(app)
        .get('/api/public/blog/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toEqual(mockCategories);
      expect(response.body.message).toBe('Blog categories retrieved successfully');
      expect(mockHealthBlogService.getCategories).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockHealthBlogService.getCategories.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/public/blog/categories')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SERVER_ERROR');
      expect(response.body.error.message).toBe('Failed to retrieve blog categories');
    });
  });

  describe('GET /api/public/blog/popular', () => {
    const mockPopularPosts = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Popular Post 1',
        slug: 'popular-post-1',
        excerpt: 'This is a popular post',
        featuredImage: {
          url: 'https://example.com/popular1.jpg',
          alt: 'Popular image 1',
        },
        viewCount: 1000,
        category: 'wellness',
        tags: ['popular'],
        author: { name: 'Dr. Popular' },
        readTime: 6,
        publishedAt: testDate,
        isFeatured: false,
        url: '/blog/popular-post-1',
        readTimeDisplay: '6 min read',
      },
    ];

    it('should get popular posts successfully', async () => {
      mockHealthBlogService.getPopularPosts.mockResolvedValue(mockPopularPosts);

      const response = await request(app)
        .get('/api/public/blog/popular')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toMatchObject([
        expect.objectContaining({
          title: mockPopularPosts[0].title,
          slug: mockPopularPosts[0].slug,
          viewCount: 1000,
        })
      ]);
      expect(response.body.message).toBe('Popular blog posts retrieved successfully');
      expect(mockHealthBlogService.getPopularPosts).toHaveBeenCalledWith(5);
    });

    it('should handle custom limit parameter', async () => {
      mockHealthBlogService.getPopularPosts.mockResolvedValue(mockPopularPosts);

      await request(app)
        .get('/api/public/blog/popular')
        .query({ limit: '8' })
        .expect(200);

      expect(mockHealthBlogService.getPopularPosts).toHaveBeenCalledWith(8);
    });
  });

  describe('GET /api/public/blog/recent', () => {
    const mockRecentPosts = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Recent Post 1',
        slug: 'recent-post-1',
        excerpt: 'This is a recent post',
        featuredImage: {
          url: 'https://example.com/recent1.jpg',
          alt: 'Recent image 1',
        },
        publishedAt: testDate,
        category: 'wellness',
        tags: ['recent'],
        author: { name: 'Dr. Recent' },
        readTime: 4,
        viewCount: 50,
        isFeatured: false,
        url: '/blog/recent-post-1',
        readTimeDisplay: '4 min read',
      },
    ];

    it('should get recent posts successfully', async () => {
      mockHealthBlogService.getRecentPosts.mockResolvedValue(mockRecentPosts);

      const response = await request(app)
        .get('/api/public/blog/recent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toMatchObject([
        expect.objectContaining({
          title: mockRecentPosts[0].title,
          slug: mockRecentPosts[0].slug,
        })
      ]);
      expect(response.body.message).toBe('Recent blog posts retrieved successfully');
      expect(mockHealthBlogService.getRecentPosts).toHaveBeenCalledWith(6);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/public/blog/recent')
        .query({ limit: '25' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Limit must be between 1 and 20');
    });
  });

  describe('POST /api/public/blog/posts/:slug/view', () => {
    const mockPost = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Post',
      slug: 'test-post',
    };

    it('should increment view count successfully', async () => {
      mockHealthBlogService.getPostBySlug.mockResolvedValue(mockPost as any);
      mockHealthBlogService.incrementViewCount.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/public/blog/posts/test-post/view')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.message).toBe('View count incremented successfully');
      expect(mockHealthBlogService.getPostBySlug).toHaveBeenCalledWith('test-post');
      expect(mockHealthBlogService.incrementViewCount).toHaveBeenCalledWith(mockPost._id);
    });

    it('should return 404 for non-existent post', async () => {
      mockHealthBlogService.getPostBySlug.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/public/blog/posts/non-existent/view')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Blog post not found');
    });

    it('should validate slug parameter', async () => {
      const response = await request(app)
        .post('/api/public/blog/posts/%20/view')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Valid slug is required');
    });
  });

  describe('GET /api/public/blog/search', () => {
    const mockSearchResult = {
      posts: [
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Search Result Post',
          slug: 'search-result-post',
          excerpt: 'This post matches the search query',
          featuredImage: {
            url: 'https://example.com/search1.jpg',
            alt: 'Search result image',
          },
          category: 'wellness',
          tags: ['search', 'health'],
          author: { name: 'Dr. Search' },
          readTime: 5,
          publishedAt: testDate,
          viewCount: 150,
          isFeatured: false,
          url: '/blog/search-result-post',
          readTimeDisplay: '5 min read',
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 12,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      },
      filters: {
        categories: [{ category: 'wellness', count: 1 }],
        tags: [{ tag: 'search', count: 1 }],
      },
    };

    it('should search posts successfully', async () => {
      mockHealthBlogService.searchPosts.mockResolvedValue(mockSearchResult);

      const response = await request(app)
        .get('/api/public/blog/search')
        .query({ q: 'health tips' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        posts: expect.arrayContaining([
          expect.objectContaining({
            title: mockSearchResult.posts[0].title,
            slug: mockSearchResult.posts[0].slug,
          })
        ]),
        pagination: mockSearchResult.pagination,
      });
      expect(response.body.message).toBe('Blog posts search completed successfully');
      expect(mockHealthBlogService.searchPosts).toHaveBeenCalledWith(
        'health tips',
        {
          category: undefined,
          tags: undefined,
          featured: undefined,
        },
        {
          page: 1,
          limit: 12,
        }
      );
    });

    it('should handle search with filters', async () => {
      mockHealthBlogService.searchPosts.mockResolvedValue(mockSearchResult);

      await request(app)
        .get('/api/public/blog/search')
        .query({
          q: 'wellness',
          category: 'wellness',
          tags: ['health', 'tips'],
          featured: 'true',
          page: '2',
          limit: '6',
        })
        .expect(200);

      expect(mockHealthBlogService.searchPosts).toHaveBeenCalledWith(
        'wellness',
        {
          category: 'wellness',
          tags: ['health', 'tips'],
          featured: true,
        },
        {
          page: 2,
          limit: 6,
        }
      );
    });

    it('should validate search query length', async () => {
      const response = await request(app)
        .get('/api/public/blog/search')
        .query({ q: 'a' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Search query must be at least 2 characters long');
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/public/blog/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Search query must be at least 2 characters long');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/public/blog/search')
        .query({ q: 'test', page: '0' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Page number must be greater than 0');
    });

    it('should handle service errors', async () => {
      mockHealthBlogService.searchPosts.mockRejectedValue(new Error('Search service error'));

      const response = await request(app)
        .get('/api/public/blog/search')
        .query({ q: 'test query' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SERVER_ERROR');
      expect(response.body.error.message).toBe('Failed to search blog posts');
    });
  });
});