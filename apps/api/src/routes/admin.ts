import { Router } from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { adminController } from '../controllers/adminController';
import { userRoleController } from '../controllers/userRoleController';

const router = Router();

// Apply authentication and authorization middleware to all routes
router.use(auth);
router.use(requireSuperAdmin);

// User management routes
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserById);
router.put('/users/:userId/role', adminController.updateUserRole);
router.post('/users/:userId/suspend', adminController.suspendUser);
router.post('/users/:userId/reactivate', adminController.reactivateUser);
router.post('/users/bulk-assign-roles', adminController.bulkAssignRoles);
router.post('/users/bulk-revoke-roles', adminController.bulkRevokeRoles);

// User role management routes
router.get('/users/:id/roles', userRoleController.getUserRoles.bind(userRoleController));
router.post('/users/assign-roles', userRoleController.assignUserRoles.bind(userRoleController));
router.delete('/users/:id/roles/:roleId', userRoleController.revokeUserRole.bind(userRoleController));
router.put('/users/:id/permissions', userRoleController.updateUserPermissions.bind(userRoleController));
router.get(
  '/users/:id/effective-permissions',
  userRoleController.getUserEffectivePermissions.bind(userRoleController)
);
router.post('/users/bulk-update', userRoleController.bulkUpdateUsers.bind(userRoleController));
router.post(
  '/users/:id/check-permission',
  userRoleController.checkUserPermission.bind(userRoleController)
);
router.post(
  '/users/:id/preview-permissions',
  userRoleController.previewPermissionChanges.bind(userRoleController)
);
router.post(
  '/users/:id/detect-conflicts',
  userRoleController.detectRoleConflicts.bind(userRoleController)
);
router.post(
  '/users/:id/resolve-conflicts',
  userRoleController.resolveRoleConflicts.bind(userRoleController)
);
router.post(
  '/users/:id/refresh-cache',
  userRoleController.refreshUserPermissionCache.bind(userRoleController)
);

// Role management routes
router.get('/roles', adminController.getAllRoles);

// Permission management routes
router.get('/permissions', adminController.getAllPermissions);

// License management routes
router.get('/licenses/pending', adminController.getPendingLicenses);
router.post('/licenses/:userId/approve', adminController.approveLicense);
router.post('/licenses/:userId/reject', adminController.rejectLicense);

// Feature flag management routes
router.get('/feature-flags', adminController.getAllFeatureFlags);
router.post('/feature-flags', adminController.createFeatureFlag);
router.put('/feature-flags/:flagId', adminController.updateFeatureFlag);

// System analytics routes
router.get('/analytics', adminController.getSystemAnalytics);

// System statistics routes
router.get('/statistics', adminController.getSystemStatistics);

// Audit log routes
router.get('/audit-logs', adminController.getAuditLogs);

// System health routes
router.get('/system-health', adminController.getSystemHealth);

// System configuration routes
router.get('/system-config', adminController.getSystemConfig);
router.put('/system-config', adminController.updateSystemConfig);

// Activity log routes
router.get('/activity-logs', adminController.getActivityLogs);

// Notification routes
router.get('/notifications', adminController.getSystemNotifications);
router.put('/notifications/:id/read', adminController.markNotificationAsRead);
router.put(
  '/notifications/read-all',
  adminController.markAllNotificationsAsRead
);
router.delete('/notifications/:id', adminController.deleteNotification);

// Backup management routes
router.get('/backup-status', adminController.getBackupStatus);
router.post('/create-backup', adminController.createBackup);

// Security settings routes
router.get('/security-settings', adminController.getSecuritySettings);
router.put('/security-settings', adminController.updateSecuritySettings);

// Maintenance status routes
router.get('/maintenance-status', adminController.getMaintenanceStatus);
router.put('/maintenance-status', adminController.updateMaintenanceStatus);

// API key management routes
router.get('/api-keys', adminController.getApiKeys);
router.post('/api-keys', adminController.createApiKey);
router.delete('/api-keys/:id', adminController.revokeApiKey);

export default router;
