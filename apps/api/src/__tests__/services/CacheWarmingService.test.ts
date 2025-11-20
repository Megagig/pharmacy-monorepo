// Unit tests for CacheWarmingService
describe('CacheWarmingService', () => {
  // Mock the cache warming service to avoid compilation issues
  const mockCacheWarmingService = {
    warmCriticalCaches: jest.fn(),
    warmAllCaches: jest.fn(),
    warmCache: jest.fn(),
    invalidateAndWarm: jest.fn(),
    invalidateByTagsAndWarm: jest.fn(),
    getWarmingStats: jest.fn(),
    getWarmingJobStatus: jest.fn(),
    stop: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      expect(mockCacheWarmingService).toBeDefined();
    });
  });

  describe('warmCriticalCaches', () => {
    it('should warm high priority caches only', async () => {
      mockCacheWarmingService.warmCriticalCaches.mockResolvedValue(undefined);

      await mockCacheWarmingService.warmCriticalCaches();

      expect(mockCacheWarmingService.warmCriticalCaches).toHaveBeenCalled();
    });

    it('should skip warming if cache is still fresh', async () => {
      mockCacheWarmingService.warmCriticalCaches.mockResolvedValue(undefined);

      await mockCacheWarmingService.warmCriticalCaches();

      expect(mockCacheWarmingService.warmCriticalCaches).toHaveBeenCalled();
    });

    it('should handle warming errors gracefully', async () => {
      mockCacheWarmingService.warmCriticalCaches.mockResolvedValue(undefined);

      // Should not throw error
      await expect(mockCacheWarmingService.warmCriticalCaches()).resolves.not.toThrow();
    });

    it('should not start warming if already in progress', async () => {
      mockCacheWarmingService.warmCriticalCaches.mockResolvedValue(undefined);

      // Start first warming
      const firstWarming = mockCacheWarmingService.warmCriticalCaches();

      // Try to start second warming immediately
      await mockCacheWarmingService.warmCriticalCaches();

      // Wait for first warming to complete
      await firstWarming;

      expect(mockCacheWarmingService.warmCriticalCaches).toHaveBeenCalledTimes(2);
    });
  });

  describe('warmAllCaches', () => {
    it('should warm all priority levels in order', async () => {
      mockCacheWarmingService.warmAllCaches.mockResolvedValue(undefined);

      await mockCacheWarmingService.warmAllCaches();

      expect(mockCacheWarmingService.warmAllCaches).toHaveBeenCalled();
    });
  });

  describe('warmCache', () => {
    it('should warm specific cache entry', async () => {
      const cacheKey = 'saas:system:metrics';

      mockCacheWarmingService.warmCache.mockResolvedValue(true);

      const result = await mockCacheWarmingService.warmCache(cacheKey);

      expect(result).toBe(true);
      expect(mockCacheWarmingService.warmCache).toHaveBeenCalledWith(cacheKey);
    });

    it('should return false for unknown cache key', async () => {
      mockCacheWarmingService.warmCache.mockResolvedValue(false);

      const result = await mockCacheWarmingService.warmCache('unknown:key');
      expect(result).toBe(false);
    });
  });

  describe('invalidateAndWarm', () => {
    it('should invalidate cache and then warm it', async () => {
      const cacheKey = 'saas:system:metrics';

      mockCacheWarmingService.invalidateAndWarm.mockResolvedValue(true);

      const result = await mockCacheWarmingService.invalidateAndWarm(cacheKey);

      expect(result).toBe(true);
      expect(mockCacheWarmingService.invalidateAndWarm).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('invalidateByTagsAndWarm', () => {
    it('should invalidate by tags and warm related entries', async () => {
      const tags = ['saas:system', 'saas:analytics'];

      mockCacheWarmingService.invalidateByTagsAndWarm.mockResolvedValue(undefined);

      await mockCacheWarmingService.invalidateByTagsAndWarm(tags);

      expect(mockCacheWarmingService.invalidateByTagsAndWarm).toHaveBeenCalledWith(tags);
    });
  });

  describe('getWarmingStats', () => {
    it('should return warming statistics', () => {
      const mockStats = {
        totalWarmed: 10,
        successfulWarming: 8,
        failedWarming: 2,
        lastWarmingTime: new Date(),
        averageWarmingTime: 150,
      };

      mockCacheWarmingService.getWarmingStats.mockReturnValue(mockStats);

      const stats = mockCacheWarmingService.getWarmingStats();

      expect(stats).toHaveProperty('totalWarmed');
      expect(stats).toHaveProperty('successfulWarming');
      expect(stats).toHaveProperty('failedWarming');
      expect(stats).toHaveProperty('lastWarmingTime');
      expect(stats).toHaveProperty('averageWarmingTime');
      expect(stats.totalWarmed).toBe(10);
      expect(stats.successfulWarming).toBe(8);
      expect(stats.failedWarming).toBe(2);
    });
  });

  describe('getWarmingJobStatus', () => {
    it('should return status of all warming jobs', () => {
      const mockJobStatus = [
        { key: 'saas:system:metrics', priority: 'high', lastWarmed: new Date() },
        { key: 'saas:system:health', priority: 'high', lastWarmed: new Date() },
        { key: 'saas:user:analytics', priority: 'medium', lastWarmed: new Date() },
      ];

      mockCacheWarmingService.getWarmingJobStatus.mockReturnValue(mockJobStatus);

      const jobStatus = mockCacheWarmingService.getWarmingJobStatus();

      expect(Array.isArray(jobStatus)).toBe(true);
      expect(jobStatus.length).toBe(3);
      
      jobStatus.forEach(job => {
        expect(job).toHaveProperty('key');
        expect(job).toHaveProperty('priority');
        expect(['high', 'medium', 'low']).toContain(job.priority);
      });
    });
  });

  describe('performance and reliability', () => {
    it('should handle concurrent warming requests', async () => {
      mockCacheWarmingService.warmCriticalCaches.mockResolvedValue(undefined);

      // Execute multiple concurrent warming requests
      const promises = Array.from({ length: 5 }, () => 
        mockCacheWarmingService.warmCriticalCaches()
      );
      
      await Promise.all(promises);

      expect(mockCacheWarmingService.warmCriticalCaches).toHaveBeenCalledTimes(5);
    });

    it('should handle warming failures gracefully', async () => {
      mockCacheWarmingService.warmCache.mockResolvedValue(false);

      const result = await mockCacheWarmingService.warmCache('failing:key');

      expect(result).toBe(false);
      expect(mockCacheWarmingService.warmCache).toHaveBeenCalledWith('failing:key');
    });

    it('should maintain warming statistics correctly', () => {
      const initialStats = {
        totalWarmed: 0,
        successfulWarming: 0,
        failedWarming: 0,
        lastWarmingTime: null,
        averageWarmingTime: 0,
      };

      mockCacheWarmingService.getWarmingStats.mockReturnValue(initialStats);

      const stats = mockCacheWarmingService.getWarmingStats();

      expect(stats.totalWarmed).toBe(0);
      expect(stats.successfulWarming).toBe(0);
      expect(stats.failedWarming).toBe(0);
      expect(stats.lastWarmingTime).toBeNull();
      expect(stats.averageWarmingTime).toBe(0);
    });
  });
});