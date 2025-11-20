import { Request } from 'express';
import mongoose from 'mongoose';
import { WorkspaceAuditLog, IWorkspaceAuditLog, AuditLogDetails } from '../models/WorkspaceAuditLog';

export interface WorkspaceAuditLogParams {
  workplaceId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  targetId?: mongoose.Types.ObjectId;
  action: string;
  category: 'member' | 'role' | 'permission' | 'invite' | 'auth' | 'settings';
  details?: AuditLogDetails;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuditQueryFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  actorId?: string;
  targetId?: string;
  category?: string;
  action?: string;
  severity?: string;
}

/**
 * Workspace Audit Service
 * Handles audit logging for workspace team management operations
 */
class WorkspaceAuditService {
  /**
   * Create an audit log entry
   */
  async logAudit(params: WorkspaceAuditLogParams, req?: Request): Promise<IWorkspaceAuditLog> {
    try {
      const auditData: Partial<IWorkspaceAuditLog> = {
        workplaceId: params.workplaceId,
        actorId: params.actorId,
        targetId: params.targetId,
        action: params.action,
        category: params.category,
        details: params.details || {},
        ipAddress: params.ipAddress || this.getClientIP(req),
        userAgent: params.userAgent || req?.get('User-Agent'),
        severity: params.severity || this.calculateSeverity(params.action, params.category),
        timestamp: new Date(),
      };

      const auditLog = new WorkspaceAuditLog(auditData);
      await auditLog.save();

      return auditLog;
    } catch (error: any) {
      console.error('Error creating workspace audit log:', error);
      throw new Error(`Failed to create workspace audit log: ${error.message}`);
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(
    workplaceId: mongoose.Types.ObjectId,
    filters: AuditQueryFilters = {}
  ): Promise<{
    logs: IWorkspaceAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        actorId,
        targetId,
        category,
        action,
        severity,
      } = filters;

      // Build query
      const query: any = { workplaceId };

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
      if (actorId) {
        query.actorId = new mongoose.Types.ObjectId(actorId);
      }
      if (targetId) {
        query.targetId = new mongoose.Types.ObjectId(targetId);
      }
      if (category) {
        query.category = category;
      }
      if (action) {
        query.action = action;
      }
      if (severity) {
        query.severity = severity;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query with population
      const [logs, total] = await Promise.all([
        WorkspaceAuditLog.find(query)
          .populate('actorId', 'firstName lastName email')
          .populate('targetId', 'firstName lastName email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        WorkspaceAuditLog.countDocuments(query),
      ]);

      return {
        logs: logs as IWorkspaceAuditLog[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('Error fetching workspace audit logs:', error);
      throw new Error(`Failed to fetch workspace audit logs: ${error.message}`);
    }
  }

  /**
   * Get audit logs for a specific member (as target)
   */
  async getMemberAuditLogs(
    workplaceId: mongoose.Types.ObjectId,
    memberId: mongoose.Types.ObjectId,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    logs: IWorkspaceAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.getAuditLogs(workplaceId, {
      ...options,
      targetId: memberId.toString(),
    });
  }

  /**
   * Get audit logs by actor (who performed the action)
   */
  async getAuditLogsByActor(
    workplaceId: mongoose.Types.ObjectId,
    actorId: mongoose.Types.ObjectId,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    logs: IWorkspaceAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.getAuditLogs(workplaceId, {
      ...options,
      actorId: actorId.toString(),
    });
  }

  /**
   * Get audit logs by category
   */
  async getAuditLogsByCategory(
    workplaceId: mongoose.Types.ObjectId,
    category: 'member' | 'role' | 'permission' | 'invite' | 'auth' | 'settings',
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    logs: IWorkspaceAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    return this.getAuditLogs(workplaceId, {
      ...options,
      category,
    });
  }

  /**
   * Get high severity audit logs
   */
  async getHighSeverityLogs(
    workplaceId: mongoose.Types.ObjectId,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    logs: IWorkspaceAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const query = {
        workplaceId,
        severity: { $in: ['high', 'critical'] },
      };

      const [logs, total] = await Promise.all([
        WorkspaceAuditLog.find(query)
          .populate('actorId', 'firstName lastName email')
          .populate('targetId', 'firstName lastName email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        WorkspaceAuditLog.countDocuments(query),
      ]);

      return {
        logs: logs as IWorkspaceAuditLog[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('Error fetching high severity logs:', error);
      throw new Error(`Failed to fetch high severity logs: ${error.message}`);
    }
  }

  /**
   * Get audit statistics for the workspace
   */
  async getAuditStatistics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<{
    totalLogs: number;
    logsByCategory: Record<string, number>;
    logsBySeverity: Record<string, number>;
    recentActivity: number;
    uniqueActors: number;
  }> {
    try {
      const query: any = { workplaceId };

      if (dateRange) {
        query.timestamp = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      const [totalLogs, categoryStats, severityStats, uniqueActors, recentActivity] =
        await Promise.all([
          WorkspaceAuditLog.countDocuments(query),
          WorkspaceAuditLog.aggregate([
            { $match: query },
            { $group: { _id: '$category', count: { $sum: 1 } } },
          ]),
          WorkspaceAuditLog.aggregate([
            { $match: query },
            { $group: { _id: '$severity', count: { $sum: 1 } } },
          ]),
          WorkspaceAuditLog.distinct('actorId', query).then((actors) => actors.length),
          WorkspaceAuditLog.countDocuments({
            workplaceId,
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          }),
        ]);

      const logsByCategory = categoryStats.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      const logsBySeverity = severityStats.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      return {
        totalLogs,
        logsByCategory,
        logsBySeverity,
        recentActivity,
        uniqueActors,
      };
    } catch (error: any) {
      console.error('Error calculating audit statistics:', error);
      throw new Error(`Failed to calculate audit statistics: ${error.message}`);
    }
  }

  /**
   * Export audit logs to CSV
   */
  async exportAuditLogs(
    workplaceId: mongoose.Types.ObjectId,
    filters: AuditQueryFilters = {}
  ): Promise<string> {
    try {
      // Get all logs without pagination for export
      const result = await this.getAuditLogs(workplaceId, {
        ...filters,
        limit: 10000, // Large limit for export
      });

      return this.convertToCSV(result.logs);
    } catch (error: any) {
      console.error('Error exporting audit logs:', error);
      throw new Error(`Failed to export audit logs: ${error.message}`);
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertToCSV(logs: any[]): string {
    if (logs.length === 0) {
      return 'No audit data available';
    }

    const headers = [
      'Timestamp',
      'Action',
      'Category',
      'Actor Name',
      'Actor Email',
      'Target Name',
      'Target Email',
      'Severity',
      'IP Address',
      'Reason',
      'Before',
      'After',
    ];

    const rows = logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.action,
      log.category,
      log.actorId ? `${log.actorId.firstName} ${log.actorId.lastName}` : 'Unknown',
      log.actorId?.email || 'Unknown',
      log.targetId ? `${log.targetId.firstName} ${log.targetId.lastName}` : '',
      log.targetId?.email || '',
      log.severity,
      log.ipAddress || '',
      log.details?.reason || '',
      log.details?.before ? JSON.stringify(log.details.before).replace(/"/g, '""') : '',
      log.details?.after ? JSON.stringify(log.details.after).replace(/"/g, '""') : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((field) => `"${field}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Calculate severity based on action and category
   */
  private calculateSeverity(
    action: string,
    category: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical severity actions
    const criticalActions = [
      'member_removed',
      'member_suspended',
      'permission_revoked',
      'unauthorized_attempt',
      'access_denied',
    ];

    // High severity actions
    const highActions = [
      'role_changed',
      'permission_granted',
      'member_rejected',
      'invite_revoked',
    ];

    // Medium severity actions
    const mediumActions = [
      'role_assigned',
      'member_activated',
      'member_approved',
      'invite_generated',
    ];

    if (criticalActions.includes(action)) {
      return 'critical';
    }

    if (highActions.includes(action)) {
      return 'high';
    }

    if (mediumActions.includes(action)) {
      return 'medium';
    }

    // Category-based severity
    if (category === 'auth' || category === 'permission') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(req?: Request): string {
    if (!req) return 'unknown';

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
   * Log member action (helper method)
   */
  async logMemberAction(
    workplaceId: mongoose.Types.ObjectId,
    actorId: mongoose.Types.ObjectId,
    targetId: mongoose.Types.ObjectId,
    action: string,
    details?: AuditLogDetails,
    req?: Request
  ): Promise<IWorkspaceAuditLog> {
    return this.logAudit(
      {
        workplaceId,
        actorId,
        targetId,
        action,
        category: 'member',
        details,
      },
      req
    );
  }

  /**
   * Log role action (helper method)
   */
  async logRoleAction(
    workplaceId: mongoose.Types.ObjectId,
    actorId: mongoose.Types.ObjectId,
    targetId: mongoose.Types.ObjectId,
    action: string,
    details?: AuditLogDetails,
    req?: Request
  ): Promise<IWorkspaceAuditLog> {
    return this.logAudit(
      {
        workplaceId,
        actorId,
        targetId,
        action,
        category: 'role',
        details,
      },
      req
    );
  }

  /**
   * Log invite action (helper method)
   */
  async logInviteAction(
    workplaceId: mongoose.Types.ObjectId,
    actorId: mongoose.Types.ObjectId,
    action: string,
    details?: AuditLogDetails,
    req?: Request
  ): Promise<IWorkspaceAuditLog> {
    return this.logAudit(
      {
        workplaceId,
        actorId,
        action,
        category: 'invite',
        details,
      },
      req
    );
  }

  /**
   * Log license-related actions (approval, rejection)
   */
  async logLicenseAction(
    workplaceId: mongoose.Types.ObjectId,
    actorId: mongoose.Types.ObjectId,
    targetId: mongoose.Types.ObjectId,
    action: string,
    details?: AuditLogDetails,
    req?: Request
  ): Promise<IWorkspaceAuditLog> {
    return this.logAudit(
      {
        workplaceId,
        actorId,
        targetId,
        action,
        category: 'member',
        details,
        severity: action.includes('approved') ? 'medium' : 'high',
      },
      req
    );
  }
}

// Export singleton instance
export const workspaceAuditService = new WorkspaceAuditService();
export default workspaceAuditService;
