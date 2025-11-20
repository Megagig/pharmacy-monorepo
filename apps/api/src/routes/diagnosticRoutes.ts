/**
 * Diagnostic Routes - FOR DEBUGGING ONLY
 * Remove in production!
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Check environment variables
 * GET /api/diagnostic/env-check
 */
router.get('/env-check', (req: Request, res: Response) => {
  const envCheck = {
    DISABLE_BACKGROUND_JOBS: {
      value: process.env.DISABLE_BACKGROUND_JOBS,
      type: typeof process.env.DISABLE_BACKGROUND_JOBS,
      isString: typeof process.env.DISABLE_BACKGROUND_JOBS === 'string',
      equalsTrue: process.env.DISABLE_BACKGROUND_JOBS === 'true',
      equalsTrueStrict: process.env.DISABLE_BACKGROUND_JOBS === 'true',
    },
    REDIS_URL: {
      exists: !!process.env.REDIS_URL,
      isEmpty: process.env.REDIS_URL === '',
      value: process.env.REDIS_URL ? '[REDACTED]' : undefined,
    },
    REDIS_HOST: {
      exists: !!process.env.REDIS_HOST,
      value: process.env.REDIS_HOST || undefined,
    },
    REDIS_PORT: {
      exists: !!process.env.REDIS_PORT,
      value: process.env.REDIS_PORT || undefined,
    },
    CACHE_PROVIDER: {
      value: process.env.CACHE_PROVIDER,
    },
  };

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    envCheck,
  });
});

export default router;
