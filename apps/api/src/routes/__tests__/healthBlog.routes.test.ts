/**
 * Health Blog Public Routes Integration Tests
 * Tests public blog endpoints functionality
 * Requirements: 1.1-1.9
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import healthBlogRoutes from '../healthBlog.routes';
import HealthBlogPost from '../../models/HealthBlogPost';
import User from '../../models/User';

// Mock the rate limiter to avoid rate limiting in tests
jest.mock('../../middlewares/rateLimiting', () => ({
  rateLimiter: {
    createLimiter: jest.fn(() => (req: any, res: any, next: any) => next()),
  },
}));

describe('Health Blog Public Routes', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let publishedPost: any;
  let draftPost: any;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/public/blog', healthBlogRoutes);

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'super_admin',
      isEmailVerified: true,
    });

    // Create test blog posts
    publishedPost = await HealthBlogPost.create({
      title: 'Published Test Post',
      slug: 'published-test-post',
      excerpt: 'This is a test excerpt for the published post',
      content: 'This is the full content of the published test post. It contains enough text to meet the minimum requirements.',
      featuredImage: {
        url: 'https://example.com/image.jpg',
        alt: 'Test image',
      },
      category: 'wellness',
      tags: ['test', 'wellness'],
      author: {
        id: testUser._id,
        name: `${testUser.firstName} ${testUser.lastName}`,
      },
      status: 'published',
      publishedAt: new Date(),
      readTime: 2,
      viewCount: 10,
      isFeatured: true,
      seo: {
        metaTitle: 'Published Test Post',
        metaDescription: 'Test meta description',
        keywords: ['test', 'wellness'],
      },
      createdBy: testUser._id,
    });

    draftPost = await HealthBlogPost.create({
      title: 'Draft Test Post',
      slug: 'draft-test-post',
      excerpt: 'This is a test excerpt for the draft post',
      content: 'This is the full content of the draft test post. It contains enough text to meet the minimum requirements.',
      featuredImage: {
        url: 'https://example.com/image2.jpg',
        alt: 'Test image 2',
      },
      category: 'nutrition',
      tags: ['test', 'nutrition'],
      author: {
        id: testUser._id,
        name: `${testUser.firstName} ${testUser.lastName}`,
      },
      status: 'draft',
      readTime: 3,
      viewCount: 0,
      isFeatured: false,
      createdBy: testUser._id,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Reset view counts
    await HealthBlogPost.updateMany({}, { viewCount: 10 });
  });

  describe('GET /api/public/blog/posts', () => {
    it('should return published posts with pagination', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].title).toBe('Published Test Post');
      expect(response.body.data.posts[0].status).toBe('published');
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(1);
    });

    it('should filter posts by category', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts?category=wellness')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].category).toBe('wellness');
    });

    it('should filter posts by tag', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts?tag=wellness')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].tags).toContain('wellness');
    });

    it('should search posts by title and content', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts?search=Published')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].title).toContain('Published');
    });

    it('should filter featured posts', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts?featured=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].isFeatured).toBe(true);
    });

    it('should not return draft posts', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts')
        .expect(200);

      const draftPosts = response.body.data.posts.filter((post: any) => post.status === 'draft');
      expect(draftPosts).toHaveLength(0);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts?page=1&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/public/blog/posts/:slug', () => {
    it('should return a published post by slug', async () => {
      const response = await request(app)
        .get(`/api/public/blog/posts/${publishedPost.slug}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.title).toBe('Published Test Post');
      expect(response.body.data.post.slug).toBe('published-test-post');
      expect(response.body.data.post.content).toBeDefined();
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts/non-existent-slug')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('POST_NOT_FOUND');
    });

    it('should return 404 for draft post slug', async () => {
      const response = await request(app)
        .get(`/api/public/blog/posts/${draftPost.slug}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('POST_NOT_FOUND');
    });
  });

  describe('GET /api/public/blog/featured', () => {
    it('should return featured posts', async () => {
      const response = await request(app)
        .get('/api/public/blog/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].isFeatured).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/public/blog/featured?limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts.length).toBeLessThanOrEqual(2);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/public/blog/featured?limit=15')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/public/blog/posts/:slug/related', () => {
    it('should return related posts for a valid slug', async () => {
      const response = await request(app)
        .get(`/api/public/blog/posts/${publishedPost.slug}/related`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toBeDefined();
      expect(Array.isArray(response.body.data.posts)).toBe(true);
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .get('/api/public/blog/posts/non-existent-slug/related')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('POST_NOT_FOUND');
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get(`/api/public/blog/posts/${publishedPost.slug}/related?limit=2`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/public/blog/categories', () => {
    it('should return all categories with post counts', async () => {
      const response = await request(app)
        .get('/api/public/blog/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeDefined();
      expect(Array.isArray(response.body.data.categories)).toBe(true);
      
      const wellnessCategory = response.body.data.categories.find((cat: any) => cat._id === 'wellness');
      expect(wellnessCategory).toBeDefined();
      expect(wellnessCategory.count).toBe(1);
    });
  });

  describe('GET /api/public/blog/tags', () => {
    it('should return all tags with post counts', async () => {
      const response = await request(app)
        .get('/api/public/blog/tags')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toBeDefined();
      expect(Array.isArray(response.body.data.tags)).toBe(true);
      
      const testTag = response.body.data.tags.find((tag: any) => tag._id === 'test');
      expect(testTag).toBeDefined();
      expect(testTag.count).toBe(1);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/public/blog/tags?limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/public/blog/posts/:slug/view', () => {
    it('should increment view count for a published post', async () => {
      const initialViewCount = publishedPost.viewCount;
      
      const response = await request(app)
        .post(`/api/public/blog/posts/${publishedPost.slug}/view`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.viewCount).toBe(initialViewCount + 1);

      // Verify in database
      const updatedPost = await HealthBlogPost.findById(publishedPost._id);
      expect(updatedPost?.viewCount).toBe(initialViewCount + 1);
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .post('/api/public/blog/posts/non-existent-slug/view')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('POST_NOT_FOUND');
    });

    it('should return 404 for draft post slug', async () => {
      const response = await request(app)
        .post(`/api/public/blog/posts/${draftPost.slug}/view`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('POST_NOT_FOUND');
    });
  });

  describe('GET /api/public/blog/search', () => {
    it('should search posts by query', async () => {
      const response = await request(app)
        .get('/api/public/blog/search?q=Published')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].title).toContain('Published');
    });

    it('should filter search results by category', async () => {
      const response = await request(app)
        .get('/api/public/blog/search?q=test&category=wellness')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].category).toBe('wellness');
    });

    it('should filter search results by tag', async () => {
      const response = await request(app)
        .get('/api/public/blog/search?q=test&tag=wellness')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].tags).toContain('wellness');
    });

    it('should handle pagination in search', async () => {
      const response = await request(app)
        .get('/api/public/blog/search?q=test&page=1&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should return empty results for non-matching query', async () => {
      const response = await request(app)
        .get('/api/public/blog/search?q=nonexistentquery')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/public/blog/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});