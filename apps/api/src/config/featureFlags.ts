/**
 * Performance Feature Flags Configuration
 * 
 * This module manages feature flags for performance optimizations,
 * enabling gradual rollout and safe deployment of new features.
 */

export interface PerformanceFeatureFlags {
  // Core performance optimizations
  themeOptimization: boolean;
  bundleOptimization: boolean;
  apiCaching: boolean;
  databaseOptimization: boolean;
  performanceMonitoring: boolean;

  // Advanced features
  cursorPagination: boolean;
  backgroundJobs: boolean;
  serviceWorker: boolean;
  virtualization: boolean;
  reactQueryOptimization: boolean;

  // Rollout configuration
  rolloutPercentage: number;
  internalTesting: boolean;
  betaUsers: boolean;
}

export interface FeatureFlagOverride {
  userId?: string;
  workspaceId?: string;
  featureName: string;
  enabled: boolean;
  expiresAt?: Date;
  reason?: string;
}

/**
 * Get performance feature flags from environment variables
 */
export const getPerformanceFeatureFlags = (): PerformanceFeatureFlags => {
  return {
    // Core optimizations
    themeOptimization: process.env.FEATURE_THEME_OPTIMIZATION === 'true',
    bundleOptimization: process.env.FEATURE_BUNDLE_OPTIMIZATION === 'true',
    apiCaching: process.env.FEATURE_API_CACHING === 'true',
    databaseOptimization: process.env.FEATURE_DATABASE_OPTIMIZATION === 'true',
    performanceMonitoring: process.env.FEATURE_PERFORMANCE_MONITORING === 'true',

    // Advanced features
    cursorPagination: process.env.FEATURE_CURSOR_PAGINATION === 'true',
    backgroundJobs: process.env.FEATURE_BACKGROUND_JOBS === 'true',
    serviceWorker: process.env.FEATURE_SERVICE_WORKER === 'true',
    virtualization: process.env.FEATURE_VIRTUALIZATION === 'true',
    reactQueryOptimization: process.env.FEATURE_REACT_QUERY_OPTIMIZATION === 'true',

    // Rollout configuration
    rolloutPercentage: parseInt(process.env.FEATURE_ROLLOUT_PERCENTAGE || '0', 10),
    internalTesting: process.env.FEATURE_INTERNAL_TESTING === 'true',
    betaUsers: process.env.FEATURE_BETA_USERS === 'true',
  };
};

/**
 * Feature flag validation rules
 */
export const validateFeatureFlags = (flags: PerformanceFeatureFlags): string[] => {
  const errors: string[] = [];

  // Rollout percentage validation
  if (flags.rolloutPercentage < 0 || flags.rolloutPercentage > 100) {
    errors.push('Rollout percentage must be between 0 and 100');
  }

  // Dependency validation
  if (flags.apiCaching && !flags.performanceMonitoring) {
    errors.push('API caching requires performance monitoring to be enabled');
  }

  if (flags.backgroundJobs && !flags.apiCaching) {
    errors.push('Background jobs require API caching to be enabled');
  }

  if (flags.cursorPagination && !flags.databaseOptimization) {
    errors.push('Cursor pagination requires database optimization to be enabled');
  }

  return errors;
};

/**
 * Get feature flag status for API responses
 */
export const getFeatureFlagStatus = () => {
  const flags = getPerformanceFeatureFlags();
  const errors = validateFeatureFlags(flags);

  return {
    flags,
    valid: errors.length === 0,
    errors,
    lastUpdated: new Date().toISOString(),
  };
};

/**
 * Default feature flag configuration for different environments
 */
export const getDefaultFeatureFlags = (environment: string): Partial<PerformanceFeatureFlags> => {
  switch (environment) {
    case 'development':
      return {
        themeOptimization: true,
        bundleOptimization: true,
        apiCaching: true,
        databaseOptimization: true,
        performanceMonitoring: true,
        cursorPagination: true,
        backgroundJobs: false, // Disabled in dev to avoid complexity
        serviceWorker: false,  // Disabled in dev
        virtualization: true,
        reactQueryOptimization: true,
        rolloutPercentage: 100,
        internalTesting: true,
        betaUsers: false,
      };

    case 'staging':
      return {
        themeOptimization: true,
        bundleOptimization: true,
        apiCaching: true,
        databaseOptimization: true,
        performanceMonitoring: true,
        cursorPagination: true,
        backgroundJobs: true,
        serviceWorker: true,
        virtualization: true,
        reactQueryOptimization: true,
        rolloutPercentage: 100,
        internalTesting: false,
        betaUsers: true,
      };

    case 'production':
      return {
        themeOptimization: false,
        bundleOptimization: false,
        apiCaching: false,
        databaseOptimization: false,
        performanceMonitoring: true, // Always enabled in production
        cursorPagination: false,
        backgroundJobs: false,
        serviceWorker: false,
        virtualization: false,
        reactQueryOptimization: false,
        rolloutPercentage: 0,
        internalTesting: false,
        betaUsers: false,
      };

    default:
      return {
        performanceMonitoring: true,
        rolloutPercentage: 0,
      };
  }
};

/**
 * Feature flag descriptions for documentation
 */
export const FEATURE_FLAG_DESCRIPTIONS = {
  themeOptimization: 'Enables zero-flicker theme switching with inline scripts and CSS variables',
  bundleOptimization: 'Enables code splitting, lazy loading, and bundle size optimizations',
  apiCaching: 'Enables Redis-based API response caching for improved performance',
  databaseOptimization: 'Enables optimized database indexes and query improvements',
  performanceMonitoring: 'Enables Web Vitals collection and performance monitoring',
  cursorPagination: 'Enables cursor-based pagination for better performance with large datasets',
  backgroundJobs: 'Enables BullMQ background job processing for heavy operations',
  serviceWorker: 'Enables service worker for offline functionality and caching',
  virtualization: 'Enables virtualized lists and tables for better performance with large datasets',
  reactQueryOptimization: 'Enables optimized React Query configuration and caching strategies',
} as const;

/**
 * Feature flag categories for organization
 */
export const FEATURE_FLAG_CATEGORIES = {
  core: ['themeOptimization', 'bundleOptimization', 'performanceMonitoring'],
  backend: ['apiCaching', 'databaseOptimization', 'cursorPagination', 'backgroundJobs'],
  frontend: ['virtualization', 'reactQueryOptimization', 'serviceWorker'],
} as const;

// Import the FeatureFlagService for export
import FeatureFlagService from '../services/FeatureFlagService';
export { FeatureFlagService };

// Middleware functions for feature flag injection and requirement
import { Request, Response, NextFunction } from 'express';

/**
 * Inject feature flags into the request object
 */
export const injectFeatureFlags = (req: Request, res: Response, next: NextFunction) => {
  try {
    const flags = getPerformanceFeatureFlags();
    req.featureFlags = flags;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to require a specific feature flag
 */
export const requireFeatureFlag = (featureName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const flags = req.featureFlags || getPerformanceFeatureFlags();

      // Check if the feature is enabled
      if (flags[featureName as keyof PerformanceFeatureFlags]) {
        next();
      } else {
        res.status(403).json({
          success: false,
          message: `Feature '${featureName}' is not enabled`,
          code: 'FEATURE_NOT_ENABLED'
        });
      }
    } catch (error) {
      next(error);
    }
  };
};

// Extend Express Request type to include featureFlags
declare global {
  namespace Express {
    interface Request {
      featureFlags?: PerformanceFeatureFlags;
    }
  }
}
