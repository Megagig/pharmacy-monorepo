import express from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { superAdminDashboardController } from '../controllers/superAdminDashboardController';
import { dashboardCacheMiddleware } from '../middlewares/cacheMiddleware';

const router = express.Router();

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * @route GET /api/super-admin/dashboard/overview
 * @desc Get comprehensive system-wide dashboard overview for super admins
 * @access Private (Super Admin Only)
 */
router.get('/overview', dashboardCacheMiddleware, superAdminDashboardController.getSystemOverview.bind(superAdminDashboardController));

/**
 * @route GET /api/super-admin/dashboard/workspaces
 * @desc Get all workspaces for super admin workspace switching
 * @access Private (Super Admin Only)
 */
router.get('/workspaces', dashboardCacheMiddleware, superAdminDashboardController.getAllWorkspaces.bind(superAdminDashboardController));

/**
 * @route GET /api/super-admin/dashboard/workspace/:workspaceId
 * @desc Get detailed information for a specific workspace
 * @access Private (Super Admin Only)
 */
router.get('/workspace/:workspaceId', dashboardCacheMiddleware, superAdminDashboardController.getWorkspaceDetails.bind(superAdminDashboardController));

/**
 * @route GET /api/super-admin/dashboard/clinical-interventions
 * @desc Get system-wide clinical interventions metrics
 * @access Private (Super Admin Only)
 */
router.get('/clinical-interventions', dashboardCacheMiddleware, superAdminDashboardController.getClinicalInterventionsSystemWide.bind(superAdminDashboardController));

/**
 * @route GET /api/super-admin/dashboard/activities
 * @desc Get system-wide recent activities from all workspaces
 * @access Private (Super Admin Only)
 */
router.get('/activities', dashboardCacheMiddleware, superAdminDashboardController.getActivitiesSystemWide.bind(superAdminDashboardController));

/**
 * @route GET /api/super-admin/dashboard/communications
 * @desc Get system-wide communication metrics
 * @access Private (Super Admin Only)
 */
router.get('/communications', dashboardCacheMiddleware, superAdminDashboardController.getCommunicationsSystemWide.bind(superAdminDashboardController));

export default router;