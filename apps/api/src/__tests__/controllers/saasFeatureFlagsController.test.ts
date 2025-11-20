import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../setup';
import { User } from '../../models/User';
import { FeatureFlag } from '../../models/FeatureFlag';
import jwt from 'jsonwebtoken';

describe('SaaS Feature Flags Controller', () => {
  let app: Express;
  let superAdminToken: string;
  let regularUserToken: string;
  let testFeatureFlag: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    // Create test users
    const superAdmin = await User.create({
      email: 'superadmin@test.com',
      password: 'password123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      isActive: true,
      isEmailVerified: true
    });

    const regularUser = await User.create({
      email: 'user@test.com',
      password: 'password123',
      firstName: 'Regular',
      lastName: 'User',
      role: 'pharmacist',
      isActive: true,
      isEmailVerified: true
    });

    // Create test feature flag
    testFeatureFlag = await FeatureFlag.create({
      name: 'Test Feature',
      key: 'test_feature',
      description: 'A test feature flag',
      isActive: true,
      allowedTiers: ['basic', 'premium'],
      allowedRoles: ['pharmacist', 'manager'],
      customRules: {
        targeting: {
          percentage: 50,
          pharmacies: [],
          userGroups: ['beta_users']
        }
      },
      metadata: {
        category: 'testing',
        priority: 'medium',
        tags: ['test', 'beta']
      }
    });

    // Generate tokens
    superAdminToken = jwt.sign(
      { userId: superAdmin._id, role: 'super_admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    regularUserToken = jwt.sign(
      { userId: regularUser._id, role: 'pharmacist' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    await User.deleteMany({});
    await FeatureFlag.deleteMany({});
  });

  describe('GET /api/admin/saas/feature-flags', () => {
    it('should return enhanced feature flags list for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/feature-flags')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('featureFlags');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('categories');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.featureFlags)).toBe(true);
      
      // Check if usage metrics are included
      if (response.body.data.featureFlags.length > 0) {
        expect(response.body.data.featureFlags[0]).toHaveProperty('usageMetrics');
      }
    });

    it('should filter feature flags by search term', async () => {
      const response = await request(app)
        .get('/api/admin/saas/feature-flags?search=test')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.search).toBe('test');
    });

    it('should filter feature flags by category', async () => {
      const response = await request(app)
        .get('/api/admin/saas/feature-flags?category=testing')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.category).toBe('testing');
    });

    it('should filter feature flags by active status', async () => {
      const response = await request(app)
        .get('/api/admin/saas/feature-flags?isActive=true')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.isActive).toBe('true');
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/saas/feature-flags?page=1&limit=5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags?page=0')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });
  });

  describe('PUT /api/admin/saas/feature-flags/:flagId/targeting', () => {
    it('should update targeting rules successfully', async () => {
      const targetingRules = {
        percentage: 75,
        pharmacies: ['pharmacy1', 'pharmacy2'],
        userGroups: ['beta_users', 'premium_users'],
        subscriptionPlans: ['premium'],
        conditions: {
          userAttributes: { region: 'US' },
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      };

      const response = await request(app)
        .put(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/targeting`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetingRules })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.flagId).toBe(testFeatureFlag._id.toString());
      expect(response.body.data.targetingRules.percentage).toBe(75);
    });

    it('should validate targeting rules format', async () => {
      const invalidRules = {
        percentage: 150, // Invalid percentage
        pharmacies: 'not-an-array'
      };

      await request(app)
        .put(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/targeting`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetingRules: invalidRules })
        .expect(400);
    });

    it('should require valid feature flag ID', async () => {
      await request(app)
        .put('/api/admin/saas/feature-flags/invalid-id/targeting')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetingRules: { percentage: 50 } })
        .expect(400);
    });

    it('should return 404 for non-existent feature flag', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .put(`/api/admin/saas/feature-flags/${nonExistentId}/targeting`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetingRules: { percentage: 50 } })
        .expect(404);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .put(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/targeting`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ targetingRules: { percentage: 50 } })
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/feature-flags/usage-metrics', () => {
    it('should return usage metrics for all flags', async () => {
      const response = await request(app)
        .get('/api/admin/saas/feature-flags/usage-metrics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.metrics)).toBe(true);
    });

    it('should return usage metrics for specific flag', async () => {
      const response = await request(app)
        .get(`/api/admin/saas/feature-flags/usage-metrics?flagId=${testFeatureFlag._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data.metrics).toHaveProperty('flagId');
      expect(response.body.data.metrics.flagId).toBe(testFeatureFlag._id.toString());
    });

    it('should accept time range parameter', async () => {
      const response = await request(app)
        .get('/api/admin/saas/feature-flags/usage-metrics?timeRange=7d')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.timeRange).toBe('7d');
    });

    it('should validate time range parameter', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags/usage-metrics?timeRange=invalid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should validate flag ID parameter', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags/usage-metrics?flagId=invalid-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent flag', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/admin/saas/feature-flags/usage-metrics?flagId=${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags/usage-metrics')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/feature-flags/:flagId/impact', () => {
    it('should return impact analysis for feature flag', async () => {
      const response = await request(app)
        .get(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/impact`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('flagId');
      expect(response.body.data).toHaveProperty('flagName');
      expect(response.body.data).toHaveProperty('impact');
      expect(response.body.data.flagId).toBe(testFeatureFlag._id.toString());
    });

    it('should require valid feature flag ID', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags/invalid-id/impact')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent feature flag', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/admin/saas/feature-flags/${nonExistentId}/impact`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/impact`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/saas/feature-flags/bulk-update', () => {
    it('should update multiple feature flags successfully', async () => {
      const updates = {
        isActive: false,
        'metadata.priority': 'high'
      };

      const response = await request(app)
        .post('/api/admin/saas/feature-flags/bulk-update')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          flagIds: [testFeatureFlag._id.toString()],
          updates
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalFlags');
      expect(response.body.data).toHaveProperty('successfulUpdates');
      expect(response.body.data).toHaveProperty('failedUpdates');
      expect(response.body.data.totalFlags).toBe(1);
    });

    it('should require flag IDs array', async () => {
      await request(app)
        .post('/api/admin/saas/feature-flags/bulk-update')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          updates: { isActive: false }
        })
        .expect(400);
    });

    it('should require updates object', async () => {
      await request(app)
        .post('/api/admin/saas/feature-flags/bulk-update')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          flagIds: [testFeatureFlag._id.toString()]
        })
        .expect(400);
    });

    it('should validate flag ID formats', async () => {
      await request(app)
        .post('/api/admin/saas/feature-flags/bulk-update')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          flagIds: ['invalid-id'],
          updates: { isActive: false }
        })
        .expect(400);
    });

    it('should prevent updating protected fields', async () => {
      await request(app)
        .post('/api/admin/saas/feature-flags/bulk-update')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          flagIds: [testFeatureFlag._id.toString()],
          updates: { _id: 'new-id', key: 'new-key' }
        })
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post('/api/admin/saas/feature-flags/bulk-update')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          flagIds: [testFeatureFlag._id.toString()],
          updates: { isActive: false }
        })
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/feature-flags/:flagId/rollout', () => {
    it('should return rollout status for feature flag', async () => {
      const response = await request(app)
        .get(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/rollout`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('flagId');
      expect(response.body.data).toHaveProperty('flagName');
      expect(response.body.data).toHaveProperty('isActive');
      expect(response.body.data).toHaveProperty('rolloutPercentage');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should require valid feature flag ID', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags/invalid-id/rollout')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent feature flag', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/admin/saas/feature-flags/${nonExistentId}/rollout`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/rollout`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error by using invalid ObjectId
      const invalidId = 'invalid-object-id';
      
      await request(app)
        .get(`/api/admin/saas/feature-flags/${invalidId}/impact`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should handle missing authorization header', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags')
        .expect(401);
    });

    it('should handle invalid tokens', async () => {
      await request(app)
        .get('/api/admin/saas/feature-flags')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/admin/saas/feature-flags')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .get('/api/admin/saas/feature-flags')
          .set('Authorization', `Bearer ${superAdminToken}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});