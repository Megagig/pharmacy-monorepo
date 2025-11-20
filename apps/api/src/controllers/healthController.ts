import { Request, Response } from 'express';

/**
 * @desc    Get feature flag system status (health check endpoint)
 * @route   GET /api/feature-flags/health
 * @access  Public
 */
export const getFeatureFlagSystemStatus = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Feature flag system is operational',
      timestamp: new Date(),
      env: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error('Error checking feature flag system status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
