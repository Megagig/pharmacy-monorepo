import express from 'express';
import { auth } from '../middlewares/auth';
import rbac from '../middlewares/rbac';
import {
    getCriticalAlerts,
    acknowledgeAlert,
    dismissAlert,
    triggerCriticalAlert,
    triggerAIInterpretationComplete,
    triggerPatientResultNotification,
    getNotificationPreferences,
    updateNotificationPreferences,
    getNotificationStatistics,
    sendTestNotification,
    getNotificationDeliveryStatus,
    retryFailedNotifications,
} from '../controllers/manualLabNotificationController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Critical Alerts Routes
router.get('/alerts', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), getCriticalAlerts);
router.post('/alerts/:alertId/acknowledge', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), acknowledgeAlert);
router.post('/alerts/:alertId/dismiss', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), dismissAlert);

// Notification Trigger Routes
router.post('/trigger-alert', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), triggerCriticalAlert);
router.post('/ai-complete', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), triggerAIInterpretationComplete);
router.post('/patient-result', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), triggerPatientResultNotification);

// Preferences Routes
router.get('/preferences', getNotificationPreferences);
router.put('/preferences', updateNotificationPreferences);

// Statistics Routes
router.get('/stats', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), getNotificationStatistics);

// Test Notification Routes
router.post('/test', sendTestNotification);

// Delivery Tracking Routes
router.get('/delivery/:orderId', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), getNotificationDeliveryStatus);
router.post('/delivery/:orderId/retry', rbac.requireRole('pharmacist', 'super_admin'), rbac.requireWorkplaceRole('Owner'), retryFailedNotifications);

export default router;