// Background Job Processing Service for Large Exports and Reports
import Bull, { Queue, Job, JobOptions } from 'bull';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';
import { sendTemplatedEmail } from '../utils/emailHelpers';
import { generatePDFReport, generateExcelReport, generateCSVReport } from '../utils/exportHelpers';
import * as path from 'path';

interface ExportJobData {
    reportType: string;
    workplaceId: string;
    userId: string;
    userEmail: string;
    filters: any;
    format: 'pdf' | 'excel' | 'csv';
    fileName: string;
    options?: {
        includeCharts?: boolean;
        includeRawData?: boolean;
        customTemplate?: string;
    };
}

interface ReportGenerationJobData {
    reportType: string;
    workplaceId: string;
    scheduleId: string;
    recipients: string[];
    filters: any;
    format: string[];
    templateId?: string;
}

interface JobResult {
    success: boolean;
    filePath?: string;
    fileSize?: number;
    executionTime: number;
    error?: string;
}

/**
 * Background job processing service for heavy operations
 */
export class BackgroundJobService {
    private static instance: BackgroundJobService;
    private exportQueue: Queue<ExportJobData>;
    private reportQueue: Queue<ReportGenerationJobData>;
    private cleanupQueue: Queue;

    constructor() {
        try {
            // Parse Redis URL for Bull configuration
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            const parsedUrl = new URL(redisUrl);
            
            const redisConfig = {
                host: parsedUrl.hostname,
                port: parseInt(parsedUrl.port || '6379'),
                password: parsedUrl.password || process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_JOB_DB || '1'), // Use different DB for jobs
            };

            // Initialize queues with error handling
            this.exportQueue = new Bull('report-exports', { redis: redisConfig });
            this.reportQueue = new Bull('scheduled-reports', { redis: redisConfig });
            this.cleanupQueue = new Bull('cleanup-jobs', { redis: redisConfig });

            this.setupJobProcessors();
            this.setupEventHandlers();
            this.scheduleCleanupJobs();

            logger.info('✅ Background job service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize background job service:', error);
            logger.warn('⚠️ Background job service will be disabled. Install and start Redis to enable job processing.');
        }
    }

    static getInstance(): BackgroundJobService {
        if (!BackgroundJobService.instance) {
            BackgroundJobService.instance = new BackgroundJobService();
        }
        return BackgroundJobService.instance;
    }

    /**
     * Queue export job
     */
    async queueExportJob(
        data: ExportJobData,
        options: JobOptions = {}
    ): Promise<Job<ExportJobData> | null> {
        try {
            if (!this.exportQueue) {
                logger.warn('Export queue not available - Redis connection failed');
                return null;
            }

            const defaultOptions: JobOptions = {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: 10, // Keep last 10 completed jobs
                removeOnFail: 5, // Keep last 5 failed jobs
                timeout: 10 * 60 * 1000, // 10 minutes timeout
                ...options,
            };

            logger.info(`Queuing export job for ${data.reportType}`, {
                workplaceId: data.workplaceId,
                userId: data.userId,
                format: data.format,
            });

            return this.exportQueue.add('export-report', data, defaultOptions);
        } catch (error) {
            logger.error('Failed to queue export job:', error);
            return null;
        }
    }

    /**
     * Queue scheduled report generation
     */
    async queueScheduledReport(
        data: ReportGenerationJobData,
        options: JobOptions = {}
    ): Promise<Job<ReportGenerationJobData> | null> {
        try {
            if (!this.reportQueue) {
                logger.warn('Report queue not available - Redis connection failed');
                return null;
            }

            const defaultOptions: JobOptions = {
                attempts: 2,
                backoff: {
                    type: 'fixed',
                    delay: 5000,
                },
                removeOnComplete: 20,
                removeOnFail: 10,
                timeout: 15 * 60 * 1000, // 15 minutes timeout
                ...options,
            };

            logger.info(`Queuing scheduled report for ${data.reportType}`, {
                workplaceId: data.workplaceId,
                scheduleId: data.scheduleId,
                recipients: data.recipients.length,
            });

            return this.reportQueue.add('generate-scheduled-report', data, defaultOptions);
        } catch (error) {
            logger.error('Failed to queue scheduled report:', error);
            return null;
        }
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId: string, queueType: 'export' | 'report'): Promise<any> {
        try {
            const queue = queueType === 'export' ? this.exportQueue : this.reportQueue;
            const job = await queue.getJob(jobId);

            if (!job) {
                return { status: 'not_found' };
            }

            const state = await job.getState();
            const progress = job.progress();

            return {
                id: job.id,
                status: state,
                progress,
                data: job.data,
                result: job.returnvalue,
                failedReason: job.failedReason,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                createdAt: new Date(job.timestamp),
            };
        } catch (error) {
            logger.error('Error getting job status:', error);
            return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Cancel job
     */
    async cancelJob(jobId: string, queueType: 'export' | 'report'): Promise<boolean> {
        try {
            const queue = queueType === 'export' ? this.exportQueue : this.reportQueue;
            const job = await queue.getJob(jobId);

            if (job) {
                await job.remove();
                logger.info(`Job ${jobId} cancelled successfully`);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error cancelling job:', error);
            return false;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(): Promise<{
        export: any;
        report: any;
        cleanup: any;
    }> {
        try {
            const [exportStats, reportStats, cleanupStats] = await Promise.all([
                this.getQueueStatistics(this.exportQueue),
                this.getQueueStatistics(this.reportQueue),
                this.getQueueStatistics(this.cleanupQueue),
            ]);

            return {
                export: exportStats,
                report: reportStats,
                cleanup: cleanupStats,
            };
        } catch (error) {
            logger.error('Error getting queue stats:', error);
            return {
                export: {},
                report: {},
                cleanup: {},
            };
        }
    }

    /**
     * Setup job processors
     */
    private setupJobProcessors(): void {
        // Export job processor
        this.exportQueue.process('export-report', 5, async (job: Job<ExportJobData>) => {
            return this.processExportJob(job);
        });

        // Scheduled report processor
        this.reportQueue.process('generate-scheduled-report', 3, async (job: Job<ReportGenerationJobData>) => {
            return this.processScheduledReportJob(job);
        });

        // Cleanup processor
        this.cleanupQueue.process('cleanup-old-files', async (job: Job) => {
            return this.processCleanupJob(job);
        });
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        // Export queue events
        this.exportQueue.on('completed', (job: Job<ExportJobData>, result: JobResult) => {
            logger.info(`Export job ${job.id} completed`, {
                reportType: job.data.reportType,
                executionTime: result.executionTime,
                fileSize: result.fileSize,
            });
        });

        this.exportQueue.on('failed', (job: Job<ExportJobData>, err: Error) => {
            logger.error(`Export job ${job.id} failed`, {
                reportType: job.data.reportType,
                error: err.message,
                attempts: job.attemptsMade,
            });
        });

        this.exportQueue.on('stalled', (job: Job<ExportJobData>) => {
            logger.warn(`Export job ${job.id} stalled`, {
                reportType: job.data.reportType,
            });
        });

        // Report queue events
        this.reportQueue.on('completed', (job: Job<ReportGenerationJobData>, result: JobResult) => {
            logger.info(`Scheduled report job ${job.id} completed`, {
                reportType: job.data.reportType,
                scheduleId: job.data.scheduleId,
                executionTime: result.executionTime,
            });
        });

        this.reportQueue.on('failed', (job: Job<ReportGenerationJobData>, err: Error) => {
            logger.error(`Scheduled report job ${job.id} failed`, {
                reportType: job.data.reportType,
                scheduleId: job.data.scheduleId,
                error: err.message,
            });
        });
    }

    /**
     * Process export job
     */
    private async processExportJob(job: Job<ExportJobData>): Promise<JobResult> {
        const startTime = performance.now();
        const { reportType, workplaceId, userId, userEmail, filters, format, fileName, options } = job.data;

        try {
            // Update progress
            await job.progress(10);

            // Generate report data (this would call your existing report generation logic)
            const reportData = await this.generateReportData(reportType, workplaceId, filters);
            await job.progress(50);

            // Generate file based on format
            let filePath: string;
            let fileSize: number;

            switch (format) {
                case 'pdf':
                    filePath = await generatePDFReport(reportData, fileName, options);
                    break;
                case 'excel':
                    filePath = await generateExcelReport(reportData, fileName, options);
                    break;
                case 'csv':
                    filePath = await generateCSVReport(reportData, fileName, options);
                    break;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            await job.progress(80);

            // Get file size
            const fs = await import('fs');
            const stats = await fs.promises.stat(filePath);
            fileSize = stats.size;

            // Send email notification
            await this.sendExportNotification(userEmail, fileName, filePath, format);
            await job.progress(100);

            const executionTime = performance.now() - startTime;

            return {
                success: true,
                filePath,
                fileSize,
                executionTime,
            };
        } catch (error) {
            const executionTime = performance.now() - startTime;
            logger.error('Export job processing failed:', error);

            // Send failure notification
            await this.sendExportFailureNotification(userEmail, fileName, error instanceof Error ? error.message : 'Unknown error');

            return {
                success: false,
                executionTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Process scheduled report job
     */
    private async processScheduledReportJob(job: Job<ReportGenerationJobData>): Promise<JobResult> {
        const startTime = performance.now();
        const { reportType, workplaceId, scheduleId, recipients, filters, format, templateId } = job.data;

        try {
            await job.progress(10);

            // Generate report data
            const reportData = await this.generateReportData(reportType, workplaceId, filters);
            await job.progress(40);

            // Generate files for each requested format
            const generatedFiles: Array<{ format: string; filePath: string }> = [];

            for (const fmt of format) {
                const fileName = `${reportType}-${new Date().toISOString().split('T')[0]}.${fmt}`;
                let filePath: string;

                switch (fmt) {
                    case 'pdf':
                        filePath = await generatePDFReport(reportData, fileName, { templateId });
                        break;
                    case 'excel':
                        filePath = await generateExcelReport(reportData, fileName, { templateId });
                        break;
                    case 'csv':
                        filePath = await generateCSVReport(reportData, fileName, { templateId });
                        break;
                    default:
                        continue;
                }

                generatedFiles.push({ format: fmt, filePath });
            }

            await job.progress(80);

            // Send reports to recipients
            await this.sendScheduledReportNotification(recipients, reportType, generatedFiles);
            await job.progress(100);

            const executionTime = performance.now() - startTime;

            return {
                success: true,
                executionTime,
            };
        } catch (error) {
            const executionTime = performance.now() - startTime;
            logger.error('Scheduled report job processing failed:', error);

            // Send failure notification
            await this.sendScheduledReportFailureNotification(recipients, reportType, error instanceof Error ? error.message : 'Unknown error');

            return {
                success: false,
                executionTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Process cleanup job
     */
    private async processCleanupJob(job: Job): Promise<JobResult> {
        const startTime = performance.now();

        try {
            const fs = await import('fs');
            const path = await import('path');

            const exportsDir = path.join(process.cwd(), 'exports');
            const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

            let deletedCount = 0;
            let totalSize = 0;

            if (await fs.promises.access(exportsDir).then(() => true).catch(() => false)) {
                const files = await fs.promises.readdir(exportsDir);

                for (const file of files) {
                    const filePath = path.join(exportsDir, file);
                    const stats = await fs.promises.stat(filePath);

                    if (stats.mtime < cutoffDate) {
                        totalSize += stats.size;
                        await fs.promises.unlink(filePath);
                        deletedCount++;
                    }
                }
            }

            const executionTime = performance.now() - startTime;

            logger.info(`Cleanup job completed: deleted ${deletedCount} files (${totalSize} bytes)`);

            return {
                success: true,
                executionTime,
            };
        } catch (error) {
            const executionTime = performance.now() - startTime;
            logger.error('Cleanup job processing failed:', error);

            return {
                success: false,
                executionTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Schedule cleanup jobs
     */
    private scheduleCleanupJobs(): void {
        // Schedule daily cleanup at 2 AM
        this.cleanupQueue.add(
            'cleanup-old-files',
            {},
            {
                repeat: { cron: '0 2 * * *' },
                removeOnComplete: 5,
                removeOnFail: 2,
            }
        );
    }

    /**
     * Get queue statistics
     */
    private async getQueueStatistics(queue: Queue): Promise<any> {
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
    }

    // Helper methods (these would integrate with your existing services)

    private async generateReportData(reportType: string, workplaceId: string, filters: any): Promise<any> {
        // This would call your existing report generation logic
        // For now, return a placeholder
        return {
            reportType,
            workplaceId,
            filters,
            data: [],
            generatedAt: new Date(),
        };
    }

    private async sendExportNotification(email: string, fileName: string, filePath: string, format: string): Promise<void> {
        try {
            await sendTemplatedEmail({
                to: email,
                subject: `Report Export Ready: ${fileName}`,
                template: 'export-ready',
                data: {
                    fileName,
                    format: format.toUpperCase(),
                    downloadLink: `${process.env.BASE_URL}/api/exports/download/${path.basename(filePath)}`,
                },
            });
        } catch (error) {
            logger.error('Failed to send export notification:', error);
        }
    }

    private async sendExportFailureNotification(email: string, fileName: string, error: string): Promise<void> {
        try {
            await sendTemplatedEmail({
                to: email,
                subject: `Report Export Failed: ${fileName}`,
                template: 'export-failed',
                data: {
                    fileName,
                    error,
                },
            });
        } catch (error) {
            logger.error('Failed to send export failure notification:', error);
        }
    }

    private async sendScheduledReportNotification(
        recipients: string[],
        reportType: string,
        files: Array<{ format: string; filePath: string }>
    ): Promise<void> {
        try {
            const attachments = files.map(file => ({
                filename: path.basename(file.filePath),
                path: file.filePath,
            }));

            for (const recipient of recipients) {
                await sendTemplatedEmail({
                    to: recipient,
                    subject: `Scheduled Report: ${reportType}`,
                    template: 'scheduled-report',
                    data: {
                        reportType,
                        generatedAt: new Date().toISOString(),
                        formats: files.map(f => f.format.toUpperCase()).join(', '),
                    },
                    attachments,
                });
            }
        } catch (error) {
            logger.error('Failed to send scheduled report notification:', error);
        }
    }

    private async sendScheduledReportFailureNotification(
        recipients: string[],
        reportType: string,
        error: string
    ): Promise<void> {
        try {
            for (const recipient of recipients) {
                await sendTemplatedEmail({
                    to: recipient,
                    subject: `Scheduled Report Failed: ${reportType}`,
                    template: 'scheduled-report-failed',
                    data: {
                        reportType,
                        error,
                    },
                });
            }
        } catch (error) {
            logger.error('Failed to send scheduled report failure notification:', error);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        logger.info('Shutting down background job service...');

        await Promise.all([
            this.exportQueue.close(),
            this.reportQueue.close(),
            this.cleanupQueue.close(),
        ]);

        logger.info('Background job service shut down successfully');
    }
}

export default BackgroundJobService;
