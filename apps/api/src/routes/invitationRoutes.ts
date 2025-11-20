import express from 'express';
import {
    createInvitation,
    getWorkspaceInvitations,
    cancelInvitation,
    acceptInvitation,
    acceptInvitationPublic,
    validateInvitation,
    getInvitationAnalytics,
    getInvitationStats,
    checkInvitationLimits,
} from '../controllers/invitationController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission } from '../middlewares/rbac';
import { invitationRateLimiters, abuseDetection } from '../middlewares/rateLimiting';

const router = express.Router();

/**
 * @route   POST /api/workspaces/:id/invitations
 * @desc    Create a new invitation for a workspace
 * @access  Private (Workspace Owner only)
 */
router.post(
    '/workspaces/:id/invitations',
    invitationRateLimiters.createInvitation,
    authWithWorkspace,
    invitationRateLimiters.createInvitationUser,
    abuseDetection.invitationSpam,
    requirePermission('invitation.create'),
    createInvitation
);

/**
 * @route   GET /api/workspaces/:id/invitations
 * @desc    Get all invitations for a workspace
 * @access  Private (Workspace Owner only)
 */
router.get(
    '/workspaces/:id/invitations',
    authWithWorkspace,
    requirePermission('invitation.view'),
    getWorkspaceInvitations
);

/**
 * @route   DELETE /api/invitations/:id
 * @desc    Cancel an invitation
 * @access  Private (Workspace Owner or Inviter only)
 */
router.delete(
    '/invitations/:id',
    authWithWorkspace,
    requirePermission('invitation.delete'),
    cancelInvitation
);

/**
 * @route   POST /api/invitations/accept
 * @desc    Accept an invitation with new user registration
 * @access  Public
 */
router.post(
    '/invitations/accept',
    acceptInvitationPublic
);

/**
 * @route   POST /api/invitations/:code/accept
 * @desc    Accept an invitation
 * @access  Private (Authenticated user only)
 */
router.post(
    '/invitations/:code/accept',
    invitationRateLimiters.acceptInvitation,
    authWithWorkspace,
    acceptInvitation
);

/**
 * @route   GET /api/invitations/:code/validate
 * @desc    Validate an invitation code (public endpoint)
 * @access  Public
 */
router.get(
    '/invitations/:code/validate',
    invitationRateLimiters.validateInvitation,
    validateInvitation
);

/**
 * @route   GET /api/workspaces/:id/invitations/analytics
 * @desc    Get invitation analytics for a workspace
 * @access  Private (Workspace Owner only)
 */
router.get(
    '/workspaces/:id/invitations/analytics',
    authWithWorkspace,
    requirePermission('invitation.view'),
    getInvitationAnalytics
);

/**
 * @route   GET /api/workspaces/:id/invitations/limits
 * @desc    Check invitation limits for a workspace
 * @access  Private (Workspace Owner only)
 */
router.get(
    '/workspaces/:id/invitations/limits',
    authWithWorkspace,
    requirePermission('invitation.view'),
    checkInvitationLimits
);

/**
 * @route   GET /api/invitations/stats
 * @desc    Get invitation statistics
 * @access  Private (Workspace Owner only)
 */
router.get(
    '/invitations/stats',
    authWithWorkspace,
    getInvitationStats
);

export default router;