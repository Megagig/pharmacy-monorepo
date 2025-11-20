import { Router } from 'express';
import { body, query, param } from 'express-validator';
import WebhookController from '../controllers/webhookController';
import { auth } from '../middlewares/auth';
import { requireSuperAdmin } from '../middlewares/rbac';

const router = Router();

// Apply authentication and super admin requirement to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * Webhook Management Routes
 */

// Get webhooks
router.get('/',
  [
    query('userId').optional().isMongoId(),
    query('isActive').optional().isBoolean(),
    query('events').optional(),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  WebhookController.getWebhooks
);

// Create webhook
router.post('/',
  [
    body('userId').notEmpty().isMongoId()
      .withMessage('Valid user ID is required'),
    body('name').notEmpty().isString().trim()
      .isLength({ max: 200 }).withMessage('Name is required and must be less than 200 characters'),
    body('description').optional().isString().trim()
      .isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('url').notEmpty().isURL()
      .withMessage('Valid URL is required'),
    body('events').notEmpty().isArray({ min: 1 })
      .withMessage('At least one event is required'),
    body('events.*').isString().trim(),
    body('isActive').optional().isBoolean(),
    body('headers').optional().isObject(),
    body('retryPolicy.maxRetries').optional().isInt({ min: 0, max: 10 }),
    body('retryPolicy.retryDelay').optional().isInt({ min: 1, max: 3600 }),
    body('retryPolicy.backoffMultiplier').optional().isFloat({ min: 1, max: 10 }),
    body('timeout').optional().isInt({ min: 1000, max: 300000 }),
    body('filters.conditions').optional().isArray(),
    body('filters.conditions.*.field').optional().isString().trim(),
    body('filters.conditions.*.operator').optional().isIn([
      'equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than'
    ]),
    body('filters.logicalOperator').optional().isIn(['AND', 'OR'])
  ],
  WebhookController.createWebhook
);

// Update webhook
router.put('/:id',
  [
    param('id').isMongoId().withMessage('Valid webhook ID is required'),
    body('name').optional().isString().trim()
      .isLength({ max: 200 }).withMessage('Name must be less than 200 characters'),
    body('description').optional().isString().trim()
      .isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('url').optional().isURL()
      .withMessage('Valid URL is required'),
    body('events').optional().isArray({ min: 1 })
      .withMessage('At least one event is required'),
    body('events.*').optional().isString().trim(),
    body('isActive').optional().isBoolean(),
    body('headers').optional().isObject(),
    body('retryPolicy.maxRetries').optional().isInt({ min: 0, max: 10 }),
    body('retryPolicy.retryDelay').optional().isInt({ min: 1, max: 3600 }),
    body('retryPolicy.backoffMultiplier').optional().isFloat({ min: 1, max: 10 }),
    body('timeout').optional().isInt({ min: 1000, max: 300000 }),
    body('filters.conditions').optional().isArray(),
    body('filters.logicalOperator').optional().isIn(['AND', 'OR'])
  ],
  WebhookController.updateWebhook
);

// Delete webhook
router.delete('/:id',
  [
    param('id').isMongoId().withMessage('Valid webhook ID is required')
  ],
  WebhookController.deleteWebhook
);

// Test webhook
router.post('/:id/test',
  [
    param('id').isMongoId().withMessage('Valid webhook ID is required')
  ],
  WebhookController.testWebhook
);

// Trigger webhook manually
router.post('/trigger',
  [
    body('eventType').notEmpty().isString().trim()
      .withMessage('Event type is required'),
    body('eventData').notEmpty()
      .withMessage('Event data is required'),
    body('eventId').optional().isString().trim()
  ],
  WebhookController.triggerWebhook
);

/**
 * Webhook Delivery Routes
 */

// Get webhook deliveries
router.get('/deliveries',
  [
    query('webhookId').optional().isMongoId(),
    query('eventType').optional().isString().trim(),
    query('status').optional().isIn(['pending', 'delivered', 'failed', 'cancelled']),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  WebhookController.getWebhookDeliveries
);

/**
 * Webhook Analytics Routes
 */

// Get webhook statistics
router.get('/statistics',
  [
    query('webhookId').optional().isMongoId(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate()
  ],
  WebhookController.getWebhookStatistics
);

// Get available webhook events
router.get('/events', WebhookController.getAvailableEvents);

/**
 * Internal/System Routes
 */

// Process webhook retries (for scheduled jobs)
router.post('/process-retries', WebhookController.processRetries);

export default router;