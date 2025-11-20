import express from 'express';
import { body } from 'express-validator';
import featureFlagController from '../controllers/featureFlagController';
import { auth, requireSuperAdmin } from '../middlewares/auth';

const router = express.Router();

// Routes accessible to all authenticated users - no subscription check required
router.get('/', auth, featureFlagController.getAllFeatureFlags);
router.get('/:id', auth, featureFlagController.getFeatureFlagById);

// Get usage metrics for a feature flag (requires auth but not super admin)
router.get('/:id/metrics', auth, featureFlagController.getFeatureFlagMetrics);

// Apply authentication and super admin middleware to all admin routes
router.use(auth);
router.use(requireSuperAdmin);

// Create new feature flag with validation
router.post(
  '/',
  [
    body('name')
      .notEmpty()
      .withMessage('Feature name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Feature name must be between 3 and 100 characters'),
    body('key')
      .notEmpty()
      .withMessage('Feature key is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Feature key must be between 3 and 50 characters')
      .matches(/^[a-z0-9_]+$/)
      .withMessage(
        'Feature key must contain only lowercase letters, numbers, and underscores'
      ),
    body('description').notEmpty().withMessage('Description is required'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('allowedTiers')
      .optional()
      .isArray()
      .withMessage('allowedTiers must be an array'),
    body('allowedRoles')
      .optional()
      .isArray()
      .withMessage('allowedRoles must be an array'),
    body('metadata.category')
      .optional()
      .isString()
      .withMessage('Category must be a string'),
    body('metadata.priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be one of: low, medium, high, critical'),
    body('metadata.tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
  ],
  featureFlagController.createFeatureFlag
);

// Update feature flag with validation
router.put(
  '/:id',
  [
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Feature name must be between 3 and 100 characters'),
    body('description').optional(),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('allowedTiers')
      .optional()
      .isArray()
      .withMessage('allowedTiers must be an array'),
    body('allowedRoles')
      .optional()
      .isArray()
      .withMessage('allowedRoles must be an array'),
    body('metadata.category')
      .optional()
      .isString()
      .withMessage('Category must be a string'),
    body('metadata.priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be one of: low, medium, high, critical'),
    body('metadata.tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
  ],
  featureFlagController.updateFeatureFlag
);

// Delete feature flag
router.delete('/:id', featureFlagController.deleteFeatureFlag);

// Toggle feature flag active status
router.patch('/:id/toggle', featureFlagController.toggleFeatureFlagStatus);

// Get feature flags by category
router.get(
  '/category/:category',
  featureFlagController.getFeatureFlagsByCategory
);

// Get feature flags by subscription tier
router.get('/tier/:tier', featureFlagController.getFeatureFlagsByTier);

// Bulk add or remove features for a tier
router.post(
  '/tier/:tier/features',
  [
    body('featureKeys')
      .isArray({ min: 1 })
      .withMessage('featureKeys must be a non-empty array'),
    body('action')
      .isIn(['add', 'remove'])
      .withMessage('action must be either "add" or "remove"'),
  ],
  featureFlagController.updateTierFeatures
);

// Manually sync all subscription features with current feature flags
router.post('/sync-subscriptions', featureFlagController.syncSubscriptionFeatures);

// Enhanced functionality routes (Super Admin only)

// Update targeting rules for a feature flag
router.put(
  '/:id/targeting',
  [
    body('targetingRules').isObject().withMessage('targetingRules must be an object'),
    body('targetingRules.pharmacies')
      .optional()
      .isArray()
      .withMessage('pharmacies must be an array'),
    body('targetingRules.userGroups')
      .optional()
      .isArray()
      .withMessage('userGroups must be an array'),
    body('targetingRules.percentage')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('percentage must be between 0 and 100'),
  ],
  featureFlagController.updateTargetingRules
);



// Public routes (no authentication required)

// Get marketing features for pricing display
router.get('/public/marketing', featureFlagController.getMarketingFeatures);

// Routes for authenticated users (no super admin required)

// Check advanced feature access
router.post(
  '/check-access',
  auth, // Only require authentication, not super admin
  [
    body('featureKey')
      .notEmpty()
      .withMessage('featureKey is required'),
    body('workspaceId')
      .optional()
      .isMongoId()
      .withMessage('workspaceId must be a valid MongoDB ObjectId'),
  ],
  featureFlagController.checkAdvancedFeatureAccess
);

export default router;
