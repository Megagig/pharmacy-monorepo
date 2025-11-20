import mongoose from "mongoose";
import CommunicationAuditLog, {
  ICommunicationAuditLog,
  ICommunicationAuditLogDetails,
} from "../models/CommunicationAuditLog";
import { Request } from "express";
import { AuthRequest } from "../types/auth";
import logger from "../utils/logger";

export interface CommunicationAuditContext {
  userId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
}

export interface CreateCommunicationAuditLogData {
  action: ICommunicationAuditLog["action"];
  targetId: mongoose.Types.ObjectId;
  targetType: ICommunicationAuditLog["targetType"];
  details: ICommunicationAuditLogDetails;
  success?: boolean;
  errorMessage?: string;
  duration?: number;
}

export interface CommunicationAuditFilters {
  userId?: string;
  action?: string;
  targetType?: string;
  conversationId?: string;
  patientId?: string;
  riskLevel?: string;
  complianceCategory?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Service for managing communication audit logs
 */
export class CommunicationAuditService {
  /**
   * Create a communication audit log entry
   */
  static async createAuditLog(
    context: CommunicationAuditContext,
    data: CreateCommunicationAuditLogData,
  ): Promise<ICommunicationAuditLog> {
    try {
      const auditLog = new CommunicationAuditLog({
        action: data.action,
        userId: context.userId,
        targetId: data.targetId,
        targetType: data.targetType,
        details: data.details,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        workplaceId: context.workplaceId,
        success: data.success !== false,
        errorMessage: data.errorMessage,
        duration: data.duration,
      });

      // Auto-set risk level and compliance category
      auditLog.setRiskLevel();

      await auditLog.save();

      logger.info("Communication audit log created", {
        auditId: auditLog._id,
        action: auditLog.action,
        userId: context.userId,
        targetType: data.targetType,
        riskLevel: auditLog.riskLevel,
        service: "communication-audit",
      });

      return auditLog;
    } catch (error) {
      logger.error("Failed to create communication audit log", {
        error: error instanceof Error ? error.message : "Unknown error",
        action: data.action,
        userId: context.userId,
        service: "communication-audit",
      });
      throw error;
    }
  }

  /**
   * Log message sent activity
   */
  static async logMessageSent(
    context: CommunicationAuditContext,
    messageId: mongoose.Types.ObjectId,
    conversationId: mongoose.Types.ObjectId,
    details: {
      messageType: string;
      hasAttachments?: boolean;
      mentionCount?: number;
      priority?: string;
      patientId?: mongoose.Types.ObjectId;
    },
  ): Promise<ICommunicationAuditLog> {
    return this.createAuditLog(context, {
      action: "message_sent",
      targetId: messageId,
      targetType: "message",
      details: {
        conversationId,
        patientId: details.patientId,
        metadata: {
          messageType: details.messageType,
          hasAttachments: details.hasAttachments || false,
          mentionCount: details.mentionCount || 0,
          priority: details.priority || "normal",
        },
      },
    });
  }

  /**
   * Log message read activity
   */
  static async logMessageRead(
    context: CommunicationAuditContext,
    messageId: mongoose.Types.ObjectId,
    conversationId: mongoose.Types.ObjectId,
    patientId?: mongoose.Types.ObjectId,
  ): Promise<ICommunicationAuditLog> {
    return this.createAuditLog(context, {
      action: "message_read",
      targetId: messageId,
      targetType: "message",
      details: {
        conversationId,
        patientId,
        metadata: {
          readAt: new Date(),
        },
      },
    });
  }

  /**
   * Log conversation created activity
   */
  static async logConversationCreated(
    context: CommunicationAuditContext,
    conversationId: mongoose.Types.ObjectId,
    details: {
      conversationType: string;
      participantCount: number;
      patientId?: mongoose.Types.ObjectId;
      priority?: string;
    },
  ): Promise<ICommunicationAuditLog> {
    return this.createAuditLog(context, {
      action: "conversation_created",
      targetId: conversationId,
      targetType: "conversation",
      details: {
        conversationId,
        patientId: details.patientId,
        metadata: {
          conversationType: details.conversationType,
          participantCount: details.participantCount,
          priority: details.priority || "normal",
        },
      },
    });
  }

  /**
   * Log participant added activity
   */
  static async logParticipantAdded(
    context: CommunicationAuditContext,
    conversationId: mongoose.Types.ObjectId,
    addedUserId: mongoose.Types.ObjectId,
    details: {
      role: string;
      patientId?: mongoose.Types.ObjectId;
    },
  ): Promise<ICommunicationAuditLog> {
    return this.createAuditLog(context, {
      action: "participant_added",
      targetId: conversationId,
      targetType: "conversation",
      details: {
        conversationId,
        patientId: details.patientId,
        participantIds: [addedUserId],
        metadata: {
          addedUserId: addedUserId.toString(),
          role: details.role,
        },
      },
    });
  }

  /**
   * Log file upload activity
   */
  static async logFileUploaded(
    context: CommunicationAuditContext,
    fileId: string,
    conversationId: mongoose.Types.ObjectId,
    details: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      patientId?: mongoose.Types.ObjectId;
    },
  ): Promise<ICommunicationAuditLog> {
    return this.createAuditLog(context, {
      action: "file_uploaded",
      targetId: conversationId,
      targetType: "file",
      details: {
        conversationId,
        patientId: details.patientId,
        fileId,
        fileName: details.fileName,
        metadata: {
          fileSize: details.fileSize,
          mimeType: details.mimeType,
        },
      },
    });
  }

  /**
   * Log conversation export activity
   */
  static async logConversationExported(
    context: CommunicationAuditContext,
    conversationId: mongoose.Types.ObjectId,
    details: {
      exportFormat: string;
      messageCount: number;
      dateRange?: { start: Date; end: Date };
      patientId?: mongoose.Types.ObjectId;
    },
  ): Promise<ICommunicationAuditLog> {
    return this.createAuditLog(context, {
      action: "conversation_exported",
      targetId: conversationId,
      targetType: "conversation",
      details: {
        conversationId,
        patientId: details.patientId,
        metadata: {
          exportFormat: details.exportFormat,
          messageCount: details.messageCount,
          dateRange: details.dateRange,
          exportedAt: new Date(),
        },
      },
    });
  }

  /**
   * Get audit logs with filtering
   */
  static async getAuditLogs(
    workplaceId: string,
    filters: CommunicationAuditFilters = {},
  ): Promise<{
    logs: ICommunicationAuditLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    try {
      const {
        userId,
        action,
        targetType,
        conversationId,
        patientId,
        riskLevel,
        complianceCategory,
        success,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = filters;

      // Build query
      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      };

      if (userId) query.userId = new mongoose.Types.ObjectId(userId);
      if (action) query.action = action;
      if (targetType) query.targetType = targetType;
      if (conversationId)
        query["details.conversationId"] = new mongoose.Types.ObjectId(
          conversationId,
        );
      if (patientId)
        query["details.patientId"] = new mongoose.Types.ObjectId(patientId);
      if (riskLevel) query.riskLevel = riskLevel;
      if (complianceCategory) query.complianceCategory = complianceCategory;
      if (success !== undefined) query.success = success;

      // Date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }

      // Execute query
      const [logs, total] = await Promise.all([
        CommunicationAuditLog.find(query)
          .populate("userId", "firstName lastName role email")
          .sort({ timestamp: -1 })
          .limit(limit)
          .skip(offset)
          .lean(),
        CommunicationAuditLog.countDocuments(query),
      ]);

      const page = Math.floor(offset / limit) + 1;
      const pages = Math.ceil(total / limit);

      return {
        logs,
        total,
        page,
        limit,
        pages,
      };
    } catch (error) {
      logger.error("Failed to get communication audit logs", {
        error: error instanceof Error ? error.message : "Unknown error",
        workplaceId,
        filters,
        service: "communication-audit",
      });
      throw error;
    }
  }

  /**
   * Get audit logs for a specific conversation
   */
  static async getConversationAuditLogs(
    conversationId: string,
    workplaceId: string,
    options: { limit?: number; startDate?: Date; endDate?: Date } = {},
  ): Promise<ICommunicationAuditLog[]> {
    try {
      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        "details.conversationId": new mongoose.Types.ObjectId(conversationId),
      };

      if (options.startDate || options.endDate) {
        query.timestamp = {};
        if (options.startDate) query.timestamp.$gte = options.startDate;
        if (options.endDate) query.timestamp.$lte = options.endDate;
      }

      return await CommunicationAuditLog.find(query)
        .populate("userId", "firstName lastName role")
        .sort({ timestamp: -1 })
        .limit(options.limit || 100);
    } catch (error) {
      logger.error("Failed to get conversation audit logs", {
        error: error instanceof Error ? error.message : "Unknown error",
        conversationId,
        workplaceId,
        service: "communication-audit",
      });
      throw error;
    }
  }

  /**
   * Get high-risk activities
   */
  static async getHighRiskActivities(
    workplaceId: string,
    timeRange: { start: Date; end: Date },
  ): Promise<ICommunicationAuditLog[]> {
    try {
      return await CommunicationAuditLog.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        riskLevel: { $in: ["high", "critical"] },
        timestamp: {
          $gte: timeRange.start,
          $lte: timeRange.end,
        },
      })
        .populate("userId", "firstName lastName role")
        .sort({ timestamp: -1 });
    } catch (error) {
      logger.error("Failed to get high-risk activities", {
        error: error instanceof Error ? error.message : "Unknown error",
        workplaceId,
        timeRange,
        service: "communication-audit",
      });
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(
    workplaceId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<any[]> {
    try {
      return await CommunicationAuditLog.aggregate([
        {
          $match: {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            timestamp: {
              $gte: dateRange.start,
              $lte: dateRange.end,
            },
          },
        },
        {
          $group: {
            _id: {
              complianceCategory: "$complianceCategory",
              riskLevel: "$riskLevel",
              success: "$success",
            },
            count: { $sum: 1 },
            avgDuration: { $avg: "$duration" },
            actions: { $addToSet: "$action" },
          },
        },
        {
          $sort: { "_id.riskLevel": -1, count: -1 },
        },
      ]);
    } catch (error) {
      logger.error("Failed to generate compliance report", {
        error: error instanceof Error ? error.message : "Unknown error",
        workplaceId,
        dateRange,
        service: "communication-audit",
      });
      throw error;
    }
  }

  /**
   * Export audit logs to CSV
   */
  static async exportAuditLogs(
    workplaceId: string,
    filters: CommunicationAuditFilters,
    format: "csv" | "json" = "csv",
  ): Promise<string> {
    try {
      const result = await this.getAuditLogs(workplaceId, {
        ...filters,
        limit: 10000, // Large limit for export
      });

      if (format === "csv") {
        return this.convertToCSV(result.logs);
      } else {
        return JSON.stringify(result.logs, null, 2);
      }
    } catch (error) {
      logger.error("Failed to export audit logs", {
        error: error instanceof Error ? error.message : "Unknown error",
        workplaceId,
        filters,
        format,
        service: "communication-audit",
      });
      throw error;
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  private static convertToCSV(logs: any[]): string {
    if (logs.length === 0) {
      return "No data available";
    }

    const headers = [
      "Timestamp",
      "Action",
      "User",
      "User Email",
      "Target Type",
      "Target ID",
      "Risk Level",
      "Compliance Category",
      "Success",
      "Conversation ID",
      "Patient ID",
      "IP Address",
      "Duration (ms)",
      "Details",
    ];

    const rows = logs.map((log) => [
      log.timestamp,
      log.action,
      log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : "Unknown",
      log.userId?.email || "Unknown",
      log.targetType,
      log.targetId,
      log.riskLevel,
      log.complianceCategory,
      log.success ? "Yes" : "No",
      log.details?.conversationId || "",
      log.details?.patientId || "",
      log.ipAddress,
      log.duration || "",
      log.getFormattedDetails
        ? log.getFormattedDetails()
        : JSON.stringify(log.details).replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    return csvContent;
  }

  /**
   * Create audit context from request
   */
  static createAuditContext(req: AuthRequest): CommunicationAuditContext {
    // Extract and validate IP address
    let ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
    
    // Handle cases where IP might be undefined or in wrong format
    if (!ipAddress || ipAddress === '::ffff:127.0.0.1') {
      ipAddress = '127.0.0.1';
    } else if (ipAddress.startsWith('::ffff:')) {
      // Convert IPv4-mapped IPv6 to IPv4
      ipAddress = ipAddress.substring(7);
    }
    
    // Fallback to localhost if still invalid
    if (!ipAddress || ipAddress === 'undefined') {
      ipAddress = '127.0.0.1';
    }

    return {
      userId: req.user!._id,
      workplaceId: typeof req.user!.workplaceId === 'string'
        ? new mongoose.Types.ObjectId(req.user!.workplaceId)
        : req.user!.workplaceId!,
      ipAddress,
      userAgent: req.get("User-Agent") || "unknown",
      sessionId: (req as any).sessionID || req.get("X-Session-ID"),
    };
  }

  /**
   * Get user activity summary
   */
  static async getUserActivitySummary(
    userId: string,
    workplaceId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<any[]> {
    try {
      return await CommunicationAuditLog.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            timestamp: {
              $gte: dateRange.start,
              $lte: dateRange.end,
            },
          },
        },
        {
          $group: {
            _id: "$action",
            count: { $sum: 1 },
            lastActivity: { $max: "$timestamp" },
            successRate: {
              $avg: { $cond: ["$success", 1, 0] },
            },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);
    } catch (error) {
      logger.error("Failed to get user activity summary", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        workplaceId,
        dateRange,
        service: "communication-audit",
      });
      throw error;
    }
  }

  /**
   * Log bulk operation
   */
  static async logBulkOperation(
    context: CommunicationAuditContext,
    action: string,
    targetIds: mongoose.Types.ObjectId[],
    targetType: ICommunicationAuditLog["targetType"],
    details: ICommunicationAuditLogDetails,
  ): Promise<ICommunicationAuditLog> {
    if (targetIds.length === 0) {
      throw new Error("No target IDs provided for bulk operation");
    }

    return this.createAuditLog(context, {
      action: action as ICommunicationAuditLog["action"],
      targetId: targetIds[0]!, // Use first ID as primary target
      targetType,
      details: {
        ...details,
        metadata: {
          ...details.metadata,
          bulkOperation: true,
          targetCount: targetIds.length,
          allTargetIds: targetIds.map((id) => id.toString()),
        },
      },
    });
  }

  /**
   * Clean up old audit logs (for maintenance)
   */
  static async cleanupOldLogs(daysToKeep: number = 2555): Promise<number> {
    // 7 years default
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await CommunicationAuditLog.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      logger.info(
        `Cleaned up ${result.deletedCount} old communication audit logs`,
        {
          cutoffDate,
          deletedCount: result.deletedCount,
          service: "communication-audit",
        },
      );

      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to cleanup old communication audit logs", {
        error: error instanceof Error ? error.message : "Unknown error",
        daysToKeep,
        service: "communication-audit",
      });
      throw error;
    }
  }
}

export default CommunicationAuditService;
