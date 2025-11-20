/**
 * Analytics Routes
 * Routes for diagnostic analytics, reporting, and performance metrics
 */

import { Router } from 'express';
import analyticsController from '../controllers/analyticsController';
import { auth } from '../../../middlewares/auth';
import diagnosticRBAC from '../middlewares/diagnosticRBAC';
import rateLimiting from '../../../middlewares/rateLimiting';

const router = Router();

// Apply authentication and RBAC to all routes
router.use(auth);
router.use(diagnosticRBAC.requireDiagnosticAnalytics);

// Apply rate limiting for analytics endpoints
router.use(rateLimiting.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many analytics requests, please try again later'
}));

/**
 * @route GET /api/diagnostics/analytics/dashboard
 * @desc Get dashboard summary with key metrics
 * @access Private (requires diagnostic:analytics permission)
 * @query period - Time period (7d, 30d, 90d)
 */
router.get('/dashboard', analyticsController.getDashboardSummary);

/**
 * @route GET /api/diagnostics/analytics/metrics
 * @desc Get diagnostic metrics
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for metrics (ISO string)
 * @query endDate - End date for metrics (ISO string)
 */
router.get('/metrics', analyticsController.getDiagnosticMetrics);

/**
 * @route GET /api/diagnostics/analytics/ai-performance
 * @desc Get AI performance metrics
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for metrics (ISO string)
 * @query endDate - End date for metrics (ISO string)
 */
router.get('/ai-performance', analyticsController.getAIPerformanceMetrics);

/**
 * @route GET /api/diagnostics/analytics/patient-outcomes
 * @desc Get patient outcome metrics
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for metrics (ISO string)
 * @query endDate - End date for metrics (ISO string)
 */
router.get('/patient-outcomes', analyticsController.getPatientOutcomeMetrics);

/**
 * @route GET /api/diagnostics/analytics/usage
 * @desc Get usage analytics
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for analytics (ISO string)
 * @query endDate - End date for analytics (ISO string)
 */
router.get('/usage', analyticsController.getUsageAnalytics);

/**
 * @route GET /api/diagnostics/analytics/trends
 * @desc Get trend analysis
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for analysis (ISO string)
 * @query endDate - End date for analysis (ISO string)
 */
router.get('/trends', analyticsController.getTrendAnalysis);

/**
 * @route GET /api/diagnostics/analytics/comparison
 * @desc Get comparison analysis between manual and AI-assisted diagnoses
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for comparison (ISO string)
 * @query endDate - End date for comparison (ISO string)
 */
router.get('/comparison', analyticsController.getComparisonAnalysis);

/**
 * @route GET /api/diagnostics/analytics/report
 * @desc Generate comprehensive analytics report
 * @access Private (requires diagnostic:analytics permission)
 * @query startDate - Start date for report (ISO string)
 * @query endDate - End date for report (ISO string)
 * @query format - Report format (json, pdf)
 */
router.get('/report', analyticsController.generateAnalyticsReport);

export default router;