import mongoose from 'mongoose';
import ApiManagementService from '../../services/ApiManagementService';
import ApiEndpoint from '../../models/ApiEndpoint';
import ApiKey from '../../models/ApiKey';
import ApiUsageMetrics from '../../models/ApiUsageMetrics';

describe('ApiManagementService', () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    userId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await ApiEndpoint.deleteMany({});
    await ApiKey.deleteMany({});
    await ApiUsageMetrics.deleteMany({});
  });

  describe('API Endpoints Management', () => {
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
        },
        {
          path: '/api/v1/legacy',
          method: 'GET',
          version: 'v1',
          description: 'Legacy endpoint',
          category: 'Legacy',
          isPublic: true,
          deprecated: true,
          tags: ['legacy']
        }
      ];

      await ApiEndpoint.insertMany(endpoints);
    });

    it('should get all endpoints with pagination', async () => {
      const result = await ApiManagementService.getApiEndpoints({}, 1, 2);

      expect(result.endpoints).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    it('should filter endpoints by category', async () => {
      const result = await ApiManagementService.getApiEndpoints({
        category: 'User Management'
      });

      expect(result.endpoints).toHaveLength(2);
      expect(result.endpoints.every(e => e.category === 'User Management')).toBe(true);
    });

    it('should filter endpoints by deprecated status', async () => {
      const result = await ApiManagementService.getApiEndpoints({
        deprecated: false
      });

      expect(result.endpoints).toHaveLength(2);
      expect(result.endpoints.every(e => !e.deprecated)).toBe(true);
    });

    it('should filter endpoints by public status', async () => {
      const result = await ApiManagementService.getApiEndpoints({
        isPublic: true
      });

      expect(result.endpoints).toHaveLength(2);
      expect(result.endpoints.every(e => e.isPublic)).toBe(true);
    });

    it('should filter endpoints by tags', async () => {
      const result = await ApiManagementService.getApiEndpoints({
        tags: ['admin']
      });

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].method).toBe('POST');
    });

    it('should search endpoints by path and description', async () => {
      const result = await ApiManagementService.getApiEndpoints({
        search: 'users'
      });

      expect(result.endpoints).toHaveLength(2);
    });

    it('should create new endpoint', async () => {
      const endpointData = {
        path: '/api/v1/products',
        method: 'GET',
        version: 'v1',
        description: 'Get all products',
        category: 'Product Management',
        isPublic: true
      };

      const endpoint = await ApiManagementService.createOrUpdateEndpoint(endpointData);

      expect(endpoint._id).toBeDefined();
      expect(endpoint.path).toBe(endpointData.path);
      expect(endpoint.method).toBe(endpointData.method);
    });

    it('should update existing endpoint', async () => {
      const existingEndpoint = await ApiEndpoint.findOne({
        path: '/api/v1/users',
        method: 'GET'
      });

      const updatedData = {
        path: '/api/v1/users',
        method: 'GET',
        version: 'v1',
        description: 'Updated description',
        category: 'User Management'
      };

      const endpoint = await ApiManagementService.createOrUpdateEndpoint(updatedData);

      expect(endpoint._id.toString()).toBe(existingEndpoint!._id.toString());
      expect(endpoint.description).toBe('Updated description');
    });

    it('should delete endpoint', async () => {
      const endpoint = await ApiEndpoint.findOne({});
      await ApiManagementService.deleteEndpoint(endpoint!._id.toString());

      const deletedEndpoint = await ApiEndpoint.findById(endpoint!._id);
      expect(deletedEndpoint).toBeNull();
    });

    it('should throw error when deleting non-existent endpoint', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      await expect(
        ApiManagementService.deleteEndpoint(fakeId)
      ).rejects.toThrow('API endpoint not found');
    });
  });

  describe('OpenAPI Specification Generation', () => {
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
          tags: ['users'],
          parameters: [
            {
              name: 'page',
              type: 'number',
              required: false,
              description: 'Page number',
              example: 1
            }
          ],
          responses: [
            {
              statusCode: 200,
              description: 'Success',
              schema: { type: 'object' },
              example: { users: [] }
            }
          ],
          authentication: {
            required: true,
            type: 'bearer',
            scopes: ['read:users']
          }
        }
      ];

      await ApiEndpoint.insertMany(endpoints);
    });

    it('should generate valid OpenAPI specification', async () => {
      const config = {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test API Description',
        baseUrl: 'https://api.test.com'
      };

      const spec = await ApiManagementService.generateOpenApiSpec(config);

      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe(config.title);
      expect(spec.info.version).toBe(config.version);
      expect(spec.info.description).toBe(config.description);
      expect(spec.servers).toHaveLength(1);
      expect(spec.servers[0].url).toBe(config.baseUrl);
      expect(spec.paths['/api/v1/users']).toBeDefined();
      expect(spec.paths['/api/v1/users'].get).toBeDefined();
      expect(spec.components.securitySchemes).toBeDefined();
    });

    it('should only include public and non-deprecated endpoints', async () => {
      // Add a private endpoint
      await ApiEndpoint.create({
        path: '/api/v1/private',
        method: 'GET',
        version: 'v1',
        description: 'Private endpoint',
        category: 'Private',
        isPublic: false,
        deprecated: false
      });

      // Add a deprecated endpoint
      await ApiEndpoint.create({
        path: '/api/v1/deprecated',
        method: 'GET',
        version: 'v1',
        description: 'Deprecated endpoint',
        category: 'Deprecated',
        isPublic: true,
        deprecated: true
      });

      const config = {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test API Description',
        baseUrl: 'https://api.test.com'
      };

      const spec = await ApiManagementService.generateOpenApiSpec(config);

      expect(Object.keys(spec.paths)).toHaveLength(1);
      expect(spec.paths['/api/v1/users']).toBeDefined();
      expect(spec.paths['/api/v1/private']).toBeUndefined();
      expect(spec.paths['/api/v1/deprecated']).toBeUndefined();
    });
  });

  describe('API Keys Management', () => {
    it('should create API key', async () => {
      const keyData = {
        name: 'Test API Key',
        description: 'Test description',
        userId: userId.toString(),
        scopes: ['read:users', 'write:users'],
        environment: 'development' as const
      };

      const result = await ApiManagementService.createApiKey(keyData);

      expect(result.apiKey._id).toBeDefined();
      expect(result.apiKey.name).toBe(keyData.name);
      expect(result.apiKey.scopes).toEqual(keyData.scopes);
      expect(result.key).toMatch(/^pk_[a-f0-9]{32}\.[a-f0-9]{64}$/);
    });

    it('should get API keys with filtering', async () => {
      const keyData = {
        name: 'Test API Key',
        userId: userId.toString(),
        scopes: ['read:users'],
        environment: 'development' as const
      };

      await ApiManagementService.createApiKey(keyData);

      const result = await ApiManagementService.getApiKeys({
        userId: userId.toString()
      });

      expect(result.apiKeys).toHaveLength(1);
      expect(result.apiKeys[0].name).toBe(keyData.name);
    });

    it('should revoke API key', async () => {
      const keyData = {
        name: 'Test API Key',
        userId: userId.toString(),
        scopes: ['read:users'],
        environment: 'development' as const
      };

      const result = await ApiManagementService.createApiKey(keyData);
      await ApiManagementService.revokeApiKey(result.apiKey.keyId);

      const revokedKey = await ApiKey.findOne({ keyId: result.apiKey.keyId });
      expect(revokedKey!.isActive).toBe(false);
    });

    it('should validate API key', async () => {
      const keyData = {
        name: 'Test API Key',
        userId: userId.toString(),
        scopes: ['read:users'],
        environment: 'development' as const
      };

      const result = await ApiManagementService.createApiKey(keyData);
      const validatedKey = await ApiManagementService.validateApiKey(result.key);

      expect(validatedKey).toBeDefined();
      expect(validatedKey!.keyId).toBe(result.apiKey.keyId);
    });

    it('should return null for invalid API key', async () => {
      const invalidKey = 'pk_invalid.invalid_key';
      const validatedKey = await ApiManagementService.validateApiKey(invalidKey);

      expect(validatedKey).toBeNull();
    });
  });

  describe('Usage Analytics', () => {
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
        },
        {
          endpoint: '/api/v1/products',
          method: 'GET',
          version: 'v1',
          userId,
          timestamp: new Date(now.getTime() - 3000),
          responseTime: 150,
          statusCode: 500,
          ipAddress: '192.168.1.1'
        }
      ];

      await ApiUsageMetrics.insertMany(metrics);
    });

    it('should get usage analytics', async () => {
      const analytics = await ApiManagementService.getUsageAnalytics();

      expect(analytics.totalRequests).toBe(3);
      expect(analytics.averageResponseTime).toBe(150);
      expect(analytics.errorRate).toBe(33.33);
      expect(analytics.topEndpoints).toHaveLength(2);
      expect(analytics.timeSeriesData).toBeDefined();
    });

    it('should filter analytics by endpoint', async () => {
      const analytics = await ApiManagementService.getUsageAnalytics({
        endpoint: '/api/v1/users'
      });

      expect(analytics.totalRequests).toBe(2);
      expect(analytics.errorRate).toBe(0);
    });

    it('should filter analytics by status code', async () => {
      const analytics = await ApiManagementService.getUsageAnalytics({
        statusCode: 500
      });

      expect(analytics.totalRequests).toBe(1);
      expect(analytics.errorRate).toBe(100);
    });

    it('should record usage metrics', async () => {
      const usageData = {
        endpoint: '/api/v1/test',
        method: 'GET',
        version: 'v1',
        userId,
        timestamp: new Date(),
        responseTime: 100,
        statusCode: 200,
        ipAddress: '192.168.1.1'
      };

      await ApiManagementService.recordUsage(usageData);

      const metrics = await ApiUsageMetrics.find({ endpoint: '/api/v1/test' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].responseTime).toBe(100);
    });
  });

  describe('Utility Methods', () => {
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
          path: '/api/v2/users',
          method: 'GET',
          version: 'v2',
          description: 'Get users v2',
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

    it('should get API versions', async () => {
      const versions = await ApiManagementService.getApiVersions();

      expect(versions).toEqual(['v1', 'v2']);
    });

    it('should get API categories', async () => {
      const categories = await ApiManagementService.getApiCategories();

      expect(categories).toEqual(['Product Management', 'User Management']);
    });
  });
});