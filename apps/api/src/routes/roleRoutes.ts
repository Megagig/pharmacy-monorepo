import express from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { requireDynamicPermission, requireWorkspaceOwner } from '../middlewares/rbac';
import { roleController } from '../controllers/roleController';

const router = express.Router();

// All role management routes require authentication
router.use(auth);

// Allow both super admins and workspace owners to access role management
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
            message: 'Access denied. Only super admins and workspace owners can manage roles.'
        });
    }
});

// Role CRUD operations - Super admin has full access without dynamic permission checks
router.post('/', roleController.createRole.bind(roleController));
router.get('/', roleController.getRoles.bind(roleController));
router.get('/:id', roleController.getRoleById.bind(roleController));
router.put('/:id', roleController.updateRole.bind(roleController));
router.delete('/:id', roleController.deleteRole.bind(roleController));

// Role permissions
router.get('/:id/permissions', roleController.getRolePermissions.bind(roleController));

export default router;