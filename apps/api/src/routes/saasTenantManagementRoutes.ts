import { Router } from 'express';
import { saasTenantManagementController } from '../controllers/saasTenantManagementController';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply authentication and super admin role requirement to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * @route POST /api/admin/saas/tenant-management/tenants
 * @desc Provision a new tenant workspace
 * @access Super Admin only
 */
router.post(
  '/tenants',
  [
    body('name')
      .notEmpty()
      .withMessage('Tenant name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Tenant name must be between 2 and 100 characters'),
    body('type')
      .isIn(['pharmacy', 'clinic', 'hospital', 'chain'])
      .withMessage('Invalid tenant type'),
    body('contactInfo.email')
      .isEmail()
      .withMessage('Valid contact email is required'),
    body('contactInfo.address.street')
      .notEmpty()
      .withMessage('Street address is required'),
    body('contactInfo.address.city')
      .notEmpty()
      .withMessage('City is required'),
    body('contactInfo.address.state')
      .notEmpty()
      .withMessage('State is required'),
    body('contactInfo.address.country')
      .notEmpty()
      .withMessage('Country is required'),
    body('contactInfo.address.postalCode')
      .notEmpty()
      .withMessage('Postal code is required'),
    body('primaryContact.firstName')
      .notEmpty()
      .withMessage('Primary contact first name is required'),
    body('primaryContact.lastName')
      .notEmpty()
      .withMessage('Primary contact last name is required'),
    body('primaryContact.email')
      .isEmail()
      .withMessage('Valid primary contact email is required'),
    body('subscriptionPlanId')
      .isMongoId()
      .withMessage('Valid subscription plan ID is required'),
    body('settings.timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a string'),
    body('settings.currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter ISO code'),
    body('limits.maxUsers')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max users must be a positive integer'),
    body('limits.maxPatients')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Max patients must be a non-negative integer'),
    body('limits.storageLimit')
      .optional()
      .isInt({ min: 100 })
      .withMessage('Storage limit must be at least 100MB'),
    validateRequest,
  ],
  saasTenantManagementController.provisionTenant
);

/**
 * @route DELETE /api/admin/saas/tenant-management/tenants/:tenantId
 * @desc Deprovision a tenant workspace
 * @access Super Admin only
 */
router.delete(
  '/tenants/:tenantId',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    body('deleteData')
      .optional()
      .isBoolean()
      .withMessage('Delete data flag must be boolean'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    body('transferDataTo')
      .optional()
      .isMongoId()
      .withMessage('Transfer data to must be a valid tenant ID'),
    validateRequest,
  ],
  saasTenantManagementController.deprovisionTenant
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/status
 * @desc Update tenant status
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/status',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    body('status')
      .isIn(['active', 'suspended', 'pending', 'trial', 'cancelled'])
      .withMessage('Invalid status'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    body('suspensionDetails.reason')
      .optional()
      .isString()
      .withMessage('Suspension reason must be a string'),
    body('suspensionDetails.autoReactivateAt')
      .optional()
      .isISO8601()
      .withMessage('Auto reactivate date must be valid ISO 8601 date'),
    validateRequest,
  ],
  saasTenantManagementController.updateTenantStatus
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId
 * @desc Get tenant by ID
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    query('includeSettings')
      .optional()
      .isBoolean()
      .withMessage('Include settings flag must be boolean'),
    query('includeUsers')
      .optional()
      .isBoolean()
      .withMessage('Include users flag must be boolean'),
    query('includeUsage')
      .optional()
      .isBoolean()
      .withMessage('Include usage flag must be boolean'),
    validateRequest,
  ],
  saasTenantManagementController.getTenantById
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants
 * @desc List tenants with filtering and pagination
 * @access Super Admin only
 */
router.get(
  '/tenants',
  [
    query('status')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') return true;
        if (Array.isArray(value)) {
          return value.every(v => typeof v === 'string');
        }
        return false;
      })
      .withMessage('Status must be string or array of strings'),
    query('type')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') return true;
        if (Array.isArray(value)) {
          return value.every(v => typeof v === 'string');
        }
        return false;
      })
      .withMessage('Type must be string or array of strings'),
    query('subscriptionStatus')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') return true;
        if (Array.isArray(value)) {
          return value.every(v => typeof v === 'string');
        }
        return false;
      })
      .withMessage('Subscription status must be string or array of strings'),
    query('search')
      .optional()
      .isString()
      .withMessage('Search must be a string'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isString()
      .withMessage('Sort by must be a string'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    query('createdAfter')
      .optional()
      .isISO8601()
      .withMessage('Created after must be valid ISO 8601 date'),
    query('createdBefore')
      .optional()
      .isISO8601()
      .withMessage('Created before must be valid ISO 8601 date'),
    query('lastActivityAfter')
      .optional()
      .isISO8601()
      .withMessage('Last activity after must be valid ISO 8601 date'),
    query('lastActivityBefore')
      .optional()
      .isISO8601()
      .withMessage('Last activity before must be valid ISO 8601 date'),
    validateRequest,
  ],
  saasTenantManagementController.listTenants
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/usage
 * @desc Update tenant usage metrics
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/usage',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    body('currentUsers')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Current users must be a non-negative integer'),
    body('currentPatients')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Current patients must be a non-negative integer'),
    body('storageUsed')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Storage used must be a non-negative integer'),
    body('apiCallsThisMonth')
      .optional()
      .isInt({ min: 0 })
      .withMessage('API calls this month must be a non-negative integer'),
    validateRequest,
  ],
  saasTenantManagementController.updateTenantUsage
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId/data-isolation/validate
 * @desc Validate data isolation for a tenant
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId/data-isolation/validate',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    validateRequest,
  ],
  saasTenantManagementController.validateDataIsolation
);

/**
 * @route POST /api/admin/saas/tenant-management/tenants/:tenantId/data-isolation/enforce
 * @desc Enforce data isolation for a tenant
 * @access Super Admin only
 */
router.post(
  '/tenants/:tenantId/data-isolation/enforce',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    validateRequest,
  ],
  saasTenantManagementController.enforceDataIsolation
);

/**
 * @route GET /api/admin/saas/tenant-management/statistics
 * @desc Get tenant statistics
 * @access Super Admin only
 */
router.get(
  '/statistics',
  saasTenantManagementController.getTenantStatistics
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/branding
 * @desc Update tenant branding
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/branding',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    body('primaryColor')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('Primary color must be a valid hex color'),
    body('secondaryColor')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('Secondary color must be a valid hex color'),
    body('accentColor')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('Accent color must be a valid hex color'),
    body('fontFamily')
      .optional()
      .isString()
      .withMessage('Font family must be a string'),
    validateRequest,
  ],
  saasTenantManagementController.updateTenantBranding
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/limits
 * @desc Update tenant limits and quotas
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/limits',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    body('maxUsers')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max users must be at least 1'),
    body('maxPatients')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Max patients cannot be negative'),
    body('storageLimit')
      .optional()
      .isInt({ min: 100 })
      .withMessage('Storage limit must be at least 100MB'),
    body('apiCallsPerMonth')
      .optional()
      .isInt({ min: 1000 })
      .withMessage('API calls per month must be at least 1000'),
    body('maxWorkspaces')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max workspaces must be at least 1'),
    body('maxIntegrations')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Max integrations cannot be negative'),
    validateRequest,
  ],
  saasTenantManagementController.updateTenantLimits
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/features
 * @desc Update tenant feature configuration
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/features',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    body('features')
      .isArray()
      .withMessage('Features must be an array'),
    body('features.*')
      .isString()
      .withMessage('Each feature must be a string'),
    validateRequest,
  ],
  saasTenantManagementController.updateTenantFeatures
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/customization
 * @desc Update comprehensive tenant customization
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/customization',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    body('branding.primaryColor')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('Primary color must be a valid hex color'),
    body('branding.secondaryColor')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('Secondary color must be a valid hex color'),
    body('limits.maxUsers')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max users must be at least 1'),
    body('limits.maxPatients')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Max patients cannot be negative'),
    body('features')
      .optional()
      .isArray()
      .withMessage('Features must be an array'),
    body('settings.timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a string'),
    body('settings.currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter ISO code'),
    validateRequest,
  ],
  saasTenantManagementController.updateTenantCustomization
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId/customization
 * @desc Get tenant customization settings
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId/customization',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    validateRequest,
  ],
  saasTenantManagementController.getTenantCustomization
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId/analytics
 * @desc Get tenant analytics and usage tracking
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId/analytics',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    query('timeRange')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Time range must be one of: 7d, 30d, 90d, 1y'),
    validateRequest,
  ],
  saasTenantManagementController.getTenantAnalytics
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId/performance
 * @desc Get tenant performance monitoring metrics
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId/performance',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    validateRequest,
  ],
  saasTenantManagementController.getTenantPerformanceMetrics
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId/billing-analytics
 * @desc Get tenant billing and cost tracking
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId/billing-analytics',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Valid tenant ID is required'),
    query('timeRange')
      .optional()
      .isIn(['30d', '90d', '1y'])
      .withMessage('Time range must be one of: 30d, 90d, 1y'),
    validateRequest,
  ],
  saasTenantManagementController.getTenantBillingAnalytics
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId/subscription
 * @desc Get tenant subscription details
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId/subscription',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Invalid tenant ID'),
    validateRequest,
  ],
  saasTenantManagementController.getTenantSubscription
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/subscription
 * @desc Update tenant subscription (upgrade/downgrade/revoke)
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/subscription',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Invalid tenant ID'),
    body('action')
      .isIn(['upgrade', 'downgrade', 'revoke'])
      .withMessage('Action must be upgrade, downgrade, or revoke'),
    body('planId')
      .optional()
      .isMongoId()
      .withMessage('Invalid plan ID'),
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be between 1 and 500 characters'),
    validateRequest,
  ],
  saasTenantManagementController.updateTenantSubscription
);

/**
 * @route GET /api/admin/saas/tenant-management/tenants/:tenantId/members
 * @desc Get workspace members
 * @access Super Admin only
 */
router.get(
  '/tenants/:tenantId/members',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Invalid tenant ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    validateRequest,
  ],
  saasTenantManagementController.getWorkspaceMembers
);

/**
 * @route POST /api/admin/saas/tenant-management/tenants/:tenantId/members/invite
 * @desc Invite new member to workspace
 * @access Super Admin only
 */
router.post(
  '/tenants/:tenantId/members/invite',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Invalid tenant ID'),
    body('email')
      .isEmail()
      .withMessage('Valid email is required'),
    body('role')
      .isIn(['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'])
      .withMessage('Invalid role'),
    body('firstName')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    validateRequest,
  ],
  saasTenantManagementController.inviteWorkspaceMember
);

/**
 * @route PUT /api/admin/saas/tenant-management/tenants/:tenantId/members/:memberId/role
 * @desc Update member role in workspace
 * @access Super Admin only
 */
router.put(
  '/tenants/:tenantId/members/:memberId/role',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Invalid tenant ID'),
    param('memberId')
      .isMongoId()
      .withMessage('Invalid member ID'),
    body('role')
      .isIn(['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'])
      .withMessage('Invalid role'),
    validateRequest,
  ],
  saasTenantManagementController.updateMemberRole
);

/**
 * @route DELETE /api/admin/saas/tenant-management/tenants/:tenantId/members/:memberId
 * @desc Remove member from workspace
 * @access Super Admin only
 */
router.delete(
  '/tenants/:tenantId/members/:memberId',
  [
    param('tenantId')
      .isMongoId()
      .withMessage('Invalid tenant ID'),
    param('memberId')
      .isMongoId()
      .withMessage('Invalid member ID'),
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be between 1 and 500 characters'),
    validateRequest,
  ],
  saasTenantManagementController.removeMember
);

/**
 * @route GET /api/admin/saas/tenant-management/subscription-plans
 * @desc Get available subscription plans
 * @access Super Admin only
 */
// Removed /subscription-plans route - use /pricing/plans endpoint instead

export default router;