import { Router } from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { userRoleController } from '../controllers/userRoleController';

const router = Router();

// Apply authentication middleware to all routes
router.use(auth as any);

// User role management routes - accessible by super admin and users with appropriate permissions
router.get('/users/:id/roles', userRoleController.getUserRoles as any);
router.get(
  '/users/:id/effective-permissions',
  userRoleController.getUserEffectivePermissions as any
);
router.post(
  '/users/:id/check-permission',
  userRoleController.checkUserPermission as any
);
router.post(
  '/users/:id/preview-permissions',
  userRoleController.previewPermissionChanges as any
);
router.post(
  '/users/:id/refresh-cache',
  userRoleController.refreshUserPermissionCache as any
);

// Admin-only routes
router.post(
  '/users/assign-roles',
  requireSuperAdmin as any,
  userRoleController.assignUserRoles as any
);
router.delete(
  '/users/:id/roles/:roleId',
  requireSuperAdmin as any,
  userRoleController.revokeUserRole as any
);
router.put(
  '/users/:id/permissions',
  requireSuperAdmin as any,
  userRoleController.updateUserPermissions as any
);
router.post(
  '/users/bulk-update',
  requireSuperAdmin as any,
  userRoleController.bulkUpdateUsers as any
);
router.post(
  '/users/:id/detect-conflicts',
  requireSuperAdmin as any,
  userRoleController.detectRoleConflicts as any
);
router.post(
  '/users/:id/resolve-conflicts',
  requireSuperAdmin as any,
  userRoleController.resolveRoleConflicts as any
);

export default router;
