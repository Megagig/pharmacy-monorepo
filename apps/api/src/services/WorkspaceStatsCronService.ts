import * as cron from 'node-cron';
import WorkspaceStatsService from './WorkspaceStatsService';
import logger from '../utils/logger';

export class WorkspaceStatsCronService {
    private dailyRecalculationJob: cron.ScheduledTask | null = null;
    private monthlyApiResetJob: cron.ScheduledTask | null = null;
    private staleStatsCheckJob: cron.ScheduledTask | null = null;

    /**
     * Start all cron jobs
     */
    start(): void {
        this.startDailyRecalculation();
        this.startMonthlyApiReset();
        this.startStaleStatsCheck();
        logger.info('Workspace stats cron jobs started');
    }

    /**
     * Stop all cron jobs
     */
    stop(): void {
        if (this.dailyRecalculationJob) {
            this.dailyRecalculationJob.stop();
            this.dailyRecalculationJob = null;
        }
        if (this.monthlyApiResetJob) {
            this.monthlyApiResetJob.stop();
            this.monthlyApiResetJob = null;
        }
        if (this.staleStatsCheckJob) {
            this.staleStatsCheckJob.stop();
            this.staleStatsCheckJob = null;
        }
        logger.info('Workspace stats cron jobs stopped');
    }

    /**
     * Daily recalculation of workspace statistics
     * Runs at 2:00 AM every day
     */
    private startDailyRecalculation(): void {
        this.dailyRecalculationJob = cron.schedule('0 2 * * *', async () => {
            logger.info('Starting daily workspace stats recalculation');

            try {
                const results = await WorkspaceStatsService.batchRecalculateStats();
                logger.info(`Daily recalculation completed: ${results.length} workspaces processed`);
            } catch (error) {
                logger.error('Daily workspace stats recalculation failed:', error);
            }
        }, {
            timezone: 'Africa/Lagos' // Nigerian timezone
        });

        logger.info('Daily workspace stats recalculation job scheduled');
    }

    /**
     * Monthly API call counter reset
     * Runs at 12:01 AM on the 1st of every month
     */
    private startMonthlyApiReset(): void {
        this.monthlyApiResetJob = cron.schedule('1 0 1 * *', async () => {
            logger.info('Starting monthly API call counter reset');

            try {
                await WorkspaceStatsService.batchResetMonthlyApiCalls();
                logger.info('Monthly API call counter reset completed');
            } catch (error) {
                logger.error('Monthly API call counter reset failed:', error);
            }
        }, {
            timezone: 'Africa/Lagos'
        });

        logger.info('Monthly API call reset job scheduled');
    }

    /**
     * Check for workspaces with stale stats and recalculate them
     * Runs every 6 hours
     */
    private startStaleStatsCheck(): void {
        this.staleStatsCheckJob = cron.schedule('0 */6 * * *', async () => {
            logger.info('Starting stale stats check');

            try {
                const staleWorkspaces = await WorkspaceStatsService.getWorkspacesWithStaleStats();

                if (staleWorkspaces.length > 0) {
                    logger.info(`Found ${staleWorkspaces.length} workspaces with stale stats`);

                    const workspaceIds = staleWorkspaces.map(w => w._id);
                    const results = await WorkspaceStatsService.batchRecalculateStats(workspaceIds);

                    logger.info(`Stale stats recalculation completed: ${results.length} workspaces updated`);
                } else {
                    logger.info('No workspaces with stale stats found');
                }
            } catch (error) {
                logger.error('Stale stats check failed:', error);
            }
        }, {
            timezone: 'Africa/Lagos'
        });

        logger.info('Stale stats check job scheduled');
    }

    /**
     * Manually trigger daily recalculation
     */
    async triggerDailyRecalculation(): Promise<void> {
        logger.info('Manually triggering daily workspace stats recalculation');

        try {
            const results = await WorkspaceStatsService.batchRecalculateStats();
            logger.info(`Manual recalculation completed: ${results.length} workspaces processed`);
        } catch (error) {
            logger.error('Manual workspace stats recalculation failed:', error);
            throw error;
        }
    }

    /**
     * Manually trigger monthly API reset
     */
    async triggerMonthlyApiReset(): Promise<void> {
        logger.info('Manually triggering monthly API call counter reset');

        try {
            await WorkspaceStatsService.batchResetMonthlyApiCalls();
            logger.info('Manual API call counter reset completed');
        } catch (error) {
            logger.error('Manual API call counter reset failed:', error);
            throw error;
        }
    }

    /**
     * Get status of all cron jobs
     */
    getStatus(): {
        dailyRecalculation: boolean;
        monthlyApiReset: boolean;
        staleStatsCheck: boolean;
    } {
        return {
            dailyRecalculation: this.dailyRecalculationJob !== null,
            monthlyApiReset: this.monthlyApiResetJob !== null,
            staleStatsCheck: this.staleStatsCheckJob !== null
        };
    }
}

export default new WorkspaceStatsCronService();