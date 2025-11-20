import * as cron from 'node-cron';
import { mtrNotificationService } from './mtrNotificationService';
import logger from '../utils/logger';

/**
 * MTR Notification Scheduler
 * Handles periodic notification tasks using cron jobs
 */
class MTRNotificationScheduler {
    private jobs: Map<string, cron.ScheduledTask> = new Map();

    /**
     * Start all scheduled notification jobs
     */
    start(): void {
        this.scheduleOverdueFollowUpCheck();
        this.schedulePendingReminderProcessing();
        this.scheduleNotificationCleanup();

        logger.info('MTR notification scheduler started');
    }

    /**
     * Stop all scheduled jobs
     */
    stop(): void {
        this.jobs.forEach((job, name) => {
            job.stop();
            logger.info(`Stopped notification job: ${name}`);
        });
        this.jobs.clear();
        logger.info('MTR notification scheduler stopped');
    }

    /**
     * Schedule overdue follow-up checks (every hour)
     */
    private scheduleOverdueFollowUpCheck(): void {
        const job = cron.schedule('0 * * * *', async () => {
            try {
                logger.info('Running overdue follow-up check...');
                await mtrNotificationService.checkOverdueFollowUps();
                logger.info('Overdue follow-up check completed');
            } catch (error) {
                logger.error('Error in overdue follow-up check:', error);
            }
        }, {
            timezone: process.env.TIMEZONE || 'UTC'
        });

        job.start();
        this.jobs.set('overdueFollowUpCheck', job);
        logger.info('Scheduled overdue follow-up check (every hour)');
    }

    /**
     * Schedule pending reminder processing (every 15 minutes)
     */
    private schedulePendingReminderProcessing(): void {
        const job = cron.schedule('*/15 * * * *', async () => {
            try {
                logger.info('Processing pending reminders...');
                await mtrNotificationService.processPendingReminders();
                logger.info('Pending reminders processed');
            } catch (error) {
                logger.error('Error processing pending reminders:', error);
            }
        }, {
            timezone: process.env.TIMEZONE || 'UTC'
        });

        job.start();
        this.jobs.set('pendingReminderProcessing', job);
        logger.info('Scheduled pending reminder processing (every 15 minutes)');
    }

    /**
     * Schedule notification cleanup (daily at 2 AM)
     */
    private scheduleNotificationCleanup(): void {
        const job = cron.schedule('0 2 * * *', async () => {
            try {
                logger.info('Running notification cleanup...');
                await this.cleanupOldNotifications();
                logger.info('Notification cleanup completed');
            } catch (error) {
                logger.error('Error in notification cleanup:', error);
            }
        }, {
            timezone: process.env.TIMEZONE || 'UTC'
        });

        job.start();
        this.jobs.set('notificationCleanup', job);
        logger.info('Scheduled notification cleanup (daily at 2 AM)');
    }

    /**
     * Schedule daily digest notifications (daily at 8 AM)
     */
    scheduleDailyDigest(): void {
        const job = cron.schedule('0 8 * * *', async () => {
            try {
                logger.info('Sending daily digest notifications...');
                await this.sendDailyDigest();
                logger.info('Daily digest notifications sent');
            } catch (error) {
                logger.error('Error sending daily digest:', error);
            }
        }, {
            timezone: process.env.TIMEZONE || 'UTC'
        });

        job.start();
        this.jobs.set('dailyDigest', job);
        logger.info('Scheduled daily digest notifications (daily at 8 AM)');
    }

    /**
     * Schedule weekly report notifications (Mondays at 9 AM)
     */
    scheduleWeeklyReport(): void {
        const job = cron.schedule('0 9 * * 1', async () => {
            try {
                logger.info('Sending weekly report notifications...');
                await this.sendWeeklyReport();
                logger.info('Weekly report notifications sent');
            } catch (error) {
                logger.error('Error sending weekly report:', error);
            }
        }, {
            timezone: process.env.TIMEZONE || 'UTC'
        });

        job.start();
        this.jobs.set('weeklyReport', job);
        logger.info('Scheduled weekly report notifications (Mondays at 9 AM)');
    }

    /**
     * Clean up old notifications (older than 30 days)
     */
    private async cleanupOldNotifications(): Promise<void> {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            // In a real implementation, you would clean up from a persistent store
            // For now, we'll just log the cleanup action
            logger.info(`Cleaning up notifications older than ${thirtyDaysAgo.toISOString()}`);

            // Example cleanup logic:
            // await NotificationModel.deleteMany({
            //     createdAt: { $lt: thirtyDaysAgo },
            //     sent: true
            // });

        } catch (error) {
            logger.error('Error cleaning up old notifications:', error);
            throw error;
        }
    }

    /**
     * Send daily digest to users who have it enabled
     */
    private async sendDailyDigest(): Promise<void> {
        try {
            // This would be implemented to send daily digest emails
            // containing summary of MTR activities, overdue follow-ups, etc.
            logger.info('Daily digest functionality would be implemented here');

            // Example implementation:
            // const users = await User.find({
            //     'notificationPreferences.dailyDigest': true,
            //     status: 'active'
            // });

            // for (const user of users) {
            //     await this.sendUserDailyDigest(user);
            // }

        } catch (error) {
            logger.error('Error sending daily digest:', error);
            throw error;
        }
    }

    /**
     * Send weekly report to users who have it enabled
     */
    private async sendWeeklyReport(): Promise<void> {
        try {
            // This would be implemented to send weekly report emails
            // containing MTR statistics, performance metrics, etc.
            logger.info('Weekly report functionality would be implemented here');

            // Example implementation:
            // const users = await User.find({
            //     'notificationPreferences.weeklyReport': true,
            //     status: 'active'
            // });

            // for (const user of users) {
            //     await this.sendUserWeeklyReport(user);
            // }

        } catch (error) {
            logger.error('Error sending weekly report:', error);
            throw error;
        }
    }

    /**
     * Get status of all scheduled jobs
     */
    getJobStatus(): Record<string, boolean> {
        const status: Record<string, boolean> = {};

        this.jobs.forEach((job, name) => {
            status[name] = (job as any).running || false;
        });

        return status;
    }

    /**
     * Manually trigger a specific job
     */
    async triggerJob(jobName: string): Promise<void> {
        switch (jobName) {
            case 'overdueFollowUpCheck':
                await mtrNotificationService.checkOverdueFollowUps();
                break;
            case 'pendingReminderProcessing':
                await mtrNotificationService.processPendingReminders();
                break;
            case 'notificationCleanup':
                await this.cleanupOldNotifications();
                break;
            case 'dailyDigest':
                await this.sendDailyDigest();
                break;
            case 'weeklyReport':
                await this.sendWeeklyReport();
                break;
            default:
                throw new Error(`Unknown job: ${jobName}`);
        }
    }
}

export const mtrNotificationScheduler = new MTRNotificationScheduler();
export default mtrNotificationScheduler;