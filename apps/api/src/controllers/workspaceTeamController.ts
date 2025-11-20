import { Response } from 'express';
import mongoose from 'mongoose';
import * as crypto from 'crypto';
import { AuthRequest } from '../middlewares/auth';
import { User } from '../models/User';
import { WorkspaceInvite } from '../models/WorkspaceInvite';
import { Workplace } from '../models/Workplace';
import { emailService } from '../utils/emailService';
import { workspaceAuditService } from '../services/workspaceAuditService';

/**
 * Workspace Team Management Controller
 * Handles member management operations for workspace owners
 */
class WorkspaceTeamController {
  /**
   * Get all members in the workspace with pagination and filters
   * @route GET /api/workspace/team/members
   */
  async getMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get workplaceId from authenticated user
      const workplaceId = req.user?.workplaceId || (req as any).workplaceId;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'No workspace associated with user',
        });
        return;
      }

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { workplaceId: new mongoose.Types.ObjectId(workplaceId) };

      // Apply search filter
      if (req.query.search) {
        const searchRegex = new RegExp(req.query.search as string, 'i');
        query.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
        ];
      }

      // Apply role filter
      if (req.query.role) {
        query.workplaceRole = req.query.role;
      }

      // Apply status filter
      if (req.query.status) {
        query.status = req.query.status;
      }

      // Get total count
      const total = await User.countDocuments(query);

      // Get members with pagination
      const members = await User.find(query)
        .select('-passwordHash -resetToken -verificationToken -verificationCode')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      // Format response
      const formattedMembers = members.map((member: any) => ({
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        workplaceRole: member.workplaceRole,
        status: member.status,
        joinedAt: member.createdAt,
        lastLoginAt: member.lastLoginAt,
        permissions: member.permissions || [],
        directPermissions: member.directPermissions || [],
      }));

      res.status(200).json({
        success: true,
        data: {
          members: formattedMembers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching workspace members:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch workspace members',
        error: error.message,
      });
    }
  }

  /**
   * Get workspace settings
   * @route GET /api/workspace/settings
   */
  async getWorkspaceSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const workplaceId = req.user?.workplaceId || (req as any).workplaceId;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'No workspace associated with user',
        });
        return;
      }

      // Get workspace details
      const workspace = await Workplace.findById(workplaceId)
        .select('name address phone email settings type licenseNumber state lga')
        .lean();

      if (!workspace) {
        res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: workspace._id,
          name: workspace.name,
          type: workspace.type,
          address: workspace.address,
          phone: workspace.phone,
          email: workspace.email,
          state: workspace.state,
          lga: workspace.lga,
          licenseNumber: workspace.licenseNumber,
          settings: workspace.settings || {
            maxPendingInvites: 20,
            allowSharedPatients: false,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching workspace settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch workspace settings',
        error: error.message,
      });
    }
  }

  /**
   * Get workspace statistics
   * @route GET /api/workspace/team/stats
   */
  async getWorkspaceStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get workplaceId from authenticated user
      const workplaceId = req.user?.workplaceId || (req as any).workplaceId;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'No workspace associated with user',
        });
        return;
      }

      // Get total members count
      const totalMembers = await User.countDocuments({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      // Get active members count
      const activeMembers = await User.countDocuments({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'active',
      });

      // Get pending approvals count
      const pendingApprovals = await WorkspaceInvite.countDocuments({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'pending',
        requiresApproval: true,
      });

      // Get active invites count
      const activeInvites = await WorkspaceInvite.countDocuments({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'pending',
        expiresAt: { $gt: new Date() },
      });

      res.status(200).json({
        success: true,
        data: {
          totalMembers,
          activeMembers,
          pendingApprovals,
          activeInvites,
        },
      });
    } catch (error: any) {
      console.error('Error fetching workspace stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch workspace statistics',
        error: error.message,
      });
    }
  }

  /**
   * Update member role
   * @route PUT /api/workspace/team/members/:id
   */
  async updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: memberId } = req.params;
      const { workplaceRole, reason } = req.body;
      const updatedBy = req.user?._id;

      // For super admins, get workplaceId from the member being updated
      let workplaceId = req.user?.workplaceId || (req as any).workplaceId;

      // If no workplaceId (e.g., super admin), find it from the member being updated
      if (!workplaceId) {
        const memberToUpdate = await User.findById(memberId).lean();
        if (!memberToUpdate) {
          res.status(404).json({
            success: false,
            message: 'Member not found',
          });
          return;
        }
        workplaceId = memberToUpdate.workplaceId;
      }

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'No workspace associated with user',
        });
        return;
      }

      // Validate workplaceRole
      const validRoles = ['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'];
      if (!validRoles.includes(workplaceRole)) {
        res.status(400).json({
          success: false,
          message: 'Invalid workplace role',
        });
        return;
      }

      // Find member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Member not found in this workspace',
        });
        return;
      }

      // Store old role for audit
      const oldRole = member.workplaceRole;

      // Update role
      member.workplaceRole = workplaceRole as any;
      member.roleLastModifiedBy = updatedBy;
      member.roleLastModifiedAt = new Date();
      await member.save();

      // Log the role change in audit trail
      await workspaceAuditService.logRoleAction(
        new mongoose.Types.ObjectId(workplaceId),
        updatedBy!,
        new mongoose.Types.ObjectId(memberId),
        'role_changed',
        {
          before: oldRole,
          after: workplaceRole,
          reason,
        },
        req
      );

      res.status(200).json({
        success: true,
        message: 'Member role updated successfully',
        member: {
          _id: member._id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          workplaceRole: member.workplaceRole,
          status: member.status,
        },
        audit: {
          oldRole,
          newRole: workplaceRole,
          reason,
          updatedBy,
          updatedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error updating member role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update member role',
        error: error.message,
      });
    }
  }

  /**
   * Remove member from workspace
   * @route DELETE /api/workspace/team/members/:id
   */
  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: memberId } = req.params;
      const { reason } = req.body;
      const workplaceId = (req as any).workplaceId;
      const removedBy = req.user?._id;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Find member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Member not found in this workspace',
        });
        return;
      }

      // Prevent removing workspace owner
      if (member.role === 'pharmacy_outlet') {
        res.status(403).json({
          success: false,
          message: 'Cannot remove workspace owner',
        });
        return;
      }

      // Store member info for audit
      const memberInfo = {
        email: member.email,
        name: `${member.firstName} ${member.lastName}`,
        role: member.workplaceRole,
      };

      // Remove workspace association
      member.workplaceId = undefined;
      member.workplaceRole = undefined;
      member.status = 'suspended';
      member.suspendedAt = new Date();
      member.suspendedBy = removedBy;
      member.suspensionReason = reason || 'Removed from workspace';
      await member.save();

      // Log the member removal in audit trail
      await workspaceAuditService.logMemberAction(
        new mongoose.Types.ObjectId(workplaceId),
        removedBy!,
        new mongoose.Types.ObjectId(memberId),
        'member_removed',
        {
          reason: reason || 'Removed from workspace',
          metadata: memberInfo,
        },
        req
      );

      res.status(200).json({
        success: true,
        message: 'Member removed from workspace successfully',
        audit: {
          memberId: member._id,
          memberEmail: member.email,
          reason,
          removedBy,
          removedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error removing member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove member',
        error: error.message,
      });
    }
  }

  /**
   * Suspend a member
   * @route POST /api/workspace/team/members/:id/suspend
   */
  async suspendMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: memberId } = req.params;
      const { reason } = req.body;
      const workplaceId = (req as any).workplaceId;
      const suspendedBy = req.user?._id;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Find member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Member not found in this workspace',
        });
        return;
      }

      // Prevent suspending workspace owner
      if (member.role === 'pharmacy_outlet') {
        res.status(403).json({
          success: false,
          message: 'Cannot suspend workspace owner',
        });
        return;
      }

      // Check if already suspended
      if (member.status === 'suspended') {
        res.status(400).json({
          success: false,
          message: 'Member is already suspended',
        });
        return;
      }

      // Update member status to suspended
      member.status = 'suspended';
      member.suspendedAt = new Date();
      member.suspendedBy = suspendedBy;
      member.suspensionReason = reason;
      await member.save();

      // Log the suspension in audit trail
      await workspaceAuditService.logMemberAction(
        new mongoose.Types.ObjectId(workplaceId),
        suspendedBy!,
        new mongoose.Types.ObjectId(memberId),
        'member_suspended',
        {
          reason,
          metadata: {
            email: member.email,
            name: `${member.firstName} ${member.lastName}`,
          },
        },
        req
      );

      // Get workspace name for email
      const workplace = await Workplace.findById(workplaceId);
      const workspaceName = workplace?.name || 'Workspace';

      // Send suspension notification email (don't block response)
      emailService
        .sendAccountSuspensionNotification(member.email, {
          firstName: member.firstName,
          workspaceName,
          reason,
          suspendedDate: new Date(),
        })
        .catch((error: any) => {
          console.error('Failed to send suspension notification email:', error);
        });

      res.status(200).json({
        success: true,
        message: 'Member suspended successfully',
        member: {
          _id: member._id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          status: member.status,
          suspendedAt: member.suspendedAt,
          suspensionReason: member.suspensionReason,
        },
        audit: {
          action: 'member_suspended',
          memberId: member._id,
          memberEmail: member.email,
          reason,
          suspendedBy,
          suspendedAt: member.suspendedAt,
        },
      });
    } catch (error: any) {
      console.error('Error suspending member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to suspend member',
        error: error.message,
      });
    }
  }

  /**
   * Get audit logs for the workspace
   * @route GET /api/workspace/team/audit
   */
  async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const workplaceId = (req as any).workplaceId;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Parse query parameters
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        actorId: req.query.actorId as string,
        targetId: req.query.targetId as string,
        category: req.query.category as string,
        action: req.query.action as string,
        severity: req.query.severity as string,
      };

      // Get audit logs
      const result = await workspaceAuditService.getAuditLogs(
        new mongoose.Types.ObjectId(workplaceId),
        filters
      );

      res.status(200).json({
        success: true,
        data: {
          logs: result.logs,
          pagination: result.pagination,
        },
      });
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit logs',
        error: error.message,
      });
    }
  }

  /**
   * Export audit logs to CSV
   * @route GET /api/workspace/team/audit/export
   */
  async exportAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const workplaceId = (req as any).workplaceId;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Parse query parameters
      const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        actorId: req.query.actorId as string,
        targetId: req.query.targetId as string,
        category: req.query.category as string,
        action: req.query.action as string,
        severity: req.query.severity as string,
      };

      // Export audit logs
      const csv = await workspaceAuditService.exportAuditLogs(
        new mongoose.Types.ObjectId(workplaceId),
        filters
      );

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="workspace-audit-logs-${Date.now()}.csv"`
      );

      res.status(200).send(csv);
    } catch (error: any) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export audit logs',
        error: error.message,
      });
    }
  }

  /**
   * Get audit statistics for the workspace
   * @route GET /api/workspace/team/audit/statistics
   */
  async getAuditStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const workplaceId = (req as any).workplaceId;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Parse date range if provided
      let dateRange;
      if (req.query.startDate && req.query.endDate) {
        dateRange = {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string),
        };
      }

      // Get statistics
      const statistics = await workspaceAuditService.getAuditStatistics(
        new mongoose.Types.ObjectId(workplaceId),
        dateRange
      );

      res.status(200).json({
        success: true,
        statistics,
      });
    } catch (error: any) {
      console.error('Error fetching audit statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit statistics',
        error: error.message,
      });
    }
  }

  /**
   * Activate a suspended member
   * @route POST /api/workspace/team/members/:id/activate
   */
  async activateMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: memberId } = req.params;
      const workplaceId = (req as any).workplaceId;
      const reactivatedBy = req.user?._id;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Find member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Member not found in this workspace',
        });
        return;
      }

      // Check if member is suspended
      if (member.status !== 'suspended') {
        res.status(400).json({
          success: false,
          message: 'Member is not suspended',
        });
        return;
      }

      // Store previous suspension info for audit
      const previousSuspensionReason = member.suspensionReason;
      const previousSuspendedAt = member.suspendedAt;

      // Reactivate member
      member.status = 'active';
      member.reactivatedAt = new Date();
      member.reactivatedBy = reactivatedBy;
      // Keep suspension history but clear current suspension fields
      member.suspensionReason = undefined;
      member.suspendedAt = undefined;
      member.suspendedBy = undefined;
      await member.save();

      // Log the activation in audit trail
      await workspaceAuditService.logMemberAction(
        new mongoose.Types.ObjectId(workplaceId),
        reactivatedBy!,
        new mongoose.Types.ObjectId(memberId),
        'member_activated',
        {
          reason: `Reactivated after suspension: ${previousSuspensionReason}`,
          metadata: {
            email: member.email,
            name: `${member.firstName} ${member.lastName}`,
            previousSuspensionReason,
            previousSuspendedAt,
          },
        },
        req
      );

      // Send reactivation notification email (don't block response)
      emailService
        .sendAccountReactivationNotification(member.email, {
          firstName: member.firstName,
        })
        .catch((error: any) => {
          console.error('Failed to send reactivation notification email:', error);
        });

      res.status(200).json({
        success: true,
        message: 'Member activated successfully',
        member: {
          _id: member._id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          status: member.status,
          reactivatedAt: member.reactivatedAt,
        },
        audit: {
          action: 'member_activated',
          memberId: member._id,
          memberEmail: member.email,
          previousSuspensionReason,
          previousSuspendedAt,
          reactivatedBy,
          reactivatedAt: member.reactivatedAt,
        },
      });
    } catch (error: any) {
      console.error('Error activating member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate member',
        error: error.message,
      });
    }
  }

  /**
   * Get pending license approvals for workspace members
   * @route GET /api/workspace/team/licenses/pending
   */
  async getPendingLicenses(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get workplaceId from authenticated user or super admin context
      let workplaceId = req.user?.workplaceId || (req as any).workplaceId;

      // For super admins, get workplaceId from query parameter if provided
      if (req.user?.role === 'super_admin' && req.query.workplaceId) {
        workplaceId = req.query.workplaceId;
      }

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'No workspace associated with user',
        });
        return;
      }

      // Find all members with pending licenses in this workspace
      const pendingLicenses = await User.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        licenseStatus: 'pending',
        workplaceRole: 'Pharmacist', // Only pharmacists need license approval
      }).select([
        'firstName',
        'lastName',
        'email',
        'licenseNumber',
        'licenseStatus',
        'licenseDocument',
        'workplaceRole',
        'createdAt',
        'updatedAt'
      ]);

      res.status(200).json({
        success: true,
        data: {
          pendingLicenses,
          count: pendingLicenses.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching pending licenses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending licenses',
        error: error.message,
      });
    }
  }

  /**
   * Approve a member's license within the workspace
   * @route POST /api/workspace/team/licenses/:memberId/approve
   */
  async approveMemberLicense(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const { reason } = req.body;

      // Get workplaceId from authenticated user or super admin context
      let workplaceId = req.user?.workplaceId || (req as any).workplaceId;

      // For super admins, get the workplaceId from the member being approved
      if (!workplaceId) {
        const memberToApprove = await User.findById(memberId).lean();
        if (!memberToApprove) {
          res.status(404).json({
            success: false,
            message: 'Member not found',
          });
          return;
        }
        workplaceId = memberToApprove.workplaceId;
      }

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'No workspace associated with user',
        });
        return;
      }

      // Find the member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        workplaceRole: 'Pharmacist', // Only pharmacists need license approval
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Pharmacist member not found in this workspace',
        });
        return;
      }

      if (member.licenseStatus !== 'pending') {
        res.status(400).json({
          success: false,
          message: 'License is not pending approval',
        });
        return;
      }

      if (!member.licenseDocument) {
        res.status(400).json({
          success: false,
          message: 'No license document found',
        });
        return;
      }

      // Approve license
      member.licenseStatus = 'approved';
      member.licenseVerifiedAt = new Date();
      member.licenseVerifiedBy = req.user!._id;
      member.status = 'active'; // Ensure member is active
      await member.save();

      // Log the approval in audit trail
      await workspaceAuditService.logLicenseAction(
        new mongoose.Types.ObjectId(workplaceId),
        req.user!._id,
        new mongoose.Types.ObjectId(memberId),
        'license_approved',
        {
          reason,
          metadata: {
            licenseNumber: member.licenseNumber,
            approvedAt: new Date(),
          }
        },
        req
      );

      // Send approval email to the member
      try {
        await emailService.sendLicenseApprovalNotification(member.email, {
          firstName: member.firstName,
          licenseNumber: member.licenseNumber || '',
        });
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
        // Don't fail the approval if email fails
      }

      res.status(200).json({
        success: true,
        message: 'License approved successfully',
        data: {
          member: {
            _id: member._id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            licenseStatus: member.licenseStatus,
            licenseVerifiedAt: member.licenseVerifiedAt,
          },
        },
      });
    } catch (error: any) {
      console.error('Error approving member license:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve license',
        error: error.message,
      });
    }
  }

  /**
   * Reject a member's license within the workspace  
   * @route POST /api/workspace/team/licenses/:memberId/reject
   */
  async rejectMemberLicense(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
        return;
      }

      // Get workplaceId from authenticated user or super admin context
      let workplaceId = req.user?.workplaceId || (req as any).workplaceId;

      // For super admins, get the workplaceId from the member being rejected
      if (!workplaceId) {
        const memberToReject = await User.findById(memberId).lean();
        if (!memberToReject) {
          res.status(404).json({
            success: false,
            message: 'Member not found',
          });
          return;
        }
        workplaceId = memberToReject.workplaceId;
      }

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'No workspace associated with user',
        });
        return;
      }

      // Find the member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        workplaceRole: 'Pharmacist', // Only pharmacists need license approval
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Pharmacist member not found in this workspace',
        });
        return;
      }

      if (member.licenseStatus !== 'pending') {
        res.status(400).json({
          success: false,
          message: 'License is not pending approval',
        });
        return;
      }

      // Reject license
      member.licenseStatus = 'rejected';
      member.licenseRejectedAt = new Date();
      member.licenseRejectedBy = req.user!._id;
      member.licenseRejectionReason = reason;
      await member.save();

      // Log the rejection in audit trail
      await workspaceAuditService.logLicenseAction(
        new mongoose.Types.ObjectId(workplaceId),
        req.user!._id,
        new mongoose.Types.ObjectId(memberId),
        'license_rejected',
        {
          reason,
          metadata: {
            licenseNumber: member.licenseNumber,
            rejectedAt: new Date(),
          }
        },
        req
      );

      // Send rejection email to the member
      try {
        await emailService.sendLicenseRejectionNotification(member.email, {
          firstName: member.firstName,
          reason,
        });
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
        // Don't fail the rejection if email fails
      }

      res.status(200).json({
        success: true,
        message: 'License rejected successfully',
        data: {
          member: {
            _id: member._id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            licenseStatus: member.licenseStatus,
            licenseRejectedAt: member.licenseRejectedAt,
            licenseRejectionReason: member.licenseRejectionReason,
          },
        },
      });
    } catch (error: any) {
      console.error('Error rejecting member license:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject license',
        error: error.message,
      });
    }
  }

}

export const workspaceTeamController = new WorkspaceTeamController();
