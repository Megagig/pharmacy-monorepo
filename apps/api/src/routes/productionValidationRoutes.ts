/**
 * Production Validation Routes
 * 
 * API endpoints for validating production performance improvements
 */

import { Router } from 'express';
import { auth } from '../middlewares/auth';
import rbac from '../middlewares/rbac';
import ProductionValidationService from '../services/ProductionValidationService';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * Run production performance validation
 * POST /api/production-validation/validate
 */
router.post('/validate', auth, rbac.requireRole('admin', 'deployment_manager'), async (req: AuthRequest, res) => {
  try {
    const { baseline, targets } = req.body;

    if (!baseline) {
      return res.status(400).json({
        success: false,
        message: 'Baseline metrics are required',
      });
    }

    const result = await ProductionValidationService.validateProductionPerformance(baseline, targets);

    logger.info(`Production validation executed by user ${req.user.id}: ${result.passed ? 'PASSED' : 'FAILED'}`);

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Error running production validation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run production validation',
      error: error.message,
    });
  }
});

/**
 * Validate performance across user segments
 * POST /api/production-validation/validate-segments
 */
router.post('/validate-segments', auth, rbac.requireRole('admin', 'deployment_manager'), async (req: AuthRequest, res) => {
  try {
    const result = await ProductionValidationService.validateAcrossUserSegments();

    logger.info(`Segment validation executed by user ${req.user.id}: Overall ${result.overall.passed ? 'PASSED' : 'FAILED'}`);

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Error running segment validation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run segment validation',
      error: error.message,
    });
  }
});

/**
 * Get validation targets
 * GET /api/production-validation/targets
 */
router.get('/targets', auth, rbac.requireRole('admin', 'deployment_manager', 'viewer'), async (req, res) => {
  try {
    const targets = {
      lighthouse: {
        performance: 90,
        accessibility: 90,
        bestPractices: 90,
        seo: 90,
      },
      webVitals: {
        LCP: 2500,
        TTI: 3800,
        FCP: 1800,
        CLS: 0.1,
        TTFB: 800,
      },
      apiLatency: {
        improvement: 30, // 30% improvement required
        maxP95: 1000,
      },
      themeSwitch: {
        maxDuration: 16, // 16ms (1 frame)
      },
    };

    res.json({
      success: true,
      data: targets,
    });

  } catch (error) {
    logger.error('Error getting validation targets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get validation targets',
      error: error.message,
    });
  }
});

export default router;
