import express from 'express';
import { subscriptionManagementController } from '../controllers/subscriptionManagementController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission } from '../middlewares/rbac';
import { subscriptionRateLimiters } from '../middlewares/rateLimiting';

const router = express.Router();

// Get workspace subscription details
router.get(
    '/workspace/:workspaceId',
    authWithWorkspace,
    subscriptionManagementController.getWorkspaceSubscription.bind(subscriptionManagementController)
);

// Create trial subscription for new workspace
router.post(
    '/workspace/trial',
    authWithWorkspace,
    requirePermission('subscription.manage'),
    subscriptionManagementController.createTrialSubscription.bind(subscriptionManagementController)
);

// Update subscription status (admin only)
router.patch(
    '/workspace/:workspaceId/status',
    authWithWorkspace,
    requirePermission('subscription.admin'),
    subscriptionManagementController.updateSubscriptionStatus.bind(subscriptionManagementController)
);

// Create workspace subscription checkout session
router.post(
    '/workspace/checkout',
    subscriptionRateLimiters.subscriptionChange,
    subscriptionRateLimiters.subscriptionChangeUser,
    authWithWorkspace,
    requirePermission('subscription.manage'),
    subscriptionManagementController.createWorkspaceCheckout.bind(subscriptionManagementController)
);

// Handle successful workspace subscription payment
router.post(
    '/workspace/payment/success',
    subscriptionRateLimiters.paymentAttempt,
    authWithWorkspace,
    subscriptionManagementController.handleWorkspacePaymentSuccess.bind(subscriptionManagementController)
);

// Upgrade workspace subscription
router.post(
    '/workspace/upgrade',
    subscriptionRateLimiters.subscriptionChange,
    subscriptionRateLimiters.subscriptionChangeUser,
    authWithWorkspace,
    requirePermission('subscription.manage'),
    subscriptionManagementController.upgradeWorkspaceSubscription.bind(subscriptionManagementController)
);

// Downgrade workspace subscription
router.post(
    '/workspace/downgrade',
    subscriptionRateLimiters.subscriptionChange,
    subscriptionRateLimiters.subscriptionChangeUser,
    authWithWorkspace,
    requirePermission('subscription.manage'),
    subscriptionManagementController.downgradeWorkspaceSubscription.bind(subscriptionManagementController)
);

// Cancel scheduled downgrade
router.delete(
    '/workspace/:workspaceId/downgrade',
    authWithWorkspace,
    requirePermission('subscription.manage'),
    subscriptionManagementController.cancelScheduledDowngrade.bind(subscriptionManagementController)
);

// Handle successful upgrade payment
router.post(
    '/workspace/upgrade/payment/success',
    subscriptionRateLimiters.paymentAttempt,
    authWithWorkspace,
    subscriptionManagementController.handleUpgradePaymentSuccess.bind(subscriptionManagementController)
);

// Trial and expiry management
router.get(
    '/workspace/:workspaceId/trial/check',
    authWithWorkspace,
    subscriptionManagementController.checkTrialExpiry.bind(subscriptionManagementController)
);

router.post(
    '/workspace/trial/extend',
    authWithWorkspace,
    requirePermission('subscription.admin'),
    subscriptionManagementController.extendTrialPeriod.bind(subscriptionManagementController)
);

router.post(
    '/workspace/expiry/handle',
    authWithWorkspace,
    requirePermission('subscription.admin'),
    subscriptionManagementController.handleSubscriptionExpiry.bind(subscriptionManagementController)
);

router.post(
    '/workspace/:workspaceId/paywall/enable',
    authWithWorkspace,
    subscriptionManagementController.enablePaywallMode.bind(subscriptionManagementController)
);

router.get(
    '/workspace/:workspaceId/status',
    authWithWorkspace,
    subscriptionManagementController.getSubscriptionStatus.bind(subscriptionManagementController)
);

export default router;