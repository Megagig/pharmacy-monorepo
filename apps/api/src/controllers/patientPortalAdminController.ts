import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import patientPortalAdminService from '../services/PatientPortalAdminService';
import patientPortalAnalyticsService from '../services/PatientPortalAnalyticsService';
import logger from '../utils/logger';
import { validateObjectId } from '../utils/validation';

// Extend Request interface for workspace admin context
interface WorkspaceAdminRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    role: string;
  };
  workplaceId?: mongoose.Types.ObjectId;
}

/**
 * Helper function to get the correct workplaceId
 * Prioritizes req.workplaceId (set by middleware for super admin override)
 * Falls back to req.user!.workplaceId (logged-in user's workspace)
 */
function getWorkplaceId(req: WorkspaceAdminRequest): mongoose.Types.ObjectId {
  return req.workplaceId || req.user!.workplaceId;
}

export class PatientPortalAdminController {
  /**
   * Get patient portal users with filtering and pagination
   * GET /api/workspace-admin/patient-portal/users
   */
  async getPatientPortalUsers(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      // Extract query parameters
      const {
        status,
        search,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
      } = req.query;

      // Build filters
      const filters: any = {};
      if (status) filters.status = status as string;
      if (search) filters.search = search as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);

      // Build pagination
      const pagination = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      };

      const result = await patientPortalAdminService.getPatientPortalUsers(
        workplaceId,
        filters,
        pagination
      );

      logger.info('Retrieved patient portal users', {
        workplaceId,
        userId: req.user!._id,
        filters,
        pagination,
        resultCount: result.users.length,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting patient portal users', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Approve a patient user account
   * POST /api/workspace-admin/patient-portal/users/:patientUserId/approve
   */
  async approvePatientUser(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const { patientUserId } = req.params;

      // Validate patient user ID
      if (!validateObjectId(patientUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid patient user ID',
        });
        return;
      }

      const result = await patientPortalAdminService.approvePatientUser(
        workplaceId,
        new mongoose.Types.ObjectId(patientUserId),
        req.user!._id
      );

      logger.info('Patient user approved', {
        workplaceId,
        patientUserId,
        approvedBy: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Patient user approved successfully',
      });
    } catch (error: any) {
      logger.error('Error approving patient user', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        patientUserId: req.params.patientUserId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Suspend a patient user account
   * POST /api/workspace-admin/patient-portal/users/:patientUserId/suspend
   */
  async suspendPatientUser(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const { patientUserId } = req.params;
      const { reason } = req.body;

      // Validate patient user ID
      if (!validateObjectId(patientUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid patient user ID',
        });
        return;
      }

      // Validate reason
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Suspension reason is required',
        });
        return;
      }

      if (reason.length > 500) {
        res.status(400).json({
          success: false,
          error: 'Suspension reason cannot exceed 500 characters',
        });
        return;
      }

      const result = await patientPortalAdminService.suspendPatientUser(
        workplaceId,
        new mongoose.Types.ObjectId(patientUserId),
        reason.trim(),
        req.user!._id
      );

      logger.info('Patient user suspended', {
        workplaceId,
        patientUserId,
        reason: reason.trim(),
        suspendedBy: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Patient user suspended successfully',
      });
    } catch (error: any) {
      logger.error('Error suspending patient user', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        patientUserId: req.params.patientUserId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Reactivate a suspended patient user account
   * POST /api/workspace-admin/patient-portal/users/:patientUserId/reactivate
   */
  async reactivatePatientUser(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const { patientUserId } = req.params;

      // Validate patient user ID
      if (!validateObjectId(patientUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid patient user ID',
        });
        return;
      }

      const result = await patientPortalAdminService.reactivatePatientUser(
        workplaceId,
        new mongoose.Types.ObjectId(patientUserId),
        req.user!._id
      );

      logger.info('Patient user reactivated', {
        workplaceId,
        patientUserId,
        reactivatedBy: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Patient user reactivated successfully',
      });
    } catch (error: any) {
      logger.error('Error reactivating patient user', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        patientUserId: req.params.patientUserId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get refill requests with filtering and pagination
   * GET /api/workspace-admin/patient-portal/refill-requests
   */
  async getRefillRequests(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      // Extract query parameters
      const {
        status,
        urgency,
        patientId,
        assignedTo,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
      } = req.query;

      // Build filters
      const filters: any = {};
      if (status) filters.status = status as string;
      if (urgency) filters.urgency = urgency as string;
      if (patientId && validateObjectId(patientId as string)) {
        filters.patientId = new mongoose.Types.ObjectId(patientId as string);
      }
      if (assignedTo && validateObjectId(assignedTo as string)) {
        filters.assignedTo = new mongoose.Types.ObjectId(assignedTo as string);
      }
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);

      // Build pagination
      const pagination = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      };

      const result = await patientPortalAdminService.getRefillRequests(
        workplaceId,
        filters,
        pagination
      );

      logger.info('Retrieved refill requests', {
        workplaceId,
        userId: req.user!._id,
        filters,
        pagination,
        resultCount: result.requests.length,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting refill requests', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Approve a refill request
   * POST /api/workspace-admin/patient-portal/refill-requests/:requestId/approve
   */
  async approveRefillRequest(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const { requestId } = req.params;
      const { pharmacistId, approvedQuantity, pharmacistNotes } = req.body;

      // Validate request ID
      if (!validateObjectId(requestId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid request ID',
        });
        return;
      }

      // Validate pharmacist ID
      if (!validateObjectId(pharmacistId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid pharmacist ID',
        });
        return;
      }

      // Validate approved quantity
      if (!approvedQuantity || typeof approvedQuantity !== 'number' || approvedQuantity <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid approved quantity is required',
        });
        return;
      }

      if (approvedQuantity > 365) {
        res.status(400).json({
          success: false,
          error: 'Approved quantity cannot exceed 365 days supply',
        });
        return;
      }

      // Validate pharmacist notes if provided
      if (pharmacistNotes && (typeof pharmacistNotes !== 'string' || pharmacistNotes.length > 1000)) {
        res.status(400).json({
          success: false,
          error: 'Pharmacist notes cannot exceed 1000 characters',
        });
        return;
      }

      const result = await patientPortalAdminService.approveRefillRequest(
        workplaceId,
        new mongoose.Types.ObjectId(requestId),
        new mongoose.Types.ObjectId(pharmacistId),
        approvedQuantity,
        pharmacistNotes?.trim()
      );

      logger.info('Refill request approved', {
        workplaceId,
        requestId,
        pharmacistId,
        approvedQuantity,
        approvedBy: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Refill request approved successfully',
      });
    } catch (error: any) {
      logger.error('Error approving refill request', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        requestId: req.params.requestId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Deny a refill request
   * POST /api/workspace-admin/patient-portal/refill-requests/:requestId/deny
   */
  async denyRefillRequest(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const { requestId } = req.params;
      const { pharmacistId, denialReason } = req.body;

      // Validate request ID
      if (!validateObjectId(requestId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid request ID',
        });
        return;
      }

      // Validate pharmacist ID
      if (!validateObjectId(pharmacistId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid pharmacist ID',
        });
        return;
      }

      // Validate denial reason
      if (!denialReason || typeof denialReason !== 'string' || denialReason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Denial reason is required',
        });
        return;
      }

      if (denialReason.length > 500) {
        res.status(400).json({
          success: false,
          error: 'Denial reason cannot exceed 500 characters',
        });
        return;
      }

      const result = await patientPortalAdminService.denyRefillRequest(
        workplaceId,
        new mongoose.Types.ObjectId(requestId),
        new mongoose.Types.ObjectId(pharmacistId),
        denialReason.trim()
      );

      logger.info('Refill request denied', {
        workplaceId,
        requestId,
        pharmacistId,
        denialReason: denialReason.trim(),
        deniedBy: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Refill request denied successfully',
      });
    } catch (error: any) {
      logger.error('Error denying refill request', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        requestId: req.params.requestId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Assign a refill request to a pharmacist
   * POST /api/workspace-admin/patient-portal/refill-requests/:requestId/assign
   */
  async assignRefillRequest(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const { requestId } = req.params;
      const { pharmacistId } = req.body;

      // Validate request ID
      if (!validateObjectId(requestId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid request ID',
        });
        return;
      }

      // Validate pharmacist ID
      if (!validateObjectId(pharmacistId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid pharmacist ID',
        });
        return;
      }

      const result = await patientPortalAdminService.assignRefillRequest(
        workplaceId,
        new mongoose.Types.ObjectId(requestId),
        new mongoose.Types.ObjectId(pharmacistId),
        req.user!._id
      );

      logger.info('Refill request assigned', {
        workplaceId,
        requestId,
        pharmacistId,
        assignedBy: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Refill request assigned successfully',
      });
    } catch (error: any) {
      logger.error('Error assigning refill request', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        requestId: req.params.requestId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get portal analytics and engagement metrics
   * GET /api/workspace-admin/patient-portal/analytics
   */
  async getPortalAnalytics(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      // Extract date range parameters
      const { startDate, endDate } = req.query;

      let dateRange: { startDate: Date; endDate: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
        };

        // Validate date range
        if (dateRange.startDate >= dateRange.endDate) {
          res.status(400).json({
            success: false,
            error: 'Start date must be before end date',
          });
          return;
        }
      }

      const result = await patientPortalAdminService.getPortalAnalytics(
        workplaceId,
        dateRange
      );

      logger.info('Retrieved portal analytics', {
        workplaceId,
        userId: req.user!._id,
        dateRange,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting portal analytics', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get detailed analytics report
   * GET /api/workspace-admin/patient-portal/analytics/report
   */
  async getAnalyticsReport(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      // Extract date range parameters
      const { startDate, endDate } = req.query;

      let dateRange: { startDate: Date; endDate: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
        };

        // Validate date range
        if (dateRange.startDate >= dateRange.endDate) {
          res.status(400).json({
            success: false,
            error: 'Start date must be before end date',
          });
          return;
        }
      }

      const result = await patientPortalAnalyticsService.generateAnalyticsReport(
        workplaceId,
        dateRange
      );

      logger.info('Generated analytics report', {
        workplaceId,
        userId: req.user!._id,
        dateRange,
        recommendationsCount: result.recommendations.length,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error generating analytics report', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get patient activity details
   * GET /api/workspace-admin/patient-portal/patients/:patientUserId/activity
   */
  async getPatientActivity(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const { patientUserId } = req.params;

      // Validate patient user ID
      if (!validateObjectId(patientUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid patient user ID',
        });
        return;
      }

      // Extract date range parameters
      const { startDate, endDate } = req.query;

      let dateRange: { startDate: Date; endDate: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
        };

        // Validate date range
        if (dateRange.startDate >= dateRange.endDate) {
          res.status(400).json({
            success: false,
            error: 'Start date must be before end date',
          });
          return;
        }
      }

      const result = await patientPortalAdminService.getPatientActivity(
        workplaceId,
        new mongoose.Types.ObjectId(patientUserId),
        dateRange
      );

      logger.info('Retrieved patient activity', {
        workplaceId,
        patientUserId,
        userId: req.user!._id,
        dateRange,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting patient activity', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        patientUserId: req.params.patientUserId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get portal settings
   * GET /api/workspace-admin/patient-portal/settings
   */
  async getPortalSettings(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      const result = await patientPortalAdminService.getPortalSettings(workplaceId);

      logger.info('Retrieved portal settings', {
        workplaceId,
        userId: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting portal settings', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Update portal settings
   * PUT /api/workspace-admin/patient-portal/settings
   */
  async updatePortalSettings(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);
      const settingsUpdate = req.body;

      // Basic validation for settings structure
      if (!settingsUpdate || typeof settingsUpdate !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid settings data',
        });
        return;
      }

      // Validate boolean fields if provided
      const booleanFields = ['isEnabled', 'requireApproval'];
      for (const field of booleanFields) {
        if (settingsUpdate[field] !== undefined && typeof settingsUpdate[field] !== 'boolean') {
          res.status(400).json({
            success: false,
            error: `${field} must be a boolean value`,
          });
          return;
        }
      }

      // Validate allowedFeatures if provided
      if (settingsUpdate.allowedFeatures) {
        const validFeatures = [
          'messaging',
          'appointments',
          'medications',
          'vitals',
          'labResults',
          'billing',
          'educationalResources',
          'healthRecords',
        ];

        for (const [feature, enabled] of Object.entries(settingsUpdate.allowedFeatures)) {
          if (!validFeatures.includes(feature)) {
            res.status(400).json({
              success: false,
              error: `Invalid feature: ${feature}`,
            });
            return;
          }

          if (typeof enabled !== 'boolean') {
            res.status(400).json({
              success: false,
              error: `Feature ${feature} must be a boolean value`,
            });
            return;
          }
        }
      }

      // Validate customization colors if provided
      if (settingsUpdate.customization) {
        const { primaryColor, secondaryColor } = settingsUpdate.customization;
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

        if (primaryColor && !colorRegex.test(primaryColor)) {
          res.status(400).json({
            success: false,
            error: 'Primary color must be a valid hex color',
          });
          return;
        }

        if (secondaryColor && !colorRegex.test(secondaryColor)) {
          res.status(400).json({
            success: false,
            error: 'Secondary color must be a valid hex color',
          });
          return;
        }
      }

      const result = await patientPortalAdminService.updatePortalSettings(
        workplaceId,
        settingsUpdate,
        req.user!._id
      );

      logger.info('Updated portal settings', {
        workplaceId,
        userId: req.user!._id,
        updatedFields: Object.keys(settingsUpdate),
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Portal settings updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating portal settings', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Reset portal settings to defaults
   * POST /api/workspace-admin/patient-portal/settings/reset
   */
  async resetPortalSettings(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      const result = await patientPortalAdminService.resetPortalSettings(
        workplaceId,
        req.user!._id
      );

      logger.info('Reset portal settings to defaults', {
        workplaceId,
        userId: req.user!._id,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Portal settings reset to defaults successfully',
      });
    } catch (error: any) {
      logger.error('Error resetting portal settings', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get feature usage statistics
   * GET /api/workspace-admin/patient-portal/analytics/feature-usage
   */
  async getFeatureUsageStats(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      // Extract date range parameters
      const { startDate, endDate } = req.query;

      let dateRange: { startDate: Date; endDate: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
        };

        // Validate date range
        if (dateRange.startDate >= dateRange.endDate) {
          res.status(400).json({
            success: false,
            error: 'Start date must be before end date',
          });
          return;
        }
      }

      const result = await patientPortalAnalyticsService.getFeatureUsageStats(
        workplaceId,
        dateRange
      );

      logger.info('Retrieved feature usage statistics', {
        workplaceId,
        userId: req.user!._id,
        dateRange,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting feature usage statistics', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get communication metrics
   * GET /api/workspace-admin/patient-portal/analytics/communication
   */
  async getCommunicationMetrics(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      // Extract date range parameters
      const { startDate, endDate } = req.query;

      let dateRange: { startDate: Date; endDate: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
        };

        // Validate date range
        if (dateRange.startDate >= dateRange.endDate) {
          res.status(400).json({
            success: false,
            error: 'Start date must be before end date',
          });
          return;
        }
      }

      const result = await patientPortalAnalyticsService.getCommunicationMetrics(
        workplaceId,
        dateRange
      );

      logger.info('Retrieved communication metrics', {
        workplaceId,
        userId: req.user!._id,
        dateRange,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting communication metrics', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }

  /**
   * Get list of pharmacists for refill request assignment
   * GET /api/workspace-admin/patient-portal/pharmacists
   */
  async getPharmacists(
    req: WorkspaceAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workplaceId = getWorkplaceId(req);

      const result = await patientPortalAdminService.getPharmacists(workplaceId);

      logger.info('Retrieved pharmacists list', {
        workplaceId,
        userId: req.user!._id,
        count: result.length,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error getting pharmacists list', {
        error: error.message,
        workplaceId: req.user?.workplaceId,
        userId: req.user?._id,
      });
      next(error);
    }
  }
}

export default new PatientPortalAdminController();