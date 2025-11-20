import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

// Enhanced audit log model for general system operations
interface SystemAuditLog {
  _id?: mongoose.Types.ObjectId;
  timestamp: Date;
  action: string;
  category:
    | 'authentication'
    | 'authorization'
    | 'invitation'
    | 'subscription'
    | 'workspace'
    | 'user_management'
    | 'security'
    | 'data_access'
    | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';

  // User context
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  userRole?: string;
  workspaceId?: mongoose.Types.ObjectId;

  // Request context
  ipAddress: string;
  userAgent: string;
  requestMethod: string;
  requestUrl: string;
  requestId?: string;
  sessionId?: string;

  // Resource information
  resourceType?: string;
  resourceId?: mongoose.Types.ObjectId;
  resourceName?: string;

  // Change tracking
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];

  // Additional context
  details: any;
  errorMessage?: string;
  statusCode?: number;
  duration?: number;

  // Security flags
  suspicious?: boolean;
  riskScore?: number;

  // Compliance
  complianceRelevant: boolean;
  retentionPeriod?: number; // in days
}

// In-memory store for audit logs (in production, use MongoDB)
const auditLogs: SystemAuditLog[] = [];
const MAX_MEMORY_LOGS = 10000;

// Clean up old logs periodically (only in production)
let cleanupInterval: NodeJS.Timeout | null = null;

if (process.env.NODE_ENV === 'production') {
  cleanupInterval = setInterval(() => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    const initialLength = auditLogs.length;

    // Remove old logs
    for (let i = auditLogs.length - 1; i >= 0; i--) {
      const log = auditLogs[i];
      if (log && log.timestamp < cutoff) {
        auditLogs.splice(i, 1);
      }
    }

    // Keep only recent logs if memory is full
    if (auditLogs.length > MAX_MEMORY_LOGS) {
    auditLogs.splice(0, auditLogs.length - MAX_MEMORY_LOGS);
  }

    if (initialLength !== auditLogs.length) {
      logger.info(
        `Cleaned up ${initialLength - auditLogs.length} old audit logs`
      );
    }
  }, 60 * 60 * 1000); // Run every hour
}

// Cleanup function for graceful shutdown
export const cleanupAuditLogging = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

/**
 * Create audit log entry
 */
export const createAuditLog = async (
  logData: Partial<SystemAuditLog>
): Promise<void> => {
  try {
    const auditLog: SystemAuditLog = {
      _id: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      action: logData.action || 'UNKNOWN_ACTION',
      category: logData.category || 'system',
      severity: logData.severity || 'low',
      userId: logData.userId,
      userEmail: logData.userEmail,
      userRole: logData.userRole,
      workspaceId: logData.workspaceId,
      ipAddress: logData.ipAddress || 'unknown',
      userAgent: logData.userAgent || 'unknown',
      requestMethod: logData.requestMethod || 'unknown',
      requestUrl: logData.requestUrl || 'unknown',
      requestId: logData.requestId,
      sessionId: logData.sessionId,
      resourceType: logData.resourceType,
      resourceId: logData.resourceId,
      resourceName: logData.resourceName,
      oldValues: logData.oldValues,
      newValues: logData.newValues,
      changedFields: logData.changedFields,
      details: logData.details || {},
      errorMessage: logData.errorMessage,
      statusCode: logData.statusCode,
      duration: logData.duration,
      suspicious: logData.suspicious || false,
      riskScore: logData.riskScore || calculateRiskScore(logData),
      complianceRelevant:
        logData.complianceRelevant || isComplianceRelevant(logData),
      retentionPeriod:
        logData.retentionPeriod || getRetentionPeriod(logData.category),
    };

    // Store in memory (in production, save to MongoDB)
    auditLogs.push(auditLog);

    // Log to winston for file storage
    logger.info('System Audit Log', {
      auditId: auditLog._id,
      action: auditLog.action,
      category: auditLog.category,
      severity: auditLog.severity,
      userId: auditLog.userId,
      workspaceId: auditLog.workspaceId,
      ipAddress: auditLog.ipAddress,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      suspicious: auditLog.suspicious,
      riskScore: auditLog.riskScore,
      service: 'system-audit',
    });

    // Trigger alerts for high-severity events
    if (auditLog.severity === 'critical' || auditLog.severity === 'high') {
      try {
        await triggerSecurityAlert(auditLog);
      } catch (alertError) {
        logger.error('Failed to trigger security alert', { error: alertError });
      }
    }

    // Detect suspicious patterns
    if (auditLog.suspicious || (auditLog.riskScore && auditLog.riskScore > 7)) {
      try {
        await detectSuspiciousActivity(auditLog);
      } catch (suspiciousError) {
        logger.error('Failed to detect suspicious activity', { error: suspiciousError });
      }
    }
  } catch (error: any) {
    logger.error('Failed to create audit log', {
      error: error?.message || 'Unknown error',
      logData,
      service: 'system-audit',
    });
  }
};

/**
 * Audit logging middleware
 */
export const auditMiddleware = (options: {
  action: string;
  category: SystemAuditLog['category'];
  severity?: SystemAuditLog['severity'];
  resourceType?: string;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    let responseBody: any;

    // Capture response body if requested
    if (options.includeResponseBody) {
      res.send = function (body: any) {
        responseBody = body;
        return originalSend.call(this, body);
      };
    }

    // Continue with request
    res.on('finish', async () => {
      const duration = Date.now() - startTime;

      await createAuditLog({
        action: options.action,
        category: options.category,
        severity:
          options.severity ||
          determineSeverity(res.statusCode, options.category),
        userId: req.user?._id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        workspaceId: req.workspace?._id,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        requestId: req.get('X-Request-ID'),
        sessionId: (req as any).sessionID,
        resourceType: options.resourceType,
        resourceId: req.params.id
          ? new mongoose.Types.ObjectId(req.params.id)
          : undefined,
        details: {
          requestBody: options.includeRequestBody ? req.body : undefined,
          responseBody: options.includeResponseBody ? responseBody : undefined,
          query: req.query,
          params: req.params,
        },
        statusCode: res.statusCode,
        duration,
        suspicious: detectSuspiciousRequest(req, res),
      });
    });

    next();
  };
};

/**
 * Specific audit functions for different operations
 */
export const auditOperations = {
  // Authentication events
  login: async (req: Request, user: any, success: boolean) => {
    await createAuditLog({
      action: success ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILED',
      category: 'authentication',
      severity: success ? 'low' : 'medium',
      userId: success ? user?._id : undefined,
      userEmail: user?.email || req.body?.email,
      userRole: user?.role,
      workspaceId: user?.workspaceId,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      details: {
        loginMethod: req.body?.loginMethod || 'email',
        rememberMe: req.body?.rememberMe,
        errorMessage: success ? undefined : 'Invalid credentials',
      },
      errorMessage: success ? undefined : 'Login failed',
      suspicious: !success,
    });
  },

  logout: async (req: AuthRequest) => {
    await createAuditLog({
      action: 'USER_LOGOUT',
      category: 'authentication',
      severity: 'low',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      details: {
        sessionDuration: (req as any).sessionID ? 'unknown' : undefined,
      },
    });
  },

  // Invitation events
  invitationCreated: async (req: AuthRequest, invitation: any) => {
    await createAuditLog({
      action: 'INVITATION_CREATED',
      category: 'invitation',
      severity: 'medium',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType: 'Invitation',
      resourceId: invitation._id,
      details: {
        inviteeEmail: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        workspaceName: req.workspace?.name,
      },
    });
  },

  invitationAccepted: async (
    req: AuthRequest,
    invitation: any,
    newUser: any
  ) => {
    await createAuditLog({
      action: 'INVITATION_ACCEPTED',
      category: 'invitation',
      severity: 'medium',
      userId: newUser?._id,
      userEmail: newUser?.email,
      userRole: newUser?.role,
      workspaceId: invitation.workspaceId,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType: 'Invitation',
      resourceId: invitation._id,
      details: {
        invitationCode: invitation.code,
        invitedBy: invitation.invitedBy,
        role: invitation.role,
        newUserCreated: !req.user,
      },
    });
  },

  // Subscription events
  subscriptionChanged: async (
    req: AuthRequest,
    oldSubscription: any,
    newSubscription: any
  ) => {
    const changedFields = getChangedFields(oldSubscription, newSubscription);

    await createAuditLog({
      action: 'SUBSCRIPTION_CHANGED',
      category: 'subscription',
      severity: 'high',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType: 'Subscription',
      resourceId: newSubscription._id,
      oldValues: oldSubscription,
      newValues: newSubscription,
      changedFields,
      details: {
        oldPlan: oldSubscription?.planId,
        newPlan: newSubscription?.planId,
        oldStatus: oldSubscription?.status,
        newStatus: newSubscription?.status,
        changeType: determineSubscriptionChangeType(
          oldSubscription,
          newSubscription
        ),
      },
    });
  },

  // Permission denied events
  permissionDenied: async (
    req: AuthRequest,
    requiredPermission: string,
    reason: string
  ) => {
    await createAuditLog({
      action: 'PERMISSION_DENIED',
      category: 'authorization',
      severity: 'medium',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      details: {
        requiredPermission,
        reason,
        userPermissions: req.user?.permissions || [],
      },
      suspicious: true,
      errorMessage: `Access denied: ${reason}`,
    });
  },

  // Data access events
  dataAccess: async (
    req: AuthRequest,
    resourceType: string,
    resourceId: string,
    action: string
  ) => {
    await createAuditLog({
      action: `DATA_${action.toUpperCase()}`,
      category: 'data_access',
      severity: action === 'DELETE' ? 'high' : 'low',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      details: {
        accessType: action,
        resourceType,
      },
    });
  },

  // Clinical Notes specific audit operations
  noteAccess: async (
    req: AuthRequest,
    noteId: string,
    action: string,
    details?: any
  ) => {
    await createAuditLog({
      action: `CLINICAL_NOTE_${action.toUpperCase()}`,
      category: 'data_access',
      severity: details?.isConfidential ? 'high' : 'medium',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType: 'ClinicalNote',
      resourceId: new mongoose.Types.ObjectId(noteId),
      details: {
        ...details,
        timestamp: new Date().toISOString(),
      },
      complianceRelevant: true,
    });
  },

  // Unauthorized access attempts
  unauthorizedAccess: async (
    req: AuthRequest,
    resourceType: string,
    resourceId: string,
    reason: string
  ) => {
    await createAuditLog({
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      category: 'security',
      severity: 'high',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      details: {
        reason,
        attemptedAction: `${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString(),
      },
      errorMessage: reason,
      suspicious: true,
      complianceRelevant: true,
    });
  },

  // Confidential data access
  confidentialDataAccess: async (
    req: AuthRequest,
    resourceType: string,
    resourceId: string,
    action: string,
    details?: any
  ) => {
    await createAuditLog({
      action: `CONFIDENTIAL_${action.toUpperCase()}`,
      category: 'data_access',
      severity: 'critical',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      details: {
        ...details,
        confidentialityLevel: 'high',
        accessJustification: details?.justification || 'Clinical care',
        timestamp: new Date().toISOString(),
      },
      complianceRelevant: true,
    });
  },

  // Bulk operations
  bulkOperation: async (
    req: AuthRequest,
    action: string,
    resourceType: string,
    resourceIds: string[],
    details?: any
  ) => {
    await createAuditLog({
      action: `BULK_${action.toUpperCase()}`,
      category: 'data_access',
      severity: 'high',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType,
      resourceId: new mongoose.Types.ObjectId(), // Placeholder for bulk operations
      details: {
        ...details,
        resourceIds,
        resourceCount: resourceIds.length,
        bulkOperation: true,
        timestamp: new Date().toISOString(),
      },
      complianceRelevant: true,
    });
  },

  // Data export operations
  dataExport: async (
    req: AuthRequest,
    exportType: string,
    recordCount: number,
    details?: any
  ) => {
    await createAuditLog({
      action: 'DATA_EXPORT',
      category: 'data_access',
      severity: 'high',
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      workspaceId: req.workspace?._id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      resourceType: 'ClinicalNote',
      details: {
        ...details,
        exportType,
        recordCount,
        exportFormat: details?.format || 'unknown',
        filters: details?.filters || {},
        timestamp: new Date().toISOString(),
      },
      complianceRelevant: true,
    });
  },
};

/**
 * Helper functions
 */
function calculateRiskScore(logData: Partial<SystemAuditLog>): number {
  let score = 0;

  // Base score by category
  const categoryScores = {
    authentication: 3,
    authorization: 4,
    invitation: 2,
    subscription: 5,
    workspace: 4,
    user_management: 6,
    security: 8,
    data_access: 3,
    system: 1,
  };

  score += categoryScores[logData.category || 'system'];

  // Severity multiplier
  const severityMultipliers = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  score *= severityMultipliers[logData.severity || 'low'];

  // Failed operations increase risk
  if (
    logData.errorMessage ||
    (logData.statusCode && logData.statusCode >= 400)
  ) {
    score += 2;
  }

  // Suspicious flag
  if (logData.suspicious) {
    score += 3;
  }

  return Math.min(score, 10); // Cap at 10
}

function isComplianceRelevant(logData: Partial<SystemAuditLog>): boolean {
  const complianceCategories = [
    'authentication',
    'authorization',
    'data_access',
    'user_management',
  ];
  return (
    complianceCategories.includes(logData.category || 'system') ||
    Boolean(logData.severity && ['high', 'critical'].includes(logData.severity))
  );
}

function getRetentionPeriod(category?: SystemAuditLog['category']): number {
  const retentionPeriods = {
    authentication: 90,
    authorization: 90,
    invitation: 365,
    subscription: 2555, // 7 years for financial records
    workspace: 365,
    user_management: 365,
    security: 2555, // 7 years for security incidents
    data_access: 365,
    system: 30,
  };

  return retentionPeriods[category || 'system'];
}

function determineSeverity(
  statusCode: number,
  category: SystemAuditLog['category']
): SystemAuditLog['severity'] {
  if (statusCode >= 500) return 'high';
  if (statusCode >= 400) return 'medium';
  if (category === 'security' || category === 'subscription') return 'medium';
  return 'low';
}

function detectSuspiciousRequest(req: AuthRequest, res: Response): boolean {
  // Simple suspicious activity detection
  const suspiciousPatterns = [
    res.statusCode === 401 || res.statusCode === 403, // Unauthorized access
    req.originalUrl.includes('admin') && req.user?.role !== 'super_admin', // Admin access by non-admin
    req.method === 'DELETE' && !req.user, // Delete without auth
    req.get('User-Agent')?.includes('bot') ||
      req.get('User-Agent')?.includes('crawler'), // Bot activity
  ];

  return suspiciousPatterns.some((pattern) => pattern);
}

function getChangedFields(oldObj: any, newObj: any): string[] {
  if (!oldObj || !newObj) return [];

  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  // Convert Set to Array to avoid downlevelIteration issue
  const keysArray = Array.from(allKeys);
  for (const key of keysArray) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changes.push(key);
    }
  }

  return changes;
}

function determineSubscriptionChangeType(oldSub: any, newSub: any): string {
  if (!oldSub) return 'created';
  if (oldSub.status !== newSub.status) return 'status_change';
  if (oldSub.planId !== newSub.planId) return 'plan_change';
  return 'updated';
}

async function triggerSecurityAlert(auditLog: SystemAuditLog): Promise<void> {
  logger.warn('High-severity security event detected', {
    auditId: auditLog._id,
    action: auditLog.action,
    category: auditLog.category,
    severity: auditLog.severity,
    userId: auditLog.userId,
    workspaceId: auditLog.workspaceId,
    ipAddress: auditLog.ipAddress,
    riskScore: auditLog.riskScore,
    service: 'security-alert',
  });

  // In production, implement:
  // - Email/SMS alerts to administrators
  // - Integration with security incident management systems
  // - Automated response actions (e.g., temporary account suspension)
}

async function detectSuspiciousActivity(
  auditLog: SystemAuditLog
): Promise<void> {
  // Check for patterns in recent logs
  const recentLogs = auditLogs.filter(
    (log) =>
      log.timestamp > new Date(Date.now() - 60 * 60 * 1000) && // Last hour
      (log.userId?.toString() === auditLog.userId?.toString() ||
        log.ipAddress === auditLog.ipAddress)
  );

  // Multiple failed attempts
  const failedAttempts = recentLogs.filter(
    (log) => log.errorMessage && log.category === 'authentication'
  ).length;

  if (failedAttempts > 5) {
    logger.warn(
      'Suspicious activity: Multiple failed authentication attempts',
      {
        userId: auditLog.userId,
        ipAddress: auditLog.ipAddress,
        failedAttempts,
        service: 'suspicious-activity',
      }
    );
  }

  // High-frequency requests
  if (recentLogs.length > 100) {
    logger.warn('Suspicious activity: High-frequency requests', {
      userId: auditLog.userId,
      ipAddress: auditLog.ipAddress,
      requestCount: recentLogs.length,
      service: 'suspicious-activity',
    });
  }
}

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = (filters: {
  userId?: string;
  workspaceId?: string;
  category?: SystemAuditLog['category'];
  severity?: SystemAuditLog['severity'];
  startDate?: Date;
  endDate?: Date;
  suspicious?: boolean;
  limit?: number;
}): SystemAuditLog[] => {
  let filteredLogs = [...auditLogs];

  if (filters.userId) {
    filteredLogs = filteredLogs.filter(
      (log) => log.userId?.toString() === filters.userId
    );
  }

  if (filters.workspaceId) {
    filteredLogs = filteredLogs.filter(
      (log) => log.workspaceId?.toString() === filters.workspaceId
    );
  }

  if (filters.category) {
    filteredLogs = filteredLogs.filter(
      (log) => log.category === filters.category
    );
  }

  if (filters.severity) {
    filteredLogs = filteredLogs.filter(
      (log) => log.severity === filters.severity
    );
  }

  if (filters.startDate) {
    filteredLogs = filteredLogs.filter(
      (log) => log.timestamp >= filters.startDate!
    );
  }

  if (filters.endDate) {
    filteredLogs = filteredLogs.filter(
      (log) => log.timestamp <= filters.endDate!
    );
  }

  if (filters.suspicious !== undefined) {
    filteredLogs = filteredLogs.filter(
      (log) => log.suspicious === filters.suspicious
    );
  }

  // Sort by timestamp (newest first)
  filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Apply limit
  if (filters.limit) {
    filteredLogs = filteredLogs.slice(0, filters.limit);
  }

  return filteredLogs;
};

export default {
  createAuditLog,
  auditMiddleware,
  auditOperations,
  getAuditLogs,
};
