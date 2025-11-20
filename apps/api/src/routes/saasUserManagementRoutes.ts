import { Router } from 'express';
import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { saasUserManagementController } from '../controllers/saasUserManagementController';
import { validateRequest } from '../middlewares/validation';

const router = Router();

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * SaaS User Management Routes
 * All routes require super admin privileges
 */

// Get all users with filtering and pagination
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sortBy').optional().isString().withMessage('Sort by must be a string'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('search').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return typeof value === 'string';
    }).withMessage('Search must be a string'),
    query('role').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return typeof value === 'string';
    }).withMessage('Role must be a string'),
    query('status').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return ['active', 'inactive', 'suspended', 'pending'].includes(value);
    }).withMessage('Invalid status'),
    query('workspaceId').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    }).withMessage('Invalid workspace ID'),
    query('subscriptionPlan').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return typeof value === 'string';
    }).withMessage('Subscription plan must be a string'),
    query('lastLoginAfter').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return !isNaN(Date.parse(value));
    }).withMessage('Invalid date format for lastLoginAfter'),
    query('lastLoginBefore').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return !isNaN(Date.parse(value));
    }).withMessage('Invalid date format for lastLoginBefore')
  ],
  validateRequest,
  saasUserManagementController.getAllUsers.bind(saasUserManagementController)
);

// Get user statistics
router.get(
  '/statistics',
  [
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid time range')
  ],
  validateRequest,
  saasUserManagementController.getUserStatistics.bind(saasUserManagementController)
);

// Search users with advanced filters
router.post(
  '/search',
  [
    body('query').optional().isString().withMessage('Query must be a string'),
    body('filters').optional().isObject().withMessage('Filters must be an object'),
    body('pagination').optional().isObject().withMessage('Pagination must be an object'),
    body('pagination.page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    body('pagination.limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    body('includeInactive').optional().isBoolean().withMessage('Include inactive must be a boolean')
  ],
  validateRequest,
  saasUserManagementController.searchUsers.bind(saasUserManagementController)
);

// Bulk assign roles
router.post(
  '/bulk-assign-roles',
  [
    body('userIds')
      .isArray({ min: 1 })
      .withMessage('User IDs must be a non-empty array')
      .custom((userIds) => {
        if (!userIds.every((id: any) => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))) {
          throw new Error('All user IDs must be valid MongoDB ObjectIds');
        }
        return true;
      }),
    body('roleId').custom((value) => {
      // Accept either MongoDB ObjectId or role name
      if (mongoose.Types.ObjectId.isValid(value)) {
        return true;
      }
      // Check if it's a valid role name format
      if (typeof value === 'string' && /^[a-z0-9_-]+$/.test(value)) {
        return true;
      }
      throw new Error('Role ID must be a valid MongoDB ObjectId or role name');
    }),
    body('workspaceId').optional().isMongoId().withMessage('Workspace ID must be a valid MongoDB ObjectId')
  ],
  validateRequest,
  saasUserManagementController.bulkAssignRoles.bind(saasUserManagementController)
);

// Get user by ID
router.get(
  '/:userId',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId')
  ],
  validateRequest,
  saasUserManagementController.getUserById.bind(saasUserManagementController)
);

// Update user role
router.put(
  '/:userId/role',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    body('roleId').custom((value) => {
      // Accept either MongoDB ObjectId or role name
      if (mongoose.Types.ObjectId.isValid(value)) {
        return true;
      }
      // Check if it's a valid role name format
      if (typeof value === 'string' && /^[a-z0-9_-]+$/.test(value)) {
        return true;
      }
      throw new Error('Role ID must be a valid MongoDB ObjectId or role name');
    }),
    body('workspaceId').optional().isMongoId().withMessage('Workspace ID must be a valid MongoDB ObjectId'),
    body('reason').optional().isString().isLength({ min: 1, max: 500 }).withMessage('Reason must be between 1 and 500 characters')
  ],
  validateRequest,
  saasUserManagementController.updateUserRole.bind(saasUserManagementController)
);

// Suspend user
router.put(
  '/:userId/suspend',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    body('reason')
      .notEmpty()
      .withMessage('Suspension reason is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Reason must be between 10 and 1000 characters')
  ],
  validateRequest,
  saasUserManagementController.suspendUser.bind(saasUserManagementController)
);

// Reactivate user
router.put(
  '/:userId/reactivate',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId')
  ],
  validateRequest,
  saasUserManagementController.reactivateUser.bind(saasUserManagementController)
);

// Impersonate user
router.post(
  '/:userId/impersonate',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    body('duration')
      .optional()
      .isInt({ min: 300, max: 86400 })
      .withMessage('Duration must be between 300 seconds (5 minutes) and 86400 seconds (24 hours)')
  ],
  validateRequest,
  saasUserManagementController.impersonateUser.bind(saasUserManagementController)
);

// Approve user
router.put(
  '/:userId/approve',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId')
  ],
  validateRequest,
  saasUserManagementController.approveUser.bind(saasUserManagementController)
);

// Reject user
router.put(
  '/:userId/reject',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be a string with max 500 characters')
  ],
  validateRequest,
  saasUserManagementController.rejectUser.bind(saasUserManagementController)
);

// Bulk approve users
router.post(
  '/bulk-approve',
  [
    body('userIds')
      .isArray({ min: 1 })
      .withMessage('User IDs must be a non-empty array')
      .custom((userIds) => {
        if (!userIds.every((id: any) => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))) {
          throw new Error('All user IDs must be valid MongoDB ObjectIds');
        }
        return true;
      })
  ],
  validateRequest,
  saasUserManagementController.bulkApproveUsers.bind(saasUserManagementController)
);

// Bulk reject users
router.post(
  '/bulk-reject',
  [
    body('userIds')
      .isArray({ min: 1 })
      .withMessage('User IDs must be a non-empty array')
      .custom((userIds) => {
        if (!userIds.every((id: any) => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))) {
          throw new Error('All user IDs must be valid MongoDB ObjectIds');
        }
        return true;
      }),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be a string with max 500 characters')
  ],
  validateRequest,
  saasUserManagementController.bulkRejectUsers.bind(saasUserManagementController)
);

// Bulk suspend users
router.post(
  '/bulk-suspend',
  [
    body('userIds')
      .isArray({ min: 1 })
      .withMessage('User IDs must be a non-empty array')
      .custom((userIds) => {
        if (!userIds.every((id: any) => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))) {
          throw new Error('All user IDs must be valid MongoDB ObjectIds');
        }
        return true;
      }),
    body('reason')
      .notEmpty()
      .withMessage('Suspension reason is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Reason must be between 10 and 1000 characters')
  ],
  validateRequest,
  saasUserManagementController.bulkSuspendUsers.bind(saasUserManagementController)
);

// Create new user
router.post(
  '/',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('firstName').notEmpty().isString().withMessage('First name is required'),
    body('lastName').notEmpty().isString().withMessage('Last name is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['super_admin', 'pharmacy_outlet', 'pharmacist', 'intern_pharmacist', 'pharmacy_team']).withMessage('Invalid role'),
    body('workplaceId').optional().isMongoId().withMessage('Workplace ID must be a valid MongoDB ObjectId'),
    body('phone').optional().isString().withMessage('Phone must be a string')
  ],
  validateRequest,
  saasUserManagementController.createUser.bind(saasUserManagementController)
);

export default router;