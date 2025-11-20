import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../setup';
import { User } from '../../models/User';
import { SystemAnalyticsService } from '../../services/SystemAnalyticsService';
import jwt from 'jsonwebtoken';

describe('SaaS Overview Controller', () => {
  let app: Express;
  let superAdminToken: string;
  let regularUserToken: string;
  let systemAnalyticsService: SystemAnalyticsService;

  beforeAll(async () => {
    app = await createTestApp();
    systemAnalyticsService = SystemAnalyticsService.getInstance();
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
    await systemAnalyticsService.clearCache();
  });

  describe('GET /api/admin/saas/overview/metrics', () => {
    it('should return system metrics for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('activeSubscriptions');
      expect(response.body.data).toHaveProperty('totalWorkspaces');
      expect(response.body.data).toHaveProperty('monthlyRevenue');
      expect(response.body.data).toHaveProperty('systemUptime');
      expect(response.body.data).toHaveProperty('activeFeatureFlags');
      expect(response.body.data).toHaveProperty('pendingLicenses');
      expect(response.body.data).toHaveProperty('supportTickets');
      expect(response.body.data).toHaveProperty('generatedAt');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should deny access to unauthenticated requests', async () => {
      await request(app)
        .get('/api/admin/saas/overview/metrics')
        .expect(401);
    });

    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      jest.spyOn(systemAnalyticsService, 'getSystemMetrics')
        .mockRejectedValueOnce(new Error('Service error'));

      const response = await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('METRICS_ERROR');
    });
  });

  describe('GET /api/admin/saas/overview/health', () => {
    it('should return system health status for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/overview/health')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data).toHaveProperty('api');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('cache');
      
      // Check database health structure
      expect(response.body.data.database).toHaveProperty('status');
      expect(response.body.data.database).toHaveProperty('responseTime');
      expect(response.body.data.database).toHaveProperty('connections');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/overview/health')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      jest.spyOn(systemAnalyticsService, 'getSystemHealth')
        .mockRejectedValueOnce(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/admin/saas/overview/health')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HEALTH_CHECK_ERROR');
    });
  });

  describe('GET /api/admin/saas/overview/activities', () => {
    it('should return recent activities for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/overview/activities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activities');
      expect(response.body.data).toHaveProperty('limit');
      expect(Array.isArray(response.body.data.activities)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const limit = 5;
      const response = await request(app)
        .get(`/api/admin/saas/overview/activities?limit=${limit}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.limit).toBe(limit);
    });

    it('should use default limit when not specified', async () => {
      const response = await request(app)
        .get('/api/admin/saas/overview/activities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.limit).toBe(10);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/overview/activities')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/overview', () => {
    it('should return comprehensive system overview for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('health');
      expect(response.body.data).toHaveProperty('activities');
      expect(response.body.data).toHaveProperty('generatedAt');

      // Check metrics structure
      expect(response.body.data.metrics).toHaveProperty('totalUsers');
      expect(response.body.data.metrics).toHaveProperty('activeSubscriptions');
      
      // Check health structure
      expect(response.body.data.health).toHaveProperty('database');
      expect(response.body.data.health).toHaveProperty('api');
      
      // Check activities structure
      expect(Array.isArray(response.body.data.activities)).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock one service to fail
      jest.spyOn(systemAnalyticsService, 'getSystemHealth')
        .mockRejectedValueOnce(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/admin/saas/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/saas/overview/performance', () => {
    it('should return performance statistics for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/overview/performance')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data).toHaveProperty('api');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('cache');
      expect(response.body.data).toHaveProperty('generatedAt');

      // Check performance metrics structure
      expect(response.body.data.database).toHaveProperty('responseTime');
      expect(response.body.data.database).toHaveProperty('status');
      expect(response.body.data.memory).toHaveProperty('usagePercentage');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/overview/performance')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/saas/overview/refresh', () => {
    it('should refresh metrics cache for super admin', async () => {
      const response = await request(app)
        .post('/api/admin/saas/overview/refresh')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('refreshedAt');
      expect(response.body.data).toHaveProperty('metrics');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post('/api/admin/saas/overview/refresh')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should handle cache clear errors gracefully', async () => {
      // Mock cache clear to fail
      jest.spyOn(systemAnalyticsService, 'clearCache')
        .mockRejectedValueOnce(new Error('Cache clear failed'));

      const response = await request(app)
        .post('/api/admin/saas/overview/refresh')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REFRESH_ERROR');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tokens', async () => {
      await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle missing authorization header', async () => {
      await request(app)
        .get('/api/admin/saas/overview/metrics')
        .expect(401);
    });

    it('should handle malformed authorization header', async () => {
      await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/admin/saas/overview/metrics')
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