import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { SecurityAuditLog } from '../models/SecurityAuditLog';
import { AuditService } from '../services/auditService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export interface AuditFilters {
  userId?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'user_management' | 'system';
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  workspaceId?: string;
  flagged?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  flaggedEvents: number;
  criticalEvents: number;
  uniqueUsers: number;
  uniqueIPs: number;
  categoryCounts: Record<string, number>;
  actionCounts: Record<string, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: AuditSummary;
  securityIncidents: SecurityIncident[];
  accessPatterns: AccessPattern[];
  dataAccess: DataAccessSummary[];
  recommendations: string[];
}

export interface SecurityIncident {
  id: string;
  type: 'failed_login' | 'privilege_escalation' | 'suspicious_activity' | 'data_breach' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  ipAddress: string;
  timestamp: Date;
  resolved: boolean;
  resolution?: string;
}

export interface AccessPattern {
  userId: string;
  userEmail: string;
  totalAccess: number;
  uniqueResources: number;
  failedAttempts: number;
  suspiciousActivity: boolean;
  lastAccess: Date;
  riskScore: number;
}

export interface DataAccessSummary {
  resource: string;
  totalAccess: number;
  uniqueUsers: number;
  readOperations: number;
  writeOperations: number;
  deleteOperations: number;
  failedAccess: number;
}

/**
 * SaaS Audit Controller
 * Handles comprehensive audit trail management, compliance reporting, and security monitoring
 */
export class SaaSAuditController {
  private auditService: typeof AuditService;

  constructor() {
    this.auditService = AuditService;
  }

  /**
   * Get audit logs with advanced filtering
   * GET /api/admin/saas/audit/logs
   */
  async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        userId = '',
        action = '',
        resource = '',
        success = '',
        severity = '',
        category = '',
        startDate = '',
        endDate = '',
        ipAddress = '',
        workspaceId = '',
        flagged = '',
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = req.query;

      logger.info('Fetching audit logs', {
        adminId: req.user?._id,
        filters: { userId, action, resource, success, severity, category }
      });

      // Build query filters
      const filters: any = {};

      if (userId) filters.userId = userId;
      if (action) filters.action = { $regex: action, $options: 'i' };
      if (resource) filters.resource = { $regex: resource, $options: 'i' };
      if (success !== '') filters.success = success === 'true';
      if (severity) filters.severity = severity;
      if (category) filters.category = category;
      if (ipAddress) filters.ipAddress = { $regex: ipAddress, $options: 'i' };
      if (workspaceId) filters.workspaceId = workspaceId;
      if (flagged !== '') filters.flagged = flagged === 'true';

      // Date range filter
      if (startDate || endDate) {
        filters.timestamp = {};
        if (startDate) filters.timestamp.$gte = new Date(startDate as string);
        if (endDate) filters.timestamp.$lte = new Date(endDate as string);
      }

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 200);
      const skip = (pageNum - 1) * limitNum;

      // Sort configuration
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [logs, total] = await Promise.all([
        SecurityAuditLog.find(filters)
          .populate('userId', 'email firstName lastName')
          .populate('reviewedBy', 'email firstName lastName')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SecurityAuditLog.countDocuments(filters)
      ]);

      // Calculate summary statistics
      const summary = await this.calculateAuditSummary(filters);

      sendSuccess(
        res,
        {
          logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
            hasNext: pageNum * limitNum < total,
            hasPrev: pageNum > 1
          },
          summary,
          filters: {
            userId, action, resource, success, severity, category,
            startDate, endDate, ipAddress, workspaceId, flagged
          }
        },
        'Audit logs retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      sendError(
        res,
        'AUDIT_LOGS_ERROR',
        'Failed to retrieve audit logs',
        500
      );
    }
  }

  /**
   * Get audit summary and statistics
   * GET /api/admin/saas/audit/summary
   */
  async getAuditSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { timeRange = '30d' } = req.query;

      logger.info('Fetching audit summary', {
        adminId: req.user?._id,
        timeRange
      });

      const dateRange = this.getDateRange(timeRange as string);
      const filters = {
        timestamp: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      };

      const summary = await this.calculateAuditSummary(filters);

      sendSuccess(
        res,
        summary,
        'Audit summary retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching audit summary:', error);
      sendError(
        res,
        'AUDIT_SUMMARY_ERROR',
        'Failed to retrieve audit summary',
        500
      );
    }
  }

  /**
   * Generate compliance report
   * POST /api/admin/saas/audit/compliance-report
   */
  async generateComplianceReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        timeRange = '30d',
        includeIncidents = true,
        includeAccessPatterns = true,
        includeDataAccess = true,
        format = 'json'
      } = req.body;

      logger.info('Generating compliance report', {
        adminId: req.user?._id,
        timeRange,
        format
      });

      const dateRange = this.getDateRange(timeRange);
      const reportId = `compliance_${Date.now()}`;

      // Generate comprehensive compliance report
      const report: ComplianceReport = {
        reportId,
        generatedAt: new Date(),
        timeRange: dateRange,
        summary: await this.calculateAuditSummary({
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }),
        securityIncidents: includeIncidents ? await this.getSecurityIncidents(dateRange) : [],
        accessPatterns: includeAccessPatterns ? await this.getAccessPatterns(dateRange) : [],
        dataAccess: includeDataAccess ? await this.getDataAccessSummary(dateRange) : [],
        recommendations: this.generateRecommendations()
      };

      // Return report in requested format
      if (format === 'pdf') {
        const pdfBuffer = await this.generateCompliancePDF(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${format(new Date(), 'yyyy-MM-dd')}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'excel') {
        const excelBuffer = await this.generateComplianceExcel(report);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`);
        res.send(excelBuffer);
      } else {
        sendSuccess(
          res,
          report,
          'Compliance report generated successfully'
        );
      }
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      sendError(
        res,
        'COMPLIANCE_REPORT_ERROR',
        'Failed to generate compliance report',
        500
      );
    }
  }

  /**
   * Review and resolve flagged audit entries
   * PUT /api/admin/saas/audit/logs/:logId/review
   */
  async reviewAuditLog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { logId } = req.params;
      const { resolution, notes } = req.body;

      logger.info('Reviewing audit log', {
        adminId: req.user?._id,
        logId,
        resolution
      });

      const auditLog = await SecurityAuditLog.findById(logId);
      if (!auditLog) {
        sendError(res, 'AUDIT_LOG_NOT_FOUND', 'Audit log not found', 404);
        return;
      }

      // Update audit log with review information
      auditLog.reviewedBy = req.user?._id;
      auditLog.reviewedAt = new Date();
      auditLog.reviewNotes = notes;
      auditLog.flagged = false; // Unflag after review

      await auditLog.save();

      // Create audit entry for the review action
      await this.auditService.createAuditLog({
        action: 'AUDIT_LOG_REVIEWED',
        userId: req.user?._id,
        resourceType: 'SecurityAuditLog',
        resourceId: logId,
        details: {
          resolution,
          notes,
          originalLogAction: auditLog.action,
          originalLogSeverity: auditLog.severity
        },
        complianceCategory: 'audit_management',
        riskLevel: 'medium'
      });

      sendSuccess(
        res,
        {
          logId,
          reviewedBy: req.user?._id,
          reviewedAt: auditLog.reviewedAt,
          resolution,
          notes
        },
        'Audit log reviewed successfully'
      );
    } catch (error) {
      logger.error('Error reviewing audit log:', error);
      sendError(
        res,
        'AUDIT_REVIEW_ERROR',
        'Failed to review audit log',
        500
      );
    }
  }

  /**
   * Get flagged audit entries requiring review
   * GET /api/admin/saas/audit/flagged
   */
  async getFlaggedAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { limit = 50 } = req.query;

      logger.info('Fetching flagged audit logs', {
        adminId: req.user?._id
      });

      const flaggedLogs = await SecurityAuditLog.find({
        flagged: true,
        reviewedAt: { $exists: false }
      })
        .populate('userId', 'email firstName lastName')
        .sort({ riskScore: -1, timestamp: -1 })
        .limit(parseInt(limit as string, 10))
        .lean();

      const summary = {
        totalFlagged: flaggedLogs.length,
        criticalCount: flaggedLogs.filter(log => log.severity === 'critical').length,
        highRiskCount: flaggedLogs.filter(log => log.riskScore >= 70).length,
        oldestFlagged: flaggedLogs.length > 0 ? flaggedLogs[flaggedLogs.length - 1].timestamp : null
      };

      sendSuccess(
        res,
        {
          flaggedLogs,
          summary
        },
        'Flagged audit logs retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching flagged audit logs:', error);
      sendError(
        res,
        'FLAGGED_LOGS_ERROR',
        'Failed to retrieve flagged audit logs',
        500
      );
    }
  }

  /**
   * Export audit logs
   * POST /api/admin/saas/audit/export
   */
  async exportAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        format = 'csv',
        filters = {},
        includeDetails = false
      } = req.body;

      logger.info('Exporting audit logs', {
        adminId: req.user?._id,
        format,
        includeDetails
      });

      // Get audit logs based on filters
      const logs = await SecurityAuditLog.find(filters)
        .populate('userId', 'email firstName lastName')
        .sort({ timestamp: -1 })
        .limit(10000) // Limit to prevent memory issues
        .lean();

      const filename = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}`;

      if (format === 'csv') {
        const csvData = this.generateAuditCSV(logs, includeDetails);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csvData);
      } else if (format === 'excel') {
        const excelBuffer = await this.generateAuditExcel(logs, includeDetails);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        res.send(excelBuffer);
      } else {
        sendError(res, 'INVALID_FORMAT', 'Unsupported export format', 400);
      }
    } catch (error) {
      logger.error('Error exporting audit logs:', error);
      sendError(
        res,
        'EXPORT_ERROR',
        'Failed to export audit logs',
        500
      );
    }
  }

  // Private helper methods

  private async calculateAuditSummary(filters: any): Promise<AuditSummary> {
    const [
      totalEvents,
      successfulEvents,
      failedEvents,
      flaggedEvents,
      criticalEvents,
      categoryAgg,
      actionAgg,
      userAgg,
      ipAgg
    ] = await Promise.all([
      SecurityAuditLog.countDocuments(filters),
      SecurityAuditLog.countDocuments({ ...filters, success: true }),
      SecurityAuditLog.countDocuments({ ...filters, success: false }),
      SecurityAuditLog.countDocuments({ ...filters, flagged: true }),
      SecurityAuditLog.countDocuments({ ...filters, severity: 'critical' }),
      SecurityAuditLog.aggregate([
        { $match: filters },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      SecurityAuditLog.aggregate([
        { $match: filters },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]),
      SecurityAuditLog.distinct('userId', filters),
      SecurityAuditLog.distinct('ipAddress', filters)
    ]);

    const categoryCounts = categoryAgg.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const actionCounts = actionAgg.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      flaggedEvents,
      criticalEvents,
      uniqueUsers: userAgg.length,
      uniqueIPs: ipAgg.length,
      categoryCounts,
      actionCounts,
      timeRange: {
        start: filters.timestamp?.$gte || new Date(0),
        end: filters.timestamp?.$lte || new Date()
      }
    };
  }

  private async getSecurityIncidents(dateRange: { start: Date; end: Date }): Promise<SecurityIncident[]> {
    // Mock security incidents - in real implementation, this would analyze audit logs
    return [
      {
        id: 'incident1',
        type: 'failed_login',
        severity: 'medium',
        description: 'Multiple failed login attempts detected',
        ipAddress: '192.168.1.100',
        timestamp: new Date(),
        resolved: false
      }
    ];
  }

  private async getAccessPatterns(dateRange: { start: Date; end: Date }): Promise<AccessPattern[]> {
    // Mock access patterns - in real implementation, this would analyze user access logs
    return [
      {
        userId: 'user1',
        userEmail: 'user@example.com',
        totalAccess: 150,
        uniqueResources: 25,
        failedAttempts: 3,
        suspiciousActivity: false,
        lastAccess: new Date(),
        riskScore: 25
      }
    ];
  }

  private async getDataAccessSummary(dateRange: { start: Date; end: Date }): Promise<DataAccessSummary[]> {
    // Mock data access summary - in real implementation, this would analyze data access logs
    return [
      {
        resource: 'Patient Records',
        totalAccess: 500,
        uniqueUsers: 15,
        readOperations: 450,
        writeOperations: 40,
        deleteOperations: 10,
        failedAccess: 5
      }
    ];
  }

  private generateRecommendations(): string[] {
    return [
      'Enable two-factor authentication for all administrative accounts',
      'Review and update password policies regularly',
      'Monitor failed login attempts and implement account lockout policies',
      'Conduct regular security awareness training for users',
      'Implement network segmentation to limit access to sensitive resources'
    ];
  }

  private getDateRange(timeRange: string): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (timeRange) {
      case '7d':
        start = subDays(end, 7);
        break;
      case '30d':
        start = subDays(end, 30);
        break;
      case '90d':
        start = subDays(end, 90);
        break;
      case '1y':
        start = subDays(end, 365);
        break;
      default:
        start = subDays(end, 30);
    }

    return { start, end };
  }

  private async generateCompliancePDF(report: ComplianceReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Add content to PDF
        doc.fontSize(20).text('Compliance Report', 100, 100);
        doc.fontSize(12).text(`Report ID: ${report.reportId}`, 100, 130);
        doc.text(`Generated: ${format(report.generatedAt, 'MMMM dd, yyyy HH:mm')}`, 100, 150);

        // Add summary
        doc.text('Summary:', 100, 180);
        doc.text(`Total Events: ${report.summary.totalEvents}`, 120, 200);
        doc.text(`Successful Events: ${report.summary.successfulEvents}`, 120, 220);
        doc.text(`Failed Events: ${report.summary.failedEvents}`, 120, 240);
        doc.text(`Flagged Events: ${report.summary.flaggedEvents}`, 120, 260);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateComplianceExcel(report: ComplianceReport): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Compliance Report Summary']);
    summarySheet.addRow(['Report ID', report.reportId]);
    summarySheet.addRow(['Generated', format(report.generatedAt, 'yyyy-MM-dd HH:mm:ss')]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Events', report.summary.totalEvents]);
    summarySheet.addRow(['Successful Events', report.summary.successfulEvents]);
    summarySheet.addRow(['Failed Events', report.summary.failedEvents]);
    summarySheet.addRow(['Flagged Events', report.summary.flaggedEvents]);

    return (await workbook.xlsx.writeBuffer()) as any as Buffer;
  }

  private generateAuditCSV(logs: any[], includeDetails: boolean): string {
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource',
      'Success',
      'Severity',
      'IP Address',
      'Risk Score'
    ];

    if (includeDetails) {
      headers.push('Details');
    }

    const rows = [headers];

    logs.forEach(log => {
      const row = [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.userId?.email || 'System',
        log.action,
        log.resource,
        log.success ? 'Success' : 'Failed',
        log.severity,
        log.ipAddress,
        log.riskScore.toString()
      ];

      if (includeDetails) {
        row.push(JSON.stringify(log.details));
      }

      rows.push(row);
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  private async generateAuditExcel(logs: any[], includeDetails: boolean): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Audit Logs');

    // Add headers
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource',
      'Success',
      'Severity',
      'IP Address',
      'Risk Score'
    ];

    if (includeDetails) {
      headers.push('Details');
    }

    worksheet.addRow(headers);

    // Add data rows
    logs.forEach(log => {
      const row = [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.userId?.email || 'System',
        log.action,
        log.resource,
        log.success ? 'Success' : 'Failed',
        log.severity,
        log.ipAddress,
        log.riskScore
      ];

      if (includeDetails) {
        row.push(JSON.stringify(log.details));
      }

      worksheet.addRow(row);
    });

    return (await workbook.xlsx.writeBuffer()) as any as Buffer;
  }
}

// Create and export controller instance
export const saasAuditController = new SaaSAuditController();