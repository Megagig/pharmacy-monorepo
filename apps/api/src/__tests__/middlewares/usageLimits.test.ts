import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/auth';
import { enforcePlanLimit } from '../../middlewares/usageLimits';
import WorkplaceModel, { IWorkplace } from '../../models/Workplace';
import SubscriptionPlanModel, { ISubscriptionPlan } from '../../models/SubscriptionPlan';
import PatientModel, { IPatient } from '../../models/Patient';
import UserModel, { IUser } from '../../models/User';

// Mock dependencies
jest.mock('../../models/Workplace');
jest.mock('../../models/SubscriptionPlan');
jest.mock('../../models/Patient');
jest.mock('../../models/User');

const mockWorkplace = WorkplaceModel as jest.Mocked<typeof WorkplaceModel>;
const mockSubscriptionPlan = SubscriptionPlanModel as jest.Mocked<typeof SubscriptionPlanModel>;
const mockPatient = PatientModel as jest.Mocked<typeof PatientModel>;
const mockUser = UserModel as jest.Mocked<typeof UserModel>;

describe('usageLimitsMiddleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    const mockWorkspaceData = {
        _id: testUtils.createObjectId(),
        name: 'Test Pharmacy',
        subscriptionId: testUtils.createObjectId(),
        teamMembers: [testUtils.createObjectId(), testUtils.createObjectId()]
    };

    const mockPlanData = {
        _id: testUtils.createObjectId(),
        name: 'Basic Plan',
        code: 'basic',
        limits: {
            patients: 100,
            users: 3,
            locations: 1,
            storage: 1000,
            apiCalls: 1000
        }
    };

    beforeEach(() => {
        mockRequest = {
            user: {
                _id: testUtils.createObjectId(),
                workplaceId: mockWorkspaceData._id
            },
            body: {},
            params: {}
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();

        jest.clearAllMocks();

        // Default mocks
        mockWorkplace.findById.mockResolvedValue(mockWorkspaceData as any);
        mockSubscriptionPlan.findById.mockResolvedValue(mockPlanData as any);
    });

    describe('checkPatientLimit', () => {
        const middleware = usageLimitsMiddleware.checkPatientLimit();

        it('should allow patient creation when under limit', async () => {
            mockPatient.countDocuments.mockResolvedValue(50); // Under limit of 100

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should block patient creation when at limit', async () => {
            mockPatient.countDocuments.mockResolvedValue(100); // At limit

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Patient limit exceeded',
                limit: 100,
                current: 100,
                upgradeRequired: true
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should block patient creation when over limit', async () => {
            mockPatient.countDocuments.mockResolvedValue(105); // Over limit

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Patient limit exceeded',
                limit: 100,
                current: 105,
                upgradeRequired: true
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle unlimited plan', async () => {
            const unlimitedPlan = { ...mockPlanData, limits: { ...mockPlanData.limits, patients: -1 } };
            mockSubscriptionPlan.findById.mockResolvedValue(unlimitedPlan as any);
            mockPatient.countDocuments.mockResolvedValue(1000);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should handle missing workspace', async () => {
            mockWorkplace.findById.mockResolvedValue(null);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Workspace not found'
            });
        });

        it('should handle missing subscription plan', async () => {
            mockSubscriptionPlan.findById.mockResolvedValue(null);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Subscription plan not found'
            });
        });
    });

    describe('checkUserLimit', () => {
        const middleware = usageLimitsMiddleware.checkUserLimit();

        it('should allow user addition when under limit', async () => {
            // Workspace has 2 team members, limit is 3
            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should block user addition when at limit', async () => {
            const workspaceAtLimit = {
                ...mockWorkspaceData,
                teamMembers: [testUtils.createObjectId(), testUtils.createObjectId(), testUtils.createObjectId()]
            };
            mockWorkplace.findById.mockResolvedValue(workspaceAtLimit as any);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'User limit exceeded',
                limit: 3,
                current: 3,
                upgradeRequired: true
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle unlimited users', async () => {
            const unlimitedPlan = { ...mockPlanData, limits: { ...mockPlanData.limits, users: -1 } };
            mockSubscriptionPlan.findById.mockResolvedValue(unlimitedPlan as any);

            const workspaceWithManyUsers = {
                ...mockWorkspaceData,
                teamMembers: new Array(100).fill(testUtils.createObjectId())
            };
            mockWorkplace.findById.mockResolvedValue(workspaceWithManyUsers as any);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });
    });

    describe('checkStorageLimit', () => {
        const middleware = usageLimitsMiddleware.checkStorageLimit();

        beforeEach(() => {
            mockRequest.body = { fileSize: 500 }; // 500MB file
        });

        it('should allow file upload when under storage limit', async () => {
            // Mock current storage usage at 400MB, limit is 1000MB
            jest.spyOn(usageLimitsMiddleware, 'getCurrentStorageUsage').mockResolvedValue(400);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should block file upload when would exceed storage limit', async () => {
            // Mock current storage usage at 800MB, adding 500MB would exceed 1000MB limit
            jest.spyOn(usageLimitsMiddleware, 'getCurrentStorageUsage').mockResolvedValue(800);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(413);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Storage limit would be exceeded',
                limit: 1000,
                current: 800,
                requested: 500,
                upgradeRequired: true
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle unlimited storage', async () => {
            const unlimitedPlan = { ...mockPlanData, limits: { ...mockPlanData.limits, storage: -1 } };
            mockSubscriptionPlan.findById.mockResolvedValue(unlimitedPlan as any);
            jest.spyOn(usageLimitsMiddleware, 'getCurrentStorageUsage').mockResolvedValue(5000);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should handle missing file size', async () => {
            mockRequest.body = {}; // No fileSize

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'File size not specified'
            });
        });
    });

    describe('checkApiCallLimit', () => {
        const middleware = usageLimitsMiddleware.checkApiCallLimit();

        it('should allow API call when under limit', async () => {
            // Mock current API calls at 500, limit is 1000
            jest.spyOn(usageLimitsMiddleware, 'getCurrentApiCallCount').mockResolvedValue(500);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should block API call when at limit', async () => {
            // Mock current API calls at 1000, limit is 1000
            jest.spyOn(usageLimitsMiddleware, 'getCurrentApiCallCount').mockResolvedValue(1000);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(429);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'API call limit exceeded',
                limit: 1000,
                current: 1000,
                resetTime: expect.any(String),
                upgradeRequired: true
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle unlimited API calls', async () => {
            const unlimitedPlan = { ...mockPlanData, limits: { ...mockPlanData.limits, apiCalls: -1 } };
            mockSubscriptionPlan.findById.mockResolvedValue(unlimitedPlan as any);
            jest.spyOn(usageLimitsMiddleware, 'getCurrentApiCallCount').mockResolvedValue(5000);

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });
    });

    describe('getUsageStats', () => {
        it('should return current usage statistics', async () => {
            jest.spyOn(usageLimitsMiddleware, 'getCurrentStorageUsage').mockResolvedValue(400);
            jest.spyOn(usageLimitsMiddleware, 'getCurrentApiCallCount').mockResolvedValue(500);
            mockPatient.countDocuments.mockResolvedValue(75);

            const stats = await usageLimitsMiddleware.getUsageStats(mockWorkspaceData._id);

            expect(stats).toEqual({
                patients: { current: 75, limit: 100, percentage: 75 },
                users: { current: 2, limit: 3, percentage: 66.67 },
                storage: { current: 400, limit: 1000, percentage: 40 },
                apiCalls: { current: 500, limit: 1000, percentage: 50 }
            });
        });

        it('should handle unlimited limits in stats', async () => {
            const unlimitedPlan = {
                ...mockPlanData,
                limits: {
                    patients: -1,
                    users: -1,
                    storage: -1,
                    apiCalls: -1
                }
            };
            mockSubscriptionPlan.findById.mockResolvedValue(unlimitedPlan as any);

            jest.spyOn(usageLimitsMiddleware, 'getCurrentStorageUsage').mockResolvedValue(400);
            jest.spyOn(usageLimitsMiddleware, 'getCurrentApiCallCount').mockResolvedValue(500);
            mockPatient.countDocuments.mockResolvedValue(75);

            const stats = await usageLimitsMiddleware.getUsageStats(mockWorkspaceData._id);

            expect(stats).toEqual({
                patients: { current: 75, limit: -1, percentage: 0 },
                users: { current: 2, limit: -1, percentage: 0 },
                storage: { current: 400, limit: -1, percentage: 0 },
                apiCalls: { current: 500, limit: -1, percentage: 0 }
            });
        });
    });

    describe('error handling', () => {
        it('should handle database errors gracefully', async () => {
            const middleware = usageLimitsMiddleware.checkPatientLimit();
            mockWorkplace.findById.mockRejectedValue(new Error('Database error'));

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Failed to check usage limits'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle missing user in request', async () => {
            const middleware = usageLimitsMiddleware.checkPatientLimit();
            mockRequest.user = undefined;

            await middleware(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'User not authenticated'
            });
        });
    });
});