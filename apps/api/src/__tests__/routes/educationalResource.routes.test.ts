import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import EducationalResource from '../../models/EducationalResource';
import PatientUser from '../../models/PatientUser';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { generateToken } from '../../utils/auth';

describe('Educational Resource Routes', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientUserId: mongoose.Types.ObjectId;
  let adminUserId: mongoose.Types.ObjectId;
  let patientToken: string;
  let adminToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections
    await Promise.all([
      EducationalResource.deleteMany({}),
      PatientUser.deleteMany({}),
      User.deleteMany({}),
      Workplace.deleteMany({}),
    ]);

    workplaceId = new mongoose.Types.ObjectId();
    patientUserId = new mongoose.Types.ObjectId();
    adminUserId = new mongoose.Types.ObjectId();

    // Create test data
    await Workplace.create({
      _id: workplaceId,
      name: 'Test Pharmacy',
      email: 'test@pharmacy.com',
      phone: '+2348012345678',
      address: 'Test Address',
      state: 'Lagos',
      lga: 'Ikeja',
      isActive: true,
      createdBy: adminUserId,
    });

    await User.create({
      _id: adminUserId,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'hashedpassword',
      role: 'admin',
      workplaceId,
      isActive: true,
    });

    await PatientUser.create({
      _id: patientUserId,
      patientId: new mongoose.Types.ObjectId(),
      workplaceId,
      email: 'patient@test.com',
      password: 'hashedpassword',
      status: 'active',
      isActive: true,
    });

    // Generate tokens
    patientToken = generateToken({ 
      userId: patientUserId, 
      patientId: new mongoose.Types.ObjectId(), 
      workplaceId, 
      role: 'patient' 
    });
    adminToken = generateToken({ 
      userId: adminUserId, 
      workplaceId, 
      role: 'admin' 
    });

    // Create sample resource
    await EducationalResource.create({
      title: 'Test Educational Resource',
      description: 'Test description for educational resource',
      content: 'Test content for the educational resource...',
      category: 'wellness',
      tags: ['test', 'wellness'],
      mediaType: 'article',
      isPublished: true,
      publishedAt: new Date(),
      viewCount: 10,
      localizedFor: 'nigeria',
      language: 'en',
      difficulty: 'beginner',
      slug: 'test-educational-resource',
      accessLevel: 'public',
      workplaceId,
      createdBy: adminUserId,
      isDeleted: false,
    });
  });

  describe('Route validation', () => {
    describe('Public routes validation', () => {
      it('should validate category parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?category=invalid-category')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors.some((err: any) => err.path === 'category')).toBe(true);
      });

      it('should validate mediaType parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?mediaType=invalid-type')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'mediaType')).toBe(true);
      });

      it('should validate difficulty parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?difficulty=invalid-difficulty')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'difficulty')).toBe(true);
      });

      it('should validate language parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?language=invalid-lang')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'language')).toBe(true);
      });

      it('should validate limit parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?limit=101')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'limit')).toBe(true);
      });

      it('should validate skip parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?skip=-1')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'skip')).toBe(true);
      });

      it('should validate page parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?page=0')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'page')).toBe(true);
      });

      it('should validate sortBy parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public?sortBy=invalid-sort')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'sortBy')).toBe(true);
      });
    });

    describe('Slug validation', () => {
      it('should validate slug format', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public/slug/Invalid_Slug!')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'slug')).toBe(true);
      });

      it('should accept valid slug', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public/slug/test-educational-resource')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Category validation', () => {
      it('should validate category in URL parameter', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public/category/invalid-category')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'category')).toBe(true);
      });

      it('should accept valid category', async () => {
        const response = await request(app)
          .get('/api/educational-resources/public/category/wellness')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Patient route validation', () => {
      it('should validate rating value', async () => {
        const resourceId = new mongoose.Types.ObjectId();
        
        const response = await request(app)
          .post(`/api/educational-resources/patient/${resourceId}/rate`)
          .set('Authorization', `Bearer ${patientToken}`)
          .send({ rating: 6 })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'rating')).toBe(true);
      });

      it('should validate resource ID format', async () => {
        const response = await request(app)
          .post('/api/educational-resources/patient/invalid-id/rate')
          .set('Authorization', `Bearer ${patientToken}`)
          .send({ rating: 5 })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'resourceId')).toBe(true);
      });

      it('should validate recommendations query parameters', async () => {
        const response = await request(app)
          .get('/api/educational-resources/patient/recommendations?limit=51')
          .set('Authorization', `Bearer ${patientToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'limit')).toBe(true);
      });
    });

    describe('Admin route validation', () => {
      it('should validate create resource data', async () => {
        const invalidData = {
          title: 'A', // Too short
          description: 'Short', // Too short
          content: 'Short', // Too short
          category: 'invalid-category',
          mediaType: 'invalid-type',
        };

        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors.length).toBeGreaterThan(0);
      });

      it('should validate tags array', async () => {
        const invalidData = {
          title: 'Valid Title for Testing',
          description: 'Valid description for testing resource creation',
          content: 'Valid content for the educational resource that meets minimum length requirements',
          category: 'wellness',
          mediaType: 'article',
          tags: Array(16).fill('tag'), // Too many tags
        };

        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'tags')).toBe(true);
      });

      it('should validate target audience arrays', async () => {
        const invalidData = {
          title: 'Valid Title for Testing',
          description: 'Valid description for testing resource creation',
          content: 'Valid content for the educational resource that meets minimum length requirements',
          category: 'wellness',
          mediaType: 'article',
          targetAudience: {
            conditions: Array(21).fill('condition'), // Too many conditions
            ageGroups: ['invalid-age-group'],
          },
        };

        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.length).toBeGreaterThan(0);
      });

      it('should validate sources array', async () => {
        const invalidData = {
          title: 'Valid Title for Testing',
          description: 'Valid description for testing resource creation',
          content: 'Valid content for the educational resource that meets minimum length requirements',
          category: 'wellness',
          mediaType: 'article',
          sources: Array(11).fill({ // Too many sources
            title: 'Source Title',
            type: 'journal',
          }),
        };

        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'sources')).toBe(true);
      });

      it('should validate URL fields', async () => {
        const invalidData = {
          title: 'Valid Title for Testing',
          description: 'Valid description for testing resource creation',
          content: 'Valid content for the educational resource that meets minimum length requirements',
          category: 'wellness',
          mediaType: 'article',
          mediaUrl: 'invalid-url',
          thumbnail: 'invalid-url',
        };

        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'mediaUrl')).toBe(true);
        expect(response.body.errors.some((err: any) => err.path === 'thumbnail')).toBe(true);
      });

      it('should validate numeric fields', async () => {
        const invalidData = {
          title: 'Valid Title for Testing',
          description: 'Valid description for testing resource creation',
          content: 'Valid content for the educational resource that meets minimum length requirements',
          category: 'wellness',
          mediaType: 'article',
          duration: 86401, // Too long (more than 24 hours)
          fileSize: 104857601, // Too large (more than 100MB)
        };

        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'duration')).toBe(true);
        expect(response.body.errors.some((err: any) => err.path === 'fileSize')).toBe(true);
      });

      it('should validate analytics date parameters', async () => {
        const response = await request(app)
          .get('/api/educational-resources/admin/analytics?startDate=invalid-date&endDate=invalid-date')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((err: any) => err.path === 'startDate')).toBe(true);
        expect(response.body.errors.some((err: any) => err.path === 'endDate')).toBe(true);
      });
    });
  });

  describe('Authentication and authorization', () => {
    it('should allow public access to public routes', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication for patient routes', async () => {
      const response = await request(app)
        .get('/api/educational-resources/patient')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for admin routes', async () => {
      const response = await request(app)
        .get('/api/educational-resources/admin')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/educational-resources/patient')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    it('should apply different rate limits to different endpoints', async () => {
      // Test public endpoint rate limit (100 requests per 15 minutes)
      const publicRequests = Array(5).fill(null).map(() =>
        request(app).get('/api/educational-resources/public')
      );

      const publicResponses = await Promise.all(publicRequests);
      expect(publicResponses.every(r => r.status === 200)).toBe(true);

      // Test patient endpoint rate limit (200 requests per 15 minutes)
      const patientRequests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/educational-resources/patient')
          .set('Authorization', `Bearer ${patientToken}`)
      );

      const patientResponses = await Promise.all(patientRequests);
      expect(patientResponses.every(r => r.status === 200)).toBe(true);

      // Test admin endpoint rate limit (500 requests per 15 minutes)
      const adminRequests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const adminResponses = await Promise.all(adminRequests);
      expect(adminResponses.every(r => r.status === 200)).toBe(true);
    });

    it('should apply stricter rate limits to write operations', async () => {
      const resourceData = {
        title: 'Rate Limit Test Resource',
        description: 'Testing rate limits for resource creation',
        content: 'Content for rate limit testing resource...',
        category: 'wellness',
        mediaType: 'article',
      };

      // Test create resource rate limit (50 creates per hour)
      const createRequests = Array(3).fill(null).map((_, index) =>
        request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...resourceData, title: `${resourceData.title} ${index}` })
      );

      const createResponses = await Promise.all(createRequests);
      expect(createResponses.every(r => r.status === 201)).toBe(true);
    });
  });

  describe('Content-Type handling', () => {
    it('should handle JSON content type for POST requests', async () => {
      const resourceData = {
        title: 'JSON Content Type Test',
        description: 'Testing JSON content type handling',
        content: 'Content for JSON content type test...',
        category: 'wellness',
        mediaType: 'article',
      };

      const response = await request(app)
        .post('/api/educational-resources/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send(resourceData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject non-JSON content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/educational-resources/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});