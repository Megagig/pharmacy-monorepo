import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../setup';
import { User } from '../../models/User';
import { SecurityMonitoringService } from '../../services/SecurityMonitoringService';
import jwt from 'jsonwebtoken';

describe('SaaS Security Controller', () => {
  let app: Express;
  let superAdminToken: string;
  let regularUserToken: string;
  let testUser: any;
  let securityMonitoringService: SecurityMonitoringService;

  beforeAll(async () => {
    app = await createTestApp();
    securityMonitoringService = SecurityMonitoringService.getInstance();
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

    testUser = await User.create({
      email: 'testuser@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'cashier',
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
  });

  describe('GET /api/admin/saas/security/settings', () => {
    it('should return security settings for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('settings');
      expect(response.body.data).toHaveProperty('retrievedAt');
      expect(response.body.data.settings).toHaveProperty('passwordPolicy');
      expect(response.body.data.settings).toHaveProperty('sessionSettings');
      expect(response.body.data.settings).toHaveProperty('accountLockout');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/security/settings')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should deny access to unauthenticated requests', async () => {
      await request(app)
        .get('/api/admin/saas/security/settings')
        .expect(401);
    });
  });

  describe('PUT /api/admin/saas/security/password-policy', () => {
    it('should update password policy successfully', async () => {
      const passwordPolicy = {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 60,
        preventReuse: 10,
        lockoutThreshold: 3,
        lockoutDuration: 60
      };

      const response = await request(app)
        .put('/api/admin/saas/security/password-policy')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(passwordPolicy)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('passwordPolicy');
      expect(response.body.data).toHaveProperty('updatedBy');
      expect(response.body.data).toHaveProperty('updatedAt');
      expect(response.body.data.passwordPolicy.minLength).toBe(12);
      expect(response.body.data.passwordPolicy.requireSpecialChars).toBe(true);
    });

    it('should validate password policy parameters', async () => {
      const invalidPolicy = {
        minLength: 200, // Too long
        maxAge: 500, // Too long
        lockoutThreshold: 50 // Too high
      };

      await request(app)
        .put('/api/admin/saas/security/password-policy')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(invalidPolicy)
        .expect(400);
    });

    it('should use default values for missing parameters', async () => {
      const partialPolicy = {
        minLength: 10,
        requireUppercase: false
      };

      const response = await request(app)
        .put('/api/admin/saas/security/password-policy')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(partialPolicy)
        .expect(200);

      expect(response.body.data.passwordPolicy.minLength).toBe(10);
      expect(response.body.data.passwordPolicy.requireUppercase).toBe(false);
      expect(response.body.data.passwordPolicy.requireLowercase).toBe(true); // Default
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .put('/api/admin/saas/security/password-policy')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ minLength: 10 })
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/security/sessions', () => {
    it('should return active sessions for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/sessions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
    });

    it('should filter sessions by user ID', async () => {
      const response = await request(app)
        .get(`/api/admin/saas/security/sessions?userId=${testUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.userId).toBe(testUser._id.toString());
    });

    it('should filter sessions by active status', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/sessions?isActive=true')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.isActive).toBe(true);
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/sessions?page=1&limit=10')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/admin/saas/security/sessions?page=0')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should validate user ID parameter', async () => {
      await request(app)
        .get('/api/admin/saas/security/sessions?userId=invalid-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/security/sessions')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/admin/saas/security/sessions/:sessionId', () => {
    it('should terminate session successfully', async () => {
      const sessionId = 'test-session-id';
      const reason = 'Suspicious activity detected';

      const response = await request(app)
        .delete(`/api/admin/saas/security/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.reason).toBe(reason);
      expect(response.body.data).toHaveProperty('terminatedBy');
      expect(response.body.data).toHaveProperty('terminatedAt');
    });

    it('should require session ID', async () => {
      await request(app)
        .delete('/api/admin/saas/security/sessions/')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404); // Route not found
    });

    it('should handle optional reason parameter', async () => {
      const sessionId = 'test-session-id';

      const response = await request(app)
        .delete(`/api/admin/saas/security/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(200);

      expect(response.body.data.reason).toBe('No reason provided');
    });

    it('should validate reason length', async () => {
      const sessionId = 'test-session-id';
      const longReason = 'x'.repeat(501); // Too long

      await request(app)
        .delete(`/api/admin/saas/security/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: longReason })
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .delete('/api/admin/saas/security/sessions/test-session-id')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ reason: 'Test' })
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/security/audit-logs', () => {
    it('should return security audit logs for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/audit-logs')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('auditLogs');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.auditLogs)).toBe(true);
    });

    it('should filter audit logs by user ID', async () => {
      const response = await request(app)
        .get(`/api/admin/saas/security/audit-logs?userId=${testUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.userId).toBe(testUser._id.toString());
    });

    it('should filter audit logs by action', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/audit-logs?action=login')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.action).toBe('login');
    });

    it('should filter audit logs by success status', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/audit-logs?success=false')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.success).toBe(false);
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/audit-logs?page=1&limit=25')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(25);
    });

    it('should validate date parameters', async () => {
      await request(app)
        .get('/api/admin/saas/security/audit-logs?startDate=invalid-date')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/security/audit-logs')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/saas/security/users/:userId/lock', () => {
    it('should lock user account successfully', async () => {
      const reason = 'Multiple failed login attempts detected';

      const response = await request(app)
        .post(`/api/admin/saas/security/users/${testUser._id}/lock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUser._id.toString());
      expect(response.body.data.status).toBe('locked');
      expect(response.body.data.reason).toBe(reason);
      expect(response.body.data).toHaveProperty('lockedBy');
      expect(response.body.data).toHaveProperty('lockedAt');
    });

    it('should require valid user ID', async () => {
      await request(app)
        .post('/api/admin/saas/security/users/invalid-id/lock')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Test reason for account lock' })
        .expect(400);
    });

    it('should require lock reason', async () => {
      await request(app)
        .post(`/api/admin/saas/security/users/${testUser._id}/lock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(400);
    });

    it('should validate reason length', async () => {
      await request(app)
        .post(`/api/admin/saas/security/users/${testUser._id}/lock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Short' }) // Too short
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post(`/api/admin/saas/security/users/${testUser._id}/lock`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ reason: 'Test reason for account lock' })
        .expect(403);
    });
  });

  describe('POST /api/admin/saas/security/users/:userId/unlock', () => {
    it('should unlock user account successfully', async () => {
      const response = await request(app)
        .post(`/api/admin/saas/security/users/${testUser._id}/unlock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUser._id.toString());
      expect(response.body.data.status).toBe('unlocked');
      expect(response.body.data).toHaveProperty('unlockedBy');
      expect(response.body.data).toHaveProperty('unlockedAt');
    });

    it('should require valid user ID', async () => {
      await request(app)
        .post('/api/admin/saas/security/users/invalid-id/unlock')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post(`/api/admin/saas/security/users/${testUser._id}/unlock`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/security/dashboard', () => {
    it('should return security dashboard metrics for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('security');
      expect(response.body.data).toHaveProperty('policies');
      expect(response.body.data).toHaveProperty('timeRange');
      expect(response.body.data).toHaveProperty('generatedAt');

      // Check sessions metrics
      expect(response.body.data.sessions).toHaveProperty('total');
      expect(response.body.data.sessions).toHaveProperty('active');
      expect(response.body.data.sessions).toHaveProperty('uniqueUsers');

      // Check security metrics
      expect(response.body.data.security).toHaveProperty('failedLogins');
      expect(response.body.data.security).toHaveProperty('successfulLogins');
      expect(response.body.data.security).toHaveProperty('suspiciousActivities');

      // Check policies
      expect(response.body.data.policies).toHaveProperty('passwordPolicy');
      expect(response.body.data.policies).toHaveProperty('sessionSettings');
    });

    it('should accept time range parameter', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/dashboard?timeRange=7d')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.timeRange).toBe('7d');
    });

    it('should validate time range parameter', async () => {
      await request(app)
        .get('/api/admin/saas/security/dashboard?timeRange=invalid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should use default time range when not specified', async () => {
      const response = await request(app)
        .get('/api/admin/saas/security/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.timeRange).toBe('24h');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/security/dashboard')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      jest.spyOn(securityMonitoringService, 'getSecuritySettings')
        .mockRejectedValueOnce(new Error('Service error'));

      const response = await request(app)
        .get('/api/admin/saas/security/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SECURITY_SETTINGS_ERROR');
    });

    it('should handle invalid tokens', async () => {
      await request(app)
        .get('/api/admin/saas/security/settings')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle missing authorization header', async () => {
      await request(app)
        .get('/api/admin/saas/security/settings')
        .expect(401);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/admin/saas/security/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .get('/api/admin/saas/security/settings')
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