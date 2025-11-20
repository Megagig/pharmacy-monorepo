import { InvitationService } from '../../services/InvitationService';
import Invitation, { IInvitation } from '../../models/Invitation';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import SubscriptionPlan, { ISubscriptionPlan } from '../../models/SubscriptionPlan';
import { emailService } from '../../utils/emailService';
import PermissionService from '../../services/PermissionService';
import { testUtils } from '../utils/testUtils';

// Mock dependencies
jest.mock('../../models/Invitation');
jest.mock('../../models/User');
jest.mock('../../models/Workplace');
jest.mock('../../models/SubscriptionPlan');
jest.mock('../../utils/emailService');
jest.mock('../../services/PermissionService');

const mockInvitation = Invitation as jest.Mocked<typeof Invitation>;
const mockUser = User as jest.Mocked<typeof User>;
const mockWorkplace = Workplace as jest.Mocked<typeof Workplace>;
const mockSubscriptionPlan = SubscriptionPlan as jest.Mocked<typeof SubscriptionPlan>;
const mockEmailService = emailService as jest.Mocked<typeof emailService>;
const mockPermissionService = PermissionService as jest.Mocked<typeof PermissionService>;

describe('InvitationService', () => {
    let invitationService: InvitationService;

    const mockWorkspaceData = {
        _id: testUtils.createObjectId(),
        name: 'Test Pharmacy',
        type: 'pharmacy',
        ownerId: testUtils.createObjectId(),
        teamMembers: [],
        subscriptionId: testUtils.createObjectId()
    };

    const mockPlanData = {
        _id: testUtils.createObjectId(),
        name: 'Premium Plan',
        code: 'premium',
        tier: 'premium',
        features: ['team_management'],
        limits: {
            users: 5,
            patients: 500,
            locations: 3,
            storage: 5000,
            apiCalls: 5000
        }
    };

    const mockInviterData = {
        _id: testUtils.createObjectId(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workplaceRole: 'Owner'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        invitationService = InvitationService.getInstance();

        // Setup default mocks
        mockWorkplace.findById.mockResolvedValue(mockWorkspaceData as any);
        mockSubscriptionPlan.findById.mockResolvedValue(mockPlanData as any);
        mockUser.findById.mockResolvedValue(mockInviterData as any);
        mockUser.findOne.mockResolvedValue(null); // Default: no existing user
        mockInvitation.findOne.mockResolvedValue(null); // Default: no existing invitation

        // Mock PermissionService as static methods since it's a default export
        (PermissionService as any).checkPermission = jest.fn().mockResolvedValue({
            allowed: true,
            reason: 'workplace_role_match'
        });
    });

    describe('createInvitation', () => {
        const invitationData = {
            email: 'newuser@example.com',
            role: 'Pharmacist' as const,
            workspaceId: mockWorkspaceData._id.toString(),
            inviterId: mockInviterData._id.toString()
        };

        it('should create invitation successfully', async () => {
            const mockCreatedInvitation = {
                _id: testUtils.createObjectId(),
                ...invitationData,
                token: 'mock-token',
                status: 'pending',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdAt: new Date()
            };

            mockInvitation.findOne.mockResolvedValue(null); // No existing invitation
            mockUser.findOne.mockResolvedValue(null); // User doesn't exist
            mockInvitation.prototype.save.mockResolvedValue(mockCreatedInvitation as any);
            mockEmailService.sendInvitationEmail.mockResolvedValue({ success: true, messageId: 'test-message-id' });

            const result = await invitationService.createInvitation(invitationData);

            expect(result.success).toBe(true);
            expect(result.invitation).toEqual(mockCreatedInvitation);
            expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
                invitationData.email,
                expect.objectContaining({
                    workspaceName: mockWorkspaceData.name,
                    inviterName: `${mockInviterData.firstName} ${mockInviterData.lastName}`,
                    role: invitationData.role
                })
            );
        });

        it('should reject invitation if user lacks permission', async () => {
            mockPermissionService.prototype.checkPermission.mockResolvedValue({
                allowed: false,
                reason: 'insufficient_workplace_role'
            });

            const result = await invitationService.createInvitation(invitationData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Insufficient permissions to create invitations');
        });

        it('should reject invitation if user limit would be exceeded', async () => {
            const workspaceWithManyUsers = {
                ...mockWorkspaceData,
                teamMembers: new Array(5).fill(testUtils.createObjectId()) // At limit
            };
            mockWorkplace.findById.mockResolvedValue(workspaceWithManyUsers as any);

            const result = await invitationService.createInvitation(invitationData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('User limit exceeded for current plan');
        });

        it('should reject invitation if user already exists', async () => {
            const existingUser = {
                _id: testUtils.createObjectId(),
                email: invitationData.email
            };
            mockUser.findOne.mockResolvedValue(existingUser as any);

            const result = await invitationService.createInvitation(invitationData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('User with this email already exists');
        });

        it('should reject invitation if pending invitation exists', async () => {
            const existingInvitation = {
                _id: testUtils.createObjectId(),
                email: invitationData.email,
                status: 'pending'
            };
            mockInvitation.findOne.mockResolvedValue(existingInvitation as any);

            const result = await invitationService.createInvitation(invitationData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Pending invitation already exists for this email');
        });

        it('should handle email sending failure gracefully', async () => {
            mockInvitation.findOne.mockResolvedValue(null);
            mockUser.findOne.mockResolvedValue(null);
            mockInvitation.prototype.save.mockResolvedValue({
                _id: testUtils.createObjectId(),
                ...invitationData
            } as any);
            mockEmailService.sendInvitationEmail.mockResolvedValue({ success: false, error: 'Email delivery failed' });

            const result = await invitationService.createInvitation(invitationData);

            expect(result.success).toBe(true);
            expect(result.warning).toBe('Invitation created but email could not be sent');
        });
    });

    describe('acceptInvitation', () => {
        const acceptanceData = {
            token: 'valid-token',
            userData: {
                firstName: 'Jane',
                lastName: 'Smith',
                password: 'securePassword123'
            }
        };

        it('should accept invitation successfully', async () => {
            const mockInvitationData = {
                _id: testUtils.createObjectId(),
                email: 'jane@example.com',
                role: 'Pharmacist',
                workspaceId: mockWorkspaceData._id,
                token: acceptanceData.token,
                status: 'pending',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Valid
            };

            const mockNewUser = {
                _id: testUtils.createObjectId(),
                ...acceptanceData.userData,
                email: mockInvitationData.email,
                workplaceRole: mockInvitationData.role
            };

            mockInvitation.findOne.mockResolvedValue(mockInvitationData as any);
            mockUser.prototype.save.mockResolvedValue(mockNewUser as any);
            mockInvitation.findByIdAndUpdate.mockResolvedValue({
                ...mockInvitationData,
                status: 'accepted'
            } as any);
            mockWorkplace.findByIdAndUpdate.mockResolvedValue(mockWorkspaceData as any);

            const result = await invitationService.acceptInvitation(acceptanceData);

            expect(result.success).toBe(true);
            expect(result.user).toEqual(mockNewUser);
            expect(mockWorkplace.findByIdAndUpdate).toHaveBeenCalledWith(
                mockWorkspaceData._id,
                { $push: { teamMembers: mockNewUser._id } }
            );
        });

        it('should reject expired invitation', async () => {
            const expiredInvitation = {
                _id: testUtils.createObjectId(),
                token: acceptanceData.token,
                status: 'pending',
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired
            };

            mockInvitation.findOne.mockResolvedValue(expiredInvitation as any);

            const result = await invitationService.acceptInvitation(acceptanceData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invitation has expired');
        });

        it('should reject already accepted invitation', async () => {
            const acceptedInvitation = {
                _id: testUtils.createObjectId(),
                token: acceptanceData.token,
                status: 'accepted',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            mockInvitation.findOne.mockResolvedValue(acceptedInvitation as any);

            const result = await invitationService.acceptInvitation(acceptanceData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invitation has already been accepted');
        });

        it('should reject invalid token', async () => {
            mockInvitation.findOne.mockResolvedValue(null);

            const result = await invitationService.acceptInvitation(acceptanceData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid invitation token');
        });
    });

    describe('resendInvitation', () => {
        it('should resend invitation successfully', async () => {
            const invitationId = testUtils.createObjectId();
            const mockInvitationData = {
                _id: invitationId,
                email: 'user@example.com',
                status: 'pending',
                workspaceId: mockWorkspaceData._id,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            mockInvitation.findById.mockResolvedValue(mockInvitationData as any);
            mockEmailService.sendInvitationEmail.mockResolvedValue({ success: true, messageId: 'resend-message-id' });

            const result = await invitationService.resendInvitation(invitationId, mockInviterData._id);

            expect(result.success).toBe(true);
            expect(mockEmailService.sendInvitationEmail).toHaveBeenCalled();
        });

        it('should reject resending accepted invitation', async () => {
            const invitationId = testUtils.createObjectId();
            const acceptedInvitation = {
                _id: invitationId,
                status: 'accepted'
            };

            mockInvitation.findById.mockResolvedValue(acceptedInvitation as any);

            const result = await invitationService.resendInvitation(invitationId, mockInviterData._id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot resend accepted invitation');
        });
    });

    describe('revokeInvitation', () => {
        it('should revoke invitation successfully', async () => {
            const invitationId = testUtils.createObjectId();
            const mockInvitationData = {
                _id: invitationId,
                status: 'pending',
                workspaceId: mockWorkspaceData._id
            };

            mockInvitation.findById.mockResolvedValue(mockInvitationData as any);
            mockInvitation.findByIdAndUpdate.mockResolvedValue({
                ...mockInvitationData,
                status: 'revoked'
            } as any);

            const result = await invitationService.revokeInvitation(invitationId, mockInviterData._id);

            expect(result.success).toBe(true);
            expect(mockInvitation.findByIdAndUpdate).toHaveBeenCalledWith(
                invitationId,
                { status: 'revoked', revokedAt: expect.any(Date) }
            );
        });

        it('should reject revoking accepted invitation', async () => {
            const invitationId = testUtils.createObjectId();
            const acceptedInvitation = {
                _id: invitationId,
                status: 'accepted'
            };

            mockInvitation.findById.mockResolvedValue(acceptedInvitation as any);

            const result = await invitationService.revokeInvitation(invitationId, mockInviterData._id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot revoke accepted invitation');
        });
    });

    describe('getWorkspaceInvitations', () => {
        it('should return workspace invitations with pagination', async () => {
            const mockInvitations = [
                { _id: testUtils.createObjectId(), email: 'user1@example.com', status: 'pending' },
                { _id: testUtils.createObjectId(), email: 'user2@example.com', status: 'accepted' }
            ];

            mockInvitation.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            skip: jest.fn().mockResolvedValue(mockInvitations)
                        })
                    })
                })
            } as any);

            mockInvitation.countDocuments.mockResolvedValue(2);

            const result = await invitationService.getWorkspaceInvitations(
                mockWorkspaceData._id,
                { page: 1, limit: 10 }
            );

            expect(result.invitations).toEqual(mockInvitations);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(1);
        });
    });

    describe('validateInvitationData', () => {
        it('should validate correct invitation data', () => {
            const validData = {
                email: 'user@example.com',
                role: 'Pharmacist',
                workspaceId: testUtils.createObjectId(),
                invitedBy: testUtils.createObjectId()
            };

            const result = invitationService.validateInvitationData(validData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject invalid email format', () => {
            const invalidData = {
                email: 'invalid-email',
                role: 'Pharmacist',
                workspaceId: testUtils.createObjectId(),
                invitedBy: testUtils.createObjectId()
            };

            const result = invitationService.validateInvitationData(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid email format');
        });

        it('should reject invalid role', () => {
            const invalidData = {
                email: 'user@example.com',
                role: 'InvalidRole',
                workspaceId: testUtils.createObjectId(),
                invitedBy: testUtils.createObjectId()
            };

            const result = invitationService.validateInvitationData(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid role specified');
        });
    });
});