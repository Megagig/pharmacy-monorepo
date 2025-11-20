import express from 'express';
import {
    getAllAuditTrail,
    getInterventionAuditTrail,
    exportAuditData,
    getComplianceReport,
    getAuditStatistics,
    cleanupAuditLogs
} from '../controllers/auditController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission } from '../middlewares/rbac';
import { generalRateLimiters } from '../middlewares/rateLimiting';
import { auditMiddleware } from '../middlewares/auditLogging';

const router = express.Router();

/**
 * @route   GET /api/audit/logs
 * @desc    Get audit logs with filtering and pagination
 * @access  Private (Super Admin or Workspace Owner only)
 */
router.get(
    '/logs',
    generalRateLimiters.api,
    authWithWorkspace,
    requirePermission('audit.view'),
    auditMiddleware({
        action: 'AUDIT_LOGS_VIEWED',
        category: 'security',
        severity: 'medium',
        resourceType: 'AuditLog',
    }),
    getAllAuditTrail
);

/**
 * @route   GET /api/audit/summary
 * @desc    Get audit statistics and summary
 * @access  Private (Super Admin or Workspace Owner only)
 */
router.get(
    '/summary',
    generalRateLimiters.api,
    authWithWorkspace,
    requirePermission('audit.view'),
    auditMiddleware({
        action: 'AUDIT_SUMMARY_VIEWED',
        category: 'security',
        severity: 'low',
        resourceType: 'AuditSummary',
    }),
    getAuditStatistics
);

/**
 * @route   GET /api/audit/security-alerts
 * @desc    Get security alerts and suspicious activities
 * @access  Private (Super Admin or Workspace Owner only)
 */
router.get(
    '/security-alerts',
    generalRateLimiters.api,
    authWithWorkspace,
    requirePermission('audit.security'),
    auditMiddleware({
        action: 'SECURITY_ALERTS_VIEWED',
        category: 'security',
        severity: 'medium',
        resourceType: 'SecurityAlert',
    }),
    getAllAuditTrail
);

/**
 * @route   GET /api/audit/export
 * @desc    Export audit logs in various formats
 * @access  Private (Super Admin or Workspace Owner only)
 */
router.get(
    '/export',
    generalRateLimiters.sensitive,
    authWithWorkspace,
    requirePermission('audit.export'),
    auditMiddleware({
        action: 'AUDIT_LOGS_EXPORTED',
        category: 'security',
        severity: 'high',
        resourceType: 'AuditExport',
        includeRequestBody: false,
        includeResponseBody: false, // Don't log the actual export data
    }),
    exportAuditData
);

export default router;