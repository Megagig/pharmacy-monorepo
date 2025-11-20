import express from 'express';
import {
    checkDrugInteractions,
    getDrugInformation,
    checkAllergyInteractions,
    checkContraindications,
    searchDrugs,
} from '../controllers/drugInteractionController';

// Import middleware
import { auth } from '../../../middlewares/auth';
import { authWithWorkspace } from '../../../middlewares/authWithWorkspace';
import {
    requirePharmacistRole,
    requireDrugInteractionFeature,
} from '../middlewares/diagnosticRBAC';
import { requirePermission, requireActiveSubscription } from '../../../middlewares/rbac';

// Import validators
import {
    validateRequest,
    checkInteractionsSchema,
    drugInfoSchema,
    allergyCheckSchema,
    contraindicationCheckSchema,
    drugSearchQuerySchema,
} from '../validators/drugInteractionValidators';

const router = express.Router();

// Apply authentication and workspace context to all routes
router.use(auth);
router.use(authWithWorkspace);

// ===============================
// DRUG INTERACTION ROUTES
// ===============================

/**
 * POST /api/interactions/check
 * Check drug interactions for a list of medications
 */
router.post(
    '/check',
    requireActiveSubscription,
    requireDrugInteractionFeature,
    requirePharmacistRole,
    requirePermission('drug_interactions:check'),
    validateRequest(checkInteractionsSchema, 'body'),
    checkDrugInteractions
);

/**
 * POST /api/interactions/drug-info
 * Get detailed drug information
 */
router.post(
    '/drug-info',
    requireActiveSubscription,
    requireDrugInteractionFeature,
    requirePharmacistRole,
    requirePermission('drug_interactions:lookup'),
    validateRequest(drugInfoSchema, 'body'),
    getDrugInformation
);

/**
 * POST /api/interactions/allergy-check
 * Check for drug-allergy interactions
 */
router.post(
    '/allergy-check',
    requireActiveSubscription,
    requireDrugInteractionFeature,
    requirePharmacistRole,
    requirePermission('drug_interactions:allergy_check'),
    validateRequest(allergyCheckSchema, 'body'),
    checkAllergyInteractions
);

/**
 * POST /api/interactions/contraindications
 * Check for drug contraindications
 */
router.post(
    '/contraindications',
    requireActiveSubscription,
    requireDrugInteractionFeature,
    requirePharmacistRole,
    requirePermission('drug_interactions:contraindications'),
    validateRequest(contraindicationCheckSchema, 'body'),
    checkContraindications
);

/**
 * GET /api/interactions/drug-search
 * Search for drugs by name
 */
router.get(
    '/drug-search',
    requirePharmacistRole,
    requirePermission('drug_interactions:search'),
    validateRequest(drugSearchQuerySchema, 'query'),
    searchDrugs
);

// ===============================
// ERROR HANDLING MIDDLEWARE
// ===============================

/**
 * Drug interaction-specific error handler
 */
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Log the error
    console.error('Drug Interaction API Error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
    });

    // Handle specific drug interaction errors
    if (error.message.includes('RxNorm')) {
        return res.status(502).json({
            success: false,
            message: 'Drug database service temporarily unavailable',
            code: 'RXNORM_SERVICE_ERROR',
            details: 'Unable to connect to RxNorm service. Please try again later.',
        });
    }

    if (error.message.includes('OpenFDA')) {
        return res.status(502).json({
            success: false,
            message: 'FDA drug database temporarily unavailable',
            code: 'OPENFDA_SERVICE_ERROR',
            details: 'Unable to connect to OpenFDA service. Please try again later.',
        });
    }

    if (error.message.includes('drug interaction')) {
        return res.status(400).json({
            success: false,
            message: 'Drug interaction check failed',
            code: 'INTERACTION_CHECK_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('allergy')) {
        return res.status(400).json({
            success: false,
            message: 'Allergy check failed',
            code: 'ALLERGY_CHECK_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('contraindication')) {
        return res.status(400).json({
            success: false,
            message: 'Contraindication check failed',
            code: 'CONTRAINDICATION_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('drug search')) {
        return res.status(400).json({
            success: false,
            message: 'Drug search failed',
            code: 'DRUG_SEARCH_ERROR',
            details: error.message,
        });
    }

    if (error.message.includes('medication name')) {
        return res.status(422).json({
            success: false,
            message: 'Invalid medication name',
            code: 'INVALID_MEDICATION_NAME',
            details: error.message,
        });
    }

    if (error.message.includes('duplicate')) {
        return res.status(422).json({
            success: false,
            message: 'Duplicate entries detected',
            code: 'DUPLICATE_ENTRIES',
            details: error.message,
        });
    }

    // Handle external API rate limiting
    if (error.status === 429 || error.message.includes('rate limit')) {
        return res.status(429).json({
            success: false,
            message: 'External API rate limit exceeded',
            code: 'EXTERNAL_RATE_LIMIT',
            details: 'Too many requests to external drug databases. Please try again later.',
        });
    }

    // Handle external API timeouts
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        return res.status(504).json({
            success: false,
            message: 'External service timeout',
            code: 'EXTERNAL_TIMEOUT',
            details: 'External drug database request timed out. Please try again.',
        });
    }

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(502).json({
            success: false,
            message: 'External service unavailable',
            code: 'EXTERNAL_SERVICE_UNAVAILABLE',
            details: 'Unable to connect to external drug databases. Please try again later.',
        });
    }

    // Handle API key errors
    if (error.status === 401 || error.message.includes('unauthorized')) {
        return res.status(502).json({
            success: false,
            message: 'External service authentication failed',
            code: 'EXTERNAL_AUTH_ERROR',
            details: 'Authentication with external drug database failed. Please contact support.',
        });
    }

    // Handle API quota exceeded
    if (error.status === 403 || error.message.includes('quota')) {
        return res.status(502).json({
            success: false,
            message: 'External service quota exceeded',
            code: 'EXTERNAL_QUOTA_ERROR',
            details: 'External drug database quota exceeded. Please contact support.',
        });
    }

    // Handle malformed API responses
    if (error.message.includes('parse') || error.message.includes('JSON')) {
        return res.status(502).json({
            success: false,
            message: 'External service response error',
            code: 'EXTERNAL_RESPONSE_ERROR',
            details: 'Received invalid response from external drug database.',
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
            message: 'Invalid data format',
            code: 'INVALID_FORMAT',
            details: 'The provided data is not in the correct format',
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

    // Handle feature not available errors
    if (error.message.includes('feature not available')) {
        return res.status(402).json({
            success: false,
            message: 'Feature not available in current plan',
            code: 'FEATURE_UNAVAILABLE',
            details: 'Drug interaction checking requires a higher plan tier.',
            upgradeRequired: true,
        });
    }

    // Handle cache errors (non-critical)
    if (error.message.includes('cache')) {
        console.warn('Cache error (non-critical):', error.message);
        return res.status(200).json({
            success: true,
            message: 'Request completed with limited caching',
            warning: 'Some data may not be cached for faster future access',
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