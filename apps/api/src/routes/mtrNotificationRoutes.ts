import express from 'express';
import {
    scheduleFollowUpReminder,
    sendCriticalAlert,
    checkOverdueFollowUps,
    updateNotificationPreferences,
    getNotificationPreferences,
    getNotificationStatistics,
    processPendingReminders,
    sendTestNotification,
    getFollowUpReminders,
    cancelScheduledReminder,
    checkDrugInteractions,
    notifyHighSeverityDTP
} from '../controllers/mtrNotificationController';
import { auth } from '../middlewares/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Follow-up reminder routes
router.post('/follow-up/:followUpId/reminder', scheduleFollowUpReminder);
router.get('/follow-up/:followUpId/reminders', getFollowUpReminders);
router.delete('/follow-up/:followUpId/reminder/:reminderId', cancelScheduledReminder);

// Critical alert routes
router.post('/alert/critical', sendCriticalAlert);
router.post('/alert/drug-interactions', checkDrugInteractions);
router.post('/alert/high-severity-dtp/:problemId', notifyHighSeverityDTP);

// System maintenance routes
router.post('/check-overdue', checkOverdueFollowUps);
router.post('/process-pending', processPendingReminders);

// User preference routes
router.get('/preferences', getNotificationPreferences);
router.put('/preferences', updateNotificationPreferences);

// Statistics and monitoring
router.get('/statistics', getNotificationStatistics);

// Testing routes
router.post('/test', sendTestNotification);

export default router;