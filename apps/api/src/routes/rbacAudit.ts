import express from 'express';
import { RBACSecurityAuditController } from '../controllers/rbacAuditController';
import { auth } from '../middlewares/auth';
import { requireDynamicPermission } from '../middlewares/rbac';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * @route GET /api/rbac-audit/dashboard
 * @desc Get RBAC audit dashboard data
 * @access Private - Requires audit.view permission
 */
router.get(
    '/dashboard',
    requireDynamicPermission('audit.view'),
    RBACSecurityAuditController.getAuditDashboard
);

/**
 * @route GET /api/rbac-audit/logs
 * @desc Get filtered RBAC audit logs
 * @access Private - Requires audit.view permission
 */
router.get(
    '/logs',
    requireDynamicPermission('audit.view'),
    RBACSecurityAuditController.getAuditLogs
);

/**
 * @route GET /api/rbac-audit/users/:userId/trail
 * @desc Get audit trail for specific user
 * @access Private - Requires audit.view permission
 */
router.get(
    '/users/:userId/trail',
    requireDynamicPermission('audit.view'),
    RBACSecurityAuditController.getUserAuditTrail
);

/**
 * @route GET /api/rbac-audit/roles/:roleId/trail
 * @desc Get audit trail for specific role
 * @access Private - Requires audit.view permission
 */
router.get(
    '/roles/:roleId/trail',
    requireDynamicPermission('audit.view'),
    RBACSecurityAuditController.getRoleAuditTrail
);

/**
 * @route GET /api/rbac-audit/export
 * @desc Export audit logs
 * @access Private - Requires audit.export permission
 */
router.get(
    '/export',
    requireDynamicPermission('audit.export'),
    RBACSecurityAuditController.exportAuditLogs
);

/**
 * @route GET /api/rbac-audit/compliance-report
 * @desc Get compliance report
 * @access Private - Requires audit.compliance permission
 */
router.get(
    '/compliance-report',
    requireDynamicPermission('audit.compliance'),
    RBACSecurityAuditController.getComplianceReport
);

/**
 * @route GET /api/rbac-audit/security-alerts
 * @desc Get security alerts
 * @access Private - Requires security.monitor permission
 */
router.get(
    '/security-alerts',
    requireDynamicPermission('security.monitor'),
    RBACSecurityAuditController.getSecurityAlerts
);

/**
 * @route PUT /api/rbac-audit/security-alerts/:alertId/resolve
 * @desc Resolve security alert
 * @access Private - Requires security.manage permission
 */
router.put(
    '/security-alerts/:alertId/resolve',
    requireDynamicPermission('security.manage'),
    RBACSecurityAuditController.resolveSecurityAlert
);

/**
 * @route GET /api/rbac-audit/statistics
 * @desc Get audit statistics
 * @access Private - Requires audit.view permission
 */
router.get(
    '/statistics',
    requireDynamicPermission('audit.view'),
    RBACSecurityAuditController.getAuditStatistics
);

export default router;