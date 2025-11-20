import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware to check if user has an active subscription
 * Apply this only to routes that require an active subscription
 */
export const requireActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subscription = req.subscription;

    // Check subscription validity
    if (!subscription || (subscription.isExpired && subscription.isExpired())) {
      res.status(402).json({
        message: 'Subscription expired or not found.',
        requiresPayment: true,
        subscriptionStatus: subscription?.status || 'none',
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error checking subscription' });
  }
};
