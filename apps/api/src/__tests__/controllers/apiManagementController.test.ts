import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import apiManagementRoutes from '../../routes/apiManagementRoutes';
import ApiEndpoint from '../../models/ApiEndpoint';
import ApiKey from '../../models/ApiKey';
import ApiUsageMetrics from '../../models/ApiUsageMetrics';

// Mock authentication middleware
jest.mock('../../middlewares/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', role: 'super_admin' };
    next();
  }
}));

jest.mock('../../middlewares/rbac', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => next()
}));

describe('ApiManagementController', () => {
  let app: express.Application;
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/api-management', apiManagementRoutes);

    userId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await ApiEndpoint.deleteMany({});
    await ApiKey.deleteMany({});
    await ApiUsageMetrics.deleteMany({});
  });

  describe('GET /endpoints', () => {
    beforeEach(async () => {
      const endpoints = [
        {
          path: '/api/v1/users',
          method: 'GET',
          version: 'v1',
          description: 'Get all users',
          category: 'User Management',
          isPublic: true,
          deprecated: false,
          tags: ['users', 'public']
        },
        {
          path: '/api/v1/users',
          method: 'POST',
          version: 'v1',
          description: 'Create user',
          category: 'User Management',
          isPublic: false,
          deprecated: false,
          tags: ['users', 'admin']
        }
      ];

      await ApiEndpoint.insertMany(endpoints);
    });

    it('should get all endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/endpoints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
    });

    it('should filter endpoints by category', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/endpoints')
        .query({ category: 'User Management' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints).toHaveLength(2);
    });

    it('should filter endpoints by public status', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/endpoints')
        .query({ isPublic: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints).toHaveLength(1);
      expect(response.body.data.endpoints[0].method).toBe('GET');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/endpoints')
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints).toHaveLength(1);
      expect(response.body.data.totalPages).toBe(2);
    });

    it('should search endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/endpoints')
        .query({ search: 'Create' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints).toHaveLength(1);
      expect(response.body.data.endpoints[0].method).toBe('POST');
    });
  });

  describe('POST /endpoints', () => {
    it('should create new endpoint', async () => {
      const endpointData = {
        path: '/api/v1/products',
        method: 'GET',
        version: 'v1',
        description: 'Get all products',
        category: 'Product Management',
        isPublic: true,
        parameters: [
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Success'
          }
        ]
      };

      const response = await request(app)
        .post('/api/admin/api-management/endpoints')
        .send(endpointData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.path).toBe(endpointData.path);
      expect(response.body.data.method).toBe(endpointData.method);
      expect(response.body.data.category).toBe(endpointData.category);
    });

    it('should update existing endpoint', async () => {
      const existingEndpoint = await ApiEndpoint.create({
        path: '/api/v1/test',
        method: 'GET',
        version: 'v1',
        description: 'Original description',
        category: 'Test'
      });

      const updateData = {
        path: '/api/v1/test',
        method: 'GET',
        version: 'v1',
        description: 'Updated description',
        category: 'Test'
      };

      const response = await request(app)
        .post('/api/admin/api-management/endpoints')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(existingEndpoint._id.toString());
      expect(response.body.data.description).toBe('Updated description');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        method: 'GET',
        description: 'Missing path and version'
      };

      const response = await request(app)
        .post('/api/admin/api-management/endpoints')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate HTTP method', async () => {
      const invalidData = {
        path: '/api/v1/test',
        method: 'INVALID',
        version: 'v1',
        description: 'Test',
        category: 'Test'
      };

      const response = await request(app)
        .post('/api/admin/api-management/endpoints')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /endpoints/:id', () => {
    it('should delete endpoint', async () => {
      const endpoint = await ApiEndpoint.create({
        path: '/api/v1/test',
        method: 'GET',
        version: 'v1',
        description: 'Test endpoint',
        category: 'Test'
      });

      const response = await request(app)
        .delete(`/api/admin/api-management/endpoints/${endpoint._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API endpoint deleted successfully');

      const deletedEndpoint = await ApiEndpoint.findById(endpoint._id);
      expect(deletedEndpoint).toBeNull();
    });

    it('should return error for invalid endpoint ID', async () => {
      const invalidId = 'invalid-id';

      const response = await request(app)
        .delete(`/api/admin/api-management/endpoints/${invalidId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /openapi-spec', () => {
    beforeEach(async () => {
      await ApiEndpoint.create({
        path: '/api/v1/users',
        method: 'GET',
        version: 'v1',
        description: 'Get all users',
        category: 'User Management',
        isPublic: true,
        deprecated: false,
        tags: ['users'],
        parameters: [
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Success'
          }
        ]
      });
    });

    it('should generate OpenAPI specification', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/openapi-spec')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.openapi).toBe('3.0.0');
      expect(response.body.data.info).toBeDefined();
      expect(response.body.data.paths).toBeDefined();
      expect(response.body.data.paths['/api/v1/users']).toBeDefined();
    });
  });

  describe('GET /api-keys', () => {
    beforeEach(async () => {
      const apiKey = new ApiKey({
        name: 'Test API Key',
        userId,
        scopes: ['read:users'],
        environment: 'development'
      });
      apiKey.generateKey();
      await apiKey.save();
    });

    it('should get all API keys', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/api-keys')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKeys).toHaveLength(1);
      expect(response.body.data.apiKeys[0].name).toBe('Test API Key');
    });

    it('should filter API keys by user ID', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/api-keys')
        .query({ userId: userId.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKeys).toHaveLength(1);
    });

    it('should filter API keys by environment', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/api-keys')
        .query({ environment: 'development' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKeys).toHaveLength(1);
    });
  });

  describe('POST /api-keys', () => {
    it('should create new API key', async () => {
      const keyData = {
        name: 'New API Key',
        description: 'Test description',
        userId: userId.toString(),
        scopes: ['read:users', 'write:users'],
        environment: 'development',
        rateLimit: {
          requests: 1000,
          window: 3600
        }
      };

      const response = await request(app)
        .post('/api/admin/api-management/api-keys')
        .send(keyData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey.name).toBe(keyData.name);
      expect(response.body.data.apiKey.scopes).toEqual(keyData.scopes);
      expect(response.body.data.key).toMatch(/^pk_[a-f0-9]{32}\.[a-f0-9]{64}$/);
      expect(response.body.message).toContain('Please save the key securely');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        description: 'Missing required fields'
      };

      const response = await request(app)
        .post('/api/admin/api-management/api-keys')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate user ID format', async () => {
      const invalidData = {
        name: 'Test Key',
        userId: 'invalid-user-id',
        scopes: ['read:users'],
        environment: 'development'
      };

      const response = await request(app)
        .post('/api/admin/api-management/api-keys')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate environment enum', async () => {
      const invalidData = {
        name: 'Test Key',
        userId: userId.toString(),
        scopes: ['read:users'],
        environment: 'invalid-env'
      };

      const response = await request(app)
        .post('/api/admin/api-management/api-keys')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api-keys/:keyId', () => {
    it('should revoke API key', async () => {
      const apiKey = new ApiKey({
        name: 'Test API Key',
        userId,
        scopes: ['read:users'],
        environment: 'development'
      });
      apiKey.generateKey();
      await apiKey.save();

      const response = await request(app)
        .delete(`/api/admin/api-management/api-keys/${apiKey.keyId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key revoked successfully');

      const revokedKey = await ApiKey.findOne({ keyId: apiKey.keyId });
      expect(revokedKey!.isActive).toBe(false);
    });

    it('should return error for non-existent key', async () => {
      const response = await request(app)
        .delete('/api/admin/api-management/api-keys/non-existent-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('API key not found');
    });
  });

  describe('GET /analytics', () => {
    beforeEach(async () => {
      const now = new Date();
      const metrics = [
        {
          endpoint: '/api/v1/users',
          method: 'GET',
          version: 'v1',
          userId,
          timestamp: new Date(now.getTime() - 1000),
          responseTime: 100,
          statusCode: 200,
          ipAddress: '192.168.1.1'
        },
        {
          endpoint: '/api/v1/users',
          method: 'POST',
          version: 'v1',
          userId,
          timestamp: new Date(now.getTime() - 2000),
          responseTime: 200,
          statusCode: 201,
          ipAddress: '192.168.1.1'
        }
      ];

      await ApiUsageMetrics.insertMany(metrics);
    });

    it('should get usage analytics', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBe(2);
      expect(response.body.data.averageResponseTime).toBe(150);
      expect(response.body.data.errorRate).toBe(0);
      expect(response.body.data.topEndpoints).toBeDefined();
      expect(response.body.data.timeSeriesData).toBeDefined();
    });

    it('should filter analytics by endpoint', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/analytics')
        .query({ endpoint: '/api/v1/users' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBe(2);
    });

    it('should filter analytics by method', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/analytics')
        .query({ method: 'GET' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBe(1);
    });

    it('should group analytics by different time periods', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/analytics')
        .query({ groupBy: 'hour' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeSeriesData).toBeDefined();
    });
  });

  describe('GET /versions', () => {
    beforeEach(async () => {
      const endpoints = [
        {
          path: '/api/v1/users',
          method: 'GET',
          version: 'v1',
          description: 'Get users v1',
          category: 'User Management'
        },
        {
          path: '/api/v2/users',
          method: 'GET',
          version: 'v2',
          description: 'Get users v2',
          category: 'User Management'
        }
      ];

      await ApiEndpoint.insertMany(endpoints);
    });

    it('should get API versions', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/versions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(['v1', 'v2']);
    });
  });

  describe('GET /categories', () => {
    beforeEach(async () => {
      const endpoints = [
        {
          path: '/api/v1/users',
          method: 'GET',
          version: 'v1',
          description: 'Get users',
          category: 'User Management'
        },
        {
          path: '/api/v1/products',
          method: 'GET',
          version: 'v1',
          description: 'Get products',
          category: 'Product Management'
        }
      ];

      await ApiEndpoint.insertMany(endpoints);
    });

    it('should get API categories', async () => {
      const response = await request(app)
        .get('/api/admin/api-management/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(['Product Management', 'User Management']);
    });
  });
});