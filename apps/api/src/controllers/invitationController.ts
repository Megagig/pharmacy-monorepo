import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Invitation, { IInvitation } from '../models/Invitation';
import Workplace from '../models/Workplace';
import User from '../models/User';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { AuthRequest } from '../types/auth';
import { emailService } from '../utils/emailService';
import { invitationCronService } from '../services/InvitationCronService';
import { auditOperations } from '../middlewares/auditLogging';

interface CreateInvitationRequest {
    email: string;
    role: 'Owner' | 'Pharmacist' | 'Technician' | 'Intern';
    customMessage?: string;
}

interface InvitationResponse {
    success: boolean;
    message: string;
    data?: any;
    error?: string;
}

/**
 * Create a new invitation for a workspace
 * POST /api/workspaces/:id/invitations
 */
export const createInvitation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id: workspaceId } = req.params;
        const { email, role, customMessage }: CreateInvitationRequest = req.body;
        const inviterId = req.user!._id;

        // Validate workspace ID
        if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid workspace ID',
            });
            return;
        }

        // Validate required fields
        if (!email || !role) {
            res.status(400).json({
                success: false,
                message: 'Email and role are required',
            });
            return;
        }

        // Validate email format
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                message: 'Invalid email format',
            });
            return;
        }

        // Validate role
        const validRoles = ['Owner', 'Pharmacist', 'Technician', 'Intern'];
        if (!validRoles.includes(role)) {
            res.status(400).json({
                success: false,
                message: 'Invalid role. Must be one of: ' + validRoles.join(', '),
            });
            return;
        }

        // Find workspace and verify permissions
        const workspace = await Workplace.findById(workspaceId);
        if (!workspace) {
            res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
            return;
        }

        // Check if user has permission to invite (must be workspace owner)
        if (workspace.ownerId.toString() !== inviterId.toString()) {
            res.status(403).json({
                success: false,
                message: 'Only workspace owners can send invitations',
            });
            return;
        }

        // Check if user is trying to invite themselves
        const inviter = await User.findById(inviterId);
        if (inviter?.email.toLowerCase() === email.toLowerCase()) {
            res.status(400).json({
                success: false,
                message: 'You cannot invite yourself',
            });
            return;
        }

        // Check if user is already a member of this workspace
        const existingUser = await User.findOne({
            email: email.toLowerCase(),
            workplaceId: workspaceId
        });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'User is already a member of this workspace',
            });
            return;
        }

        // Check pending invitation limit using the static method
        const pendingCount = await Invitation.countDocuments({
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            status: 'active'
        });
        const maxPendingInvites = workspace.settings?.maxPendingInvites || 20;

        if (pendingCount >= maxPendingInvites) {
            res.status(409).json({
                success: false,
                message: `Maximum pending invitations limit reached (${maxPendingInvites}). Please wait for existing invitations to be accepted or expired.`,
                upgradeRequired: true,
                upgradeTo: 'Contact support to increase invitation limits',
            });
            return;
        }

        // Check for existing active invitation for this email and workspace
        const existingInvitation = await Invitation.findOne({
            email: email.toLowerCase(),
            workspaceId: workspaceId,
            status: 'active',
        });

        if (existingInvitation) {
            res.status(409).json({
                success: false,
                message: 'An active invitation already exists for this email',
                error: 'Pending invitation already exists for this email',
                data: {
                    invitationId: existingInvitation._id,
                    expiresAt: existingInvitation.expiresAt,
                },
            });
            return;
        }

        // Check if team management feature is available
        if (workspace.currentSubscriptionId) {
            const subscriptionPlan = await SubscriptionPlan.findById(workspace.currentSubscriptionId);
            if (subscriptionPlan) {
                // Check if teamManagement feature is available
                if (!subscriptionPlan.features.teamManagement) {
                    res.status(403).json({
                        success: false,
                        message: 'Feature not available in your current plan',
                        error: 'Team management feature not available',
                        upgradeRequired: true
                    });
                    return;
                }

                // Check team size limit
                if (subscriptionPlan.features.teamSize) {
                    const currentTeamSize = workspace.teamMembers.length;
                    const pendingInvitationsCount = await Invitation.countDocuments({
                        workspaceId: workspaceId,
                        status: 'active'
                    });

                    // Total potential team size = current members + pending invitations + this new invitation
                    const totalPotentialSize = currentTeamSize + pendingInvitationsCount + 1;

                    if (totalPotentialSize > subscriptionPlan.features.teamSize) {
                        res.status(403).json({
                            success: false,
                            message: 'User limit exceeded for current plan',
                            error: 'User limit exceeded for current plan',
                            currentTeamSize,
                            maxTeamSize: subscriptionPlan.features.teamSize,
                            upgradeRequired: true
                        });
                        return;
                    }
                }
            }
        }

        // Create invitation
        const invitation = new Invitation({
            email: email.toLowerCase(),
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            invitedBy: new mongoose.Types.ObjectId(inviterId),
            role,
            metadata: {
                inviterName: inviter?.firstName + ' ' + inviter?.lastName || 'Unknown',
                workspaceName: workspace.name,
                customMessage: customMessage?.trim() || undefined,
            },
        });

        await invitation.save();

        // Log invitation creation for audit
        await auditOperations.invitationCreated(req, invitation);

        // Send invitation email (don't block the response on email sending)
        emailService.sendInvitationEmail(invitation).catch((error: any) => {
            console.error('Failed to send invitation email:', error);
        });

        res.status(201).json({
            success: true,
            message: 'Invitation created and sent successfully',
            data: {
                invitationId: invitation._id,
                email: invitation.email,
                role: invitation.role,
                code: invitation.code,
                expiresAt: invitation.expiresAt,
                status: invitation.status,
            },
        });
    } catch (error) {
        console.error('Error creating invitation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};

/**
 * Get all invitations for a workspace
 * GET /api/workspaces/:id/invitations
 */
export const getWorkspaceInvitations = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id: workspaceId } = req.params;
        const { status, page = '1', limit = '10' } = req.query;
        const userId = req.user!._id;

        // Validate workspace ID
        if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid workspace ID',
            });
            return;
        }

        // Find workspace and verify permissions
        const workspace = await Workplace.findById(workspaceId);
        if (!workspace) {
            res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
            return;
        }

        // Check if user has permission to view invitations (must be workspace owner)
        if (workspace.ownerId.toString() !== userId.toString()) {
            res.status(403).json({
                success: false,
                message: 'Only workspace owners can view invitations',
            });
            return;
        }

        // Build query
        const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
        if (status && ['active', 'expired', 'used', 'canceled'].includes(status as string)) {
            query.status = status;
        }

        // Pagination
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
        const skip = (pageNum - 1) * limitNum;

        // Get invitations with pagination
        const [invitations, total] = await Promise.all([
            Invitation.find(query)
                .populate('invitedBy', 'firstName lastName email')
                .populate('usedBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Invitation.countDocuments(query),
        ]);

        // Get summary statistics
        const stats = await Invitation.aggregate([
            { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const statusCounts = stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, {} as Record<string, number>);

        res.json({
            success: true,
            invitations,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            limit: limitNum,
            stats: {
                active: statusCounts.active || 0,
                expired: statusCounts.expired || 0,
                used: statusCounts.used || 0,
                canceled: statusCounts.canceled || 0,
                total: Object.values(statusCounts).reduce((sum: number, count: unknown) => sum + (count as number), 0),
            },
        });
    } catch (error) {
        console.error('Error fetching workspace invitations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};

/**
 * Cancel an invitation
 * DELETE /api/invitations/:id
 */
export const cancelInvitation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id: invitationId } = req.params;
        const userId = req.user!._id;

        // Validate invitation ID
        if (!invitationId || !mongoose.Types.ObjectId.isValid(invitationId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid invitation ID',
            });
            return;
        }

        // Find invitation
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) {
            res.status(404).json({
                success: false,
                message: 'Invitation not found',
            });
            return;
        }

        // Find workspace and verify permissions
        const workspace = await Workplace.findById(invitation.workspaceId);
        if (!workspace) {
            res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
            return;
        }

        // Check if user has permission to cancel (must be workspace owner or the inviter)
        if (
            workspace.ownerId.toString() !== userId.toString() &&
            invitation.invitedBy.toString() !== userId.toString()
        ) {
            res.status(403).json({
                success: false,
                message: 'You can only cancel invitations you created or if you are the workspace owner',
            });
            return;
        }

        // Check if invitation can be canceled
        if (invitation.status !== 'active') {
            res.status(400).json({
                success: false,
                message: `Cannot cancel invitation with status: ${invitation.status}`,
            });
            return;
        }

        // Cancel invitation
        invitation.status = 'canceled';
        await invitation.save();

        res.json({
            success: true,
            message: 'Invitation canceled successfully',
            data: {
                invitationId: invitation._id,
                status: invitation.status,
            },
        });
    } catch (error) {
        console.error('Error canceling invitation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};

/**
 * Accept an invitation
 * POST /api/invitations/:code/accept
 */
export const acceptInvitation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { code } = req.params;
        const userId = req.user!._id;

        // Validate code format
        if (!code || code.length !== 8) {
            res.status(400).json({
                success: false,
                message: 'Invalid invitation code format',
            });
            return;
        }

        // Find invitation by code
        const invitation = await Invitation.findOne({ code: code.toUpperCase() })
            .populate('workspaceId')
            .populate('invitedBy', 'firstName lastName email');

        if (!invitation) {
            res.status(404).json({
                success: false,
                message: 'Invitation not found',
            });
            return;
        }

        // Check if invitation can be used
        const isExpired = invitation.expiresAt < new Date();
        const canBeUsed = invitation.status === 'active' && !isExpired;

        if (!canBeUsed) {
            const reason = isExpired ? 'expired' : `already ${invitation.status}`;
            res.status(400).json({
                success: false,
                message: `This invitation is ${reason} and cannot be used`,
                data: {
                    status: invitation.status,
                    expiresAt: invitation.expiresAt,
                },
            });
            return;
        }

        // Get the user and workspace
        const user = await User.findById(userId);
        const workspace = invitation.workspaceId as any;

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        if (!workspace) {
            res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
            return;
        }

        // Check if user email matches invitation email
        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            res.status(403).json({
                success: false,
                message: 'This invitation is for a different email address',
                data: {
                    invitationEmail: invitation.email,
                    userEmail: user.email,
                },
            });
            return;
        }

        // Check if user is already a member of this workspace
        if (user.workplaceId && user.workplaceId.toString() === workspace._id.toString()) {
            res.status(409).json({
                success: false,
                message: 'You are already a member of this workspace',
            });
            return;
        }

        // Check if user is already a member of another workspace
        if (user.workplaceId) {
            res.status(409).json({
                success: false,
                message: 'You are already a member of another workspace. Please leave your current workspace first.',
                data: {
                    currentWorkspaceId: user.workplaceId,
                },
            });
            return;
        }

        // Start transaction for atomic updates
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Update user with workspace and role
            await User.findByIdAndUpdate(
                userId,
                {
                    workplaceId: workspace._id,
                    role: invitation.role,
                },
                { session }
            );

            // Add user to workspace team members
            await Workplace.findByIdAndUpdate(
                workspace._id,
                {
                    $addToSet: { teamMembers: userId },
                    $inc: { 'stats.usersCount': 1 },
                    'stats.lastUpdated': new Date(),
                },
                { session }
            );

            // Mark invitation as used
            invitation.status = 'used';
            invitation.usedAt = new Date();
            invitation.usedBy = new mongoose.Types.ObjectId(userId);
            await invitation.save({ session });

            await session.commitTransaction();

            // Log invitation acceptance for audit
            await auditOperations.invitationAccepted(req, invitation, user);

            // Send notification to inviter (don't block response)
            const inviterData = invitation.invitedBy as any;
            emailService.sendInvitationAcceptedNotification(
                inviterData.email,
                {
                    inviterName: `${inviterData.firstName} ${inviterData.lastName}`,
                    acceptedUserName: `${user.firstName} ${user.lastName}`,
                    acceptedUserEmail: user.email,
                    workspaceName: workspace.name,
                    role: invitation.role,
                }
            ).catch((error: any) => {
                console.error('Failed to send invitation accepted notification:', error);
            });

            res.json({
                success: true,
                message: 'Invitation accepted successfully',
                data: {
                    workspace: {
                        id: workspace._id,
                        name: workspace.name,
                        type: workspace.type,
                    },
                    role: invitation.role,
                    user: {
                        id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: invitation.role,
                    },
                },
            });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};

/**
 * Validate an invitation code
 * GET /api/invitations/:code/validate
 */
export const validateInvitation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { code } = req.params;

        // Validate code format
        if (!code || code.length !== 8) {
            res.status(400).json({
                success: false,
                message: 'Invalid invitation code format',
            });
            return;
        }

        // Find invitation by code
        const invitation = await Invitation.findOne({ code: code.toUpperCase() })
            .populate('workspaceId', 'name type logoUrl')
            .populate('invitedBy', 'firstName lastName')
            .lean();

        if (!invitation) {
            res.status(404).json({
                success: false,
                message: 'Invitation not found',
            });
            return;
        }

        // Check if invitation is valid
        const isExpired = invitation.expiresAt < new Date();
        const canBeUsed = invitation.status === 'active' && !isExpired;

        // Update expired invitations
        if (isExpired && invitation.status === 'active') {
            await Invitation.findByIdAndUpdate(invitation._id, { status: 'expired' });
        }

        // Type assertion for populated fields
        const workspaceData = invitation.workspaceId as any;
        const inviterData = invitation.invitedBy as any;

        res.json({
            success: true,
            valid: canBeUsed,
            data: {
                invitation: {
                    id: invitation._id,
                    email: invitation.email,
                    role: invitation.role,
                    status: isExpired ? 'expired' : invitation.status,
                    expiresAt: invitation.expiresAt,
                    canBeUsed,
                    workspace: {
                        id: workspaceData._id,
                        name: workspaceData.name,
                        type: workspaceData.type,
                        logoUrl: workspaceData.logoUrl,
                    },
                    inviter: {
                        name: `${inviterData.firstName} ${inviterData.lastName}`,
                    },
                    metadata: invitation.metadata,
                },
            },
        });
    } catch (error) {
        console.error('Error validating invitation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};

/**
 * Accept an invitation with new user registration (public endpoint)
 * POST /api/invitations/accept
 */
export const acceptInvitationPublic = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { code, userData } = req.body;

        // Validate required fields
        if (!code || !userData) {
            res.status(400).json({
                success: false,
                error: 'Invitation code and user data are required',
            });
            return;
        }

        const { firstName, lastName, password, licenseNumber } = userData;

        if (!firstName || !lastName || !password) {
            res.status(400).json({
                success: false,
                error: 'First name, last name, and password are required',
            });
            return;
        }

        // Validate code format
        if (code.length !== 8) {
            res.status(400).json({
                success: false,
                error: 'Invalid invitation code format',
            });
            return;
        }

        // Find invitation by code
        const invitation = await Invitation.findOne({ code: code.toUpperCase() })
            .populate('workspaceId')
            .populate('invitedBy', 'firstName lastName email');

        if (!invitation) {
            res.status(404).json({
                success: false,
                error: 'Invitation not found',
            });
            return;
        }

        // Check if invitation can be used
        const isExpired = invitation.expiresAt < new Date();
        if (invitation.status !== 'active' || isExpired) {
            const reason = isExpired ? 'expired' : invitation.status;
            res.status(400).json({
                success: false,
                error: `Invitation has ${reason}`,
            });
            return;
        }

        const workspace = invitation.workspaceId as any;
        if (!workspace) {
            res.status(404).json({
                success: false,
                error: 'Workspace not found',
            });
            return;
        }

        // Check if user already exists with this email
        const existingUser = await User.findOne({ email: invitation.email });
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'User with this email already exists',
            });
            return;
        }

        // Perform atomic updates (without transactions for test compatibility)
        try {
            // Create new user
            const newUser = await User.create({
                firstName,
                lastName,
                email: invitation.email,
                passwordHash: password, // This will be hashed by the User model pre-save hook
                role: 'pharmacist', // Default role
                workplaceRole: invitation.role,
                workplaceId: workspace._id,
                status: 'active',
                licenseNumber: licenseNumber || null,
                currentPlanId: workspace.currentPlanId,
            });

            if (!newUser) {
                throw new Error('Failed to create user');
            }

            // Add user to workspace team members
            await Workplace.findByIdAndUpdate(
                workspace._id,
                {
                    $addToSet: { teamMembers: newUser._id },
                }
            );

            // Mark invitation as used
            invitation.status = 'used';
            invitation.usedAt = new Date();
            invitation.usedBy = newUser._id;
            await invitation.save();

            // Send notification to inviter (don't block response)
            const inviterData = invitation.invitedBy as any;
            emailService.sendInvitationAcceptedNotification(
                inviterData.email,
                {
                    inviterName: `${inviterData.firstName} ${inviterData.lastName}`,
                    acceptedUserName: `${firstName} ${lastName}`,
                    acceptedUserEmail: invitation.email,
                    workspaceName: workspace.name,
                    role: invitation.role,
                }
            ).catch((error: any) => {
                console.error('Failed to send invitation accepted notification:', error);
            });

            res.json({
                success: true,
                message: 'Invitation accepted successfully',
                user: {
                    id: newUser._id,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                    workplaceRole: newUser.workplaceRole,
                    workplaceId: newUser.workplaceId,
                    status: newUser.status,
                },
                workspace: {
                    id: workspace._id,
                    name: workspace.name,
                    type: workspace.type,
                },
            });
        } catch (error) {
            console.error('Error accepting invitation:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
};

/**
 * Get invitation analytics for a workspace
 * GET /api/workspaces/:id/invitations/analytics
 */
export const getInvitationAnalytics = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id: workspaceId } = req.params;
        const userId = req.user!._id;

        // Validate workspace ID
        if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid workspace ID',
            });
            return;
        }

        // Find workspace and verify permissions
        const workspace = await Workplace.findById(workspaceId);
        if (!workspace) {
            res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
            return;
        }

        // Check if user has permission to view analytics (must be workspace owner)
        if (workspace.ownerId.toString() !== userId.toString()) {
            res.status(403).json({
                success: false,
                message: 'Only workspace owners can view invitation analytics',
            });
            return;
        }

        const analytics = await invitationCronService.getInvitationAnalytics(workspaceId);

        res.json({
            success: true,
            data: analytics,
        });
    } catch (error) {
        console.error('Error fetching invitation analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};

/**
 * Get invitation statistics for a workspace
 * GET /api/workspaces/:id/invitations/stats
 */
export const getInvitationStats = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id: workspaceId } = req.params;
        const userId = req.user!._id;

        // Validate workspace ID
        if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid workspace ID',
            });
            return;
        }

        // Find workspace and verify permissions
        const workspace = await Workplace.findById(workspaceId);
        if (!workspace) {
            res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
            return;
        }

        // Check if user has permission to view stats (must be workspace owner)
        if (workspace.ownerId.toString() !== userId.toString()) {
            res.status(403).json({
                success: false,
                message: 'Only workspace owners can view invitation statistics',
            });
            return;
        }

        // Get invitation statistics
        const stats = await Invitation.aggregate([
            { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const statusCounts = stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, {} as Record<string, number>);

        res.json({
            success: true,
            data: {
                active: statusCounts.active || 0,
                expired: statusCounts.expired || 0,
                used: statusCounts.used || 0,
                canceled: statusCounts.canceled || 0,
                total: Object.values(statusCounts).reduce((sum: number, count: unknown) => sum + (count as number), 0),
            },
        });
    } catch (error) {
        console.error('Error fetching invitation stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};

/**
 * Check invitation limits for a workspace
 * GET /api/workspaces/:id/invitations/limits
 */
export const checkInvitationLimits = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id: workspaceId } = req.params;
        const userId = req.user!._id;

        // Validate workspace ID
        if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid workspace ID',
            });
            return;
        }

        // Find workspace and verify permissions
        const workspace = await Workplace.findById(workspaceId);
        if (!workspace) {
            res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
            return;
        }

        // Check if user has permission to view limits (must be workspace owner)
        if (workspace.ownerId.toString() !== userId.toString()) {
            res.status(403).json({
                success: false,
                message: 'Only workspace owners can view invitation limits',
            });
            return;
        }

        // Get current invitation counts
        const pendingCount = await Invitation.countDocuments({
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            status: 'active'
        });

        // Get limits from workspace settings and subscription plan
        const maxPendingInvites = workspace.settings?.maxPendingInvites || 20;
        let teamSizeLimit = null;

        if (workspace.currentSubscriptionId) {
            const subscriptionPlan = await SubscriptionPlan.findById(workspace.currentSubscriptionId);
            if (subscriptionPlan && subscriptionPlan.features.teamSize) {
                teamSizeLimit = subscriptionPlan.features.teamSize;
            }
        }

        const currentTeamSize = workspace.teamMembers.length;

        res.json({
            success: true,
            data: {
                pendingInvitations: {
                    current: pendingCount,
                    limit: maxPendingInvites,
                    remaining: Math.max(0, maxPendingInvites - pendingCount),
                },
                teamSize: {
                    current: currentTeamSize,
                    limit: teamSizeLimit,
                    remaining: teamSizeLimit ? Math.max(0, teamSizeLimit - currentTeamSize) : null,
                },
            },
        });
    } catch (error) {
        console.error('Error checking invitation limits:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
    }
};