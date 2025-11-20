import express from 'express';
import {
    createDiagnosticRequest,
    getDiagnosticRequest,
    retryDiagnosticRequest,
    cancelDiagnosticRequest,
    getPatientDiagnosticHistory,
    getDiagnosticDashboard,
    approveDiagnosticResult,
    rejectDiagnosticResult,
    getPendingReviews,
    createInterventionFromResult,
    getReviewWorkflowStatus,
    getDiagnosticAnalytics,
    getAllDiagnosticCases,
    getDiagnosticReferrals,
    validatePatientAccess,
} from '../controllers/diagnosticController';

// Import middleware
import { auth } from '../../../middlewares/auth';
import { authWithWorkspace } from '../../../middlewares/authWithWorkspace';
import {
    diagnosticCreateMiddleware,
    diagnosticProcessMiddleware,
    diagnosticReviewMiddleware,
    diagnosticApproveMiddleware,
    diagnosticAnalyticsMiddleware,
    requireDiagnosticRead,
    requireDiagnosticRetry,
    requireDiagnosticCancel,
    requireDiagnosticIntervention,
    requirePharmacistRole,
    checkDiagnosticAccess,
    checkDiagnosticResultAccess,
} from '../middlewares/diagnosticRBAC';

// Import validators
import {
    validateRequest,
    createDiagnosticRequestSchema,
    diagnosticParamsSchema,
    patientHistoryParamsSchema,
    diagnosticQuerySchema,
    approveResultSchema,
    rejectResultSchema,
    pendingReviewsQuerySchema,
    createInterventionSchema,
    analyticsQuerySchema,
} from '../validators/diagnosticValidators';

const router = express.Router();

// Apply authentication and workspace context to all routes
router.use(auth);
router.use(authWithWorkspace);

// ===============================
// DIAGNOSTIC REQUEST ROUTES
// ===============================

/**
 * POST /api/diagnostics/patient/validate
 * Validate patient access before creating diagnostic case
 */
router.post(
    '/patient/validate',
    requirePharmacistRole,
    requireDiagnosticRead,
    validatePatientAccess
);

/**
 * POST /api/diagnostics
 * Create new diagnostic request
 */
router.post(
    '/',
    ...diagnosticCreateMiddleware,
    validateRequest(createDiagnosticRequestSchema, 'body'),
    createDiagnosticRequest
);

/**
 * GET /api/diagnostics/dashboard
 * Get diagnostic dashboard data
 */
router.get(
    '/dashboard',
    requirePharmacistRole,
    requireDiagnosticRead,
    getDiagnosticDashboard
);

/**
 * GET /api/diagnostics/pending-reviews
 * Get pending diagnostic results for review
 */
router.get(
    '/pending-reviews',
    ...diagnosticReviewMiddleware,
    validateRequest(pendingReviewsQuerySchema, 'query'),
    getPendingReviews
);

/**
 * GET /api/diagnostics/review-workflow-status
 * Get review workflow status for workplace
 */
router.get(
    '/review-workflow-status',
    ...diagnosticReviewMiddleware,
    getReviewWorkflowStatus
);

/**
 * GET /api/diagnostics/analytics
 * Get diagnostic analytics for workplace
 */
router.get(
    '/analytics',
    ...diagnosticAnalyticsMiddleware,
    validateRequest(analyticsQuerySchema, 'query'),
    getDiagnosticAnalytics
);

/**
 * GET /api/diagnostics/cases/all
 * Get all diagnostic cases with pagination
 */
router.get(
    '/cases/all',
    requirePharmacistRole,
    requireDiagnosticRead,
    getAllDiagnosticCases
);

/**
 * GET /api/diagnostics/referrals
 * Get all diagnostic referrals with pagination
 */
router.get(
    '/referrals',
    requirePharmacistRole,
    requireDiagnosticRead,
    getDiagnosticReferrals
);

/**
 * GET /api/diagnostics/history/:patientId
 * Get patient diagnostic history with pagination
 */
router.get(
    '/history/:patientId',
    requirePharmacistRole,
    requireDiagnosticRead,
    validateRequest(patientHistoryParamsSchema, 'params'),
    validateRequest(diagnosticQuerySchema, 'query'),
    getPatientDiagnosticHistory
);

/**
 * GET /api/diagnostics/:id
 * Get diagnostic request and result with polling support
 */
router.get(
    '/:id',
    requirePharmacistRole,
    requireDiagnosticRead,
    validateRequest(diagnosticParamsSchema, 'params'),
    checkDiagnosticAccess,
    getDiagnosticRequest
);

/**
 * POST /api/diagnostics/:id/retry
 * Retry failed diagnostic request
 */
router.post(
    '/:id/retry',
    ...diagnosticProcessMiddleware,
    requireDiagnosticRetry,
    validateRequest(diagnosticParamsSchema, 'params'),
    retryDiagnosticRequest
);

/**
 * DELETE /api/diagnostics/:id
 * Cancel diagnostic request
 */
router.delete(
    '/:id',
    requirePharmacistRole,
    requireDiagnosticCancel,
    validateRequest(diagnosticParamsSchema, 'params'),
    checkDiagnosticAccess,
    cancelDiagnosticRequest
);

// ===============================
// DIAGNOSTIC RESULT REVIEW ROUTES
// ===============================

/**
 * POST /api/diagnostics/:id/approve
 * Approve diagnostic result
 */
router.post(
    '/:id/approve',
    ...diagnosticApproveMiddleware,
    validateRequest(diagnosticParamsSchema, 'params'),
    validateRequest(approveResultSchema, 'body'),
    approveDiagnosticResult
);

/**
 * POST /api/diagnostics/:id/reject
 * Reject diagnostic result
 */
router.post(
    '/:id/reject',
    ...diagnosticApproveMiddleware,
    validateRequest(diagnosticParamsSchema, 'params'),
    validateRequest(rejectResultSchema, 'body'),
    rejectDiagnosticResult
);

/**
 * POST /api/diagnostics/:id/create-intervention
 * Create clinical intervention from approved diagnostic result
 */
router.post(
    '/:id/create-intervention',
    requirePharmacistRole,
    requireDiagnosticIntervention,
    validateRequest(diagnosticParamsSchema, 'params'),
    validateRequest(createInterventionSchema, 'body'),
    checkDiagnosticResultAccess,
    createInterventionFromResult
);

// ===============================
// ERROR HANDLING MIDDLEWARE
// ===============================

/**
 * Diagnostic-specific error handler
 */
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Log the error
    console.error('Diagnostic API Error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
    });

    // Handle specific diagnostic errors
    if (error.message.includes('consent')) {
        return res.status(400).json({
            success: false,
            message: 'Patient consent validation failed',
            code: 'CONSENT_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('AI service')) {
        return res.status(502).json({
            success: false,
            message: 'AI service temporarily unavailable',
            code: 'AI_SERVICE_ERROR',
            details: 'Please try again later or contact support if the issue persists',
        });
    }

    if (error.message.includes('processing timeout')) {
        return res.status(504).json({
            success: false,
            message: 'Diagnostic processing timeout',
            code: 'PROCESSING_TIMEOUT',
            details: 'The diagnostic analysis is taking longer than expected. You can retry the request.',
        });
    }

    if (error.message.includes('retry')) {
        return res.status(400).json({
            success: false,
            message: 'Retry operation failed',
            code: 'RETRY_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('review')) {
        return res.status(400).json({
            success: false,
            message: 'Review operation failed',
            code: 'REVIEW_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('intervention')) {
        return res.status(400).json({
            success: false,
            message: 'Intervention creation failed',
            code: 'INTERVENTION_ERROR',
            details: error.message,
        });
    }

    // Handle MongoDB/Mongoose errors
    if (error.name === 'ValidationError') {
        return res.status(422).json({
            success: false,
            message: 'Data validation failed',
            code: 'VALIDATION_ERROR',
            details: Object.values(error.errors).map((err: any) => err.message),
        });
    }

    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            code: 'INVALID_ID',
            details: 'The provided ID is not in the correct format',
        });
    }

    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate resource',
            code: 'DUPLICATE_ERROR',
            details: 'A resource with this identifier already exists',
        });
    }

    // Handle rate limiting errors
    if (error.status === 429) {
        return res.status(429).json({
            success: false,
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT_ERROR',
            details: 'Too many requests. Please try again later.',
        });
    }

    // Handle subscription/plan errors
    if (error.status === 402) {
        return res.status(402).json({
            success: false,
            message: 'Subscription required',
            code: 'SUBSCRIPTION_ERROR',
            details: error.message,
            upgradeRequired: true,
        });
    }

    // Default error response
    return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            details: error,
        }),
    });
});

export default router;