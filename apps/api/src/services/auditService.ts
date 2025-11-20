import { AuditLog, IAuditLog } from '../models/AuditLog';
import { Request } from 'express';
import mongoose from 'mongoose';
import logger from '../utils/logger';

export interface AuditLogData {
  action: string;
  userId: string;
  interventionId?: string;
  resourceType?: string;
  resourceId?: mongoose.Types.ObjectId | string;
  patientId?: mongoose.Types.ObjectId | string;
  details: Record<string, any>;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory: string;
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  workspaceId?: string;
}

export interface AuditQueryOptions {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  riskLevel?: string;
  userId?: string;
  action?: string;
  interventionId?: string;
  complianceCategory?: string;
}

class AuditService {
  /**
   * Create an audit log entry
   */
  static async createAuditLog(
    data: AuditLogData,
    req?: Request
  ): Promise<IAuditLog> {
    try {
      const auditData: Partial<IAuditLog> = {
        action: data.action,
        userId: new mongoose.Types.ObjectId(data.userId),
        details: data.details,
        riskLevel: data.riskLevel || AuditService.calculateRiskLevel(data.action, data.details),
        complianceCategory: data.complianceCategory,
        changedFields: data.changedFields,
        oldValues: data.oldValues,
        newValues: data.newValues,
        timestamp: new Date()
      };

      // Add intervention ID if provided
      if (data.interventionId) {
        auditData.interventionId = new mongoose.Types.ObjectId(data.interventionId);
      }

      // Add workspace ID if provided
      if (data.workspaceId) {
        auditData.workspaceId = new mongoose.Types.ObjectId(data.workspaceId);
      }

      // Extract request information if available
      if (req) {
        auditData.ipAddress = AuditService.getClientIP(req);
        auditData.userAgent = req.get('User-Agent');
        auditData.sessionId = (req as any).sessionID || req.get('X-Session-ID');
      }

      const auditLog = new AuditLog(auditData);
      await auditLog.save();

      return auditLog;
    } catch (error) {
      logger.error('Error creating audit log:', error);
      throw new Error('Failed to create audit log');
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(options: AuditQueryOptions = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        riskLevel,
        userId,
        action,
        interventionId,
        complianceCategory
      } = options;

      // Build query
      const query: any = {};

      // Date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) {
          query.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          query.timestamp.$lte = new Date(endDate);
        }
      }

      // Other filters
      if (riskLevel) query.riskLevel = riskLevel;
      if (userId) query.userId = new mongoose.Types.ObjectId(userId);
      if (action) query.action = action;
      if (interventionId) query.interventionId = new mongoose.Types.ObjectId(interventionId);
      if (complianceCategory) query.complianceCategory = complianceCategory;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query with population
      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .populate('userId', 'firstName lastName email')
          .populate('interventionId', 'interventionNumber')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(query)
      ]);

      // Calculate summary statistics
      const summary = await AuditService.calculateSummary(query);

      return {
        logs,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
        summary
      };
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      throw new Error('Failed to fetch audit logs');
    }
  }

  /**
   * Get audit logs for a specific intervention
   */
  static async getInterventionAuditLogs(
    interventionId: string,
    options: AuditQueryOptions = {}
  ) {
    return AuditService.getAuditLogs({
      ...options,
      interventionId
    });
  }

  /**
   * Calculate summary statistics for audit logs
   */
  static async calculateSummary(query: any = {}) {
    try {
      const [
        totalActions,
        uniqueUsers,
        riskActivities,
        lastActivity
      ] = await Promise.all([
        AuditLog.countDocuments(query),
        AuditLog.distinct('userId', query).then(users => users.length),
        AuditLog.countDocuments({ ...query, riskLevel: { $in: ['high', 'critical'] } }),
        AuditLog.findOne(query, 'timestamp').sort({ timestamp: -1 }).lean()
      ]);

      return {
        totalActions,
        uniqueUsers,
        riskActivities,
        lastActivity: lastActivity?.timestamp || null
      };
    } catch (error) {
      logger.error('Error calculating audit summary:', error);
      return {
        totalActions: 0,
        uniqueUsers: 0,
        riskActivities: 0,
        lastActivity: null
      };
    }
  }

  /**
   * Export audit logs to CSV
   */
  static async exportAuditLogs(options: AuditQueryOptions & { format: 'csv' | 'json' }) {
    try {
      const { format, ...queryOptions } = options;

      // Get all logs without pagination for export
      const result = await AuditService.getAuditLogs({
        ...queryOptions,
        limit: 10000 // Large limit for export
      });

      if (format === 'csv') {
        return AuditService.convertToCSV(result.logs);
      } else {
        return JSON.stringify(result.logs, null, 2);
      }
    } catch (error) {
      logger.error('Error exporting audit logs:', error);
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  private static convertToCSV(logs: any[]): string {
    if (logs.length === 0) {
      return 'No data available';
    }

    const headers = [
      'Timestamp',
      'Action',
      'User',
      'User Email',
      'Risk Level',
      'Compliance Category',
      'Intervention ID',
      'Changed Fields',
      'IP Address',
      'Details'
    ];

    const rows = logs.map(log => [
      log.timestamp,
      log.action,
      log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'Unknown',
      log.userId?.email || 'Unknown',
      log.riskLevel,
      log.complianceCategory,
      log.interventionId?.interventionNumber || '',
      log.changedFields?.join(', ') || '',
      log.ipAddress || '',
      JSON.stringify(log.details).replace(/"/g, '""') // Escape quotes for CSV
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Calculate risk level based on action and details
   */
  private static calculateRiskLevel(
    action: string,
    details: Record<string, any>
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical risk actions
    const criticalActions = [
      'INTERVENTION_DELETED',
      'PATIENT_DATA_ACCESSED',
      'PERMISSION_CHANGED',
      'SYSTEM_BACKUP',
      'DATA_MIGRATION'
    ];

    // High risk actions
    const highRiskActions = [
      'MEDICATION_CHANGED',
      'DOSAGE_MODIFIED',
      'CONTRAINDICATION_FLAGGED',
      'INTERVENTION_ESCALATED'
    ];

    // Medium risk actions
    const mediumRiskActions = [
      'INTERVENTION_UPDATED',
      'INTERVENTION_REJECTED',
      'ALLERGY_UPDATED',
      'RISK_ASSESSMENT_UPDATED'
    ];

    if (criticalActions.includes(action)) {
      return 'critical';
    }

    if (highRiskActions.includes(action)) {
      return 'high';
    }

    if (mediumRiskActions.includes(action)) {
      return 'medium';
    }

    // Check details for risk indicators
    if (details.priority === 'critical' || details.riskLevel === 'high') {
      return 'high';
    }

    if (details.priority === 'high' || details.riskLevel === 'medium') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      req.get('X-Forwarded-For') ||
      req.get('X-Real-IP') ||
      'unknown'
    );
  }

  /**
   * Clean up old audit logs (for maintenance)
   */
  static async cleanupOldLogs(daysToKeep: number = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      logger.info(`Cleaned up ${result.deletedCount} old audit logs`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old audit logs:', error);
      throw new Error('Failed to cleanup old audit logs');
    }
  }

  /**
   * Get compliance report
   */
  static async getComplianceReport(options: {
    startDate: string;
    endDate: string;
    includeDetails?: boolean;
    interventionIds?: string[];
  }) {
    try {
      const query: any = {
        timestamp: {
          $gte: new Date(options.startDate),
          $lte: new Date(options.endDate)
        }
      };

      if (options.interventionIds && options.interventionIds.length > 0) {
        query.interventionId = {
          $in: options.interventionIds.map(id => new mongoose.Types.ObjectId(id))
        };
      }

      const [
        totalInterventions,
        auditedActions,
        riskActivities,
        complianceByCategory
      ] = await Promise.all([
        AuditLog.distinct('interventionId', query).then(ids => ids.length),
        AuditLog.countDocuments(query),
        AuditLog.countDocuments({ ...query, riskLevel: { $in: ['high', 'critical'] } }),
        AuditLog.aggregate([
          { $match: query },
          { $group: { _id: '$complianceCategory', count: { $sum: 1 } } }
        ])
      ]);

      const complianceScore = totalInterventions > 0
        ? Math.max(0, 100 - (riskActivities / auditedActions) * 100)
        : 100;

      return {
        summary: {
          totalInterventions,
          auditedActions,
          complianceScore: Math.round(complianceScore),
          riskActivities
        },
        complianceByCategory: complianceByCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      throw new Error('Failed to generate compliance report');
    }
  }

  /**
   * Create audit context from request
   */
  static createAuditContext(req: Request) {
    return {
      userId: (req as any).user?.id || 'unknown',
      ipAddress: AuditService.getClientIP(req),
      userAgent: req.get('User-Agent'),
      sessionId: (req as any).sessionID || req.get('X-Session-ID'),
      workspaceId: (req as any).user?.workplaceId || (req as any).workspace?._id
    };
  }

  /**
   * Log activity with context
   */
  static async logActivity(context: any, data: Partial<AuditLogData>) {
    const auditData: AuditLogData = {
      action: data.action || 'UNKNOWN_ACTION',
      userId: context.userId,
      details: data.details || {},
      complianceCategory: data.complianceCategory || 'general',
      riskLevel: data.riskLevel,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      patientId: data.patientId,
      changedFields: data.changedFields,
      oldValues: data.oldValues,
      newValues: data.newValues,
      workspaceId: context.workspaceId
    };

    return AuditService.createAuditLog(auditData, {
      ip: context.ipAddress || 'system',
      connection: {},
      socket: {},
      get: (header: string) => header === 'User-Agent' ? context.userAgent : undefined,
      sessionID: context.sessionId
    } as any);
  }

  /**
   * Log MTR activity with context
   */
  static async logMTRActivity(
    context: any,
    action: string,
    session: any,
    oldValues?: any,
    newValues?: any
  ) {
    const auditData: AuditLogData = {
      action,
      userId: context.userId,
      details: {
        sessionId: session._id || session.id,
        sessionType: session.sessionType,
        patientId: session.patientId,
        pharmacistId: session.pharmacistId,
        status: session.status,
        timestamp: new Date()
      },
      complianceCategory: 'clinical_documentation',
      riskLevel: AuditService.calculateRiskLevel(action, { sessionType: session.sessionType }),
      resourceType: 'MTRSession',
      resourceId: session._id || session.id,
      patientId: session.patientId,
      oldValues,
      newValues,
      workspaceId: context.workspaceId
    };

    return AuditService.createAuditLog(auditData, {
      ip: context.ipAddress,
      get: (header: string) => header === 'User-Agent' ? context.userAgent : undefined,
      sessionID: context.sessionId
    } as any);
  }
}

// Export both named and default exports for compatibility
export { AuditService };
export default AuditService;