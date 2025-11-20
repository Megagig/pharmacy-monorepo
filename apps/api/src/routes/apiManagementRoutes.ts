import { Router } from 'express';
import { body, query, param } from 'express-validator';
import ApiManagementController from '../controllers/apiManagementController';
import { auth } from '../middlewares/auth';
import { requireSuperAdmin } from '../middlewares/rbac';

const router = Router();

// Apply authentication and super admin requirement to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * API Endpoints Management Routes
 */

// Get all API endpoints with filtering and pagination
router.get('/endpoints',
  [
    query('category').optional().isString().trim(),
    query('version').optional().isString().trim(),
    query('deprecated').optional().isBoolean(),
    query('isPublic').optional().isBoolean(),
    query('tags').optional(),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  ApiManagementController.getEndpoints
);

// Create or update an API endpoint
router.post('/endpoints',
  [
    body('path').notEmpty().isString().trim()
      .withMessage('Path is required'),
    body('method').notEmpty().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      .withMessage('Valid HTTP method is required'),
    body('version').notEmpty().isString().trim()
      .withMessage('Version is required'),
    body('description').notEmpty().isString().trim()
      .withMessage('Description is required'),
    body('category').notEmpty().isString().trim()
      .withMessage('Category is required'),
    body('parameters').optional().isArray(),
    body('parameters.*.name').optional().isString().trim(),
    body('parameters.*.type').optional().isIn(['string', 'number', 'boolean', 'object', 'array']),
    body('parameters.*.required').optional().isBoolean(),
    body('parameters.*.description').optional().isString().trim(),
    body('responses').optional().isArray(),
    body('responses.*.statusCode').optional().isInt({ min: 100, max: 599 }),
    body('responses.*.description').optional().isString().trim(),
    body('authentication.required').optional().isBoolean(),
    body('authentication.type').optional().isIn(['bearer', 'api_key', 'basic']),
    body('authentication.scopes').optional().isArray(),
    body('rateLimit.requests').optional().isInt({ min: 1 }),
    body('rateLimit.window').optional().isInt({ min: 1 }),
    body('deprecated').optional().isBoolean(),
    body('tags').optional().isArray(),
    body('isPublic').optional().isBoolean()
  ],
  ApiManagementController.createOrUpdateEndpoint
);

// Delete an API endpoint
router.delete('/endpoints/:id',
  [
    param('id').isMongoId().withMessage('Valid endpoint ID is required')
  ],
  ApiManagementController.deleteEndpoint
);

// Generate OpenAPI specification
router.get('/openapi-spec', ApiManagementController.generateOpenApiSpec);

/**
 * API Keys Management Routes
 */

// Get all API keys with filtering and pagination
router.get('/api-keys',
  [
    query('userId').optional().isMongoId(),
    query('environment').optional().isIn(['development', 'staging', 'production']),
    query('isActive').optional().isBoolean(),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  ApiManagementController.getApiKeys
);

// Create a new API key
router.post('/api-keys',
  [
    body('name').notEmpty().isString().trim()
      .withMessage('Name is required'),
    body('description').optional().isString().trim(),
    body('userId').notEmpty().isMongoId()
      .withMessage('Valid user ID is required'),
    body('scopes').notEmpty().isArray({ min: 1 })
      .withMessage('At least one scope is required'),
    body('scopes.*').isString().trim(),
    body('rateLimit.requests').optional().isInt({ min: 1 }),
    body('rateLimit.window').optional().isInt({ min: 1 }),
    body('expiresAt').optional().isISO8601().toDate(),
    body('allowedIPs').optional().isArray(),
    body('allowedIPs.*').optional().isIP(),
    body('allowedDomains').optional().isArray(),
    body('allowedDomains.*').optional().isFQDN(),
    body('environment').notEmpty().isIn(['development', 'staging', 'production'])
      .withMessage('Valid environment is required')
  ],
  ApiManagementController.createApiKey
);

// Revoke an API key
router.delete('/api-keys/:keyId',
  [
    param('keyId').notEmpty().isString().trim()
      .withMessage('Valid key ID is required')
  ],
  ApiManagementController.revokeApiKey
);

/**
 * Analytics and Monitoring Routes
 */

// Get usage analytics
router.get('/analytics',
  [
    query('endpoint').optional().isString().trim(),
    query('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    query('userId').optional().isMongoId(),
    query('apiKeyId').optional().isString().trim(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('statusCode').optional().isInt({ min: 100, max: 599 }),
    query('groupBy').optional().isIn(['hour', 'day', 'week', 'month'])
  ],
  ApiManagementController.getUsageAnalytics
);

// Get available API versions
router.get('/versions', ApiManagementController.getApiVersions);

// Get API categories
router.get('/categories', ApiManagementController.getApiCategories);

export default router;