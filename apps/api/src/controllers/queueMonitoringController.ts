/**
 * Queue Monitoring Controller
 * Provides endpoints for monitoring and managing job queues
 */

import { Request, Response } from 'express';
import QueueService from '../services/QueueService';
import { QueueName } from '../config/queue';
import logger from '../utils/logger';

/**
 * Get all queue statistics
 */
export const getAllQueueStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await QueueService.getAllQueueStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting all queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue statistics',
      error: error.message,
    });
  }
};

/**
 * Get statistics for a specific queue
 */
export const getQueueStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    const stats = await QueueService.getQueueStats(queueName as QueueName);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue statistics',
      error: error.message,
    });
  }
};

/**
 * Get detailed metrics for a specific queue
 */
export const getQueueMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    const metrics = await QueueService.getQueueMetrics(queueName as QueueName);

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Error getting queue metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue metrics',
      error: error.message,
    });
  }
};

/**
 * Get health status for all queues
 */
export const getAllQueuesHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await QueueService.getAllQueuesHealth();

    const overallHealth = health.every((q) => q.isHealthy);

    res.status(overallHealth ? 200 : 503).json({
      success: true,
      data: {
        overallHealth,
        queues: health,
      },
    });
  } catch (error) {
    logger.error('Error getting queues health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queues health',
      error: error.message,
    });
  }
};

/**
 * Get health status for a specific queue
 */
export const getQueueHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    const health = await QueueService.getQueueHealth(queueName as QueueName);

    res.status(health.isHealthy ? 200 : 503).json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Error getting queue health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue health',
      error: error.message,
    });
  }
};

/**
 * Pause a queue
 */
export const pauseQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    await QueueService.pauseQueue(queueName as QueueName);

    res.status(200).json({
      success: true,
      message: `Queue ${queueName} paused successfully`,
    });
  } catch (error) {
    logger.error('Error pausing queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause queue',
      error: error.message,
    });
  }
};

/**
 * Resume a queue
 */
export const resumeQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    await QueueService.resumeQueue(queueName as QueueName);

    res.status(200).json({
      success: true,
      message: `Queue ${queueName} resumed successfully`,
    });
  } catch (error) {
    logger.error('Error resuming queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume queue',
      error: error.message,
    });
  }
};

/**
 * Clean a queue
 */
export const cleanQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName } = req.params;
    const { grace = 0, status = 'completed' } = req.body;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    const validStatuses = ['completed', 'failed', 'delayed', 'active', 'wait'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', '),
      });
      return;
    }

    const jobs = await QueueService.cleanQueue(
      queueName as QueueName,
      grace,
      status as any
    );

    res.status(200).json({
      success: true,
      message: `Queue ${queueName} cleaned successfully`,
      data: {
        removedCount: jobs.length,
      },
    });
  } catch (error) {
    logger.error('Error cleaning queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean queue',
      error: error.message,
    });
  }
};

/**
 * Empty a queue (remove all jobs)
 */
export const emptyQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    await QueueService.emptyQueue(queueName as QueueName);

    res.status(200).json({
      success: true,
      message: `Queue ${queueName} emptied successfully`,
    });
  } catch (error) {
    logger.error('Error emptying queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to empty queue',
      error: error.message,
    });
  }
};

/**
 * Get a specific job
 */
export const getJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName, jobId } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    const job = await QueueService.getJob(queueName as QueueName, jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress(),
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
      },
    });
  } catch (error) {
    logger.error('Error getting job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job',
      error: error.message,
    });
  }
};

/**
 * Retry a failed job
 */
export const retryJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName, jobId } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    await QueueService.retryJob(queueName as QueueName, jobId);

    res.status(200).json({
      success: true,
      message: 'Job retried successfully',
    });
  } catch (error) {
    logger.error('Error retrying job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry job',
      error: error.message,
    });
  }
};

/**
 * Remove a job
 */
export const removeJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName, jobId } = req.params;

    if (!Object.values(QueueName).includes(queueName as QueueName)) {
      res.status(400).json({
        success: false,
        message: 'Invalid queue name',
      });
      return;
    }

    await QueueService.removeJob(queueName as QueueName, jobId);

    res.status(200).json({
      success: true,
      message: 'Job removed successfully',
    });
  } catch (error) {
    logger.error('Error removing job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove job',
      error: error.message,
    });
  }
};

/**
 * Get queue dashboard data
 */
export const getQueueDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const [stats, health] = await Promise.all([
      QueueService.getAllQueueStats(),
      QueueService.getAllQueuesHealth(),
    ]);

    // Calculate totals
    const totals = Object.values(stats).reduce(
      (acc, queueStats) => ({
        waiting: acc.waiting + queueStats.waiting,
        active: acc.active + queueStats.active,
        completed: acc.completed + queueStats.completed,
        failed: acc.failed + queueStats.failed,
        delayed: acc.delayed + queueStats.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    );

    const overallHealth = health.every((q) => q.isHealthy);

    res.status(200).json({
      success: true,
      data: {
        totals,
        overallHealth,
        queues: Object.entries(stats).map(([name, queueStats]) => {
          const queueHealth = health.find((h) => h.name === name);
          return {
            name,
            stats: queueStats,
            health: queueHealth,
          };
        }),
      },
    });
  } catch (error) {
    logger.error('Error getting queue dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue dashboard',
      error: error.message,
    });
  }
};
