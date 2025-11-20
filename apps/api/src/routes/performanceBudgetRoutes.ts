import express from 'express';
import { body, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { performanceBudgetService } from '../services/PerformanceBudgetService';
import { auth, AuthRequest } from '../middlewares/auth';

const router = express.Router();

// Rate limiting for performance budget endpoints
const budgetRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Too many performance budget requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(budgetRateLimit);
router.use(auth); // Require authentication for all budget endpoints

// Create performance budget
router.post('/', [
  body('name').isString().notEmpty().withMessage('Budget name is required'),
  body('description').optional().isString(),
  body('budgets').isObject().withMessage('Budgets configuration is required'),
  body('budgets.lighthouse').isObject().withMessage('Lighthouse budgets are required'),
  body('budgets.webVitals').isObject().withMessage('Web Vitals budgets are required'),
  body('budgets.bundleSize').isObject().withMessage('Bundle size budgets are required'),
  body('budgets.apiLatency').isObject().withMessage('API latency budgets are required'),
  body('alerting').optional().isObject(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const budgetData = {
      ...req.body,
      workspaceId: (req.user as any)?.workplaceId,
    };

    const budget = await performanceBudgetService.createBudget(budgetData);

    res.status(201).json({
      success: true,
      message: 'Performance budget created successfully',
      budget,
    });

  } catch (error) {
    console.error('Error creating performance budget:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get performance budgets
router.get('/', async (req: AuthRequest, res) => {
  try {
    const budgets = await performanceBudgetService.getBudgets((req.user as any)?.workplaceId);

    res.json({
      success: true,
      budgets,
      count: budgets.length,
    });

  } catch (error) {
    console.error('Error getting performance budgets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get specific performance budget
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const budget = await performanceBudgetService.getBudget(id);

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Performance budget not found',
      });
    }

    // Check if user has access to this budget
    if (budget.workspaceId && budget.workspaceId !== (req.user as any)?.workplaceId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      budget,
    });

  } catch (error) {
    console.error('Error getting performance budget:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Update performance budget
router.put('/:id', [
  body('name').optional().isString().notEmpty(),
  body('description').optional().isString(),
  body('budgets').optional().isObject(),
  body('alerting').optional().isObject(),
  body('isActive').optional().isBoolean(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // Check if budget exists and user has access
    const existingBudget = await performanceBudgetService.getBudget(id);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Performance budget not found',
      });
    }

    if (existingBudget.workspaceId && existingBudget.workspaceId !== (req.user as any)?.workplaceId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const updatedBudget = await performanceBudgetService.updateBudget(id, req.body);

    if (!updatedBudget) {
      return res.status(404).json({
        success: false,
        message: 'Performance budget not found',
      });
    }

    res.json({
      success: true,
      message: 'Performance budget updated successfully',
      budget: updatedBudget,
    });

  } catch (error) {
    console.error('Error updating performance budget:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Delete performance budget
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if budget exists and user has access
    const existingBudget = await performanceBudgetService.getBudget(id);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Performance budget not found',
      });
    }

    if (existingBudget.workspaceId && existingBudget.workspaceId !== (req.user as any)?.workplaceId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const deleted = await performanceBudgetService.deleteBudget(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Performance budget not found',
      });
    }

    res.json({
      success: true,
      message: 'Performance budget deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting performance budget:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get budget report
router.get('/:id/report', [
  query('period').optional().isIn(['24h', '7d', '30d']).withMessage('Invalid period'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { period = '7d' } = req.query;

    // Check if budget exists and user has access
    const existingBudget = await performanceBudgetService.getBudget(id);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Performance budget not found',
      });
    }

    if (existingBudget.workspaceId && existingBudget.workspaceId !== (req.user as any)?.workplaceId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const report = await performanceBudgetService.getBudgetReport(
      id,
      period as '24h' | '7d' | '30d'
    );

    res.json({
      success: true,
      report,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error generating budget report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Check Lighthouse results against budgets
router.post('/check/lighthouse', [
  body('scores').isObject().withMessage('Scores object is required'),
  body('metrics').optional().isObject(),
  body('url').isURL().withMessage('Valid URL is required'),
  body('branch').optional().isString(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { scores, metrics = {}, url, branch } = req.body;

    const violations = await performanceBudgetService.checkLighthouseBudgets({
      scores,
      metrics,
      url,
      branch,
      workspaceId: (req.user as any)?.workplaceId,
    });

    res.json({
      success: true,
      violations,
      violationCount: violations.length,
      budgetsPassed: violations.length === 0,
    });

  } catch (error) {
    console.error('Error checking Lighthouse budgets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Check Web Vitals against budgets
router.post('/check/web-vitals', [
  body('metrics').isObject().withMessage('Metrics object is required'),
  body('url').isURL().withMessage('Valid URL is required'),
  body('userAgent').optional().isString(),
  body('deviceType').optional().isString(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { metrics, url, userAgent, deviceType } = req.body;

    const violations = await performanceBudgetService.checkWebVitalsBudgets(
      metrics,
      {
        url,
        workspaceId: (req.user as any)?.workplaceId,
        userAgent,
        deviceType,
      }
    );

    res.json({
      success: true,
      violations,
      violationCount: violations.length,
      budgetsPassed: violations.length === 0,
    });

  } catch (error) {
    console.error('Error checking Web Vitals budgets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Check bundle size against budgets
router.post('/check/bundle-size', [
  body('bundleData').isObject().withMessage('Bundle data object is required'),
  body('branch').optional().isString(),
  body('commit').optional().isString(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bundleData, branch, commit } = req.body;

    const violations = await performanceBudgetService.checkBundleSizeBudgets(
      bundleData,
      {
        branch,
        commit,
        workspaceId: (req.user as any)?.workplaceId,
      }
    );

    res.json({
      success: true,
      violations,
      violationCount: violations.length,
      budgetsPassed: violations.length === 0,
    });

  } catch (error) {
    console.error('Error checking bundle size budgets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Check API latency against budgets
router.post('/check/api-latency', [
  body('latencyData').isObject().withMessage('Latency data object is required'),
  body('endpoint').optional().isString(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { latencyData, endpoint } = req.body;

    const violations = await performanceBudgetService.checkAPILatencyBudgets(
      latencyData,
      {
        endpoint,
        workspaceId: (req.user as any)?.workplaceId,
      }
    );

    res.json({
      success: true,
      violations,
      violationCount: violations.length,
      budgetsPassed: violations.length === 0,
    });

  } catch (error) {
    console.error('Error checking API latency budgets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Create default budget for workspace
router.post('/default', async (req: AuthRequest, res) => {
  try {
    const workspaceId = (req.user as any)?.workplaceId;
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required',
      });
    }

    const budget = await performanceBudgetService.createDefaultBudget(workspaceId);

    res.status(201).json({
      success: true,
      message: 'Default performance budget created successfully',
      budget,
    });

  } catch (error) {
    console.error('Error creating default performance budget:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
