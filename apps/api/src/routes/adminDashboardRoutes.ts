import express from 'express';
import { adminDashboardController } from '../controllers/adminDashboardController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requireRole } from '../middlewares/rbac';
import { dashboardCacheMiddleware } from '../middlewares/cacheMiddleware';

const router = express.Router();

// Apply authentication to all admin routes
router.use(authWithWorkspace);
router.use(requireRole('super_admin'));

/**
 * @route GET /api/admin/dashboard/overview
 * @desc Get admin dashboard overview
 * @access Private (Super Admin only)
 */
router.get('/overview', dashboardCacheMiddleware, adminDashboardController.getDashboardOverview.bind(adminDashboardController));

/**
 * @route GET /api/admin/dashboard/workspaces
 * @desc Get workspace management data
 * @access Private (Super Admin only)
 */
router.get('/workspaces', dashboardCacheMiddleware, adminDashboardController.getWorkspaceManagement.bind(adminDashboardController));

/**
 * @route PUT /api/admin/dashboard/workspaces/:workspaceId/subscription
 * @desc Update workspace subscription
 * @access Private (Super Admin only)
 */
router.put('/workspaces/:workspaceId/subscription', adminDashboardController.updateWorkspaceSubscription.bind(adminDashboardController));

/**
 * @route GET /api/admin/dashboard/invitations
 * @desc Get invitation management data
 * @access Private (Super Admin only)
 */
router.get('/invitations', adminDashboardController.getInvitationManagement.bind(adminDashboardController));

/**
 * @route DELETE /api/admin/dashboard/invitations/:invitationId
 * @desc Cancel invitation (admin)
 * @access Private (Super Admin only)
 */
router.delete('/invitations/:invitationId', adminDashboardController.cancelInvitation.bind(adminDashboardController));

/**
 * @route GET /api/admin/dashboard/system-health
 * @desc Get system health and statistics
 * @access Private (Super Admin only)
 */
router.get('/system-health', dashboardCacheMiddleware, adminDashboardController.getSystemHealth.bind(adminDashboardController));

export default router;