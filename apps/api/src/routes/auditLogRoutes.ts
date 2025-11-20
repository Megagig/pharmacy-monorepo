import express, { Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { auth, AuthRequest } from '../middlewares/auth';
import { chatAuditService } from '../services/chat';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Validation middleware
 */
const handleValidationErrors = (
  req: express.Request,
  res: Response,
  next: express.NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array(),
    });
    return;
  }
  next();
};

/**
 * @route   GET /api/chat/audit/logs
 * @desc    Get audit logs with filtering - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/logs',
  auth,
  [
    query('userId').optional().isMongoId(),
    query('action').optional().isString(),
    query('targetType').optional().isIn(['conversation', 'message', 'user', 'file', 'notification']),
    query('conversationId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('complianceCategory').optional().isString(),
    query('success').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const filters = {
        userId: req.query.userId as string,
        action: req.query.action as string,
        targetType: req.query.targetType as any,
        conversationId: req.query.conversationId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        riskLevel: req.query.riskLevel as any,
        complianceCategory: req.query.complianceCategory as string,
        success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const logs = await chatAuditService.getAuditLogs(workplaceId, filters);

      res.json({
        success: true,
        data: logs,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: logs.length,
        },
      });
    } catch (error) {
      logger.error('Error getting audit logs', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get audit logs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/audit/logs/export
 * @desc    Export audit logs to CSV - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/logs/export',
  auth,
  [
    query('userId').optional().isMongoId(),
    query('action').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const filters = {
        userId: req.query.userId as string,
        action: req.query.action as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        riskLevel: req.query.riskLevel as any,
      };

      const csvContent = await chatAuditService.exportAuditLogs(workplaceId, filters);

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(csvContent);
    } catch (error) {
      logger.error('Error exporting audit logs', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to export audit logs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/audit/conversations/:id/logs
 * @desc    Get audit logs for a specific conversation - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/conversations/:id/logs',
  auth,
  [
    param('id').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const options = {
        limit: parseInt(req.query.limit as string) || 100,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };

      const logs = await chatAuditService.getConversationAuditLogs(conversationId, workplaceId, options);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error('Error getting conversation audit logs', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get conversation audit logs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/audit/high-risk
 * @desc    Get high-risk activities - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/high-risk',
  auth,
  [
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const timeRange = {
        start: new Date(req.query.startDate as string),
        end: new Date(req.query.endDate as string),
      };

      const activities = await chatAuditService.getHighRiskActivities(workplaceId, timeRange);

      res.json({
        success: true,
        data: activities,
      });
    } catch (error) {
      logger.error('Error getting high-risk activities', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get high-risk activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/audit/compliance-report
 * @desc    Get HIPAA compliance report - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/compliance-report',
  auth,
  [
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const dateRange = {
        start: new Date(req.query.startDate as string),
        end: new Date(req.query.endDate as string),
      };

      const report = await chatAuditService.getComplianceReport(workplaceId, dateRange);

      res.json({
        success: true,
        data: report,
        metadata: {
          startDate: dateRange.start,
          endDate: dateRange.end,
          generatedAt: new Date(),
          hipaaCompliant: true,
          retentionPeriod: '7 years',
        },
      });
    } catch (error) {
      logger.error('Error getting compliance report', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get compliance report',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/audit/users/:id/activity
 * @desc    Get user activity summary - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/users/:id/activity',
  auth,
  [
    param('id').isMongoId(),
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const dateRange = {
        start: new Date(req.query.startDate as string),
        end: new Date(req.query.endDate as string),
      };

      const summary = await chatAuditService.getUserActivitySummary(userId, workplaceId, dateRange);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error getting user activity summary', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get user activity summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
