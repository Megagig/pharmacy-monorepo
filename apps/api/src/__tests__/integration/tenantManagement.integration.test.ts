import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Tenant } from '../../models/Tenant';
import { TenantSettings } from '../../models/TenantSettings';
import { User } from '../../models/User';
import { generateTestToken } from '../utils/testHelpers';

describe('Tenant Management Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let testTenant: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create admin user and token
    adminToken = generateTestToken({
      userId: 'admin123',
      role: 'super_admin',
      permissions: ['tenant:create', 'tenant:read', 'tenant:update', 'tenant:delete']
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections
    await Tenant.deleteMany({});
    await TenantSettings.deleteMany({});
    await User.deleteMany({});

    // Create test tenant
    testTenant = await Tenant.create({
      name: 'Test Tenant',
      domain: 'test.example.com',
      plan: 'premium',
      status: 'active',
      adminEmail: 'admin@test.com'
    });
  });

  describe('POST /api/saas/tenants', () => {
    it('should create a new tenant successfully', async () => {
      const tenantData = {
        name: 'New Tenant',
        domain: 'new.example.com',
        plan: 'basic',
        adminEmail: 'admin@new.com'
      };

      const response = await request(app)
        .post('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(tenantData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(tenantData.name);
      expect(response.body.data.domain).toBe(tenantData.domain);
      expect(response.body.data.plan).toBe(tenantData.plan);

      // Verify tenant was created in database
      const createdTenant = await Tenant.findById(response.body.data._id);
      expect(createdTenant).toBeTruthy();
      expect(createdTenant!.name).toBe(tenantData.name);

      // Verify tenant settings were created
      const tenantSettings = await TenantSettings.findOne({ tenantId: response.body.data._id });
      expect(tenantSettings).toBeTruthy();
    });

    it('should return 400 for invalid tenant data', async () => {
      const invalidData = {
        name: '', // Empty name
        domain: 'invalid-domain', // Invalid domain format
        plan: 'invalid-plan' // Invalid plan
      };

      const response = await request(app)
        .post('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 409 for duplicate domain', async () => {
      const tenantData = {
        name: 'Duplicate Tenant',
        domain: testTenant.domain, // Same domain as existing tenant
        plan: 'basic',
        adminEmail: 'admin@duplicate.com'
      };

      const response = await request(app)
        .post('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(tenantData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('domain already exists');
    });

    it('should return 401 for unauthorized access', async () => {
      const tenantData = {
        name: 'Unauthorized Tenant',
        domain: 'unauthorized.example.com',
        plan: 'basic',
        adminEmail: 'admin@unauthorized.com'
      };

      await request(app)
        .post('/api/saas/tenants')
        .send(tenantData)
        .expect(401);
    });
  });

  describe('GET /api/saas/tenants', () => {
    beforeEach(async () => {
      // Create additional test tenants
      await Tenant.create([
        {
          name: 'Tenant 1',
          domain: 'tenant1.example.com',
          plan: 'basic',
          status: 'active',
          adminEmail: 'admin@tenant1.com'
        },
        {
          name: 'Tenant 2',
          domain: 'tenant2.example.com',
          plan: 'premium',
          status: 'suspended',
          adminEmail: 'admin@tenant2.com'
        }
      ]);
    });

    it('should return paginated list of tenants', async () => {
      const response = await request(app)
        .get('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenants).toHaveLength(3); // testTenant + 2 additional
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should filter tenants by status', async () => {
      const response = await request(app)
        .get('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: 'active' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenants).toHaveLength(2); // testTenant + Tenant 1
      response.body.data.tenants.forEach((tenant: any) => {
        expect(tenant.status).toBe('active');
      });
    });

    it('should filter tenants by plan', async () => {
      const response = await request(app)
        .get('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ plan: 'premium' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenants).toHaveLength(2); // testTenant + Tenant 2
      response.body.data.tenants.forEach((tenant: any) => {
        expect(tenant.plan).toBe('premium');
      });
    });

    it('should search tenants by name', async () => {
      const response = await request(app)
        .get('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Test' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenants).toHaveLength(1);
      expect(response.body.data.tenants[0].name).toContain('Test');
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/saas/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenants).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.hasNext).toBe(true);
    });
  });

  describe('GET /api/saas/tenants/:id', () => {
    it('should return tenant by ID', async () => {
      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testTenant._id.toString());
      expect(response.body.data.name).toBe(testTenant.name);
      expect(response.body.data.domain).toBe(testTenant.domain);
    });

    it('should return 404 for non-existent tenant', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/saas/tenants/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid tenant ID', async () => {
      const response = await request(app)
        .get('/api/saas/tenants/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid tenant ID');
    });
  });

  describe('PUT /api/saas/tenants/:id', () => {
    it('should update tenant successfully', async () => {
      const updateData = {
        name: 'Updated Tenant Name',
        plan: 'enterprise'
      };

      const response = await request(app)
        .put(`/api/saas/tenants/${testTenant._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.plan).toBe(updateData.plan);

      // Verify update in database
      const updatedTenant = await Tenant.findById(testTenant._id);
      expect(updatedTenant!.name).toBe(updateData.name);
      expect(updatedTenant!.plan).toBe(updateData.plan);
    });

    it('should return 404 for non-existent tenant', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/saas/tenants/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid update data', async () => {
      const invalidData = {
        plan: 'invalid-plan'
      };

      const response = await request(app)
        .put(`/api/saas/tenants/${testTenant._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/saas/tenants/:id/suspend', () => {
    it('should suspend tenant successfully', async () => {
      const suspensionData = {
        reason: 'Payment overdue'
      };

      const response = await request(app)
        .post(`/api/saas/tenants/${testTenant._id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(suspensionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('suspended');

      // Verify suspension in database
      const suspendedTenant = await Tenant.findById(testTenant._id);
      expect(suspendedTenant!.status).toBe('suspended');
      expect(suspendedTenant!.suspensionReason).toBe(suspensionData.reason);
      expect(suspendedTenant!.suspendedAt).toBeDefined();
    });

    it('should return 400 if tenant is already suspended', async () => {
      // First suspend the tenant
      await Tenant.findByIdAndUpdate(testTenant._id, {
        status: 'suspended',
        suspensionReason: 'Already suspended',
        suspendedAt: new Date()
      });

      const response = await request(app)
        .post(`/api/saas/tenants/${testTenant._id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Another reason' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already suspended');
    });
  });

  describe('POST /api/saas/tenants/:id/reactivate', () => {
    beforeEach(async () => {
      // Suspend the tenant first
      await Tenant.findByIdAndUpdate(testTenant._id, {
        status: 'suspended',
        suspensionReason: 'Test suspension',
        suspendedAt: new Date()
      });
    });

    it('should reactivate tenant successfully', async () => {
      const response = await request(app)
        .post(`/api/saas/tenants/${testTenant._id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reactivated');

      // Verify reactivation in database
      const reactivatedTenant = await Tenant.findById(testTenant._id);
      expect(reactivatedTenant!.status).toBe('active');
      expect(reactivatedTenant!.suspensionReason).toBe('');
      expect(reactivatedTenant!.suspendedAt).toBeNull();
    });

    it('should return 400 if tenant is not suspended', async () => {
      // Reactivate tenant first
      await Tenant.findByIdAndUpdate(testTenant._id, {
        status: 'active',
        suspensionReason: '',
        suspendedAt: null
      });

      const response = await request(app)
        .post(`/api/saas/tenants/${testTenant._id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not suspended');
    });
  });

  describe('DELETE /api/saas/tenants/:id', () => {
    it('should delete tenant successfully', async () => {
      // Create some tenant users
      await User.create([
        {
          firstName: 'User',
          lastName: 'One',
          email: 'user1@test.com',
          tenantId: testTenant._id,
          role: 'user'
        },
        {
          firstName: 'User',
          lastName: 'Two',
          email: 'user2@test.com',
          tenantId: testTenant._id,
          role: 'admin'
        }
      ]);

      // Create tenant settings
      await TenantSettings.create({
        tenantId: testTenant._id,
        branding: { logo: 'logo.png' },
        features: { analytics: true }
      });

      const response = await request(app)
        .delete(`/api/saas/tenants/${testTenant._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify deletion in database
      const deletedTenant = await Tenant.findById(testTenant._id);
      expect(deletedTenant).toBeNull();

      // Verify related data was deleted
      const tenantUsers = await User.find({ tenantId: testTenant._id });
      expect(tenantUsers).toHaveLength(0);

      const tenantSettings = await TenantSettings.findOne({ tenantId: testTenant._id });
      expect(tenantSettings).toBeNull();
    });

    it('should return 404 for non-existent tenant', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/saas/tenants/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/saas/tenants/:id/settings', () => {
    let tenantSettings: any;

    beforeEach(async () => {
      tenantSettings = await TenantSettings.create({
        tenantId: testTenant._id,
        branding: {
          logo: 'logo.png',
          primaryColor: '#007bff',
          secondaryColor: '#6c757d'
        },
        features: {
          analytics: true,
          reporting: false,
          apiAccess: true
        },
        notifications: {
          email: true,
          sms: false,
          push: true
        }
      });
    });

    it('should return tenant settings', async () => {
      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenantId).toBe(testTenant._id.toString());
      expect(response.body.data.branding.logo).toBe('logo.png');
      expect(response.body.data.features.analytics).toBe(true);
      expect(response.body.data.notifications.email).toBe(true);
    });

    it('should create default settings if none exist', async () => {
      // Delete existing settings
      await TenantSettings.deleteOne({ tenantId: testTenant._id });

      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenantId).toBe(testTenant._id.toString());

      // Verify default settings were created in database
      const createdSettings = await TenantSettings.findOne({ tenantId: testTenant._id });
      expect(createdSettings).toBeTruthy();
    });
  });

  describe('PUT /api/saas/tenants/:id/settings', () => {
    it('should update tenant settings successfully', async () => {
      const updateData = {
        branding: {
          logo: 'new-logo.png',
          primaryColor: '#ff0000'
        },
        features: {
          analytics: false,
          reporting: true
        }
      };

      const response = await request(app)
        .put(`/api/saas/tenants/${testTenant._id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branding.logo).toBe('new-logo.png');
      expect(response.body.data.branding.primaryColor).toBe('#ff0000');
      expect(response.body.data.features.analytics).toBe(false);
      expect(response.body.data.features.reporting).toBe(true);

      // Verify update in database
      const updatedSettings = await TenantSettings.findOne({ tenantId: testTenant._id });
      expect(updatedSettings!.branding.logo).toBe('new-logo.png');
      expect(updatedSettings!.features.analytics).toBe(false);
    });

    it('should create settings if none exist', async () => {
      const updateData = {
        branding: { logo: 'created-logo.png' },
        features: { analytics: true }
      };

      const response = await request(app)
        .put(`/api/saas/tenants/${testTenant._id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branding.logo).toBe('created-logo.png');

      // Verify creation in database
      const createdSettings = await TenantSettings.findOne({ tenantId: testTenant._id });
      expect(createdSettings).toBeTruthy();
      expect(createdSettings!.branding.logo).toBe('created-logo.png');
    });
  });

  describe('GET /api/saas/tenants/:id/users', () => {
    beforeEach(async () => {
      // Create test users for the tenant
      await User.create([
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          tenantId: testTenant._id,
          role: 'admin',
          isActive: true
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
          tenantId: testTenant._id,
          role: 'user',
          isActive: true
        },
        {
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@test.com',
          tenantId: testTenant._id,
          role: 'user',
          isActive: false
        }
      ]);
    });

    it('should return tenant users with pagination', async () => {
      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(3);

      // Verify user data structure
      const user = response.body.data.users[0];
      expect(user).toHaveProperty('firstName');
      expect(user).toHaveProperty('lastName');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).not.toHaveProperty('password'); // Sensitive data should be excluded
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ role: 'admin' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].role).toBe('admin');
    });

    it('should filter users by status', async () => {
      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ isActive: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(2);
      response.body.data.users.forEach((user: any) => {
        expect(user.isActive).toBe(true);
      });
    });
  });

  describe('GET /api/saas/tenants/:id/analytics', () => {
    beforeEach(async () => {
      // Create test data for analytics
      await User.create([
        {
          firstName: 'User',
          lastName: '1',
          email: 'user1@test.com',
          tenantId: testTenant._id,
          role: 'user',
          createdAt: new Date('2024-01-15'),
          lastLoginAt: new Date('2024-01-20')
        },
        {
          firstName: 'User',
          lastName: '2',
          email: 'user2@test.com',
          tenantId: testTenant._id,
          role: 'user',
          createdAt: new Date('2024-01-10'),
          lastLoginAt: new Date('2024-01-25')
        }
      ]);
    });

    it('should return tenant analytics', async () => {
      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('activeUsers');
      expect(response.body.data).toHaveProperty('userGrowth');
      expect(response.body.data).toHaveProperty('activityMetrics');
      expect(response.body.data.totalUsers).toBe(2);
    });

    it('should require date range parameters', async () => {
      const response = await request(app)
        .get(`/api/saas/tenants/${testTenant._id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('date range');
    });
  });
});