/**
 * Example usage of requireWorkspaceOwner middleware
 * This file demonstrates how to use the middleware in real routes
 */

import express, { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { loadWorkspaceContext } from '../../middlewares/workspaceContext';
import { requireWorkspaceOwner } from '../../middlewares/rbac';
import { AuthRequest } from '../../types/auth';

const router = Router();

/**
 * Example 1: Basic usage for team management routes
 */
router.get('/api/workspace/team/members',
  auth,                      // Step 1: Authenticate user
  loadWorkspaceContext,      // Step 2: Load workspace context
  requireWorkspaceOwner,     // Step 3: Verify workspace ownership
  async (req: AuthRequest, res) => {
    // At this point:
    // - req.user is authenticated
    // - req.workspaceContext.workspace exists
    // - User is confirmed to be the workspace owner
    // - req.workplaceId is available for convenience

    const workplaceId = (req as any).workplaceId;
    
    // Safe to query workspace-specific data
    res.json({
      success: true,
      workplaceId: workplaceId.toString(),
      message: 'Access granted to workspace owner'
    });
  }
);

/**
 * Example 2: Protecting multiple routes with middleware chain
 */
const workspaceTeamRouter = Router();

// Apply middleware to all routes in this router
workspaceTeamRouter.use([
  auth,
  loadWorkspaceContext,
  requireWorkspaceOwner
]);

// All routes below are now protected
workspaceTeamRouter.get('/members', async (req: AuthRequest, res) => {
  const workplaceId = (req as any).workplaceId;
  res.json({ message: 'Get members', workplaceId });
});

workspaceTeamRouter.post('/invites', async (req: AuthRequest, res) => {
  const workplaceId = (req as any).workplaceId;
  res.json({ message: 'Create invite', workplaceId });
});

workspaceTeamRouter.put('/members/:id', async (req: AuthRequest, res) => {
  const workplaceId = (req as any).workplaceId;
  res.json({ message: 'Update member', workplaceId });
});

/**
 * Example 3: Conditional middleware application
 */
router.get('/api/workspace/settings',
  auth,
  loadWorkspaceContext,
  // Only require ownership for certain operations
  (req: AuthRequest, res, next) => {
    if (req.method === 'PUT' || req.method === 'DELETE') {
      return requireWorkspaceOwner(req, res, next);
    }
    next();
  },
  async (req: AuthRequest, res) => {
    res.json({ message: 'Workspace settings' });
  }
);

/**
 * Example 4: Error handling
 */
router.get('/api/workspace/team/audit',
  auth,
  loadWorkspaceContext,
  requireWorkspaceOwner,
  async (req: AuthRequest, res) => {
    try {
      const workplaceId = (req as any).workplaceId;
      
      // Your business logic here
      // The middleware ensures workplaceId is always available
      
      res.json({
        success: true,
        workplaceId: workplaceId.toString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * Example 5: Using workplaceId in service calls
 */
import User from '../../models/User';

router.get('/api/workspace/team/stats',
  auth,
  loadWorkspaceContext,
  requireWorkspaceOwner,
  async (req: AuthRequest, res) => {
    const workplaceId = (req as any).workplaceId;
    
    // Safe to query with workplaceId - guaranteed to be the user's workspace
    const memberCount = await User.countDocuments({ 
      workplaceId,
      status: 'active'
    });
    
    const pendingCount = await User.countDocuments({ 
      workplaceId,
      status: 'pending'
    });
    
    res.json({
      success: true,
      stats: {
        totalMembers: memberCount,
        pendingApprovals: pendingCount
      }
    });
  }
);

export default router;
