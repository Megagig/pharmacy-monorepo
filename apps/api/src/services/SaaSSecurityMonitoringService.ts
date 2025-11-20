import mongoose from 'mongoose';
import { SecuritySettings, ISecuritySettings, IPasswordPolicy, IAccountLockout } from '../models/SecuritySettings';
import { UserSession, IUserSession } from '../models/UserSession';
import { SecurityAuditLog, ISecurityAuditLog } from '../models/SecurityAuditLog';
import { User, IUser } from '../models/User';
import { RedisCacheService } from './RedisCacheService';
import { AuditService } from './auditService';
import logger from '../utils/logger';
// @ts-ignore - bcrypt types not available in production build
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export interface LoginFilters {
  userId?: string;
  ipAddress?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  page?: number;
}

export interface LoginHistory {
  id: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  failureReason?: string;
  location?: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  loginTime: Date;
  lastActivity: Date;
  isActive: boolean;
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
  };
}

export interface SecurityAlert {
  id: string;
  type: 'suspicious_login' | 'multiple_failures' | 'new_device' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
  resolved: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number;
}

export interface AccountLockoutInfo {
  userId: string;
  isLocked: boolean;
  lockoutTime?: Date;
  unlockTime?: Date;
  failedAttempts: number;
  reason?: string;
}

/**
 * SecurityMonitoringService - Handles security settings, session management, and audit logging
 * Provides comprehensive security monitoring and enforcement capabilities
 */
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private cacheService: RedisCacheService;
  private auditService: typeof AuditService;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly LOCKOUT_CACHE_PREFIX = 'lockout:';
  private readonly FAILED_ATTEMPTS_PREFIX = 'failed_attempts:';

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
    this.auditService = AuditService;
  }

  public static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Get current security settings
   */
  async getSecuritySettings(): Promise<ISecuritySettings> {
    try {
      const cacheKey = 'security:settings';
      // Try cache first  
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        // Cache contains serialized data, return as-is since MongoDB will validate
        return cached as any;
      }

      let settings = await SecuritySettings.findOne({ isActive: true });

      // Create default settings if none exist
      if (!settings) {
        settings = await this.createDefaultSecuritySettings() as any;
      }

      // Cache the settings
      await this.cacheService.set('security:settings', settings, { ttl: this.CACHE_TTL / 1000 });

      return settings;
    } catch (error) {
      logger.error('Error getting security settings:', error);
      throw new Error('Failed to retrieve security settings');
    }
  }

  /**
   * Update password policy
   */
  async updatePasswordPolicy(policy: IPasswordPolicy, adminId: string): Promise<void> {
    try {
      const settings = await this.getSecuritySettings();

      // Store old policy for audit
      const oldPolicy = settings.passwordPolicy;

      // Update password policy
      settings.passwordPolicy = policy;
      settings.lastModifiedBy = new mongoose.Types.ObjectId(adminId);
      settings.updatedAt = new Date();

      await settings.save();

      // Clear cache
      await this.cacheService.del('security:settings');

      // Create audit log
      await this.auditService.createAuditLog({
        action: 'PASSWORD_POLICY_UPDATED',
        userId: adminId,
        resourceType: 'SecuritySettings',
        resourceId: settings._id.toString(),
        details: {
          newPolicy: policy,
          changes: this.comparePasswordPolicies(oldPolicy, policy)
        },
        complianceCategory: 'security_management',
        riskLevel: 'high',
        changedFields: ['passwordPolicy'],
        oldValues: { passwordPolicy: oldPolicy },
        newValues: { passwordPolicy: policy }
      });

      logger.info(`Password policy updated by admin ${adminId}`);
    } catch (error) {
      logger.error('Error updating password policy:', error);
      throw error;
    }
  }

  /**
   * Update account lockout settings
   */
  async updateAccountLockout(lockout: IAccountLockout, adminId: string): Promise<void> {
    try {
      const settings = await this.getSecuritySettings();

      // Store old lockout for audit
      const oldLockout = settings.accountLockout;

      // Update account lockout
      settings.accountLockout = lockout;
      settings.lastModifiedBy = new mongoose.Types.ObjectId(adminId);
      settings.updatedAt = new Date();

      await settings.save();

      // Clear cache
      await this.cacheService.del('security:settings');

      // Create audit log
      await this.auditService.createAuditLog({
        action: 'ACCOUNT_LOCKOUT_UPDATED',
        userId: adminId,
        resourceType: 'SecuritySettings',
        resourceId: settings._id.toString(),
        details: {
          newLockout: lockout,
          oldLockout: oldLockout
        },
        complianceCategory: 'security_management',
        riskLevel: 'high',
        changedFields: ['accountLockout'],
        oldValues: { accountLockout: oldLockout },
        newValues: { accountLockout: lockout }
      });

      logger.info(`Account lockout settings updated by admin ${adminId}`);
    } catch (error) {
      logger.error('Error updating account lockout settings:', error);
      throw error;
    }
  }

  /**
   * Get all active user sessions
   */
  async getActiveSessions(limit: number = 100): Promise<SessionInfo[]> {
    try {
      const sessions = await UserSession.find({ isActive: true })
        .populate('userId', 'email firstName lastName')
        .sort({ lastActivity: -1 })
        .limit(limit)
        .lean();

      return sessions.map(session => ({
        sessionId: session._id.toString(),
        userId: session.userId._id.toString(),
        userEmail: (session.userId as any).email || "unknown",
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        location: session.location,
        loginTime: session.loginTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive,
        deviceInfo: session.deviceInfo
      }));
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      throw new Error('Failed to retrieve active sessions');
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId: string, adminId?: string): Promise<void> {
    try {
      const session = await UserSession.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Update session
      session.isActive = false;
      session.terminatedAt = new Date();
      session.terminationReason = adminId ? 'Admin terminated' : 'User terminated';
      await session.save();

      // Remove from cache if exists
      await this.cacheService.del(`session:${session.userId}:${sessionId}`);

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'SESSION_TERMINATED',
          userId: adminId,
          resourceType: 'UserSession',
          resourceId: sessionId,
          details: {
            targetUserId: session.userId.toString(),
            sessionId,
            ipAddress: session.ipAddress,
            terminationReason: 'Admin terminated'
          },
          complianceCategory: 'security_management',
          riskLevel: 'medium'
        });
      }

      logger.info(`Session ${sessionId} terminated by ${adminId || 'user'}`);
    } catch (error) {
      logger.error('Error terminating session:', error);
      throw error;
    }
  }

  /**
   * Get login history with filtering
   */
  async getLoginHistory(filters: LoginFilters = {}): Promise<{
    history: LoginHistory[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const { page = 1, limit = 50 } = filters;
      const skip = (page - 1) * limit;

      // Build query
      const query = this.buildLoginHistoryQuery(filters);

      // Execute queries
      const [logs, total] = await Promise.all([
        SecurityAuditLog.find(query)
          .populate('userId', 'email firstName lastName')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SecurityAuditLog.countDocuments(query)
      ]);

      const history: LoginHistory[] = logs.map(log => ({
        id: log._id.toString(),
        userId: log.userId._id.toString(),
        userEmail: (log.userId as any).email || "unknown",
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        success: log.success,
        timestamp: log.timestamp,
        failureReason: log.details?.failureReason,
        location: log.details?.location
      }));

      return {
        history,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error getting login history:', error);
      throw new Error('Failed to retrieve login history');
    }
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, reason: string, adminId?: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const settings = await this.getSecuritySettings();
      const lockoutDuration = settings.accountLockout.lockoutDuration * 60 * 1000; // Convert to milliseconds
      const unlockTime = new Date(Date.now() + lockoutDuration);

      // Store lockout info in cache
      const lockoutInfo: AccountLockoutInfo = {
        userId,
        isLocked: true,
        lockoutTime: new Date(),
        unlockTime,
        failedAttempts: 0,
        reason
      };

      await this.cacheService.set(
        `${this.LOCKOUT_CACHE_PREFIX}${userId}`,
        lockoutInfo,
        { ttl: lockoutDuration }
      );

      // Terminate all active sessions
      await UserSession.updateMany(
        { userId, isActive: true },
        {
          isActive: false,
          terminatedAt: new Date(),
          terminationReason: 'Account locked'
        }
      );

      // Create security audit log
      await this.createSecurityAuditLog({
        action: 'ACCOUNT_LOCKED',
        userId: adminId || userId,
        targetUserId: userId,
        ipAddress: '',
        userAgent: '',
        success: true,
        details: {
          reason,
          lockoutDuration: settings.accountLockout.lockoutDuration,
          unlockTime,
          lockedBy: adminId ? 'admin' : 'system'
        }
      });

      logger.info(`Account ${userId} locked. Reason: ${reason}`);
    } catch (error) {
      logger.error('Error locking account:', error);
      throw error;
    }
  }

  /**
   * Unlock user account
   */
  async unlockAccount(userId: string, adminId?: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove lockout from cache
      await this.cacheService.del(`${this.LOCKOUT_CACHE_PREFIX}${userId}`);
      await this.cacheService.del(`${this.FAILED_ATTEMPTS_PREFIX}${userId}`);

      // Create security audit log
      await this.createSecurityAuditLog({
        action: 'ACCOUNT_UNLOCKED',
        userId: adminId || userId,
        targetUserId: userId,
        ipAddress: '',
        userAgent: '',
        success: true,
        details: {
          unlockedBy: adminId ? 'admin' : 'system',
          unlockedAt: new Date()
        }
      });

      logger.info(`Account ${userId} unlocked by ${adminId || 'system'}`);
    } catch (error) {
      logger.error('Error unlocking account:', error);
      throw error;
    }
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId: string): Promise<AccountLockoutInfo> {
    try {
      const lockoutInfo = await this.cacheService.get(`${this.LOCKOUT_CACHE_PREFIX}${userId}`);

      if (lockoutInfo) {
        // Check if lockout has expired
        if (lockoutInfo && typeof lockoutInfo === 'object' && 'unlockTime' in lockoutInfo &&
          lockoutInfo.unlockTime && new Date() > new Date(lockoutInfo.unlockTime as string)) {
          await this.unlockAccount(userId);
          return { userId, isLocked: false, failedAttempts: 0 };
        }
        return lockoutInfo as AccountLockoutInfo;
      }

      return { userId, isLocked: false, failedAttempts: 0 };
    } catch (error) {
      logger.error('Error checking account lockout:', error);
      return { userId, isLocked: false, failedAttempts: 0 };
    }
  }

  /**
   * Record failed login attempt
   */
  async recordFailedLoginAttempt(
    userId: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<void> {
    try {
      const settings = await this.getSecuritySettings();
      const maxAttempts = settings.accountLockout.maxFailedAttempts;

      // Get current failed attempts
      const attemptsKey = `${this.FAILED_ATTEMPTS_PREFIX}${userId}`;
      const cachedAttempts = await this.cacheService.get(attemptsKey) || 0;
      const attempts = typeof cachedAttempts === 'number' ? cachedAttempts + 1 : 1;

      // Store updated attempts (expire after 1 hour)
      await this.cacheService.set(attemptsKey, attempts, { ttl: 60 * 60 });

      // Create security audit log
      await this.createSecurityAuditLog({
        action: 'LOGIN_FAILED',
        userId,
        targetUserId: userId,
        ipAddress,
        userAgent,
        success: false,
        details: {
          failureReason: reason,
          attemptNumber: attempts,
          maxAttempts
        }
      });

      // Lock account if max attempts reached
      const attemptCount = typeof attempts === 'number' ? attempts : 0;
      if (attemptCount >= maxAttempts) {
        await this.lockAccount(userId, `Too many failed login attempts (${attempts})`);
      }

      logger.warn(`Failed login attempt ${attempts}/${maxAttempts} for user ${userId} from ${ipAddress}`);
    } catch (error) {
      logger.error('Error recording failed login attempt:', error);
    }
  }

  /**
   * Record successful login
   */
  async recordSuccessfulLogin(
    userId: string,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    try {
      // Clear failed attempts
      await this.cacheService.del(`${this.FAILED_ATTEMPTS_PREFIX}${userId}`);

      // Create security audit log
      await this.createSecurityAuditLog({
        action: 'LOGIN_SUCCESS',
        userId,
        targetUserId: userId,
        ipAddress,
        userAgent,
        success: true,
        details: {
          sessionId,
          loginTime: new Date()
        }
      });

      // Check for suspicious activity (new device, unusual location, etc.)
      await this.checkForSuspiciousActivity(userId, ipAddress, userAgent);

      logger.info(`Successful login for user ${userId} from ${ipAddress}`);
    } catch (error) {
      logger.error('Error recording successful login:', error);
    }
  }

  /**
   * Validate password against policy
   */
  async validatePassword(password: string, userId?: string): Promise<PasswordValidationResult> {
    try {
      const settings = await this.getSecuritySettings();
      const policy = settings.passwordPolicy;

      const errors: string[] = [];
      let score = 0;

      // Length check
      if (password.length < policy.minLength) {
        errors.push(`Password must be at least ${policy.minLength} characters long`);
      } else {
        score += Math.min(password.length * 2, 20);
      }

      // Character requirements
      if (policy.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      } else if (policy.requireUppercase) {
        score += 10;
      }

      if (policy.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      } else if (policy.requireLowercase) {
        score += 10;
      }

      if (policy.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      } else if (policy.requireNumbers) {
        score += 10;
      }

      if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      } else if (policy.requireSpecialChars) {
        score += 10;
      }

      // Additional strength checks
      if (password.length >= 12) score += 10;
      if (/[A-Z].*[A-Z]/.test(password)) score += 5;
      if (/[a-z].*[a-z]/.test(password)) score += 5;
      if (/\d.*\d/.test(password)) score += 5;
      if (/[!@#$%^&*(),.?":{}|<>].*[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 5;

      // Check for common patterns
      if (/(.)\1{2,}/.test(password)) {
        errors.push('Password should not contain repeated characters');
        score -= 10;
      }

      if (/123|abc|qwe|password|admin/i.test(password)) {
        errors.push('Password should not contain common patterns');
        score -= 15;
      }

      // Check against previous passwords if user provided
      if (userId && policy.preventReuse > 0) {
        const hasUsedBefore = await this.checkPasswordReuse(userId, password);
        if (hasUsedBefore) {
          errors.push(`Password cannot be one of your last ${policy.preventReuse} passwords`);
        }
      }

      // Determine strength
      let strength: 'weak' | 'fair' | 'good' | 'strong';
      if (score < 30) strength = 'weak';
      else if (score < 50) strength = 'fair';
      else if (score < 70) strength = 'good';
      else strength = 'strong';

      return {
        isValid: errors.length === 0,
        errors,
        strength,
        score: Math.max(0, Math.min(100, score))
      };
    } catch (error) {
      logger.error('Error validating password:', error);
      return {
        isValid: false,
        errors: ['Password validation failed'],
        strength: 'weak',
        score: 0
      };
    }
  }

  /**
   * Get security audit logs
   */
  async getSecurityAuditLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    action?: string;
    userId?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<{
    logs: ISecurityAuditLog[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const { page = 1, limit = 50 } = filters;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }

      if (filters.action) query.action = filters.action;
      if (filters.userId) query.userId = filters.userId;

      // Execute queries
      const [logs, total] = await Promise.all([
        SecurityAuditLog.find(query)
          .populate('userId', 'email firstName lastName')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SecurityAuditLog.countDocuments(query)
      ]);

      return {
        logs: logs as ISecurityAuditLog[],
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error getting security audit logs:', error);
      throw new Error('Failed to retrieve security audit logs');
    }
  }

  // Private helper methods

  private async createDefaultSecuritySettings(): Promise<ISecuritySettings> {
    const defaultSettings = new SecuritySettings({
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 90,
        preventReuse: 5
      },
      sessionSettings: {
        maxDuration: 480, // 8 hours
        idleTimeout: 30,
        maxConcurrentSessions: 3,
        requireReauthentication: false
      },
      accountLockout: {
        maxFailedAttempts: 5,
        lockoutDuration: 30,
        autoUnlock: true,
        notifyOnLockout: true
      },
      twoFactorAuth: {
        enforced: false,
        methods: ['email'],
        gracePeriod: 7,
        backupCodes: true
      },
      ipWhitelist: [],
      allowedDomains: [],
      securityNotifications: {
        newDeviceLogin: true,
        suspiciousActivity: true,
        passwordChanges: true,
        roleChanges: true
      },
      auditRetention: {
        loginLogs: 365,
        actionLogs: 730,
        securityLogs: 1095
      },
      isActive: true,
      lastModifiedBy: new mongoose.Types.ObjectId()
    });

    await defaultSettings.save();
    return defaultSettings;
  }

  private comparePasswordPolicies(oldPolicy: IPasswordPolicy, newPolicy: IPasswordPolicy): string[] {
    const changes: string[] = [];

    if (oldPolicy.minLength !== newPolicy.minLength) {
      changes.push(`Minimum length: ${oldPolicy.minLength} → ${newPolicy.minLength}`);
    }
    if (oldPolicy.requireUppercase !== newPolicy.requireUppercase) {
      changes.push(`Require uppercase: ${oldPolicy.requireUppercase} → ${newPolicy.requireUppercase}`);
    }
    if (oldPolicy.requireLowercase !== newPolicy.requireLowercase) {
      changes.push(`Require lowercase: ${oldPolicy.requireLowercase} → ${newPolicy.requireLowercase}`);
    }
    if (oldPolicy.requireNumbers !== newPolicy.requireNumbers) {
      changes.push(`Require numbers: ${oldPolicy.requireNumbers} → ${newPolicy.requireNumbers}`);
    }
    if (oldPolicy.requireSpecialChars !== newPolicy.requireSpecialChars) {
      changes.push(`Require special chars: ${oldPolicy.requireSpecialChars} → ${newPolicy.requireSpecialChars}`);
    }
    if (oldPolicy.maxAge !== newPolicy.maxAge) {
      changes.push(`Max age: ${oldPolicy.maxAge} → ${newPolicy.maxAge} days`);
    }
    if (oldPolicy.preventReuse !== newPolicy.preventReuse) {
      changes.push(`Prevent reuse: ${oldPolicy.preventReuse} → ${newPolicy.preventReuse} passwords`);
    }

    return changes;
  }

  private buildLoginHistoryQuery(filters: LoginFilters): Record<string, any> {
    const query: any = {
      action: { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] }
    };

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.ipAddress) {
      query.ipAddress = filters.ipAddress;
    }

    if (filters.success !== undefined) {
      query.success = filters.success;
    }

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return query;
  }

  private async createSecurityAuditLog(data: {
    action: string;
    userId: string;
    targetUserId?: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    details: Record<string, any>;
  }): Promise<void> {
    try {
      const auditLog = new SecurityAuditLog({
        action: data.action,
        userId: new mongoose.Types.ObjectId(data.userId),
        targetUserId: data.targetUserId ? new mongoose.Types.ObjectId(data.targetUserId) : undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success,
        details: data.details,
        timestamp: new Date()
      });

      await auditLog.save();
    } catch (error) {
      logger.error('Error creating security audit log:', error);
    }
  }

  private async checkPasswordReuse(userId: string, password: string): Promise<boolean> {
    try {
      // This would check against stored password hashes
      // For now, returning false (not implemented)
      return false;
    } catch (error) {
      logger.error('Error checking password reuse:', error);
      return false;
    }
  }

  private async checkForSuspiciousActivity(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      // Check for new device/location
      const recentLogins = await SecurityAuditLog.find({
        userId: new mongoose.Types.ObjectId(userId),
        action: 'LOGIN_SUCCESS',
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }).limit(10);

      const knownIPs = recentLogins.map(log => log.ipAddress);
      const knownUserAgents = recentLogins.map(log => log.userAgent);

      // Check for new IP
      if (!knownIPs.includes(ipAddress)) {
        await this.createSecurityAlert({
          type: 'new_device',
          severity: 'medium',
          userId,
          description: `Login from new IP address: ${ipAddress}`,
          metadata: { ipAddress, userAgent }
        });
      }

      // Check for new user agent (simplified check)
      const isNewDevice = !knownUserAgents.some(ua =>
        ua && userAgent && ua.includes(userAgent.split(' ')[0])
      );

      if (isNewDevice) {
        await this.createSecurityAlert({
          type: 'new_device',
          severity: 'medium',
          userId,
          description: `Login from new device`,
          metadata: { ipAddress, userAgent }
        });
      }
    } catch (error) {
      logger.error('Error checking for suspicious activity:', error);
    }
  }

  private async createSecurityAlert(alert: {
    type: SecurityAlert['type'];
    severity: SecurityAlert['severity'];
    userId: string;
    description: string;
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      // Store alert in cache for quick access
      const alertId = crypto.randomUUID();
      const securityAlert: SecurityAlert = {
        id: alertId,
        type: alert.type,
        severity: alert.severity,
        userId: alert.userId,
        description: alert.description,
        timestamp: new Date(),
        metadata: alert.metadata,
        resolved: false
      };

      await this.cacheService.set(`security:alert:${alertId}`, securityAlert, { ttl: 24 * 3600 });

      // Also create audit log
      await this.createSecurityAuditLog({
        action: 'SECURITY_ALERT',
        userId: alert.userId,
        ipAddress: alert.metadata.ipAddress || '',
        userAgent: alert.metadata.userAgent || '',
        success: true,
        details: {
          alertType: alert.type,
          severity: alert.severity,
          description: alert.description,
          metadata: alert.metadata
        }
      });

      logger.warn(`Security alert created: ${alert.description} for user ${alert.userId}`);
    } catch (error) {
      logger.error('Error creating security alert:', error);
    }
  }

  /**
   * Clear security cache
   */
  async clearCache(): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.del('security:settings'),
        this.cacheService.delPattern('lockout:*'),
        this.cacheService.delPattern('failed_attempts:*'),
        this.cacheService.delPattern('security:alert:*')
      ]);

      logger.info('Security monitoring cache cleared');
    } catch (error) {
      logger.error('Error clearing security cache:', error);
      throw new Error('Failed to clear security cache');
    }
  }
}

export default SecurityMonitoringService;