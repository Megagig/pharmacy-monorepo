import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { Workplace } from '../models/Workplace';
import PatientUser from '../models/PatientUser';
import FollowUpTask from '../models/FollowUpTask';
import logger from '../utils/logger';

interface WorkspacePortalStats {
  workspaceId: string;
  workspaceName: string;
  workspaceType: string;
  workspaceEmail: string;
  totalPatients: number;
  activePatients: number;
  pendingApprovals: number;
  pendingRefills: number;
  suspendedPatients: number;
  patientPortalEnabled: boolean;
}

/**
 * Super Admin Patient Portal Controller
 * Provides super admin oversight of patient portals across all workspaces
 */
class SuperAdminPatientPortalController {
  /**
   * Get all workspaces with patient portal statistics
   * GET /api/super-admin/patient-portal/workspaces
   * 
   * @description Returns a list of all workspaces with patient portal enabled,
   * along with aggregated statistics for each workspace
   * @access Private - Super Admin Only
   */
  async getWorkspacesWithPortalStats(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      // Verify super admin role (redundant check, but good for security)
      if (req.user?.role !== 'super_admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied. Super admin role required.',
        });
        return;
      }

      const { search, sortBy = 'workspaceName', sortOrder = 'asc' } = req.query;

      // Build query for workspaces
      // Show all verified workspaces - they can enable patient portal later
      // Handle workspaces without isDeleted field (created before field was added)
      const workspaceQuery: any = {
        verificationStatus: 'verified',
        $or: [
          { isDeleted: false },
          { isDeleted: { $exists: false } }, // Handle legacy workspaces
        ],
      };

      // Add search functionality
      if (search) {
        workspaceQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { type: { $regex: search, $options: 'i' } },
        ];
      }

      // Get all verified workspaces
      const workspaces = await Workplace.find(workspaceQuery)
        .select('_id name type email patientPortalEnabled')
        .lean();

      logger.info('Super admin retrieving workspace portal statistics', {
        userId: req.user._id,
        workspaceCount: workspaces.length,
        hasSearch: !!search,
      });

      // Get statistics for each workspace in parallel
      const workspaceStats = await Promise.all(
        workspaces.map(async (workspace) => {
          try {
            const [
              totalPatients,
              activePatients,
              pendingApprovals,
              suspendedPatients,
              pendingRefills,
            ] = await Promise.all([
              // Total patients
              PatientUser.countDocuments({
                workspaceId: workspace._id,
                isDeleted: false,
              }),
              // Active patients
              PatientUser.countDocuments({
                workspaceId: workspace._id,
                status: 'active',
                isActive: true,
                isDeleted: false,
              }),
              // Pending approvals
              PatientUser.countDocuments({
                workspaceId: workspace._id,
                status: 'pending',
                isDeleted: false,
              }),
              // Suspended patients
              PatientUser.countDocuments({
                workspaceId: workspace._id,
                status: 'suspended',
                isDeleted: false,
              }),
              // Pending refill requests
              FollowUpTask.countDocuments({
                workplaceId: workspace._id,
                followUpType: 'refill_request',
                status: 'pending',
                isDeleted: false,
              }),
            ]);

            return {
              workspaceId: workspace._id.toString(),
              workspaceName: workspace.name,
              workspaceType: workspace.type,
              workspaceEmail: workspace.email,
              totalPatients,
              activePatients,
              pendingApprovals,
              suspendedPatients,
              pendingRefills,
              patientPortalEnabled: workspace.patientPortalEnabled ?? true, // Default to true if not set
            } as WorkspacePortalStats;
          } catch (error: any) {
            logger.error('Error getting stats for workspace', {
              workspaceId: workspace._id,
              error: error.message,
            });
            // Return workspace with zero stats on error
            return {
              workspaceId: workspace._id.toString(),
              workspaceName: workspace.name,
              workspaceType: workspace.type,
              workspaceEmail: workspace.email,
              totalPatients: 0,
              activePatients: 0,
              pendingApprovals: 0,
              suspendedPatients: 0,
              pendingRefills: 0,
              patientPortalEnabled: workspace.patientPortalEnabled ?? true, // Default to true if not set
            } as WorkspacePortalStats;
          }
        })
      );

      // Sort the results
      const sortedStats = workspaceStats.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case 'totalPatients':
            aValue = a.totalPatients;
            bValue = b.totalPatients;
            break;
          case 'activePatients':
            aValue = a.activePatients;
            bValue = b.activePatients;
            break;
          case 'pendingApprovals':
            aValue = a.pendingApprovals;
            bValue = b.pendingApprovals;
            break;
          case 'pendingRefills':
            aValue = a.pendingRefills;
            bValue = b.pendingRefills;
            break;
          case 'workspaceType':
            aValue = a.workspaceType;
            bValue = b.workspaceType;
            break;
          case 'workspaceName':
          default:
            aValue = a.workspaceName;
            bValue = b.workspaceName;
            break;
        }

        if (typeof aValue === 'string') {
          return sortOrder === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });

      // Calculate summary statistics
      const summary = {
        totalWorkspaces: sortedStats.length,
        totalPatientsAcrossAll: sortedStats.reduce((sum, ws) => sum + ws.totalPatients, 0),
        totalActivePatients: sortedStats.reduce((sum, ws) => sum + ws.activePatients, 0),
        totalPendingApprovals: sortedStats.reduce((sum, ws) => sum + ws.pendingApprovals, 0),
        totalPendingRefills: sortedStats.reduce((sum, ws) => sum + ws.pendingRefills, 0),
      };

      logger.info('Super admin workspace portal statistics retrieved successfully', {
        userId: req.user._id,
        workspaceCount: sortedStats.length,
        summary,
      });

      res.json({
        success: true,
        data: sortedStats,
        summary,
        message: 'Workspace portal statistics retrieved successfully',
      });
    } catch (error: any) {
      logger.error('Error retrieving workspace portal statistics', {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id,
      });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve workspace portal statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * Get patient portal data for a specific workspace (super admin view)
   * GET /api/super-admin/patient-portal/workspace/:workspaceId
   * 
   * @description Returns detailed patient portal information for a specific workspace
   * allowing super admin to drill down into workspace-specific data
   * @access Private - Super Admin Only
   */
  async getWorkspacePortalDetails(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      // Verify super admin role
      if (req.user?.role !== 'super_admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied. Super admin role required.',
        });
        return;
      }

      const { workspaceId } = req.params;

      // Verify workspace exists
      // Handle workspaces without isDeleted field (legacy workspaces)
      const workspace = await Workplace.findOne({
        _id: workspaceId,
        $or: [
          { isDeleted: false },
          { isDeleted: { $exists: false } },
        ],
      }).select('_id name type email patientPortalEnabled verificationStatus');

      if (!workspace) {
        res.status(404).json({
          success: false,
          message: 'Workspace not found or patient portal not enabled',
        });
        return;
      }

      // Get detailed statistics
      const [
        totalPatients,
        activePatients,
        pendingApprovals,
        suspendedPatients,
        recentPatients,
        pendingRefills,
      ] = await Promise.all([
        PatientUser.countDocuments({
          workspaceId: workspace._id,
          isDeleted: false,
        }),
        PatientUser.countDocuments({
          workspaceId: workspace._id,
          status: 'active',
          isActive: true,
          isDeleted: false,
        }),
        PatientUser.countDocuments({
          workspaceId: workspace._id,
          status: 'pending',
          isDeleted: false,
        }),
        PatientUser.countDocuments({
          workspaceId: workspace._id,
          status: 'suspended',
          isDeleted: false,
        }),
        PatientUser.find({
          workspaceId: workspace._id,
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('firstName lastName email status createdAt')
          .lean(),
        FollowUpTask.countDocuments({
          workplaceId: workspace._id,
          followUpType: 'refill_request',
          status: 'pending',
          isDeleted: false,
        }),
      ]);

      logger.info('Super admin retrieved workspace portal details', {
        userId: req.user._id,
        workspaceId: workspace._id,
        totalPatients,
      });

      res.json({
        success: true,
        data: {
          workspace: {
            id: workspace._id,
            name: workspace.name,
            type: workspace.type,
            email: workspace.email,
            patientPortalEnabled: workspace.patientPortalEnabled,
            verificationStatus: workspace.verificationStatus,
          },
          statistics: {
            totalPatients,
            activePatients,
            pendingApprovals,
            suspendedPatients,
            pendingRefills,
          },
          recentPatients: recentPatients.map((patient: any) => ({
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`,
            email: patient.email,
            status: patient.status,
            joinedDate: patient.createdAt,
          })),
        },
        message: 'Workspace portal details retrieved successfully',
      });
    } catch (error: any) {
      logger.error('Error retrieving workspace portal details', {
        error: error.message,
        stack: error.stack,
        workspaceId: req.params.workspaceId,
        userId: req.user?._id,
      });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve workspace portal details',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
}

export default new SuperAdminPatientPortalController();
