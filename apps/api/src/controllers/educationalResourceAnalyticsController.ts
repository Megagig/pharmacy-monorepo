import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';
import { PatientAuthRequest } from '../middlewares/patientAuth';
import EducationalResource from '../models/EducationalResource';
import logger from '../utils/logger';
import { asyncHandler, sendSuccess, sendError, getRequestContext } from '../utils/responseHelpers';

/**
 * Track dashboard view (when resource is seen on dashboard)
 * POST /api/educational-resources/:id/analytics/dashboard-view
 */
export const trackDashboardView = asyncHandler(
  async (req: AuthRequest | PatientAuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const resource = await EducationalResource.findById(id);
      
      if (!resource) {
        return sendError(res, 'NOT_FOUND', 'Educational resource not found', 404);
      }

      await resource.trackDashboardView();

      sendSuccess(res, {}, 'Dashboard view tracked successfully');
    } catch (error) {
      logger.error('Error tracking dashboard view:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to track dashboard view', 500);
    }
  }
);

/**
 * Track dashboard click (when resource is clicked from dashboard)
 * POST /api/educational-resources/:id/analytics/dashboard-click
 */
export const trackDashboardClick = asyncHandler(
  async (req: AuthRequest | PatientAuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const resource = await EducationalResource.findById(id);
      
      if (!resource) {
        return sendError(res, 'NOT_FOUND', 'Educational resource not found', 404);
      }

      await resource.trackDashboardClick();

      sendSuccess(res, {}, 'Dashboard click tracked successfully');
    } catch (error) {
      logger.error('Error tracking dashboard click:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to track dashboard click', 500);
    }
  }
);

/**
 * Track education page view
 * POST /api/educational-resources/:id/analytics/page-view
 */
export const trackEducationPageView = asyncHandler(
  async (req: AuthRequest | PatientAuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const resource = await EducationalResource.findById(id);
      
      if (!resource) {
        return sendError(res, 'NOT_FOUND', 'Educational resource not found', 404);
      }

      await resource.trackEducationPageView();

      sendSuccess(res, {}, 'Education page view tracked successfully');
    } catch (error) {
      logger.error('Error tracking education page view:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to track education page view', 500);
    }
  }
);

/**
 * Track time spent on resource
 * POST /api/educational-resources/:id/analytics/time-spent
 */
export const trackTimeSpent = asyncHandler(
  async (req: AuthRequest | PatientAuthRequest, res: Response) => {
    const { id } = req.params;
    const { timeSpent } = req.body; // in seconds

    if (!timeSpent || timeSpent < 0) {
      return sendError(res, 'VALIDATION_ERROR', 'Valid time spent is required', 400);
    }

    try {
      const resource = await EducationalResource.findById(id);
      
      if (!resource) {
        return sendError(res, 'NOT_FOUND', 'Educational resource not found', 404);
      }

      await resource.updateAverageTimeSpent(timeSpent);

      sendSuccess(res, {}, 'Time spent tracked successfully');
    } catch (error) {
      logger.error('Error tracking time spent:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to track time spent', 500);
    }
  }
);

/**
 * Get analytics for a specific resource (Admin only)
 * GET /api/educational-resources/:id/analytics
 */
export const getResourceAnalytics = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const resource = await EducationalResource.findById(id)
        .select('title slug analytics viewCount downloadCount ratings displayLocations isPinned isScheduled scheduledStartDate scheduledEndDate');
      
      if (!resource) {
        return sendError(res, 'NOT_FOUND', 'Educational resource not found', 404);
      }

      const analyticsData = {
        resourceId: resource._id,
        title: resource.title,
        slug: resource.slug,
        displaySettings: {
          displayLocations: resource.displayLocations,
          isPinned: resource.isPinned,
          isScheduled: resource.isScheduled,
          scheduledStartDate: resource.scheduledStartDate,
          scheduledEndDate: resource.scheduledEndDate,
        },
        analytics: {
          dashboardViews: resource.analytics.dashboardViews,
          dashboardClicks: resource.analytics.dashboardClicks,
          educationPageViews: resource.analytics.educationPageViews,
          totalViews: resource.viewCount,
          downloads: resource.downloadCount,
          clickThroughRate: resource.analytics.clickThroughRate,
          averageTimeSpent: resource.analytics.averageTimeSpent,
          completionRate: resource.analytics.completionRate,
          lastViewedAt: resource.analytics.lastViewedAt,
        },
        engagement: {
          averageRating: resource.ratings.averageRating,
          totalRatings: resource.ratings.totalRatings,
          ratingBreakdown: resource.ratings.ratingBreakdown,
        },
      };

      sendSuccess(res, analyticsData, 'Resource analytics retrieved successfully');
    } catch (error) {
      logger.error('Error retrieving resource analytics:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to retrieve resource analytics', 500);
    }
  }
);

/**
 * Get aggregated analytics for all resources (Admin only)
 * GET /api/educational-resources/analytics/summary
 */
export const getAnalyticsSummary = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const context = getRequestContext(req);
    const workplaceId = new mongoose.Types.ObjectId(context.workplaceId);

    try {
      const resources = await EducationalResource.find({
        $or: [
          { workplaceId },
          { workplaceId: null }
        ],
        isPublished: true,
        isDeleted: false,
      });

      const summary = {
        totalResources: resources.length,
        totalViews: resources.reduce((sum, r) => sum + r.viewCount, 0),
        totalDownloads: resources.reduce((sum, r) => sum + r.downloadCount, 0),
        totalDashboardViews: resources.reduce((sum, r) => sum + (r.analytics?.dashboardViews || 0), 0),
        totalDashboardClicks: resources.reduce((sum, r) => sum + (r.analytics?.dashboardClicks || 0), 0),
        totalEducationPageViews: resources.reduce((sum, r) => sum + (r.analytics?.educationPageViews || 0), 0),
        averageRating: resources.reduce((sum, r) => sum + r.ratings.averageRating, 0) / resources.length,
        totalRatings: resources.reduce((sum, r) => sum + r.ratings.totalRatings, 0),
        averageClickThroughRate: resources.reduce((sum, r) => sum + (r.analytics?.clickThroughRate || 0), 0) / resources.length,
        averageTimeSpent: resources.reduce((sum, r) => sum + (r.analytics?.averageTimeSpent || 0), 0) / resources.length,
        resourcesByDisplayLocation: {
          patientDashboard: resources.filter(r => r.displayLocations.includes('patient_dashboard')).length,
          workspaceDashboard: resources.filter(r => r.displayLocations.includes('workspace_dashboard')).length,
          educationPage: resources.filter(r => r.displayLocations.includes('education_page')).length,
        },
        pinnedResources: resources.filter(r => r.isPinned).length,
        scheduledResources: resources.filter(r => r.isScheduled).length,
        topPerformingResources: resources
          .sort((a, b) => b.viewCount - a.viewCount)
          .slice(0, 10)
          .map(r => ({
            id: r._id,
            title: r.title,
            slug: r.slug,
            views: r.viewCount,
            rating: r.ratings.averageRating,
            clickThroughRate: r.analytics?.clickThroughRate || 0,
          })),
      };

      sendSuccess(res, summary, 'Analytics summary retrieved successfully');
    } catch (error) {
      logger.error('Error retrieving analytics summary:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to retrieve analytics summary', 500);
    }
  }
);

export default {
  trackDashboardView,
  trackDashboardClick,
  trackEducationPageView,
  trackTimeSpent,
  getResourceAnalytics,
  getAnalyticsSummary,
};
