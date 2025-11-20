import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import User from '../../../models/User';
import HealthBlogPost from '../../../models/HealthBlogPost';
import { generateToken } from '../../../utils/token';

describe('Health Blog Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Express;
  let superAdminUser: any;
  let superAdminToken: string;
  let testBlogPost: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    testApp = app;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create super admin user
    superAdminUser = await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@test.com',
      password: 'password123',
      role: 'super_admin',
      isEmailVerified: true,
      status: 'active'
    });

    superAdminToken = generateToken(superAdminUser._id);

    // Create test blog post
    testBlogPost = await HealthBlogPost.create({
      title: 'Test Health Article',
      slug: 'test-health-article',
      excerpt: 'A test article about health',
      content: 'This is a comprehensive test article about health and wellness.',
      category: 'wellness',
      tags: ['health', 'wellness', 'test'],
      author: {
        id: superAdminUser._id,
        name: `${superAdminUser.firstName} ${superAdminUser.lastName}`,
        avatar: 'https://example.com/avatar.jpg'
      },
      status: 'published',
      publishedAt: new Date(),
      readTime: 5,
      viewCount: 0,
      isFeatured: true,
      seo: {
        metaTitle: 'Test Health Article - Meta Title',
        metaDescription: 'Meta description for test health article',
        keywords: ['health', 'wellness', 'test']
      },
      createdBy: superAdminUser._id
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await HealthBlogPost.deleteMany({});
  });

  describe('Public Blog API', () => {
    describe('GET /api/public/blog/posts', () => {
      it('should return published blog posts without authentication', async () => {
        const response = await request(testApp)
          .get('/api/public/blog/posts')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].title).toBe('Test Health Article');
        expect(response.body.data.posts[0].status).toBe('published');
      });

      it('should filter posts by category', async () => {
        // Create another post with different category
        await HealthBlogPost.create({
          title: 'Nutrition Article',
          slug: 'nutrition-article',
          excerpt: 'About nutrition',
          content: 'Nutrition content',
          category: 'nutrition',
          tags: ['nutrition'],
          author: {
            id: superAdminUser._id,
            name: `${superAdminUser.firstName} ${superAdminUser.lastName}`
          },
          status: 'published',
          publishedAt: new Date(),
          readTime: 3,
          viewCount: 0,
          createdBy: superAdminUser._id
        });

        const response = await request(testApp)
          .get('/api/public/blog/posts?category=wellness')
          .expect(200);

        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].category).toBe('wellness');
      });

      it('should paginate results correctly', async () => {
        // Create additional posts
        for (let i = 1; i <= 5; i++) {
          await HealthBlogPost.create({
            title: `Test Article ${i}`,
            slug: `test-article-${i}`,
            excerpt: `Test excerpt ${i}`,
            content: `Test content ${i}`,
            category: 'wellness',
            tags: ['test'],
            author: {
              id: superAdminUser._id,
              name: `${superAdminUser.firstName} ${superAdminUser.lastName}`
            },
            status: 'published',
            publishedAt: new Date(Date.now() - i * 1000),
            readTime: 2,
            viewCount: 0,
            createdBy: superAdminUser._id
          });
        }

        const response = await request(testApp)
          .get('/api/public/blog/posts?limit=3&page=1')
          .expect(200);

        expect(response.body.data.posts).toHaveLength(3);
        expect(response.body.data.pagination.totalPages).toBeGreaterThan(1);
      });

      it('should not return draft posts', async () => {
        // Create draft post
        await HealthBlogPost.create({
          title: 'Draft Article',
          slug: 'draft-article',
          excerpt: 'Draft excerpt',
          content: 'Draft content',
          category: 'wellness',
          tags: ['draft'],
          author: {
            id: superAdminUser._id,
            name: `${superAdminUser.firstName} ${superAdminUser.lastName}`
          },
          status: 'draft',
          readTime: 2,
          viewCount: 0,
          createdBy: superAdminUser._id
        });

        const response = await request(testApp)
          .get('/api/public/blog/posts')
          .expect(200);

        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].status).toBe('published');
      });
    });

    describe('GET /api/public/blog/posts/:slug', () => {
      it('should return specific blog post by slug', async () => {
        const response = await request(testApp)
          .get('/api/public/blog/posts/test-health-article')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Test Health Article');
        expect(response.body.data.slug).toBe('test-health-article');
        expect(response.body.data.content).toContain('comprehensive test article');
      });

      it('should increment view count when accessing post', async () => {
        const initialViewCount = testBlogPost.viewCount;

        await request(testApp)
          .get('/api/public/blog/posts/test-health-article')
          .expect(200);

        const updatedPost = await HealthBlogPost.findById(testBlogPost._id);
        expect(updatedPost?.viewCount).toBe(initialViewCount + 1);
      });

      it('should return 404 for non-existent slug', async () => {
        const response = await request(testApp)
          .get('/api/public/blog/posts/non-existent-slug')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      it('should return 404 for draft post slug', async () => {
        const draftPost = await HealthBlogPost.create({
          title: 'Draft Article',
          slug: 'draft-article',
          excerpt: 'Draft excerpt',
          content: 'Draft content',
          category: 'wellness',
          tags: ['draft'],
          author: {
            id: superAdminUser._id,
            name: `${superAdminUser.firstName} ${superAdminUser.lastName}`
          },
          status: 'draft',
          readTime: 2,
          viewCount: 0,
          createdBy: superAdminUser._id
        });

        await request(testApp)
          .get('/api/public/blog/posts/draft-article')
          .expect(404);
      });
    });

    describe('GET /api/public/blog/featured', () => {
      it('should return featured blog posts', async () => {
        const response = await request(testApp)
          .get('/api/public/blog/featured')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].isFeatured).toBe(true);
      });

      it('should limit featured posts to specified number', async () => {
        // Create additional featured posts
        for (let i = 1; i <= 3; i++) {
          await HealthBlogPost.create({
            title: `Featured Article ${i}`,
            slug: `featured-article-${i}`,
            excerpt: `Featured excerpt ${i}`,
            content: `Featured content ${i}`,
            category: 'wellness',
            tags: ['featured'],
            author: {
              id: superAdminUser._id,
              name: `${superAdminUser.firstName} ${superAdminUser.lastName}`
            },
            status: 'published',
            publishedAt: new Date(),
            readTime: 2,
            viewCount: 0,
            isFeatured: true,
            createdBy: superAdminUser._id
          });
        }

        const response = await request(testApp)
          .get('/api/public/blog/featured?limit=2')
          .expect(200);

        expect(response.body.data).toHaveLength(2);
      });
    });

    describe('GET /api/public/blog/search', () => {
      it('should search posts by query', async () => {
        const response = await request(testApp)
          .get('/api/public/blog/search?q=health')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].title).toContain('Health');
      });

      it('should return empty results for non-matching query', async () => {
        const response = await request(testApp)
          .get('/api/public/blog/search?q=nonexistent')
          .expect(200);

        expect(response.body.data.posts).toHaveLength(0);
      });
    });
  });

  describe('Super Admin Blog API', () => {
    describe('POST /api/super-admin/blog/posts', () => {
      it('should create new blog post with super admin authentication', async () => {
        const newPostData = {
          title: 'New Health Article',
          excerpt: 'New article excerpt',
          content: 'New article content with comprehensive information.',
          category: 'nutrition',
          tags: ['nutrition', 'health'],
          featuredImage: {
            url: 'https://example.com/image.jpg',
            alt: 'Featured image',
            caption: 'Image caption'
          },
          seo: {
            metaTitle: 'New Health Article - SEO Title',
            metaDescription: 'SEO description',
            keywords: ['nutrition', 'health']
          },
          isFeatured: false
        };

        const response = await request(testApp)
          .post('/api/super-admin/blog/posts')
          .set('Cookie', `token=${superAdminToken}`)
          .send(newPostData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(newPostData.title);
        expect(response.body.data.slug).toBe('new-health-article');
        expect(response.body.data.status).toBe('draft');
        expect(response.body.data.readTime).toBeGreaterThan(0);
      });

      it('should reject request without super admin authentication', async () => {
        const newPostData = {
          title: 'Unauthorized Post',
          excerpt: 'Should not be created',
          content: 'Content',
          category: 'wellness',
          tags: ['test']
        };

        await request(testApp)
          .post('/api/super-admin/blog/posts')
          .send(newPostData)
          .expect(401);
      });

      it('should validate required fields', async () => {
        const invalidPostData = {
          excerpt: 'Missing title',
          content: 'Content'
        };

        const response = await request(testApp)
          .post('/api/super-admin/blog/posts')
          .set('Cookie', `token=${superAdminToken}`)
          .send(invalidPostData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should generate unique slug for duplicate titles', async () => {
        const postData = {
          title: 'Test Health Article', // Same as existing post
          excerpt: 'Duplicate title test',
          content: 'Content for duplicate title test',
          category: 'wellness',
          tags: ['test']
        };

        const response = await request(testApp)
          .post('/api/super-admin/blog/posts')
          .set('Cookie', `token=${superAdminToken}`)
          .send(postData)
          .expect(201);

        expect(response.body.data.slug).toBe('test-health-article-1');
      });
    });

    describe('PUT /api/super-admin/blog/posts/:postId', () => {
      it('should update existing blog post', async () => {
        const updateData = {
          title: 'Updated Health Article',
          excerpt: 'Updated excerpt',
          content: 'Updated content with new information.',
          category: 'nutrition',
          tags: ['updated', 'health']
        };

        const response = await request(testApp)
          .put(`/api/super-admin/blog/posts/${testBlogPost._id}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(updateData.title);
        expect(response.body.data.category).toBe(updateData.category);
      });

      it('should return 404 for non-existent post', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        const updateData = { title: 'Updated Title' };

        await request(testApp)
          .put(`/api/super-admin/blog/posts/${nonExistentId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send(updateData)
          .expect(404);
      });
    });

    describe('DELETE /api/super-admin/blog/posts/:postId', () => {
      it('should soft delete blog post', async () => {
        const response = await request(testApp)
          .delete(`/api/super-admin/blog/posts/${testBlogPost._id}`)
          .set('Cookie', `token=${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify post is soft deleted
        const deletedPost = await HealthBlogPost.findById(testBlogPost._id);
        expect(deletedPost?.isDeleted).toBe(true);

        // Verify post doesn't appear in public API
        const publicResponse = await request(testApp)
          .get('/api/public/blog/posts')
          .expect(200);

        expect(publicResponse.body.data.posts).toHaveLength(0);
      });
    });

    describe('POST /api/super-admin/blog/posts/:postId/publish', () => {
      it('should publish draft post', async () => {
        // Create draft post
        const draftPost = await HealthBlogPost.create({
          title: 'Draft Post',
          slug: 'draft-post',
          excerpt: 'Draft excerpt',
          content: 'Draft content',
          category: 'wellness',
          tags: ['draft'],
          author: {
            id: superAdminUser._id,
            name: `${superAdminUser.firstName} ${superAdminUser.lastName}`
          },
          status: 'draft',
          readTime: 2,
          viewCount: 0,
          createdBy: superAdminUser._id
        });

        const response = await request(testApp)
          .post(`/api/super-admin/blog/posts/${draftPost._id}/publish`)
          .set('Cookie', `token=${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('published');
        expect(response.body.data.publishedAt).toBeDefined();
      });
    });

    describe('POST /api/super-admin/blog/posts/:postId/unpublish', () => {
      it('should unpublish published post', async () => {
        const response = await request(testApp)
          .post(`/api/super-admin/blog/posts/${testBlogPost._id}/unpublish`)
          .set('Cookie', `token=${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('draft');
      });
    });

    describe('GET /api/super-admin/blog/posts', () => {
      it('should return all posts including drafts for admin', async () => {
        // Create draft post
        await HealthBlogPost.create({
          title: 'Admin Draft Post',
          slug: 'admin-draft-post',
          excerpt: 'Admin draft excerpt',
          content: 'Admin draft content',
          category: 'wellness',
          tags: ['admin', 'draft'],
          author: {
            id: superAdminUser._id,
            name: `${superAdminUser.firstName} ${superAdminUser.lastName}`
          },
          status: 'draft',
          readTime: 2,
          viewCount: 0,
          createdBy: superAdminUser._id
        });

        const response = await request(testApp)
          .get('/api/super-admin/blog/posts')
          .set('Cookie', `token=${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(2);
        
        const statuses = response.body.data.posts.map((post: any) => post.status);
        expect(statuses).toContain('published');
        expect(statuses).toContain('draft');
      });

      it('should filter posts by status', async () => {
        const response = await request(testApp)
          .get('/api/super-admin/blog/posts?status=published')
          .set('Cookie', `token=${superAdminToken}`)
          .expect(200);

        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].status).toBe('published');
      });
    });

    describe('GET /api/super-admin/blog/analytics', () => {
      it('should return blog analytics data', async () => {
        const response = await request(testApp)
          .get('/api/super-admin/blog/analytics')
          .set('Cookie', `token=${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalPosts');
        expect(response.body.data).toHaveProperty('publishedPosts');
        expect(response.body.data).toHaveProperty('draftPosts');
        expect(response.body.data).toHaveProperty('totalViews');
        expect(response.body.data).toHaveProperty('popularPosts');
        expect(response.body.data).toHaveProperty('categoryDistribution');
      });
    });
  });

  describe('File Upload', () => {
    describe('POST /api/super-admin/blog/upload-image', () => {
      it('should upload featured image', async () => {
        // Mock file upload - in real tests, you'd use actual file buffer
        const mockImageBuffer = Buffer.from('fake-image-data');
        
        const response = await request(testApp)
          .post('/api/super-admin/blog/upload-image')
          .set('Cookie', `token=${superAdminToken}`)
          .attach('image', mockImageBuffer, 'test-image.jpg')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('url');
        expect(response.body.data.url).toContain('http');
      });

      it('should reject non-image files', async () => {
        const mockTextBuffer = Buffer.from('not-an-image');
        
        await request(testApp)
          .post('/api/super-admin/blog/upload-image')
          .set('Cookie', `token=${superAdminToken}`)
          .attach('image', mockTextBuffer, 'test.txt')
          .expect(400);
      });

      it('should reject files exceeding size limit', async () => {
        // Create buffer larger than allowed limit (assuming 5MB limit)
        const largeMockBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
        
        await request(testApp)
          .post('/api/super-admin/blog/upload-image')
          .set('Cookie', `token=${superAdminToken}`)
          .attach('image', largeMockBuffer, 'large-image.jpg')
          .expect(400);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to public endpoints', async () => {
      // Make multiple requests quickly
      const requests = Array(20).fill(null).map(() => 
        request(testApp).get('/api/public/blog/posts')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply stricter rate limiting to admin endpoints', async () => {
      // Make multiple admin requests quickly
      const requests = Array(10).fill(null).map(() => 
        request(testApp)
          .get('/api/super-admin/blog/posts')
          .set('Cookie', `token=${superAdminToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation and Security', () => {
    it('should sanitize HTML content in blog posts', async () => {
      const maliciousPostData = {
        title: 'Test Post',
        excerpt: 'Clean excerpt',
        content: '<script>alert("xss")</script><p>Safe content</p>',
        category: 'wellness',
        tags: ['test']
      };

      const response = await request(testApp)
        .post('/api/super-admin/blog/posts')
        .set('Cookie', `token=${superAdminToken}`)
        .send(maliciousPostData)
        .expect(201);

      expect(response.body.data.content).not.toContain('<script>');
      expect(response.body.data.content).toContain('<p>Safe content</p>');
    });

    it('should validate category values', async () => {
      const invalidPostData = {
        title: 'Test Post',
        excerpt: 'Test excerpt',
        content: 'Test content',
        category: 'invalid_category',
        tags: ['test']
      };

      await request(testApp)
        .post('/api/super-admin/blog/posts')
        .set('Cookie', `token=${superAdminToken}`)
        .send(invalidPostData)
        .expect(400);
    });

    it('should limit tag count and length', async () => {
      const postWithManyTags = {
        title: 'Test Post',
        excerpt: 'Test excerpt',
        content: 'Test content',
        category: 'wellness',
        tags: Array(20).fill(null).map((_, i) => `tag${i}`) // Too many tags
      };

      await request(testApp)
        .post('/api/super-admin/blog/posts')
        .set('Cookie', `token=${superAdminToken}`)
        .send(postWithManyTags)
        .expect(400);
    });
  });

  describe('SEO and Metadata', () => {
    it('should auto-generate slug from title', async () => {
      const postData = {
        title: 'This is a Test Article with Special Characters!@#',
        excerpt: 'Test excerpt',
        content: 'Test content',
        category: 'wellness',
        tags: ['test']
      };

      const response = await request(testApp)
        .post('/api/super-admin/blog/posts')
        .set('Cookie', `token=${superAdminToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.data.slug).toBe('this-is-a-test-article-with-special-characters');
    });

    it('should calculate read time based on content length', async () => {
      const longContent = 'word '.repeat(500); // ~500 words
      const postData = {
        title: 'Long Article',
        excerpt: 'Long article excerpt',
        content: longContent,
        category: 'wellness',
        tags: ['test']
      };

      const response = await request(testApp)
        .post('/api/super-admin/blog/posts')
        .set('Cookie', `token=${superAdminToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.data.readTime).toBeGreaterThan(1);
    });

    it('should include SEO metadata in responses', async () => {
      const response = await request(testApp)
        .get('/api/public/blog/posts/test-health-article')
        .expect(200);

      expect(response.body.data.seo).toBeDefined();
      expect(response.body.data.seo.metaTitle).toBeDefined();
      expect(response.body.data.seo.metaDescription).toBeDefined();
      expect(response.body.data.seo.keywords).toBeInstanceOf(Array);
    });
  });
});