import cron from 'node-cron';
import { emailDeliveryService } from './emailDeliveryService';

export class EmailDeliveryCronService {
    private retryJobRunning = false;
    private cleanupJobRunning = false;
    private bounceJobRunning = false;

    /**
     * Start all email delivery cron jobs
     */
    start(): void {
        console.log('Starting Email Delivery Cron Service...');

        // Retry failed emails every 10 minutes
        cron.schedule('*/10 * * * *', async () => {
            if (this.retryJobRunning) {
                console.log('Email retry job already running, skipping...');
                return;
            }

            this.retryJobRunning = true;
            try {
                console.log('Running email retry job...');
                await emailDeliveryService.retryFailedDeliveries();
            } catch (error) {
                console.error('Error in email retry cron job:', error);
            } finally {
                this.retryJobRunning = false;
            }
        });

        // Clean up old records daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            if (this.cleanupJobRunning) {
                console.log('Email cleanup job already running, skipping...');
                return;
            }

            this.cleanupJobRunning = true;
            try {
                console.log('Running email cleanup job...');
                await emailDeliveryService.cleanupOldRecords(90); // Keep records for 90 days
            } catch (error) {
                console.error('Error in email cleanup cron job:', error);
            } finally {
                this.cleanupJobRunning = false;
            }
        });

        // Handle bounced emails every hour
        cron.schedule('0 * * * *', async () => {
            if (this.bounceJobRunning) {
                console.log('Email bounce handling job already running, skipping...');
                return;
            }

            this.bounceJobRunning = true;
            try {
                console.log('Running email bounce handling job...');
                await emailDeliveryService.handleBouncedEmails();
            } catch (error) {
                console.error('Error in email bounce handling cron job:', error);
            } finally {
                this.bounceJobRunning = false;
            }
        });

        console.log('Email Delivery Cron Service started successfully');
    }

    /**
     * Stop all cron jobs
     */
    stop(): void {
        console.log('Stopping Email Delivery Cron Service...');
        cron.getTasks().forEach((task) => {
            task.stop();
        });
        console.log('Email Delivery Cron Service stopped');
    }

    /**
     * Get status of cron jobs
     */
    getStatus(): {
        retryJobRunning: boolean;
        cleanupJobRunning: boolean;
        bounceJobRunning: boolean;
    } {
        return {
            retryJobRunning: this.retryJobRunning,
            cleanupJobRunning: this.cleanupJobRunning,
            bounceJobRunning: this.bounceJobRunning,
        };
    }
}

// Export singleton instance
export const emailDeliveryCronService = new EmailDeliveryCronService();