import express from 'express';
import { query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { performanceMonitoringService } from '../services/PerformanceMonitoringService';
import { auth, AuthRequest } from '../middlewares/auth';

const router = express.Router();

// Rate limiting for performance monitoring endpoints
const monitoringRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  message: 'Too many performance monitoring requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(monitoringRateLimit);
router.use(auth); // Require authentication for all monitoring endpoints

// Get performance overview
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const workspaceId = (req.user as any)?.workplaceId;
    const overview = await performanceMonitoringService.getPerformanceOverview(workspaceId);

    res.json({
      success: true,
      overview,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting performance overview:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get performance trends
router.get('/trends', [
  query('period').optional().isIn(['24h', '7d', '30d']).withMessage('Invalid period'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = '7d' } = req.query;
    const workspaceId = (req.user as any)?.workplaceId;

    const trends = await performanceMonitoringService.getPerformanceTrends(
      period as '24h' | '7d' | '30d',
      workspaceId
    );

    res.json({
      success: true,
      trends,
      period,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting performance trends:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Generate performance report
router.get('/report', [
  query('period').optional().isIn(['24h', '7d', '30d']).withMessage('Invalid period'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = '7d' } = req.query;
    const workspaceId = (req.user as any)?.workplaceId;

    const report = await performanceMonitoringService.generatePerformanceReport(
      period as '24h' | '7d' | '30d',
      workspaceId
    );

    res.json({
      success: true,
      report,
    });

  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get performance alerts
router.get('/alerts', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
  query('resolved').optional().isBoolean().withMessage('Invalid resolved filter'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { limit = 50 } = req.query;
    const workspaceId = (req.user as any)?.workplaceId;

    const alerts = await performanceMonitoringService.getPerformanceAlerts(
      workspaceId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      alerts,
      count: alerts.length,
    });

  } catch (error) {
    console.error('Error getting performance alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Resolve performance alert
router.post('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;

    const resolved = await performanceMonitoringService.resolveAlert(alertId);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully',
    });

  } catch (error) {
    console.error('Error resolving performance alert:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get performance metrics summary for dashboard
router.get('/metrics/summary', [
  query('period').optional().isIn(['1h', '24h', '7d']).withMessage('Invalid period'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = '24h' } = req.query;
    const workspaceId = (req.user as any)?.workplaceId;

    // Get overview and trends for summary
    const [overview, trends] = await Promise.all([
      performanceMonitoringService.getPerformanceOverview(workspaceId),
      performanceMonitoringService.getPerformanceTrends(period as '24h' | '7d' | '30d', workspaceId),
    ]);

    // Calculate summary metrics
    const summary = {
      webVitals: {
        score: overview.webVitals.summary.budgetStatus ?
          Object.values(overview.webVitals.summary.budgetStatus).filter(s => s === 'good').length /
          Object.keys(overview.webVitals.summary.budgetStatus).length * 100 : 0,
        violations: overview.webVitals.recentViolations,
        trend: overview.webVitals.trendDirection,
      },
      lighthouse: {
        score: overview.lighthouse.latestScores.performance || 0,
        violations: overview.lighthouse.budgetViolations,
        trend: overview.lighthouse.trendDirection,
      },
      budgets: {
        compliance: 100 - overview.budgets.violationRate,
        violations: overview.budgets.recentViolations,
        activeBudgets: overview.budgets.activeBudgets,
      },
      api: {
        latency: overview.api.p95Latency,
        errorRate: overview.api.errorRate,
        trend: overview.api.trendDirection,
      },
      alerts: {
        active: overview.alerts.activeAlerts,
        critical: overview.alerts.criticalAlerts,
      },
    };

    res.json({
      success: true,
      summary,
      period,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting performance metrics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get performance recommendations
router.get('/recommendations', async (req: AuthRequest, res) => {
  try {
    const workspaceId = (req.user as any)?.workplaceId;

    // Get overview to generate recommendations
    const overview = await performanceMonitoringService.getPerformanceOverview(workspaceId);

    res.json({
      success: true,
      recommendations: overview.recommendations,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting performance recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Health check endpoint for monitoring system
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      webVitals: 'operational',
      lighthouse: 'operational',
      budgets: 'operational',
      alerts: 'operational',
    },
  });
});

export default router;
