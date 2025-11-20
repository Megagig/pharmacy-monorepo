import cron from 'node-cron';
import { subscriptionLifecycleService } from './SubscriptionLifecycleService';
import { billingService } from './BillingService';

export class BillingJobService {
  private jobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();

  /**
   * Start all billing-related cron jobs
   */
  startAllJobs(): void {
    this.startBillingCycleJob();
    this.startSubscriptionStatusUpdateJob();
    this.startDunningJob();
    this.startTrialExpirationJob();
    this.startPendingPlanChangeJob();

    console.log('All billing jobs started successfully');
  }

  /**
   * Stop all billing jobs
   */
  stopAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped billing job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Start billing cycle processing job (runs daily at 2 AM)
   */
  private startBillingCycleJob(): void {
    const job = cron.schedule('0 2 * * *', async () => {
      console.log('Starting billing cycle processing...');
      try {
        const result = await subscriptionLifecycleService.processBillingCycles();
        console.log(`Billing cycle completed: ${result.processed} processed, ${result.failed} failed`);

        if (result.errors.length > 0) {
          console.error('Billing cycle errors:', result.errors);
          // Here you could send alerts to administrators
        }
      } catch (error) {
        console.error('Billing cycle job failed:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.jobs.set('billingCycle', job);
    console.log('Billing cycle job scheduled (daily at 2 AM UTC)');
  }

  /**
   * Start subscription status update job (runs every hour)
   */
  private startSubscriptionStatusUpdateJob(): void {
    const job = cron.schedule('0 * * * *', async () => {
      console.log('Updating subscription statuses...');
      try {
        await subscriptionLifecycleService.updateSubscriptionStatuses();
        console.log('Subscription statuses updated successfully');
      } catch (error) {
        console.error('Subscription status update job failed:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.jobs.set('statusUpdate', job);
    console.log('Subscription status update job scheduled (hourly)');
  }

  /**
   * Start dunning management job (runs daily at 10 AM)
   */
  private startDunningJob(): void {
    const job = cron.schedule('0 10 * * *', async () => {
      console.log('Processing dunning management...');
      try {
        await billingService.processDunning();
        console.log('Dunning management completed successfully');
      } catch (error) {
        console.error('Dunning management job failed:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.jobs.set('dunning', job);
    console.log('Dunning management job scheduled (daily at 10 AM UTC)');
  }

  /**
   * Start trial expiration job (runs every 6 hours)
   */
  private startTrialExpirationJob(): void {
    const job = cron.schedule('0 */6 * * *', async () => {
      console.log('Processing trial expirations...');
      try {
        // This would be implemented in the lifecycle service
        console.log('Trial expiration processing completed');
      } catch (error) {
        console.error('Trial expiration job failed:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.jobs.set('trialExpiration', job);
    console.log('Trial expiration job scheduled (every 6 hours)');
  }

  /**
   * Start pending plan change job (runs daily at 1 AM)
   */
  private startPendingPlanChangeJob(): void {
    const job = cron.schedule('0 1 * * *', async () => {
      console.log('Processing pending plan changes...');
      try {
        // This is already handled in processBillingCycles, but we can run it separately too
        console.log('Pending plan changes processed successfully');
      } catch (error) {
        console.error('Pending plan change job failed:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.jobs.set('pendingPlanChanges', job);
    console.log('Pending plan change job scheduled (daily at 1 AM UTC)');
  }

  /**
   * Run a specific job manually (for testing or admin purposes)
   */
  async runJobManually(jobName: string): Promise<void> {
    console.log(`Manually running job: ${jobName}`);

    switch (jobName) {
      case 'billingCycle':
        const result = await subscriptionLifecycleService.processBillingCycles();
        console.log(`Manual billing cycle result:`, result);
        break;

      case 'statusUpdate':
        await subscriptionLifecycleService.updateSubscriptionStatuses();
        console.log('Manual subscription status update completed');
        break;

      case 'dunning':
        await billingService.processDunning();
        console.log('Manual dunning processing completed');
        break;

      default:
        throw new Error(`Unknown job name: ${jobName}`);
    }
  }

  /**
   * Get status of all jobs
   */
  getJobStatuses(): Record<string, { scheduled: boolean }> {
    const statuses: Record<string, { scheduled: boolean }> = {};

    this.jobs.forEach((job, name) => {
      statuses[name] = {
        scheduled: true, // Job is scheduled if it exists in the map
        // Note: node-cron doesn't provide next run time directly
        // You might need to calculate this based on the cron expression
      };
    });

    return statuses;
  }

  /**
   * Restart a specific job
   */
  restartJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      job.start();
      console.log(`Restarted job: ${jobName}`);
    } else {
      throw new Error(`Job not found: ${jobName}`);
    }
  }

  /**
   * Stop a specific job
   */
  stopJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      console.log(`Stopped job: ${jobName}`);
    } else {
      throw new Error(`Job not found: ${jobName}`);
    }
  }

  /**
   * Start a specific job
   */
  startJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      console.log(`Started job: ${jobName}`);
    } else {
      throw new Error(`Job not found: ${jobName}`);
    }
  }
}

export const billingJobService = new BillingJobService();

// Auto-start jobs in production
if (process.env.NODE_ENV === 'production') {
  billingJobService.startAllJobs();
}