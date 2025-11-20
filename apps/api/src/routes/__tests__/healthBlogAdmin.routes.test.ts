/**
 * Health Blog Admin Routes Integration Tests
 * Tests Super Admin blog management endpoints
 * Requirements: 2.1-2.11
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import healthBlogAdminRoutes from '../healthBlogAdmin.routes';
import HealthBlogPost from '../../models/HealthBlogPost';
import User from '../../models/User';

// Mock the rate limiter and upload middleware
jest.mock('../../middlewares/rateLimiting', () => ({
  rateLimiter: {
    createLimiter: jest.fn(() => (req: any, res: any, next: any) => next()),
  },
}));

jest.mock('../../middlewares/upload', () => ({
  createBlogImageUpload: jest.fn(() => ({
    single: jest.fn(() => (req: any, res: any, next: any) => {
      req.file = {
        filename: 'test-image.jpg',
        path: '/tmp/test-image.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      };
      next();
    }),
  })),
}));

describe('Health Blog Admin Routes', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let superAdminUser: any;
  let regularUser: any;
  let superAdminToken: string;
  let regularUserToken: string;
  let testPost: any;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/super-admin/blog', healthBlogAdminRoutes);

    // Create test users
    superAdminUser = await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@test.com',
      password: 'password123',
      role: 'super_admin',
      isEmailVerified: true,
    });

    regularUser = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      email: 'user@test.com',
      password: 'password123',
      role: 'pharmacist',
      isEmailVerified: true,
    });

    // Create JWT tokens
    superAdminToken = jwt.sign(
      { userId: superAdminUser._id, role: 'super_admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    regularUserToken = jwt.sign(
      { userId: regularUser._id, role: 'pharmacist' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test blog post
    testPost = await HealthBlogPost.create({
      title: 'Test Blog Post',
      slug: 'test-blog-post',
      excerpt: 'This is a test excerpt for the blog post',
      content: 'This is the full content of the test blog post. It contains enough text to meet the minimum requirements.',
      featuredImage: {
        url: 'https://example.com/image.jpg',
        alt: 'Test image',
      },
      category: 'wellness',
      tags: ['test', 'wellness'],
      author: {
        id: superAdminUser._id,
        name: `${superAdminUser.firstName} ${superAdminUser.lastName}`,
      },
      status: 'draft',
      readTime: 2,
      viewCount: 0,
      isFeatured: false,
      createdBy: superAdminUser._id,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject requests from non-super-admin users', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should allow requests from super admin users', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/super-admin/blog/posts', () => {
    const validPostData = {
      title: 'New Test Post',
      excerpt: 'This is a test excerpt for the new post',
      content: 'This is the full content of the new test post. It contains enough text to meet the minimum requirements for content length.',
      featuredImage: {
        url: 'https://example.com/new-image.jpg',
        alt: 'New test image',
      },
      category: 'nutrition',
      tags: ['test', 'nutrition'],
      isFeatured: false,
      publishImmediately: false,
    };

    it('should create a new blog post with valid data', async () => {
      const response = await request(app)
        .post('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(validPostData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.title).toBe(validPostData.title);
      expect(response.body.data.post.slug).toBe('new-test-post');
      expect(response.body.data.post.status).toBe('draft');
    });

    it('should create and publish post immediately when publishImmediately is true', async () => {
      const publishData = { ...validPostData, title: 'Published Post', publishImmediately: true };
      
      const response = await request(app)
        .post('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(publishData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.status).toBe('published');
      expect(response.body.data.post.publishedAt).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validPostData };
      delete invalidData.title;

      const response = await request(app)
        .post('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate title length', async () => {
      const invalidData = { ...validPostData, title: 'Hi' };

      const response = await request(app)
        .post('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate category', async () => {
      const invalidData = { ...validPostData, category: 'invalid-category' };

      const response = await request(app)
        .post('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate content length', async () => {
      const invalidData = { ...validPostData, content: 'Too short' };

      const response = await request(app)
        .post('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/super-admin/blog/posts', () => {
    it('should return all posts with pagination', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(Array.isArray(response.body.data.posts)).toBe(true);
    });

    it('should filter posts by status', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts?status=draft')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.posts.forEach((post: any) => {
        expect(post.status).toBe('draft');
      });
    });

    it('should filter posts by category', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts?category=wellness')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.posts.forEach((post: any) => {
        expect(post.category).toBe('wellness');
      });
    });

    it('should search posts', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts?search=Test')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts.length).toBeGreaterThan(0);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts?page=1&limit=5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/super-admin/blog/posts/:postId', () => {
    it('should return a specific post by ID', async () => {
      const response = await request(app)
        .get(`/api/super-admin/blog/posts/${testPost._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post._id).toBe(testPost._id.toString());
      expect(response.body.data.post.title).toBe(testPost.title);
    });

    it('should return 404 for non-existent post ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/super-admin/blog/posts/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should validate post ID format', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/posts/invalid-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/super-admin/blog/posts/:postId', () => {
    it('should update a blog post', async () => {
      const updateData = {
        title: 'Updated Test Post',
        excerpt: 'This is an updated excerpt for the test post',
      };

      const response = await request(app)
        .put(`/api/super-admin/blog/posts/${testPost._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.title).toBe(updateData.title);
      expect(response.body.data.post.excerpt).toBe(updateData.excerpt);
    });

    it('should validate update data', async () => {
      const invalidData = { title: 'Hi' }; // Too short

      const response = await request(app)
        .put(`/api/super-admin/blog/posts/${testPost._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent post', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = { title: 'Updated Title' };

      const response = await request(app)
        .put(`/api/super-admin/blog/posts/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/super-admin/blog/posts/:postId', () => {
    it('should soft delete a blog post', async () => {
      // Create a post to delete
      const postToDelete = await HealthBlogPost.create({
        title: 'Post to Delete',
        slug: 'post-to-delete',
        excerpt: 'This post will be deleted',
        content: 'This is the content of the post that will be deleted. It has enough content to meet requirements.',
        featuredImage: {
          url: 'https://example.com/delete.jpg',
          alt: 'Delete image',
        },
        category: 'wellness',
        tags: ['delete', 'test'],
        author: {
          id: superAdminUser._id,
          name: `${superAdminUser.firstName} ${superAdminUser.lastName}`,
        },
        status: 'draft',
        createdBy: superAdminUser._id,
      });

      const response = await request(app)
        .delete(`/api/super-admin/blog/posts/${postToDelete._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify post is soft deleted
      const deletedPost = await HealthBlogPost.findById(postToDelete._id);
      expect(deletedPost?.isDeleted).toBe(true);
    });

    it('should return 404 for non-existent post', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/super-admin/blog/posts/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/super-admin/blog/posts/:postId/publish', () => {
    it('should publish a draft post', async () => {
      const response = await request(app)
        .post(`/api/super-admin/blog/posts/${testPost._id}/publish`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.status).toBe('published');
      expect(response.body.data.post.publishedAt).toBeDefined();
    });

    it('should return 404 for non-existent post', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/super-admin/blog/posts/${nonExistentId}/publish`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/super-admin/blog/posts/:postId/unpublish', () => {
    it('should unpublish a published post', async () => {
      // First publish the post
      await HealthBlogPost.findByIdAndUpdate(testPost._id, {
        status: 'published',
        publishedAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/super-admin/blog/posts/${testPost._id}/unpublish`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.status).toBe('draft');
    });
  });

  describe('POST /api/super-admin/blog/upload-image', () => {
    it('should upload a blog image', async () => {
      const response = await request(app)
        .post('/api/super-admin/blog/upload-image')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('image', Buffer.from('fake image data'), 'test.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.image).toBeDefined();
      expect(response.body.data.image.url).toBeDefined();
    });

    it('should return error when no file is provided', async () => {
      const response = await request(app)
        .post('/api/super-admin/blog/upload-image')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/super-admin/blog/analytics', () => {
    it('should return blog analytics', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/analytics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.analytics).toBeDefined();
      expect(response.body.data.analytics.overview).toBeDefined();
      expect(response.body.data.analytics.categoryStats).toBeDefined();
      expect(response.body.data.analytics.publishingTrends).toBeDefined();
    });
  });

  describe('GET /api/super-admin/blog/stats', () => {
    it('should return blog statistics', async () => {
      const response = await request(app)
        .get('/api/super-admin/blog/stats')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.overview).toBeDefined();
    });
  });
});