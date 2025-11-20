import express from 'express';
import { body, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { lighthouseCIService } from '../services/LighthouseCIService';

const router = express.Router();

// Rate limiting for Lighthouse endpoints
const lighthouseRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many Lighthouse requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(lighthouseRateLimit);

// Store Lighthouse CI result
router.post('/results', [
  body('url').isURL().withMessage('Valid URL is required'),
  body('runId').isString().notEmpty().withMessage('Run ID is required'),
  body('branch').isString().notEmpty().withMessage('Branch is required'),
  body('commit').isString().notEmpty().withMessage('Commit hash is required'),
  body('scores').isObject().withMessage('Scores object is required'),
  body('scores.performance').isFloat({ min: 0, max: 100 }).withMessage('Performance score must be 0-100'),
  body('scores.accessibility').isFloat({ min: 0, max: 100 }).withMessage('Accessibility score must be 0-100'),
  body('scores.bestPractices').isFloat({ min: 0, max: 100 }).withMessage('Best practices score must be 0-100'),
  body('scores.seo').isFloat({ min: 0, max: 100 }).withMessage('SEO score must be 0-100'),
  body('metrics').isObject().withMessage('Metrics object is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await lighthouseCIService.storeLighthouseResult(req.body);

    res.status(201).json({
      success: true,
      message: 'Lighthouse result stored successfully',
      result: {
        runId: result.runId,
        timestamp: result.timestamp,
        budgetStatus: result.budgetStatus,
      },
    });

  } catch (error) {
    console.error('Error storing Lighthouse result:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get Lighthouse results
router.get('/results', [
  query('branch').optional().isString(),
  query('url').optional().isURL(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { branch, url, limit, startDate, endDate } = req.query;

    const filters: any = {};
    if (branch) filters.branch = branch;
    if (url) filters.url = url;
    if (limit) filters.limit = parseInt(limit as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const results = await lighthouseCIService.getLighthouseResults(filters);

    res.json({
      success: true,
      results,
      count: results.length,
    });

  } catch (error) {
    console.error('Error getting Lighthouse results:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Compare Lighthouse results
router.get('/compare/:currentRunId', [
  query('baselineRunId').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentRunId } = req.params;
    const { baselineRunId } = req.query;

    const comparison = await lighthouseCIService.compareLighthouseResults(
      currentRunId,
      baselineRunId as string
    );

    res.json({
      success: true,
      comparison,
    });

  } catch (error) {
    console.error('Error comparing Lighthouse results:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get Lighthouse trends
router.get('/trends', [
  query('branch').optional().isString(),
  query('url').optional().isURL(),
  query('days').optional().isInt({ min: 1, max: 90 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { branch = 'main', url, days = 30 } = req.query;

    const trends = await lighthouseCIService.getLighthouseTrends(
      branch as string,
      url as string,
      parseInt(days as string)
    );

    res.json({
      success: true,
      trends,
      period: `${days} days`,
    });

  } catch (error) {
    console.error('Error getting Lighthouse trends:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Generate performance report
router.get('/report', [
  query('branch').optional().isString(),
  query('days').optional().isInt({ min: 1, max: 90 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { branch = 'main', days = 7 } = req.query;

    const report = await lighthouseCIService.generatePerformanceReport(
      branch as string,
      parseInt(days as string)
    );

    res.json({
      success: true,
      report,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Webhook endpoint for Lighthouse CI integration
router.post('/webhook', [
  body('runId').isString().notEmpty(),
  body('url').isURL(),
  body('branch').isString().notEmpty(),
  body('commit').isString().notEmpty(),
  body('lhr').isObject(), // Lighthouse report object
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { runId, url, branch, commit, lhr } = req.body;

    // Extract scores and metrics from Lighthouse report
    const scores = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
    };

    const metrics = {
      firstContentfulPaint: lhr.audits['first-contentful-paint']?.numericValue || 0,
      largestContentfulPaint: lhr.audits['largest-contentful-paint']?.numericValue || 0,
      cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.numericValue || 0,
      totalBlockingTime: lhr.audits['total-blocking-time']?.numericValue || 0,
      speedIndex: lhr.audits['speed-index']?.numericValue || 0,
      timeToInteractive: lhr.audits['interactive']?.numericValue || 0,
    };

    const result = await lighthouseCIService.storeLighthouseResult({
      url,
      runId,
      branch,
      commit,
      workspaceId: req.body.workspaceId || 'default', // Provide default workspaceId
      scores,
      metrics,
      budgetStatus: {}, // Will be calculated by the service
      reportUrl: req.body.reportUrl,
      rawResult: lhr,
    });

    res.status(201).json({
      success: true,
      message: 'Lighthouse webhook processed successfully',
      result: {
        runId: result.runId,
        budgetStatus: result.budgetStatus,
      },
    });

  } catch (error) {
    console.error('Error processing Lighthouse webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
