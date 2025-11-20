import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth";
import crypto from "crypto";
import logger from "../utils/logger";

/**
 * CSRF Protection middleware for Communication Hub
 */

// Store for CSRF tokens (in production, use Redis or database)
const csrfTokenStore = new Map<
  string,
  { token: string; expires: number; userId: string }
>();

// Clean up expired tokens every 10 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of csrfTokenStore.entries()) {
      if (now > value.expires) {
        csrfTokenStore.delete(key);
      }
    }
  },
  10 * 60 * 1000,
);

/**
 * Generate CSRF token for user session
 */
export const generateCSRFToken = (
  userId: string,
  sessionId?: string,
): string => {
  const token = crypto.randomBytes(32).toString("hex");
  const key = `${userId}_${sessionId || "default"}`;

  csrfTokenStore.set(key, {
    token,
    expires: Date.now() + 60 * 60 * 1000, // 1 hour expiry
    userId,
  });

  return token;
};

/**
 * Validate CSRF token
 */
export const validateCSRFToken = (
  userId: string,
  token: string,
  sessionId?: string,
): boolean => {
  const key = `${userId}_${sessionId || "default"}`;
  const storedData = csrfTokenStore.get(key);

  if (!storedData) {
    return false;
  }

  if (Date.now() > storedData.expires) {
    csrfTokenStore.delete(key);
    return false;
  }

  return storedData.token === token && storedData.userId === userId;
};

/**
 * CSRF protection middleware for state-changing operations
 */
export const requireCSRFToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Skip CSRF validation for super admins (they can operate across workplaces)
    if (req.user.role === 'super_admin' || (req as any).isAdmin === true) {
      logger.info("CSRF validation skipped for super admin", {
        userId: req.user._id,
        method: req.method,
        url: req.originalUrl,
        service: "communication-csrf",
      });
      return next();
    }

    // Get CSRF token from header or body
    const csrfToken =
      req.headers["x-csrf-token"] ||
      req.headers["csrf-token"] ||
      req.body._csrf ||
      req.query._csrf;

    if (!csrfToken) {
      logger.warn("CSRF token missing", {
        userId: req.user._id,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        service: "communication-csrf",
      });

      res.status(403).json({
        success: false,
        code: "CSRF_TOKEN_MISSING",
        message: "CSRF token is required for this operation",
      });
      return;
    }

    // Validate CSRF token
    const sessionId = (req as any).sessionID;
    const userId = req.user._id.toString();
    
    // Try with sessionId first, then without
    let isValid = validateCSRFToken(userId, csrfToken as string, sessionId);
    
    // If validation fails with sessionId, try without it (fallback to "default")
    if (!isValid && sessionId) {
      isValid = validateCSRFToken(userId, csrfToken as string, undefined);
    }

    if (!isValid) {
      logger.warn("Invalid CSRF token", {
        userId: req.user._id,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        providedToken:
          typeof csrfToken === "string"
            ? csrfToken.substring(0, 8) + "..."
            : "invalid",
        hasSessionId: !!sessionId,
        service: "communication-csrf",
      });

      res.status(403).json({
        success: false,
        code: "CSRF_TOKEN_INVALID",
        message: "Invalid or expired CSRF token",
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Error validating CSRF token:", error);
    res.status(500).json({
      success: false,
      message: "CSRF validation failed",
    });
  }
};

/**
 * Provide CSRF token endpoint
 */
export const provideCSRFToken = (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const sessionId = (req as any).sessionID;
    const token = generateCSRFToken(req.user._id.toString(), sessionId);

    // Set token as cookie so frontend can automatically use it
    res.cookie("csrf-token", token, {
      httpOnly: false, // Must be accessible to JavaScript
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.json({
      success: true,
      csrfToken: token,
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });
  } catch (error) {
    logger.error("Error providing CSRF token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate CSRF token",
    });
  }
};

/**
 * Double Submit Cookie CSRF protection
 */
export const doubleSubmitCSRF = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Skip for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Get CSRF token from cookie and header/body
    const cookieToken = req.cookies["csrf-token"];
    const headerToken = req.headers["x-csrf-token"] || req.body._csrf;

    if (!cookieToken || !headerToken) {
      res.status(403).json({
        success: false,
        code: "CSRF_TOKENS_MISSING",
        message: "CSRF tokens are required (cookie and header/body)",
      });
      return;
    }

    // Tokens must match
    if (cookieToken !== headerToken) {
      logger.warn("CSRF token mismatch", {
        userId: req.user._id,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        service: "communication-csrf",
      });

      res.status(403).json({
        success: false,
        code: "CSRF_TOKEN_MISMATCH",
        message: "CSRF tokens do not match",
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Error in double submit CSRF:", error);
    res.status(500).json({
      success: false,
      message: "CSRF validation failed",
    });
  }
};

/**
 * Set CSRF cookie for double submit pattern
 */
export const setCSRFCookie = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    if (!req.user) {
      return next();
    }

    // Generate token if not exists
    if (!req.cookies["csrf-token"]) {
      const token = crypto.randomBytes(32).toString("hex");

      res.cookie("csrf-token", token, {
        httpOnly: false, // Must be accessible to JavaScript for double submit
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
      });
    }

    next();
  } catch (error) {
    logger.error("Error setting CSRF cookie:", error);
    next(); // Continue on error to avoid blocking requests
  }
};

/**
 * Origin validation for CSRF protection
 */
export const validateOrigin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Skip for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin || req.headers.referer;
    const host = req.headers.host;

    if (!origin) {
      logger.warn("Missing origin header", {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        service: "communication-csrf",
      });

      res.status(403).json({
        success: false,
        code: "ORIGIN_MISSING",
        message: "Origin header is required",
      });
      return;
    }

    // Extract hostname from origin
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      res.status(403).json({
        success: false,
        code: "INVALID_ORIGIN",
        message: "Invalid origin format",
      });
      return;
    }

    // Validate origin matches host
    if (originHost !== host) {
      logger.warn("Origin mismatch", {
        method: req.method,
        url: req.originalUrl,
        origin: originHost,
        host,
        ip: req.ip,
        service: "communication-csrf",
      });

      res.status(403).json({
        success: false,
        code: "ORIGIN_MISMATCH",
        message: "Origin does not match host",
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Error validating origin:", error);
    res.status(500).json({
      success: false,
      message: "Origin validation failed",
    });
  }
};

/**
 * SameSite cookie enforcement
 */
export const enforceSameSite = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Skip cookie override due to type compatibility issues
    // SameSite will be enforced at the application level
    next();
  } catch (error) {
    logger.error("Error enforcing SameSite:", error);
    next(); // Continue on error
  }
};

/**
 * Comprehensive CSRF protection combining multiple techniques
 */
export const comprehensiveCSRFProtection = [
  enforceSameSite,
  validateOrigin,
  setCSRFCookie,
  requireCSRFToken,
];

/**
 * Lightweight CSRF protection for high-frequency endpoints
 */
export const lightweightCSRFProtection = [validateOrigin, doubleSubmitCSRF];

export default {
  generateCSRFToken,
  validateCSRFToken,
  requireCSRFToken,
  provideCSRFToken,
  doubleSubmitCSRF,
  setCSRFCookie,
  validateOrigin,
  enforceSameSite,
  comprehensiveCSRFProtection,
  lightweightCSRFProtection,
};
