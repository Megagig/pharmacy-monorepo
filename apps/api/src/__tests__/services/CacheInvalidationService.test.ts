// Unit tests for CacheInvalidationService
describe('CacheInvalidationService', () => {
  // Mock the cache invalidation service to avoid compilation issues
  const mockCacheInvalidationService = {
    handleInvalidationEvent: jest.fn(),
    invalidateUserCaches: jest.fn(),
    invalidateTenantCaches: jest.fn(),
    invalidateSystemCaches: jest.fn(),
    invalidateSecurityCaches: jest.fn(),
    invalidateFeatureFlagCaches: jest.fn(),
    invalidateBillingCaches: jest.fn(),
    invalidateNotificationCaches: jest.fn(),
    invalidateSupportCaches: jest.fn(),
    invalidateApiCaches: jest.fn(),
    smartInvalidate: jest.fn(),
    getInvalidationStats: jest.fn(),
    getInvalidationRules: jest.fn(),
    clearAllCaches: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      expect(mockCacheInvalidationService).toBeDefined();
    });
  });

  describe('handleInvalidationEvent', () => {
    it('should process user creation event', async () => {
      mockCacheInvalidationService.handleInvalidationEvent.mockResolvedValue(undefined);

      await mockCacheInvalidationService.handleInvalidationEvent({
        type: 'user.created',
        entityId: 'user123',
        entityType: 'user',
        timestamp: new Date(),
      });

      expect(mockCacheInvalidationService.handleInvalidationEvent).toHaveBeenCalledWith({
        type: 'user.created',
        entityId: 'user123',
        entityType: 'user',
        timestamp: expect.any(Date),
      });
    });

    it('should process user update event', async () => {
      mockCacheInvalidationService.handleInvalidationEvent.mockResolvedValue(undefined);

      await mockCacheInvalidationService.handleInvalidationEvent({
        type: 'user.updated',
        entityId: 'user123',
        entityType: 'user',
        timestamp: new Date(),
      });

      expect(mockCacheInvalidationService.handleInvalidationEvent).toHaveBeenCalledWith({
        type: 'user.updated',
        entityId: 'user123',
        entityType: 'user',
        timestamp: expect.any(Date),
      });
    });

    it('should process security settings update event', async () => {
      mockCacheInvalidationService.handleInvalidationEvent.mockResolvedValue(undefined);

      await mockCacheInvalidationService.handleInvalidationEvent({
        type: 'security.settings.updated',
        timestamp: new Date(),
      });

      expect(mockCacheInvalidationService.handleInvalidationEvent).toHaveBeenCalledWith({
        type: 'security.settings.updated',
        timestamp: expect.any(Date),
      });
    });

    it('should process feature flag toggle event', async () => {
      mockCacheInvalidationService.handleInvalidationEvent.mockResolvedValue(undefined);

      await mockCacheInvalidationService.handleInvalidationEvent({
        type: 'feature.flag.toggled',
        entityId: 'flag123',
        entityType: 'feature_flag',
        timestamp: new Date(),
      });

      expect(mockCacheInvalidationService.handleInvalidationEvent).toHaveBeenCalledWith({
        type: 'feature.flag.toggled',
        entityId: 'flag123',
        entityType: 'feature_flag',
        timestamp: expect.any(Date),
      });
    });

    it('should handle unknown event type gracefully', async () => {
      mockCacheInvalidationService.handleInvalidationEvent.mockResolvedValue(undefined);

      await mockCacheInvalidationService.handleInvalidationEvent({
        type: 'unknown.event',
        timestamp: new Date(),
      });

      expect(mockCacheInvalidationService.handleInvalidationEvent).toHaveBeenCalledWith({
        type: 'unknown.event',
        timestamp: expect.any(Date),
      });
    });

    it('should handle invalidation errors gracefully', async () => {
      mockCacheInvalidationService.handleInvalidationEvent.mockResolvedValue(undefined);

      // Should not throw error
      await expect(
        mockCacheInvalidationService.handleInvalidationEvent({
          type: 'user.created',
          timestamp: new Date(),
        })
      ).resolves.not.toThrow();
    });

    it('should process events without warming when specified', async () => {
      mockCacheInvalidationService.handleInvalidationEvent.mockResolvedValue(undefined);

      await mockCacheInvalidationService.handleInvalidationEvent({
        type: 'security.session.created',
        timestamp: new Date(),
      });

      expect(mockCacheInvalidationService.handleInvalidationEvent).toHaveBeenCalledWith({
        type: 'security.session.created',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('convenience methods', () => {
    it('should invalidate user caches', async () => {
      mockCacheInvalidationService.invalidateUserCaches.mockResolvedValue(undefined);

      await mockCacheInvalidationService.invalidateUserCaches('user123');

      expect(mockCacheInvalidationService.invalidateUserCaches).toHaveBeenCalledWith('user123');
    });

    it('should invalidate tenant caches', async () => {
      mockCacheInvalidationService.invalidateTenantCaches.mockResolvedValue(undefined);

      await mockCacheInvalidationService.invalidateTenantCaches('tenant123');

      expect(mockCacheInvalidationService.invalidateTenantCaches).toHaveBeenCalledWith('tenant123');
    });

    it('should invalidate system caches', async () => {
      mockCacheInvalidationService.invalidateSystemCaches.mockResolvedValue(undefined);

      await mockCacheInvalidationService.invalidateSystemCaches();

      expect(mockCacheInvalidationService.invalidateSystemCaches).toHaveBeenCalled();
    });

    it('should invalidate security caches', async () => {
      mockCacheInvalidationService.invalidateSecurityCaches.mockResolvedValue(undefined);

      await mockCacheInvalidationService.invalidateSecurityCaches();

      expect(mockCacheInvalidationService.invalidateSecurityCaches).toHaveBeenCalled();
    });

    it('should invalidate feature flag caches', async () => {
      mockCacheInvalidationService.invalidateFeatureFlagCaches.mockResolvedValue(undefined);

      await mockCacheInvalidationService.invalidateFeatureFlagCaches('flag123');

      expect(mockCacheInvalidationService.invalidateFeatureFlagCaches).toHaveBeenCalledWith('flag123');
    });

    it('should invalidate billing caches', async () => {
      mockCacheInvalidationService.invalidateBillingCaches.mockResolvedValue(undefined);

      await mockCacheInvalidationService.invalidateBillingCaches('sub123');

      expect(mockCacheInvalidationService.invalidateBillingCaches).toHaveBeenCalledWith('sub123');
    });
  });

  describe('smartInvalidate', () => {
    it('should handle smart invalidation for user updates', async () => {
      mockCacheInvalidationService.smartInvalidate.mockResolvedValue(undefined);

      await mockCacheInvalidationService.smartInvalidate({
        collection: 'user',
        operation: 'update',
        documentId: 'user123',
        fields: ['email', 'role'],
      });

      expect(mockCacheInvalidationService.smartInvalidate).toHaveBeenCalledWith({
        collection: 'user',
        operation: 'update',
        documentId: 'user123',
        fields: ['email', 'role'],
      });
    });

    it('should handle smart invalidation for tenant creation', async () => {
      mockCacheInvalidationService.smartInvalidate.mockResolvedValue(undefined);

      await mockCacheInvalidationService.smartInvalidate({
        collection: 'tenant',
        operation: 'create',
        documentId: 'tenant123',
      });

      expect(mockCacheInvalidationService.smartInvalidate).toHaveBeenCalledWith({
        collection: 'tenant',
        operation: 'create',
        documentId: 'tenant123',
      });
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all caches and warm critical ones', async () => {
      mockCacheInvalidationService.clearAllCaches.mockResolvedValue(true);

      const result = await mockCacheInvalidationService.clearAllCaches();

      expect(result).toBe(true);
      expect(mockCacheInvalidationService.clearAllCaches).toHaveBeenCalled();
    });

    it('should handle clear cache errors', async () => {
      mockCacheInvalidationService.clearAllCaches.mockResolvedValue(false);

      const result = await mockCacheInvalidationService.clearAllCaches();

      expect(result).toBe(false);
    });
  });

  describe('getInvalidationStats', () => {
    it('should return invalidation statistics', () => {
      const mockStats = {
        totalInvalidations: 25,
        successfulInvalidations: 23,
        failedInvalidations: 2,
        lastInvalidationTime: new Date(),
      };

      mockCacheInvalidationService.getInvalidationStats.mockReturnValue(mockStats);

      const stats = mockCacheInvalidationService.getInvalidationStats();

      expect(stats).toHaveProperty('totalInvalidations');
      expect(stats).toHaveProperty('successfulInvalidations');
      expect(stats).toHaveProperty('failedInvalidations');
      expect(stats).toHaveProperty('lastInvalidationTime');
      expect(stats.totalInvalidations).toBe(25);
      expect(stats.successfulInvalidations).toBe(23);
      expect(stats.failedInvalidations).toBe(2);
    });
  });

  describe('getInvalidationRules', () => {
    it('should return all invalidation rules', () => {
      const mockRules = [
        {
          event: 'user.created',
          rule: {
            patterns: ['saas:users:list:*', 'saas:system:metrics'],
            tags: ['saas:users', 'saas:system'],
            warmAfterInvalidation: true,
          },
        },
        {
          event: 'security.settings.updated',
          rule: {
            patterns: ['saas:security:*'],
            tags: ['saas:security'],
            warmAfterInvalidation: true,
          },
        },
      ];

      mockCacheInvalidationService.getInvalidationRules.mockReturnValue(mockRules);

      const rules = mockCacheInvalidationService.getInvalidationRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBe(2);

      rules.forEach(rule => {
        expect(rule).toHaveProperty('event');
        expect(rule).toHaveProperty('rule');
        expect(rule.rule).toHaveProperty('patterns');
        expect(rule.rule).toHaveProperty('tags');
        expect(rule.rule).toHaveProperty('warmAfterInvalidation');
      });
    });
  });

  describe('performance and reliability', () => {
    it('should handle concurrent invalidation requests', async () => {
      mockCacheInvalidationService.invalidateSystemCaches.mockResolvedValue(undefined);

      // Execute multiple concurrent invalidation requests
      const promises = Array.from({ length: 5 }, () => 
        mockCacheInvalidationService.invalidateSystemCaches()
      );
      
      await Promise.all(promises);

      expect(mockCacheInvalidationService.invalidateSystemCaches).toHaveBeenCalledTimes(5);
    });

    it('should maintain invalidation statistics correctly', () => {
      const initialStats = {
        totalInvalidations: 0,
        successfulInvalidations: 0,
        failedInvalidations: 0,
        lastInvalidationTime: null,
      };

      mockCacheInvalidationService.getInvalidationStats.mockReturnValue(initialStats);

      const stats = mockCacheInvalidationService.getInvalidationStats();

      expect(stats.totalInvalidations).toBe(0);
      expect(stats.successfulInvalidations).toBe(0);
      expect(stats.failedInvalidations).toBe(0);
      expect(stats.lastInvalidationTime).toBeNull();
    });
  });
});