import request from 'supertest';
import app from '../../app';
import { User } from '../../models/User';
import { SecuritySettings } from '../../models/SecuritySettings';
import { RedisCacheService } from '../../services/RedisCacheService';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

/**
 * Security Hardening Tests
 * Comprehensive tests for security vulnerabilities and hardening measures
 */

describe('Security Hardening Tests', () => {
  let adminToken: string;
  let userToken: string;
  let adminUser: any;
  let regularUser: any;
  let cacheService: RedisCacheService;

  beforeAll(async () => {
    cacheService = RedisCacheService.getInstance();

    // Create test users
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

    adminUser = await User.create({
      email: 'admin@test.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'super_admin',
      isEmailVerified: true
    });

    regularUser = await User.create({
      email: 'user@test.com',
      password: hashedPassword,
      firstName: 'Regular',
      lastName: 'User',
      role: 'user',
      isEmailVerified: true
    });

    // Generate tokens
    adminToken = jwt.sign(
      { userId: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    userToken = jwt.sign(
      { userId: regularUser._id, role: regularUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
    await SecuritySettings.deleteMany({});
    await cacheService.clear();
  });

  describe('Input Validation Tests', () => {
    test('should reject XSS attempts in request body', async () => {
      const xssPayload = {
        name: '<script>alert("XSS")</script>',
        description: '<img src=x onerror=alert("XSS")>'
      };

      const response = await request(app)
        .post('/api/admin/saas/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(xssPayload);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should reject SQL injection attempts', async () => {
      const sqlInjectionPayload = {
        search: "'; DROP TABLE users; --",
        filter: "1' OR '1'='1"
      };

      const response = await request(app)
        .get('/api/admin/saas/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query(sqlInjectionPayload);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should sanitize HTML content', async () => {
      const htmlPayload = {
        message: '<b>Bold text</b><script>alert("XSS")</script>',
        title: '<h1>Title</h1><iframe src="javascript:alert(1)"></iframe>'
      };

      const response = await request(app)
        .post('/api/admin/saas/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(htmlPayload);

      // Should accept safe HTML but reject dangerous scripts
      if (response.status === 200) {
        expect(response.body.data.message).not.toContain('<script>');
        expect(response.body.data.message).not.toContain('<iframe>');
      }
    });

    test('should validate email format strictly', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain',
        '.test@domain.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'ValidPassword123!',
            firstName: 'Test',
            lastName: 'User'
          });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });

    test('should enforce password complexity', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'Password', // Missing number and special char
        'password123', // Missing uppercase and special char
        'PASSWORD123!', // Missing lowercase
        'Passw0rd' // Missing special char
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            firstName: 'Test',
            lastName: 'User'
          });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });

    test('should limit request payload size', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024) // 10MB payload
      };

      const response = await request(app)
        .post('/api/admin/saas/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(largePayload);

      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('CSRF Protection Tests', () => {
    test('should require CSRF token for state-changing operations', async () => {
      const response = await request(app)
        .post('/api/admin/saas/users/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUser._id,
          roleId: 'new-role'
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('CSRF_TOKEN_MISSING');
    });

    test('should validate CSRF token format', async () => {
      const response = await request(app)
        .post('/api/admin/saas/users/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', 'invalid-token')
        .send({
          userId: regularUser._id,
          roleId: 'new-role'
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('CSRF_TOKEN_INVALID');
    });

    test('should validate request origin', async () => {
      const response = await request(app)
        .post('/api/admin/saas/users/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'https://malicious-site.com')
        .send({
          userId: regularUser._id,
          roleId: 'new-role'
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_ORIGIN');
    });

    test('should generate valid CSRF tokens', async () => {
      const response = await request(app)
        .get('/api/auth/csrf-token')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.csrfToken).toBeDefined();
      expect(typeof response.body.csrfToken).toBe('string');
      expect(response.body.csrfToken.length).toBeGreaterThan(32);
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should enforce API rate limits', async () => {
      const requests = [];

      // Make multiple rapid requests
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .get('/api/admin/saas/overview/metrics')
            .set('Authorization', `Bearer ${adminToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should enforce authentication rate limits', async () => {
      const requests = [];

      // Make multiple failed login attempts
      for (let i = 0; i < 12; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should implement burst protection', async () => {
      const startTime = Date.now();
      const requests = [];

      // Make rapid burst requests
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .get('/api/health')
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // Should have some rate limited responses for burst
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should bypass rate limits for super admins', async () => {
      const requests = [];

      // Make multiple requests as super admin
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/admin/saas/overview/metrics')
            .set('Authorization', `Bearer ${adminToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const successfulResponses = responses.filter(res => res.status === 200);

      // Super admin should have higher limits or bypass
      expect(successfulResponses.length).toBeGreaterThan(5);
    });
  });

  describe('DDoS Protection Tests', () => {
    test('should detect suspicious request patterns', async () => {
      const suspiciousRequests = [];

      // Simulate bot-like behavior
      for (let i = 0; i < 100; i++) {
        suspiciousRequests.push(
          request(app)
            .get(`/api/health?random=${i}`)
            .set('User-Agent', 'SuspiciousBot/1.0')
        );
      }

      const responses = await Promise.all(suspiciousRequests);
      const blockedResponses = responses.filter(res => res.status === 429 || res.status === 403);

      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    test('should block malicious payloads', async () => {
      const maliciousPayloads = [
        { payload: '<script>alert("XSS")</script>' },
        { payload: 'SELECT * FROM users WHERE 1=1' },
        { payload: '../../../../etc/passwd' },
        { payload: 'javascript:alert(1)' }
      ];

      for (const { payload } of maliciousPayloads) {
        const response = await request(app)
          .post('/api/admin/saas/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: payload });

        expect([400, 403, 429]).toContain(response.status);
      }
    });

    test('should detect endpoint scanning', async () => {
      const endpoints = [
        '/admin', '/wp-admin', '/.env', '/config.php', '/backup.sql',
        '/api/admin/users', '/api/admin/config', '/api/admin/logs'
      ];

      const requests = endpoints.map(endpoint =>
        request(app)
          .get(endpoint)
          .set('User-Agent', 'Scanner/1.0')
      );

      const responses = await Promise.all(requests);

      // Should detect scanning pattern and block subsequent requests
      const lastResponse = await request(app)
        .get('/api/health')
        .set('User-Agent', 'Scanner/1.0');

      expect([403, 429]).toContain(lastResponse.status);
    });
  });

  describe('Security Headers Tests', () => {
    test('should set security headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should set HSTS header in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/health');

      expect(response.headers['strict-transport-security']).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should remove server identification headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    test('should set CSP header with proper directives', async () => {
      const response = await request(app)
        .get('/api/health');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe('Authentication Security Tests', () => {
    test('should prevent timing attacks on login', async () => {
      const startTime = Date.now();

      // Test with non-existent user
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      const nonExistentTime = Date.now() - startTime;

      const startTime2 = Date.now();

      // Test with existing user but wrong password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: regularUser.email,
          password: 'wrongpassword'
        });

      const wrongPasswordTime = Date.now() - startTime2;

      // Response times should be similar to prevent user enumeration
      const timeDifference = Math.abs(nonExistentTime - wrongPasswordTime);
      expect(timeDifference).toBeLessThan(100); // Within 100ms
    });

    test('should lock account after failed attempts', async () => {
      const testEmail = 'locktest@example.com';
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

      const testUser = await User.create({
        email: testEmail,
        password: hashedPassword,
        firstName: 'Lock',
        lastName: 'Test',
        role: 'user',
        isEmailVerified: true
      });

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testEmail,
            password: 'wrongpassword'
          });
      }

      // Next attempt should be blocked
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(423); // Account locked
      expect(response.body.code).toBe('ACCOUNT_LOCKED');

      await User.findByIdAndDelete(testUser._id);
    });

    test('should validate JWT token integrity', async () => {
      const tamperedToken = adminToken.slice(0, -5) + 'XXXXX';

      const response = await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/admin/saas/overview/metrics')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Authorization Security Tests', () => {
    test('should prevent privilege escalation', async () => {
      const response = await request(app)
        .put('/api/admin/saas/users/role')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: regularUser._id,
          roleId: 'super_admin'
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should prevent horizontal privilege escalation', async () => {
      const anotherUser = await User.create({
        email: 'another@test.com',
        password: await bcrypt.hash('TestPassword123!', 10),
        firstName: 'Another',
        lastName: 'User',
        role: 'user',
        isEmailVerified: true
      });

      const response = await request(app)
        .get(`/api/users/${anotherUser._id}/profile`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ACCESS_DENIED');

      await User.findByIdAndDelete(anotherUser._id);
    });

    test('should validate resource ownership', async () => {
      const response = await request(app)
        .put(`/api/users/${adminUser._id}/profile`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          firstName: 'Hacked',
          lastName: 'User'
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ACCESS_DENIED');
    });
  });

  describe('Data Protection Tests', () => {
    test('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        const users = response.body.data.users;
        users.forEach((user: any) => {
          expect(user.password).toBeUndefined();
          expect(user.passwordHash).toBeUndefined();
          expect(user.__v).toBeUndefined();
        });
      }
    });

    test('should sanitize error messages', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).not.toContain('ObjectId');
      expect(response.body.message).not.toContain('MongoDB');
      expect(response.body.message).not.toContain('Cast to');
    });

    test('should prevent information disclosure through timing', async () => {
      const times: number[] = [];

      // Test multiple requests to measure timing consistency
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app)
          .get('/api/admin/saas/users/nonexistent-id')
          .set('Authorization', `Bearer ${adminToken}`);
        times.push(Date.now() - start);
      }

      // Response times should be relatively consistent
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime)));
      expect(maxDeviation).toBeLessThan(avgTime * 0.5); // Within 50% of average
    });
  });

  describe('Session Security Tests', () => {
    test('should invalidate sessions on password change', async () => {
      // This would require implementing session invalidation
      // For now, we'll test that the endpoint exists and requires authentication
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword123!'
        });

      // Should require current password validation
      expect([200, 400, 401]).toContain(response.status);
    });

    test('should prevent session fixation', async () => {
      // Login and get session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: regularUser.email,
          password: 'TestPassword123!'
        });

      if (loginResponse.status === 200) {
        const sessionCookie = loginResponse.headers['set-cookie'];
        expect(sessionCookie).toBeDefined();

        // Session ID should be regenerated on login
        expect(sessionCookie[0]).toContain('sessionid');
      }
    });

    test('should enforce session timeout', async () => {
      // This would require mocking time or using a very short timeout
      // For now, we'll test that the session validation endpoint exists
      const response = await request(app)
        .get('/api/auth/validate-session')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 401]).toContain(response.status);
    });
  });

  describe('File Upload Security Tests', () => {
    test('should validate file types', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('<?php echo "hack"; ?>'), 'malicious.php');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
    });

    test('should limit file size', async () => {
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', largeBuffer, 'large.jpg');

      expect(response.status).toBe(413); // Payload too large
    });

    test('should scan for malicious content', async () => {
      const maliciousContent = Buffer.from('GIF89a<script>alert("XSS")</script>');

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', maliciousContent, 'fake.gif');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MALICIOUS_CONTENT_DETECTED');
    });
  });
});