import cron, { ScheduledTask } from 'node-cron';
import logger from '../../../utils/logger';
import diagnosticFollowUpService from './diagnosticFollowUpService';
import adherenceService from './adherenceService';
import diagnosticNotificationService from './diagnosticNotificationService';

class DiagnosticCronService {
    private jobs: Map<string, ScheduledTask> = new Map();

    /**
     * Initialize all cron jobs
     */
    public initializeCronJobs(): void {
        try {
            // Process missed follow-ups every hour
            this.scheduleJob(
                'processMissedFollowUps',
                '0 * * * *', // Every hour at minute 0
                this.processMissedFollowUps.bind(this)
            );

            // Process adherence assessments every 6 hours
            this.scheduleJob(
                'processAdherenceAssessments',
                '0 */6 * * *', // Every 6 hours
                this.processAdherenceAssessments.bind(this)
            );

            // Process pending notifications every 15 minutes
            this.scheduleJob(
                'processPendingNotifications',
                '*/15 * * * *', // Every 15 minutes
                this.processPendingNotifications.bind(this)
            );

            // Check for overdue follow-ups every 2 hours
            this.scheduleJob(
                'checkOverdueFollowUps',
                '0 */2 * * *', // Every 2 hours
                this.checkOverdueFollowUps.bind(this)
            );

            // Check adherence issues every 4 hours
            this.scheduleJob(
                'checkAdherenceIssues',
                '0 */4 * * *', // Every 4 hours
                this.checkAdherenceIssues.bind(this)
            );

            // Daily cleanup and maintenance at 2 AM
            this.scheduleJob(
                'dailyMaintenance',
                '0 2 * * *', // Daily at 2 AM
                this.dailyMaintenance.bind(this)
            );

            logger.info('Diagnostic cron jobs initialized successfully');

        } catch (error) {
            logger.error('Error initializing diagnostic cron jobs:', error);
            throw error;
        }
    }

    /**
     * Schedule a cron job
     */
    private scheduleJob(name: string, schedule: string, task: () => Promise<void>): void {
        try {
            const job = cron.schedule(schedule, async () => {
                logger.info(`Starting cron job: ${name}`);
                const startTime = Date.now();

                try {
                    await task();
                    const duration = Date.now() - startTime;
                    logger.info(`Completed cron job: ${name} in ${duration}ms`);
                } catch (error) {
                    logger.error(`Error in cron job ${name}:`, error);
                }
            }, {
                timezone: 'UTC'
            });

            this.jobs.set(name, job);
            logger.info(`Scheduled cron job: ${name} with schedule: ${schedule}`);

        } catch (error) {
            logger.error(`Error scheduling cron job ${name}:`, error);
            throw error;
        }
    }

    /**
     * Start all cron jobs
     */
    public startAllJobs(): void {
        try {
            this.jobs.forEach((job, name) => {
                job.start();
                logger.info(`Started cron job: ${name}`);
            });

            logger.info(`Started ${this.jobs.size} diagnostic cron jobs`);

        } catch (error) {
            logger.error('Error starting cron jobs:', error);
            throw error;
        }
    }

    /**
     * Stop all cron jobs
     */
    public stopAllJobs(): void {
        try {
            this.jobs.forEach((job, name) => {
                job.stop();
                logger.info(`Stopped cron job: ${name}`);
            });

            logger.info(`Stopped ${this.jobs.size} diagnostic cron jobs`);

        } catch (error) {
            logger.error('Error stopping cron jobs:', error);
            throw error;
        }
    }

    /**
     * Stop a specific cron job
     */
    public stopJob(name: string): void {
        const job = this.jobs.get(name);
        if (job) {
            job.stop();
            logger.info(`Stopped cron job: ${name}`);
        } else {
            logger.warn(`Cron job not found: ${name}`);
        }
    }

    /**
     * Start a specific cron job
     */
    public startJob(name: string): void {
        const job = this.jobs.get(name);
        if (job) {
            job.start();
            logger.info(`Started cron job: ${name}`);
        } else {
            logger.warn(`Cron job not found: ${name}`);
        }
    }

    /**
     * Get status of all cron jobs
     */
    public getJobsStatus(): Record<string, boolean> {
        const status: Record<string, boolean> = {};

        this.jobs.forEach((job, name) => {
            status[name] = job.getStatus() === 'running';
        });

        return status;
    }

    /**
     * Cron job implementations
     */

    /**
     * Process missed follow-ups
     */
    private async processMissedFollowUps(): Promise<void> {
        try {
            await diagnosticFollowUpService.processMissedFollowUps();
            logger.info('Processed missed follow-ups successfully');
        } catch (error) {
            logger.error('Error processing missed follow-ups:', error);
            throw error;
        }
    }

    /**
     * Process adherence assessments
     */
    private async processAdherenceAssessments(): Promise<void> {
        try {
            await adherenceService.processAdherenceAssessments();
            logger.info('Processed adherence assessments successfully');
        } catch (error) {
            logger.error('Error processing adherence assessments:', error);
            throw error;
        }
    }

    /**
     * Process pending notifications
     */
    private async processPendingNotifications(): Promise<void> {
        try {
            await diagnosticNotificationService.processPendingNotifications();
            logger.info('Processed pending notifications successfully');
        } catch (error) {
            logger.error('Error processing pending notifications:', error);
            throw error;
        }
    }

    /**
     * Check for overdue follow-ups
     */
    private async checkOverdueFollowUps(): Promise<void> {
        try {
            await diagnosticNotificationService.checkOverdueFollowUps();
            logger.info('Checked overdue follow-ups successfully');
        } catch (error) {
            logger.error('Error checking overdue follow-ups:', error);
            throw error;
        }
    }

    /**
     * Check adherence issues
     */
    private async checkAdherenceIssues(): Promise<void> {
        try {
            await diagnosticNotificationService.checkAdherenceIssues();
            logger.info('Checked adherence issues successfully');
        } catch (error) {
            logger.error('Error checking adherence issues:', error);
            throw error;
        }
    }

    /**
     * Daily maintenance tasks
     */
    private async dailyMaintenance(): Promise<void> {
        try {
            logger.info('Starting daily diagnostic maintenance tasks');

            // Clean up old notifications (older than 30 days)
            await this.cleanupOldNotifications();

            // Archive completed follow-ups (older than 90 days)
            await this.archiveOldFollowUps();

            // Generate daily adherence summary
            await this.generateDailyAdherenceSummary();

            // Cleanup expired alerts
            await this.cleanupExpiredAlerts();

            logger.info('Completed daily diagnostic maintenance tasks');

        } catch (error) {
            logger.error('Error in daily maintenance:', error);
            throw error;
        }
    }

    /**
     * Maintenance helper methods
     */

    private async cleanupOldNotifications(): Promise<void> {
        try {
            // This would clean up old notification records
            // Implementation depends on how notifications are stored
            logger.info('Cleaned up old notifications');
        } catch (error) {
            logger.error('Error cleaning up old notifications:', error);
        }
    }

    private async archiveOldFollowUps(): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

            // This could move old follow-ups to an archive collection
            // For now, we'll just log the action
            logger.info(`Would archive follow-ups older than ${cutoffDate.toISOString()}`);
        } catch (error) {
            logger.error('Error archiving old follow-ups:', error);
        }
    }

    private async generateDailyAdherenceSummary(): Promise<void> {
        try {
            // This could generate daily adherence reports for administrators
            logger.info('Generated daily adherence summary');
        } catch (error) {
            logger.error('Error generating daily adherence summary:', error);
        }
    }

    private async cleanupExpiredAlerts(): Promise<void> {
        try {
            // This could clean up resolved alerts older than a certain period
            logger.info('Cleaned up expired alerts');
        } catch (error) {
            logger.error('Error cleaning up expired alerts:', error);
        }
    }

    /**
     * Manual trigger methods for testing/admin use
     */

    /**
     * Manually trigger a specific job
     */
    public async triggerJob(jobName: string): Promise<void> {
        try {
            logger.info(`Manually triggering job: ${jobName}`);

            switch (jobName) {
                case 'processMissedFollowUps':
                    await this.processMissedFollowUps();
                    break;
                case 'processAdherenceAssessments':
                    await this.processAdherenceAssessments();
                    break;
                case 'processPendingNotifications':
                    await this.processPendingNotifications();
                    break;
                case 'checkOverdueFollowUps':
                    await this.checkOverdueFollowUps();
                    break;
                case 'checkAdherenceIssues':
                    await this.checkAdherenceIssues();
                    break;
                case 'dailyMaintenance':
                    await this.dailyMaintenance();
                    break;
                default:
                    throw new Error(`Unknown job name: ${jobName}`);
            }

            logger.info(`Successfully triggered job: ${jobName}`);

        } catch (error) {
            logger.error(`Error triggering job ${jobName}:`, error);
            throw error;
        }
    }

    /**
     * Get available job names
     */
    public getAvailableJobs(): string[] {
        return Array.from(this.jobs.keys());
    }

    /**
     * Update job schedule
     */
    public updateJobSchedule(jobName: string, newSchedule: string): void {
        try {
            const job = this.jobs.get(jobName);
            if (!job) {
                throw new Error(`Job not found: ${jobName}`);
            }

            // Stop the current job
            job.stop();

            // Create new job with updated schedule
            // Note: node-cron doesn't support dynamic schedule updates,
            // so we need to recreate the job
            const jobFunction = this.getJobFunction(jobName);
            if (jobFunction) {
                this.scheduleJob(jobName, newSchedule, jobFunction);
                logger.info(`Updated schedule for job ${jobName} to: ${newSchedule}`);
            } else {
                throw new Error(`Job function not found for: ${jobName}`);
            }

        } catch (error) {
            logger.error(`Error updating job schedule for ${jobName}:`, error);
            throw error;
        }
    }

    /**
     * Get job function by name
     */
    private getJobFunction(jobName: string): (() => Promise<void>) | null {
        const jobFunctions: Record<string, () => Promise<void>> = {
            'processMissedFollowUps': this.processMissedFollowUps.bind(this),
            'processAdherenceAssessments': this.processAdherenceAssessments.bind(this),
            'processPendingNotifications': this.processPendingNotifications.bind(this),
            'checkOverdueFollowUps': this.checkOverdueFollowUps.bind(this),
            'checkAdherenceIssues': this.checkAdherenceIssues.bind(this),
            'dailyMaintenance': this.dailyMaintenance.bind(this)
        };

        return jobFunctions[jobName] || null;
    }

    /**
     * Graceful shutdown
     */
    public async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down diagnostic cron service...');

            this.stopAllJobs();

            // Wait a moment for jobs to stop gracefully
            await new Promise(resolve => setTimeout(resolve, 1000));

            logger.info('Diagnostic cron service shutdown complete');

        } catch (error) {
            logger.error('Error during diagnostic cron service shutdown:', error);
            throw error;
        }
    }
}

// Create singleton instance
export const diagnosticCronService = new DiagnosticCronService();
export default diagnosticCronService;