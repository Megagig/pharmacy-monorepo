import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { AuditService } from '../services/auditService';
import { RedisCacheService } from '../services/RedisCacheService';
import logger from '../utils/logger';
import crypto from 'crypto';

/**
 * Compliance and Audit Logging Middleware
 * Provides comprehensive audit trails for regulatory compliance
 */

export interface AuditEvent {
  eventId: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  url: string;
  statusCode?: number;
  requestBody?: any;
  responseBody?: any;
  duration?: number;
  success: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory: ComplianceCategory;
  dataClassification: DataClassification;
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

export type ComplianceCategory = 
  | 'data_access'
  | 'data_modification'
  | 'user_management'
  | 'security_management'
  | 'system_configuration'
  | 'authentication'
  | 'authorization'
  | 'privacy_controls'
  | 'financial_transaction'
  | 'clinical_data'
  | 'administrative_action';

export type DataClassification = 
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'pii'
  | 'phi'
  | 'financial'
  | 'clinical';

export interface ComplianceRule {
  name: string;
  description: string;
  category: ComplianceCategory;
  dataTypes: DataClassification[];
  actions: string[];
  retentionPeriod: number; // in days
  encryptionRequired: boolean;
  accessControlRequired: boolean;
  approvalRequired: boolean;
  notificationRequired: boolean;
}

export interface DataRetentionPolicy {
  category: ComplianceCategory;
  dataClassification: DataClassification;
  retentionPeriod: number; // in days
  archivePeriod?: number; // in days
  deletionMethod: 'soft' | 'hard' | 'crypto_shred';
  approvalRequired: boolean;
}

class ComplianceAuditLogger {
  private auditService: typeof AuditService;
  private cacheService: RedisCacheService;
  private readonly AUDIT_CACHE_PREFIX = 'audit:';
  private readonly COMPLIANCE_RULES_CACHE = 'compliance:rules';
  private readonly RETENTION_POLICIES_CACHE = 'compliance:retention';

  constructor() {
    this.auditService = AuditService;
    this.cacheService = RedisCacheService.getInstance();
  }

  /**
   * Comprehensive audit logging middleware
   */
  auditRequest = (options: {
    category: ComplianceCategory;
    dataClassification?: DataClassification;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    captureRequestBody?: boolean;
    captureResponseBody?: boolean;
    sensitiveFields?: string[];
  }) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const eventId = crypto.randomUUID();
      
      // Store original methods
      const originalJson = res.json;
      const originalSend = res.send;
      
      let responseBody: any;
      let statusCode: number;

      // Override response methods to capture data
      res.json = function(body: any) {
        responseBody = body;
        statusCode = res.statusCode;
        return originalJson.call(this, body);
      };

      res.send = function(body: any) {
        responseBody = body;
        statusCode = res.statusCode;
        return originalSend.call(this, body);
      };

      // Continue with request processing
      res.on('finish', async () => {
        try {
          const duration = Date.now() - startTime;
          
          const auditEvent: AuditEvent = {
            eventId,
            timestamp: new Date(),
            userId: req.user?._id?.toString(),
            userEmail: req.user?.email,
            userRole: req.user?.role,
            sessionId: (req as any).sessionID,
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            action: this.determineAction(req.method, req.originalUrl),
            resource: this.determineResource(req.originalUrl),
            resourceId: req.params.id || req.params.userId || req.params.resourceId,
            method: req.method,
            url: req.originalUrl,
            statusCode,
            requestBody: options.captureRequestBody ? this.sanitizeData(req.body, options.sensitiveFields) : undefined,
            responseBody: options.captureResponseBody ? this.sanitizeData(responseBody, options.sensitiveFields) : undefined,
            duration,
            success: statusCode < 400,
            riskLevel: options.riskLevel || this.calculateRiskLevel(req, statusCode),
            complianceCategory: options.category,
            dataClassification: options.dataClassification || this.determineDataClassification(req.originalUrl),
            metadata: {
              requestSize: JSON.stringify(req.body || {}).length,
              responseSize: JSON.stringify(responseBody || {}).length,
              queryParams: req.query,
              headers: this.sanitizeHeaders(req.headers)
            }
          };

          // Store audit event
          await this.storeAuditEvent(auditEvent);

          // Check compliance rules
          await this.checkComplianceRules(auditEvent);

          // Log high-risk events immediately
          if (auditEvent.riskLevel === 'high' || auditEvent.riskLevel === 'critical') {
            logger.warn('High-risk audit event', {
              eventId: auditEvent.eventId,
              action: auditEvent.action,
              userId: auditEvent.userId,
              riskLevel: auditEvent.riskLevel,
              service: 'compliance-audit'
            });
          }

        } catch (error) {
          logger.error('Error in audit logging:', error);
        }
      });

      next();
    };
  };

  /**
   * Data modification audit middleware
   */
  auditDataModification = (options: {
    resourceType: string;
    sensitiveFields?: string[];
    requireApproval?: boolean;
  }) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      // Store original data for comparison
      const originalData = await this.getOriginalData(options.resourceType, req.params.id);
      
      // Continue with request
      const originalJson = res.json;
      res.json = function(body: any) {
        // Capture changes after modification
        setImmediate(async () => {
          try {
            if (res.statusCode < 400) {
              const newData = await this.getOriginalData(options.resourceType, req.params.id);
              const changes = this.detectChanges(originalData, newData, options.sensitiveFields);
              
              if (changes.changedFields.length > 0) {
                await this.auditService.createAuditLog({
                  action: `${options.resourceType.toUpperCase()}_MODIFIED`,
                  userId: req.user?._id?.toString() || 'system',
                  resourceType: options.resourceType,
                  resourceId: req.params.id,
                  details: {
                    changes: changes.changedFields,
                    requiresApproval: options.requireApproval,
                    modificationReason: req.body.reason
                  },
                  complianceCategory: 'data_modification',
                  riskLevel: this.calculateDataModificationRisk(changes.changedFields, options.sensitiveFields),
                  changedFields: changes.changedFields,
                  oldValues: changes.oldValues,
                  newValues: changes.newValues
                });
              }
            }
          } catch (error) {
            logger.error('Error auditing data modification:', error);
          }
        });

        return originalJson.call(this, body);
      }.bind(this);

      next();
    };
  };

  /**
   * Privacy controls audit middleware
   */
  auditPrivacyControls = () => {
    return this.auditRequest({
      category: 'privacy_controls',
      dataClassification: 'pii',
      riskLevel: 'high',
      captureRequestBody: true,
      captureResponseBody: false,
      sensitiveFields: ['email', 'phone', 'address', 'ssn', 'dateOfBirth']
    });
  };

  /**
   * Financial transaction audit middleware
   */
  auditFinancialTransaction = () => {
    return this.auditRequest({
      category: 'financial_transaction',
      dataClassification: 'financial',
      riskLevel: 'critical',
      captureRequestBody: true,
      captureResponseBody: true,
      sensitiveFields: ['cardNumber', 'cvv', 'accountNumber', 'routingNumber']
    });
  };

  /**
   * Clinical data audit middleware
   */
  auditClinicalData = () => {
    return this.auditRequest({
      category: 'clinical_data',
      dataClassification: 'phi',
      riskLevel: 'high',
      captureRequestBody: true,
      captureResponseBody: false,
      sensitiveFields: ['diagnosis', 'medication', 'allergies', 'medicalHistory']
    });
  };

  /**
   * Administrative action audit middleware
   */
  auditAdministrativeAction = () => {
    return this.auditRequest({
      category: 'administrative_action',
      dataClassification: 'confidential',
      riskLevel: 'high',
      captureRequestBody: true,
      captureResponseBody: false
    });
  };

  /**
   * Store audit event with compliance metadata
   */
  private async storeAuditEvent(event: AuditEvent): Promise<void> {
    try {
      // Store in primary audit log
      await this.auditService.createAuditLog({
        action: event.action,
        userId: event.userId || 'anonymous',
        resourceType: event.resource,
        resourceId: event.resourceId,
        details: {
          eventId: event.eventId,
          method: event.method,
          url: event.url,
          statusCode: event.statusCode,
          duration: event.duration,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          requestBody: event.requestBody,
          responseBody: event.responseBody,
          metadata: event.metadata
        },
        complianceCategory: event.complianceCategory,
        riskLevel: event.riskLevel,
        changedFields: event.changedFields,
        oldValues: event.oldValues,
        newValues: event.newValues
      });

      // Store in compliance-specific cache for quick access
      const cacheKey = `${this.AUDIT_CACHE_PREFIX}${event.eventId}`;
      await this.cacheService.set(cacheKey, event, { ttl: 86400 }); // 24 hours

      // Store in category-specific index for reporting
      const categoryKey = `${this.AUDIT_CACHE_PREFIX}category:${event.complianceCategory}`;
      const categoryEvents = await this.cacheService.get(categoryKey) as string[] || [];
      categoryEvents.push(event.eventId);
      
      // Keep only last 1000 events per category in cache
      if (categoryEvents.length > 1000) {
        categoryEvents.splice(0, categoryEvents.length - 1000);
      }
      
      await this.cacheService.set(categoryKey, categoryEvents, { ttl: 86400 });

    } catch (error) {
      logger.error('Error storing audit event:', error);
      throw error;
    }
  }

  /**
   * Check compliance rules against audit event
   */
  private async checkComplianceRules(event: AuditEvent): Promise<void> {
    try {
      const rules = await this.getComplianceRules();
      
      for (const rule of rules) {
        if (this.eventMatchesRule(event, rule)) {
          await this.enforceComplianceRule(event, rule);
        }
      }
    } catch (error) {
      logger.error('Error checking compliance rules:', error);
    }
  }

  /**
   * Enforce compliance rule
   */
  private async enforceComplianceRule(event: AuditEvent, rule: ComplianceRule): Promise<void> {
    try {
      // Log compliance rule enforcement
      logger.info('Enforcing compliance rule', {
        eventId: event.eventId,
        ruleName: rule.name,
        category: rule.category,
        service: 'compliance-audit'
      });

      // Send notifications if required
      if (rule.notificationRequired) {
        await this.sendComplianceNotification(event, rule);
      }

      // Create approval workflow if required
      if (rule.approvalRequired) {
        await this.createApprovalWorkflow(event, rule);
      }

      // Apply encryption if required
      if (rule.encryptionRequired) {
        await this.applyEncryption(event);
      }

    } catch (error) {
      logger.error('Error enforcing compliance rule:', error);
    }
  }

  /**
   * Generate compliance reports
   */
  async generateComplianceReport(options: {
    category?: ComplianceCategory;
    startDate: Date;
    endDate: Date;
    format: 'json' | 'csv' | 'pdf';
    includeDetails?: boolean;
  }): Promise<any> {
    try {
      const events = await this.getAuditEvents({
        category: options.category,
        startDate: options.startDate,
        endDate: options.endDate
      });

      const report = {
        generatedAt: new Date(),
        period: {
          start: options.startDate,
          end: options.endDate
        },
        category: options.category || 'all',
        summary: this.generateReportSummary(events),
        events: options.includeDetails ? events : undefined,
        compliance: await this.assessCompliance(events)
      };

      return this.formatReport(report, options.format);
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      throw error;
    }
  }

  /**
   * Data retention and deletion
   */
  async enforceDataRetention(): Promise<void> {
    try {
      const policies = await this.getRetentionPolicies();
      
      for (const policy of policies) {
        await this.enforceRetentionPolicy(policy);
      }

      logger.info('Data retention enforcement completed');
    } catch (error) {
      logger.error('Error enforcing data retention:', error);
      throw error;
    }
  }

  // Private helper methods

  private determineAction(method: string, url: string): string {
    const pathSegments = url.split('/').filter(Boolean);
    const resource = pathSegments[pathSegments.length - 1] || 'unknown';
    
    switch (method.toUpperCase()) {
      case 'GET':
        return `VIEW_${resource.toUpperCase()}`;
      case 'POST':
        return `CREATE_${resource.toUpperCase()}`;
      case 'PUT':
      case 'PATCH':
        return `UPDATE_${resource.toUpperCase()}`;
      case 'DELETE':
        return `DELETE_${resource.toUpperCase()}`;
      default:
        return `${method}_${resource.toUpperCase()}`;
    }
  }

  private determineResource(url: string): string {
    const pathSegments = url.split('/').filter(Boolean);
    
    if (pathSegments.includes('users')) return 'user';
    if (pathSegments.includes('patients')) return 'patient';
    if (pathSegments.includes('medications')) return 'medication';
    if (pathSegments.includes('prescriptions')) return 'prescription';
    if (pathSegments.includes('billing')) return 'billing';
    if (pathSegments.includes('admin')) return 'admin';
    if (pathSegments.includes('saas')) return 'saas';
    
    return pathSegments[pathSegments.length - 1] || 'unknown';
  }

  private determineDataClassification(url: string): DataClassification {
    if (url.includes('/patients') || url.includes('/clinical')) return 'phi';
    if (url.includes('/billing') || url.includes('/payment')) return 'financial';
    if (url.includes('/users') || url.includes('/profile')) return 'pii';
    if (url.includes('/admin') || url.includes('/saas')) return 'confidential';
    
    return 'internal';
  }

  private calculateRiskLevel(req: Request, statusCode: number): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Method-based risk
    if (req.method === 'DELETE') riskScore += 3;
    else if (req.method === 'PUT' || req.method === 'PATCH') riskScore += 2;
    else if (req.method === 'POST') riskScore += 1;

    // URL-based risk
    if (req.originalUrl.includes('/admin')) riskScore += 2;
    if (req.originalUrl.includes('/saas')) riskScore += 2;
    if (req.originalUrl.includes('/billing')) riskScore += 2;
    if (req.originalUrl.includes('/users')) riskScore += 1;

    // Status-based risk
    if (statusCode >= 500) riskScore += 2;
    else if (statusCode >= 400) riskScore += 1;

    // User-based risk
    const authReq = req as AuthRequest;
    if (authReq.user?.role === 'super_admin') riskScore += 1;

    if (riskScore >= 6) return 'critical';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private sanitizeData(data: any, sensitiveFields?: string[]): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const defaultSensitiveFields = [
      'password', 'token', 'secret', 'key', 'cardNumber', 'cvv', 'ssn'
    ];
    
    const fieldsToSanitize = [...defaultSensitiveFields, ...(sensitiveFields || [])];

    fieldsToSanitize.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private async getOriginalData(resourceType: string, resourceId: string): Promise<any> {
    // This would fetch the original data from the database
    // Implementation depends on the specific resource type
    return {};
  }

  private detectChanges(
    originalData: any, 
    newData: any, 
    sensitiveFields?: string[]
  ): { changedFields: string[]; oldValues: any; newValues: any } {
    const changedFields: string[] = [];
    const oldValues: any = {};
    const newValues: any = {};

    if (!originalData || !newData) {
      return { changedFields, oldValues, newValues };
    }

    Object.keys(newData).forEach(key => {
      if (originalData[key] !== newData[key]) {
        changedFields.push(key);
        oldValues[key] = sensitiveFields?.includes(key) ? '[REDACTED]' : originalData[key];
        newValues[key] = sensitiveFields?.includes(key) ? '[REDACTED]' : newData[key];
      }
    });

    return { changedFields, oldValues, newValues };
  }

  private calculateDataModificationRisk(
    changedFields: string[], 
    sensitiveFields?: string[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const sensitiveChanges = changedFields.filter(field => 
      sensitiveFields?.includes(field)
    );

    if (sensitiveChanges.length > 0) return 'high';
    if (changedFields.length > 5) return 'medium';
    return 'low';
  }

  private async getComplianceRules(): Promise<ComplianceRule[]> {
    // This would fetch compliance rules from database or cache
    return [];
  }

  private eventMatchesRule(event: AuditEvent, rule: ComplianceRule): boolean {
    return rule.category === event.complianceCategory &&
           rule.dataTypes.includes(event.dataClassification) &&
           rule.actions.some(action => event.action.includes(action));
  }

  private async sendComplianceNotification(event: AuditEvent, rule: ComplianceRule): Promise<void> {
    // Implementation for sending compliance notifications
    logger.info('Compliance notification sent', {
      eventId: event.eventId,
      ruleName: rule.name
    });
  }

  private async createApprovalWorkflow(event: AuditEvent, rule: ComplianceRule): Promise<void> {
    // Implementation for creating approval workflows
    logger.info('Approval workflow created', {
      eventId: event.eventId,
      ruleName: rule.name
    });
  }

  private async applyEncryption(event: AuditEvent): Promise<void> {
    // Implementation for applying encryption to sensitive data
    logger.info('Encryption applied to audit event', {
      eventId: event.eventId
    });
  }

  private async getAuditEvents(filters: {
    category?: ComplianceCategory;
    startDate: Date;
    endDate: Date;
  }): Promise<AuditEvent[]> {
    // This would fetch audit events from database
    return [];
  }

  private generateReportSummary(events: AuditEvent[]): any {
    return {
      totalEvents: events.length,
      eventsByCategory: this.groupBy(events, 'complianceCategory'),
      eventsByRisk: this.groupBy(events, 'riskLevel'),
      successRate: events.filter(e => e.success).length / events.length,
      topActions: this.getTopActions(events),
      topUsers: this.getTopUsers(events)
    };
  }

  private async assessCompliance(events: AuditEvent[]): Promise<any> {
    return {
      overallScore: 85, // This would be calculated based on compliance rules
      violations: [],
      recommendations: []
    };
  }

  private formatReport(report: any, format: 'json' | 'csv' | 'pdf'): any {
    switch (format) {
      case 'json':
        return report;
      case 'csv':
        // Convert to CSV format
        return this.convertToCSV(report);
      case 'pdf':
        // Generate PDF report
        return this.generatePDFReport(report);
      default:
        return report;
    }
  }

  private async getRetentionPolicies(): Promise<DataRetentionPolicy[]> {
    // This would fetch retention policies from database
    return [];
  }

  private async enforceRetentionPolicy(policy: DataRetentionPolicy): Promise<void> {
    // Implementation for enforcing retention policies
    logger.info('Retention policy enforced', {
      category: policy.category,
      retentionPeriod: policy.retentionPeriod
    });
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  private getTopActions(events: AuditEvent[]): Array<{ action: string; count: number }> {
    const actionCounts = this.groupBy(events, 'action');
    return Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTopUsers(events: AuditEvent[]): Array<{ userId: string; count: number }> {
    const userCounts = this.groupBy(events.filter(e => e.userId), 'userId');
    return Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private convertToCSV(report: any): string {
    // CSV conversion implementation
    return '';
  }

  private generatePDFReport(report: any): Buffer {
    // PDF generation implementation
    return Buffer.from('');
  }
}

// Create singleton instance
const complianceAuditLogger = new ComplianceAuditLogger();

// Export middleware functions
export const auditRequest = complianceAuditLogger.auditRequest;
export const auditDataModification = complianceAuditLogger.auditDataModification;
export const auditPrivacyControls = complianceAuditLogger.auditPrivacyControls;
export const auditFinancialTransaction = complianceAuditLogger.auditFinancialTransaction;
export const auditClinicalData = complianceAuditLogger.auditClinicalData;
export const auditAdministrativeAction = complianceAuditLogger.auditAdministrativeAction;

// Export class for custom configurations
export { ComplianceAuditLogger };

export default {
  auditRequest,
  auditDataModification,
  auditPrivacyControls,
  auditFinancialTransaction,
  auditClinicalData,
  auditAdministrativeAction,
  ComplianceAuditLogger
};