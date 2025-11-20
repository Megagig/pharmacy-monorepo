import { Router } from 'express';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import superAdminPatientPortalController from '../controllers/superAdminPatientPortalController';

const router = Router();

/**
 * Super Admin Patient Portal Routes
 * Provides oversight and management capabilities for patient portals across all workspaces
 * 
 * All routes require super_admin role and are protected by authentication middleware
 */

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * @route   GET /api/super-admin/patient-portal/workspaces
 * @desc    Get all workspaces with patient portal statistics
 * @access  Private (Super Admin Only)
 * @query   search - Optional search term to filter workspaces
 * @query   sortBy - Field to sort by (workspaceName, totalPatients, etc.)
 * @query   sortOrder - Sort order (asc or desc)
 * 
 * @returns {Object} success - Success status
 * @returns {Array} data - Array of workspace portal statistics
 * @returns {Object} summary - Aggregated summary statistics across all workspaces
 * @returns {string} message - Success message
 * 
 * @example
 * GET /api/super-admin/patient-portal/workspaces?search=clinic&sortBy=totalPatients&sortOrder=desc
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "workspaceId": "507f1f77bcf86cd799439011",
 *       "workspaceName": "Downtown Clinic",
 *       "workspaceType": "clinic",
 *       "totalPatients": 150,
 *       "activePatients": 142,
 *       "pendingApprovals": 5,
 *       "pendingRefills": 12,
 *       "patientPortalEnabled": true
 *     }
 *   ],
 *   "summary": {
 *     "totalWorkspaces": 25,
 *     "totalPatientsAcrossAll": 3500,
 *     "totalActivePatients": 3200,
 *     "totalPendingApprovals": 85,
 *     "totalPendingRefills": 240
 *   }
 * }
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
 * @param   workspaceId - MongoDB ObjectId of the workspace
 * 
 * @returns {Object} success - Success status
 * @returns {Object} data - Detailed workspace portal information
 * @returns {Object} data.workspace - Workspace details
 * @returns {Object} data.statistics - Patient statistics for the workspace
 * @returns {Array} data.recentPatients - List of recently joined patients
 * @returns {string} message - Success message
 * 
 * @example
 * GET /api/super-admin/patient-portal/workspace/507f1f77bcf86cd799439011
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "workspace": {
 *       "id": "507f1f77bcf86cd799439011",
 *       "name": "Downtown Clinic",
 *       "type": "clinic",
 *       "email": "admin@downtownclinic.com",
 *       "patientPortalEnabled": true
 *     },
 *     "statistics": {
 *       "totalPatients": 150,
 *       "activePatients": 142,
 *       "pendingApprovals": 5,
 *       "suspendedPatients": 3,
 *       "pendingRefills": 12
 *     },
 *     "recentPatients": [...]
 *   }
 * }
 */
router.get(
  '/workspace/:workspaceId',
  superAdminPatientPortalController.getWorkspacePortalDetails.bind(
    superAdminPatientPortalController
  )
);

/**
 * Health check endpoint for super admin patient portal routes
 * Can be used to verify the routes are properly registered
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Super Admin Patient Portal API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
