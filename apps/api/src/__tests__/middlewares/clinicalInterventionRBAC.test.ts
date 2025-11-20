import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
    requireInterventionCreate,
    requireInterventionRead,
    requireInterventionUpdate,
    requireInterventionDelete,
    requireInterventionAssign,
    requireInterventionReports,
    requireInterventionExport,
    checkInterventionAccess,
    checkInterventionModifyAccess,
    checkInterventionAssignAccess,
    checkInterventionReportAccess,
    checkInterventionPlanLimits,
} from '../../middlewares/clinicalInterventionRBAC';
import { AuthRequest, WorkspaceContext } from '../../types/auth';
import ClinicalIntervention from '../../models/ClinicalIntervention';
import User from '../../models/User';
import Workplace from '../../models/Workplace';

// Mock the rbac middleware
jest.mock('../../middlewares/rbac', () => ({
    requirePermission: jest.fn((permission: string) => {
        return (req: AuthRequest, res: Response, next: NextFunction) => {
            // Mock permission check based on user role and workspace context
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }

            if (!req.workspaceContext) {
                return res.status(500).json({ success: false, message: 'Workspace context not loaded' });
            }

            // Super admin bypasses all checks
            if (req.user.role === 'super_admin') {
                return next();
            }

            // Mock permission logic based on permission type
            const userRole = req.user.workplaceRole;
            const hasFeature = req.workspaceContext.permissions.includes('clinicalInterventions');

            if (!hasFeature) {
                return res.status(402).json({
                    success: false,
                    message: 'Clinical interventions feature not available',
                    upgradeRequired: true,
                });
            }

            // Role-based permission checks
            switch (permission) {
                case 'clinical_intervention.create':
                case 'clinical_intervention.update':
                case 'clinical_intervention.delete':
                case 'clinical_intervention.assign':
                    if (!['Owner', 'Pharmacist'].includes(userRole || '')) {
                        return res.status(403).json({
                            success: false,
                            message: 'Insufficient permissions',
                            requiredRoles: ['Owner', 'Pharmacist'],
                        });
                    }
                    break;
                case 'clinical_intervention.read':
                    if (!['Owner', 'Pharmacist', 'Technician'].includes(userRole || '')) {
                        return res.status(403).json({
                            success: false,
                            message: 'Insufficient permissions',
                            requiredRoles: ['Owner', 'Pharmacist', 'Technician'],
                        });
                    }
                    break;
                case 'clinical_intervention.reports':
                case 'clinical_intervention.export':
                    if (!['Owner', 'Pharmacist'].includes(userRole || '')) {
                        return res.status(403).json({
                            success: false,
                            message: 'Insufficient permissions',
                            requiredRoles: ['Owner', 'Pharmacist'],
                        });
                    }
                    const hasAdvancedReports = req.workspaceContext.permissions.includes('advancedReports');
                    if (!hasAdvancedReports) {
                        return res.status(402).json({
                            success: false,
                            message: 'Advanced reporting not available',
                            upgradeRequired: true,
                        });
                    }
                    break;
            }

            next();
        };
    }),
}));

describe('Clinical Intervention RBAC Middleware', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let testIntervention: any;
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Close existing connection if any
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }

        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear collections
        await User.deleteMany({});
        await Workplace.deleteMany({});
        await ClinicalIntervention.deleteMany({});

        // Create test data
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: 'Test Address',
            phone: '1234567890',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            subscriptionStatus: 'active',
        });

        testUser = await User.create({
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'test@pharmacist.com',
            passwordHash: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            workplaceRole: 'Pharmacist',
            status: 'active',
            licenseStatus: 'approved',
        });

        testIntervention = await ClinicalIntervention.create({
            workplaceId: testWorkplace._id,
            patientId: new mongoose.Types.ObjectId(),
            interventionNumber: 'CI-202401-0001',
            category: 'drug_therapy_problem',
            priority: 'high',
            issueDescription: 'Test intervention description',
            identifiedDate: new Date(),
            identifiedBy: testUser._id,
            status: 'identified',
            strategies: [],
            assignments: [],
            outcomes: {
                patientResponse: 'unknown',
                clinicalParameters: [],
                successMetrics: {
                    problemResolved: false,
                    medicationOptimized: false,
                    adherenceImproved: false,
                },
            },
            followUp: {
                required: false,
            },
            createdBy: testUser._id,
        });

        // Setup mock request and response
        req = {
            user: testUser,
            workspaceContext: {
                workspace: testWorkplace,
                subscription: null,
                plan: null,
                permissions: ['clinicalInterventions', 'advancedReports'],
                limits: {
                    patients: null,
                    users: null,
                    locations: null,
                    storage: null,
                    apiCalls: null,
                    interventions: 100
                },
                isTrialExpired: false,
                isSubscriptionActive: true,
            } as WorkspaceContext,
            params: {},
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        next = jest.fn();
    });

    describe('Basic Permission Middleware', () => {
        it('should allow pharmacist to create interventions', async () => {
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow technician to read interventions', async () => {
            req.user!.workplaceRole = 'Technician';
            await requireInterventionRead(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny assistant from creating interventions', async () => {
            req.user!.workplaceRole = 'Assistant';
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should deny access without clinical interventions feature', async () => {
            req.workspaceContext!.permissions = []; // Remove feature
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(402);
        });

        it('should allow super admin to bypass all checks', async () => {
            req.user!.role = 'super_admin';
            req.workspaceContext!.permissions = []; // Remove all features
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('checkInterventionAccess', () => {
        it('should allow access to intervention from same workplace', async () => {
            req.params!.id = testIntervention._id.toString();
            await checkInterventionAccess(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny access to intervention from different workplace', async () => {
            // Create intervention from different workplace
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                address: 'Other Address',
                phone: '0987654321',
                email: 'other@pharmacy.com',
                licenseNumber: 'OTHER123',
                subscriptionStatus: 'active',
            });

            const otherIntervention = await ClinicalIntervention.create({
                workplaceId: otherWorkplace._id,
                patientId: new mongoose.Types.ObjectId(),
                interventionNumber: 'CI-202401-0002',
                category: 'drug_therapy_problem',
                priority: 'medium',
                issueDescription: 'Other intervention description',
                identifiedDate: new Date(),
                identifiedBy: testUser._id,
                status: 'identified',
                strategies: [],
                assignments: [],
                outcomes: {
                    patientResponse: 'unknown',
                    clinicalParameters: [],
                    successMetrics: {
                        problemResolved: false,
                        medicationOptimized: false,
                        adherenceImproved: false,
                    },
                },
                followUp: {
                    required: false,
                },
                createdBy: testUser._id,
            });

            req.params!.id = otherIntervention._id.toString();
            await checkInterventionAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return 404 for non-existent intervention', async () => {
            req.params!.id = new mongoose.Types.ObjectId().toString();
            await checkInterventionAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should allow super admin to access any intervention', async () => {
            req.user!.role = 'super_admin';
            req.params!.id = testIntervention._id.toString();
            await checkInterventionAccess(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('checkInterventionModifyAccess', () => {
        it('should allow pharmacist to modify any intervention in their workplace', async () => {
            req.params!.id = testIntervention._id.toString();
            await checkInterventionModifyAccess(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow owner to modify any intervention in their workplace', async () => {
            req.user!.workplaceRole = 'Owner';
            req.params!.id = testIntervention._id.toString();
            await checkInterventionModifyAccess(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow technician to modify only their own interventions', async () => {
            req.user!.workplaceRole = 'Technician';
            req.params!.id = testIntervention._id.toString();
            await checkInterventionModifyAccess(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled(); // Should pass because testUser created the intervention
        });

        it('should deny technician from modifying others interventions', async () => {
            // Create another user
            const otherUser = await User.create({
                firstName: 'Other',
                lastName: 'User',
                email: 'other@user.com',
                passwordHash: 'hashedpassword',
                role: 'pharmacist',
                workplaceId: testWorkplace._id,
                workplaceRole: 'Pharmacist',
                status: 'active',
            });

            // Create intervention by other user
            const otherIntervention = await ClinicalIntervention.create({
                workplaceId: testWorkplace._id,
                patientId: new mongoose.Types.ObjectId(),
                interventionNumber: 'CI-202401-0003',
                category: 'adverse_drug_reaction',
                priority: 'low',
                issueDescription: 'Other user intervention',
                identifiedDate: new Date(),
                identifiedBy: otherUser._id,
                status: 'identified',
                strategies: [],
                assignments: [],
                outcomes: {
                    patientResponse: 'unknown',
                    clinicalParameters: [],
                    successMetrics: {
                        problemResolved: false,
                        medicationOptimized: false,
                        adherenceImproved: false,
                    },
                },
                followUp: {
                    required: false,
                },
                createdBy: otherUser._id,
            });

            req.user!.workplaceRole = 'Technician';
            req.params!.id = otherIntervention._id.toString();
            await checkInterventionModifyAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('checkInterventionAssignAccess', () => {
        it('should allow pharmacist with team management to assign team members', async () => {
            req.workspaceContext!.permissions.push('teamManagement');
            await checkInterventionAssignAccess(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny assignment without team management feature', async () => {
            req.workspaceContext!.permissions = ['clinicalInterventions']; // Remove teamManagement
            await checkInterventionAssignAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(402);
        });

        it('should deny technician from assigning team members', async () => {
            req.user!.workplaceRole = 'Technician';
            req.workspaceContext!.permissions.push('teamManagement');
            await checkInterventionAssignAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('checkInterventionReportAccess', () => {
        it('should allow pharmacist with advanced reports to access reports', async () => {
            await checkInterventionReportAccess(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny access without advanced reports feature', async () => {
            req.workspaceContext!.permissions = ['clinicalInterventions']; // Remove advancedReports
            await checkInterventionReportAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(402);
        });

        it('should deny access with insufficient plan tier', async () => {
            // Mock plan with basic tier
            req.workspaceContext!.plan = { tier: 'basic' } as any;
            await checkInterventionReportAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(402);
        });

        it('should deny technician from accessing reports', async () => {
            req.user!.workplaceRole = 'Technician';
            await checkInterventionReportAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('checkInterventionPlanLimits', () => {
        it('should allow creation within plan limits', async () => {
            await checkInterventionPlanLimits(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow creation with no limits set', async () => {
            req.workspaceContext!.limits!.interventions = null;
            await checkInterventionPlanLimits(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny creation when limit exceeded', async () => {
            req.workspaceContext!.limits!.interventions = 1; // Set limit to 1
            // testIntervention already exists, so we're at the limit
            await checkInterventionPlanLimits(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(429);
        });

        it('should allow super admin to bypass limits', async () => {
            req.user!.role = 'super_admin';
            req.workspaceContext!.limits!.interventions = 0; // Set limit to 0
            await checkInterventionPlanLimits(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Mock mongoose to throw an error
            const originalFindById = ClinicalIntervention.findById;
            ClinicalIntervention.findById = jest.fn().mockRejectedValue(new Error('Database error'));

            req.params!.id = testIntervention._id.toString();
            await checkInterventionAccess(req as AuthRequest, res as Response, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);

            // Restore original method
            ClinicalIntervention.findById = originalFindById;
        });

        it('should handle missing authentication', async () => {
            req.user = undefined;
            await checkInterventionAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should handle missing workspace context', async () => {
            req.workspaceContext = undefined;
            await checkInterventionAssignAccess(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});