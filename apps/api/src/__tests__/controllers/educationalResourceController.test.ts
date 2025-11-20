import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import EducationalResource from '../../models/EducationalResource';
import Patient from '../../models/Patient';
import PatientUser from '../../models/PatientUser';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { generateToken } from '../../utils/auth';

describe('EducationalResourceController', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let patientUserId: mongoose.Types.ObjectId;
  let adminUserId: mongoose.Types.ObjectId;
  let patientToken: string;
  let adminToken: string;
  let sampleResources: any[];

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
    // Clear all collections
    await Promise.all([
      EducationalResource.deleteMany({}),
      Patient.deleteMany({}),
      PatientUser.deleteMany({}),
      User.deleteMany({}),
      Workplace.deleteMany({}),
    ]);

    workplaceId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
    patientUserId = new mongoose.Types.ObjectId();
    adminUserId = new mongoose.Types.ObjectId();

    // Create test workplace
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

    // Create test admin user
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

    // Create test patient
    await Patient.create({
      _id: patientId,
      workplaceId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+2348012345678',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'male',
      chronicConditions: [
        { condition: 'diabetes', diagnosedDate: new Date(), status: 'active' },
      ],
      createdBy: adminUserId,
      isDeleted: false,
    });

    // Create test patient user
    await PatientUser.create({
      _id: patientUserId,
      patientId,
      workplaceId,
      email: 'john.doe@example.com',
      password: 'hashedpassword',
      status: 'active',
      isActive: true,
    });

    // Generate tokens
    patientToken = generateToken({ 
      userId: patientUserId, 
      patientId, 
      workplaceId, 
      role: 'patient' 
    });
    adminToken = generateToken({ 
      userId: adminUserId, 
      workplaceId, 
      role: 'admin' 
    });
  });
});    // Cre
ate sample educational resources
    sampleResources = await EducationalResource.create([
      {
        title: 'Understanding Diabetes Management',
        description: 'Comprehensive guide to managing diabetes effectively',
        content: 'Detailed content about diabetes management...',
        category: 'condition',
        tags: ['diabetes', 'management'],
        mediaType: 'article',
        isPublished: true,
        publishedAt: new Date(),
        viewCount: 100,
        targetAudience: { conditions: ['diabetes'] },
        localizedFor: 'nigeria',
        language: 'en',
        difficulty: 'beginner',
        slug: 'understanding-diabetes-management',
        accessLevel: 'public',
        workplaceId,
        createdBy: adminUserId,
        isDeleted: false,
      },
      {
        title: 'Patient Only Resource',
        description: 'Resource for patients only',
        content: 'Content for patients...',
        category: 'wellness',
        tags: ['wellness'],
        mediaType: 'article',
        isPublished: true,
        publishedAt: new Date(),
        viewCount: 50,
        localizedFor: 'nigeria',
        language: 'en',
        difficulty: 'beginner',
        slug: 'patient-only-resource',
        accessLevel: 'patient_only',
        workplaceId,
        createdBy: adminUserId,
        isDeleted: false,
      },
      {
        title: 'Draft Resource',
        description: 'Unpublished draft resource',
        content: 'Draft content...',
        category: 'faq',
        tags: ['draft'],
        mediaType: 'article',
        isPublished: false,
        viewCount: 0,
        localizedFor: 'nigeria',
        language: 'en',
        difficulty: 'beginner',
        slug: 'draft-resource',
        accessLevel: 'public',
        workplaceId,
        createdBy: adminUserId,
        isDeleted: false,
      },
    ]);
  });

  describe('GET /api/educational-resources/public', () => {
    it('should retrieve public resources', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toHaveLength(1); // Only public published resources
      expect(response.body.data.resources[0].accessLevel).toBe('public');
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public?category=condition')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toHaveLength(1);
      expect(response.body.data.resources[0].category).toBe('condition');
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public?limit=1&page=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.page).toBe(1);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public?category=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/educational-resources/public/slug/:slug', () => {
    it('should retrieve resource by slug', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public/slug/understanding-diabetes-management')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resource.title).toBe('Understanding Diabetes Management');
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public/slug/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return 404 for patient-only resource', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public/slug/patient-only-resource')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate slug format', async () => {
      const response = await request(app)
        .get('/api/educational-resources/public/slug/Invalid_Slug!')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/educational-resources/patient', () => {
    it('should retrieve resources for authenticated patient', async () => {
      const response = await request(app)
        .get('/api/educational-resources/patient')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toHaveLength(2); // Public + patient_only
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/educational-resources/patient')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/educational-resources/patient/recommendations', () => {
    it('should get personalized recommendations', async () => {
      const response = await request(app)
        .get('/api/educational-resources/patient/recommendations')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });

    it('should require patient authentication', async () => {
      const response = await request(app)
        .get('/api/educational-resources/patient/recommendations')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/educational-resources/patient/:resourceId/rate', () => {
    it('should rate a resource', async () => {
      const resourceId = sampleResources[0]._id;
      
      const response = await request(app)
        .post(`/api/educational-resources/patient/${resourceId}/rate`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ rating: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Resource rated successfully');
    });

    it('should validate rating value', async () => {
      const resourceId = sampleResources[0]._id;
      
      const response = await request(app)
        .post(`/api/educational-resources/patient/${resourceId}/rate`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ rating: 6 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate resource ID format', async () => {
      const response = await request(app)
        .post('/api/educational-resources/patient/invalid-id/rate')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ rating: 5 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Admin endpoints', () => {
    describe('GET /api/educational-resources/admin', () => {
      it('should retrieve admin resources', async () => {
        const response = await request(app)
          .get('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.resources).toHaveLength(3); // All resources including drafts
      });

      it('should filter by status', async () => {
        const response = await request(app)
          .get('/api/educational-resources/admin?status=published')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.resources).toHaveLength(2); // Only published
      });

      it('should require admin authentication', async () => {
        const response = await request(app)
          .get('/api/educational-resources/admin')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/educational-resources/admin', () => {
      it('should create new resource', async () => {
        const resourceData = {
          title: 'New Educational Resource',
          description: 'Description for new resource',
          content: 'Content for the new educational resource...',
          category: 'wellness',
          mediaType: 'article',
          difficulty: 'beginner',
          isPublished: true,
        };

        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(resourceData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.resource.title).toBe(resourceData.title);
        expect(response.body.data.resource.slug).toBeDefined();
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/educational-resources/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });
    });

    describe('PUT /api/educational-resources/admin/:resourceId', () => {
      it('should update existing resource', async () => {
        const resourceId = sampleResources[0]._id;
        const updateData = {
          title: 'Updated Resource Title',
          description: 'Updated description for the resource',
        };

        const response = await request(app)
          .put(`/api/educational-resources/admin/${resourceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.resource.title).toBe(updateData.title);
      });

      it('should return 404 for non-existent resource', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        const response = await request(app)
          .put(`/api/educational-resources/admin/${nonExistentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Title' })
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/educational-resources/admin/:resourceId', () => {
      it('should delete resource', async () => {
        const resourceId = sampleResources[0]._id;

        const response = await request(app)
          .delete(`/api/educational-resources/admin/${resourceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Educational resource deleted successfully');
      });

      it('should return 404 for non-existent resource', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        const response = await request(app)
          .delete(`/api/educational-resources/admin/${nonExistentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/educational-resources/admin/analytics', () => {
      it('should retrieve resource analytics', async () => {
        const response = await request(app)
          .get('/api/educational-resources/admin/analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.analytics).toBeDefined();
        expect(response.body.data.analytics.totalResources).toBeDefined();
        expect(response.body.data.analytics.publishedResources).toBeDefined();
      });

      it('should handle date range filter', async () => {
        const startDate = '2023-01-01';
        const endDate = '2023-12-31';
        
        const response = await request(app)
          .get(`/api/educational-resources/admin/analytics?startDate=${startDate}&endDate=${endDate}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to public endpoints', async () => {
      // Make multiple requests to test rate limiting
      const promises = Array(101).fill(null).map(() =>
        request(app).get('/api/educational-resources/public')
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});