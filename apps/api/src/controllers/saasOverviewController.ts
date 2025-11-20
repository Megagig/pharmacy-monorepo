import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { SystemAnalyticsService } from '../services/SystemAnalyticsService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';

/**
 * SaaS Overview Controller
 * Handles system overview metrics, health monitoring, and recent activities
 * for the SaaS Settings Module
 */
export class SaaSOverviewController {
  private systemAnalyticsService: SystemAnalyticsService;

  constructor() {
    this.systemAnalyticsService = SystemAnalyticsService.getInstance();
  }

  /**
   * Get system overview metrics
   * GET /api/admin/saas/overview/metrics
   */
  async getSystemMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching system metrics for SaaS overview', {
        userId: req.user?._id,
        userRole: req.user?.role
      });

      const metrics = await this.systemAnalyticsService.getSystemMetrics();

      const response = {
        totalUsers: metrics.totalUsers,
        activeSubscriptions: metrics.activeSubscriptions,
        totalWorkspaces: metrics.totalWorkspaces,
        monthlyRevenue: metrics.monthlyRevenue,
        systemUptime: metrics.systemUptime,
        activeFeatureFlags: metrics.activeFeatureFlags,
        pendingLicenses: metrics.pendingLicenses,
        supportTickets: metrics.supportTickets,
        generatedAt: metrics.timestamp
      };

      sendSuccess(
        res,
        response,
        'System metrics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching system metrics:', error);
      sendError(
        res,
        'METRICS_ERROR',
        'Failed to retrieve system metrics',
        500
      );
    }
  }

  /**
   * Get system health status
   * GET /api/admin/saas/overview/health
   */
  async getSystemHealth(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching system health status', {
        userId: req.user?._id,
        userRole: req.user?.role
      });

      const health = await this.systemAnalyticsService.getSystemHealth();

      sendSuccess(
        res,
        health,
        'System health status retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching system health:', error);
      sendError(
        res,
        'HEALTH_CHECK_ERROR',
        'Failed to retrieve system health status',
        500
      );
    }
  }

  /**
   * Get recent system activities
   * GET /api/admin/saas/overview/activities
   */
  async getRecentActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query;
      const limitNum = parseInt(limit as string, 10);

      logger.info('Fetching recent system activities', {
        userId: req.user?._id,
        userRole: req.user?.role,
        limit: limitNum
      });

      const activities = await this.systemAnalyticsService.getRecentActivities(limitNum);

      sendSuccess(
        res,
        { activities, limit: limitNum },
        'Recent activities retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching recent activities:', error);
      sendError(
        res,
        'ACTIVITIES_ERROR',
        'Failed to retrieve recent activities',
        500
      );
    }
  }

  /**
   * Get comprehensive system overview (combines metrics, health, and activities)
   * GET /api/admin/saas/overview
   */
  async getSystemOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching comprehensive system overview', {
        userId: req.user?._id,
        userRole: req.user?.role
      });

      // Fetch all data in parallel for better performance
      const [metrics, health, activities] = await Promise.all([
        this.systemAnalyticsService.getSystemMetrics(),
        this.systemAnalyticsService.getSystemHealth(),
        this.systemAnalyticsService.getRecentActivities(10)
      ]);

      const overview = {
        metrics: {
          totalUsers: metrics.totalUsers,
          activeSubscriptions: metrics.activeSubscriptions,
          totalWorkspaces: metrics.totalWorkspaces,
          monthlyRevenue: metrics.monthlyRevenue,
          systemUptime: metrics.systemUptime,
          activeFeatureFlags: metrics.activeFeatureFlags,
          pendingLicenses: metrics.pendingLicenses,
          supportTickets: metrics.supportTickets
        },
        health,
        activities,
        generatedAt: new Date()
      };

      sendSuccess(
        res,
        overview,
        'System overview retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching system overview:', error);
      sendError(
        res,
        'OVERVIEW_ERROR',
        'Failed to retrieve system overview',
        500
      );
    }
  }

  /**
   * Get system performance statistics
   * GET /api/admin/saas/overview/performance
   */
  async getPerformanceStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching system performance statistics', {
        userId: req.user?._id,
        userRole: req.user?.role
      });

      const health = await this.systemAnalyticsService.getSystemHealth();
      
      const performanceStats = {
        database: {
          responseTime: health.database.responseTime,
          status: health.database.status,
          connections: health.database.connections
        },
        api: {
          responseTime: health.api.responseTime,
          requestsPerMinute: health.api.requestsPerMinute,
          status: health.api.status
        },
        memory: {
          usage: health.memory.usage,
          available: health.memory.available,
          usagePercentage: ((health.memory.usage / (health.memory.usage + health.memory.available)) * 100).toFixed(2),
          status: health.memory.status
        },
        cache: {
          hitRate: health.cache.hitRate,
          connections: health.cache.connections,
          status: health.cache.status
        },
        generatedAt: new Date()
      };

      sendSuccess(
        res,
        performanceStats,
        'Performance statistics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching performance statistics:', error);
      sendError(
        res,
        'PERFORMANCE_ERROR',
        'Failed to retrieve performance statistics',
        500
      );
    }
  }

  /**
   * Refresh system metrics cache
   * POST /api/admin/saas/overview/refresh
   */
  async refreshMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Refreshing system metrics cache', {
        userId: req.user?._id,
        userRole: req.user?.role
      });

      // Clear cache to force fresh calculation
      await this.systemAnalyticsService.clearCache();
      
      // Get fresh metrics
      const metrics = await this.systemAnalyticsService.getSystemMetrics();

      sendSuccess(
        res,
        { 
          refreshedAt: new Date(),
          metrics: {
            totalUsers: metrics.totalUsers,
            activeSubscriptions: metrics.activeSubscriptions,
            totalWorkspaces: metrics.totalWorkspaces,
            monthlyRevenue: metrics.monthlyRevenue
          }
        },
        'System metrics refreshed successfully'
      );
    } catch (error) {
      logger.error('Error refreshing system metrics:', error);
      sendError(
        res,
        'REFRESH_ERROR',
        'Failed to refresh system metrics',
        500
      );
    }
  }
}

// Create and export controller instance
export const saasOverviewController = new SaaSOverviewController();