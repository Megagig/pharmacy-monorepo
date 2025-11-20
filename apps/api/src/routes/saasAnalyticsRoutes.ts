import { Router } from 'express';
import { body, query } from 'express-validator';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { saasAnalyticsController } from '../controllers/saasAnalyticsController';
import { validateRequest } from '../middlewares/validation';

const router = Router();

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * SaaS Analytics Routes
 * All routes require super admin privileges
 */

// Get subscription analytics
router.get(
  '/subscriptions',
  [
    query('timeRange')
      .optional()
      .isIn(['7d', '30d', '90d', '1y', 'custom'])
      .withMessage('Time range must be one of: 7d, 30d, 90d, 1y, custom'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ],
  validateRequest,
  saasAnalyticsController.getSubscriptionAnalytics.bind(saasAnalyticsController)
);

// Get pharmacy usage reports
router.get(
  '/pharmacy-usage',
  [
    query('timeRange')
      .optional()
      .isIn(['7d', '30d', '90d', '1y', 'custom'])
      .withMessage('Time range must be one of: 7d, 30d, 90d, 1y, custom'),
    query('pharmacyId')
      .optional()
      .isMongoId()
      .withMessage('Pharmacy ID must be a valid MongoDB ObjectId'),
    query('subscriptionPlan')
      .optional()
      .isString()
      .withMessage('Subscription plan must be a string'),
    query('sortBy')
      .optional()
      .isIn(['name', 'prescriptions', 'diagnostics', 'patients', 'interventions', 'lastActivity'])
      .withMessage('Sort by must be a valid field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],
  validateRequest,
  saasAnalyticsController.getPharmacyUsageReports.bind(saasAnalyticsController)
);

// Get clinical outcomes report
router.get(
  '/clinical-outcomes',
  [
    query('timeRange')
      .optional()
      .isIn(['7d', '30d', '90d', '1y', 'custom'])
      .withMessage('Time range must be one of: 7d, 30d, 90d, 1y, custom'),
    query('pharmacyId')
      .optional()
      .isMongoId()
      .withMessage('Pharmacy ID must be a valid MongoDB ObjectId'),
    query('interventionType')
      .optional()
      .isString()
      .withMessage('Intervention type must be a string'),
    query('includeDetails')
      .optional()
      .isBoolean()
      .withMessage('Include details must be a boolean')
  ],
  validateRequest,
  saasAnalyticsController.getClinicalOutcomesReport.bind(saasAnalyticsController)
);

// Export analytics report
router.post(
  '/export',
  [
    body('format')
      .isIn(['pdf', 'csv', 'excel'])
      .withMessage('Format must be one of: pdf, csv, excel'),
    body('reportType')
      .isIn(['subscription', 'pharmacy', 'clinical', 'financial'])
      .withMessage('Report type must be one of: subscription, pharmacy, clinical, financial'),
    body('dateRange')
      .isObject()
      .withMessage('Date range must be an object'),
    body('dateRange.start')
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('dateRange.end')
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('includeCharts')
      .optional()
      .isBoolean()
      .withMessage('Include charts must be a boolean'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object')
  ],
  validateRequest,
  saasAnalyticsController.exportReport.bind(saasAnalyticsController)
);

// Schedule report delivery
router.post(
  '/schedule',
  [
    body('reportType')
      .isIn(['subscription', 'pharmacy', 'clinical', 'financial'])
      .withMessage('Report type must be one of: subscription, pharmacy, clinical, financial'),
    body('format')
      .isIn(['pdf', 'csv', 'excel'])
      .withMessage('Format must be one of: pdf, csv, excel'),
    body('frequency')
      .isIn(['daily', 'weekly', 'monthly'])
      .withMessage('Frequency must be one of: daily, weekly, monthly'),
    body('recipients')
      .isArray({ min: 1 })
      .withMessage('Recipients must be a non-empty array'),
    body('recipients.*')
      .isEmail()
      .withMessage('Each recipient must be a valid email address'),
    body('dateRange')
      .optional()
      .isObject()
      .withMessage('Date range must be an object'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('includeCharts')
      .optional()
      .isBoolean()
      .withMessage('Include charts must be a boolean')
  ],
  validateRequest,
  saasAnalyticsController.scheduleReport.bind(saasAnalyticsController)
);

export default router;