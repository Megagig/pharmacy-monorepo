import express from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import superAdminPatientPortalController from '../controllers/superAdminPatientPortalController';

const router = express.Router();

/**
 * Super Admin Patient Portal Routes
 * Provides super admin oversight and management of patient portals across all workspaces
 * 
 * All routes require authentication and super_admin role
 */

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * @route   GET /api/super-admin/patient-portal/workspaces
 * @desc    Get all workspaces with patient portal statistics
 * @access  Private (Super Admin Only)
 * @query   search - Optional search term for workspace name, email, or type
 * @query   sortBy - Optional sort field (workspaceName, totalPatients, etc.)
 * @query   sortOrder - Optional sort order (asc/desc)
 */
router.get(
  '/workspaces',
  superAdminPatientPortalController.getWorkspacesWithPortalStats.bind(
    superAdminPatientPortalController
  )
);

/**
 * @route   GET /api/super-admin/patient-portal/workspace/:workspaceId
 * @desc    Get detailed patient portal data for a specific workspace
 * @access  Private (Super Admin Only)
 * @param   workspaceId - The ID of the workspace to retrieve details for
 */
router.get(
  '/workspace/:workspaceId',
  superAdminPatientPortalController.getWorkspacePortalDetails.bind(
    superAdminPatientPortalController
  )
);

export default router;
