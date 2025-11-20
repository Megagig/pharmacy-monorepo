import express from 'express';
import rateLimit from 'express-rate-limit';

// Import controllers
import {
    createManualLabOrder,
    getManualLabOrder,
    getPatientLabOrders,
    updateOrderStatus,
    getManualLabOrders,
    addLabResults,
    getLabResults,
    resolveOrderToken,
    servePDFRequisition,
} from '../controllers/manualLabController';

// Import compliance controller
import {
    generateComplianceReport,
    getOrderAuditTrail,
    getComplianceViolations,
} from '../controllers/manualLabComplianceController';

// Import security controller
import {
    getSecurityDashboard,
    getSecurityThreats,
    clearUserSecurityMetrics,
    getUserSecuritySummary,
} from '../controllers/manualLabSecurityController';

// Import middleware
import { auth } from '../../../middlewares/auth';
import rbac from '../../../middlewares/rbac';
import {
    auditPDFAccess,
    auditResultEntry,
    auditStatusChange,
    auditTokenResolution,
    auditManualLabOperation,
    monitorCompliance
} from '../middlewares/manualLabAuditMiddleware';

// Import security middleware
import {
    enhancedOrderCreationRateLimit,
    enhancedPDFAccessRateLimit,
    sanitizeInput,
    validatePDFAccess,
    csrfProtection,
    generateCSRFToken,
    detectSuspiciousActivity,
    setSecurityHeaders
} from '../middlewares/manualLabSecurityMiddleware';

// Import validators
import {
    validateRequest,
    createManualLabOrderSchema,
    updateOrderStatusSchema,
    orderParamsSchema,
    patientParamsSchema,
    orderQuerySchema,
    patientOrderQuerySchema,
    addResultsSchema,
    tokenQuerySchema,
} from '../validators/manualLabValidators';

// Import error handler
import { asyncHandler } from '../../../utils/responseHelpers';

// Import feature flag middleware
import { injectFeatureFlags, requireFeatureFlag } from '../../../config/featureFlags';

const router = express.Router();

// Apply authentication, security, and compliance monitoring to all routes
router.use(auth);
router.use(injectFeatureFlags);
router.use(setSecurityHeaders);
router.use(sanitizeInput);
router.use(detectSuspiciousActivity);
router.use(generateCSRFToken);
router.use(monitorCompliance);

// Require manual lab orders feature flag for all routes
// router.use(requireFeatureFlag('manual_lab_orders')); // Temporarily disabled for debugging

// Enhanced rate limiting is now handled by security middleware

// Rate limiting for token scanning
const tokenScanLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each user to 30 token scans per minute
    message: {
        success: false,
        message: 'Too many scan attempts, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ===============================
// ORDER MANAGEMENT ROUTES
// ===============================

/**
 * POST /api/manual-lab
 * Create new lab order with PDF generation
 * Requires: pharmacist or owner role
 */
router.post(
    '/',
    enhancedOrderCreationRateLimit,
    rbac.requireRole('pharmacist', 'owner'),
    csrfProtection,
    validateRequest(createManualLabOrderSchema, 'body'),
    auditManualLabOperation('order_creation'),
    createManualLabOrder
);

/**
 * GET /api/manual-lab
 * List orders with filtering and pagination (admin/management endpoint)
 * Requires: pharmacist or owner role
 */
router.get(
    '/',
    rbac.requireRole('pharmacist', 'owner'),
    validateRequest(orderQuerySchema, 'query'),
    getManualLabOrders
);

/**
 * GET /api/manual-lab/scan
 * Resolve QR/barcode tokens to order details
 * Requires: pharmacist or owner role
 */
router.get(
    '/scan',
    // requireFeatureFlag('manual_lab_qr_scanning'), // Temporarily disabled
    tokenScanLimiter,
    rbac.requireRole('pharmacist', 'owner'),
    validateRequest(tokenQuerySchema, 'query'),
    auditTokenResolution,
    resolveOrderToken
);

/**
 * GET /api/manual-lab-orders/patient/:patientId
 * Get patient order history
 * Requires: pharmacist or owner role
 */
router.get(
    '/patient/:patientId',
    rbac.requireRole('pharmacist', 'owner'),
    validateRequest(patientParamsSchema, 'params'),
    validateRequest(patientOrderQuerySchema, 'query'),
    getPatientLabOrders
);

/**
 * GET /api/manual-lab-orders/:orderId
 * Retrieve order details
 * Requires: pharmacist or owner role
 */
router.get(
    '/:orderId',
    rbac.requireRole('pharmacist', 'owner'),
    validateRequest(orderParamsSchema, 'params'),
    getManualLabOrder
);

/**
 * PUT /api/manual-lab-orders/:orderId/status
 * Update order status
 * Requires: pharmacist or owner role
 */
router.put(
    '/:orderId/status',
    rbac.requireRole('pharmacist', 'owner'),
    csrfProtection,
    validateRequest(orderParamsSchema, 'params'),
    validateRequest(updateOrderStatusSchema, 'body'),
    auditStatusChange,
    updateOrderStatus
);

// ===============================
// RESULT MANAGEMENT ROUTES
// ===============================

/**
 * POST /api/manual-lab-orders/:orderId/results
 * Submit lab results
 * Requires: pharmacist or owner role
 */
router.post(
    '/:orderId/results',
    rbac.requireRole('pharmacist', 'owner'),
    csrfProtection,
    validateRequest(orderParamsSchema, 'params'),
    validateRequest(addResultsSchema, 'body'),
    auditResultEntry,
    addLabResults
);

/**
 * GET /api/manual-lab-orders/:orderId/results
 * Retrieve entered results
 * Requires: pharmacist or owner role
 */
router.get(
    '/:orderId/results',
    rbac.requireRole('pharmacist', 'owner'),
    validateRequest(orderParamsSchema, 'params'),
    getLabResults
);

// ===============================
// PDF AND SCANNING ROUTES
// ===============================

/**
 * GET /api/manual-lab/:orderId/pdf
 * Serve generated PDF requisition
 * Requires: pharmacist or owner role
 */
router.get(
    '/:orderId/pdf',
    requireFeatureFlag('manual_lab_pdf_generation'),
    enhancedPDFAccessRateLimit,
    rbac.requireRole('pharmacist', 'owner'),
    validateRequest(orderParamsSchema, 'params'),
    validatePDFAccess,
    auditPDFAccess,
    servePDFRequisition
);

// ===============================
// COMPLIANCE AND AUDIT ROUTES
// ===============================

/**
 * GET /api/manual-lab-orders/compliance/report
 * Generate compliance report
 * Requires: pharmacist or owner role
 */
router.get(
    '/compliance/report',
    rbac.requireRole('pharmacist', 'owner'),
    generateComplianceReport
);

/**
 * GET /api/manual-lab-orders/compliance/audit-trail/:orderId
 * Get detailed audit trail for specific order
 * Requires: pharmacist or owner role
 */
router.get(
    '/compliance/audit-trail/:orderId',
    rbac.requireRole('pharmacist', 'owner'),
    validateRequest(orderParamsSchema, 'params'),
    getOrderAuditTrail
);

/**
 * GET /api/manual-lab-orders/compliance/violations
 * Get compliance violations and security incidents
 * Requires: pharmacist or owner role
 */
router.get(
    '/compliance/violations',
    rbac.requireRole('pharmacist', 'owner'),
    getComplianceViolations
);

// ===============================
// SECURITY MONITORING ROUTES
// ===============================

/**
 * GET /api/manual-lab-orders/security/dashboard
 * Get security dashboard with metrics and threats
 * Requires: pharmacist or owner role
 */
router.get(
    '/security/dashboard',
    rbac.requireRole('pharmacist', 'owner'),
    getSecurityDashboard
);

/**
 * GET /api/manual-lab-orders/security/threats
 * Get detailed threat information with filtering
 * Requires: pharmacist or owner role
 */
router.get(
    '/security/threats',
    rbac.requireRole('pharmacist', 'owner'),
    getSecurityThreats
);

/**
 * GET /api/manual-lab-orders/security/user-summary/:userId
 * Get security summary for a specific user
 * Requires: pharmacist or owner role
 */
router.get(
    '/security/user-summary/:userId',
    rbac.requireRole('pharmacist', 'owner'),
    getUserSecuritySummary
);

/**
 * POST /api/manual-lab-orders/security/clear-user-metrics/:userId
 * Clear security metrics for a specific user (owner only)
 * Requires: owner role
 */
router.post(
    '/security/clear-user-metrics/:userId',
    rbac.requireRole('owner'),
    csrfProtection,
    clearUserSecurityMetrics
);

// ===============================
// ERROR HANDLING
// ===============================

// Manual lab specific error handler
router.use((error: any, req: any, res: any, next: any) => {
    // Log the error
    console.error('Manual Lab API Error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        userId: req.user?._id,
        workplaceId: req.user?.workplaceId,
    });

    // Handle specific manual lab errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.message,
        });
    }

    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            code: 'INVALID_ID',
        });
    }

    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate entry detected',
            code: 'DUPLICATE_ERROR',
        });
    }

    // Default error response
    res.status(500).json({
        success: false,
        message: 'Internal server error in manual lab module',
        code: 'INTERNAL_ERROR',
    });
});

export default router;