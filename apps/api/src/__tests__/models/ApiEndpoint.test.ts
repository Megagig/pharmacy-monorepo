import ApiEndpoint, { IApiEndpoint } from '../../models/ApiEndpoint';

describe('ApiEndpoint Model', () => {

  beforeEach(async () => {
    await ApiEndpoint.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid API endpoint', async () => {
      const endpointData = {
        path: '/api/v1/users',
        method: 'GET',
        version: 'v1',
        description: 'Get all users',
        parameters: [
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number for pagination',
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
        },
        rateLimit: {
          requests: 100,
          window: 3600
        },
        deprecated: false,
        tags: ['users', 'admin'],
        category: 'User Management',
        isPublic: true
      };

      const endpoint = new ApiEndpoint(endpointData);
      const savedEndpoint = await endpoint.save();

      expect(savedEndpoint._id).toBeDefined();
      expect(savedEndpoint.path).toBe(endpointData.path);
      expect(savedEndpoint.method).toBe(endpointData.method);
      expect(savedEndpoint.version).toBe(endpointData.version);
      expect(savedEndpoint.description).toBe(endpointData.description);
      expect(savedEndpoint.category).toBe(endpointData.category);
      expect(savedEndpoint.isPublic).toBe(endpointData.isPublic);
      expect(savedEndpoint.deprecated).toBe(endpointData.deprecated);
      expect(savedEndpoint.parameters).toHaveLength(1);
      expect(savedEndpoint.responses).toHaveLength(1);
      expect(savedEndpoint.tags).toEqual(endpointData.tags);
    });

    it('should require path, method, version, description, and category', async () => {
      const endpoint = new ApiEndpoint({});

      let error;
      try {
        await endpoint.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.path).toBeDefined();
      expect(error.errors.method).toBeDefined();
      expect(error.errors.description).toBeDefined();
      expect(error.errors.category).toBeDefined();
    });

    it('should validate HTTP method enum', async () => {
      const endpoint = new ApiEndpoint({
        path: '/api/v1/test',
        method: 'INVALID',
        version: 'v1',
        description: 'Test endpoint',
        category: 'Test'
      });

      let error;
      try {
        await endpoint.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.method).toBeDefined();
    });

    it('should validate parameter types', async () => {
      const endpoint = new ApiEndpoint({
        path: '/api/v1/test',
        method: 'GET',
        version: 'v1',
        description: 'Test endpoint',
        category: 'Test',
        parameters: [
          {
            name: 'test',
            type: 'invalid_type',
            required: false,
            description: 'Test parameter'
          }
        ]
      });

      let error;
      try {
        await endpoint.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors['parameters.0.type']).toBeDefined();
    });

    it('should validate authentication type', async () => {
      const endpoint = new ApiEndpoint({
        path: '/api/v1/test',
        method: 'GET',
        version: 'v1',
        description: 'Test endpoint',
        category: 'Test',
        authentication: {
          required: true,
          type: 'invalid_auth_type'
        }
      });

      let error;
      try {
        await endpoint.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors['authentication.type']).toBeDefined();
    });
  });

  describe('Indexes', () => {
    it('should enforce unique constraint on path, method, and version', async () => {
      const endpointData = {
        path: '/api/v1/users',
        method: 'GET',
        version: 'v1',
        description: 'Get all users',
        category: 'User Management'
      };

      const endpoint1 = new ApiEndpoint(endpointData);
      await endpoint1.save();

      const endpoint2 = new ApiEndpoint(endpointData);

      let error;
      try {
        await endpoint2.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // Duplicate key error
    });

    it('should allow same path and method with different versions', async () => {
      const baseData = {
        path: '/api/users',
        method: 'GET',
        description: 'Get all users',
        category: 'User Management'
      };

      const endpoint1 = new ApiEndpoint({ ...baseData, version: 'v1' });
      const endpoint2 = new ApiEndpoint({ ...baseData, version: 'v2' });

      await endpoint1.save();
      await endpoint2.save();

      const count = await ApiEndpoint.countDocuments({ path: baseData.path });
      expect(count).toBe(2);
    });
  });

  describe('Default Values', () => {
    it('should set default values correctly', async () => {
      const endpoint = new ApiEndpoint({
        path: '/api/v1/test',
        method: 'GET',
        description: 'Test endpoint',
        category: 'Test'
      });

      const savedEndpoint = await endpoint.save();

      expect(savedEndpoint.version).toBe('v1');
      expect(savedEndpoint.deprecated).toBe(false);
      expect(savedEndpoint.isPublic).toBe(false);
      expect(savedEndpoint.authentication.required).toBe(true);
      expect(savedEndpoint.authentication.type).toBe('bearer');
      expect(savedEndpoint.rateLimit.requests).toBe(100);
      expect(savedEndpoint.rateLimit.window).toBe(3600);
      expect(savedEndpoint.parameters).toEqual([]);
      expect(savedEndpoint.responses).toEqual([]);
      expect(savedEndpoint.tags).toEqual([]);
    });
  });

  describe('Queries', () => {
    beforeEach(async () => {
      const endpoints = [
        {
          path: '/api/v1/users',
          method: 'GET',
          version: 'v1',
          description: 'Get users',
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

    it('should find endpoints by category', async () => {
      const endpoints = await ApiEndpoint.find({ category: 'User Management' });
      expect(endpoints).toHaveLength(2);
    });

    it('should find public endpoints', async () => {
      const endpoints = await ApiEndpoint.find({ isPublic: true });
      expect(endpoints).toHaveLength(2);
    });

    it('should find non-deprecated endpoints', async () => {
      const endpoints = await ApiEndpoint.find({ deprecated: false });
      expect(endpoints).toHaveLength(2);
    });

    it('should find endpoints by tags', async () => {
      const endpoints = await ApiEndpoint.find({ tags: { $in: ['admin'] } });
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].method).toBe('POST');
    });
  });
});