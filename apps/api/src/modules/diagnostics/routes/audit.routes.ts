/**
 * Audit Routes
 * Routes for audit logging, compliance reporting, and security monitoring
 */

import { Router } from 'express';
import auditController from '../controllers/auditController';
import { auth } from '../../../middlewares/auth';
import diagnosticRBAC from '../middlewares/diagnosticRBAC';
import rateLimiting from '../../../middlewares/rateLimiting';

const router = Router();

// Apply authentication and RBAC to all routes
router.use(auth);

// Apply rate limiting for audit endpoints
router.use(rateLimiting.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for audit operations
    message: 'Too many audit requests, please try again later'
}));

/**
 * @route GET /api/diagnostics/audit/events
 * @desc Search audit events
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for search (ISO string)
 * @query endDate - End date for search (ISO string)
 * @query eventTypes - Comma-separated list of event types
 * @query entityTypes - Comma-separated list of entity types
 * @query userIds - Comma-separated list of user IDs
 * @query patientIds - Comma-separated list of patient IDs
 * @query severity - Comma-separated list of severity levels
 * @query entityId - Specific entity ID
 * @query searchText - Text search in event details
 * @query limit - Number of results to return (default: 50)
 * @query offset - Number of results to skip (default: 0)
 */
router.get('/events',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.searchAuditEvents
);

/**
 * @route GET /api/diagnostics/audit/trail/:entityType/:entityId
 * @desc Get audit trail for specific entity
 * @access Private (requires diagnostic:analytics permission)
 * @param entityType - Type of entity (diagnostic_request, diagnostic_result, etc.)
 * @param entityId - ID of the entity
 */
router.get('/trail/:entityType/:entityId',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.getEntityAuditTrail
);

/**
 * @route GET /api/diagnostics/audit/statistics
 * @desc Get audit statistics and summary
 * @access Private (requires diagnostic:analytics permission)
 * @query period - Time period (7d, 30d, 90d)
 */
router.get('/statistics',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.getAuditStatistics
);

/**
 * @route GET /api/diagnostics/audit/compliance/report
 * @desc Generate compliance report
 * @access Private (requires diagnostic:analytics permission)
 * @query reportType - Type of report (hipaa, gdpr, audit_trail, data_access, ai_usage)
 * @query startDate - Start date for report (ISO string)
 * @query endDate - End date for report (ISO string)
 */
router.get('/compliance/report',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.generateComplianceReport
);

/**
 * @route POST /api/diagnostics/audit/security/violation
 * @desc Log security violation
 * @access Private (requires diagnostic:analytics permission)
 * @body violationType - Type of security violation
 * @body details - Additional details about the violation
 */
router.post('/security/violation',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.logSecurityViolation
);

/**
 * @route POST /api/diagnostics/audit/archive
 * @desc Archive old audit records
 * @access Private (requires diagnostic:analytics permission)
 * @body retentionDays - Number of days to retain records
 */
router.post('/archive',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.archiveAuditRecords
);

/**
 * @route GET /api/diagnostics/audit/export
 * @desc Export audit data
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for export (ISO string)
 * @query endDate - End date for export (ISO string)
 * @query format - Export format (json, csv)
 */
router.get('/export',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.exportAuditData
);

/**
 * @route GET /api/diagnostics/audit/regulatory/report
 * @desc Generate regulatory compliance report
 * @access Private (requires diagnostic:analytics permission)
 * @query reportType - Type of regulatory report (hipaa, gdpr, fda_21cfr11, sox, pci_dss)
 * @query startDate - Start date for report (ISO string)
 * @query endDate - End date for report (ISO string)
 */
router.get('/regulatory/report',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.generateRegulatoryReport
);

/**
 * @route GET /api/diagnostics/audit/anomalies
 * @desc Detect audit anomalies
 * @access Private (requires diagnostic:analytics permission)
 * @query lookbackDays - Number of days to look back for anomaly detection (default: 30)
 */
router.get('/anomalies',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.detectAuditAnomalies
);

/**
 * @route GET /api/diagnostics/audit/visualization
 * @desc Get audit visualization data
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for visualization (ISO string)
 * @query endDate - End date for visualization (ISO string)
 */
router.get('/visualization',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.getAuditVisualization
);

/**
 * @route GET /api/diagnostics/audit/search/advanced
 * @desc Advanced audit search with filters
 * @access Private (requires diagnostic:analytics permission)
 * @query Multiple filter parameters (see controller for details)
 */
router.get('/search/advanced',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.advancedAuditSearch
);

/**
 * @route GET /api/diagnostics/audit/visualization/export
 * @desc Export audit visualization data
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for export (ISO string)
 * @query endDate - End date for export (ISO string)
 * @query format - Export format (json, csv, pdf)
 */
router.get('/visualization/export',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.exportAuditVisualization
);

/**
 * @route GET /api/diagnostics/audit/retention/policies
 * @desc Get data retention policies
 * @access Private (requires diagnostic:analytics permission)
 */
router.get('/retention/policies',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.getDataRetentionPolicies
);

/**
 * @route PUT /api/diagnostics/audit/retention/policies/:recordType
 * @desc Update data retention policy
 * @access Private (requires diagnostic:analytics permission)
 * @param recordType - Type of record to update policy for
 * @body Policy update data
 */
router.put('/retention/policies/:recordType',
    diagnosticRBAC.requireDiagnosticAnalytics,
    auditController.updateDataRetentionPolicy
);

export default router;