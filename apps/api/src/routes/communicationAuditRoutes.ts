import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth } from '../middlewares/auth';
import rbac from '../middlewares/rbac';
import communicationAuditController from '../controllers/communicationAuditController';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (
  req: express.Request,
  res: express.Response,
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
 * @route   GET /api/communication/audit
 * @desc    Get audit logs with filtering and pagination
 * @access  Private (Admin, Pharmacist, Doctor)
 */
router.get(
  '/',
  auth,
  rbac.requireRole('admin', 'pharmacist', 'doctor'),
  [
    query('userId').optional().isMongoId(),
    query('action').optional().isString().trim(),
    query('targetType')
      .optional()
      .isIn(['conversation', 'message', 'user', 'file', 'notification']),
    query('conversationId').optional().isMongoId(),
    query('patientId').optional().isMongoId(),
    query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('complianceCategory').optional().isString().trim(),
    query('success').optional().isBoolean(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  communicationAuditController.getAuditLogs
);

/**
 * @route   GET /api/communication/audit/empty
 * @desc    Get empty audit logs for testing
 * @access  Public (for testing)
 */
router.get('/empty', (req, res) => {
  res.json({
    success: true,
    message: 'Audit logs retrieved successfully (empty for testing)',
    data: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 50,
      pages: 0,
      hasNext: false,
      hasPrev: false,
    },
  });
});

/**
 * @route   GET /api/communication/audit/conversation/:conversationId
 * @desc    Get audit logs for a specific conversation
 * @access  Private (Admin, Pharmacist, Doctor)
 */
router.get(
  '/conversation/:conversationId',
  auth,
  rbac.requireRole('admin', 'pharmacist', 'doctor'),
  [
    param('conversationId').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  communicationAuditController.getConversationAuditLogs
);

/**
 * @route   GET /api/communication/audit/high-risk
 * @desc    Get high-risk activities
 * @access  Private (Admin, Pharmacist)
 */
router.get(
  '/high-risk',
  auth,
  rbac.requireRole('admin', 'pharmacist'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  communicationAuditController.getHighRiskActivities
);

/**
 * @route   GET /api/communication/audit/compliance-report
 * @desc    Generate compliance report
 * @access  Private (Admin, Pharmacist)
 */
router.get(
  '/compliance-report',
  auth,
  rbac.requireRole('admin', 'pharmacist'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  communicationAuditController.generateComplianceReport
);

/**
 * @route   GET /api/communication/audit/export
 * @desc    Export audit logs
 * @access  Private (Admin, Pharmacist)
 */
router.get(
  '/export',
  auth,
  rbac.requireRole('admin', 'pharmacist'),
  [
    query('format').optional().isIn(['csv', 'json']),
    query('userId').optional().isMongoId(),
    query('action').optional().isString().trim(),
    query('targetType')
      .optional()
      .isIn(['conversation', 'message', 'user', 'file', 'notification']),
    query('conversationId').optional().isMongoId(),
    query('patientId').optional().isMongoId(),
    query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('complianceCategory').optional().isString().trim(),
    query('success').optional().isBoolean(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  communicationAuditController.exportAuditLogs
);

/**
 * @route   GET /api/communication/audit/users/:userId/activity
 * @desc    Get user activity summary
 * @access  Private (Admin, Pharmacist, Doctor - own data or admin access)
 */
router.get(
  '/users/:userId/activity',
  auth,
  rbac.requireRole('admin', 'pharmacist', 'doctor'),
  [
    param('userId').isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  communicationAuditController.getUserActivitySummary
);

/**
 * @route   GET /api/communication/audit/statistics
 * @desc    Get audit statistics
 * @access  Private (Admin, Pharmacist)
 */
router.get(
  '/statistics',
  auth,
  rbac.requireRole('admin', 'pharmacist'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  communicationAuditController.getAuditStatistics
);

/**
 * @route   GET /api/communication/audit/search
 * @desc    Search audit logs
 * @access  Private (Admin, Pharmacist, Doctor)
 */
router.get(
  '/search',
  auth,
  rbac.requireRole('admin', 'pharmacist', 'doctor'),
  [
    query('q').isString().trim().isLength({ min: 2, max: 100 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  communicationAuditController.searchAuditLogs
);

/**
 * @route   GET /api/communication/audit/health
 * @desc    Health check for communication audit module
 * @access  Public (for testing)
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    module: 'communication-audit',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: {
      auditLogging: true,
      complianceReporting: true,
      riskAssessment: true,
      dataExport: true,
      realTimeMonitoring: true,
    },
  });
});

/**
 * @route   GET /api/communication/audit/test
 * @desc    Simple test endpoint
 * @access  Public (for testing)
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Audit routes are working',
    timestamp: new Date().toISOString(),
  });
});

export default router;
