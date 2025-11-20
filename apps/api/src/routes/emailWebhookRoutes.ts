import { Router } from 'express';
import { emailWebhookController } from '../controllers/emailWebhookController';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';

const router = Router();

// Webhook endpoints (no auth required)
router.post('/webhooks/resend', emailWebhookController.handleResendWebhook);
router.post('/webhooks/email', emailWebhookController.handleGenericWebhook);

// Admin endpoints (auth required)
router.get('/delivery/stats',
    auth,
    requirePermission('email.view_stats'),
    emailWebhookController.getDeliveryStats
);

router.get('/delivery/history',
    auth,
    requirePermission('email.view_history'),
    emailWebhookController.getDeliveryHistory
);

router.post('/delivery/:deliveryId/retry',
    auth,
    requirePermission('email.retry'),
    emailWebhookController.retryFailedEmail
);

export default router;