import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/auth';
import { requireWorkspaceOwner } from '../../middlewares/rbac';
import mongoose from 'mongoose';

describe('requireWorkspaceOwner Middleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    const mockUserId = new mongoose.Types.ObjectId();
    const mockWorkplaceId = new mongoose.Types.ObjectId();
    const mockOtherUserId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        // Reset mocks
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        mockNext = jest.fn();

        // Setup default request with authenticated user and workspace
        mockRequest = {
            user: {
                _id: mockUserId,
                email: 'owner@test.com',
                firstName: 'Test',
                lastName: 'Owner',
                role: 'pharmacy_outlet',
                workplaceRole: 'Owner',
                status: 'active',
                workplaceId: mockWorkplaceId,
            } as any,
            workspaceContext: {
                workspace: {
                    _id: mockWorkplaceId,
                    name: 'Test Pharmacy',
                    ownerId: mockUserId,
                } as any,
                subscription: null,
                plan: null,
                permissions: [],
                limits: {
                    patients: null,
                    users: null,
                    locations: null,
                    storage: null,
                    apiCalls: null,
                },
                isTrialExpired: false,
                isSubscriptionActive: true,
            },
        };

        mockResponse = {
            status: statusMock,
            json: jsonMock,
        };
    });

    describe('Successful Authorization', () => {
        it('should allow access when user is workspace owner', () => {
            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(statusMock).not.toHaveBeenCalled();
            expect(jsonMock).not.toHaveBeenCalled();
        });

        it('should attach workplaceId to request when user is owner', () => {
            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect((mockRequest as any).workplaceId).toEqual(mockWorkplaceId);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow super_admin to bypass ownership checks', () => {
            // Change user to super_admin who is not the owner
            mockRequest.user!.role = 'super_admin';
            mockRequest.workspaceContext!.workspace!.ownerId = mockOtherUserId;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should attach workplaceId for super_admin', () => {
            mockRequest.user!.role = 'super_admin';

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect((mockRequest as any).workplaceId).toEqual(mockWorkplaceId);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Authentication Errors', () => {
        it('should return 401 when user is not authenticated', () => {
            mockRequest.user = undefined;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Authentication required',
                error: 'User not authenticated',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 when user is null', () => {
            mockRequest.user = null as any;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Authentication required',
                error: 'User not authenticated',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('Workspace Context Errors', () => {
        it('should return 403 when workspaceContext is missing', () => {
            mockRequest.workspaceContext = undefined;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'No workspace associated with user',
                error: 'Access denied',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 403 when workspace is null', () => {
            mockRequest.workspaceContext!.workspace = null;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'No workspace associated with user',
                error: 'Access denied',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 403 when workspace is undefined', () => {
            mockRequest.workspaceContext!.workspace = undefined as any;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'No workspace associated with user',
                error: 'Access denied',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('Ownership Validation', () => {
        it('should return 403 when user is not the workspace owner', () => {
            // Change workspace owner to different user
            mockRequest.workspaceContext!.workspace!.ownerId = mockOtherUserId;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Workspace owner access required',
                error: 'Only workspace owners can access this resource',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should not attach workplaceId when user is not owner', () => {
            mockRequest.workspaceContext!.workspace!.ownerId = mockOtherUserId;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect((mockRequest as any).workplaceId).toBeUndefined();
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle ObjectId comparison correctly', () => {
            // Ensure ObjectIds are compared as strings
            const sameIdString = mockUserId.toString();
            mockRequest.workspaceContext!.workspace!.ownerId = new mongoose.Types.ObjectId(sameIdString) as any;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });
    });

    describe('Role-Based Access', () => {
        it('should deny access for pharmacy_team role even if they are in the workspace', () => {
            mockRequest.user!.role = 'pharmacy_team';
            mockRequest.workspaceContext!.workspace!.ownerId = mockOtherUserId;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should deny access for pharmacist role even if they are in the workspace', () => {
            mockRequest.user!.role = 'pharmacist';
            mockRequest.workspaceContext!.workspace!.ownerId = mockOtherUserId;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should allow access for pharmacy_outlet role when they are the owner', () => {
            mockRequest.user!.role = 'pharmacy_outlet';

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing user role gracefully', () => {
            delete (mockRequest.user as any).role;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            // Should still check ownership even without explicit role
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle workspace without ownerId', () => {
            delete (mockRequest.workspaceContext!.workspace as any).ownerId;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            // Should fail because ownerId is undefined
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle workspace without _id', () => {
            delete (mockRequest.workspaceContext!.workspace as any)._id;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            // Should still validate ownership
            expect(mockNext).toHaveBeenCalled();
            // workplaceId should not be attached since _id is missing
            expect((mockRequest as any).workplaceId).toBeUndefined();
        });
    });

    describe('Response Format', () => {
        it('should return consistent error format for authentication failure', () => {
            mockRequest.user = undefined;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.any(String),
                    error: expect.any(String),
                })
            );
        });

        it('should return consistent error format for authorization failure', () => {
            mockRequest.workspaceContext!.workspace!.ownerId = mockOtherUserId;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.any(String),
                    error: expect.any(String),
                })
            );
        });
    });

    describe('Integration Scenarios', () => {
        it('should work in a typical authenticated request flow', () => {
            // Simulate a complete request flow
            const request = {
                user: {
                    _id: mockUserId,
                    email: 'owner@pharmacy.com',
                    role: 'pharmacy_outlet',
                    workplaceId: mockWorkplaceId,
                } as any,
                workspaceContext: {
                    workspace: {
                        _id: mockWorkplaceId,
                        name: 'My Pharmacy',
                        ownerId: mockUserId,
                    } as any,
                    subscription: null,
                    plan: null,
                    permissions: [],
                    limits: {
                        patients: null,
                        users: null,
                        locations: null,
                        storage: null,
                        apiCalls: null,
                    },
                    isTrialExpired: false,
                    isSubscriptionActive: true,
                },
            } as AuthRequest;

            requireWorkspaceOwner(request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect((request as any).workplaceId).toEqual(mockWorkplaceId);
        });

        it('should prevent cross-workspace access', () => {
            // User tries to access a different workspace
            const differentWorkplaceId = new mongoose.Types.ObjectId();
            const differentOwnerId = new mongoose.Types.ObjectId();

            mockRequest.workspaceContext!.workspace = {
                _id: differentWorkplaceId,
                name: 'Different Pharmacy',
                ownerId: differentOwnerId,
            } as any;

            requireWorkspaceOwner(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
