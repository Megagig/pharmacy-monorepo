import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';
import PerformanceCacheService from './PerformanceCacheService';
import PerformanceDatabaseOptimizer from './PerformanceDatabaseOptimizer';

export interface AIAnalysisJobData {
  type: 'drug-interaction' | 'clinical-decision-support' | 'medication-review' | 'patient-risk-assessment';
  patientId: string;
  workspaceId: string;
  userId: string;
  parameters: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface DataExportJobData {
  type: 'patient-data' | 'clinical-notes' | 'medication-history' | 'audit-logs';
  workspaceId: string;
  userId: string;
  userEmail: string;
  filters: Record<string, any>;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  fileName: string;
  includeAttachments?: boolean;
}

export interface CacheWarmupJobData {
  type: 'dashboard' | 'patient-lists' | 'clinical-notes' | 'medications' | 'reports';
  workspaceId: string;
  targetUsers?: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface DatabaseMaintenanceJobData {
  type: 'index-optimization' | 'cleanup-expired-data' | 'performance-analysis' | 'backup-verification';
  workspaceId?: string;
  parameters: Record<string, any>;
}

export interface JobResult {
  success: boolean;
  data?: any;
  executionTime: number;
  error?: string;
  metrics?: Record<string, any>;
}

/**
 * Performance-focused background job service using BullMQ
 * Handles AI analysis, data exports, cache warming, and database maintenance
 */
export class PerformanceJobService {
  private static instance: PerformanceJobService;
  
  // Queues
  private aiAnalysisQueue: Queue<AIAnalysisJobData>;
  private dataExportQueue: Queue<DataExportJobData>;
  private cacheWarmupQueue: Queue<CacheWarmupJobData>;
  private databaseMaintenanceQueue: Queue<DatabaseMaintenanceJobData>;
  
  // Workers
  private aiAnalysisWorker: Worker<AIAnalysisJobData>;
  private dataExportWorker: Worker<DataExportJobData>;
  private cacheWarmupWorker: Worker<CacheWarmupJobData>;
  private databaseMaintenanceWorker: Worker<DatabaseMaintenanceJobData>;
  
  // Queue Events
  private queueEvents: Map<string, QueueEvents> = new Map();

  private constructor() {
    // Check if performance jobs are disabled
    if (process.env.DISABLE_PERFORMANCE_JOBS === 'true') {
      logger.info('Performance job service is disabled via environment variable');
      return;
    }

    this.initializeQueues();
    this.initializeWorkers();
    this.setupEventHandlers();
    this.scheduleRecurringJobs();
  }

  public static getInstance(): PerformanceJobService {
    if (!PerformanceJobService.instance) {
      PerformanceJobService.instance = new PerformanceJobService();
    }
    return PerformanceJobService.instance;
  }

  /**
   * Initialize BullMQ queues
   */
  private initializeQueues(): void {
    try {
      const connection = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_JOB_DB || '2'), // Use different DB for performance jobs
      };

    // Initialize queues with different priorities and settings
    this.aiAnalysisQueue = new Queue('ai-analysis', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.dataExportQueue = new Queue('data-export', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    });

    this.cacheWarmupQueue = new Queue('cache-warmup', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 3000,
        },
      },
    });

    this.databaseMaintenanceQueue = new Queue('database-maintenance', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 30,
        removeOnFail: 10,
        attempts: 1, // Database operations should not retry automatically
      },
    });

      // Initialize queue events for monitoring
      ['ai-analysis', 'data-export', 'cache-warmup', 'database-maintenance'].forEach(queueName => {
        this.queueEvents.set(queueName, new QueueEvents(queueName, { connection }));
      });
      
      logger.info('Performance job queues initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize performance job queues:', error);
      logger.warn('Performance job service will be disabled. Install and start Redis to enable job processing.');
    }
  }

  /**
   * Initialize BullMQ workers
   */
  private initializeWorkers(): void {
    try {
      const connection = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_JOB_DB || '2'),
      };

    // AI Analysis Worker (CPU intensive, limited concurrency)
    this.aiAnalysisWorker = new Worker<AIAnalysisJobData>(
      'ai-analysis',
      async (job: Job<AIAnalysisJobData>) => this.processAIAnalysisJob(job),
      {
        connection,
        concurrency: 2, // Limit concurrent AI analysis jobs
      }
    );

    // Data Export Worker (I/O intensive, moderate concurrency)
    this.dataExportWorker = new Worker<DataExportJobData>(
      'data-export',
      async (job: Job<DataExportJobData>) => this.processDataExportJob(job),
      {
        connection,
        concurrency: 3,
      }
    );

    // Cache Warmup Worker (Network intensive, higher concurrency)
    this.cacheWarmupWorker = new Worker<CacheWarmupJobData>(
      'cache-warmup',
      async (job: Job<CacheWarmupJobData>) => this.processCacheWarmupJob(job),
      {
        connection,
        concurrency: 5,
      }
    );

    // Database Maintenance Worker (Critical operations, single concurrency)
      this.databaseMaintenanceWorker = new Worker<DatabaseMaintenanceJobData>(
        'database-maintenance',
        async (job: Job<DatabaseMaintenanceJobData>) => this.processDatabaseMaintenanceJob(job),
        {
          connection,
          concurrency: 1, // Only one database maintenance job at a time
        }
      );
      
      logger.info('Performance job workers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize performance job workers:', error);
      logger.warn('Performance job workers will be disabled. Install and start Redis to enable job processing.');
    }
  }

  /**
   * Queue AI analysis job
   */
  async queueAIAnalysis(data: AIAnalysisJobData): Promise<Job<AIAnalysisJobData> | null> {
    try {
      if (!this.aiAnalysisQueue) {
        logger.warn('AI analysis queue not available - Redis connection failed');
        return null;
      }

      const priority = this.getPriority(data.priority);
      
      logger.info(`Queuing AI analysis job: ${data.type}`, {
        patientId: data.patientId,
        workspaceId: data.workspaceId,
        priority: data.priority,
      });

      return this.aiAnalysisQueue.add('ai-analysis', data, {
        priority,
        delay: data.priority === 'urgent' ? 0 : 1000, // Urgent jobs start immediately
      });
    } catch (error) {
      logger.error('Failed to queue AI analysis job:', error);
      return null;
    }
  }

  /**
   * Queue data export job
   */
  async queueDataExport(data: DataExportJobData): Promise<Job<DataExportJobData>> {
    logger.info(`Queuing data export job: ${data.type}`, {
      workspaceId: data.workspaceId,
      userId: data.userId,
      format: data.format,
    });

    return this.dataExportQueue.add('data-export', data, {
      priority: 10, // Medium priority for exports
    });
  }

  /**
   * Queue cache warmup job
   */
  async queueCacheWarmup(data: CacheWarmupJobData): Promise<Job<CacheWarmupJobData>> {
    const priority = this.getPriority(data.priority);
    
    logger.info(`Queuing cache warmup job: ${data.type}`, {
      workspaceId: data.workspaceId,
      targetUsers: data.targetUsers?.length || 'all',
      priority: data.priority,
    });

    return this.cacheWarmupQueue.add('cache-warmup', data, {
      priority,
    });
  }

  /**
   * Queue database maintenance job
   */
  async queueDatabaseMaintenance(data: DatabaseMaintenanceJobData): Promise<Job<DatabaseMaintenanceJobData>> {
    logger.info(`Queuing database maintenance job: ${data.type}`, {
      workspaceId: data.workspaceId,
      parameters: Object.keys(data.parameters),
    });

    return this.databaseMaintenanceQueue.add('database-maintenance', data, {
      priority: 1, // High priority for maintenance
    });
  }

  /**
   * Process AI analysis job
   */
  private async processAIAnalysisJob(job: Job<AIAnalysisJobData>): Promise<JobResult> {
    const startTime = performance.now();
    const { type, patientId, workspaceId, userId, parameters } = job.data;

    try {
      await job.updateProgress(10);

      let result: any;
      
      switch (type) {
        case 'drug-interaction':
          result = await this.performDrugInteractionAnalysis(patientId, parameters);
          break;
        case 'clinical-decision-support':
          result = await this.performClinicalDecisionSupport(patientId, parameters);
          break;
        case 'medication-review':
          result = await this.performMedicationReview(patientId, parameters);
          break;
        case 'patient-risk-assessment':
          result = await this.performPatientRiskAssessment(patientId, parameters);
          break;
        default:
          throw new Error(`Unknown AI analysis type: ${type}`);
      }

      await job.updateProgress(100);

      const executionTime = performance.now() - startTime;

      logger.info(`AI analysis job completed: ${type}`, {
        patientId,
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      return {
        success: true,
        data: result,
        executionTime,
        metrics: {
          analysisType: type,
          patientId,
          workspaceId,
          userId,
        },
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`AI analysis job failed: ${type}`, error);

      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process data export job
   */
  private async processDataExportJob(job: Job<DataExportJobData>): Promise<JobResult> {
    const startTime = performance.now();
    const { type, workspaceId, userId, userEmail, filters, format, fileName } = job.data;

    try {
      await job.updateProgress(10);

      // Fetch data based on type
      const data = await this.fetchExportData(type, workspaceId, filters);
      await job.updateProgress(50);

      // Generate file
      const filePath = await this.generateExportFile(data, format, fileName);
      await job.updateProgress(80);

      // Send notification
      await this.sendExportNotification(userEmail, fileName, filePath, format);
      await job.updateProgress(100);

      const executionTime = performance.now() - startTime;

      logger.info(`Data export job completed: ${type}`, {
        workspaceId,
        format,
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      return {
        success: true,
        data: { filePath, recordCount: data.length },
        executionTime,
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Data export job failed: ${type}`, error);

      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process cache warmup job
   */
  private async processCacheWarmupJob(job: Job<CacheWarmupJobData>): Promise<JobResult> {
    const startTime = performance.now();
    const { type, workspaceId, targetUsers } = job.data;

    try {
      await job.updateProgress(10);

      const cacheService = PerformanceCacheService.getInstance();
      let warmedCount = 0;

      switch (type) {
        case 'dashboard':
          warmedCount = await this.warmDashboardCache(workspaceId, targetUsers);
          break;
        case 'patient-lists':
          warmedCount = await this.warmPatientListsCache(workspaceId, targetUsers);
          break;
        case 'clinical-notes':
          warmedCount = await this.warmClinicalNotesCache(workspaceId, targetUsers);
          break;
        case 'medications':
          warmedCount = await this.warmMedicationsCache(workspaceId, targetUsers);
          break;
        case 'reports':
          warmedCount = await this.warmReportsCache(workspaceId, targetUsers);
          break;
        default:
          throw new Error(`Unknown cache warmup type: ${type}`);
      }

      await job.updateProgress(100);

      const executionTime = performance.now() - startTime;

      logger.info(`Cache warmup job completed: ${type}`, {
        workspaceId,
        warmedCount,
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      return {
        success: true,
        data: { warmedCount },
        executionTime,
        metrics: {
          cacheType: type,
          workspaceId,
          warmedCount,
        },
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Cache warmup job failed: ${type}`, error);

      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process database maintenance job
   */
  private async processDatabaseMaintenanceJob(job: Job<DatabaseMaintenanceJobData>): Promise<JobResult> {
    const startTime = performance.now();
    const { type, workspaceId, parameters } = job.data;

    try {
      await job.updateProgress(10);

      const optimizer = PerformanceDatabaseOptimizer.getInstance();
      let result: any;

      switch (type) {
        case 'index-optimization':
          result = await optimizer.createAllOptimizedIndexes();
          break;
        case 'cleanup-expired-data':
          result = await this.cleanupExpiredData(workspaceId, parameters);
          break;
        case 'performance-analysis':
          result = await optimizer.analyzeExistingIndexes();
          break;
        case 'backup-verification':
          result = await this.verifyBackupIntegrity(parameters);
          break;
        default:
          throw new Error(`Unknown database maintenance type: ${type}`);
      }

      await job.updateProgress(100);

      const executionTime = performance.now() - startTime;

      logger.info(`Database maintenance job completed: ${type}`, {
        workspaceId,
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      return {
        success: true,
        data: result,
        executionTime,
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error(`Database maintenance job failed: ${type}`, error);

      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // AI Analysis Queue Events
    this.queueEvents.get('ai-analysis')?.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`AI analysis job ${jobId} completed`, returnvalue);
    });

    this.queueEvents.get('ai-analysis')?.on('failed', ({ jobId, failedReason }) => {
      logger.error(`AI analysis job ${jobId} failed: ${failedReason}`);
    });

    // Data Export Queue Events
    this.queueEvents.get('data-export')?.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Data export job ${jobId} completed`, returnvalue);
    });

    this.queueEvents.get('data-export')?.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Data export job ${jobId} failed: ${failedReason}`);
    });

    // Cache Warmup Queue Events
    this.queueEvents.get('cache-warmup')?.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Cache warmup job ${jobId} completed`, returnvalue);
    });

    // Database Maintenance Queue Events
    this.queueEvents.get('database-maintenance')?.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Database maintenance job ${jobId} completed`, returnvalue);
    });

    this.queueEvents.get('database-maintenance')?.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Database maintenance job ${jobId} failed: ${failedReason}`);
    });
  }

  /**
   * Schedule recurring jobs
   */
  private scheduleRecurringJobs(): void {
    // Schedule daily cache warmup for popular data
    this.cacheWarmupQueue.add(
      'daily-cache-warmup',
      {
        type: 'dashboard',
        workspaceId: 'all',
        priority: 'low',
      },
      {
        repeat: { pattern: '0 6 * * *' }, // 6 AM daily
        jobId: 'daily-cache-warmup',
      }
    );

    // Schedule weekly database maintenance
    this.databaseMaintenanceQueue.add(
      'weekly-performance-analysis',
      {
        type: 'performance-analysis',
        parameters: { fullAnalysis: true },
      },
      {
        repeat: { pattern: '0 2 * * 0' }, // 2 AM every Sunday
        jobId: 'weekly-performance-analysis',
      }
    );

    // Schedule monthly index optimization
    this.databaseMaintenanceQueue.add(
      'monthly-index-optimization',
      {
        type: 'index-optimization',
        parameters: { createNew: true, analyzeUsage: true },
      },
      {
        repeat: { pattern: '0 3 1 * *' }, // 3 AM on the 1st of each month
        jobId: 'monthly-index-optimization',
      }
    );
  }

  /**
   * Get job statistics for all queues
   */
  async getJobStatistics(): Promise<Record<string, any>> {
    const queues = {
      'ai-analysis': this.aiAnalysisQueue,
      'data-export': this.dataExportQueue,
      'cache-warmup': this.cacheWarmupQueue,
      'database-maintenance': this.databaseMaintenanceQueue,
    };

    const stats: Record<string, any> = {};

    for (const [name, queue] of Object.entries(queues)) {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
        ]);

        stats[name] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          total: waiting.length + active.length + completed.length + failed.length,
        };
      } catch (error) {
        logger.error(`Error getting stats for queue ${name}:`, error);
        stats[name] = { error: 'Failed to get statistics' };
      }
    }

    return stats;
  }

  /**
   * Helper methods for job processing
   */
  private getPriority(priority: string): number {
    switch (priority) {
      case 'urgent': return 1;
      case 'high': return 5;
      case 'medium': return 10;
      case 'low': return 20;
      default: return 10;
    }
  }

  // Placeholder implementations for AI analysis methods
  private async performDrugInteractionAnalysis(patientId: string, parameters: any): Promise<any> {
    // Implement drug interaction analysis logic
    return { interactions: [], riskLevel: 'low', recommendations: [] };
  }

  private async performClinicalDecisionSupport(patientId: string, parameters: any): Promise<any> {
    // Implement clinical decision support logic
    return { recommendations: [], alerts: [], confidence: 0.85 };
  }

  private async performMedicationReview(patientId: string, parameters: any): Promise<any> {
    // Implement medication review logic
    return { issues: [], optimizations: [], adherenceScore: 0.9 };
  }

  private async performPatientRiskAssessment(patientId: string, parameters: any): Promise<any> {
    // Implement patient risk assessment logic
    return { riskScore: 0.3, factors: [], recommendations: [] };
  }

  // Placeholder implementations for export methods
  private async fetchExportData(type: string, workspaceId: string, filters: any): Promise<any[]> {
    // Implement data fetching logic based on type
    return [];
  }

  private async generateExportFile(data: any[], format: string, fileName: string): Promise<string> {
    // Implement file generation logic
    return `/exports/${fileName}`;
  }

  private async sendExportNotification(email: string, fileName: string, filePath: string, format: string): Promise<void> {
    // Implement email notification logic
  }

  // Placeholder implementations for cache warmup methods
  private async warmDashboardCache(workspaceId: string, targetUsers?: string[]): Promise<number> {
    // Implement dashboard cache warming
    return 0;
  }

  private async warmPatientListsCache(workspaceId: string, targetUsers?: string[]): Promise<number> {
    // Implement patient lists cache warming
    return 0;
  }

  private async warmClinicalNotesCache(workspaceId: string, targetUsers?: string[]): Promise<number> {
    // Implement clinical notes cache warming
    return 0;
  }

  private async warmMedicationsCache(workspaceId: string, targetUsers?: string[]): Promise<number> {
    // Implement medications cache warming
    return 0;
  }

  private async warmReportsCache(workspaceId: string, targetUsers?: string[]): Promise<number> {
    // Implement reports cache warming
    return 0;
  }

  // Placeholder implementations for database maintenance methods
  private async cleanupExpiredData(workspaceId: string | undefined, parameters: any): Promise<any> {
    // Implement expired data cleanup
    return { deletedRecords: 0, freedSpace: 0 };
  }

  private async verifyBackupIntegrity(parameters: any): Promise<any> {
    // Implement backup verification
    return { verified: true, issues: [] };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down performance job service...');

    // Close workers
    await Promise.all([
      this.aiAnalysisWorker.close(),
      this.dataExportWorker.close(),
      this.cacheWarmupWorker.close(),
      this.databaseMaintenanceWorker.close(),
    ]);

    // Close queues
    await Promise.all([
      this.aiAnalysisQueue.close(),
      this.dataExportQueue.close(),
      this.cacheWarmupQueue.close(),
      this.databaseMaintenanceQueue.close(),
    ]);

    // Close queue events
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }

    logger.info('Performance job service shut down successfully');
  }
}

export default PerformanceJobService;