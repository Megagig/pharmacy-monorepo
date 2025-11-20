import { Router } from 'express';
import mongoose from 'mongoose';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requireWorkspaceOwner } from '../middlewares/rbac';
import { roleController } from '../controllers/roleController';
import { permissionController } from '../controllers/permissionController';
import { userRoleController } from '../controllers/userRoleController';
import User from '../models/User';
import Role from '../models/Role';
import Permission from '../models/Permission';
import UserRole from '../models/UserRole';
import WorkspaceAuditLog from '../models/WorkspaceAuditLog';

const router = Router();

// All workspace RBAC routes require workspace authentication and owner permissions
router.use(authWithWorkspace);
router.use(requireWorkspaceOwner);

// ==================== ROLE MANAGEMENT ====================

// Get all workspace roles
router.get('/roles', async (req: any, res) => {
    try {
        // Show all roles (system + workspace-specific) for workspace owners
        // System roles can be cloned/used as templates
        req.query.workspaceId = req.workplaceId;
        // Don't filter by category - show both system and workplace roles
        // req.query.category = 'workplace';
        return roleController.getRoles(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching workspace roles',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get single role
router.get('/roles/:id', async (req: any, res) => {
    try {
        return roleController.getRoleById(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Create new role
router.post('/roles', async (req: any, res) => {
    try {
        req.body.workspaceId = req.workplaceId;
        req.body.category = 'workplace';
        return roleController.createRole(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Update role
router.put('/roles/:id', async (req: any, res) => {
    try {
        return roleController.updateRole(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Delete role
router.delete('/roles/:id', async (req: any, res) => {
    try {
        return roleController.deleteRole(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Clone role
router.post('/roles/:roleId/clone', async (req: any, res) => {
    try {
        req.body.workspaceId = req.workplaceId;
        return roleController.cloneRole(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error cloning role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ==================== PERMISSION MANAGEMENT ====================

// Get all permissions
router.get('/permissions', async (req: any, res) => {
    try {
        return permissionController.getPermissions(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching permissions',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get permission matrix for a role
router.get('/permission-matrix', async (req: any, res) => {
    try {
        return permissionController.getPermissionMatrix(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching permission matrix',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get permission usage analytics
router.get('/permissions/usage-analytics', async (req: any, res) => {
    try {
        // This is a placeholder - you can expand with actual analytics
        res.json({
            success: true,
            data: {
                mostUsedPermissions: [],
                leastUsedPermissions: [],
                totalAnalyzed: 0,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching permission usage analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get permission categories with grouped permissions
router.get('/permissions/categories', async (req: any, res) => {
    try {
        // Get all permissions grouped by category
        const permissions = await Permission.find({ isActive: true });

        // Group permissions by category
        const categoriesMap: Record<string, any[]> = {};
        permissions.forEach((perm: any) => {
            const category = perm.category || 'general';
            if (!categoriesMap[category]) {
                categoriesMap[category] = [];
            }
            categoriesMap[category].push({
                _id: perm._id,
                action: perm.action,
                displayName: perm.displayName,
                description: perm.description,
                category: perm.category,
                riskLevel: perm.riskLevel,
                dependsOn: perm.dependsOn || [],
                conflicts: perm.conflicts || [],
            });
        });

        // Convert to array format
        const categories = Object.keys(categoriesMap).map(categoryName => ({
            name: categoryName,
            displayName: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
            permissions: categoriesMap[categoryName],
        }));

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching permission categories',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ==================== TEAM MEMBER ROLE ASSIGNMENT ====================

// Get workspace team members with their roles
router.get('/team-members', async (req: any, res) => {
    try {
        const workplaceId = req.workplaceId;

        // Find all users in this workspace
        const teamMembers = await User.find({
            workplaceId,
            isActive: true,
        }).select('firstName lastName email role workplaceRole status');

        // Get their assigned roles
        const membersWithRoles = await Promise.all(
            teamMembers.map(async (member: any) => {
                const userRoles = await UserRole.find({
                    userId: member._id,
                    workspaceId: workplaceId,
                    isActive: true,
                }).populate('roleId');

                return {
                    ...member.toObject(),
                    assignedRoles: userRoles.map((ur: any) => ur.roleId),
                };
            })
        );

        res.json({
            success: true,
            data: {
                teamMembers: membersWithRoles,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching team members',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Assign role to team member
router.post('/team-members/:userId/assign-role', async (req: any, res) => {
    try {
        const { userId } = req.params;
        const { roleId, reason } = req.body;
        const workplaceId = req.workplaceId;
        const actorId = req.user._id;

        // Check if user exists in workspace
        const user = await User.findOne({ _id: userId, workplaceId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found in this workspace',
            });
        }

        // Check if role exists
        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found',
            });
        }

        // Check if already assigned
        const existingAssignment = await UserRole.findOne({
            userId,
            roleId,
            workspaceId: workplaceId,
            isActive: true,
        });

        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                message: 'Role already assigned to this user',
            });
        }

        // Create role assignment
        const userRole = await UserRole.create({
            userId,
            roleId,
            workspaceId: workplaceId,
            isTemporary: false,
            isActive: true,
            assignedBy: actorId,
            assignedAt: new Date(),
            lastModifiedBy: actorId,
            assignmentReason: reason || 'Role assigned by workspace owner',
        });

        // Update user's assignedRoles array
        if (!user.assignedRoles.includes(roleId)) {
            user.assignedRoles.push(roleId);
            user.roleLastModifiedAt = new Date();
            user.roleLastModifiedBy = actorId;
            await user.save();
        }

        // Log audit trail
        await WorkspaceAuditLog.create({
            workspaceId: workplaceId,
            actorId,
            targetId: userId,
            action: 'role_assigned',
            category: 'member',
            details: {
                roleId,
                roleName: role.displayName,
                reason,
            },
            severity: 'medium',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            message: 'Role assigned successfully',
            data: { userRole },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error assigning role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Revoke role from team member
router.delete('/team-members/:userId/roles/:roleId', async (req: any, res) => {
    try {
        const { userId, roleId } = req.params;
        const workplaceId = req.workplaceId;
        const actorId = req.user._id;

        // Find and deactivate the role assignment
        const userRole = await UserRole.findOne({
            userId,
            roleId,
            workspaceId: workplaceId,
            isActive: true,
        });

        if (!userRole) {
            return res.status(404).json({
                success: false,
                message: 'Role assignment not found',
            });
        }

        userRole.isActive = false;
        userRole.revokedBy = actorId;
        userRole.revokedAt = new Date();
        userRole.lastModifiedBy = actorId;
        await userRole.save();

        // Remove from user's assignedRoles array
        const user = await User.findById(userId);
        if (user) {
            user.assignedRoles = user.assignedRoles.filter(
                (id) => id.toString() !== roleId
            );
            user.roleLastModifiedAt = new Date();
            user.roleLastModifiedBy = actorId;
            await user.save();
        }

        // Get role details for audit
        const role = await Role.findById(roleId);

        // Log audit trail
        await WorkspaceAuditLog.create({
            workspaceId: workplaceId,
            actorId,
            targetId: userId,
            action: 'role_revoked',
            category: 'member',
            details: {
                roleId,
                roleName: role?.displayName,
            },
            severity: 'medium',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            message: 'Role revoked successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error revoking role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get team member's effective permissions
router.get('/team-members/:userId/permissions', async (req: any, res) => {
    try {
        const { userId } = req.params;
        const workplaceId = req.workplaceId;

        // Get all active roles for this user in this workspace
        const userRoles = await UserRole.find({
            userId,
            workspaceId: workplaceId,
            isActive: true,
        }).populate('roleId');

        // Collect all permissions from all roles
        const permissionsSet = new Set<string>();
        userRoles.forEach((ur: any) => {
            if (ur.roleId && ur.roleId.permissions) {
                ur.roleId.permissions.forEach((perm: string) => {
                    permissionsSet.add(perm);
                });
            }
        });

        res.json({
            success: true,
            data: {
                permissions: Array.from(permissionsSet),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching permissions',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ==================== AUDIT TRAIL ====================

// Get workspace RBAC audit logs
router.get('/audit-logs', async (req: any, res) => {
    try {
        const workplaceId = req.workplaceId;
        const { page = 1, limit = 20, category, action } = req.query;

        const query: any = { workspaceId: workplaceId };

        if (category) {
            query.category = category;
        }
        if (action) {
            query.action = action;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [logs, total] = await Promise.all([
            WorkspaceAuditLog.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('actorId', 'firstName lastName email')
                .populate('targetId', 'firstName lastName email')
                .lean(),
            WorkspaceAuditLog.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit)),
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching audit logs',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ==================== STATISTICS ====================

// Get RBAC statistics
router.get('/statistics', async (req: any, res) => {
    try {
        const workplaceId = req.workplaceId;

        // Count all roles accessible to this workspace (system + workspace-specific)
        const [totalRoles, activeRoles, customRoles, systemRoles, totalMembers] = await Promise.all([
            // All roles: system roles (no workspaceId) + workspace-specific roles
            Role.countDocuments({
                $or: [
                    { workspaceId: null, category: 'system' }, // System roles
                    { workspaceId: workplaceId }, // Workspace-specific roles
                ],
            }),
            Role.countDocuments({
                $or: [
                    { workspaceId: null, category: 'system', isActive: true },
                    { workspaceId: workplaceId, isActive: true },
                ],
            }),
            Role.countDocuments({ workspaceId: workplaceId }), // Custom workspace roles only
            Role.countDocuments({ category: 'system' }), // System roles
            User.countDocuments({ workplaceId: workplaceId, isActive: true }),
        ]);

        res.json({
            success: true,
            data: {
                totalRoles,
                activeRoles,
                customRoles,
                systemRoles,
                totalMembers,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
