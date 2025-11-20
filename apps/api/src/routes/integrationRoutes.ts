import { Router } from 'express';
import { body, query, param } from 'express-validator';
import IntegrationController from '../controllers/integrationController';
import { auth } from '../middlewares/auth';
import { requireSuperAdmin } from '../middlewares/rbac';

const router = Router();

// Apply authentication and super admin requirement to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * Integration Management Routes
 */

// Get integrations
router.get('/',
  [
    query('userId').optional().isMongoId(),
    query('type').optional().isIn(['webhook', 'api', 'database', 'file_sync', 'email', 'sms', 'custom']),
    query('provider').optional().isString().trim(),
    query('isActive').optional().isBoolean(),
    query('syncFrequency').optional().isIn(['realtime', 'hourly', 'daily', 'weekly', 'manual']),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  IntegrationController.getIntegrations
);

// Create integration
router.post('/',
  [
    body('userId').notEmpty().isMongoId()
      .withMessage('Valid user ID is required'),
    body('name').notEmpty().isString().trim()
      .isLength({ max: 200 }).withMessage('Name is required and must be less than 200 characters'),
    body('description').optional().isString().trim()
      .isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('type').notEmpty().isIn(['webhook', 'api', 'database', 'file_sync', 'email', 'sms', 'custom'])
      .withMessage('Valid integration type is required'),
    body('provider').notEmpty().isString().trim()
      .withMessage('Provider is required'),
    body('configuration.endpoint').optional().isURL(),
    body('configuration.apiKey').optional().isString().trim(),
    body('configuration.credentials').optional().isObject(),
    body('configuration.settings').optional().isObject(),
    body('mapping').optional().isArray(),
    body('mapping.*.sourceField').optional().isString().trim(),
    body('mapping.*.targetField').optional().isString().trim(),
    body('mapping.*.transformation').optional().isString().trim(),
    body('syncDirection').notEmpty().isIn(['inbound', 'outbound', 'bidirectional'])
      .withMessage('Valid sync direction is required'),
    body('syncFrequency').optional().isIn(['realtime', 'hourly', 'daily', 'weekly', 'manual']),
    body('isActive').optional().isBoolean(),
    body('filters.conditions').optional().isArray(),
    body('filters.logicalOperator').optional().isIn(['AND', 'OR']),
    body('errorHandling.onError').optional().isIn(['stop', 'continue', 'retry']),
    body('errorHandling.maxRetries').optional().isInt({ min: 0, max: 10 }),
    body('errorHandling.retryDelay').optional().isInt({ min: 1, max: 3600 }),
    body('errorHandling.notifyOnError').optional().isBoolean(),
    body('errorHandling.errorWebhook').optional().isURL()
  ],
  IntegrationController.createIntegration
);

// Update integration
router.put('/:id',
  [
    param('id').isMongoId().withMessage('Valid integration ID is required'),
    body('name').optional().isString().trim()
      .isLength({ max: 200 }).withMessage('Name must be less than 200 characters'),
    body('description').optional().isString().trim()
      .isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('type').optional().isIn(['webhook', 'api', 'database', 'file_sync', 'email', 'sms', 'custom']),
    body('provider').optional().isString().trim(),
    body('configuration.endpoint').optional().isURL(),
    body('configuration.apiKey').optional().isString().trim(),
    body('configuration.credentials').optional().isObject(),
    body('configuration.settings').optional().isObject(),
    body('mapping').optional().isArray(),
    body('syncDirection').optional().isIn(['inbound', 'outbound', 'bidirectional']),
    body('syncFrequency').optional().isIn(['realtime', 'hourly', 'daily', 'weekly', 'manual']),
    body('isActive').optional().isBoolean(),
    body('filters.conditions').optional().isArray(),
    body('filters.logicalOperator').optional().isIn(['AND', 'OR']),
    body('errorHandling.onError').optional().isIn(['stop', 'continue', 'retry']),
    body('errorHandling.maxRetries').optional().isInt({ min: 0, max: 10 }),
    body('errorHandling.retryDelay').optional().isInt({ min: 1, max: 3600 }),
    body('errorHandling.notifyOnError').optional().isBoolean(),
    body('errorHandling.errorWebhook').optional().isURL()
  ],
  IntegrationController.updateIntegration
);

// Delete integration
router.delete('/:id',
  [
    param('id').isMongoId().withMessage('Valid integration ID is required')
  ],
  IntegrationController.deleteIntegration
);

// Test integration
router.post('/:id/test',
  [
    param('id').isMongoId().withMessage('Valid integration ID is required')
  ],
  IntegrationController.testIntegration
);

// Execute integration sync
router.post('/:id/sync',
  [
    param('id').isMongoId().withMessage('Valid integration ID is required'),
    body('manual').optional().isBoolean()
  ],
  IntegrationController.executeSync
);

/**
 * Integration Analytics Routes
 */

// Get integration statistics
router.get('/statistics',
  [
    query('integrationId').optional().isMongoId(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate()
  ],
  IntegrationController.getIntegrationStatistics
);

// Get available integration providers
router.get('/providers', IntegrationController.getAvailableProviders);

/**
 * Internal/System Routes
 */

// Process scheduled syncs (for scheduled jobs)
router.post('/process-scheduled', IntegrationController.processScheduledSyncs);

export default router;