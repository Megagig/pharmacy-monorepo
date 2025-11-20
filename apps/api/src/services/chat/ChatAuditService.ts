import mongoose from 'mongoose';
import CommunicationAuditLog, { ICommunicationAuditLog, ICommunicationAuditLogDetails } from '../../models/CommunicationAuditLog';
import logger from '../../utils/logger';

/**
 * ChatAuditService - Comprehensive Audit Logging
 * 
 * Handles all audit logging for communication module actions
 */

export interface AuditLogContext {
  workplaceId: string;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  success?: boolean;
  errorMessage?: string;
  duration?: number;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  targetType?: string;
  conversationId?: string;
  startDate?: Date;
  endDate?: Date;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export class ChatAuditService {
  /**
   * Log conversation creation
   */
  async logConversationCreated(
    userId: string,
    conversationId: string,
    details: {
      type: string;
      participantIds: string[];
      patientId?: string;
    },
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'conversation_created',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'conversation',
        {
          participantIds: details.participantIds.map(id => new mongoose.Types.ObjectId(id)),
          patientId: details.patientId ? new mongoose.Types.ObjectId(details.patientId) : undefined,
          metadata: { type: details.type },
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging conversation creation', { error });
      throw error;
    }
  }

  /**
   * Log conversation update
   */
  async logConversationUpdated(
    userId: string,
    conversationId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'conversation_updated',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'conversation',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          oldValues,
          newValues,
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging conversation update', { error });
      throw error;
    }
  }

  /**
   * Log conversation archived
   */
  async logConversationArchived(
    userId: string,
    conversationId: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'conversation_archived',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'conversation',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging conversation archived', { error });
      throw error;
    }
  }

  /**
   * Log message sent
   */
  async logMessageSent(
    userId: string,
    messageId: string,
    conversationId: string,
    details: {
      contentType: string;
      mentions?: string[];
    },
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'message_sent',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(messageId),
        'message',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          messageId: new mongoose.Types.ObjectId(messageId),
          metadata: {
            contentType: details.contentType,
            hasMentions: details.mentions && details.mentions.length > 0,
          },
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging message sent', { error });
      throw error;
    }
  }

  /**
   * Log message edited
   */
  async logMessageEdited(
    userId: string,
    messageId: string,
    conversationId: string,
    oldContent: string,
    newContent: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'message_edited',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(messageId),
        'message',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          messageId: new mongoose.Types.ObjectId(messageId),
          oldValues: { content: oldContent },
          newValues: { content: newContent },
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging message edited', { error });
      throw error;
    }
  }

  /**
   * Log message deleted
   */
  async logMessageDeleted(
    userId: string,
    messageId: string,
    conversationId: string,
    originalContent: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'message_deleted',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(messageId),
        'message',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          messageId: new mongoose.Types.ObjectId(messageId),
          oldValues: { content: originalContent },
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging message deleted', { error });
      throw error;
    }
  }

  /**
   * Log participant added
   */
  async logParticipantAdded(
    userId: string,
    conversationId: string,
    newParticipantId: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'participant_added',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'conversation',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          participantIds: [new mongoose.Types.ObjectId(newParticipantId)],
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging participant added', { error });
      throw error;
    }
  }

  /**
   * Log participant removed
   */
  async logParticipantRemoved(
    userId: string,
    conversationId: string,
    removedParticipantId: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'participant_removed',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'conversation',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          participantIds: [new mongoose.Types.ObjectId(removedParticipantId)],
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging participant removed', { error });
      throw error;
    }
  }

  /**
   * Log participant left
   */
  async logParticipantLeft(
    userId: string,
    conversationId: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'participant_left',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'conversation',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging participant left', { error });
      throw error;
    }
  }

  /**
   * Log file uploaded
   */
  async logFileUploaded(
    userId: string,
    fileId: string,
    conversationId: string,
    fileName: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'file_uploaded',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'file',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          fileId,
          fileName,
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging file uploaded', { error });
      throw error;
    }
  }

  /**
   * Log file downloaded
   */
  async logFileDownloaded(
    userId: string,
    fileId: string,
    conversationId: string,
    fileName: string,
    context: AuditLogContext
  ): Promise<ICommunicationAuditLog> {
    try {
      return await CommunicationAuditLog.logAction(
        'file_downloaded',
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(conversationId),
        'file',
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          fileId,
          fileName,
        },
        {
          workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: context.success,
          errorMessage: context.errorMessage,
          duration: context.duration,
        }
      );
    } catch (error) {
      logger.error('Error logging file downloaded', { error });
      throw error;
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    workplaceId: string,
    filters: AuditLogFilters = {}
  ): Promise<ICommunicationAuditLog[]> {
    try {
      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      };

      if (filters.userId) {
        query.userId = new mongoose.Types.ObjectId(filters.userId);
      }

      if (filters.action) {
        query.action = filters.action;
      }

      if (filters.targetType) {
        query.targetType = filters.targetType;
      }

      if (filters.conversationId) {
        query['details.conversationId'] = new mongoose.Types.ObjectId(filters.conversationId);
      }

      if (filters.riskLevel) {
        query.riskLevel = filters.riskLevel;
      }

      if (filters.complianceCategory) {
        query.complianceCategory = filters.complianceCategory;
      }

      if (filters.success !== undefined) {
        query.success = filters.success;
      }

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }

      const logs = await CommunicationAuditLog.find(query)
        .populate('userId', 'firstName lastName role email')
        .sort({ timestamp: -1 })
        .limit(filters.limit || 100)
        .skip(filters.offset || 0);

      return logs;
    } catch (error) {
      logger.error('Error getting audit logs', { error });
      throw error;
    }
  }

  /**
   * Get audit logs for a specific conversation
   */
  async getConversationAuditLogs(
    conversationId: string,
    workplaceId: string,
    options: { limit?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<ICommunicationAuditLog[]> {
    try {
      return await CommunicationAuditLog.findByConversation(
        new mongoose.Types.ObjectId(conversationId),
        new mongoose.Types.ObjectId(workplaceId),
        options
      );
    } catch (error) {
      logger.error('Error getting conversation audit logs', { error });
      throw error;
    }
  }

  /**
   * Get high-risk activities
   */
  async getHighRiskActivities(
    workplaceId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<ICommunicationAuditLog[]> {
    try {
      return await CommunicationAuditLog.findHighRiskActivities(
        new mongoose.Types.ObjectId(workplaceId),
        timeRange
      );
    } catch (error) {
      logger.error('Error getting high-risk activities', { error });
      throw error;
    }
  }

  /**
   * Get compliance report
   */
  async getComplianceReport(
    workplaceId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any[]> {
    try {
      return await CommunicationAuditLog.getComplianceReport(
        new mongoose.Types.ObjectId(workplaceId),
        dateRange
      );
    } catch (error) {
      logger.error('Error getting compliance report', { error });
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(
    userId: string,
    workplaceId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any[]> {
    try {
      return await CommunicationAuditLog.getUserActivitySummary(
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(workplaceId),
        dateRange
      );
    } catch (error) {
      logger.error('Error getting user activity summary', { error });
      throw error;
    }
  }

  /**
   * Export audit logs to CSV format
   */
  async exportAuditLogs(
    workplaceId: string,
    filters: AuditLogFilters = {}
  ): Promise<string> {
    try {
      const logs = await this.getAuditLogs(workplaceId, { ...filters, limit: 10000 });

      // CSV header
      const headers = [
        'Timestamp',
        'Action',
        'User',
        'Target Type',
        'Risk Level',
        'Compliance Category',
        'Success',
        'IP Address',
        'Details',
      ];

      // CSV rows
      const rows = logs.map(log => [
        log.timestamp.toISOString(),
        log.action,
        log.userId ? `${(log.userId as any).firstName} ${(log.userId as any).lastName}` : 'Unknown',
        log.targetType,
        log.riskLevel,
        log.complianceCategory,
        log.success ? 'Yes' : 'No',
        log.ipAddress,
        log.getFormattedDetails(),
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return csvContent;
    } catch (error) {
      logger.error('Error exporting audit logs', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const chatAuditService = new ChatAuditService();
export default chatAuditService;
