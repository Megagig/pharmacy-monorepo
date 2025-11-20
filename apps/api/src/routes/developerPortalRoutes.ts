import { Router } from 'express';
import { body, query, param } from 'express-validator';
import DeveloperPortalController from '../controllers/developerPortalController';
import { auth } from '../middlewares/auth';
import { requireSuperAdmin } from '../middlewares/rbac';

const router = Router();

/**
 * Public routes (no authentication required)
 */

// Verify developer account
router.post('/verify/:token',
  [
    param('token').notEmpty().isString().trim()
      .withMessage('Valid verification token is required')
  ],
  DeveloperPortalController.verifyDeveloperAccount
);

/**
 * Developer routes (authentication required)
 */

// Apply authentication to all routes below
router.use(auth);

// Get current developer account
router.get('/account', DeveloperPortalController.getCurrentDeveloperAccount);

// Create or update developer account
router.post('/account',
  [
    body('companyName').optional().isString().trim()
      .isLength({ max: 200 }).withMessage('Company name must be less than 200 characters'),
    body('website').optional().isURL()
      .withMessage('Website must be a valid URL'),
    body('description').optional().isString().trim()
      .isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('contactEmail').notEmpty().isEmail().normalizeEmail()
      .withMessage('Valid contact email is required'),
    body('contactPhone').optional().isString().trim(),
    body('preferences.emailNotifications').optional().isBoolean(),
    body('preferences.webhookNotifications').optional().isBoolean(),
    body('preferences.maintenanceAlerts').optional().isBoolean(),
    body('preferences.usageAlerts').optional().isBoolean()
  ],
  DeveloperPortalController.createOrUpdateDeveloperAccount
);

// Resend verification email
router.post('/resend-verification', DeveloperPortalController.resendVerification);

// Get onboarding progress
router.get('/onboarding', DeveloperPortalController.getOnboardingProgress);

// Update onboarding step
router.post('/onboarding/:step',
  [
    param('step').notEmpty().isString().trim()
      .withMessage('Valid onboarding step is required'),
    body('completed').optional().isBoolean()
  ],
  DeveloperPortalController.updateOnboardingStep
);

/**
 * API Documentation Routes
 */

// Get API documentation
router.get('/documentation',
  [
    query('category').optional().isString().trim(),
    query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
    query('tags').optional(),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  DeveloperPortalController.getApiDocumentation
);

// Get documentation by endpoint
router.get('/documentation/endpoint/:endpointId',
  [
    param('endpointId').isMongoId().withMessage('Valid endpoint ID is required')
  ],
  DeveloperPortalController.getDocumentationByEndpoint
);

// Get documentation categories
router.get('/documentation/categories', DeveloperPortalController.getDocumentationCategories);

// Get documentation tags
router.get('/documentation/tags', DeveloperPortalController.getDocumentationTags);

// Generate code examples
router.get('/code-examples/:endpointId',
  [
    param('endpointId').isMongoId().withMessage('Valid endpoint ID is required'),
    query('apiKey').notEmpty().isString().trim()
      .withMessage('API key is required')
  ],
  DeveloperPortalController.generateCodeExamples
);

/**
 * Sandbox Environment Routes
 */

// Create sandbox session
router.post('/sandbox/sessions',
  [
    body('name').notEmpty().isString().trim()
      .withMessage('Session name is required'),
    body('description').optional().isString().trim(),
    body('environment').optional().isIn(['sandbox', 'testing']),
    body('configuration.timeout').optional().isInt({ min: 1000, max: 300000 }),
    body('configuration.retryAttempts').optional().isInt({ min: 0, max: 10 })
  ],
  DeveloperPortalController.createSandboxSession
);

// Get sandbox sessions
router.get('/sandbox/sessions',
  [
    query('environment').optional().isIn(['sandbox', 'testing']),
    query('isActive').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  DeveloperPortalController.getSandboxSessions
);

// Get sandbox session
router.get('/sandbox/sessions/:sessionId',
  [
    param('sessionId').notEmpty().isString().trim()
      .withMessage('Valid session ID is required')
  ],
  DeveloperPortalController.getSandboxSession
);

// Execute API test in sandbox
router.post('/sandbox/sessions/:sessionId/test',
  [
    param('sessionId').notEmpty().isString().trim()
      .withMessage('Valid session ID is required'),
    body('endpoint').notEmpty().isString().trim()
      .withMessage('Endpoint is required'),
    body('method').notEmpty().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      .withMessage('Valid HTTP method is required'),
    body('headers').optional().isObject(),
    body('body').optional(),
    body('variables').optional().isObject()
  ],
  DeveloperPortalController.executeApiTest
);

/**
 * API Key Management Routes
 */

// Get developer API keys
router.get('/api-keys', DeveloperPortalController.getDeveloperApiKeys);

/**
 * Admin routes (super admin required)
 */

// Admin routes for managing developer accounts
router.get('/admin/accounts',
  requireSuperAdmin,
  [
    query('status').optional().isIn(['active', 'suspended', 'pending']),
    query('subscriptionTier').optional().isIn(['free', 'basic', 'pro', 'enterprise']),
    query('isVerified').optional().isBoolean(),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  DeveloperPortalController.getDeveloperAccounts
);

export default router;