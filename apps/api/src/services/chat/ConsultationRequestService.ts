import mongoose from 'mongoose';
import { ConsultationRequest, IConsultationRequest } from '../../models/chat/ConsultationRequest';
import { chatService } from './ChatService';
import { chatNotificationService } from './ChatNotificationService';
import { notificationService } from '../notificationService';
import { getChatSocketService } from './ChatSocketService';
import logger from '../../utils/logger';
import User from '../../models/User';

/**
 * ConsultationRequestService - Consultation Request Management
 * 
 * Handles consultation requests from patients to pharmacists
 */

export interface CreateConsultationRequestDTO {
  patientId: string;
  reason: string;
  priority?: 'normal' | 'urgent';
  workplaceId: string;
}

export interface ConsultationRequestFilters {
  status?: 'pending' | 'accepted' | 'completed' | 'cancelled';
  priority?: 'normal' | 'urgent';
  patientId?: string;
  assignedTo?: string;
}

export class ConsultationRequestService {
  /**
   * Create a new consultation request
   */
  async createRequest(data: CreateConsultationRequestDTO): Promise<IConsultationRequest> {
    try {
      const request = new ConsultationRequest({
        patientId: new mongoose.Types.ObjectId(data.patientId),
        reason: data.reason,
        priority: data.priority || 'normal',
        workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
      });

      await request.save();

      logger.info('Consultation request created', {
        requestId: request._id,
        patientId: data.patientId,
        priority: request.priority,
      });

      // Notify available pharmacists
      await this.notifyPharmacists(request);

      // Schedule escalation check
      this.scheduleEscalationCheck(request._id.toString(), data.workplaceId);

      return request;
    } catch (error) {
      logger.error('Error creating consultation request', { error, data });
      throw error;
    }
  }

  /**
   * Get request by ID
   */
  async getRequestById(requestId: string, workplaceId: string): Promise<IConsultationRequest | null> {
    try {
      const request = await ConsultationRequest.findOne({
        _id: new mongoose.Types.ObjectId(requestId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      })
        .populate('patientId', 'firstName lastName email phone')
        .populate('assignedTo', 'firstName lastName')
        .lean();

      return request as IConsultationRequest | null;
    } catch (error) {
      logger.error('Error getting consultation request', { error, requestId });
      throw error;
    }
  }

  /**
   * Get requests with filters
   */
  async getRequests(
    workplaceId: string,
    filters: ConsultationRequestFilters = {}
  ): Promise<IConsultationRequest[]> {
    try {
      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.patientId) {
        query.patientId = new mongoose.Types.ObjectId(filters.patientId);
      }

      if (filters.assignedTo) {
        query.assignedTo = new mongoose.Types.ObjectId(filters.assignedTo);
      }

      const requests = await ConsultationRequest.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .populate('patientId', 'firstName lastName email phone')
        .populate('assignedTo', 'firstName lastName')
        .lean();

      return requests as IConsultationRequest[];
    } catch (error) {
      logger.error('Error getting consultation requests', { error, workplaceId, filters });
      throw error;
    }
  }

  /**
   * Get pending requests (pharmacist queue)
   */
  async getPendingRequests(workplaceId: string): Promise<IConsultationRequest[]> {
    try {
      const requests = await ConsultationRequest.findPending(workplaceId);
      return requests as IConsultationRequest[];
    } catch (error) {
      logger.error('Error getting pending requests', { error, workplaceId });
      throw error;
    }
  }

  /**
   * Accept consultation request
   */
  async acceptRequest(
    requestId: string,
    pharmacistId: string,
    workplaceId: string
  ): Promise<{ request: IConsultationRequest; conversationId: string }> {
    try {
      const request = await ConsultationRequest.findOne({
        _id: new mongoose.Types.ObjectId(requestId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'pending',
      });

      if (!request) {
        throw new Error('Request not found or already accepted');
      }

      // Accept the request
      await request.accept(new mongoose.Types.ObjectId(pharmacistId));

      // Create conversation
      const conversation = await chatService.createConversation({
        type: 'patient_query',
        title: `Consultation: ${request.reason.substring(0, 50)}`,
        participants: [
          {
            userId: request.patientId.toString(),
            role: 'patient',
          },
          {
            userId: pharmacistId,
            role: 'pharmacist',
          },
        ],
        patientId: request.patientId.toString(),
        createdBy: pharmacistId,
        workplaceId,
      });

      if (!conversation) {
        throw new Error('Failed to create conversation');
      }

      // Link conversation to request
      request.conversationId = conversation._id;
      await request.save();

      logger.info('Consultation request accepted', {
        requestId,
        pharmacistId,
        conversationId: conversation._id,
      });

      // Notify patient that their request was accepted
      const pharmacist = await User.findById(pharmacistId).select('firstName lastName');
      const pharmacistName = pharmacist ? `${pharmacist.firstName} ${pharmacist.lastName}` : 'A pharmacist';

      await notificationService.createNotification({
        userId: request.patientId,
        type: 'consultation_accepted',
        title: '✅ Consultation Request Accepted',
        content: `${pharmacistName} has accepted your consultation request and is ready to help you.`,
        data: {
          consultationRequestId: request._id,
          conversationId: conversation._id,
          pharmacistId: new mongoose.Types.ObjectId(pharmacistId),
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: true,
          sms: false,
          push: true,
        },
        workplaceId: request.workplaceId,
        createdBy: new mongoose.Types.ObjectId(pharmacistId),
      });

      // Also send conversation invite notification
      await chatNotificationService.sendConversationInviteNotification(
        request.patientId.toString(),
        pharmacistId,
        conversation._id.toString(),
        conversation.title,
        workplaceId
      );

      // Send real-time WebSocket notification
      try {
        const socketService = getChatSocketService();
        socketService.notifyConsultationAccepted(request.patientId.toString(), {
          requestId: request._id,
          pharmacistId,
          pharmacistName,
          conversationId: conversation._id,
        });

        // Broadcast queue update
        socketService.broadcastQueueUpdate(request.workplaceId.toString(), {
          action: 'request_accepted',
          requestId: request._id,
        });
      } catch (socketError) {
        logger.warn('Failed to send WebSocket notification', { error: socketError });
      }

      return {
        request,
        conversationId: conversation._id.toString(),
      };
    } catch (error) {
      logger.error('Error accepting consultation request', { error, requestId, pharmacistId });
      throw error;
    }
  }

  /**
   * Complete consultation request
   */
  async completeRequest(
    requestId: string,
    workplaceId: string
  ): Promise<IConsultationRequest | null> {
    try {
      const request = await ConsultationRequest.findOne({
        _id: new mongoose.Types.ObjectId(requestId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'accepted',
      });

      if (!request) {
        throw new Error('Request not found or not in accepted status');
      }

      await request.complete();

      // Notify patient that consultation is complete
      const pharmacist = await User.findById(request.assignedTo).select('firstName lastName');
      const pharmacistName = pharmacist ? `${pharmacist.firstName} ${pharmacist.lastName}` : 'Your pharmacist';

      await notificationService.createNotification({
        userId: request.patientId,
        type: 'consultation_completed',
        title: '✅ Consultation Completed',
        content: `Your consultation with ${pharmacistName} has been completed. Thank you for using our service!`,
        data: {
          consultationRequestId: request._id,
          conversationId: request.conversationId,
          pharmacistId: request.assignedTo,
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: true,
          sms: false,
          push: false,
        },
        workplaceId: request.workplaceId,
        createdBy: request.assignedTo!,
      });

      // Send real-time WebSocket notification
      try {
        const socketService = getChatSocketService();
        socketService.notifyConsultationCompleted(request.patientId.toString(), {
          requestId: request._id,
          pharmacistId: request.assignedTo,
          pharmacistName,
        });
      } catch (socketError) {
        logger.warn('Failed to send WebSocket completion notification', { error: socketError });
      }

      logger.info('Consultation request completed', { requestId });

      return request;
    } catch (error) {
      logger.error('Error completing consultation request', { error, requestId });
      throw error;
    }
  }

  /**
   * Cancel consultation request
   */
  async cancelRequest(
    requestId: string,
    workplaceId: string,
    reason?: string
  ): Promise<IConsultationRequest | null> {
    try {
      const request = await ConsultationRequest.findOne({
        _id: new mongoose.Types.ObjectId(requestId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!request) {
        throw new Error('Request not found');
      }

      if (request.status === 'completed' || request.status === 'cancelled') {
        throw new Error('Request already completed or cancelled');
      }

      await request.cancel(reason);

      logger.info('Consultation request cancelled', { requestId, reason });

      return request;
    } catch (error) {
      logger.error('Error cancelling consultation request', { error, requestId });
      throw error;
    }
  }

  /**
   * Notify available pharmacists of new request
   */
  private async notifyPharmacists(request: IConsultationRequest): Promise<void> {
    try {
      // Find available pharmacists in the workplace
      const pharmacists = await User.find({
        workplaceId: request.workplaceId,
        role: 'pharmacist',
        isActive: true,
        'presenceStatus.status': { $in: ['available', 'busy'] }, // Don't notify offline pharmacists
      }).select('_id firstName lastName presenceStatus');

      if (pharmacists.length === 0) {
        logger.warn('No available pharmacists found for consultation request', {
          requestId: request._id,
          workplaceId: request.workplaceId,
        });
        return;
      }

      // Get patient info for notification
      const patient = await User.findById(request.patientId).select('firstName lastName');
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'A patient';

      // Determine notification priority and channels based on request priority
      const isUrgent = request.priority === 'urgent';
      const notificationPriority = isUrgent ? 'urgent' : 'normal';
      const deliveryChannels = {
        inApp: true,
        email: false,
        sms: isUrgent, // Send SMS for urgent requests
        push: true,
      };

      // Send notification to each available pharmacist
      for (const pharmacist of pharmacists) {
        await notificationService.createNotification({
          userId: pharmacist._id,
          type: 'consultation_request',
          title: isUrgent ? '🚨 Urgent Consultation Request' : '💬 New Consultation Request',
          content: `${patientName} is requesting a consultation: "${request.reason}"`,
          data: {
            consultationRequestId: request._id,
            patientId: request.patientId,
            priority: request.priority,
            reason: request.reason,
          },
          priority: notificationPriority,
          deliveryChannels,
          workplaceId: request.workplaceId,
          createdBy: request.patientId,
        });
      }

      // Also send real-time WebSocket notification
      try {
        const socketService = getChatSocketService();
        const pharmacistIds = pharmacists.map(p => p._id.toString());
        
        socketService.notifyConsultationRequest(pharmacistIds, {
          requestId: request._id,
          patientId: request.patientId,
          patientName,
          reason: request.reason,
          priority: request.priority,
        });

        // Broadcast queue update
        socketService.broadcastQueueUpdate(request.workplaceId.toString(), {
          action: 'new_request',
          requestId: request._id,
        });
      } catch (socketError) {
        // Don't fail if WebSocket notification fails
        logger.warn('Failed to send WebSocket notification', { error: socketError });
      }

      logger.info('Notified pharmacists about consultation request', {
        requestId: request._id,
        pharmacistCount: pharmacists.length,
        priority: request.priority,
      });
    } catch (error) {
      logger.error('Error notifying pharmacists', { error, requestId: request._id });
    }
  }

  /**
   * Notify supervisors/managers about escalated request
   */
  private async notifyEscalation(request: IConsultationRequest): Promise<void> {
    try {
      // Find pharmacy managers and supervisors
      const supervisors = await User.find({
        workplaceId: request.workplaceId,
        role: { $in: ['pharmacy_manager', 'supervisor', 'admin'] },
        isActive: true,
      }).select('_id firstName lastName');

      if (supervisors.length === 0) {
        logger.warn('No supervisors found for escalation notification', {
          requestId: request._id,
          workplaceId: request.workplaceId,
        });
        return;
      }

      // Get patient info
      const patient = await User.findById(request.patientId).select('firstName lastName');
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'A patient';

      // Calculate wait time
      const waitTime = Math.floor((Date.now() - request.requestedAt.getTime()) / 1000 / 60);

      // Send escalation notification to supervisors
      for (const supervisor of supervisors) {
        await notificationService.createNotification({
          userId: supervisor._id,
          type: 'consultation_escalated',
          title: '⚠️ Consultation Request Escalated',
          content: `Consultation request from ${patientName} has been waiting for ${waitTime} minutes without response. Priority: ${request.priority.toUpperCase()}`,
          data: {
            consultationRequestId: request._id,
            patientId: request.patientId,
            priority: request.priority,
            reason: request.reason,
            waitTime,
            escalationLevel: request.escalationLevel,
          },
          priority: 'urgent',
          deliveryChannels: {
            inApp: true,
            email: true,
            sms: request.priority === 'urgent', // SMS for urgent escalations
            push: true,
          },
          workplaceId: request.workplaceId,
          createdBy: request.patientId,
        });
      }

      // Also send real-time WebSocket notification
      try {
        const socketService = getChatSocketService();
        const supervisorIds = supervisors.map(s => s._id.toString());
        
        socketService.notifyConsultationEscalated(supervisorIds, {
          requestId: request._id,
          patientId: request.patientId,
          patientName,
          reason: request.reason,
          priority: request.priority,
          waitTime,
          escalationLevel: request.escalationLevel,
        });
      } catch (socketError) {
        logger.warn('Failed to send WebSocket escalation notification', { error: socketError });
      }

      logger.info('Notified supervisors about escalated consultation request', {
        requestId: request._id,
        supervisorCount: supervisors.length,
        escalationLevel: request.escalationLevel,
      });
    } catch (error) {
      logger.error('Error notifying escalation', { error, requestId: request._id });
    }
  }

  /**
   * Schedule escalation check for request
   */
  private scheduleEscalationCheck(requestId: string, workplaceId: string): void {
    // Schedule check after 5 minutes
    setTimeout(async () => {
      try {
        await this.checkAndEscalate(requestId, workplaceId);
      } catch (error) {
        logger.error('Error in escalation check', { error, requestId });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Check if request needs escalation and escalate if needed
   */
  async checkAndEscalate(requestId: string, workplaceId: string): Promise<void> {
    try {
      const request = await ConsultationRequest.findOne({
        _id: new mongoose.Types.ObjectId(requestId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!request || request.status !== 'pending') {
        return; // Request no longer pending
      }

      if (request.needsEscalation()) {
        await request.escalate();

        logger.warn('Consultation request escalated', {
          requestId,
          escalationCount: request.escalationCount,
        });

        // Notify supervisors about escalation
        await this.notifyEscalation(request);

        // Also notify all pharmacists again (escalation)
        await this.notifyPharmacists(request);

        // Schedule another check if not too many escalations
        if (request.escalationCount < 3) {
          this.scheduleEscalationCheck(requestId, workplaceId);
        }
      }
    } catch (error) {
      logger.error('Error checking escalation', { error, requestId });
    }
  }

  /**
   * Process all pending escalations (can be run periodically)
   */
  async processEscalations(workplaceId: string): Promise<number> {
    try {
      const requests = await ConsultationRequest.findNeedingEscalation(workplaceId);

      let escalatedCount = 0;

      for (const request of requests) {
        await request.escalate();
        await this.notifyPharmacists(request);
        escalatedCount++;

        logger.warn('Consultation request escalated (batch)', {
          requestId: request._id,
          escalationCount: request.escalationCount,
        });
      }

      return escalatedCount;
    } catch (error) {
      logger.error('Error processing escalations', { error, workplaceId });
      throw error;
    }
  }

  /**
   * Get consultation statistics
   */
  async getStatistics(workplaceId: string): Promise<{
    total: number;
    pending: number;
    accepted: number;
    completed: number;
    cancelled: number;
    averageResponseTime: number; // in minutes
  }> {
    try {
      const requests = await ConsultationRequest.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      const stats = {
        total: requests.length,
        pending: 0,
        accepted: 0,
        completed: 0,
        cancelled: 0,
        averageResponseTime: 0,
      };

      let totalResponseTime = 0;
      let acceptedCount = 0;

      requests.forEach((request) => {
        stats[request.status]++;

        if (request.acceptedAt) {
          const responseTime =
            (request.acceptedAt.getTime() - request.createdAt.getTime()) / (1000 * 60);
          totalResponseTime += responseTime;
          acceptedCount++;
        }
      });

      if (acceptedCount > 0) {
        stats.averageResponseTime = Math.round(totalResponseTime / acceptedCount);
      }

      return stats;
    } catch (error) {
      logger.error('Error getting consultation statistics', { error, workplaceId });
      throw error;
    }
  }
}

// Export singleton instance
export const consultationRequestService = new ConsultationRequestService();
export default consultationRequestService;
