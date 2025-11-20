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
 * Workspace Team Invite Controller
 * Handles invite management operations for workspace owners
 */
class WorkspaceTeamInviteController {
  /**
   * Generate a new invite link
   * @route POST /api/workspace/team/invites
   */
  async generateInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, workplaceRole, expiresInDays, maxUses, requiresApproval, personalMessage } = req.body;
      const workplaceId = (req as any).workplaceId;
      const invitedBy = req.user?._id;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Check if user already exists in this workspace
      const existingMember = await User.findOne({
        email: email.toLowerCase(),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (existingMember) {
        res.status(400).json({
          success: false,
          message: 'User is already a member of this workspace',
        });
        return;
      }

      // Check if there's already a pending invite for this email
      const existingInvite = await WorkspaceInvite.findOne({
        email: email.toLowerCase(),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'pending',
      });

      if (existingInvite && !existingInvite.isExpired()) {
        res.status(400).json({
          success: false,
          message: 'An active invite already exists for this email',
          invite: {
            _id: existingInvite._id,
            expiresAt: existingInvite.expiresAt,
          },
        });
        return;
      }

      // Generate secure invite token
      const inviteToken = crypto.randomBytes(32).toString('hex');

      // Calculate expiration date
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      // Create invite
      const invite = new WorkspaceInvite({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        inviteToken,
        email: email.toLowerCase(),
        workplaceRole,
        status: 'pending',
        invitedBy,
        expiresAt,
        maxUses: maxUses || 1,
        usedCount: 0,
        requiresApproval: requiresApproval || false,
        personalMessage,
      });

      await invite.save();

      // Generate invite URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const inviteUrl = `${frontendUrl}/register?invite=${inviteToken}`;

      // Debug logging
      console.log('Generated invite:', {
        inviteToken,
        inviteUrl,
        frontendUrl,
      });

      // Log the invite generation in audit trail
      await workspaceAuditService.logInviteAction(
        new mongoose.Types.ObjectId(workplaceId),
        invitedBy!,
        'invite_generated',
        {
          metadata: {
            inviteId: invite._id,
            email,
            role: workplaceRole,
            expiresAt,
            requiresApproval,
            maxUses: invite.maxUses,
          },
        },
        req
      );

      // Get workspace name for email
      const workplace = await Workplace.findById(workplaceId);
      const workspaceName = workplace?.name || 'Workspace';

      // Send invite email (don't block response)
      const inviter = req.user;
      emailService
        .sendWorkspaceInviteEmail(email, {
          inviterName: `${inviter?.firstName} ${inviter?.lastName}`,
          workspaceName,
          role: workplaceRole,
          inviteUrl,
          expiresAt,
          personalMessage,
          requiresApproval,
        })
        .catch((error: any) => {
          console.error('Failed to send invite email:', error);
        });

      res.status(201).json({
        success: true,
        message: 'Invite generated successfully',
        data: {
          invite: {
            _id: invite._id,
            inviteToken: invite.inviteToken,
            inviteUrl,
            email: invite.email,
            workplaceRole: invite.workplaceRole,
            expiresAt: invite.expiresAt,
            maxUses: invite.maxUses,
            requiresApproval: invite.requiresApproval,
            createdAt: invite.createdAt,
          },
        },
      });
    } catch (error: any) {
      console.error('Error generating invite:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate invite',
        error: error.message,
      });
    }
  }

  /**
   * Get all invites for the workspace
   * @route GET /api/workspace/team/invites
   */
  async getInvites(req: AuthRequest, res: Response): Promise<void> {
    try {
      const workplaceId = (req as any).workplaceId;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { workplaceId: new mongoose.Types.ObjectId(workplaceId) };

      // Apply status filter
      if (req.query.status) {
        query.status = req.query.status;
      }

      // Get total count
      const total = await WorkspaceInvite.countDocuments(query);

      // Get invites with pagination
      const invites = await WorkspaceInvite.find(query)
        .populate('invitedBy', 'firstName lastName email')
        .populate('acceptedBy', 'firstName lastName email')
        .populate('rejectedBy', 'firstName lastName email')
        .populate('revokedBy', 'firstName lastName email')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      // Format response
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const formattedInvites = invites.map((invite: any) => ({
        _id: invite._id,
        inviteToken: invite.inviteToken,
        inviteUrl: `${frontendUrl}/register?invite=${invite.inviteToken}`, // Include full URL
        email: invite.email,
        workplaceRole: invite.workplaceRole,
        status: invite.status,
        expiresAt: invite.expiresAt,
        usedCount: invite.usedCount,
        maxUses: invite.maxUses,
        requiresApproval: invite.requiresApproval,
        personalMessage: invite.personalMessage,
        invitedBy: invite.invitedBy,
        acceptedAt: invite.acceptedAt,
        acceptedBy: invite.acceptedBy,
        rejectedAt: invite.rejectedAt,
        rejectedBy: invite.rejectedBy,
        rejectionReason: invite.rejectionReason,
        revokedAt: invite.revokedAt,
        revokedBy: invite.revokedBy,
        createdAt: invite.createdAt,
        isExpired: invite.expiresAt < new Date(),
      }));

      res.status(200).json({
        success: true,
        data: {
          invites: formattedInvites,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching invites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invites',
        error: error.message,
      });
    }
  }

  /**
   * Revoke an invite link
   * @route DELETE /api/workspace/team/invites/:id
   */
  async revokeInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: inviteId } = req.params;
      const workplaceId = (req as any).workplaceId;
      const revokedBy = req.user?._id;

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Find invite in the same workspace
      const invite = await WorkspaceInvite.findOne({
        _id: new mongoose.Types.ObjectId(inviteId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!invite) {
        res.status(404).json({
          success: false,
          message: 'Invite not found in this workspace',
        });
        return;
      }

      // Check if invite can be revoked
      if (invite.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: `Cannot revoke invite with status: ${invite.status}`,
        });
        return;
      }

      // Revoke the invite
      invite.revoke(revokedBy!);
      await invite.save();

      // Log the revocation in audit trail
      await workspaceAuditService.logInviteAction(
        new mongoose.Types.ObjectId(workplaceId),
        revokedBy!,
        'invite_revoked',
        {
          metadata: {
            inviteId: invite._id,
            email: invite.email,
            role: invite.workplaceRole,
            originalExpiresAt: invite.expiresAt,
          },
        },
        req
      );

      res.status(200).json({
        success: true,
        message: 'Invite revoked successfully',
        invite: {
          _id: invite._id,
          email: invite.email,
          status: invite.status,
          revokedAt: invite.revokedAt,
          revokedBy: invite.revokedBy,
        },
      });
    } catch (error: any) {
      console.error('Error revoking invite:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to revoke invite',
        error: error.message,
      });
    }
  }

  /**
   * Validate invite token and return workspace info
   * @route GET /api/workspace/team/invites/validate/:token
   */
  async validateInviteToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Invite token is required',
        });
        return;
      }

      // Find invite by token
      const invite = await WorkspaceInvite.findOne({
        inviteToken: token,
        status: 'pending',
      }).populate('workplaceId', 'name email type');

      if (!invite) {
        res.status(404).json({
          success: false,
          message: 'Invalid or expired invite token',
        });
        return;
      }

      // Check if invite is expired
      if (invite.isExpired()) {
        res.status(400).json({
          success: false,
          message: 'This invite has expired',
        });
        return;
      }

      // Check if max uses reached
      if (invite.usedCount >= invite.maxUses) {
        res.status(400).json({
          success: false,
          message: 'This invite has reached its maximum number of uses',
        });
        return;
      }

      // Return workspace info
      const workplace = invite.workplaceId as any;
      res.status(200).json({
        success: true,
        workspace: {
          name: workplace.name,
          email: workplace.email,
          type: workplace.type,
        },
        invite: {
          email: invite.email,
          role: invite.workplaceRole,
          requiresApproval: invite.requiresApproval,
        },
      });
    } catch (error: any) {
      console.error('Error validating invite token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate invite token',
        error: error.message,
      });
    }
  }

  /**
   * Get pending member approvals
   * @route GET /api/workspace/team/invites/pending
   */
  async getPendingApprovals(req: AuthRequest, res: Response): Promise<void> {
    try {
      let workplaceId = (req as any).workplaceId;

      // For super admins, check if a specific workplaceId is provided in query params
      if (!workplaceId && req.user?.role === 'super_admin') {
        const { workspaceId: queryWorkspaceId } = req.query;

        if (queryWorkspaceId) {
          workplaceId = queryWorkspaceId;
        } else {
          // For super admins without a specific workspace, return all pending approvals
          const allPendingMembers = await User.find({
            status: 'pending',
            workplaceId: { $exists: true, $ne: null },
          })
            .populate('workplaceId', 'name')
            .select('firstName lastName email workplaceRole createdAt workplaceId')
            .sort({ createdAt: -1 })
            .lean();

          res.status(200).json({
            success: true,
            data: {
              pendingMembers: allPendingMembers.map((member: any) => ({
                _id: member._id,
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                workplaceRole: member.workplaceRole,
                joinedAt: member.createdAt,
                status: 'pending',
                workplaceName: member.workplaceId?.name || 'Unknown Workspace',
                workplaceId: member.workplaceId?._id || member.workplaceId,
              })),
              count: allPendingMembers.length,
              isSuperAdminView: true,
            },
          });
          return;
        }
      }

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Find users with pending status in this workspace
      const pendingMembers = await User.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'pending',
      })
        .select('firstName lastName email workplaceRole createdAt')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          pendingMembers: pendingMembers.map((member: any) => ({
            _id: member._id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            workplaceRole: member.workplaceRole,
            joinedAt: member.createdAt,
            status: 'pending',
          })),
          count: pendingMembers.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending approvals',
        error: error.message,
      });
    }
  }

  /**
   * Approve a pending member
   * @route POST /api/workspace/team/invites/:id/approve
   */
  async approveMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: memberId } = req.params;
      const { workplaceRole } = req.body;
      let workplaceId = (req as any).workplaceId;
      const approvedBy = req.user?._id;

      // For super admins, we need to determine the workspace from the member being approved
      if (!workplaceId && req.user?.role === 'super_admin') {
        const member = await User.findOne({
          _id: new mongoose.Types.ObjectId(memberId),
          status: 'pending',
        });

        if (!member || !member.workplaceId) {
          res.status(404).json({
            success: false,
            message: 'Pending member not found or not assigned to any workspace',
          });
          return;
        }

        workplaceId = member.workplaceId;
      }

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Find pending member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'pending',
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Pending member not found in this workspace',
        });
        return;
      }

      // Update member status to active
      member.status = 'active';
      if (workplaceRole) {
        member.workplaceRole = workplaceRole as any;
      }
      await member.save();

      // Log the approval in audit trail
      await workspaceAuditService.logMemberAction(
        new mongoose.Types.ObjectId(workplaceId),
        approvedBy!,
        new mongoose.Types.ObjectId(memberId),
        'member_approved',
        {
          metadata: {
            email: member.email,
            name: `${member.firstName} ${member.lastName}`,
            role: member.workplaceRole,
          },
        },
        req
      );

      // Get workspace name for email
      const workplace = await Workplace.findById(workplaceId);
      const workspaceName = workplace?.name || 'Workspace';

      // Send approval notification email (don't block response)
      emailService
        .sendMemberApprovalNotification(member.email, {
          firstName: member.firstName,
          workspaceName,
          role: member.workplaceRole,
        })
        .catch((error: any) => {
          console.error('Failed to send approval notification email:', error);
        });

      res.status(200).json({
        success: true,
        message: 'Member approved successfully',
        member: {
          _id: member._id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          workplaceRole: member.workplaceRole,
          status: member.status,
        },
      });
    } catch (error: any) {
      console.error('Error approving member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve member',
        error: error.message,
      });
    }
  }

  /**
   * Reject a pending member
   * @route POST /api/workspace/team/invites/:id/reject
   */
  async rejectMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: memberId } = req.params;
      const { reason } = req.body;
      let workplaceId = (req as any).workplaceId;
      const rejectedBy = req.user?._id;

      // For super admins, we need to determine the workspace from the member being rejected
      if (!workplaceId && req.user?.role === 'super_admin') {
        const member = await User.findOne({
          _id: new mongoose.Types.ObjectId(memberId),
          status: 'pending',
        });

        if (!member || !member.workplaceId) {
          res.status(404).json({
            success: false,
            message: 'Pending member not found or not assigned to any workspace',
          });
          return;
        }

        workplaceId = member.workplaceId;
      }

      if (!workplaceId) {
        res.status(400).json({
          success: false,
          message: 'Workplace ID is required',
        });
        return;
      }

      // Find pending member in the same workspace
      const member = await User.findOne({
        _id: new mongoose.Types.ObjectId(memberId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'pending',
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Pending member not found in this workspace',
        });
        return;
      }

      // Store member info for audit
      const memberInfo = {
        email: member.email,
        name: `${member.firstName} ${member.lastName}`,
        role: member.workplaceRole,
      };

      // Remove workspace association and mark as rejected
      member.workplaceId = undefined;
      member.workplaceRole = undefined;
      member.status = 'suspended';
      member.suspensionReason = reason || 'Membership request rejected';
      member.suspendedAt = new Date();
      member.suspendedBy = rejectedBy;
      await member.save();

      // Log the rejection in audit trail
      await workspaceAuditService.logMemberAction(
        new mongoose.Types.ObjectId(workplaceId),
        rejectedBy!,
        new mongoose.Types.ObjectId(memberId),
        'member_rejected',
        {
          reason: reason || 'Membership request rejected',
          metadata: memberInfo,
        },
        req
      );

      // Get workspace name for email
      const workplace = await Workplace.findById(workplaceId);
      const workspaceName = workplace?.name || 'Workspace';

      // Send rejection notification email (don't block response)
      emailService
        .sendMemberRejectionNotification(member.email, {
          firstName: member.firstName,
          workspaceName,
          reason: reason || 'Your membership request was not approved at this time',
        })
        .catch((error: any) => {
          console.error('Failed to send rejection notification email:', error);
        });

      res.status(200).json({
        success: true,
        message: 'Member rejected successfully',
        audit: {
          memberId: member._id,
          memberEmail: member.email,
          reason,
          rejectedBy,
          rejectedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error rejecting member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject member',
        error: error.message,
      });
    }
  }
}

export const workspaceTeamInviteController = new WorkspaceTeamInviteController();
