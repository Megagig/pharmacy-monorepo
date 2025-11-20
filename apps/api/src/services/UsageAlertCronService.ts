import * as cron from 'node-cron';
import UsageAlertService from './UsageAlertService';
import logger from '../utils/logger';

export class UsageAlertCronService {
    private usageAlertJob: cron.ScheduledTask | null = null;

    /**
     * Start usage alert cron job
     */
    start(): void {
        this.startUsageAlertCheck();
        logger.info('Usage alert cron job started');
    }

    /**
     * Stop usage alert cron job
     */
    stop(): void {
        if (this.usageAlertJob) {
            this.usageAlertJob.stop();
            this.usageAlertJob = null;
        }
        logger.info('Usage alert cron job stopped');
    }

    /**
     * Check for usage alerts and send notifications
     * Runs every 6 hours
     */
    private startUsageAlertCheck(): void {
        this.usageAlertJob = cron.schedule('0 */6 * * *', async () => {
            logger.info('Starting usage alert check');

            try {
                await UsageAlertService.checkAndSendUsageAlerts();
                logger.info('Usage alert check completed successfully');
            } catch (error) {
                logger.error('Usage alert check failed:', error);
            }
        }, {
            timezone: 'Africa/Lagos' // Nigerian timezone
        });

        logger.info('Usage alert check job scheduled (every 6 hours)');
    }

    /**
     * Manually trigger usage alert check
     */
    async triggerUsageAlertCheck(): Promise<void> {
        logger.info('Manually triggering usage alert check');

        try {
            await UsageAlertService.checkAndSendUsageAlerts();
            logger.info('Manual usage alert check completed successfully');
        } catch (error) {
            logger.error('Manual usage alert check failed:', error);
            throw error;
        }
    }

    /**
     * Get status of usage alert cron job
     */
    getStatus(): {
        usageAlertCheck: boolean;
    } {
        return {
            usageAlertCheck: this.usageAlertJob !== null
        };
    }
}

export default new UsageAlertCronService();