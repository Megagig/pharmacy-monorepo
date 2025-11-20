import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requireWorkspaceOwner } from '../middlewares/rbac';
import { validateRequest } from '../middlewares/validation';
import { workspaceTeamController } from '../controllers/workspaceTeamController';
import { workspaceTeamInviteController } from '../controllers/workspaceTeamInviteController';

const router = Router();

/**
 * Public route - Validate invite token (no auth required)
 * This must be BEFORE auth middleware
 */
router.get(
  '/invites/validate/:token',
  [
    param('token')
      .notEmpty()
      .withMessage('Invite token is required'),
  ],
  validateRequest,
  workspaceTeamInviteController.validateInviteToken.bind(workspaceTeamInviteController)
);

// Apply authentication with workspace context to all routes below
router.use(authWithWorkspace);

/**
 * Get workspace settings (available to all authenticated users)
 * @route GET /api/workspace/settings
 * @access Private (All authenticated users in workspace)
 */
router.get(
  '/settings',
  workspaceTeamController.getWorkspaceSettings.bind(workspaceTeamController)
);

// Apply workspace owner authorization to all routes below
router.use(requireWorkspaceOwner);

/**
 * Workspace Team Management Routes
 * All routes require workspace owner privileges (pharmacy_outlet role)
 */

/**
 * Get workspace statistics
 * @route GET /api/workspace/team/stats
 * @access Private (Workspace owners only)
 */
router.get(
  '/stats',
  workspaceTeamController.getWorkspaceStats.bind(workspaceTeamController)
);

/**
 * Get all members in the workspace
 * @route GET /api/workspace/team/members
 * @access Private (Workspace owners only)
 */
router.get(
  '/members',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .isString()
      .withMessage('Search must be a string'),
    query('role')
      .optional()
      .isIn(['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'])
      .withMessage('Invalid workplace role'),
    query('status')
      .optional()
      .isIn(['pending', 'active', 'suspended', 'license_pending', 'license_rejected'])
      .withMessage('Invalid status'),
  ],
  validateRequest,
  workspaceTeamController.getMembers.bind(workspaceTeamController)
);

/**
 * Update member role
 * @route PUT /api/workspace/team/members/:id
 * @access Private (Workspace owners only)
 */
router.put(
  '/members/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Member ID must be a valid MongoDB ObjectId'),
    body('workplaceRole')
      .notEmpty()
      .withMessage('Workplace role is required')
      .isIn(['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'])
      .withMessage('Invalid workplace role'),
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be between 1 and 500 characters'),
  ],
  validateRequest,
  workspaceTeamController.updateMemberRole.bind(workspaceTeamController)
);

/**
 * Remove member from workspace
 * @route DELETE /api/workspace/team/members/:id
 * @access Private (Workspace owners only)
 */
router.delete(
  '/members/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Member ID must be a valid MongoDB ObjectId'),
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be between 1 and 500 characters'),
  ],
  validateRequest,
  workspaceTeamController.removeMember.bind(workspaceTeamController)
);

/**
 * Suspend a member
 * @route POST /api/workspace/team/members/:id/suspend
 * @access Private (Workspace owners only)
 */
router.post(
  '/members/:id/suspend',
  [
    param('id')
      .isMongoId()
      .withMessage('Member ID must be a valid MongoDB ObjectId'),
    body('reason')
      .notEmpty()
      .withMessage('Suspension reason is required')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be between 1 and 500 characters'),
  ],
  validateRequest,
  workspaceTeamController.suspendMember.bind(workspaceTeamController)
);

/**
 * Activate a suspended member
 * @route POST /api/workspace/team/members/:id/activate
 * @access Private (Workspace owners only)
 */
router.post(
  '/members/:id/activate',
  [
    param('id')
      .isMongoId()
      .withMessage('Member ID must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  workspaceTeamController.activateMember.bind(workspaceTeamController)
);

/**
 * Get audit logs for the workspace
 * @route GET /api/workspace/team/audit
 * @access Private (Workspace owners only)
 */
router.get(
  '/audit',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('actorId')
      .optional()
      .isMongoId()
      .withMessage('Actor ID must be a valid MongoDB ObjectId'),
    query('targetId')
      .optional()
      .isMongoId()
      .withMessage('Target ID must be a valid MongoDB ObjectId'),
    query('category')
      .optional()
      .isIn(['member', 'role', 'permission', 'invite', 'auth', 'settings'])
      .withMessage('Invalid category'),
    query('action')
      .optional()
      .isString()
      .withMessage('Action must be a string'),
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity'),
  ],
  validateRequest,
  workspaceTeamController.getAuditLogs.bind(workspaceTeamController)
);

/**
 * Export audit logs to CSV
 * @route GET /api/workspace/team/audit/export
 * @access Private (Workspace owners only)
 */
router.get(
  '/audit/export',
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('actorId')
      .optional()
      .isMongoId()
      .withMessage('Actor ID must be a valid MongoDB ObjectId'),
    query('targetId')
      .optional()
      .isMongoId()
      .withMessage('Target ID must be a valid MongoDB ObjectId'),
    query('category')
      .optional()
      .isIn(['member', 'role', 'permission', 'invite', 'auth', 'settings'])
      .withMessage('Invalid category'),
    query('action')
      .optional()
      .isString()
      .withMessage('Action must be a string'),
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity'),
  ],
  validateRequest,
  workspaceTeamController.exportAuditLogs.bind(workspaceTeamController)
);

/**
 * Get audit statistics
 * @route GET /api/workspace/team/audit/statistics
 * @access Private (Workspace owners only)
 */
router.get(
  '/audit/statistics',
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
  validateRequest,
  workspaceTeamController.getAuditStatistics.bind(workspaceTeamController)
);

/**
 * Generate a new invite link
 * @route POST /api/workspace/team/invites
 * @access Private (Workspace owners only)
 */
router.post(
  '/invites',
  [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail(),
    body('workplaceRole')
      .notEmpty()
      .withMessage('Workplace role is required')
      .isIn(['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'])
      .withMessage('Invalid workplace role'),
    body('expiresInDays')
      .notEmpty()
      .withMessage('Expiration days is required')
      .isInt({ min: 1, max: 30 })
      .withMessage('Expiration must be between 1 and 30 days'),
    body('maxUses')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Max uses must be between 1 and 100'),
    body('requiresApproval')
      .optional()
      .isBoolean()
      .withMessage('Requires approval must be a boolean'),
    body('personalMessage')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Personal message must not exceed 1000 characters'),
  ],
  validateRequest,
  workspaceTeamInviteController.generateInvite.bind(workspaceTeamInviteController)
);

/**
 * Get all invites for the workspace
 * @route GET /api/workspace/team/invites
 * @access Private (Workspace owners only)
 */
router.get(
  '/invites',
  [
    query('status')
      .optional()
      .isIn(['pending', 'accepted', 'rejected', 'expired', 'revoked'])
      .withMessage('Invalid status'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  validateRequest,
  workspaceTeamInviteController.getInvites.bind(workspaceTeamInviteController)
);

/**
 * Revoke an invite link
 * @route DELETE /api/workspace/team/invites/:id
 * @access Private (Workspace owners only)
 */
router.delete(
  '/invites/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invite ID must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  workspaceTeamInviteController.revokeInvite.bind(workspaceTeamInviteController)
);

/**
 * Get pending member approvals
 * @route GET /api/workspace/team/invites/pending
 * @access Private (Workspace owners only)
 */
router.get(
  '/invites/pending',
  workspaceTeamInviteController.getPendingApprovals.bind(workspaceTeamInviteController)
);

/**
 * Approve a pending member
 * @route POST /api/workspace/team/invites/:id/approve
 * @access Private (Workspace owners only)
 */
router.post(
  '/invites/:id/approve',
  [
    param('id')
      .isMongoId()
      .withMessage('Invite ID must be a valid MongoDB ObjectId'),
    body('workplaceRole')
      .optional()
      .isIn(['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'])
      .withMessage('Invalid workplace role'),
  ],
  validateRequest,
  workspaceTeamInviteController.approveMember.bind(workspaceTeamInviteController)
);

/**
 * Reject a pending member
 * @route POST /api/workspace/team/invites/:id/reject
 * @access Private (Workspace owners only)
 */
router.post(
  '/invites/:id/reject',
  [
    param('id')
      .isMongoId()
      .withMessage('Invite ID must be a valid MongoDB ObjectId'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Reason must not exceed 500 characters'),
  ],
  validateRequest,
  workspaceTeamInviteController.rejectMember.bind(workspaceTeamInviteController)
);

/**
 * License Management Routes for Workspace Members
 * Allows workspace owners to approve/reject licenses of their pharmacist members
 */

/**
 * Get pending license approvals for workspace members
 * @route GET /api/workspace/team/licenses/pending
 * @access Private (Workspace owners only)
 */
router.get(
  '/licenses/pending',
  workspaceTeamController.getPendingLicenses.bind(workspaceTeamController)
);

/**
 * Approve a member's license within the workspace
 * @route POST /api/workspace/team/licenses/:memberId/approve
 * @access Private (Workspace owners only)
 */
router.post(
  '/licenses/:memberId/approve',
  [
    param('memberId')
      .isMongoId()
      .withMessage('Member ID must be a valid MongoDB ObjectId'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Reason must not exceed 500 characters'),
  ],
  validateRequest,
  workspaceTeamController.approveMemberLicense.bind(workspaceTeamController)
);

/**
 * Reject a member's license within the workspace
 * @route POST /api/workspace/team/licenses/:memberId/reject
 * @access Private (Workspace owners only)
 */
router.post(
  '/licenses/:memberId/reject',
  [
    param('memberId')
      .isMongoId()
      .withMessage('Member ID must be a valid MongoDB ObjectId'),
    body('reason')
      .notEmpty()
      .withMessage('Rejection reason is required')
      .isString()
      .isLength({ min: 3, max: 500 })
      .withMessage('Reason must be between 3 and 500 characters'),
  ],
  validateRequest,
  workspaceTeamController.rejectMemberLicense.bind(workspaceTeamController)
);

export default router;
