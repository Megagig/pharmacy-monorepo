/**
 * Monitoring Routes
 * 
 * API routes for post-launch monitoring, system health, user feedback,
 * and success metrics tracking.
 */

import express from 'express';
import monitoringController from '../controllers/monitoringController';
import { auth } from '../middlewares/auth';
import { loadWorkspaceContext } from '../middlewares/workspaceContext';

const router = express.Router();

// Public health check endpoints (no authentication required)
router.get('/health', monitoringController.healthCheck);

// Protected endpoints (require authentication)
router.use(auth);
router.use(loadWorkspaceContext);

// System health and metrics
router.get('/system-health', monitoringController.getSystemHealth);
router.get('/system-health/detailed', monitoringController.detailedHealthCheck);
router.get('/success-metrics', monitoringController.getSuccessMetrics);
router.get('/alerts', monitoringController.getSystemAlerts);

// User feedback
router.post('/feedback', monitoringController.submitFeedback);
router.get('/feedback/summary', monitoringController.getFeedbackSummary);

// Reporting and analytics
router.get('/report', monitoringController.getMonitoringReport);
router.get('/phase2-plan', monitoringController.getPhase2Plan);

// Rollout management
router.get('/rollout/status', monitoringController.getRolloutStatus);

export default router;