import mongoose from 'mongoose';
import Invitation, { IInvitation } from '../models/Invitation';
import User from '../models/User';
import Workplace from '../models/Workplace';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { emailService } from '../utils/emailService';

export interface EmailDeliveryResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface CreateInvitationData {
    email: string;
    role: 'Owner' | 'Pharmacist' | 'Technician' | 'Intern';
    customMessage?: string;
    workspaceId: string;
    inviterId: string;
}

export interface InvitationResult {
    success: boolean;
    message: string;
    invitation?: IInvitation;
    error?: string;
}

export class InvitationService {
    private static instance: InvitationService;

    public static getInstance(): InvitationService {
        if (!InvitationService.instance) {
            InvitationService.instance = new InvitationService();
        }
        return InvitationService.instance;
    }

    /**
     * Create and send invitation
     */
    async createInvitation(data: CreateInvitationData): Promise<InvitationResult> {
        try {
            const { email, role, customMessage, workspaceId, inviterId } = data;

            // Validate email format
            const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
            if (!emailRegex.test(email)) {
                return {
                    success: false,
                    message: 'Invalid email format'
                };
            }

            // Find workspace and verify permissions
            const workspace = await Workplace.findById(workspaceId);
            if (!workspace) {
                return {
                    success: false,
                    message: 'Workspace not found'
                };
            }

            // Check if user has permission to invite
            if (workspace.ownerId.toString() !== inviterId.toString()) {
                return {
                    success: false,
                    message: 'Only workspace owners can send invitations'
                };
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return {
                    success: false,
                    message: 'User already exists in the system'
                };
            }

            // Check for existing invitation
            const existingInvitation = await Invitation.findOne({
                email: email.toLowerCase(),
                workspaceId: workspaceId,
                status: 'active'
            });

            if (existingInvitation) {
                return {
                    success: false,
                    message: 'Active invitation already exists for this email'
                };
            }

            // Create new invitation
            const invitation = new Invitation({
                email: email.toLowerCase(),
                role,
                workspaceId,
                inviterId,
                token: this.generateInvitationToken(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                status: 'active',
                metadata: {
                    inviterName: `${(await User.findById(inviterId))?.firstName || ''} ${(await User.findById(inviterId))?.lastName || ''}`.trim(),
                    workspaceName: workspace.name,
                    customMessage
                }
            });

            await invitation.save();

            // Send invitation email
            const emailResult = await this.sendInvitationEmail(invitation);

            return {
                success: true,
                message: 'Invitation created and sent successfully',
                invitation
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to create invitation',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Accept invitation
     */
    async acceptInvitation(token: string, userData: any): Promise<InvitationResult> {
        try {
            const invitation = await Invitation.findOne({
                token,
                status: 'active',
                expiresAt: { $gt: new Date() }
            });

            if (!invitation) {
                return {
                    success: false,
                    message: 'Invalid or expired invitation token'
                };
            }

            // Mark invitation as accepted
            invitation.status = 'used';
            await invitation.save(); return {
                success: true,
                message: 'Invitation accepted successfully',
                invitation
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to accept invitation',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Cancel invitation
     */
    async cancelInvitation(invitationId: string, cancelledBy: string, reason?: string): Promise<InvitationResult> {
        try {
            const invitation = await Invitation.findById(invitationId);

            if (!invitation) {
                return {
                    success: false,
                    message: 'Invitation not found'
                };
            }

            invitation.status = 'canceled';
            invitation.metadata.canceledBy = cancelledBy;
            invitation.metadata.canceledReason = reason;
            invitation.metadata.canceledAt = new Date();

            await invitation.save();

            return {
                success: true,
                message: 'Invitation cancelled successfully',
                invitation
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to cancel invitation',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get invitations for workspace
     */
    async getWorkspaceInvitations(workspaceId: string): Promise<IInvitation[]> {
        return await Invitation.find({ workspaceId }).sort({ createdAt: -1 });
    }

    /**
     * Resend invitation
     */
    async resendInvitation(invitationId: string): Promise<InvitationResult> {
        try {
            const invitation = await Invitation.findById(invitationId);

            if (!invitation) {
                return {
                    success: false,
                    message: 'Invitation not found'
                };
            }

            if (invitation.status !== 'active') {
                return {
                    success: false,
                    message: 'Can only resend active invitations'
                };
            }

            // Update expiry and resend
            invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await invitation.save();

            const emailResult = await this.sendInvitationEmail(invitation);

            return {
                success: true,
                message: 'Invitation resent successfully',
                invitation
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to resend invitation',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Send invitation email
     */
    private async sendInvitationEmail(invitation: IInvitation): Promise<EmailDeliveryResult> {
        try {
            const result = await emailService.sendInvitationEmail(invitation);
            return {
                success: true,
                messageId: result.messageId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Email delivery failed'
            };
        }
    }

    /**
     * Generate unique invitation token
     */
    private generateInvitationToken(): string {
        return require('crypto').randomBytes(32).toString('hex');
    }

    /**
     * Clean up expired invitations
     */
    async cleanupExpiredInvitations(): Promise<number> {
        const result = await Invitation.updateMany(
            {
                status: 'active',
                expiresAt: { $lt: new Date() }
            },
            {
                $set: { status: 'expired' }
            }
        );
        return result.modifiedCount || 0;
    }
}

export default InvitationService;