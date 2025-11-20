import { SaaSBackgroundJobService } from '../../services/SaaSBackgroundJobService';
import { BackgroundJobService } from '../../services/BackgroundJobService';
import { RedisCacheService } from '../../services/RedisCacheService';
import { SystemAnalyticsService } from '../../services/SystemAnalyticsService';
import { UserManagementService } from '../../services/UserManagementService';
import { CacheInvalidationService } from '../../services/CacheInvalidationService';
import { DatabaseOptimizationService } from '../../services/DatabaseOptimizationService';

// Mock dependencies
jest.mock('../../services/BackgroundJobService');
jest.mock('../../services/RedisCacheService');
jest.mock('../../services/SystemAnalyticsService');
jest.mock('../../services/UserManagementService');
jest.mock('../../services/CacheInvalidationService');
jest.mock('../../services/DatabaseOptimizationService');
jest.mock('../../utils/logger');
jest.mock('bull');

describe('SaaSBackgroundJobService', () => {
  let service: SaaSBackgroundJobService;
  let mockBaseJobService: jest.Mocked<BackgroundJobService>;
  let mockCacheService: jest.Mocked<RedisCacheService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBaseJobService = {
      queueExportJob: jest.fn(),
      queueScheduledReport: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
      getQueueStats: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    (BackgroundJobService.getInstance as jest.Mock).mockReturnValue(mockBaseJobService);
    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    (SystemAnalyticsService.getInstance as jest.Mock).mockReturnValue({});
    (UserManagementService.getInstance as jest.Mock).mockReturnValue({});
    (CacheInvalidationService.getInstance as jest.Mock).mockReturnValue({});
    (DatabaseOptimizationService.getInstance as jest.Mock).mockReturnValue({});

    // Mock Bull queue
    const mockQueue = {
      process: jest.fn(),
      add: jest.fn().mockResolvedValue({ id: 'job123' }),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
      close: jest.fn(),
    };
    const Bull = require('bull');
    Bull.mockImplementation(() => mockQueue);

    service = SaaSBackgroundJobService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SaaSBackgroundJobService.getInstance();
      const instance2 = SaaSBackgroundJobService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('queueMetricsCalculation', () => {
    it('should queue metrics calculation job successfully', async () => {
      const jobData = {
        type: 'system' as const,
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        },
        workspaceId: 'workspace123'
      };

      const result = await service.queueMetricsCalculation(jobData);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('job123');
      }
    });

    it('should handle job queueing errors', async () => {
      const Bull = require('bull');
      const mockQueue = {
        process: jest.fn(),
        add: jest.fn().mockRejectedValue(new Error('Queue error')),
        getJob: jest.fn(),
        getJobs: jest.fn(),
        getWaiting: jest.fn(),
        getActive: jest.fn(),
        getCompleted: jest.fn(),
        getFailed: jest.fn(),
        getDelayed: jest.fn(),
        close: jest.fn(),
      };
      Bull.mockImplementation(() => mockQueue);

      // Reinitialize service with error-throwing queue
      service = SaaSBackgroundJobService.getInstance();

      const jobData = {
        type: 'system' as const,
        timeRange: {
          start: new Date(),
          end: new Date()
        }
      };

      const result = await service.queueMetricsCalculation(jobData);
      expect(result).toBeNull();
    });
  });

  describe('queueNotification', () => {
    it('should queue notification job successfully', async () => {
      const jobData = {
        type: 'email' as const,
        recipients: ['user@example.com'],
        template: 'welcome',
        data: { name: 'John Doe' },
        priority: 'high' as const
      };

      const result = await service.queueNotification(jobData);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('job123');
      }
    });
  });

  describe('queueDataExport', () => {
    it('should queue data export job successfully', async () => {
      const jobData = {
        exportType: 'users' as const,
        format: 'csv' as const,
        filters: {},
        requestedBy: 'user123',
        email: 'user@example.com',
        workspaceId: 'workspace123'
      };

      const result = await service.queueDataExport(jobData);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('job123');
      }
    });
  });

  describe('queueDataImport', () => {
    it('should queue data import job successfully', async () => {
      const jobData = {
        importType: 'users' as const,
        filePath: '/path/to/file.csv',
        format: 'csv' as const,
        requestedBy: 'user123',
        workspaceId: 'workspace123'
      };

      const result = await service.queueDataImport(jobData);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('job123');
      }
    });
  });

  describe('queueMaintenanceTask', () => {
    it('should queue maintenance task successfully', async () => {
      const jobData = {
        task: 'cleanup_sessions' as const,
        options: { retentionDays: 30 }
      };

      const result = await service.queueMaintenanceTask(jobData);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('job123');
      }
    });
  });

  describe('getAllQueueStats', () => {
    it('should return queue statistics successfully', async () => {
      const result = await service.getAllQueueStats();

      expect(result).toBeDefined();
      expect(result.metricsQueue).toBeDefined();
      expect(result.notificationQueue).toBeDefined();
      expect(result.dataExportQueue).toBeDefined();
      expect(result.dataImportQueue).toBeDefined();
      expect(result.maintenanceQueue).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown service successfully', async () => {
      await expect(service.shutdown()).resolves.toBeUndefined();
    });
  });
});