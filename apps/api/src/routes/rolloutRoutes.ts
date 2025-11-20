/**
 * Rollout Routes
 * 
 * API routes for managing and monitoring the patient engagement rollout.
 * These routes are protected and require admin access.
 */

import express from 'express';
import { body, query } from 'express-validator';
import { validateRequest } from '../middlewares/validation';
import { auth } from '../middlewares/auth';
import rolloutController from '../controllers/rolloutController';

const router = express.Router();

// Apply authentication to all rollout routes
router.use(auth);

/**
 * @route   GET /api/rollout/status
 * @desc    Get current rollout status
 * @access  Super Admin
 */
router.get('/status', rolloutController.getRolloutStatus);

/**
 * @route   PUT /api/rollout/percentage
 * @desc    Update rollout percentage
 * @access  Super Admin
 */
router.put('/percentage', [
  body('percentage')
    .isNumeric()
    .withMessage('Percentage must be a number')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Percentage must be between 0 and 100'),
  body('phaseDescription')
    .optional()
    .isString()
    .withMessage('Phase description must be a string'),
  body('monitoringPeriod')
    .optional()
    .isNumeric()
    .withMessage('Monitoring period must be a number'),
  body('rollbackThreshold')
    .optional()
    .isNumeric()
    .withMessage('Rollback threshold must be a number'),
  validateRequest
], rolloutController.updateRolloutPercentage);

/**
 * @route   GET /api/rollout/metrics
 * @desc    Get rollout metrics
 * @access  Super Admin
 */
router.get('/metrics', rolloutController.getRolloutMetrics);

/**
 * @route   GET /api/rollout/workspaces
 * @desc    Get enabled workspaces
 * @access  Super Admin
 */
router.get('/workspaces', rolloutController.getEnabledWorkspaces);

/**
 * @route   GET /api/rollout/report
 * @desc    Generate comprehensive rollout report
 * @access  Super Admin
 */
router.get('/report', rolloutController.generateRolloutReport);

/**
 * @route   GET /api/rollout/monitor
 * @desc    Perform monitoring check
 * @access  Super Admin
 */
router.get('/monitor', rolloutController.performMonitoringCheckAPI);

/**
 * @route   GET /api/rollout/pause-check
 * @desc    Check if rollout should be paused
 * @access  Super Admin
 */
router.get('/pause-check', [
  query('errorThreshold')
    .optional()
    .isNumeric()
    .withMessage('Error threshold must be a number'),
  validateRequest
], rolloutController.checkPauseConditions);

/**
 * @route   POST /api/rollout/pause
 * @desc    Pause rollout
 * @access  Super Admin
 */
router.post('/pause', [
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string'),
  validateRequest
], rolloutController.pauseRollout);

/**
 * @route   GET /api/rollout/health
 * @desc    Get rollout health score
 * @access  Manager, Super Admin
 */
router.get('/health', rolloutController.getRolloutHealth);

export default router;