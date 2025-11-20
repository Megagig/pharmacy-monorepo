/**
 * Health Check Routes
 * Provides health check endpoints for patient engagement monitoring
 * Requirements: 9.1, 9.2, 9.3
 */

import express from 'express';
import { patientEngagementMonitoring } from '../services/PatientEngagementMonitoringService';
import { performanceCollector } from '../utils/performanceMonitoring';
import logger from '../utils/logger';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * Basic health check endpoint
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Basic system checks
    const checks = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
    };

    const responseTime = Date.now() - startTime;
    
    res.status(200).json({
      status: 'healthy',
      responseTime,
      checks,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Detailed health check for patient engagement services
 * GET /api/health/patient-engagement
 */
router.get('/patient-engagement', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Perform health checks for all patient engagement services
    const services = [
      'appointment_service',
      'followup_service',
      'reminder_service',
      'database',
      'queue_service',
    ];

    const healthChecks = await Promise.all(
      services.map(async (service) => {
        try {
          return await patientEngagementMonitoring.performHealthCheck(service);
        } catch (error) {
          return {
            service,
            status: 'unhealthy' as const,
            responseTime: 0,
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
            timestamp: new Date(),
          };
        }
      })
    );

    // Determine overall status
    const unhealthyServices = healthChecks.filter(h => h.status === 'unhealthy');
    const degradedServices = healthChecks.filter(h => h.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      responseTime,
      services: healthChecks,
      summary: {
        total: services.length,
        healthy: healthChecks.filter(h => h.status === 'healthy').length,
        degraded: degradedServices.length,
        unhealthy: unhealthyServices.length,
      },
    });
  } catch (error) {
    logger.error('Patient engagement health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Readiness probe - checks if the service is ready to accept traffic
 * GET /api/health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const checks = {
      database: mongoose.connection.readyState === 1,
      memory: process.memoryUsage().heapUsed < 1024 * 1024 * 1024, // Less than 1GB
    };

    const isReady = Object.values(checks).every(Boolean);
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        checks,
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        checks,
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Liveness probe - checks if the service is alive
 * GET /api/health/live
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Performance metrics endpoint
 * GET /api/health/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const endTime = new Date();
    const workplaceId = req.query.workplaceId as string;

    // Get dashboard data
    const dashboardData = await patientEngagementMonitoring.getDashboardData(
      startTime,
      endTime,
      workplaceId
    );

    // Get performance report from global collector
    const performanceReport = performanceCollector.generatePerformanceReport(
      startTime,
      endTime
    );

    res.json({
      patientEngagement: dashboardData,
      systemPerformance: performanceReport,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Error analysis endpoint
 * GET /api/health/errors
 */
router.get('/errors', async (req, res) => {
  try {
    const startTime = req.query.startTime 
      ? new Date(req.query.startTime as string)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const endTime = req.query.endTime 
      ? new Date(req.query.endTime as string)
      : new Date();
    const workplaceId = req.query.workplaceId as string;

    const errorAnalysis = patientEngagementMonitoring.getErrorAnalysis(
      startTime,
      endTime,
      workplaceId
    );

    res.json({
      ...errorAnalysis,
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error analysis endpoint failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Alerts endpoint
 * GET /api/health/alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const dashboardData = await patientEngagementMonitoring.getDashboardData();
    
    res.json({
      activeAlerts: dashboardData.alerts,
      summary: {
        total: dashboardData.alerts.length,
        critical: dashboardData.alerts.filter(a => a.severity === 'critical').length,
        high: dashboardData.alerts.filter(a => a.severity === 'high').length,
        medium: dashboardData.alerts.filter(a => a.severity === 'medium').length,
        low: dashboardData.alerts.filter(a => a.severity === 'low').length,
      },
    });
  } catch (error) {
    logger.error('Alerts endpoint failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Resolve alert endpoint
 * POST /api/health/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const resolved = patientEngagementMonitoring.resolveAlert(alertId);
    
    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Alert not found or already resolved',
      });
    }
  } catch (error) {
    logger.error('Alert resolution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * System information endpoint
 * GET /api/health/system
 */
router.get('/system', (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000), // ms
        system: Math.round(cpuUsage.system / 1000), // ms
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || '5000',
        mongoUri: process.env.MONGO_URI ? 'configured' : 'not_configured',
        redisHost: process.env.REDIS_HOST || 'localhost',
      },
    });
  } catch (error) {
    logger.error('System info endpoint failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;