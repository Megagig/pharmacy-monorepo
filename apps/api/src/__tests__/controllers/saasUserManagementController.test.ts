import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../setup';
import { User } from '../../models/User';
import { Role } from '../../models/Role';
import { UserRole } from '../../models/UserRole';
import { UserManagementService } from '../../services/UserManagementService';
import jwt from 'jsonwebtoken';

describe('SaaS User Management Controller', () => {
  let app: Express;
  let superAdminToken: string;
  let regularUserToken: string;
  let testUser: any;
  let testRole: any;
  let userManagementService: UserManagementService;

  beforeAll(async () => {
    app = await createTestApp();
    userManagementService = UserManagementService.getInstance();
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

    // Create test role
    testRole = await Role.create({
      name: 'test_role',
      displayName: 'Test Role',
      description: 'Test role for testing',
      category: 'system',
      permissions: ['read_users', 'write_users']
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
    await Role.deleteMany({});
    await UserRole.deleteMany({});
  });

  describe('GET /api/admin/saas/users', () => {
    it('should return paginated users for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('total');
    });

    it('should filter users by search term', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users?search=test')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.search).toBe('test');
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users?role=pharmacist')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.role).toBe('pharmacist');
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users?page=1&limit=5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/admin/saas/users?page=0')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should limit maximum page size', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users?limit=200')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/admin/saas/users/:userId', () => {
    it('should return user details for valid user ID', async () => {
      const response = await request(app)
        .get(`/api/admin/saas/users/${testUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('activityLogs');
      expect(response.body.data.user._id).toBe(testUser._id.toString());
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/admin/saas/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 400 for invalid user ID format', async () => {
      await request(app)
        .get('/api/admin/saas/users/invalid-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get(`/api/admin/saas/users/${testUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/admin/saas/users/:userId/role', () => {
    it('should update user role successfully', async () => {
      const response = await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          roleId: testRole._id,
          reason: 'Testing role assignment'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUser._id.toString());
      expect(response.body.data.roleId).toBe(testRole._id.toString());
    });

    it('should require valid user ID', async () => {
      await request(app)
        .put('/api/admin/saas/users/invalid-id/role')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          roleId: testRole._id,
          reason: 'Testing'
        })
        .expect(400);
    });

    it('should require valid role ID', async () => {
      await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          roleId: 'invalid-role-id',
          reason: 'Testing'
        })
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/role`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          roleId: testRole._id,
          reason: 'Testing'
        })
        .expect(403);
    });
  });

  describe('PUT /api/admin/saas/users/:userId/suspend', () => {
    it('should suspend user successfully', async () => {
      const response = await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/suspend`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          reason: 'Violating terms of service - inappropriate behavior'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('suspended');
      expect(response.body.data.userId).toBe(testUser._id.toString());
    });

    it('should require suspension reason', async () => {
      await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/suspend`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(400);
    });

    it('should require minimum reason length', async () => {
      await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/suspend`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          reason: 'Short'
        })
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/suspend`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          reason: 'Violating terms of service - inappropriate behavior'
        })
        .expect(403);
    });
  });

  describe('PUT /api/admin/saas/users/:userId/reactivate', () => {
    beforeEach(async () => {
      // Suspend the test user first
      testUser.status = 'suspended';
      await testUser.save();
    });

    it('should reactivate suspended user successfully', async () => {
      const response = await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/reactivate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.userId).toBe(testUser._id.toString());
    });

    it('should require valid user ID', async () => {
      await request(app)
        .put('/api/admin/saas/users/invalid-id/reactivate')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .put(`/api/admin/saas/users/${testUser._id}/reactivate`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/saas/users/bulk-assign-roles', () => {
    it('should assign roles to multiple users successfully', async () => {
      const response = await request(app)
        .post('/api/admin/saas/users/bulk-assign-roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userIds: [testUser._id.toString()],
          roleId: testRole._id.toString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('successfulAssignments');
      expect(response.body.data.totalUsers).toBe(1);
    });

    it('should require user IDs array', async () => {
      await request(app)
        .post('/api/admin/saas/users/bulk-assign-roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          roleId: testRole._id.toString()
        })
        .expect(400);
    });

    it('should require valid role ID', async () => {
      await request(app)
        .post('/api/admin/saas/users/bulk-assign-roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userIds: [testUser._id.toString()],
          roleId: 'invalid-role-id'
        })
        .expect(400);
    });

    it('should validate user ID formats', async () => {
      await request(app)
        .post('/api/admin/saas/users/bulk-assign-roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userIds: ['invalid-id'],
          roleId: testRole._id.toString()
        })
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post('/api/admin/saas/users/bulk-assign-roles')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          userIds: [testUser._id.toString()],
          roleId: testRole._id.toString()
        })
        .expect(403);
    });
  });

  describe('POST /api/admin/saas/users/:userId/impersonate', () => {
    it('should create impersonation session successfully', async () => {
      const response = await request(app)
        .post(`/api/admin/saas/users/${testUser._id}/impersonate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          duration: 3600
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionToken');
      expect(response.body.data).toHaveProperty('expiresAt');
      expect(response.body.data).toHaveProperty('targetUserId');
      expect(response.body.data.targetUserId).toBe(testUser._id.toString());
    });

    it('should use default duration when not specified', async () => {
      const response = await request(app)
        .post(`/api/admin/saas/users/${testUser._id}/impersonate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('duration');
    });

    it('should validate duration limits', async () => {
      await request(app)
        .post(`/api/admin/saas/users/${testUser._id}/impersonate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          duration: 100000 // Too long
        })
        .expect(400);
    });

    it('should require valid user ID', async () => {
      await request(app)
        .post('/api/admin/saas/users/invalid-id/impersonate')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          duration: 3600
        })
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post(`/api/admin/saas/users/${testUser._id}/impersonate`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          duration: 3600
        })
        .expect(403);
    });
  });

  describe('GET /api/admin/saas/users/statistics', () => {
    it('should return user statistics for super admin', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users/statistics')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data).toHaveProperty('timeRange');
      expect(response.body.data).toHaveProperty('generatedAt');
    });

    it('should accept time range parameter', async () => {
      const response = await request(app)
        .get('/api/admin/saas/users/statistics?timeRange=7d')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.timeRange).toBe('7d');
    });

    it('should validate time range parameter', async () => {
      await request(app)
        .get('/api/admin/saas/users/statistics?timeRange=invalid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/saas/users/statistics')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/saas/users/search', () => {
    it('should search users successfully', async () => {
      const response = await request(app)
        .post('/api/admin/saas/users/search')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          query: 'test',
          filters: { role: 'cashier' },
          pagination: { page: 1, limit: 10 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('searchQuery');
      expect(response.body.data.searchQuery).toBe('test');
    });

    it('should handle empty search', async () => {
      const response = await request(app)
        .post('/api/admin/saas/users/search')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .post('/api/admin/saas/users/search')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          pagination: { page: 0, limit: 10 }
        })
        .expect(400);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post('/api/admin/saas/users/search')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          query: 'test'
        })
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      jest.spyOn(userManagementService, 'getAllUsers')
        .mockRejectedValueOnce(new Error('Service error'));

      const response = await request(app)
        .get('/api/admin/saas/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_FETCH_ERROR');
    });

    it('should handle database connection errors', async () => {
      // Mock database error
      jest.spyOn(userManagementService, 'getUserById')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/admin/saas/users/${testUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});