import express from 'express';
import { subscriptionController } from '../controllers/subscriptionController';
import { auth, authOptionalSubscription } from '../middlewares/auth';

const router = express.Router();

router.get(
  '/plans',
  subscriptionController.getAvailablePlans.bind(subscriptionController)
);
router.get(
  '/',
  authOptionalSubscription, // Allow access even without active subscription
  subscriptionController.getCurrentSubscription.bind(subscriptionController)
);
router.get(
  '/status',
  authOptionalSubscription, // Allow access even without active subscription
  subscriptionController.getSubscriptionStatus.bind(subscriptionController)
);
router.get(
  '/verify-payment',
  subscriptionController.verifyPaymentByReference.bind(subscriptionController)
);
router.get(
  '/analytics',
  auth,
  subscriptionController.getSubscriptionAnalytics.bind(subscriptionController)
);
router.post(
  '/checkout',
  authOptionalSubscription, // Allow access even without active subscription
  subscriptionController.createCheckoutSession.bind(subscriptionController)
);
router.post(
  '/success',
  authOptionalSubscription, // Allow access even without active subscription
  subscriptionController.handleSuccessfulPayment.bind(subscriptionController)
);
router.post(
  '/cancel',
  auth,
  subscriptionController.cancelSubscription.bind(subscriptionController)
);
router.post(
  '/upgrade',
  auth,
  subscriptionController.upgradeSubscription.bind(subscriptionController)
);
router.post(
  '/downgrade',
  auth,
  subscriptionController.downgradeSubscription.bind(subscriptionController)
);
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleWebhook.bind(subscriptionController)
);

export default router;
