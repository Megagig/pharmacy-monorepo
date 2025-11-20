import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import AIUsageTrackingService from '../services/AIUsageTrackingService';
import logger from '../utils/logger';

/**
 * Middleware to check AI usage limits before processing AI requests
 */
export const checkAIUsageLimits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = req.user?.workplaceId;
    
    if (!workspaceId) {
      res.status(400).json({
        success: false,
        message: 'Workspace context required for AI features',
      });
      return;
    }

    const aiUsageService = AIUsageTrackingService.getInstance();
    const permission = await aiUsageService.canMakeRequest(workspaceId.toString());

    if (!permission.allowed) {
      logger.warn('AI request blocked due to usage limits', {
        workspaceId: workspaceId.toString(),
        reason: permission.reason,
        userId: req.user?._id,
      });

      res.status(429).json({
        success: false,
        message: permission.reason || 'AI usage limit exceeded',
        data: {
          remainingRequests: permission.remainingRequests,
          remainingBudget: permission.remainingBudget,
        },
      });
      return;
    }

    // Add usage info to request for potential use in controllers
    (req as any).aiUsageInfo = {
      remainingRequests: permission.remainingRequests,
      remainingBudget: permission.remainingBudget,
    };

    next();
  } catch (error) {
    logger.error('Error checking AI usage limits', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workspaceId: req.user?.workplaceId,
      userId: req.user?._id,
    });

    // In case of error, allow the request to proceed but log the issue
    // This prevents system errors from blocking legitimate usage
    next();
  }
};

/**
 * Middleware specifically for AI diagnostic requests
 */
export const checkAIDiagnosticLimits = checkAIUsageLimits;

/**
 * Middleware for lab interpretation AI requests
 */
export const checkAILabInterpretationLimits = checkAIUsageLimits;

/**
 * Middleware for medication recommendation AI requests
 */
export const checkAIMedicationLimits = checkAIUsageLimits;