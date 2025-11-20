/**
 * Continuous Monitoring Routes
 * 
 * API endpoints for managing continuous performance monitoring
 */

import { Router } from 'express';
import { auth } from '../middlewares/auth';
import rbac from '../middlewares/rbac';
import ContinuousMonitoringService from '../services/ContinuousMonitoringService';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * Start continuous monitoring
 * POST /api/continuous-monitoring/start
 */
router.post('/start', auth, rbac.requireRole('admin', 'deployment_manager'), async (req: AuthRequest, res) => {
  try {
    const { config } = req.body;

    await ContinuousMonitoringService.start(config);

    const status = ContinuousMonitoringService.getStatus();

    logger.info(`Continuous monitoring started by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Continuous monitoring started',
      data: status,
    });

  } catch (error) {
    logger.error('Error starting continuous monitoring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start continuous monitoring',
      error: error.message,
    });
  }
});

/**
 * Stop continuous monitoring
 * POST /api/continuous-monitoring/stop
 */
router.post('/stop', auth, rbac.requireRole('admin', 'deployment_manager'), async (req: AuthRequest, res) => {
  try {
    await ContinuousMonitoringService.stop();

    logger.info(`Continuous monitoring stopped by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Continuous monitoring stopped',
    });

  } catch (error) {
    logger.error('Error stopping continuous monitoring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop continuous monitoring',
      error: error.message,
    });
  }
});

/**
 * Get monitoring status
 * GET /api/continuous-monitoring/status
 */
router.get('/status', auth, rbac.requireRole('admin', 'deployment_manager', 'viewer'), async (req, res) => {
  try {
    const status = ContinuousMonitoringService.getStatus();

    res.json({
      success: true,
      data: status,
    });

  } catch (error) {
    logger.error('Error getting monitoring status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get monitoring status',
      error: error.message,
    });
  }
});

/**
 * Update monitoring configuration
 * PUT /api/continuous-monitoring/config
 */
router.put('/config', auth, rbac.requireRole('admin', 'deployment_manager'), async (req: AuthRequest, res) => {
  try {
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Configuration is required',
      });
    }

    await ContinuousMonitoringService.updateConfig(config);

    const status = ContinuousMonitoringService.getStatus();

    logger.info(`Monitoring configuration updated by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Monitoring configuration updated',
      data: status,
    });

  } catch (error) {
    logger.error('Error updating monitoring configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update monitoring configuration',
      error: error.message,
    });
  }
});

/**
 * Get default monitoring configuration
 * GET /api/continuous-monitoring/default-config
 */
router.get('/default-config', auth, rbac.requireRole('admin', 'deployment_manager', 'viewer'), async (req, res) => {
  try {
    const defaultConfig = {
      webVitals: {
        enabled: true,
        collectionInterval: 5, // 5 minutes
        alertThresholds: {
          LCP: 2500,
          FID: 100,
          CLS: 0.1,
          TTFB: 800,
        },
      },
      lighthouse: {
        enabled: true,
        schedule: '0 */6 * * *', // Every 6 hours
        urls: [
          process.env.PRODUCTION_URL || 'https://app.PharmacyCopilot.com',
        ],
        alertThresholds: {
          performance: 85,
          accessibility: 90,
          bestPractices: 90,
          seo: 90,
        },
      },
      apiLatency: {
        enabled: true,
        monitoringInterval: 10, // 10 minutes
        endpoints: [
          '/api/patients',
          '/api/notes',
          '/api/medications',
          '/api/dashboard/overview',
        ],
        alertThresholds: {
          p95: 1000,
          errorRate: 5,
        },
      },
      regressionDetection: {
        enabled: true,
        analysisInterval: 30, // 30 minutes
        lookbackPeriod: 24, // 24 hours
        regressionThreshold: 10, // 10% degradation
      },
      reporting: {
        dailyReport: true,
        weeklyReport: true,
        monthlyReport: true,
        recipients: process.env.PERFORMANCE_REPORT_RECIPIENTS?.split(',') || [],
      },
    };

    res.json({
      success: true,
      data: defaultConfig,
    });

  } catch (error) {
    logger.error('Error getting default configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get default configuration',
      error: error.message,
    });
  }
});

export default router;
