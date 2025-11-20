import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../setup';
import { User } from '../../models/User';
import { FeatureFlag } from '../../models/FeatureFlag';
import jwt from 'jsonwebtoken';

describe('SaaS Routes Integration', () => {
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
      name: 'Integration Test Feature',
      key: 'integration_test_feature',
      description: 'A feature flag for integration testing',
      isActive: true,
      allowedTiers: ['basic', 'premium'],
      allowedRoles: ['pharmacist', 'manager'],
      metadata: {
        category: 'testing',
        priority: 'medium',
        tags: ['integration', 'test']
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

  describe('SaaS Overview Integration', () => {
    it('should provide comprehensive system overview', async () => {
      // Test system metrics
      const metricsResponse = await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data).toHaveProperty('totalUsers');

      // Test system health
      const healthResponse = await request(app)
        .get('/api/admin/saas/overview/health')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data).toHaveProperty('database');

      // Test comprehensive overview
      const overviewResponse = await request(app)
        .get('/api/admin/saas/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(overviewResponse.body.success).toBe(true);
      expect(overviewResponse.body.data).toHaveProperty('metrics');
      expect(overviewResponse.body.data).toHaveProperty('health');
      expect(overviewResponse.body.data).toHaveProperty('activities');
    });

    it('should deny access to non-super-admin users', async () => {
      await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('User Management Integration', () => {
    it('should provide comprehensive user management capabilities', async () => {
      // Test user listing
      const usersResponse = await request(app)
        .get('/api/admin/saas/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(usersResponse.body.success).toBe(true);
      expect(usersResponse.body.data).toHaveProperty('users');
      expect(usersResponse.body.data).toHaveProperty('pagination');

      // Test user search
      const searchResponse = await request(app)
        .post('/api/admin/saas/users/search')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          query: 'test',
          pagination: { page: 1, limit: 10 }
        })
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data).toHaveProperty('users');

      // Test user statistics
      const statsResponse = await request(app)
        .get('/api/admin/saas/users/statistics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('statistics');
    });

    it('should handle user role management', async () => {
      const testUser = await User.create({
        email: 'roletest@test.com',
        password: 'password123',
        firstName: 'Role',
        lastName: 'Test',
        role: 'cashier',
        isActive: true,
        isEmailVerified: true
      });

      // Get user details
      const userResponse = await request(app)
        .get(`/api/admin/saas/users/${testUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(userResponse.body.success).toBe(true);
      expect(userResponse.body.data).toHaveProperty('user');
      expect(userResponse.body.data.user._id).toBe(testUser._id.toString());
    });
  });

  describe('Feature Flags Integration', () => {
    it('should provide enhanced feature flag management', async () => {
      // Test feature flags listing
      const flagsResponse = await request(app)
        .get('/api/admin/saas/feature-flags')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(flagsResponse.body.success).toBe(true);
      expect(flagsResponse.body.data).toHaveProperty('featureFlags');
      expect(flagsResponse.body.data).toHaveProperty('categories');

      // Test usage metrics
      const metricsResponse = await request(app)
        .get('/api/admin/saas/feature-flags/usage-metrics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data).toHaveProperty('metrics');

      // Test impact analysis
      const impactResponse = await request(app)
        .get(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/impact`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(impactResponse.body.success).toBe(true);
      expect(impactResponse.body.data).toHaveProperty('impact');
    });

    it('should handle targeting rules management', async () => {
      const targetingRules = {
        percentage: 50,
        pharmacies: ['pharmacy1'],
        userGroups: ['beta_users'],
        subscriptionPlans: ['premium']
      };

      const response = await request(app)
        .put(`/api/admin/saas/feature-flags/${testFeatureFlag._id}/targeting`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetingRules })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.targetingRules.percentage).toBe(50);
    });
  });

  describe('Security Integration', () => {
    it('should provide comprehensive security management', async () => {
      // Test security settings
      const settingsResponse = await request(app)
        .get('/api/admin/saas/security/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(settingsResponse.body.success).toBe(true);
      expect(settingsResponse.body.data).toHaveProperty('settings');

      // Test security dashboard
      const dashboardResponse = await request(app)
        .get('/api/admin/saas/security/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(dashboardResponse.body.success).toBe(true);
      expect(dashboardResponse.body.data).toHaveProperty('sessions');
      expect(dashboardResponse.body.data).toHaveProperty('security');

      // Test audit logs
      const auditResponse = await request(app)
        .get('/api/admin/saas/security/audit-logs')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.data).toHaveProperty('auditLogs');
    });

    it('should handle password policy updates', async () => {
      const passwordPolicy = {
        minLength: 10,
        requireUppercase: true,
        requireNumbers: true,
        maxAge: 90
      };

      const response = await request(app)
        .put('/api/admin/saas/security/password-policy')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(passwordPolicy)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.passwordPolicy.minLength).toBe(10);
    });
  });

  describe('Cross-Module Integration', () => {
    it('should maintain consistent authentication across all modules', async () => {
      const endpoints = [
        '/api/admin/saas/overview/metrics',
        '/api/admin/saas/users',
        '/api/admin/saas/feature-flags',
        '/api/admin/saas/security/settings'
      ];

      // Test with super admin token
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      }

      // Test with regular user token (should all fail)
      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      }
    });

    it('should maintain consistent error handling across modules', async () => {
      const endpoints = [
        '/api/admin/saas/overview/metrics',
        '/api/admin/saas/users',
        '/api/admin/saas/feature-flags',
        '/api/admin/saas/security/settings'
      ];

      // Test with invalid token
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.success).toBe(false);
      }

      // Test without token
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should provide consistent response formats across modules', async () => {
      const responses = await Promise.all([
        request(app)
          .get('/api/admin/saas/overview/metrics')
          .set('Authorization', `Bearer ${superAdminToken}`),
        request(app)
          .get('/api/admin/saas/users')
          .set('Authorization', `Bearer ${superAdminToken}`),
        request(app)
          .get('/api/admin/saas/feature-flags')
          .set('Authorization', `Bearer ${superAdminToken}`),
        request(app)
          .get('/api/admin/saas/security/settings')
          .set('Authorization', `Bearer ${superAdminToken}`)
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('message');
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests across modules', async () => {
      const requests = [
        request(app)
          .get('/api/admin/saas/overview/metrics')
          .set('Authorization', `Bearer ${superAdminToken}`),
        request(app)
          .get('/api/admin/saas/users')
          .set('Authorization', `Bearer ${superAdminToken}`),
        request(app)
          .get('/api/admin/saas/feature-flags')
          .set('Authorization', `Bearer ${superAdminToken}`),
        request(app)
          .get('/api/admin/saas/security/settings')
          .set('Authorization', `Bearer ${superAdminToken}`)
      ];

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max for all concurrent requests
    });

    it('should maintain performance under load', async () => {
      const batchSize = 5;
      const batches = 3;

      for (let batch = 0; batch < batches; batch++) {
        const requests = Array(batchSize).fill(null).map(() =>
          request(app)
            .get('/api/admin/saas/overview/metrics')
            .set('Authorization', `Bearer ${superAdminToken}`)
        );

        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });
      }
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across related operations', async () => {
      // Create a user through user management
      const newUser = await User.create({
        email: 'consistency@test.com',
        password: 'password123',
        firstName: 'Consistency',
        lastName: 'Test',
        role: 'pharmacist',
        isActive: true,
        isEmailVerified: true
      });

      // Verify user appears in user listing
      const usersResponse = await request(app)
        .get('/api/admin/saas/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const userExists = usersResponse.body.data.users.some(
        (user: any) => user._id === newUser._id.toString()
      );
      expect(userExists).toBe(true);

      // Verify user appears in system metrics
      const metricsResponse = await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(metricsResponse.body.data.totalUsers).toBeGreaterThan(0);
    });
  });
});