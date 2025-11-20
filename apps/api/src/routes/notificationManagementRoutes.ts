import express from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import {
  getNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  toggleNotificationRule,
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  getNotificationHistory,
  sendTestNotificationManagement,
} from '../controllers/notificationManagementController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Channels routes
router.get('/channels', requireRole('admin', 'super_admin'), getNotificationChannels);
router.post('/channels', requireRole('admin', 'super_admin'), createNotificationChannel);
router.put('/channels/:channelId', requireRole('admin', 'super_admin'), updateNotificationChannel);
router.delete('/channels/:channelId', requireRole('admin', 'super_admin'), deleteNotificationChannel);

// Rules routes
router.get('/rules', requireRole('admin', 'super_admin'), getNotificationRules);
router.post('/rules', requireRole('admin', 'super_admin'), createNotificationRule);
router.put('/rules/:ruleId', requireRole('admin', 'super_admin'), updateNotificationRule);
router.delete('/rules/:ruleId', requireRole('admin', 'super_admin'), deleteNotificationRule);
router.patch('/rules/:ruleId/toggle', requireRole('admin', 'super_admin'), toggleNotificationRule);

// Templates routes
router.get('/templates', requireRole('admin', 'super_admin'), getNotificationTemplates);
router.post('/templates', requireRole('admin', 'super_admin'), createNotificationTemplate);
router.put('/templates/:templateId', requireRole('admin', 'super_admin'), updateNotificationTemplate);
router.delete('/templates/:templateId', requireRole('admin', 'super_admin'), deleteNotificationTemplate);

// History routes
router.get('/history', requireRole('admin', 'super_admin'), getNotificationHistory);

// Test routes
router.post('/test', requireRole('admin', 'super_admin'), sendTestNotificationManagement);

export default router;
