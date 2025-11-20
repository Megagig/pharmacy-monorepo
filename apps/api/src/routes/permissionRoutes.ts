import express from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { requireDynamicPermission } from '../middlewares/rbac';
import { permissionController } from '../controllers/permissionController';

const router = express.Router();

// All permission management routes require authentication
router.use(auth);

// Allow both super admins and workspace owners to access permission management
// Super admins get system-wide access, workspace owners get workspace-scoped access
router.use((req, res, next) => {
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin';
    const isWorkspaceOwner = user?.role === 'pharmacy_outlet';
    
    if (isSuperAdmin || isWorkspaceOwner) {
        // For workspace owners, automatically apply workspace filtering
        if (isWorkspaceOwner && user?.workplaceId) {
            // Add workspace context to query parameters for GET requests
            if (req.method === 'GET') {
                req.query.workspaceId = user.workplaceId;
            }
            // Add workspace context to body for POST/PUT requests
            if (req.method === 'POST' || req.method === 'PUT') {
                req.body.workspaceId = user.workplaceId;
            }
        }
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied. Only super admins and workspace owners can manage permissions.'
        });
    }
});

// Permission CRUD operations - Super admin has full access
router.get('/', permissionController.getPermissions);
router.get('/matrix', permissionController.getPermissionMatrix);
router.post('/', permissionController.createPermission);
router.put('/:action', permissionController.updatePermission);

// Permission categorization and analysis
router.get('/categories', permissionController.getPermissionCategories);
router.get('/dependencies', permissionController.getPermissionDependencies);

// Permission usage and validation
router.get('/:action/usage', permissionController.getPermissionUsage);
router.post('/validate', permissionController.validatePermissions);

export default router;