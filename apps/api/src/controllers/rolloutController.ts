/**
 * Rollout Controller
 * 
 * Provides API endpoints for managing and monitoring the patient engagement rollout.
 * These endpoints are typically used by administrators and monitoring systems.
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import PatientEngagementRolloutService from '../services/PatientEngagementRolloutService';
import { performMonitoringCheck } from '../scripts/monitorPatientEngagementRollout';
import logger from '../utils/logger';

/**
 * Get current rollout status
 */
export const getRolloutStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const status = await PatientEngagementRolloutService.getRolloutStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting rollout status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rollout status',
      error: error.message
    });
  }
};

/**
 * Update rollout percentage
 */
export const updateRolloutPercentage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const { percentage, phaseDescription, monitoringPeriod, rollbackThreshold } = req.body;
    const updatedBy = req.user.id.toString();

    // Validate input
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      res.status(400).json({
        success: false,
        message: 'Percentage must be a number between 0 and 100'
      });
      return;
    }

    await PatientEngagementRolloutService.updateRolloutPercentage(
      percentage,
      updatedBy,
      {
        phaseDescription,
        monitoringPeriod,
        rollbackThreshold
      }
    );

    // Get updated status
    const status = await PatientEngagementRolloutService.getRolloutStatus();

    res.json({
      success: true,
      message: `Rollout updated to ${percentage}%`,
      data: status
    });

    logger.info('Rollout percentage updated via API', {
      percentage,
      updatedBy,
      phaseDescription
    });
  } catch (error) {
    logger.error('Error updating rollout percentage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rollout percentage',
      error: error.message
    });
  }
};

/**
 * Get rollout metrics
 */
export const getRolloutMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const metrics = await PatientEngagementRolloutService.calculateRolloutMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error getting rollout metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rollout metrics',
      error: error.message
    });
  }
};

/**
 * Get enabled workspaces
 */
export const getEnabledWorkspaces = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const workspaces = await PatientEngagementRolloutService.getEnabledWorkspaces();

    res.json({
      success: true,
      data: workspaces
    });
  } catch (error) {
    logger.error('Error getting enabled workspaces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get enabled workspaces',
      error: error.message
    });
  }
};

/**
 * Generate rollout report
 */
export const generateRolloutReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const report = await PatientEngagementRolloutService.generateRolloutReport();

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating rollout report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate rollout report',
      error: error.message
    });
  }
};

/**
 * Perform monitoring check
 */
export const performMonitoringCheckAPI = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const monitoringReport = await performMonitoringCheck();

    res.json({
      success: true,
      data: monitoringReport
    });
  } catch (error) {
    logger.error('Error performing monitoring check:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform monitoring check',
      error: error.message
    });
  }
};

/**
 * Check if rollout should be paused
 */
export const checkPauseConditions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const { errorThreshold } = req.query;
    const threshold = errorThreshold ? parseFloat(errorThreshold as string) : 5;

    const pauseCheck = await PatientEngagementRolloutService.shouldPauseRollout(threshold);

    res.json({
      success: true,
      data: pauseCheck
    });
  } catch (error) {
    logger.error('Error checking pause conditions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check pause conditions',
      error: error.message
    });
  }
};

/**
 * Pause rollout
 */
export const pauseRollout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const { reason } = req.body;
    const updatedBy = req.user.id.toString();

    await PatientEngagementRolloutService.updateRolloutPercentage(0, updatedBy, {
      phaseDescription: `Rollout paused: ${reason || 'Manual pause'}`
    });

    const status = await PatientEngagementRolloutService.getRolloutStatus();

    res.json({
      success: true,
      message: 'Rollout paused successfully',
      data: status
    });

    logger.warn('Rollout paused via API', {
      reason,
      updatedBy
    });
  } catch (error) {
    logger.error('Error pausing rollout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause rollout',
      error: error.message
    });
  }
};

/**
 * Get rollout health score
 */
export const getRolloutHealth = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Allow pharmacy managers and super admins to check health
    if (!['pharmacy_manager', 'super_admin'].includes(req.user?.role || '')) {
      res.status(403).json({
        success: false,
        message: 'Manager or admin access required'
      });
      return;
    }

    const monitoringReport = await performMonitoringCheck();

    res.json({
      success: true,
      data: {
        healthScore: monitoringReport.healthScore,
        status: getHealthDescription(monitoringReport.healthScore),
        alertCount: monitoringReport.alerts.length,
        criticalAlerts: monitoringReport.alerts.filter(a => a.severity === 'critical').length,
        shouldPause: monitoringReport.shouldPause,
        pauseReason: monitoringReport.pauseReason
      }
    });
  } catch (error) {
    logger.error('Error getting rollout health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rollout health',
      error: error.message
    });
  }
};

/**
 * Get health description based on score
 */
function getHealthDescription(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Poor';
  if (score >= 40) return 'Critical';
  return 'Emergency';
}

export default {
  getRolloutStatus,
  updateRolloutPercentage,
  getRolloutMetrics,
  getEnabledWorkspaces,
  generateRolloutReport,
  performMonitoringCheckAPI,
  checkPauseConditions,
  pauseRollout,
  getRolloutHealth
};