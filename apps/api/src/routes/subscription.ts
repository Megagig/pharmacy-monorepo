import express from 'express';
import { auth, authOptionalSubscription } from '../middlewares/auth';
import { subscriptionController } from '../controllers/subscriptionController';

const router = express.Router();

// Public webhook endpoint (no auth required)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleWebhook
);

// Subscription management routes - allow access even without active subscription
router.get(
  '/current',
  authOptionalSubscription,
  subscriptionController.getCurrentSubscription
);
router.get('/plans', subscriptionController.getAvailablePlans);
router.post(
  '/checkout',
  authOptionalSubscription,
  subscriptionController.createCheckoutSession
);
// Add a route specifically for handling Paystack redirects without requiring authentication
router.get('/verify', subscriptionController.verifyPaymentByReference);

router.post(
  '/confirm-payment',
  authOptionalSubscription,
  subscriptionController.handleSuccessfulPayment
);
router.post(
  '/payment-success',
  authOptionalSubscription,
  subscriptionController.handleSuccessfulPayment
);

// Routes that require active subscription
router.post('/cancel', auth, subscriptionController.cancelSubscription);
router.post('/upgrade', auth, subscriptionController.upgradeSubscription);
router.post('/downgrade', auth, subscriptionController.downgradeSubscription);

// Additional routes for subscription management
router.get('/billing-history', auth, subscriptionController.getBillingHistory);
router.get('/usage', auth, subscriptionController.getUsageMetrics);

export default router;
