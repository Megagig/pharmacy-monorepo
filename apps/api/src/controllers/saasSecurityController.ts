import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';
import { SecurityMonitoringService } from '../services/SaaSSecurityMonitoringService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // days
  preventReuse: number; // number of previous passwords to check
}

export interface SessionFilters {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface SecurityAuditFilters {
  userId?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * SaaS Security Controller
 * Handles security settings, session management, and audit capabilities
 * for the SaaS Settings Module
 */
export class SaaSSecurityController {
  private securityMonitoringService: SecurityMonitoringService;

  constructor() {
    this.securityMonitoringService = SecurityMonitoringService.getInstance();
  }

  /**
   * Get security settings
   * GET /api/admin/saas/security/settings
   */
  async getSecuritySettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching security settings', {
        adminId: req.user?._id,
        userRole: req.user?.role
      });

      const settings = await this.securityMonitoringService.getSecuritySettings();

      sendSuccess(
        res,
        {
          settings,
          retrievedAt: new Date()
        },
        'Security settings retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching security settings:', error);
      sendError(
        res,
        'SECURITY_SETTINGS_ERROR',
        'Failed to retrieve security settings',
        500
      );
    }
  }

  /**
   * Update password policy
   * PUT /api/admin/saas/security/password-policy
   */
  async updatePasswordPolicy(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        minLength,
        requireUppercase,
        requireLowercase,
        requireNumbers,
        requireSpecialChars,
        maxAge,
        preventReuse
      } = req.body;

      logger.info('Updating password policy', {
        adminId: req.user?._id,
        changes: {
          minLength,
          requireUppercase,
          requireLowercase,
          requireNumbers,
          requireSpecialChars,
          maxAge,
          preventReuse
        }
      });

      // Validate password policy
      const validationResult = this.validatePasswordPolicy(req.body);
      if (!validationResult.isValid) {
        sendError(res, 'INVALID_PASSWORD_POLICY', validationResult.error, 400);
        return;
      }

      const passwordPolicy: PasswordPolicy = {
        minLength: minLength || 8,
        requireUppercase: requireUppercase !== undefined ? requireUppercase : true,
        requireLowercase: requireLowercase !== undefined ? requireLowercase : true,
        requireNumbers: requireNumbers !== undefined ? requireNumbers : true,
        requireSpecialChars: requireSpecialChars !== undefined ? requireSpecialChars : false,
        maxAge: maxAge || 90,
        preventReuse: preventReuse || 5
      };

      await this.securityMonitoringService.updatePasswordPolicy(passwordPolicy, req.user?._id.toString() || 'system');

      // Log the policy change for audit
      logger.warn('Password policy updated', {
        adminId: req.user?._id,
        adminEmail: req.user?.email,
        previousPolicy: await this.securityMonitoringService.getSecuritySettings(),
        newPolicy: passwordPolicy,
        timestamp: new Date()
      });

      sendSuccess(
        res,
        {
          passwordPolicy,
          updatedBy: req.user?._id,
          updatedAt: new Date()
        },
        'Password policy updated successfully'
      );
    } catch (error) {
      logger.error('Error updating password policy:', error);
      sendError(
        res,
        'PASSWORD_POLICY_UPDATE_ERROR',
        'Failed to update password policy',
        500
      );
    }
  }

  /**
   * Update account lockout settings
   * PUT /api/admin/saas/security/account-lockout
   */
  async updateAccountLockout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        maxFailedAttempts,
        lockoutDuration,
        autoUnlock,
        notifyOnLockout
      } = req.body;

      logger.info('Updating account lockout settings', {
        adminId: req.user?._id,
        changes: {
          maxFailedAttempts,
          lockoutDuration,
          autoUnlock,
          notifyOnLockout
        }
      });

      const accountLockout = {
        maxFailedAttempts: maxFailedAttempts || 5,
        lockoutDuration: lockoutDuration || 30,
        autoUnlock: autoUnlock !== undefined ? autoUnlock : true,
        notifyOnLockout: notifyOnLockout !== undefined ? notifyOnLockout : true
      };

      await this.securityMonitoringService.updateAccountLockout(accountLockout, req.user?._id.toString() || 'system');

      sendSuccess(
        res,
        {
          accountLockout,
          updatedBy: req.user?._id,
          updatedAt: new Date()
        },
        'Account lockout settings updated successfully'
      );
    } catch (error) {
      logger.error('Error updating account lockout settings:', error);
      sendError(
        res,
        'ACCOUNT_LOCKOUT_UPDATE_ERROR',
        'Failed to update account lockout settings',
        500
      );
    }
  }

  /**
   * Get active user sessions
   * GET /api/admin/saas/security/sessions
   */
  async getActiveSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        userId = '',
        ipAddress = '',
        userAgent = '',
        isActive = '',
        createdAfter = '',
        createdBefore = '',
        sortBy = 'loginTime',
        sortOrder = 'desc'
      } = req.query;

      logger.info('Fetching active user sessions', {
        adminId: req.user?._id,
        filters: { userId, ipAddress, isActive }
      });

      // Build filters
      const filters: SessionFilters = {};
      if (userId) filters.userId = userId as string;
      if (ipAddress) filters.ipAddress = ipAddress as string;
      if (userAgent) filters.userAgent = userAgent as string;
      if (isActive !== '') filters.isActive = isActive === 'true';
      if (createdAfter) filters.createdAfter = new Date(createdAfter as string);
      if (createdBefore) filters.createdBefore = new Date(createdBefore as string);

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const sessions = await this.securityMonitoringService.getActiveSessions();

      // Apply filters and pagination (in a real implementation, this would be done in the service)
      let filteredSessions = sessions;

      if (filters.userId) {
        filteredSessions = filteredSessions.filter(s => s.userId === filters.userId);
      }

      if (filters.ipAddress) {
        filteredSessions = filteredSessions.filter(s =>
          s.ipAddress.includes(filters.ipAddress!)
        );
      }

      if (filters.isActive !== undefined) {
        filteredSessions = filteredSessions.filter(s => s.isActive === filters.isActive);
      }

      // Sort sessions
      filteredSessions.sort((a, b) => {
        const aValue = (a as any)[sortBy as string];
        const bValue = (b as any)[sortBy as string];

        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });

      // Apply pagination
      const total = filteredSessions.length;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedSessions = filteredSessions.slice(startIndex, startIndex + limitNum);

      sendSuccess(
        res,
        {
          sessions: paginatedSessions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
            hasNext: pageNum * limitNum < total,
            hasPrev: pageNum > 1
          },
          filters,
          summary: {
            totalSessions: total,
            activeSessions: filteredSessions.filter(s => s.isActive).length,
            inactiveSessions: filteredSessions.filter(s => !s.isActive).length,
            uniqueUsers: new Set(filteredSessions.map(s => s.userId)).size,
            uniqueIPs: new Set(filteredSessions.map(s => s.ipAddress)).size
          }
        },
        'Active sessions retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching active sessions:', error);
      sendError(
        res,
        'SESSIONS_ERROR',
        'Failed to retrieve active sessions',
        500
      );
    }
  }

  /**
   * Terminate user session
   * DELETE /api/admin/saas/security/sessions/:sessionId
   */
  async terminateSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { reason } = req.body;

      if (!sessionId) {
        sendError(res, 'INVALID_SESSION_ID', 'Session ID is required', 400);
        return;
      }

      logger.info('Terminating user session', {
        adminId: req.user?._id,
        sessionId,
        reason: reason || 'No reason provided'
      });

      await this.securityMonitoringService.terminateSession(sessionId);

      // Log the session termination for audit
      logger.warn('User session terminated by admin', {
        adminId: req.user?._id,
        adminEmail: req.user?.email,
        sessionId,
        reason: reason || 'No reason provided',
        timestamp: new Date()
      });

      sendSuccess(
        res,
        {
          sessionId,
          terminatedBy: req.user?._id,
          terminatedAt: new Date(),
          reason: reason || 'No reason provided'
        },
        'Session terminated successfully'
      );
    } catch (error) {
      logger.error('Error terminating session:', error);

      if (error instanceof Error && error.message.includes('Session not found')) {
        sendError(res, 'SESSION_NOT_FOUND', 'Session not found', 404);
      } else {
        sendError(res, 'SESSION_TERMINATION_ERROR', 'Failed to terminate session', 500);
      }
    }
  }

  /**
   * Get security audit logs
   * GET /api/admin/saas/security/audit-logs
   */
  async getSecurityAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        userId = '',
        action = '',
        resource = '',
        success = '',
        ipAddress = '',
        startDate = '',
        endDate = '',
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = req.query;

      logger.info('Fetching security audit logs', {
        adminId: req.user?._id,
        filters: { userId, action, resource, success }
      });

      // Build filters
      const filters: SecurityAuditFilters = {};
      if (userId) filters.userId = userId as string;
      if (action) filters.action = action as string;
      if (resource) filters.resource = resource as string;
      if (success !== '') filters.success = success === 'true';
      if (ipAddress) filters.ipAddress = ipAddress as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 200); // Max 200 for audit logs

      // Pass filters to service for efficient database query
      const auditLogsResult = await this.securityMonitoringService.getSecurityAuditLogs({
        ...filters,
        page: pageNum,
        limit: limitNum
      });

      sendSuccess(
        res,
        {
          logs: auditLogsResult.logs,
          pagination: {
            page: auditLogsResult.page,
            limit: limitNum,
            total: auditLogsResult.total,
            totalPages: auditLogsResult.pages,
          }
        },
        'Security audit logs retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching security audit logs:', error);
      sendError(
        res,
        'AUDIT_LOGS_ERROR',
        'Failed to retrieve security audit logs',
        500
      );
    }
  }

  /**
   * Lock user account
   * POST /api/admin/saas/security/users/:userId/lock
   */
  async lockUserAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      if (!reason || reason.trim().length === 0) {
        sendError(res, 'REASON_REQUIRED', 'Lock reason is required', 400);
        return;
      }

      logger.info('Locking user account', {
        adminId: req.user?._id,
        targetUserId: userId,
        reason
      });

      await this.securityMonitoringService.lockAccount(userId, reason);

      // Log the account lock for audit
      logger.warn('User account locked by admin', {
        adminId: req.user?._id,
        adminEmail: req.user?.email,
        targetUserId: userId,
        reason,
        timestamp: new Date()
      });

      sendSuccess(
        res,
        {
          userId,
          status: 'locked',
          reason,
          lockedBy: req.user?._id,
          lockedAt: new Date()
        },
        'User account locked successfully'
      );
    } catch (error) {
      logger.error('Error locking user account:', error);

      if (error instanceof Error && error.message.includes('User not found')) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      } else if (error instanceof Error && error.message.includes('already locked')) {
        sendError(res, 'USER_ALREADY_LOCKED', 'User account is already locked', 400);
      } else {
        sendError(res, 'ACCOUNT_LOCK_ERROR', 'Failed to lock user account', 500);
      }
    }
  }

  /**
   * Unlock user account
   * POST /api/admin/saas/security/users/:userId/unlock
   */
  async unlockUserAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      logger.info('Unlocking user account', {
        adminId: req.user?._id,
        targetUserId: userId
      });

      await this.securityMonitoringService.unlockAccount(userId);

      // Log the account unlock for audit
      logger.info('User account unlocked by admin', {
        adminId: req.user?._id,
        adminEmail: req.user?.email,
        targetUserId: userId,
        timestamp: new Date()
      });

      sendSuccess(
        res,
        {
          userId,
          status: 'unlocked',
          unlockedBy: req.user?._id,
          unlockedAt: new Date()
        },
        'User account unlocked successfully'
      );
    } catch (error) {
      logger.error('Error unlocking user account:', error);

      if (error instanceof Error && error.message.includes('User not found')) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      } else if (error instanceof Error && error.message.includes('not locked')) {
        sendError(res, 'USER_NOT_LOCKED', 'User account is not locked', 400);
      } else {
        sendError(res, 'ACCOUNT_UNLOCK_ERROR', 'Failed to unlock user account', 500);
      }
    }
  }

  /**
   * Get security dashboard metrics
   * GET /api/admin/saas/security/dashboard
   */
  async getSecurityDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { timeRange = '24h' } = req.query;

      logger.info('Fetching security dashboard metrics', {
        adminId: req.user?._id,
        timeRange
      });

      const [sessions, auditLogs, settings] = await Promise.all([
        this.securityMonitoringService.getActiveSessions(),
        this.securityMonitoringService.getSecurityAuditLogs(),
        this.securityMonitoringService.getSecuritySettings()
      ]);

      // Calculate metrics based on time range
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const recentLogs = auditLogs.logs.filter(log => log.timestamp >= startTime); // Access logs array
      const activeSessions = sessions.filter(session => session.isActive);

      const dashboard = {
        sessions: {
          total: sessions.length,
          active: activeSessions.length,
          inactive: sessions.length - activeSessions.length,
          uniqueUsers: new Set(activeSessions.map(s => s.userId)).size,
          uniqueIPs: new Set(activeSessions.map(s => (s as any).ipAddress)).size // Type assertion
        },
        security: {
          failedLogins: recentLogs.filter(log =>
            log.action === 'login' && !log.success
          ).length,
          successfulLogins: recentLogs.filter(log =>
            log.action === 'login' && log.success
          ).length,
          suspiciousActivities: recentLogs.filter(log =>
            log.action.includes('suspicious') || log.action.includes('anomaly')
          ).length,
          accountLockouts: recentLogs.filter(log =>
            log.action === 'account_locked'
          ).length
        },
        policies: {
          passwordPolicy: settings.passwordPolicy,
          sessionSettings: settings.sessionSettings,
          accountLockout: settings.accountLockout
        },
        timeRange,
        generatedAt: new Date()
      };

      sendSuccess(
        res,
        dashboard,
        'Security dashboard metrics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching security dashboard:', error);
      sendError(
        res,
        'SECURITY_DASHBOARD_ERROR',
        'Failed to retrieve security dashboard metrics',
        500
      );
    }
  }

  // Private helper methods

  private validatePasswordPolicy(policy: Partial<PasswordPolicy>): { isValid: boolean; error?: string } {
    if (policy.minLength !== undefined && (policy.minLength < 4 || policy.minLength > 128)) {
      return { isValid: false, error: 'Minimum length must be between 4 and 128 characters' };
    }

    if (policy.maxAge !== undefined && (policy.maxAge < 1 || policy.maxAge > 365)) {
      return { isValid: false, error: 'Maximum age must be between 1 and 365 days' };
    }

    if (policy.preventReuse !== undefined && (policy.preventReuse < 0 || policy.preventReuse > 24)) {
      return { isValid: false, error: 'Prevent reuse must be between 0 and 24 passwords' };
    }

    return { isValid: true };
  }
}

// Create and export controller instance
export const saasSecurityController = new SaaSSecurityController();