/**
 * Alert Routes
 * API endpoints for alert management
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import express from 'express';
import mongoose from 'mongoose';
import AlertService, { AlertFilters, AlertOptions } from '../services/AlertService';
import { clinicalTriggerMonitorJob } from '../services/queues/ClinicalTriggerMonitorJob';
import { auth, AuthRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { validateRequest } from '../middlewares/validation';
import { body, param, query } from 'express-validator';
import {
  sendSuccess,
  sendError,
  createNotFoundError,
  createValidationError,
} from '../utils/responseHelpers';
import logger from '../utils/logger';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * Get patient alerts
 * GET /api/alerts/patient/:patientId
 */
router.get(
  '/patient/:patientId',
  [
    param('patientId').isMongoId().withMessage('Invalid patient ID'),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('type').optional().isString(),
    query('dismissed').optional().isBoolean(),
  ],
  validateRequest,
  requirePermission('view_patient_alerts'),
  async (req: AuthRequest, res) => {
    try {
      const { patientId } = req.params;
      const { severity, type, dismissed } = req.query;
      const { workplaceId } = req.user!;

      const filters: AlertFilters = {};
      
      if (severity) {
        filters.severity = severity as string;
      }
      
      if (type) {
        filters.type = type as string;
      }
      
      if (dismissed !== undefined) {
        filters.dismissed = dismissed === 'true';
      }

      const alerts = await AlertService.getPatientAlerts(
        new mongoose.Types.ObjectId(patientId),
        workplaceId,
        filters
      );

      logger.info('Patient alerts retrieved', {
        patientId,
        alertCount: alerts.length,
        userId: req.user!._id.toString(),
      });

      sendSuccess(res, {
        alerts,
        summary: {
          total: alerts.length,
          bySeverity: alerts.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byType: alerts.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      });
    } catch (error) {
      logger.error('Error retrieving patient alerts', {
        patientId: req.params.patientId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user!._id.toString(),
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve patient alerts', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get dashboard alerts
 * GET /api/alerts/dashboard
 */
router.get(
  '/dashboard',
  [
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('type').optional().isString(),
    query('dismissed').optional().isBoolean(),
    query('assignedToMe').optional().isBoolean(),
  ],
  validateRequest,
  requirePermission('view_dashboard_alerts'),
  async (req: AuthRequest, res) => {
    try {
      const { severity, type, dismissed, assignedToMe } = req.query;
      const { workplaceId } = req.user!;
      const userId = req.user!._id;

      const filters: AlertFilters = {};
      
      if (severity) {
        filters.severity = severity as string;
      }
      
      if (type) {
        filters.type = type as string;
      }
      
      if (dismissed !== undefined) {
        filters.dismissed = dismissed === 'true';
      }

      const alerts = await AlertService.getDashboardAlerts(
        workplaceId,
        assignedToMe === 'true' ? userId : undefined,
        filters
      );

      logger.info('Dashboard alerts retrieved', {
        alertCount: alerts.length,
        assignedToMe: assignedToMe === 'true',
        userId: userId.toString(),
      });

      sendSuccess(res, {
        alerts,
        summary: {
          total: alerts.length,
          bySeverity: alerts.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byType: alerts.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      });
    } catch (error) {
      logger.error('Error retrieving dashboard alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user!._id.toString(),
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve dashboard alerts', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Create custom alert
 * POST /api/alerts
 */
router.post(
  '/',
  [
    body('type').isIn(['patient', 'dashboard']).withMessage('Type must be patient or dashboard'),
    body('alertData').isObject().withMessage('Alert data is required'),
    body('alertData.type').isString().withMessage('Alert type is required'),
    body('alertData.severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    body('alertData.title').isString().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be 1-200 characters'),
    body('alertData.message').isString().isLength({ min: 1, max: 1000 }).withMessage('Message is required and must be 1-1000 characters'),
    body('alertData.patientId').optional().isMongoId().withMessage('Invalid patient ID'),
  ],
  validateRequest,
  requirePermission('create_alerts'),
  async (req: AuthRequest, res) => {
    try {
      const { type, alertData } = req.body;
      const { workplaceId } = req.user!;
      const userId = req.user!._id;

      // Validate patient alert requirements
      if (type === 'patient' && !alertData.patientId) {
        return sendError(res, 'VALIDATION_ERROR', 'Patient ID is required for patient alerts', 400);
      }

      const alert = await AlertService.createAlert(
        type,
        alertData,
        workplaceId,
        userId
      );

      logger.info('Custom alert created', {
        alertId: alert.id,
        type,
        severity: alert.severity,
        userId: userId.toString(),
      });

      res.status(201);
      sendSuccess(res, {
        alert,
        message: 'Alert created successfully',
      });
    } catch (error) {
      logger.error('Error creating alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user!._id.toString(),
      });

      sendError(res, 'SERVER_ERROR', 'Failed to create alert', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Dismiss alert
 * POST /api/alerts/:alertId/dismiss
 */
router.post(
  '/:alertId/dismiss',
  [
    param('alertId').isString().withMessage('Alert ID is required'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be 500 characters or less'),
  ],
  validateRequest,
  requirePermission('dismiss_alerts'),
  async (req: AuthRequest, res) => {
    try {
      const { alertId } = req.params;
      const { reason } = req.body;
      const userId = req.user!._id;

      const dismissed = await AlertService.dismissAlert(
        alertId,
        userId,
        reason
      );

      if (!dismissed) {
        return sendError(res, 'NOT_FOUND', 'Alert not found', 404);
      }

      logger.info('Alert dismissed', {
        alertId,
        reason,
        userId: userId.toString(),
      });

      sendSuccess(res, {
        message: 'Alert dismissed successfully',
        dismissedAt: new Date(),
      });
    } catch (error) {
      logger.error('Error dismissing alert', {
        alertId: req.params.alertId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user!._id.toString(),
      });

      sendError(res, 'SERVER_ERROR', 'Failed to dismiss alert', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Trigger clinical monitoring
 * POST /api/alerts/trigger-monitoring
 */
router.post(
  '/trigger-monitoring',
  [
    body('workplaceId').optional().isMongoId().withMessage('Invalid workplace ID'),
    body('delay').optional().isInt({ min: 0 }).withMessage('Delay must be a positive integer'),
  ],
  validateRequest,
  requirePermission('trigger_clinical_monitoring'),
  async (req: AuthRequest, res) => {
    try {
      const { workplaceId, delay } = req.body;
      const { workplaceId: userWorkplaceId } = req.user!;
      const userId = req.user!._id;

      // Use provided workplaceId or default to user's workplace
      const targetWorkplaceId = workplaceId || userWorkplaceId.toString();

      const job = await clinicalTriggerMonitorJob.triggerMonitoring(
        targetWorkplaceId,
        { delay }
      );

      logger.info('Clinical monitoring triggered', {
        jobId: job.id,
        workplaceId: targetWorkplaceId,
        delay,
        userId: userId.toString(),
      });

      sendSuccess(res, {
        message: 'Clinical monitoring triggered successfully',
        jobId: job.id,
        workplaceId: targetWorkplaceId,
        delay,
      });
    } catch (error) {
      logger.error('Error triggering clinical monitoring', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user!._id.toString(),
      });

      sendError(res, 'SERVER_ERROR', 'Failed to trigger clinical monitoring', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get alert statistics
 * GET /api/alerts/statistics
 */
router.get(
  '/statistics',
  requirePermission('view_alert_statistics'),
  async (req: AuthRequest, res) => {
    try {
      const { workplaceId } = req.user!;
      const userId = req.user!._id;

      const statistics = AlertService.getAlertStatistics(workplaceId);

      // Get queue statistics
      const queueStats = await clinicalTriggerMonitorJob.getQueueStats();

      logger.info('Alert statistics retrieved', {
        userId: userId.toString(),
      });

      sendSuccess(res, {
        alerts: statistics,
        monitoring: {
          queue: queueStats,
          lastRun: new Date(), // This would be stored in a more persistent way in production
        },
      });
    } catch (error) {
      logger.error('Error retrieving alert statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user!._id.toString(),
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve alert statistics', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get monitoring job status
 * GET /api/alerts/monitoring/status
 */
router.get(
  '/monitoring/status',
  requirePermission('view_monitoring_status'),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!._id;

      const queueStats = await clinicalTriggerMonitorJob.getQueueStats();
      const recentJobs = await clinicalTriggerMonitorJob.getRecentJobs(5);

      logger.info('Monitoring status retrieved', {
        userId: userId.toString(),
      });

      sendSuccess(res, {
        queue: queueStats,
        recentJobs: recentJobs.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
          returnvalue: job.returnvalue,
        })),
        isActive: true, // This would check if the queue is actually running
      });
    } catch (error) {
      logger.error('Error retrieving monitoring status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user!._id.toString(),
      });

      sendError(res, 'SERVER_ERROR', 'Failed to retrieve monitoring status', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;