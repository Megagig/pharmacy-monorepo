import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { saasNotificationsController } from '../controllers/saasNotificationsController';
import { validateRequest } from '../middlewares/validation';

const router = Router();

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * SaaS Notifications Routes
 * All routes require super admin privileges
 */

// Get notification channels
router.get(
  '/channels',
  saasNotificationsController.getNotificationChannels.bind(saasNotificationsController)
);

// Update notification channel
router.put(
  '/channels/:channelId',
  [
    param('channelId').notEmpty().withMessage('Channel ID is required'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
    body('config').optional().isObject().withMessage('Config must be an object'),
    body('dailyLimit').optional().isInt({ min: 0 }).withMessage('Daily limit must be a non-negative integer'),
    body('monthlyLimit').optional().isInt({ min: 0 }).withMessage('Monthly limit must be a non-negative integer')
  ],
  validateRequest,
  saasNotificationsController.updateNotificationChannel.bind(saasNotificationsController)
);

// Get notification rules
router.get(
  '/rules',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Priority must be valid'),
    query('trigger').optional().isString().withMessage('Trigger must be a string')
  ],
  validateRequest,
  saasNotificationsController.getNotificationRules.bind(saasNotificationsController)
);

// Create notification rule
router.post(
  '/rules',
  [
    body('name')
      .notEmpty()
      .withMessage('Rule name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Rule name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('trigger')
      .notEmpty()
      .withMessage('Trigger is required')
      .isString()
      .withMessage('Trigger must be a string'),
    body('conditions')
      .isArray()
      .withMessage('Conditions must be an array'),
    body('actions')
      .isArray({ min: 1 })
      .withMessage('Actions must be a non-empty array'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be valid'),
    body('cooldownPeriod')
      .optional()
      .isInt({ min: 0, max: 1440 })
      .withMessage('Cooldown period must be between 0 and 1440 minutes'),
    body('maxExecutions')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max executions must be a positive integer')
  ],
  validateRequest,
  saasNotificationsController.createNotificationRule.bind(saasNotificationsController)
);

// Update notification rule
router.put(
  '/rules/:ruleId',
  [
    param('ruleId').isMongoId().withMessage('Rule ID must be a valid MongoDB ObjectId'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Rule name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('trigger')
      .optional()
      .isString()
      .withMessage('Trigger must be a string'),
    body('conditions')
      .optional()
      .isArray()
      .withMessage('Conditions must be an array'),
    body('actions')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Actions must be a non-empty array'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be valid'),
    body('cooldownPeriod')
      .optional()
      .isInt({ min: 0, max: 1440 })
      .withMessage('Cooldown period must be between 0 and 1440 minutes'),
    body('maxExecutions')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max executions must be a positive integer')
  ],
  validateRequest,
  saasNotificationsController.updateNotificationRule.bind(saasNotificationsController)
);

// Delete notification rule
router.delete(
  '/rules/:ruleId',
  [
    param('ruleId').isMongoId().withMessage('Rule ID must be a valid MongoDB ObjectId')
  ],
  validateRequest,
  saasNotificationsController.deleteNotificationRule.bind(saasNotificationsController)
);

// Toggle notification rule
router.patch(
  '/rules/:ruleId/toggle',
  [
    param('ruleId').isMongoId().withMessage('Rule ID must be a valid MongoDB ObjectId'),
    body('isActive').isBoolean().withMessage('isActive must be a boolean')
  ],
  validateRequest,
  saasNotificationsController.toggleNotificationRule.bind(saasNotificationsController)
);

// Get notification templates
router.get(
  '/templates',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('channel').optional().isIn(['email', 'sms', 'push', 'whatsapp']).withMessage('Channel must be valid'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  validateRequest,
  saasNotificationsController.getNotificationTemplates.bind(saasNotificationsController)
);

// Create notification template
router.post(
  '/templates',
  [
    body('name')
      .notEmpty()
      .withMessage('Template name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Template name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('channel')
      .isIn(['email', 'sms', 'push', 'whatsapp'])
      .withMessage('Channel must be valid'),
    body('subject')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Subject must not exceed 200 characters'),
    body('body')
      .notEmpty()
      .withMessage('Template body is required')
      .isLength({ min: 10, max: 10000 })
      .withMessage('Template body must be between 10 and 10000 characters'),
    body('variables')
      .optional()
      .isArray()
      .withMessage('Variables must be an array'),
    body('category')
      .optional()
      .isString()
      .withMessage('Category must be a string')
  ],
  validateRequest,
  saasNotificationsController.createNotificationTemplate.bind(saasNotificationsController)
);

// Update notification template
router.put(
  '/templates/:templateId',
  [
    param('templateId').isMongoId().withMessage('Template ID must be a valid MongoDB ObjectId'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Template name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('channel')
      .optional()
      .isIn(['email', 'sms', 'push', 'whatsapp'])
      .withMessage('Channel must be valid'),
    body('subject')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Subject must not exceed 200 characters'),
    body('body')
      .optional()
      .isLength({ min: 10, max: 10000 })
      .withMessage('Template body must be between 10 and 10000 characters'),
    body('variables')
      .optional()
      .isArray()
      .withMessage('Variables must be an array'),
    body('category')
      .optional()
      .isString()
      .withMessage('Category must be a string'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  validateRequest,
  saasNotificationsController.updateNotificationTemplate.bind(saasNotificationsController)
);

// Delete notification template
router.delete(
  '/templates/:templateId',
  [
    param('templateId').isMongoId().withMessage('Template ID must be a valid MongoDB ObjectId')
  ],
  validateRequest,
  saasNotificationsController.deleteNotificationTemplate.bind(saasNotificationsController)
);

// Get notification history
router.get(
  '/history',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('ruleId').optional().isMongoId().withMessage('Rule ID must be a valid MongoDB ObjectId'),
    query('channel').optional().isIn(['email', 'sms', 'push', 'whatsapp']).withMessage('Channel must be valid'),
    query('status').optional().isIn(['pending', 'sent', 'failed', 'delivered', 'bounced']).withMessage('Status must be valid'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
  ],
  validateRequest,
  saasNotificationsController.getNotificationHistory.bind(saasNotificationsController)
);

// Send test notification
router.post(
  '/test',
  [
    body('channelId').notEmpty().withMessage('Channel ID is required'),
    body('templateId').optional().isMongoId().withMessage('Template ID must be a valid MongoDB ObjectId'),
    body('recipients')
      .isArray({ min: 1 })
      .withMessage('Recipients must be a non-empty array'),
    body('recipients.*')
      .isString()
      .withMessage('Each recipient must be a string'),
    body('variables')
      .optional()
      .isObject()
      .withMessage('Variables must be an object')
  ],
  validateRequest,
  saasNotificationsController.sendTestNotification.bind(saasNotificationsController)
);

export default router;