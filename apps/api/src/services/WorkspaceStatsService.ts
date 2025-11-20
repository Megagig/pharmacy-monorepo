import mongoose from 'mongoose';
import Workplace, { IWorkplace, WorkspaceStats } from '../models/Workplace';
import User from '../models/User';
import Patient from '../models/Patient';
import logger from '../utils/logger';

export interface UsageUpdateData {
    workspaceId: mongoose.Types.ObjectId;
    resource: 'patients' | 'users' | 'storage' | 'apiCalls';
    delta: number; // Can be positive or negative
    operation?: 'increment' | 'decrement' | 'set';
}

export interface UsageStats {
    patientsCount: number;
    usersCount: number;
    storageUsed: number;
    apiCallsThisMonth: number;
    lastUpdated: Date;
}

export interface RecalculationResult {
    workspaceId: mongoose.Types.ObjectId;
    previousStats: WorkspaceStats;
    newStats: WorkspaceStats;
    differences: Partial<WorkspaceStats>;
}

export class WorkspaceStatsService {
    /**
     * Update workspace usage statistics transactionally
     */
    async updateUsageStats(data: UsageUpdateData): Promise<WorkspaceStats> {
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const { workspaceId, resource, delta, operation = 'increment' } = data;

            // Build the update query based on operation
            let updateQuery: any = {
                'stats.lastUpdated': new Date(),
            };

            switch (operation) {
                case 'increment':
                    updateQuery[`stats.${resource}Count`] = { $inc: delta };
                    break;
                case 'decrement':
                    updateQuery[`stats.${resource}Count`] = { $inc: -Math.abs(delta) };
                    break;
                case 'set':
                    updateQuery[`stats.${resource}Count`] = delta;
                    break;
                default:
                    updateQuery[`stats.${resource}Count`] = { $inc: delta };
            }

            // Ensure counts don't go below zero
            const workplace = await Workplace.findByIdAndUpdate(
                workspaceId,
                updateQuery,
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!workplace) {
                throw new Error(`Workspace not found: ${workspaceId}`);
            }

            // Ensure no negative counts
            const stats = workplace.stats;
            let needsCorrection = false;
            const corrections: any = {};

            if (stats.patientsCount < 0) {
                corrections['stats.patientsCount'] = 0;
                needsCorrection = true;
            }
            if (stats.usersCount < 0) {
                corrections['stats.usersCount'] = 0;
                needsCorrection = true;
            }
            if (stats.storageUsed && stats.storageUsed < 0) {
                corrections['stats.storageUsed'] = 0;
                needsCorrection = true;
            }
            if (stats.apiCallsThisMonth && stats.apiCallsThisMonth < 0) {
                corrections['stats.apiCallsThisMonth'] = 0;
                needsCorrection = true;
            }

            if (needsCorrection) {
                await Workplace.findByIdAndUpdate(
                    workspaceId,
                    corrections,
                    { session }
                );

                // Refetch the corrected stats
                const correctedWorkplace = await Workplace.findById(workspaceId, null, { session });
                await session.commitTransaction();
                return correctedWorkplace!.stats;
            }

            await session.commitTransaction();
            return stats;

        } catch (error) {
            await session.abortTransaction();
            logger.error('Error updating workspace usage stats:', {
                error: error instanceof Error ? error.message : error,
                workspaceId: data.workspaceId,
                resource: data.resource,
                delta: data.delta
            });
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get current usage statistics for a workspace
     */
    async getUsageStats(workspaceId: mongoose.Types.ObjectId): Promise<WorkspaceStats> {
        const workplace = await Workplace.findById(workspaceId).select('stats');

        if (!workplace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }

        return workplace.stats;
    }

    /**
     * Recalculate usage statistics from actual data
     */
    async recalculateUsageStats(workspaceId: mongoose.Types.ObjectId): Promise<RecalculationResult> {
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const workplace = await Workplace.findById(workspaceId, null, { session });
            if (!workplace) {
                throw new Error(`Workspace not found: ${workspaceId}`);
            }

            const previousStats = { ...workplace.stats };

            // Count actual patients
            const patientsCount = await Patient.countDocuments({
                workplaceId: workspaceId
            }, { session });

            // Count actual users
            const usersCount = await User.countDocuments({
                workplaceId: workspaceId
            }, { session });

            // For storage and API calls, we'll keep existing values as they require
            // more complex calculations that should be tracked incrementally
            const newStats: WorkspaceStats = {
                patientsCount,
                usersCount,
                storageUsed: workplace.stats.storageUsed || 0,
                apiCallsThisMonth: workplace.stats.apiCallsThisMonth || 0,
                lastUpdated: new Date()
            };

            // Update the workspace with recalculated stats
            await Workplace.findByIdAndUpdate(
                workspaceId,
                { stats: newStats },
                { session }
            );

            // Calculate differences
            const differences: Partial<WorkspaceStats> = {};
            if (previousStats.patientsCount !== newStats.patientsCount) {
                differences.patientsCount = newStats.patientsCount - previousStats.patientsCount;
            }
            if (previousStats.usersCount !== newStats.usersCount) {
                differences.usersCount = newStats.usersCount - previousStats.usersCount;
            }

            await session.commitTransaction();

            logger.info('Workspace usage stats recalculated:', {
                workspaceId,
                previousStats,
                newStats,
                differences
            });

            return {
                workspaceId,
                previousStats,
                newStats,
                differences
            };

        } catch (error) {
            await session.abortTransaction();
            logger.error('Error recalculating workspace usage stats:', {
                error: error instanceof Error ? error.message : error,
                workspaceId
            });
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Batch recalculate stats for multiple workspaces
     */
    async batchRecalculateStats(workspaceIds?: mongoose.Types.ObjectId[]): Promise<RecalculationResult[]> {
        let targetWorkspaces: mongoose.Types.ObjectId[];

        if (workspaceIds) {
            targetWorkspaces = workspaceIds;
        } else {
            // Get all workspace IDs if none specified
            const workplaces = await Workplace.find({}, '_id');
            targetWorkspaces = workplaces.map(w => w._id);
        }

        const results: RecalculationResult[] = [];
        const errors: { workspaceId: mongoose.Types.ObjectId; error: string }[] = [];

        for (const workspaceId of targetWorkspaces) {
            try {
                const result = await this.recalculateUsageStats(workspaceId);
                results.push(result);
            } catch (error) {
                errors.push({
                    workspaceId,
                    error: error instanceof Error ? error.message : String(error)
                });
                logger.error(`Failed to recalculate stats for workspace ${workspaceId}:`, error);
            }
        }

        if (errors.length > 0) {
            logger.warn(`Batch recalculation completed with ${errors.length} errors:`, errors);
        }

        logger.info(`Batch recalculation completed: ${results.length} successful, ${errors.length} failed`);
        return results;
    }

    /**
     * Reset API call counter for a new month
     */
    async resetMonthlyApiCalls(workspaceId: mongoose.Types.ObjectId): Promise<void> {
        await Workplace.findByIdAndUpdate(
            workspaceId,
            {
                'stats.apiCallsThisMonth': 0,
                'stats.lastUpdated': new Date()
            }
        );

        logger.info(`Reset monthly API calls for workspace: ${workspaceId}`);
    }

    /**
     * Batch reset API calls for all workspaces (monthly cron job)
     */
    async batchResetMonthlyApiCalls(): Promise<void> {
        const result = await Workplace.updateMany(
            {},
            {
                'stats.apiCallsThisMonth': 0,
                'stats.lastUpdated': new Date()
            }
        );

        logger.info(`Batch reset monthly API calls: ${result.modifiedCount} workspaces updated`);
    }

    /**
     * Get workspaces with stale stats (not updated in last 24 hours)
     */
    async getWorkspacesWithStaleStats(): Promise<IWorkplace[]> {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return await Workplace.find({
            'stats.lastUpdated': { $lt: oneDayAgo }
        }).select('_id name stats');
    }

    /**
     * Update storage usage for a workspace
     */
    async updateStorageUsage(
        workspaceId: mongoose.Types.ObjectId,
        sizeInMB: number,
        operation: 'add' | 'remove' = 'add'
    ): Promise<WorkspaceStats> {
        const delta = operation === 'add' ? sizeInMB : -sizeInMB;

        return await this.updateUsageStats({
            workspaceId,
            resource: 'storage',
            delta,
            operation: 'increment'
        });
    }

    /**
     * Increment API call counter
     */
    async incrementApiCalls(
        workspaceId: mongoose.Types.ObjectId,
        count: number = 1
    ): Promise<WorkspaceStats> {
        return await this.updateUsageStats({
            workspaceId,
            resource: 'apiCalls',
            delta: count,
            operation: 'increment'
        });
    }

    /**
     * Get usage statistics with percentage of limits
     */
    async getUsageWithLimits(
        workspaceId: mongoose.Types.ObjectId,
        limits: { patients?: number | null; users?: number | null; storage?: number | null; apiCalls?: number | null }
    ): Promise<{
        stats: WorkspaceStats;
        usage: {
            patients: { current: number; limit: number | null; percentage: number | null };
            users: { current: number; limit: number | null; percentage: number | null };
            storage: { current: number; limit: number | null; percentage: number | null };
            apiCalls: { current: number; limit: number | null; percentage: number | null };
        };
    }> {
        const stats = await this.getUsageStats(workspaceId);

        const calculatePercentage = (current: number, limit: number | null): number | null => {
            if (limit === null || limit === 0) return null;
            return Math.round((current / limit) * 100);
        };

        return {
            stats,
            usage: {
                patients: {
                    current: stats.patientsCount,
                    limit: limits.patients || null,
                    percentage: calculatePercentage(stats.patientsCount, limits.patients || null)
                },
                users: {
                    current: stats.usersCount,
                    limit: limits.users || null,
                    percentage: calculatePercentage(stats.usersCount, limits.users || null)
                },
                storage: {
                    current: stats.storageUsed || 0,
                    limit: limits.storage || null,
                    percentage: calculatePercentage(stats.storageUsed || 0, limits.storage || null)
                },
                apiCalls: {
                    current: stats.apiCallsThisMonth || 0,
                    limit: limits.apiCalls || null,
                    percentage: calculatePercentage(stats.apiCallsThisMonth || 0, limits.apiCalls || null)
                }
            }
        };
    }
}

export default new WorkspaceStatsService();