import { Router } from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { saasOverviewController } from '../controllers/saasOverviewController';

const router = Router();

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * SaaS Overview Routes
 * All routes require super admin privileges
 */

// Get system metrics
router.get('/metrics', saasOverviewController.getSystemMetrics.bind(saasOverviewController));

// Get system health status
router.get('/health', saasOverviewController.getSystemHealth.bind(saasOverviewController));

// Get recent system activities
router.get('/activities', saasOverviewController.getRecentActivities.bind(saasOverviewController));

// Get comprehensive system overview
router.get('/', saasOverviewController.getSystemOverview.bind(saasOverviewController));

// Get performance statistics
router.get('/performance', saasOverviewController.getPerformanceStats.bind(saasOverviewController));

// Refresh metrics cache
router.post('/refresh', saasOverviewController.refreshMetrics.bind(saasOverviewController));

export default router;