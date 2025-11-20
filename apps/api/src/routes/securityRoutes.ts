import express from 'express';
import { securityController } from '../controllers/securityController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission } from '../middlewares/rbac';
import { generalRateLimiters } from '../middlewares/rateLimiting';
import { auditMiddleware } from '../middlewares/auditLogging';
import { monitorSecurityEvents } from '../middlewares/securityMonitoring';

const router = express.Router();

/**
 * @route   GET /api/security/threats
 * @desc    Get security threats with filtering and pagination
 * @access  Private (Super Admin or Workspace Owner only)
 */
router.get(
    '/threats',
    generalRateLimiters.api,
    authWithWorkspace,
    requirePermission('audit.security'),
    auditMiddleware({
        action: 'SECURITY_THREATS_VIEWED',
        category: 'security',
        severity: 'medium',
        resourceType: 'SecurityThreat',
    }),
    monitorSecurityEvents('security_data_access'),
    securityController.getSecurityThreats.bind(securityController)
);

/**
 * @route   GET /api/security/dashboard
 * @desc    Get security dashboard data and statistics
 * @access  Private (Super Admin or Workspace Owner only)
 */
router.get(
    '/dashboard',
    generalRateLimiters.api,
    authWithWorkspace,
    requirePermission('audit.security'),
    auditMiddleware({
        action: 'SECURITY_DASHBOARD_VIEWED',
        category: 'security',
        severity: 'low',
        resourceType: 'SecurityDashboard',
    }),
    monitorSecurityEvents('security_data_access'),
    securityController.getSecurityDashboard.bind(securityController)
);

/**
 * @route   POST /api/security/threats/:threatId/resolve
 * @desc    Resolve a security threat
 * @access  Private (Super Admin only)
 */
router.post(
    '/threats/:threatId/resolve',
    generalRateLimiters.sensitive,
    authWithWorkspace,
    requirePermission('admin.system_settings'),
    auditMiddleware({
        action: 'SECURITY_THREAT_RESOLVED',
        category: 'security',
        severity: 'high',
        resourceType: 'SecurityThreat',
        includeRequestBody: true,
    }),
    monitorSecurityEvents('threat_resolution'),
    securityController.resolveThreat.bind(securityController)
);

/**
 * @route   GET /api/security/users/:userId/status
 * @desc    Get user security status and risk assessment
 * @access  Private (User can view own status, Super Admin can view any)
 */
router.get(
    '/users/:userId/status',
    generalRateLimiters.api,
    authWithWorkspace,
    auditMiddleware({
        action: 'USER_SECURITY_STATUS_VIEWED',
        category: 'security',
        severity: 'low',
        resourceType: 'UserSecurityStatus',
    }),
    monitorSecurityEvents('security_data_access'),
    securityController.getUserSecurityStatus.bind(securityController)
);

/**
 * @route   GET /api/security/blocked-ips
 * @desc    Get list of blocked IP addresses
 * @access  Private (Super Admin only)
 */
router.get(
    '/blocked-ips',
    generalRateLimiters.api,
    authWithWorkspace,
    requirePermission('admin.system_settings'),
    auditMiddleware({
        action: 'BLOCKED_IPS_VIEWED',
        category: 'security',
        severity: 'medium',
        resourceType: 'BlockedIP',
    }),
    monitorSecurityEvents('security_data_access'),
    securityController.getBlockedIPs.bind(securityController)
);

export default router;