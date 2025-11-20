import { SystemMetrics } from '../../models/SystemMetrics';

describe('SystemMetrics Model', () => {

  describe('Model Validation', () => {
    it('should create a valid SystemMetrics document', async () => {
      const validMetrics = {
        timestamp: new Date(),
        totalUsers: 100,
        activeUsers: 80,
        newUsersToday: 5,
        activeSubscriptions: 50,
        totalWorkspaces: 25,
        monthlyRevenue: 5000,
        systemUptime: '99.9%',
        activeFeatureFlags: 10,
        pendingLicenses: 3,
        supportTickets: {
          open: 5,
          resolved: 20,
          critical: 1,
        },
        systemHealth: {
          database: {
            status: 'healthy' as const,
            responseTime: 50,
            connections: 10,
          },
          api: {
            status: 'healthy' as const,
            responseTime: 100,
            requestsPerMinute: 1000,
          },
          memory: {
            status: 'warning' as const,
            usage: 75,
            available: 25,
          },
          cache: {
            status: 'healthy' as const,
            hitRate: 95,
            connections: 5,
          },
        },
      };

      const metrics = new SystemMetrics(validMetrics);
      const savedMetrics = await metrics.save();

      expect(savedMetrics._id).toBeDefined();
      expect(savedMetrics.totalUsers).toBe(100);
      expect(savedMetrics.systemHealth.database.status).toBe('healthy');
      expect(savedMetrics.createdAt).toBeDefined();
      expect(savedMetrics.updatedAt).toBeDefined();
    });

    it('should require all mandatory fields', async () => {
      const incompleteMetrics = new SystemMetrics({
        timestamp: new Date(),
        totalUsers: 100,
        // Missing required fields
      });

      await expect(incompleteMetrics.save()).rejects.toThrow();
    });

    it('should validate numeric constraints', async () => {
      const invalidMetrics = new SystemMetrics({
        timestamp: new Date(),
        totalUsers: -1, // Invalid negative value
        activeUsers: 80,
        newUsersToday: 5,
        activeSubscriptions: 50,
        totalWorkspaces: 25,
        monthlyRevenue: 5000,
        systemUptime: '99.9%',
        activeFeatureFlags: 10,
        pendingLicenses: 3,
        supportTickets: {
          open: 5,
          resolved: 20,
          critical: 1,
        },
        systemHealth: {
          database: {
            status: 'healthy' as const,
            responseTime: 50,
            connections: 10,
          },
          api: {
            status: 'healthy' as const,
            responseTime: 100,
            requestsPerMinute: 1000,
          },
          memory: {
            status: 'healthy' as const,
            usage: 75,
            available: 25,
          },
          cache: {
            status: 'healthy' as const,
            hitRate: 150, // Invalid value > 100
            connections: 5,
          },
        },
      });

      await expect(invalidMetrics.save()).rejects.toThrow();
    });

    it('should validate enum values for health status', async () => {
      const invalidStatusMetrics = new SystemMetrics({
        timestamp: new Date(),
        totalUsers: 100,
        activeUsers: 80,
        newUsersToday: 5,
        activeSubscriptions: 50,
        totalWorkspaces: 25,
        monthlyRevenue: 5000,
        systemUptime: '99.9%',
        activeFeatureFlags: 10,
        pendingLicenses: 3,
        supportTickets: {
          open: 5,
          resolved: 20,
          critical: 1,
        },
        systemHealth: {
          database: {
            status: 'invalid_status' as any, // Invalid enum value
            responseTime: 50,
            connections: 10,
          },
          api: {
            status: 'healthy' as const,
            responseTime: 100,
            requestsPerMinute: 1000,
          },
          memory: {
            status: 'healthy' as const,
            usage: 75,
            available: 25,
          },
          cache: {
            status: 'healthy' as const,
            hitRate: 95,
            connections: 5,
          },
        },
      });

      await expect(invalidStatusMetrics.save()).rejects.toThrow();
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for time-series queries', async () => {
      const indexes = await SystemMetrics.collection.getIndexes();
      
      expect(indexes).toHaveProperty('timestamp_-1');
      expect(indexes).toHaveProperty('createdAt_-1');
      expect(indexes).toHaveProperty('createdAt_1');
    });
  });

  describe('Methods', () => {
    it('should exclude __v field in JSON output', async () => {
      const metrics = new SystemMetrics({
        timestamp: new Date(),
        totalUsers: 100,
        activeUsers: 80,
        newUsersToday: 5,
        activeSubscriptions: 50,
        totalWorkspaces: 25,
        monthlyRevenue: 5000,
        systemUptime: '99.9%',
        activeFeatureFlags: 10,
        pendingLicenses: 3,
        supportTickets: {
          open: 5,
          resolved: 20,
          critical: 1,
        },
        systemHealth: {
          database: {
            status: 'healthy' as const,
            responseTime: 50,
            connections: 10,
          },
          api: {
            status: 'healthy' as const,
            responseTime: 100,
            requestsPerMinute: 1000,
          },
          memory: {
            status: 'healthy' as const,
            usage: 75,
            available: 25,
          },
          cache: {
            status: 'healthy' as const,
            hitRate: 95,
            connections: 5,
          },
        },
      });

      const savedMetrics = await metrics.save();
      const jsonOutput = savedMetrics.toJSON();

      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput).toHaveProperty('_id');
      expect(jsonOutput).toHaveProperty('totalUsers');
    });
  });

  describe('TTL Index', () => {
    it('should have TTL index configuration', async () => {
      // Check that the schema has TTL index configuration
      const schema = SystemMetrics.schema;
      const indexes = schema.indexes();
      
      // Look for TTL index configuration
      const ttlIndexConfig = indexes.find((index: any) => 
        index[1] && index[1].expireAfterSeconds !== undefined
      );
      
      expect(ttlIndexConfig).toBeDefined();
      expect(ttlIndexConfig[1].expireAfterSeconds).toBe(31536000); // 1 year in seconds
    });
  });
});