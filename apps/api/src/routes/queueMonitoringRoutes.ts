/**
 * Queue Monitoring Routes
 * Routes for monitoring and managing job queues
 */

import express from 'express';
import * as queueMonitoringController from '../controllers/queueMonitoringController';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';

const router = express.Router();

// All routes require authentication and admin permissions
router.use(auth);
router.use(requirePermission('system:manage'));

/**
 * @route   GET /api/queue-monitoring/dashboard
 * @desc    Get queue dashboard with all statistics
 * @access  Private (Admin)
 */
router.get('/dashboard', queueMonitoringController.getQueueDashboard);

/**
 * @route   GET /api/queue-monitoring/stats
 * @desc    Get statistics for all queues
 * @access  Private (Admin)
 */
router.get('/stats', queueMonitoringController.getAllQueueStats);

/**
 * @route   GET /api/queue-monitoring/health
 * @desc    Get health status for all queues
 * @access  Private (Admin)
 */
router.get('/health', queueMonitoringController.getAllQueuesHealth);

/**
 * @route   GET /api/queue-monitoring/:queueName/stats
 * @desc    Get statistics for a specific queue
 * @access  Private (Admin)
 */
router.get('/:queueName/stats', queueMonitoringController.getQueueStats);

/**
 * @route   GET /api/queue-monitoring/:queueName/metrics
 * @desc    Get detailed metrics for a specific queue
 * @access  Private (Admin)
 */
router.get('/:queueName/metrics', queueMonitoringController.getQueueMetrics);

/**
 * @route   GET /api/queue-monitoring/:queueName/health
 * @desc    Get health status for a specific queue
 * @access  Private (Admin)
 */
router.get('/:queueName/health', queueMonitoringController.getQueueHealth);

/**
 * @route   POST /api/queue-monitoring/:queueName/pause
 * @desc    Pause a queue
 * @access  Private (Admin)
 */
router.post('/:queueName/pause', queueMonitoringController.pauseQueue);

/**
 * @route   POST /api/queue-monitoring/:queueName/resume
 * @desc    Resume a queue
 * @access  Private (Admin)
 */
router.post('/:queueName/resume', queueMonitoringController.resumeQueue);

/**
 * @route   POST /api/queue-monitoring/:queueName/clean
 * @desc    Clean a queue (remove old jobs)
 * @access  Private (Admin)
 */
router.post('/:queueName/clean', queueMonitoringController.cleanQueue);

/**
 * @route   POST /api/queue-monitoring/:queueName/empty
 * @desc    Empty a queue (remove all jobs)
 * @access  Private (Admin)
 */
router.post('/:queueName/empty', queueMonitoringController.emptyQueue);

/**
 * @route   GET /api/queue-monitoring/:queueName/jobs/:jobId
 * @desc    Get a specific job
 * @access  Private (Admin)
 */
router.get('/:queueName/jobs/:jobId', queueMonitoringController.getJob);

/**
 * @route   POST /api/queue-monitoring/:queueName/jobs/:jobId/retry
 * @desc    Retry a failed job
 * @access  Private (Admin)
 */
router.post('/:queueName/jobs/:jobId/retry', queueMonitoringController.retryJob);

/**
 * @route   DELETE /api/queue-monitoring/:queueName/jobs/:jobId
 * @desc    Remove a job
 * @access  Private (Admin)
 */
router.delete('/:queueName/jobs/:jobId', queueMonitoringController.removeJob);

export default router;
