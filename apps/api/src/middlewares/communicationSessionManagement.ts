import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * Session Management middleware for Communication Hub
 * Handles concurrent sessions, session validation, and security
 */

interface SessionData {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
  deviceFingerprint?: string;
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
}

interface UserSessions {
  [sessionId: string]: SessionData;
}

// Store for active sessions (in production, use Redis or database)
const activeSessionsStore = new Map<string, UserSessions>();
const sessionSecurityStore = new Map<
  string,
  {
    failedAttempts: number;
    lastFailedAttempt: number;
    isLocked: boolean;
    lockExpires?: number;
  }
>();

// Configuration
const SESSION_CONFIG = {
  maxConcurrentSessions: 5, // Maximum concurrent sessions per user
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  deviceFingerprintRequired: true,
};

// Clean up expired sessions every 10 minutes (only in production)
let sessionCleanupInterval: NodeJS.Timeout | null = null;

if (process.env.NODE_ENV === 'production') {
  sessionCleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [userId, sessions] of activeSessionsStore.entries()) {
      const activeSessions: UserSessions = {};
      let hasActiveSessions = false;

      for (const [sessionId, session] of Object.entries(sessions)) {
        const isExpired =
          now - session.lastActivity > SESSION_CONFIG.sessionTimeout;
        const isInactive =
          now - session.lastActivity > SESSION_CONFIG.inactivityTimeout;

        if (!isExpired && !isInactive && session.isActive) {
          activeSessions[sessionId] = session;
          hasActiveSessions = true;
        } else {
          logger.info('Session expired/inactive', {
            userId,
            sessionId,
            reason: isExpired ? 'expired' : 'inactive',
            lastActivity: new Date(session.lastActivity).toISOString(),
            service: 'communication-session',
          });
        }
      }

      if (hasActiveSessions) {
        activeSessionsStore.set(userId, activeSessions);
      } else {
        activeSessionsStore.delete(userId);
      }
    }

    // Clean up security store
    for (const [userId, security] of sessionSecurityStore.entries()) {
      if (security.lockExpires && now > security.lockExpires) {
        sessionSecurityStore.delete(userId);
      }
    }
  }, 10 * 60 * 1000);
}

// Cleanup function for graceful shutdown
export const cleanupSessionManagement = () => {
  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }
};

/**
 * Generate device fingerprint from request headers
 */
const generateDeviceFingerprint = (req: Request): string => {
  const components = [
    req.get('User-Agent') || '',
    req.get('Accept-Language') || '',
    req.get('Accept-Encoding') || '',
    req.connection.remoteAddress || req.ip || '',
  ];

  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
};

/**
 * Create new session for user
 */
export const createUserSession = (
  userId: string,
  sessionId: string,
  req: Request
): SessionData => {
  const now = Date.now();
  const deviceFingerprint = generateDeviceFingerprint(req);

  const sessionData: SessionData = {
    userId,
    sessionId,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    createdAt: now,
    lastActivity: now,
    isActive: true,
    deviceFingerprint,
  };

  // Get or create user sessions
  const userSessions = activeSessionsStore.get(userId) || {};

  // Check concurrent session limit
  const activeSessions = Object.values(userSessions).filter((s) => s.isActive);
  if (activeSessions.length >= SESSION_CONFIG.maxConcurrentSessions) {
    // Remove oldest session
    const oldestSession = activeSessions.reduce((oldest, current) =>
      current.lastActivity < oldest.lastActivity ? current : oldest
    );

    logger.info('Removing oldest session due to limit', {
      userId,
      removedSessionId: oldestSession.sessionId,
      newSessionId: sessionId,
      service: 'communication-session',
    });

    delete userSessions[oldestSession.sessionId];
  }

  userSessions[sessionId] = sessionData;
  activeSessionsStore.set(userId, userSessions);

  logger.info('New session created', {
    userId,
    sessionId,
    deviceFingerprint,
    ipAddress: sessionData.ipAddress,
    service: 'communication-session',
  });

  return sessionData;
};

/**
 * Validate user session
 */
export const validateUserSession = (
  userId: string,
  sessionId: string,
  req: Request
): { isValid: boolean; reason?: string; session?: SessionData } => {
  const userSessions = activeSessionsStore.get(userId);

  if (!userSessions) {
    return { isValid: false, reason: 'no_sessions' };
  }

  const session = userSessions[sessionId];

  if (!session) {
    return { isValid: false, reason: 'session_not_found' };
  }

  if (!session.isActive) {
    return { isValid: false, reason: 'session_inactive' };
  }

  const now = Date.now();

  // Check session expiry
  if (now - session.createdAt > SESSION_CONFIG.sessionTimeout) {
    session.isActive = false;
    return { isValid: false, reason: 'session_expired' };
  }

  // Check inactivity timeout
  if (now - session.lastActivity > SESSION_CONFIG.inactivityTimeout) {
    session.isActive = false;
    return { isValid: false, reason: 'session_inactive_timeout' };
  }

  // Validate device fingerprint if required
  if (SESSION_CONFIG.deviceFingerprintRequired) {
    const currentFingerprint = generateDeviceFingerprint(req);
    if (session.deviceFingerprint !== currentFingerprint) {
      logger.warn('Device fingerprint mismatch', {
        userId,
        sessionId,
        expected: session.deviceFingerprint,
        actual: currentFingerprint,
        service: 'communication-session',
      });
      return { isValid: false, reason: 'device_mismatch' };
    }
  }

  // Validate IP address (optional, can be disabled for mobile users)
  const currentIP = req.ip || req.connection.remoteAddress || 'unknown';
  if (session.ipAddress !== currentIP) {
    logger.warn('IP address changed', {
      userId,
      sessionId,
      originalIP: session.ipAddress,
      currentIP,
      service: 'communication-session',
    });

    // Don't invalidate session for IP change, but log it
    // In high-security environments, you might want to invalidate
  }

  // Update last activity
  session.lastActivity = now;
  userSessions[sessionId] = session;
  activeSessionsStore.set(userId, userSessions);

  return { isValid: true, session };
};

/**
 * Session validation middleware
 */
export const validateSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip session validation for certain utility routes
    const sessionExemptRoutes = [
      '/participants/search',  // User search doesn't require active communication session
      '/conversations',        // Creating/viewing conversations is a utility action, not active messaging
      '/messages',             // Fetching messages doesn't require active session
      '/read',                 // Marking as read doesn't require active session
      '/patients',             // Patient-specific utilities (e.g., creating patient queries) shouldn't require an active session
    ];

    const isExempt = sessionExemptRoutes.some(route => req.path.includes(route));
    if (isExempt) {
      return next();
    }

    if (!req.user) {
      return next();
    }

    const sessionId = (req as any).sessionID || req.headers['x-session-id'];

    if (!sessionId) {
      res.status(401).json({
        success: false,
        code: 'SESSION_ID_MISSING',
        message: 'Session ID is required',
      });
      return;
    }

    // Check if user is locked out
    const security = sessionSecurityStore.get(req.user?._id?.toString() || '');
    if (
      security?.isLocked &&
      security.lockExpires &&
      Date.now() < security.lockExpires
    ) {
      res.status(423).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Account temporarily locked due to security concerns',
        lockExpires: new Date(security.lockExpires).toISOString(),
      });
      return;
    }

    const validation = validateUserSession(
      req.user._id.toString(),
      sessionId,
      req
    );

    if (!validation.isValid) {
      // Track failed validation attempts
      const userId = req.user._id.toString();
      const userSecurity = sessionSecurityStore.get(userId) || {
        failedAttempts: 0,
        lastFailedAttempt: 0,
        isLocked: false,
      };

      userSecurity.failedAttempts++;
      userSecurity.lastFailedAttempt = Date.now();

      if (userSecurity.failedAttempts >= SESSION_CONFIG.maxFailedAttempts) {
        userSecurity.isLocked = true;
        userSecurity.lockExpires = Date.now() + SESSION_CONFIG.lockoutDuration;

        logger.warn('User account locked due to failed session validations', {
          userId,
          failedAttempts: userSecurity.failedAttempts,
          lockExpires: new Date(userSecurity.lockExpires).toISOString(),
          service: 'communication-session',
        });
      }

      sessionSecurityStore.set(userId, userSecurity);

      res.status(401).json({
        success: false,
        code: 'SESSION_INVALID',
        message: 'Session is invalid or expired',
        reason: validation.reason,
        requiresReauth: true,
      });
      return;
    }

    // Reset failed attempts on successful validation
    const userId = req.user._id.toString();
    if (sessionSecurityStore.has(userId)) {
      sessionSecurityStore.delete(userId);
    }

    // Store session data in request
    (req as any).sessionData = validation.session;

    next();
  } catch (error) {
    logger.error('Error validating session:', error);
    res.status(500).json({
      success: false,
      message: 'Session validation failed',
    });
  }
};

/**
 * Terminate user session
 */
export const terminateSession = (
  userId: string,
  sessionId: string
): boolean => {
  const userSessions = activeSessionsStore.get(userId);

  if (!userSessions || !userSessions[sessionId]) {
    return false;
  }

  userSessions[sessionId].isActive = false;
  delete userSessions[sessionId];

  if (Object.keys(userSessions).length === 0) {
    activeSessionsStore.delete(userId);
  } else {
    activeSessionsStore.set(userId, userSessions);
  }

  logger.info('Session terminated', {
    userId,
    sessionId,
    service: 'communication-session',
  });

  return true;
};

/**
 * Terminate all user sessions
 */
export const terminateAllUserSessions = (userId: string): number => {
  const userSessions = activeSessionsStore.get(userId);

  if (!userSessions) {
    return 0;
  }

  const sessionCount = Object.keys(userSessions).length;
  activeSessionsStore.delete(userId);

  logger.info('All user sessions terminated', {
    userId,
    sessionCount,
    service: 'communication-session',
  });

  return sessionCount;
};

/**
 * Get user's active sessions
 */
export const getUserActiveSessions = (userId: string): SessionData[] => {
  const userSessions = activeSessionsStore.get(userId);

  if (!userSessions) {
    return [];
  }

  return Object.values(userSessions).filter((session) => session.isActive);
};

/**
 * Session management endpoints middleware
 */
export const sessionManagementEndpoints = {
  /**
   * Get current user's active sessions
   */
  getSessions: (req: AuthRequest, res: Response): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const sessions = getUserActiveSessions(req.user?._id?.toString() || '');
      const currentSessionId = (req as any).sessionID;

      const sessionInfo = sessions.map((session) => ({
        sessionId: session.sessionId,
        createdAt: new Date(session.createdAt).toISOString(),
        lastActivity: new Date(session.lastActivity).toISOString(),
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isCurrent: session.sessionId === currentSessionId,
        location: session.location,
      }));

      res.json({
        success: true,
        data: sessionInfo,
        totalSessions: sessions.length,
        maxAllowed: SESSION_CONFIG.maxConcurrentSessions,
      });
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sessions',
      });
    }
  },

  /**
   * Terminate specific session
   */
  terminateSession: (req: AuthRequest, res: Response): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { sessionId } = req.params;
      const currentSessionId = (req as any).sessionID;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
        return;
      }

      if (sessionId === currentSessionId) {
        res.status(400).json({
          success: false,
          message: 'Cannot terminate current session',
        });
        return;
      }

      const terminated = terminateSession(req.user._id.toString(), sessionId);

      if (!terminated) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Session terminated successfully',
      });
    } catch (error) {
      logger.error('Error terminating session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to terminate session',
      });
    }
  },

  /**
   * Terminate all other sessions
   */
  terminateAllOtherSessions: (req: AuthRequest, res: Response): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userId = req.user._id.toString();
      const currentSessionId = (req as any).sessionID;
      const userSessions = activeSessionsStore.get(userId);

      if (!userSessions) {
        res.json({
          success: true,
          message: 'No other sessions to terminate',
          terminatedCount: 0,
        });
        return;
      }

      let terminatedCount = 0;
      const remainingSessions: UserSessions = {};

      for (const [sessionId, session] of Object.entries(userSessions)) {
        if (sessionId === currentSessionId) {
          remainingSessions[sessionId] = session;
        } else {
          terminatedCount++;
        }
      }

      activeSessionsStore.set(userId, remainingSessions);

      logger.info('All other sessions terminated', {
        userId,
        terminatedCount,
        service: 'communication-session',
      });

      res.json({
        success: true,
        message: `${terminatedCount} sessions terminated successfully`,
        terminatedCount,
      });
    } catch (error) {
      logger.error('Error terminating all other sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to terminate sessions',
      });
    }
  },
};

/**
 * Concurrent session limit enforcement
 */
export const enforceConcurrentSessionLimit = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const sessions = getUserActiveSessions(userId);

    if (sessions.length >= SESSION_CONFIG.maxConcurrentSessions) {
      res.status(429).json({
        success: false,
        code: 'TOO_MANY_SESSIONS',
        message: 'Maximum concurrent sessions exceeded',
        maxAllowed: SESSION_CONFIG.maxConcurrentSessions,
        currentSessions: sessions.length,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error enforcing session limit:', error);
    next(); // Continue on error to avoid blocking legitimate users
  }
};

export default {
  createUserSession,
  validateUserSession,
  validateSession,
  terminateSession,
  terminateAllUserSessions,
  getUserActiveSessions,
  sessionManagementEndpoints,
  enforceConcurrentSessionLimit,
};
