import express from 'express';
import { body, validationResult, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { WebVitalsService } from '../services/WebVitalsService';

const router = express.Router();
const webVitalsService = new WebVitalsService();

// Rate limiting for analytics endpoints
const analyticsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many analytics requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(analyticsRateLimit);

// Web Vitals data collection endpoint
router.post('/web-vitals', [
  body('name').isIn(['FCP', 'LCP', 'CLS', 'FID', 'TTFB', 'INP']).withMessage('Invalid metric name'),
  body('value').isNumeric().withMessage('Value must be numeric'),
  body('id').isString().withMessage('ID must be a string'),
  body('timestamp').isNumeric().withMessage('Timestamp must be numeric'),
  body('url').isURL().withMessage('URL must be valid'),
  body('userAgent').isString().withMessage('User agent must be a string'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, value, id, timestamp, url, userAgent, connectionType } = req.body;

    // Store Web Vitals data using the service
    await webVitalsService.storeWebVitalsEntry({
      name,
      value,
      id,
      timestamp: new Date(timestamp),
      url,
      userAgent,
      connectionType,
      ip: req.ip,
      // Add user context if available
      userId: req.user?.id,
      workspaceId: req.user?.workspaceId,
    });

    res.status(200).json({ 
      success: true, 
      message: 'Web Vitals data received',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing Web Vitals data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Performance alerts endpoint
router.post('/alerts/performance', [
  body('type').isString().withMessage('Alert type is required'),
  body('metric').isString().withMessage('Metric name is required'),
  body('value').isNumeric().withMessage('Value must be numeric'),
  body('budget').isNumeric().withMessage('Budget must be numeric'),
  body('url').isURL().withMessage('URL must be valid'),
  body('timestamp').isNumeric().withMessage('Timestamp must be numeric'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, metric, value, budget, url, timestamp, userAgent, connectionType } = req.body;

    // Log performance alert
    console.warn('Performance Alert:', {
      type,
      metric,
      value,
      budget,
      url,
      timestamp: new Date(timestamp),
      userAgent,
      connectionType,
      ip: req.ip,
    });

    // Here you would typically:
    // 1. Send alert to monitoring system (e.g., PagerDuty, Slack)
    // 2. Store alert in database for tracking
    // 3. Trigger automated responses if needed

    res.status(200).json({ 
      success: true, 
      message: 'Performance alert received',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing performance alert:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get Web Vitals summary endpoint (for dashboard)
router.get('/web-vitals/summary', [
  query('period').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid period'),
  query('workspaceId').optional().isString(),
  query('url').optional().isURL(),
  query('deviceType').optional().isIn(['mobile', 'tablet', 'desktop']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = '24h', workspaceId, url, deviceType } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = workspaceId;
    if (url) filters.url = url;
    if (deviceType) filters.deviceType = deviceType;

    const summary = await webVitalsService.getWebVitalsSummary(
      period as '1h' | '24h' | '7d' | '30d',
      filters
    );

    res.json(summary);
  } catch (error) {
    console.error('Error getting Web Vitals summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get Web Vitals time series data
router.get('/web-vitals/timeseries', [
  query('metric').isIn(['FCP', 'LCP', 'CLS', 'FID', 'TTFB', 'INP']).withMessage('Invalid metric name'),
  query('period').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid period'),
  query('interval').optional().isIn(['1m', '5m', '1h', '1d']).withMessage('Invalid interval'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { metric, period = '24h', interval = '1h', workspaceId, url, deviceType } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = workspaceId;
    if (url) filters.url = url;
    if (deviceType) filters.deviceType = deviceType;

    const timeSeries = await webVitalsService.getWebVitalsTimeSeries(
      metric as string,
      period as '1h' | '24h' | '7d' | '30d',
      interval as '1m' | '5m' | '1h' | '1d',
      filters
    );

    res.json(timeSeries);
  } catch (error) {
    console.error('Error getting Web Vitals time series:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get performance regressions
router.get('/web-vitals/regressions', [
  query('metric').optional().isIn(['FCP', 'LCP', 'CLS', 'FID', 'TTFB', 'INP']),
  query('threshold').optional().isFloat({ min: 0, max: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { metric, threshold = 0.2 } = req.query;
    
    let regressions;
    if (metric) {
      regressions = await webVitalsService.detectRegressions(metric as string, Number(threshold));
    } else {
      // Check all metrics
      const metrics = ['FCP', 'LCP', 'CLS', 'FID', 'TTFB', 'INP'];
      const allRegressions = await Promise.all(
        metrics.map(m => webVitalsService.detectRegressions(m, Number(threshold)))
      );
      regressions = allRegressions.flat();
    }

    res.json({ regressions });
  } catch (error) {
    console.error('Error detecting regressions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;