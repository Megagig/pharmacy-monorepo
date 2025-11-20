import express from 'express';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requireRole } from '../middlewares/rbac';
import {
  getAIUsageDashboard,
  getWorkspaceUsageDetails,
  suspendWorkspaceAI,
  restoreWorkspaceAI,
  updateWorkspaceLimits,
  getAIUsageAnalytics,
} from '../controllers/aiUsageMonitoringController';

const router = express.Router();

// Apply authentication to all routes
router.use(authWithWorkspace);
router.use(requireRole('super_admin'));

/**
 * @route GET /api/admin/ai-usage/dashboard
 * @desc Get comprehensive AI usage dashboard data
 * @access Private (Super Admin only)
 * @query startDate - Optional start date for filtering (ISO string)
 * @query endDate - Optional end date for filtering (ISO string)
 */
router.get('/dashboard', getAIUsageDashboard);

/**
 * @route GET /api/admin/ai-usage/workspace/:workspaceId
 * @desc Get detailed usage information for a specific workspace
 * @access Private (Super Admin only)
 * @param workspaceId - MongoDB ObjectId of the workspace
 */
router.get('/workspace/:workspaceId', getWorkspaceUsageDetails);

/**
 * @route POST /api/admin/ai-usage/workspace/:workspaceId/suspend
 * @desc Suspend AI features for a workspace
 * @access Private (Super Admin only)
 * @param workspaceId - MongoDB ObjectId of the workspace
 * @body reason - Reason for suspension (required)
 */
router.post('/workspace/:workspaceId/suspend', suspendWorkspaceAI);

/**
 * @route POST /api/admin/ai-usage/workspace/:workspaceId/restore
 * @desc Restore AI features for a workspace
 * @access Private (Super Admin only)
 * @param workspaceId - MongoDB ObjectId of the workspace
 */
router.post('/workspace/:workspaceId/restore', restoreWorkspaceAI);

/**
 * @route PUT /api/admin/ai-usage/workspace/:workspaceId/limits
 * @desc Update AI usage limits for a workspace
 * @access Private (Super Admin only)
 * @param workspaceId - MongoDB ObjectId of the workspace
 * @body requestsPerMonth - Optional monthly request limit
 * @body costBudgetPerMonth - Optional monthly cost budget in USD
 * @body dailyRequestLimit - Optional daily request limit
 */
router.put('/workspace/:workspaceId/limits', updateWorkspaceLimits);

/**
 * @route GET /api/admin/ai-usage/analytics
 * @desc Get advanced AI usage analytics with filtering
 * @access Private (Super Admin only)
 * @query startDate - Optional start date for filtering (ISO string)
 * @query endDate - Optional end date for filtering (ISO string)
 * @query workspaceId - Optional workspace ID for filtering
 * @query feature - Optional feature name for filtering
 * @query tier - Optional subscription tier for filtering
 * @query groupBy - Grouping period: 'hour', 'day', 'week', 'month' (default: 'day')
 */
router.get('/analytics', getAIUsageAnalytics);

export default router;