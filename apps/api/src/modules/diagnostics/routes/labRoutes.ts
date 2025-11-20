import express from 'express';
import {
    createLabOrder,
    getLabOrders,
    getLabOrder,
    updateLabOrder,
    cancelLabOrder,
    addLabResult,
    getLabResults,
    getLabResult,
    updateLabResult,
    deleteLabResult,
    getLabResultTrends,
    getLabDashboard,
    importFHIRResults,
    exportLabOrderToFHIR,
    syncLabResultsFromFHIR,
    testFHIRConnection,
} from '../controllers/labController';

import {
    getFHIRConfigs,
    getFHIRConfig,
    testFHIRConfig,
    getDefaultFHIRConfigs,
    getFHIRCapabilities,
    getFHIRStatus,
} from '../controllers/fhirConfigController';

// Import middleware
import { auth } from '../../../middlewares/auth';
import { authWithWorkspace } from '../../../middlewares/authWithWorkspace';
import {
    requirePharmacistRole,
    requireLabIntegrationFeature,
    requireDiagnosticRead,
    requireDiagnosticCreate,
    checkDiagnosticAccess,
} from '../middlewares/diagnosticRBAC';
import { requirePermission, requireActiveSubscription } from '../../../middlewares/rbac';

// Import validators
import {
    validateRequest,
    createLabOrderSchema,
    updateLabOrderSchema,
    labOrderParamsSchema,
    labOrderQuerySchema,
    createLabResultSchema,
    updateLabResultSchema,
    labResultParamsSchema,
    labResultQuerySchema,
    labTrendsParamsSchema,
    labTrendsQuerySchema,
    importFHIRSchema,
} from '../validators/labValidators';

const router = express.Router();

// Apply authentication and workspace context to all routes
router.use(auth);
router.use(authWithWorkspace);

// ===============================
// LAB ORDER ROUTES
// ===============================

/**
 * POST /api/lab/orders
 * Create new lab order
 */
router.post(
    '/orders',
    requireActiveSubscription,
    requireLabIntegrationFeature,
    requirePharmacistRole,
    requirePermission('lab:create_order'),
    validateRequest(createLabOrderSchema, 'body'),
    createLabOrder
);

/**
 * GET /api/lab/orders
 * Get lab orders with filtering and pagination
 */
router.get(
    '/orders',
    requirePharmacistRole,
    requirePermission('lab:read'),
    validateRequest(labOrderQuerySchema, 'query'),
    getLabOrders
);

/**
 * GET /api/lab/orders/:id
 * Get lab order details
 */
router.get(
    '/orders/:id',
    requirePharmacistRole,
    requirePermission('lab:read'),
    validateRequest(labOrderParamsSchema, 'params'),
    getLabOrder
);

/**
 * PATCH /api/lab/orders/:id
 * Update lab order
 */
router.patch(
    '/orders/:id',
    requirePharmacistRole,
    requirePermission('lab:update_order'),
    validateRequest(labOrderParamsSchema, 'params'),
    validateRequest(updateLabOrderSchema, 'body'),
    updateLabOrder
);

/**
 * DELETE /api/lab/orders/:id
 * Cancel lab order
 */
router.delete(
    '/orders/:id',
    requirePharmacistRole,
    requirePermission('lab:cancel_order'),
    validateRequest(labOrderParamsSchema, 'params'),
    cancelLabOrder
);

// ===============================
// LAB RESULT ROUTES
// ===============================

/**
 * POST /api/lab/results
 * Add lab result
 */
router.post(
    '/results',
    requireActiveSubscription,
    requireLabIntegrationFeature,
    requirePharmacistRole,
    requirePermission('lab:add_result'),
    validateRequest(createLabResultSchema, 'body'),
    addLabResult
);

/**
 * GET /api/lab/results
 * Get lab results with filtering and pagination
 */
router.get(
    '/results',
    requirePharmacistRole,
    requirePermission('lab:read'),
    validateRequest(labResultQuerySchema, 'query'),
    getLabResults
);

/**
 * GET /api/lab/results/:id
 * Get lab result details
 */
router.get(
    '/results/:id',
    requirePharmacistRole,
    requirePermission('lab:read'),
    validateRequest(labResultParamsSchema, 'params'),
    getLabResult
);

/**
 * PATCH /api/lab/results/:id
 * Update lab result
 */
router.patch(
    '/results/:id',
    requirePharmacistRole,
    requirePermission('lab:update_result'),
    validateRequest(labResultParamsSchema, 'params'),
    validateRequest(updateLabResultSchema, 'body'),
    updateLabResult
);

/**
 * DELETE /api/lab/results/:id
 * Delete lab result
 */
router.delete(
    '/results/:id',
    requirePharmacistRole,
    requirePermission('lab:delete_result'),
    validateRequest(labResultParamsSchema, 'params'),
    deleteLabResult
);

// ===============================
// LAB ANALYTICS AND TRENDS ROUTES
// ===============================

/**
 * GET /api/lab/trends/:patientId/:testCode
 * Get lab result trends for a patient and test
 */
router.get(
    '/trends/:patientId/:testCode',
    requirePharmacistRole,
    requirePermission('lab:read'),
    validateRequest(labTrendsParamsSchema, 'params'),
    validateRequest(labTrendsQuerySchema, 'query'),
    getLabResultTrends
);

/**
 * GET /api/lab/dashboard
 * Get lab dashboard data
 */
router.get(
    '/dashboard',
    requirePharmacistRole,
    requirePermission('lab:read'),
    getLabDashboard
);

// ===============================
// FHIR INTEGRATION ROUTES
// ===============================

/**
 * POST /api/lab/import/fhir
 * Import lab results from FHIR bundle
 */
router.post(
    '/import/fhir',
    requireActiveSubscription,
    requireLabIntegrationFeature,
    requirePharmacistRole,
    requirePermission('lab:import_fhir'),
    validateRequest(importFHIRSchema, 'body'),
    importFHIRResults
);

/**
 * POST /api/lab/export/fhir/:orderId
 * Export lab order to FHIR format
 */
router.post(
    '/export/fhir/:orderId',
    requireActiveSubscription,
    requireLabIntegrationFeature,
    requirePharmacistRole,
    requirePermission('lab:export_fhir'),
    validateRequest(labOrderParamsSchema, 'params'),
    exportLabOrderToFHIR
);

/**
 * POST /api/lab/sync/fhir/:patientId
 * Sync lab results from external FHIR server
 */
router.post(
    '/sync/fhir/:patientId',
    requireActiveSubscription,
    requireLabIntegrationFeature,
    requirePharmacistRole,
    requirePermission('lab:sync_fhir'),
    syncLabResultsFromFHIR
);

/**
 * GET /api/lab/fhir/test-connection
 * Test FHIR server connection
 */
router.get(
    '/fhir/test-connection',
    requirePharmacistRole,
    requirePermission('lab:test_fhir'),
    testFHIRConnection
);

// ===============================
// FHIR CONFIGURATION ROUTES
// ===============================

/**
 * GET /api/lab/fhir/config
 * Get all FHIR server configurations
 */
router.get(
    '/fhir/config',
    requirePharmacistRole,
    requirePermission('lab:read_fhir_config'),
    getFHIRConfigs
);

/**
 * GET /api/lab/fhir/config/defaults
 * Get default FHIR server configurations
 */
router.get(
    '/fhir/config/defaults',
    requirePharmacistRole,
    requirePermission('lab:read_fhir_config'),
    getDefaultFHIRConfigs
);

/**
 * GET /api/lab/fhir/config/:id
 * Get specific FHIR server configuration
 */
router.get(
    '/fhir/config/:id',
    requirePharmacistRole,
    requirePermission('lab:read_fhir_config'),
    getFHIRConfig
);

/**
 * POST /api/lab/fhir/config/test
 * Test FHIR server configuration
 */
router.post(
    '/fhir/config/test',
    requirePharmacistRole,
    requirePermission('lab:test_fhir_config'),
    testFHIRConfig
);

/**
 * GET /api/lab/fhir/capabilities
 * Get FHIR server capabilities
 */
router.get(
    '/fhir/capabilities',
    requirePharmacistRole,
    requirePermission('lab:read_fhir_config'),
    getFHIRCapabilities
);

/**
 * GET /api/lab/fhir/status
 * Get FHIR integration status
 */
router.get(
    '/fhir/status',
    requirePharmacistRole,
    requirePermission('lab:read_fhir_config'),
    getFHIRStatus
);

// ===============================
// ERROR HANDLING MIDDLEWARE
// ===============================

/**
 * Lab-specific error handler
 */
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Log the error
    console.error('Lab API Error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
    });

    // Handle specific lab errors
    if (error.message.includes('lab order')) {
        return res.status(400).json({
            success: false,
            message: 'Lab order operation failed',
            code: 'LAB_ORDER_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('lab result')) {
        return res.status(400).json({
            success: false,
            message: 'Lab result operation failed',
            code: 'LAB_RESULT_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('FHIR')) {
        return res.status(400).json({
            success: false,
            message: 'FHIR import operation failed',
            code: 'FHIR_IMPORT_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('reference range')) {
        return res.status(422).json({
            success: false,
            message: 'Invalid reference range',
            code: 'REFERENCE_RANGE_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('LOINC')) {
        return res.status(422).json({
            success: false,
            message: 'Invalid LOINC code',
            code: 'LOINC_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('test code')) {
        return res.status(422).json({
            success: false,
            message: 'Invalid test code',
            code: 'TEST_CODE_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('interpretation')) {
        return res.status(422).json({
            success: false,
            message: 'Invalid result interpretation',
            code: 'INTERPRETATION_ERROR',
            details: error.message,
        });
    }

    // Handle external lab system errors
    if (error.message.includes('external lab')) {
        return res.status(502).json({
            success: false,
            message: 'External lab system error',
            code: 'EXTERNAL_LAB_ERROR',
            details: 'Unable to connect to external lab system. Please try again later.',
        });
    }

    // Handle FHIR parsing errors
    if (error.message.includes('FHIR bundle')) {
        return res.status(422).json({
            success: false,
            message: 'Invalid FHIR bundle format',
            code: 'FHIR_BUNDLE_ERROR',
            details: error.message,
        });
    }

    // Handle patient mapping errors
    if (error.message.includes('patient mapping')) {
        return res.status(422).json({
            success: false,
            message: 'Invalid patient mapping',
            code: 'PATIENT_MAPPING_ERROR',
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

    // Handle file size errors (for FHIR imports)
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'File too large',
            code: 'FILE_SIZE_ERROR',
            details: 'FHIR bundle file exceeds maximum allowed size',
        });
    }

    // Handle timeout errors
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        return res.status(504).json({
            success: false,
            message: 'Operation timeout',
            code: 'TIMEOUT_ERROR',
            details: 'The operation took too long to complete. Please try again.',
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