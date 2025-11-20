// Enhanced Background Job Service for SaaS Settings Module
import Bull, { Queue, Job, JobOptions } from 'bull';
import { BackgroundJobService } from './BackgroundJobService';
import { SystemAnalyticsService } from './SystemAnalyticsService';
import { UserManagementService } from './UserManagementService';
// Import types for services that may not exist yet
interface SecurityMonitoringServiceInterface {
  calculateSecurityMetrics(timeRange: any): Promise<any>;
  exportAuditLogs(filters: any, dateRange?: any): Promise<any>;
  cleanupExpiredSessions(): Promise<any>;
  archiveOldAuditLogs(retentionDays: number): Promise<any>;
}

interface NotificationServiceInterface {
  sendBulkEmail(recipients: string[], template: string, data: any): Promise<any>;
  sendBulkSMS(recipients: string[], template: string, data: any): Promise<any>;
  sendWebhookNotifications(recipients: string[], data: any): Promise<any>;
  sendPushNotifications(recipients: string[], template: string, data: any): Promise<any>;
}
import { CacheInvalidationService } from './CacheInvalidationService';
import { DatabaseOptimizationService } from './DatabaseOptimizationService';
import { RedisCacheService } from './RedisCacheService';
import logger from '../utils/logger';
import { performance } from 'perf_hooks';

interface MetricsCalculationJobData {
  type: 'system' | 'user' | 'subscription' | 'security' | 'api';
  timeRange: {
    start: Date;
    end: Date;
  };
  workspaceId?: string;
  tenantId?: string;
  options?: {
    includeHistorical?: boolean;
    granularity?: 'hour' | 'day' | 'week' | 'month';
  };
}

interface NotificationJobData {
  type: 'email' | 'sms' | 'webhook' | 'push';
  recipients: string[];
  template: string;
  data: any;
  priority: 'high' | 'medium' | 'low';
  scheduledFor?: Date;
  retryOptions?: {
    maxRetries: number;
    backoffDelay: number;
  };
}

interface DataExportJobData {
  exportType: 'users' | 'analytics' | 'audit_logs' | 'system_metrics' | 'support_tickets';
  format: 'csv' | 'excel' | 'json' | 'pdf';
  filters: any;
  requestedBy: string;
  email: string;
  workspaceId?: string;
  tenantId?: string;
  options?: {
    includeMetadata?: boolean;
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
}

interface DataImportJobData {
  importType: 'users' | 'tenants' | 'settings';
  filePath: string;
  format: 'csv' | 'excel' | 'json';
  requestedBy: string;
  workspaceId?: string;
  options?: {
    validateOnly?: boolean;
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  };
}

interface MaintenanceJobData {
  task: 'cleanup_sessions' | 'archive_logs' | 'optimize_indexes' | 'cache_warming' | 'health_check';
  options?: any;
}

export class SaaSBackgroundJobService {
  private static instance: SaaSBackgroundJobService;
  private baseJobService: BackgroundJobService;
  
  // SaaS-specific queues
  private metricsQueue: Queue<MetricsCalculationJobData>;
  private notificationQueue: Queue<NotificationJobData>;
  private dataExportQueue: Queue<DataExportJobData>;
  private dataImportQueue: Queue<DataImportJobData>;
  private maintenanceQueue: Queue<MaintenanceJobData>;

  // Service dependencies
  private systemAnalytics: SystemAnalyticsService;
  private userManagement: UserManagementService;
  private securityMonitoring: SecurityMonitoringServiceInterface;
  private notificationService: NotificationServiceInterface;
  private cacheInvalidation: CacheInvalidationService;
  private dbOptimization: DatabaseOptimizationService;
  private cacheService: RedisCacheService;

  constructor() {
    this.baseJobService = BackgroundJobService.getInstance();
    
    // Initialize service dependencies
    this.systemAnalytics = SystemAnalyticsService.getInstance();
    this.userManagement = UserManagementService.getInstance();
    this.cacheInvalidation = CacheInvalidationService.getInstance();
    this.dbOptimization = DatabaseOptimizationService.getInstance();
    this.cacheService = RedisCacheService.getInstance();
    
    // Initialize optional services with fallbacks
    try {
      const SecurityMonitoringService = (global as any).SecurityMonitoringService || 
        require('./SecurityMonitoringService').SecurityMonitoringService;
      this.securityMonitoring = SecurityMonitoringService.getInstance();
    } catch (error) {
      logger.warn('SecurityMonitoringService not available, using mock');
      this.securityMonitoring = this.createMockSecurityService();
    }
    
    try {
      const NotificationService = (global as any).NotificationService || 
        require('./NotificationService').NotificationService;
      this.notificationService = NotificationService.getInstance();
    } catch (error) {
      logger.warn('NotificationService not available, using mock');
      this.notificationService = this.createMockNotificationService();
    }

    this.initializeQueues();
    this.setupJobProcessors();
    this.setupEventHandlers();
    this.scheduleRecurringJobs();
  }

  static getInstance(): SaaSBackgroundJobService {
    if (!SaaSBackgroundJobService.instance) {
      SaaSBackgroundJobService.instance = new SaaSBackgroundJobService();
    }
    return SaaSBackgroundJobService.instance;
  }

  /**
   * Initialize SaaS-specific job queues
   */
  private initializeQueues(): void {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_JOB_DB || '1'),
      };

      this.metricsQueue = new Bull('saas-metrics-calculation', { redis: redisConfig });
      this.notificationQueue = new Bull('saas-notifications', { redis: redisConfig });
      this.dataExportQueue = new Bull('saas-data-export', { redis: redisConfig });
      this.dataImportQueue = new Bull('saas-data-import', { redis: redisConfig });
      this.maintenanceQueue = new Bull('saas-maintenance', { redis: redisConfig });

      logger.info('SaaS background job queues initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SaaS job queues:', error);
      throw error;
    }
  }

  /**
   * Setup job processors for each queue
   */
  private setupJobProcessors(): void {
    // Metrics calculation processor
    this.metricsQueue.process('calculate-metrics', 3, async (job: Job<MetricsCalculationJobData>) => {
      return this.processMetricsCalculationJob(job);
    });

    // Notification processor
    this.notificationQueue.process('send-notification', 10, async (job: Job<NotificationJobData>) => {
      return this.processNotificationJob(job);
    });

    // Data export processor
    this.dataExportQueue.process('export-data', 2, async (job: Job<DataExportJobData>) => {
      return this.processDataExportJob(job);
    });

    // Data import processor
    this.dataImportQueue.process('import-data', 1, async (job: Job<DataImportJobData>) => {
      return this.processDataImportJob(job);
    });

    // Maintenance processor
    this.maintenanceQueue.process('maintenance-task', 1, async (job: Job<MaintenanceJobData>) => {
      return this.processMaintenanceJob(job);
    });
  }

  /**
   * Setup event handlers for job queues
   */
  private setupEventHandlers(): void {
    // Metrics queue events
    this.metricsQueue.on('completed', (job, result) => {
      logger.info(`Metrics calculation job ${job.id} completed`, {
        type: job.data.type,
        executionTime: result.executionTime,
      });
    });

    this.metricsQueue.on('failed', (job, err) => {
      logger.error(`Metrics calculation job ${job.id} failed`, {
        type: job.data.type,
        error: err.message,
      });
    });

    // Notification queue events
    this.notificationQueue.on('completed', (job, result) => {
      logger.info(`Notification job ${job.id} completed`, {
        type: job.data.type,
        recipients: job.data.recipients.length,
        executionTime: result.executionTime,
      });
    });

    this.notificationQueue.on('failed', (job, err) => {
      logger.error(`Notification job ${job.id} failed`, {
        type: job.data.type,
        template: job.data.template,
        error: err.message,
      });
    });

    // Data export queue events
    this.dataExportQueue.on('completed', (job, result) => {
      logger.info(`Data export job ${job.id} completed`, {
        exportType: job.data.exportType,
        format: job.data.format,
        fileSize: result.fileSize,
        executionTime: result.executionTime,
      });
    });

    // Maintenance queue events
    this.maintenanceQueue.on('completed', (job, result) => {
      logger.info(`Maintenance job ${job.id} completed`, {
        task: job.data.task,
        executionTime: result.executionTime,
      });
    });
  }

  /**
   * Schedule recurring maintenance jobs
   */
  private scheduleRecurringJobs(): void {
    // Schedule metrics calculation every 5 minutes
    this.metricsQueue.add(
      'calculate-metrics',
      {
        type: 'system',
        timeRange: {
          start: new Date(Date.now() - 5 * 60 * 1000),
          end: new Date(),
        },
      },
      {
        repeat: { cron: '*/5 * * * *' },
        removeOnComplete: 5,
        removeOnFail: 2,
      }
    );

    // Schedule daily maintenance at 3 AM
    this.maintenanceQueue.add(
      'maintenance-task',
      { task: 'cleanup_sessions' },
      {
        repeat: { cron: '0 3 * * *' },
        removeOnComplete: 3,
        removeOnFail: 1,
      }
    );

    // Schedule weekly index optimization on Sundays at 2 AM
    this.maintenanceQueue.add(
      'maintenance-task',
      { task: 'optimize_indexes' },
      {
        repeat: { cron: '0 2 * * 0' },
        removeOnComplete: 2,
        removeOnFail: 1,
      }
    );

    // Schedule cache warming every hour
    this.maintenanceQueue.add(
      'maintenance-task',
      { task: 'cache_warming' },
      {
        repeat: { cron: '0 * * * *' },
        removeOnComplete: 5,
        removeOnFail: 2,
      }
    );
  }

  /**
   * Queue metrics calculation job
   */
  async queueMetricsCalculation(
    data: MetricsCalculationJobData,
    options: JobOptions = {}
  ): Promise<Job<MetricsCalculationJobData> | null> {
    try {
      const defaultOptions: JobOptions = {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
        timeout: 5 * 60 * 1000, // 5 minutes
        ...options,
      };

      return await this.metricsQueue.add('calculate-metrics', data, defaultOptions);
    } catch (error) {
      logger.error('Failed to queue metrics calculation job:', error);
      return null;
    }
  }

  /**
   * Queue notification job
   */
  async queueNotification(
    data: NotificationJobData,
    options: JobOptions = {}
  ): Promise<Job<NotificationJobData> | null> {
    try {
      const defaultOptions: JobOptions = {
        attempts: data.retryOptions?.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: data.retryOptions?.backoffDelay || 2000,
        },
        removeOnComplete: 20,
        removeOnFail: 10,
        timeout: 2 * 60 * 1000, // 2 minutes
        priority: data.priority === 'high' ? 1 : data.priority === 'medium' ? 5 : 10,
        delay: data.scheduledFor ? data.scheduledFor.getTime() - Date.now() : 0,
        ...options,
      };

      return await this.notificationQueue.add('send-notification', data, defaultOptions);
    } catch (error) {
      logger.error('Failed to queue notification job:', error);
      return null;
    }
  }

  /**
   * Queue data export job
   */
  async queueDataExport(
    data: DataExportJobData,
    options: JobOptions = {}
  ): Promise<Job<DataExportJobData> | null> {
    try {
      const defaultOptions: JobOptions = {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: 5,
        removeOnFail: 3,
        timeout: 15 * 60 * 1000, // 15 minutes
        ...options,
      };

      return await this.dataExportQueue.add('export-data', data, defaultOptions);
    } catch (error) {
      logger.error('Failed to queue data export job:', error);
      return null;
    }
  }

  /**
   * Queue data import job
   */
  async queueDataImport(
    data: DataImportJobData,
    options: JobOptions = {}
  ): Promise<Job<DataImportJobData> | null> {
    try {
      const defaultOptions: JobOptions = {
        attempts: 1, // Import jobs should not retry automatically
        removeOnComplete: 3,
        removeOnFail: 5,
        timeout: 30 * 60 * 1000, // 30 minutes
        ...options,
      };

      return await this.dataImportQueue.add('import-data', data, defaultOptions);
    } catch (error) {
      logger.error('Failed to queue data import job:', error);
      return null;
    }
  }

  /**
   * Queue maintenance job
   */
  async queueMaintenanceTask(
    data: MaintenanceJobData,
    options: JobOptions = {}
  ): Promise<Job<MaintenanceJobData> | null> {
    try {
      const defaultOptions: JobOptions = {
        attempts: 1,
        removeOnComplete: 3,
        removeOnFail: 2,
        timeout: 60 * 60 * 1000, // 1 hour
        ...options,
      };

      return await this.maintenanceQueue.add('maintenance-task', data, defaultOptions);
    } catch (error) {
      logger.error('Failed to queue maintenance task:', error);
      return null;
    }
  }

  /**
   * Process metrics calculation job
   */
  private async processMetricsCalculationJob(job: Job<MetricsCalculationJobData>): Promise<any> {
    const startTime = performance.now();
    const { type, timeRange, workspaceId, tenantId, options } = job.data;

    try {
      await job.progress(10);

      let result: any;

      switch (type) {
        case 'system':
          result = await this.systemAnalytics.getSystemMetrics();
          break;
        case 'user':
          result = await this.systemAnalytics.getUserAnalytics({
            startDate: timeRange.start,
            endDate: timeRange.end,
          });
          break;
        case 'subscription':
          result = await this.systemAnalytics.getSubscriptionAnalytics({
            startDate: timeRange.start,
            endDate: timeRange.end,
          });
          break;
        case 'security':
          result = await this.securityMonitoring.calculateSecurityMetrics(timeRange);
          break;
        case 'api':
          result = { totalRequests: 0, totalErrors: 0 }; // Mock API metrics
          break;
        default:
          throw new Error(`Unknown metrics type: ${type}`);
      }

      await job.progress(80);

      // Invalidate related caches
      await this.cacheInvalidation.invalidateSystemCaches();

      await job.progress(100);

      const executionTime = performance.now() - startTime;
      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Metrics calculation job failed for type ${type}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Process notification job
   */
  private async processNotificationJob(job: Job<NotificationJobData>): Promise<any> {
    const startTime = performance.now();
    const { type, recipients, template, data, priority } = job.data;

    try {
      await job.progress(20);

      let result: any;

      switch (type) {
        case 'email':
          result = await this.notificationService.sendBulkEmail(recipients, template, data);
          break;
        case 'sms':
          result = await this.notificationService.sendBulkSMS(recipients, template, data);
          break;
        case 'webhook':
          result = await this.notificationService.sendWebhookNotifications(recipients, data);
          break;
        case 'push':
          result = await this.notificationService.sendPushNotifications(recipients, template, data);
          break;
        default:
          throw new Error(`Unknown notification type: ${type}`);
      }

      await job.progress(100);

      const executionTime = performance.now() - startTime;
      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Notification job failed for type ${type}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Process data export job
   */
  private async processDataExportJob(job: Job<DataExportJobData>): Promise<any> {
    const startTime = performance.now();
    const { exportType, format, filters, requestedBy, email, workspaceId, options } = job.data;

    try {
      await job.progress(10);

      // Generate export data based on type
      let exportData: any;
      let fileName: string;

      switch (exportType) {
        case 'users':
          exportData = []; // Mock user export data
          fileName = `users-export-${new Date().toISOString().split('T')[0]}.${format}`;
          break;
        case 'analytics':
          exportData = await this.systemAnalytics.getUserAnalytics({
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(),
          });
          fileName = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`;
          break;
        case 'audit_logs':
          exportData = await this.securityMonitoring.exportAuditLogs(filters, options?.dateRange);
          fileName = `audit-logs-export-${new Date().toISOString().split('T')[0]}.${format}`;
          break;
        case 'system_metrics':
          exportData = await this.systemAnalytics.getSystemMetrics();
          fileName = `system-metrics-export-${new Date().toISOString().split('T')[0]}.${format}`;
          break;
        default:
          throw new Error(`Unknown export type: ${exportType}`);
      }

      await job.progress(60);

      // Use the base job service to handle file generation and email
      const exportJob = await this.baseJobService.queueExportJob({
        reportType: exportType,
        workplaceId: workspaceId || 'system',
        userId: requestedBy,
        userEmail: email,
        filters,
        format: format as 'pdf' | 'excel' | 'csv',
        fileName,
        options: {
          includeRawData: options?.includeMetadata,
        },
      });

      await job.progress(100);

      const executionTime = performance.now() - startTime;
      return {
        success: true,
        exportJobId: exportJob?.id,
        fileName,
        recordCount: Array.isArray(exportData) ? exportData.length : 0,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Data export job failed for type ${exportType}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Process data import job
   */
  private async processDataImportJob(job: Job<DataImportJobData>): Promise<any> {
    const startTime = performance.now();
    const { importType, filePath, format, requestedBy, workspaceId, options } = job.data;

    try {
      await job.progress(10);

      let result: any;

      switch (importType) {
        case 'users':
          result = { success: true, imported: 0, errors: [] }; // Mock import result
          break;
        case 'tenants':
          result = { success: true, imported: 0, errors: [] }; // Mock import result
          break;
        case 'settings':
          result = { success: true, imported: 0, errors: [] }; // Mock import result
          break;
        default:
          throw new Error(`Unknown import type: ${importType}`);
      }

      await job.progress(80);

      // Invalidate related caches after successful import
      if (!options?.validateOnly && result.success) {
        await this.cacheInvalidation.invalidateSystemCaches();
        if (importType === 'users') {
          await this.cacheInvalidation.invalidateUserCaches('*');
        }
      }

      await job.progress(100);

      const executionTime = performance.now() - startTime;
      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Data import job failed for type ${importType}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Process maintenance job
   */
  private async processMaintenanceJob(job: Job<MaintenanceJobData>): Promise<any> {
    const startTime = performance.now();
    const { task, options } = job.data;

    try {
      await job.progress(10);

      let result: any;

      switch (task) {
        case 'cleanup_sessions':
          result = await this.securityMonitoring.cleanupExpiredSessions();
          break;
        case 'archive_logs':
          result = await this.securityMonitoring.archiveOldAuditLogs(options?.retentionDays || 365);
          break;
        case 'optimize_indexes':
          result = await this.dbOptimization.analyzeIndexUsage();
          break;
        case 'cache_warming':
          result = await this.cacheService.ping(); // Simple health check for cache warming
          break;
        case 'health_check':
          result = await this.performSystemHealthCheck();
          break;
        default:
          throw new Error(`Unknown maintenance task: ${task}`);
      }

      await job.progress(100);

      const executionTime = performance.now() - startTime;
      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Maintenance job failed for task ${task}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Perform system health check
   */
  private async performSystemHealthCheck(): Promise<any> {
    const healthChecks = await Promise.allSettled([
      this.cacheService.healthCheck(),
      this.dbOptimization.getPerformanceStats(),
      this.systemAnalytics.getSystemHealth(),
    ]);

    return {
      cache: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : false,
      database: healthChecks[1].status === 'fulfilled',
      analytics: healthChecks[2].status === 'fulfilled',
      timestamp: new Date(),
    };
  }

  /**
   * Get comprehensive queue statistics
   */
  async getAllQueueStats(): Promise<any> {
    try {
      const [baseStats, metricsStats, notificationStats, exportStats, importStats, maintenanceStats] = await Promise.all([
        this.baseJobService.getQueueStats(),
        this.getQueueStatistics(this.metricsQueue),
        this.getQueueStatistics(this.notificationQueue),
        this.getQueueStatistics(this.dataExportQueue),
        this.getQueueStatistics(this.dataImportQueue),
        this.getQueueStatistics(this.maintenanceQueue),
      ]);

      return {
        base: baseStats,
        metrics: metricsStats,
        notifications: notificationStats,
        dataExport: exportStats,
        dataImport: importStats,
        maintenance: maintenanceStats,
      };
    } catch (error) {
      logger.error('Error getting all queue stats:', error);
      return {};
    }
  }

  /**
   * Get statistics for a specific queue
   */
  private async getQueueStatistics(queue: Queue): Promise<any> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    } catch (error) {
      logger.error('Error getting queue statistics:', error);
      return {};
    }
  }

  /**
   * Create mock security service for testing/fallback
   */
  private createMockSecurityService(): SecurityMonitoringServiceInterface {
    return {
      calculateSecurityMetrics: async () => ({ alerts: 0, threats: 0 }),
      exportAuditLogs: async () => ({ logs: [], count: 0 }),
      cleanupExpiredSessions: async () => ({ deletedCount: 0 }),
      archiveOldAuditLogs: async () => ({ archivedCount: 0 }),
    };
  }

  /**
   * Create mock notification service for testing/fallback
   */
  private createMockNotificationService(): NotificationServiceInterface {
    return {
      sendBulkEmail: async () => ({ sent: 0, failed: 0 }),
      sendBulkSMS: async () => ({ sent: 0, failed: 0 }),
      sendWebhookNotifications: async () => ({ sent: 0, failed: 0 }),
      sendPushNotifications: async () => ({ sent: 0, failed: 0 }),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down SaaS background job service...');

    await Promise.all([
      this.metricsQueue.close(),
      this.notificationQueue.close(),
      this.dataExportQueue.close(),
      this.dataImportQueue.close(),
      this.maintenanceQueue.close(),
    ]);

    logger.info('SaaS background job service shut down successfully');
  }
}

// Export class instead of instance to prevent auto-initialization
// This avoids creating Bull queues at module load time
export default SaaSBackgroundJobService;