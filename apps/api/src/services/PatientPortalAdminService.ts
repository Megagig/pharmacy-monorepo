import mongoose from 'mongoose';
import PatientUser, { IPatientUser } from '../models/PatientUser';
import FollowUpTask, { IFollowUpTask } from '../models/FollowUpTask';
import PatientPortalSettings, { IPatientPortalSettings } from '../models/PatientPortalSettings';
import User from '../models/User';
import Patient from '../models/Patient';
import logger from '../utils/logger';
import { notificationService } from './notificationService';

export interface IPatientPortalAdminService {
  // Patient user management
  getPatientPortalUsers(
    workplaceId: mongoose.Types.ObjectId,
    filters?: {
      status?: string;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination?: {
      page: number;
      limit: number;
    }
  ): Promise<{
    users: IPatientUser[];
    total: number;
    page: number;
    totalPages: number;
  }>;

  approvePatientUser(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    approvedBy: mongoose.Types.ObjectId
  ): Promise<IPatientUser>;

  suspendPatientUser(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    reason: string,
    suspendedBy: mongoose.Types.ObjectId
  ): Promise<IPatientUser>;

  reactivatePatientUser(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    reactivatedBy: mongoose.Types.ObjectId
  ): Promise<IPatientUser>;

  // Refill request management
  getRefillRequests(
    workplaceId: mongoose.Types.ObjectId,
    filters?: {
      status?: string;
      urgency?: string;
      patientId?: mongoose.Types.ObjectId;
      assignedTo?: mongoose.Types.ObjectId;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination?: {
      page: number;
      limit: number;
    }
  ): Promise<{
    requests: IFollowUpTask[];
    total: number;
    page: number;
    totalPages: number;
  }>;

  approveRefillRequest(
    workplaceId: mongoose.Types.ObjectId,
    requestId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    approvedQuantity: number,
    pharmacistNotes?: string
  ): Promise<IFollowUpTask>;

  denyRefillRequest(
    workplaceId: mongoose.Types.ObjectId,
    requestId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    denialReason: string
  ): Promise<IFollowUpTask>;

  assignRefillRequest(
    workplaceId: mongoose.Types.ObjectId,
    requestId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    assignedBy: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask>;

  // Portal analytics and engagement metrics
  getPortalAnalytics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    userMetrics: {
      totalUsers: number;
      activeUsers: number;
      pendingUsers: number;
      suspendedUsers: number;
      newUsersThisMonth: number;
    };
    engagementMetrics: {
      totalLogins: number;
      averageSessionDuration: number;
      mostUsedFeatures: Array<{ feature: string; usage: number }>;
    };
    operationalMetrics: {
      totalRefillRequests: number;
      pendingRefillRequests: number;
      approvedRefillRequests: number;
      deniedRefillRequests: number;
      averageResponseTime: number;
    };
  }>;

  getPatientActivity(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    loginHistory: Array<{
      date: Date;
      ipAddress?: string;
      deviceInfo?: string;
    }>;
    featureUsage: Array<{
      feature: string;
      lastUsed: Date;
      usageCount: number;
    }>;
    communications: Array<{
      type: 'message' | 'appointment' | 'refill_request';
      date: Date;
      details: any;
    }>;
  }>;

  // Portal settings management
  getPortalSettings(workplaceId: mongoose.Types.ObjectId): Promise<IPatientPortalSettings>;

  updatePortalSettings(
    workplaceId: mongoose.Types.ObjectId,
    settings: Partial<IPatientPortalSettings>,
    updatedBy: mongoose.Types.ObjectId
  ): Promise<IPatientPortalSettings>;

  resetPortalSettings(
    workplaceId: mongoose.Types.ObjectId,
    resetBy: mongoose.Types.ObjectId
  ): Promise<IPatientPortalSettings>;
}

export class PatientPortalAdminService implements IPatientPortalAdminService {
  /**
   * Get patient portal users with filtering and pagination
   */
  async getPatientPortalUsers(
    workplaceId: mongoose.Types.ObjectId,
    filters: {
      status?: string;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
    pagination: {
      page: number;
      limit: number;
    } = { page: 1, limit: 20 }
  ): Promise<{
    users: IPatientUser[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const query: any = {
        workplaceId,
        isDeleted: false,
      };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        query.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ];
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          query.createdAt.$lte = filters.dateTo;
        }
      }

      // Calculate pagination
      const page = Math.max(1, pagination.page);
      const limit = Math.min(100, Math.max(1, pagination.limit)); // Cap at 100
      const skip = (page - 1) * limit;

      // Get total count
      const total = await PatientUser.countDocuments(query);

      // Get users
      const users = await PatientUser.find(query)
        .populate('patientId', 'firstName lastName mrn phone email')
        .select('-passwordHash -verificationToken -resetToken -refreshTokens')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPages = Math.ceil(total / limit);

      logger.info('Retrieved patient portal users', {
        workplaceId,
        total,
        page,
        limit,
        filters,
      });

      return {
        users,
        total,
        page,
        totalPages,
      };
    } catch (error: any) {
      logger.error('Error getting patient portal users', {
        error: error.message,
        workplaceId,
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Approve a patient user account
   */
  async approvePatientUser(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    approvedBy: mongoose.Types.ObjectId
  ): Promise<IPatientUser> {
    try {
      // Find the patient user
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      });

      if (!patientUser) {
        throw new Error('Patient user not found');
      }

      if (patientUser.status !== 'pending') {
        throw new Error(`Cannot approve user with status: ${patientUser.status}`);
      }

      // Update status and activate account
      patientUser.status = 'active';
      patientUser.isActive = true;
      patientUser.updatedBy = approvedBy;
      await patientUser.save();

      logger.info('Patient user approved', {
        patientUserId,
        workplaceId,
        approvedBy,
      });

      // Send approval notification to patient
      try {
        await notificationService.createNotification({
          userId: patientUserId,
          type: 'account_approved',
          title: 'Account Approved',
          content: 'Your patient portal account has been approved. You can now access all features.',
          data: {},
          workplaceId,
          createdBy: approvedBy,
        });
      } catch (notificationError: any) {
        logger.warn('Failed to send approval notification', {
          error: notificationError.message,
          patientUserId,
        });
      }

      return patientUser;
    } catch (error: any) {
      logger.error('Error approving patient user', {
        error: error.message,
        patientUserId,
        workplaceId,
        approvedBy,
      });
      throw error;
    }
  }

  /**
   * Suspend a patient user account
   */
  async suspendPatientUser(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    reason: string,
    suspendedBy: mongoose.Types.ObjectId
  ): Promise<IPatientUser> {
    try {
      // Find the patient user
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      });

      if (!patientUser) {
        throw new Error('Patient user not found');
      }

      if (patientUser.status === 'suspended') {
        throw new Error('User is already suspended');
      }

      // Update status and deactivate account
      patientUser.status = 'suspended';
      patientUser.isActive = false;
      patientUser.updatedBy = suspendedBy;
      await patientUser.save();

      logger.info('Patient user suspended', {
        patientUserId,
        workplaceId,
        reason,
        suspendedBy,
      });

      // Send suspension notification to patient
      try {
        await notificationService.createNotification({
          userId: patientUserId,
          type: 'account_suspended',
          title: 'Account Suspended',
          content: `Your patient portal account has been suspended. Reason: ${reason}`,
          data: { reason },
          workplaceId,
          createdBy: suspendedBy,
        });
      } catch (notificationError: any) {
        logger.warn('Failed to send suspension notification', {
          error: notificationError.message,
          patientUserId,
        });
      }

      return patientUser;
    } catch (error: any) {
      logger.error('Error suspending patient user', {
        error: error.message,
        patientUserId,
        workplaceId,
        suspendedBy,
      });
      throw error;
    }
  }

  /**
   * Reactivate a suspended patient user account
   */
  async reactivatePatientUser(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    reactivatedBy: mongoose.Types.ObjectId
  ): Promise<IPatientUser> {
    try {
      // Find the patient user
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      });

      if (!patientUser) {
        throw new Error('Patient user not found');
      }

      if (patientUser.status !== 'suspended') {
        throw new Error(`Cannot reactivate user with status: ${patientUser.status}`);
      }

      // Update status and reactivate account
      patientUser.status = 'active';
      patientUser.isActive = true;
      patientUser.updatedBy = reactivatedBy;
      await patientUser.save();

      logger.info('Patient user reactivated', {
        patientUserId,
        workplaceId,
        reactivatedBy,
      });

      // Send reactivation notification to patient
      try {
        await notificationService.createNotification({
          userId: patientUserId,
          type: 'account_reactivated',
          title: 'Account Reactivated',
          content: 'Your patient portal account has been reactivated. You can now access all features.',
          data: {},
          workplaceId,
          createdBy: reactivatedBy,
        });
      } catch (notificationError: any) {
        logger.warn('Failed to send reactivation notification', {
          error: notificationError.message,
          patientUserId,
        });
      }

      return patientUser;
    } catch (error: any) {
      logger.error('Error reactivating patient user', {
        error: error.message,
        patientUserId,
        workplaceId,
        reactivatedBy,
      });
      throw error;
    }
  }

  /**
   * Get refill requests with filtering and pagination
   */
  async getRefillRequests(
    workplaceId: mongoose.Types.ObjectId,
    filters: {
      status?: string;
      urgency?: string;
      patientId?: mongoose.Types.ObjectId;
      assignedTo?: mongoose.Types.ObjectId;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
    pagination: {
      page: number;
      limit: number;
    } = { page: 1, limit: 20 }
  ): Promise<{
    requests: IFollowUpTask[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const query: any = {
        workplaceId,
        type: 'medication_refill_request',
        isDeleted: false,
      };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.urgency) {
        query['metadata.refillRequest.urgency'] = filters.urgency;
      }

      if (filters.patientId) {
        query.patientId = filters.patientId;
      }

      if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          query.createdAt.$lte = filters.dateTo;
        }
      }

      // Calculate pagination
      const page = Math.max(1, pagination.page);
      const limit = Math.min(100, Math.max(1, pagination.limit)); // Cap at 100
      const skip = (page - 1) * limit;

      // Get total count
      const total = await FollowUpTask.countDocuments(query);

      // Get requests
      const requests = await FollowUpTask.find(query)
        .populate('patientId', 'firstName lastName mrn phone email')
        .populate('assignedTo', 'firstName lastName role')
        .populate('metadata.refillRequest.medicationId', 'name strength dosageForm')
        .populate('metadata.refillRequest.requestedBy', 'firstName lastName email')
        .sort({ 'metadata.refillRequest.urgency': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPages = Math.ceil(total / limit);

      logger.info('Retrieved refill requests', {
        workplaceId,
        total,
        page,
        limit,
        filters,
      });

      return {
        requests,
        total,
        page,
        totalPages,
      };
    } catch (error: any) {
      logger.error('Error getting refill requests', {
        error: error.message,
        workplaceId,
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Approve a refill request
   */
  async approveRefillRequest(
    workplaceId: mongoose.Types.ObjectId,
    requestId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    approvedQuantity: number,
    pharmacistNotes?: string
  ): Promise<IFollowUpTask> {
    try {
      // Find the refill request
      const request = await FollowUpTask.findOne({
        _id: requestId,
        workplaceId,
        type: 'medication_refill_request',
        isDeleted: false,
      }).populate('metadata.refillRequest.requestedBy', 'firstName lastName email');

      if (!request) {
        throw new Error('Refill request not found');
      }

      if (request.status === 'completed') {
        throw new Error('Refill request has already been processed');
      }

      // Validate approved quantity
      if (approvedQuantity <= 0) {
        throw new Error('Approved quantity must be greater than 0');
      }

      if (approvedQuantity > request.metadata?.refillRequest?.requestedQuantity!) {
        throw new Error('Approved quantity cannot exceed requested quantity');
      }

      // Approve the request
      request.approveRefillRequest(approvedQuantity, pharmacistId, pharmacistNotes);
      await request.save();

      logger.info('Refill request approved', {
        requestId,
        workplaceId,
        pharmacistId,
        approvedQuantity,
      });

      // Send approval notification to patient
      try {
        const patientUser = request.metadata?.refillRequest?.requestedBy as any;
        await notificationService.createNotification({
          userId: patientUser._id,
          type: 'refill_approved',
          title: 'Refill Request Approved',
          content: `Your refill request for ${request.metadata?.refillRequest?.medicationName} has been approved for ${approvedQuantity} units.`,
          data: {
            requestId,
            medicationName: request.metadata?.refillRequest?.medicationName,
            approvedQuantity,
          },
          workplaceId,
          createdBy: pharmacistId,
        });
      } catch (notificationError: any) {
        logger.warn('Failed to send refill approval notification', {
          error: notificationError.message,
          requestId,
        });
      }

      return request;
    } catch (error: any) {
      logger.error('Error approving refill request', {
        error: error.message,
        requestId,
        workplaceId,
        pharmacistId,
      });
      throw error;
    }
  }

  /**
   * Deny a refill request
   */
  async denyRefillRequest(
    workplaceId: mongoose.Types.ObjectId,
    requestId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    denialReason: string
  ): Promise<IFollowUpTask> {
    try {
      // Find the refill request
      const request = await FollowUpTask.findOne({
        _id: requestId,
        workplaceId,
        type: 'medication_refill_request',
        isDeleted: false,
      }).populate('metadata.refillRequest.requestedBy', 'firstName lastName email');

      if (!request) {
        throw new Error('Refill request not found');
      }

      if (request.status === 'completed') {
        throw new Error('Refill request has already been processed');
      }

      // Validate denial reason
      if (!denialReason || denialReason.trim().length === 0) {
        throw new Error('Denial reason is required');
      }

      // Deny the request
      request.denyRefillRequest(denialReason, pharmacistId);
      await request.save();

      logger.info('Refill request denied', {
        requestId,
        workplaceId,
        pharmacistId,
        denialReason,
      });

      // Send denial notification to patient
      try {
        const patientUser = request.metadata?.refillRequest?.requestedBy as any;
        await notificationService.createNotification({
          userId: patientUser._id,
          type: 'refill_denied',
          title: 'Refill Request Denied',
          content: `Your refill request for ${request.metadata?.refillRequest?.medicationName} has been denied. Reason: ${denialReason}`,
          data: {
            requestId,
            medicationName: request.metadata?.refillRequest?.medicationName,
            denialReason,
          },
          workplaceId,
          createdBy: pharmacistId,
        });
      } catch (notificationError: any) {
        logger.warn('Failed to send refill denial notification', {
          error: notificationError.message,
          requestId,
        });
      }

      return request;
    } catch (error: any) {
      logger.error('Error denying refill request', {
        error: error.message,
        requestId,
        workplaceId,
        pharmacistId,
      });
      throw error;
    }
  }

  /**
   * Assign a refill request to a pharmacist
   */
  async assignRefillRequest(
    workplaceId: mongoose.Types.ObjectId,
    requestId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    assignedBy: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask> {
    try {
      // Validate pharmacist exists and belongs to workspace
      const pharmacist = await User.findOne({
        _id: pharmacistId,
        workplaceId,
        role: { $in: ['pharmacist', 'pharmacy_team', 'owner'] },
        isDeleted: false,
      });

      if (!pharmacist) {
        throw new Error('Pharmacist not found or invalid role');
      }

      // Find the refill request
      const request = await FollowUpTask.findOne({
        _id: requestId,
        workplaceId,
        type: 'medication_refill_request',
        isDeleted: false,
      });

      if (!request) {
        throw new Error('Refill request not found');
      }

      if (request.status === 'completed') {
        throw new Error('Cannot reassign completed refill request');
      }

      // Update assignment
      request.assignedTo = pharmacistId;
      request.updatedBy = assignedBy;
      await request.save();

      logger.info('Refill request assigned', {
        requestId,
        workplaceId,
        pharmacistId,
        assignedBy,
      });

      // Send assignment notification to pharmacist
      try {
        await notificationService.createNotification({
          userId: pharmacistId,
          type: 'refill_assigned',
          title: 'Refill Request Assigned',
          content: `A refill request for ${request.metadata?.refillRequest?.medicationName} has been assigned to you.`,
          data: {
            requestId,
            medicationName: request.metadata?.refillRequest?.medicationName,
            patientName: `${(request as any).patientId?.firstName} ${(request as any).patientId?.lastName}`,
          },
          workplaceId,
          createdBy: assignedBy,
        });
      } catch (notificationError: any) {
        logger.warn('Failed to send assignment notification', {
          error: notificationError.message,
          requestId,
          pharmacistId,
        });
      }

      return request;
    } catch (error: any) {
      logger.error('Error assigning refill request', {
        error: error.message,
        requestId,
        workplaceId,
        pharmacistId,
        assignedBy,
      });
      throw error;
    }
  }

  /**
   * Get portal analytics and engagement metrics
   */
  async getPortalAnalytics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    userMetrics: {
      totalUsers: number;
      activeUsers: number;
      pendingUsers: number;
      suspendedUsers: number;
      newUsersThisMonth: number;
    };
    engagementMetrics: {
      totalLogins: number;
      averageSessionDuration: number;
      messagesSent: number;
      appointmentsBooked: number;
      mostUsedFeatures: Array<{ feature: string; usage: number }>;
    };
    operationalMetrics: {
      totalRefillRequests: number;
      pendingRefillRequests: number;
      approvedRefillRequests: number;
      deniedRefillRequests: number;
      averageResponseTime: number;
    };
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // User metrics
      const [
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        newUsersThisMonth,
      ] = await Promise.all([
        PatientUser.countDocuments({ workplaceId, isDeleted: false }),
        PatientUser.countDocuments({ workplaceId, status: 'active', isDeleted: false }),
        PatientUser.countDocuments({ workplaceId, status: 'pending', isDeleted: false }),
        PatientUser.countDocuments({ workplaceId, status: 'suspended', isDeleted: false }),
        PatientUser.countDocuments({
          workplaceId,
          isDeleted: false,
          createdAt: { $gte: startOfMonth },
        }),
      ]);

      // Refill request metrics
      const refillQuery: any = {
        workplaceId,
        type: 'medication_refill_request',
        isDeleted: false,
      };

      if (dateRange) {
        refillQuery.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      const [
        totalRefillRequests,
        pendingRefillRequests,
        approvedRefillRequests,
        deniedRefillRequests,
      ] = await Promise.all([
        FollowUpTask.countDocuments(refillQuery),
        FollowUpTask.countDocuments({ ...refillQuery, status: 'pending' }),
        FollowUpTask.countDocuments({
          ...refillQuery,
          status: 'completed',
          'outcome.status': 'successful',
        }),
        FollowUpTask.countDocuments({
          ...refillQuery,
          status: 'completed',
          'outcome.status': 'unsuccessful',
        }),
      ]);

      // Calculate average response time for completed refill requests
      const completedRequests = await FollowUpTask.find({
        ...refillQuery,
        status: 'completed',
        completedAt: { $exists: true },
      }).select('createdAt completedAt');

      let averageResponseTime = 0;
      if (completedRequests.length > 0) {
        const totalResponseTime = completedRequests.reduce((sum, request) => {
          const responseTime = request.completedAt!.getTime() - request.createdAt.getTime();
          return sum + responseTime;
        }, 0);
        averageResponseTime = Math.round(totalResponseTime / completedRequests.length / (1000 * 60 * 60)); // Convert to hours
      }

      // Real engagement metrics based on actual data
      // Count patient users who have logged in this month (lastLoginAt exists and is within current month)
      const loginQuery: any = {
        workplaceId,
        isDeleted: false,
        lastLoginAt: { $gte: startOfMonth },
      };

      const usersLoggedInThisMonth = await PatientUser.countDocuments(loginQuery);

      // For messages, check if the user has any follow-up tasks related to messaging
      const messagingActivity = await FollowUpTask.countDocuments({
        workplaceId,
        type: { $in: ['patient_message', 'communication'] },
        createdAt: { $gte: startOfMonth },
        isDeleted: false,
      });

      // For appointments, check appointment-related follow-up tasks
      const appointmentActivity = await FollowUpTask.countDocuments({
        workplaceId,
        type: { $in: ['appointment', 'appointment_reminder'] },
        createdAt: { $gte: startOfMonth },
        isDeleted: false,
      });

      const engagementMetrics = {
        totalLogins: usersLoggedInThisMonth, // Real count of users who logged in this month
        averageSessionDuration: 0, // Not tracked yet - would require session tracking implementation
        messagesSent: messagingActivity, // Real message count
        appointmentsBooked: appointmentActivity, // Real appointment count
        mostUsedFeatures: [
          { feature: 'medications', usage: totalRefillRequests },
          { feature: 'messaging', usage: messagingActivity },
          { feature: 'appointments', usage: appointmentActivity },
          { feature: 'health_records', usage: 0 }, // Not tracked yet
        ],
      };

      const analytics = {
        userMetrics: {
          totalUsers,
          activeUsers,
          pendingUsers,
          suspendedUsers,
          newUsersThisMonth,
        },
        engagementMetrics,
        operationalMetrics: {
          totalRefillRequests,
          pendingRefillRequests,
          approvedRefillRequests,
          deniedRefillRequests,
          averageResponseTime,
        },
      };

      logger.info('Retrieved portal analytics', {
        workplaceId,
        dateRange,
        analytics,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Error getting portal analytics', {
        error: error.message,
        workplaceId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get patient activity details
   */
  async getPatientActivity(
    workplaceId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    loginHistory: Array<{
      date: Date;
      ipAddress?: string;
      deviceInfo?: string;
    }>;
    featureUsage: Array<{
      feature: string;
      lastUsed: Date;
      usageCount: number;
    }>;
    communications: Array<{
      type: 'message' | 'appointment' | 'refill_request';
      date: Date;
      details: any;
    }>;
  }> {
    try {
      // Validate patient user exists
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      });

      if (!patientUser) {
        throw new Error('Patient user not found');
      }

      // Mock login history (would be implemented with actual session tracking)
      const loginHistory = [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          ipAddress: '192.168.1.100',
          deviceInfo: 'Chrome on Windows',
        },
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          ipAddress: '192.168.1.100',
          deviceInfo: 'Safari on iPhone',
        },
      ];

      // Mock feature usage (would be implemented with actual tracking)
      const featureUsage = [
        {
          feature: 'medications',
          lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          usageCount: 15,
        },
        {
          feature: 'messaging',
          lastUsed: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          usageCount: 8,
        },
        {
          feature: 'appointments',
          lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
          usageCount: 3,
        },
      ];

      // Get actual communications
      const communications: Array<{
        type: 'message' | 'appointment' | 'refill_request';
        date: Date;
        details: any;
      }> = [];

      // Get refill requests
      const refillRequests = await FollowUpTask.find({
        workplaceId,
        type: 'medication_refill_request',
        'metadata.refillRequest.requestedBy': patientUserId,
        isDeleted: false,
        ...(dateRange && {
          createdAt: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate,
          },
        }),
      })
        .populate('metadata.refillRequest.medicationId', 'name')
        .sort({ createdAt: -1 })
        .limit(10);

      refillRequests.forEach(request => {
        communications.push({
          type: 'refill_request',
          date: request.createdAt,
          details: {
            medicationName: request.metadata?.refillRequest?.medicationName,
            status: request.status,
            urgency: request.metadata?.refillRequest?.urgency,
          },
        });
      });

      const activity = {
        loginHistory,
        featureUsage,
        communications: communications.sort((a, b) => b.date.getTime() - a.date.getTime()),
      };

      logger.info('Retrieved patient activity', {
        workplaceId,
        patientUserId,
        dateRange,
        communicationsCount: communications.length,
      });

      return activity;
    } catch (error: any) {
      logger.error('Error getting patient activity', {
        error: error.message,
        workplaceId,
        patientUserId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get portal settings for workspace
   */
  async getPortalSettings(workplaceId: mongoose.Types.ObjectId): Promise<IPatientPortalSettings> {
    try {
      let settings = await PatientPortalSettings.findOne({
        workplaceId,
        isDeleted: false,
      });

      // Create default settings if none exist
      if (!settings) {
        const defaultSettings = (PatientPortalSettings as any).getDefaultSettings(workplaceId);
        settings = new PatientPortalSettings(defaultSettings);
        await settings.save();

        logger.info('Created default portal settings', {
          workplaceId,
        });
      }

      return settings;
    } catch (error: any) {
      logger.error('Error getting portal settings', {
        error: error.message,
        workplaceId,
      });
      throw error;
    }
  }

  /**
   * Update portal settings
   */
  async updatePortalSettings(
    workplaceId: mongoose.Types.ObjectId,
    settingsUpdate: Partial<IPatientPortalSettings>,
    updatedBy: mongoose.Types.ObjectId
  ): Promise<IPatientPortalSettings> {
    try {
      let settings = await PatientPortalSettings.findOne({
        workplaceId,
        isDeleted: false,
      });

      if (!settings) {
        // Create new settings if none exist
        const defaultSettings = (PatientPortalSettings as any).getDefaultSettings(workplaceId);
        settings = new PatientPortalSettings({
          ...defaultSettings,
          ...settingsUpdate,
          updatedBy,
        });
      } else {
        // Update existing settings
        Object.assign(settings, settingsUpdate);
        settings.updatedBy = updatedBy;
      }

      // Validate settings before saving
      const validation = settings.validateSettings();
      if (!validation.isValid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }

      await settings.save();

      logger.info('Updated portal settings', {
        workplaceId,
        updatedBy,
        updatedFields: Object.keys(settingsUpdate),
      });

      return settings;
    } catch (error: any) {
      logger.error('Error updating portal settings', {
        error: error.message,
        workplaceId,
        updatedBy,
      });
      throw error;
    }
  }

  /**
   * Reset portal settings to defaults
   */
  async resetPortalSettings(
    workplaceId: mongoose.Types.ObjectId,
    resetBy: mongoose.Types.ObjectId
  ): Promise<IPatientPortalSettings> {
    try {
      // Get default settings
      const defaultSettings = (PatientPortalSettings as any).getDefaultSettings(workplaceId);
      defaultSettings.updatedBy = resetBy;

      // Update or create settings
      const settings = await PatientPortalSettings.findOneAndUpdate(
        { workplaceId, isDeleted: false },
        defaultSettings,
        { new: true, upsert: true }
      );

      logger.info('Reset portal settings to defaults', {
        workplaceId,
        resetBy,
      });

      return settings;
    } catch (error: any) {
      logger.error('Error resetting portal settings', {
        error: error.message,
        workplaceId,
        resetBy,
      });
      throw error;
    }
  }

  /**
   * Get list of pharmacists for refill request assignment
   */
  async getPharmacists(
    workplaceId: mongoose.Types.ObjectId
  ): Promise<Array<{ id: string; firstName: string; lastName: string; email: string }>> {
    try {
      // Get all users with pharmacist role in the workspace
      const pharmacists = await User.find({
        workplaceId,
        role: { $in: ['Pharmacist', 'pharmacist', 'pharmacy_outlet', 'Owner'] },
        isDeleted: false,
        isActive: true,
      })
        .select('_id firstName lastName email')
        .sort({ firstName: 1, lastName: 1 })
        .lean();

      return pharmacists.map(p => ({
        id: p._id.toString(),
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
      }));
    } catch (error: any) {
      logger.error('Error getting pharmacists list', {
        error: error.message,
        workplaceId,
      });
      throw error;
    }
  }
}

export default new PatientPortalAdminService();