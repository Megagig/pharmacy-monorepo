import cron from 'node-cron';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import unifiedInteractionService from '../services/unifiedInteractionService';
import MedicationManagement from '../models/MedicationManagement';
import Workplace from '../models/Workplace';
import User from '../models/User';

export class InteractionMonitorProcessor {
  private isRunning = false;
  private lastRunTime: Date | null = null;

  constructor() {
    this.initializeCronJobs();
  }

  /**
   * Initialize cron jobs for interaction monitoring
   */
  private initializeCronJobs() {
    // Daily interaction check - runs at 6 AM every day
    cron.schedule('0 6 * * *', async () => {
      await this.runDailyInteractionCheck();
    });

    // Weekly comprehensive check - runs every Monday at 7 AM
    cron.schedule('0 7 * * 1', async () => {
      await this.runWeeklyComprehensiveCheck();
    });

    // Cache cleanup - runs every 4 hours
    cron.schedule('0 */4 * * *', () => {
      unifiedInteractionService.clearExpiredCache();
      logger.info('Interaction cache cleanup completed');
    });

    logger.info('Interaction monitoring cron jobs initialized');
  }

  /**
   * Daily interaction check for all active patients
   */
  async runDailyInteractionCheck(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Daily interaction check already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting daily interaction check...');

      // Get all active workspaces
      const workspaces = await Workplace.find({
        status: 'active',
        subscriptionStatus: { $in: ['active', 'trialing'] }
      }).select('_id name').lean();

      let totalPatients = 0;
      let patientsWithInteractions = 0;
      let criticalInteractions = 0;

      for (const workspace of workspaces) {
        try {
          const result = await this.checkWorkspacePatients(workspace._id, 'scheduled');
          totalPatients += result.totalPatients;
          patientsWithInteractions += result.patientsWithInteractions;
          criticalInteractions += result.criticalInteractions;

          logger.info(
            `Workspace ${workspace.name}: Checked ${result.totalPatients} patients, ` +
            `${result.patientsWithInteractions} with interactions, ` +
            `${result.criticalInteractions} critical`
          );
        } catch (workspaceError) {
          logger.error(`Error checking workspace ${workspace._id}:`, workspaceError);
        }
      }

      const duration = Date.now() - startTime;
      this.lastRunTime = new Date();

      logger.info(
        `Daily interaction check completed in ${duration}ms. ` +
        `Total: ${totalPatients} patients, ` +
        `${patientsWithInteractions} with interactions, ` +
        `${criticalInteractions} critical interactions found`
      );

    } catch (error) {
      logger.error('Error in daily interaction check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Weekly comprehensive check with analytics
   */
  async runWeeklyComprehensiveCheck(): Promise<void> {
    try {
      logger.info('Starting weekly comprehensive interaction check...');

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Run daily check first
      await this.runDailyInteractionCheck();

      // Generate weekly analytics
      await this.generateWeeklyAnalytics(oneWeekAgo);

      // Cleanup old interactions (older than 6 months for non-critical)
      await this.cleanupOldInteractions();

      logger.info('Weekly comprehensive check completed');

    } catch (error) {
      logger.error('Error in weekly comprehensive check:', error);
    }
  }

  /**
   * Check interactions for all patients in a workspace
   */
  private async checkWorkspacePatients(
    workspaceId: mongoose.Types.ObjectId,
    checkType: 'scheduled' | 'manual' = 'scheduled'
  ): Promise<{
    totalPatients: number;
    patientsWithInteractions: number;
    criticalInteractions: number;
  }> {
    try {
      // Get all patients with active medications
      const patientsWithMeds = await MedicationManagement.aggregate([
        {
          $match: {
            workspaceId,
            status: 'active'
          }
        },
        {
          $group: {
            _id: '$patientId',
            medicationCount: { $sum: 1 },
            medications: { $push: '$$ROOT' }
          }
        },
        {
          $match: {
            medicationCount: { $gte: 2 } // Only check patients with 2+ medications
          }
        }
      ]);

      if (patientsWithMeds.length === 0) {
        return { totalPatients: 0, patientsWithInteractions: 0, criticalInteractions: 0 };
      }

      // Get a system user for the workspace to use for checks
      const systemUser = await this.getSystemUser(workspaceId);

      let patientsWithInteractions = 0;
      let totalCriticalInteractions = 0;

      // Process patients in batches
      const batchSize = 10;
      for (let i = 0; i < patientsWithMeds.length; i += batchSize) {
        const batch = patientsWithMeds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (patientData) => {
          try {
            const result = await unifiedInteractionService.checkPatientMedications(
              patientData._id,
              workspaceId,
              systemUser._id,
              checkType
            );

            if (result.hasInteractions) {
              patientsWithInteractions++;
            }

            if (result.hasCriticalInteractions) {
              totalCriticalInteractions += result.summary.critical + result.summary.major;
            }

            return result;
          } catch (error) {
            logger.error(`Error checking patient ${patientData._id}:`, error);
            return null;
          }
        });

        await Promise.all(batchPromises);
      }

      return {
        totalPatients: patientsWithMeds.length,
        patientsWithInteractions,
        criticalInteractions: totalCriticalInteractions
      };

    } catch (error) {
      logger.error(`Error checking workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create a system user for automated checks
   */
  private async getSystemUser(workspaceId: mongoose.Types.ObjectId): Promise<any> {
    // First try to find an active pharmacist in the workspace
    let user = await User.findOne({
      workspaceId,
      role: 'pharmacist',
      status: 'active'
    }).lean();

    // If no pharmacist, try admin
    if (!user) {
      user = await User.findOne({
        workspaceId,
        role: { $in: ['admin', 'workspace_admin'] },
        status: 'active'
      }).lean();
    }

    // If still no user, create a system user record (this shouldn't happen in production)
    if (!user) {
      logger.warn(`No active users found for workspace ${workspaceId}, using system default`);
      // Return a placeholder ObjectId for system operations
      return { _id: new mongoose.Types.ObjectId('000000000000000000000001') };
    }

    return user;
  }

  /**
   * Generate weekly analytics
   */
  private async generateWeeklyAnalytics(fromDate: Date): Promise<void> {
    try {
      // This could be expanded to generate detailed analytics reports
      // For now, just log summary statistics

      const DrugInteraction = (await import('../models/DrugInteraction')).default;

      const weeklyStats = await DrugInteraction.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate }
          }
        },
        {
          $group: {
            _id: null,
            totalChecks: { $sum: 1 },
            criticalInteractions: {
              $sum: { $cond: ['$hasCriticalInteraction', 1, 0] }
            },
            pendingReviews: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            byWorkspace: {
              $addToSet: '$workplaceId'
            }
          }
        }
      ]);

      if (weeklyStats.length > 0) {
        const stats = weeklyStats[0];
        logger.info(
          `Weekly Analytics: ${stats.totalChecks} interaction checks, ` +
          `${stats.criticalInteractions} critical interactions, ` +
          `${stats.pendingReviews} pending reviews across ` +
          `${stats.byWorkspace.length} workspaces`
        );
      }

    } catch (error) {
      logger.error('Error generating weekly analytics:', error);
    }
  }

  /**
   * Cleanup old interaction records
   */
  private async cleanupOldInteractions(): Promise<void> {
    try {
      const DrugInteraction = (await import('../models/DrugInteraction')).default;

      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);

      // Delete non-critical, reviewed interactions older than 6 months
      const deleteResult = await DrugInteraction.deleteMany({
        createdAt: { $lt: sixMonthsAgo },
        hasCriticalInteraction: false,
        hasContraindication: false,
        status: { $in: ['reviewed', 'approved'] }
      });

      if (deleteResult.deletedCount > 0) {
        logger.info(`Cleaned up ${deleteResult.deletedCount} old interaction records`);
      }

    } catch (error) {
      logger.error('Error cleaning up old interactions:', error);
    }
  }

  /**
   * Manual trigger for daily check (for testing or admin use)
   */
  async triggerDailyCheck(): Promise<void> {
    logger.info('Manually triggering daily interaction check...');
    await this.runDailyInteractionCheck();
  }

  /**
   * Check specific patient manually
   */
  async checkSpecificPatient(
    patientId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<any> {
    try {
      return await unifiedInteractionService.checkPatientMedications(
        patientId,
        workspaceId,
        userId,
        'manual'
      );
    } catch (error) {
      logger.error(`Error checking specific patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    isRunning: boolean;
    lastRunTime: Date | null;
    nextScheduledRun: string;
  } {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextScheduledRun: '6:00 AM daily'
    };
  }
}

// Create singleton instance
const interactionMonitorProcessor = new InteractionMonitorProcessor();

export default interactionMonitorProcessor;