import { Request, Response, NextFunction } from 'express';
import {
    requireInterventionCreate,
    requireInterventionRead,
    requireInterventionUpdate,
    requireInterventionDelete,
    requireInterventionAssign,
    requireInterventionReports,
    requireInterventionExport,
} from '../../middlewares/clinicalInterventionRBAC';
import { AuthRequest, WorkspaceContext } from '../../types/auth';

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

describe('Clinical Intervention RBAC Middleware - Basic Tests', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        // Setup mock request and response
        req = {
            user: {
                _id: 'user123',
                role: 'pharmacist',
                workplaceRole: 'Pharmacist',
            } as any,
            workspaceContext: {
                workspace: { _id: 'workspace123' } as any,
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

        it('should deny access without authentication', async () => {
            req.user = undefined;
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should deny access without workspace context', async () => {
            req.workspaceContext = undefined;
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('Reporting Permission Middleware', () => {
        it('should allow pharmacist with advanced reports to access reports', async () => {
            await requireInterventionReports(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny access without advanced reports feature', async () => {
            req.workspaceContext!.permissions = ['clinicalInterventions']; // Remove advancedReports
            await requireInterventionReports(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(402);
        });

        it('should deny technician from accessing reports', async () => {
            req.user!.workplaceRole = 'Technician';
            await requireInterventionReports(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Export Permission Middleware', () => {
        it('should allow pharmacist with advanced reports to export data', async () => {
            await requireInterventionExport(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny export without advanced reports feature', async () => {
            req.workspaceContext!.permissions = ['clinicalInterventions']; // Remove advancedReports
            await requireInterventionExport(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(402);
        });
    });

    describe('Assignment Permission Middleware', () => {
        it('should allow pharmacist to assign team members', async () => {
            await requireInterventionAssign(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow owner to assign team members', async () => {
            req.user!.workplaceRole = 'Owner';
            await requireInterventionAssign(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny technician from assigning team members', async () => {
            req.user!.workplaceRole = 'Technician';
            await requireInterventionAssign(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('CRUD Permission Middleware', () => {
        it('should allow owner to perform all CRUD operations', async () => {
            req.user!.workplaceRole = 'Owner';

            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();

            jest.clearAllMocks();
            await requireInterventionRead(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();

            jest.clearAllMocks();
            await requireInterventionUpdate(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();

            jest.clearAllMocks();
            await requireInterventionDelete(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
        });

        it('should allow pharmacist to perform all CRUD operations', async () => {
            req.user!.workplaceRole = 'Pharmacist';

            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();

            jest.clearAllMocks();
            await requireInterventionRead(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();

            jest.clearAllMocks();
            await requireInterventionUpdate(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();

            jest.clearAllMocks();
            await requireInterventionDelete(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();
        });

        it('should allow technician to read but not create/update/delete', async () => {
            req.user!.workplaceRole = 'Technician';

            // Should allow read
            await requireInterventionRead(req as AuthRequest, res as Response, next);
            expect(next).toHaveBeenCalled();

            // Should deny create
            jest.clearAllMocks();
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);

            // Should deny update
            jest.clearAllMocks();
            await requireInterventionUpdate(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);

            // Should deny delete
            jest.clearAllMocks();
            await requireInterventionDelete(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should deny assistant from all operations except basic read', async () => {
            req.user!.workplaceRole = 'Assistant';

            // Should deny read (Assistant not in allowed roles for interventions)
            await requireInterventionRead(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);

            // Should deny create
            jest.clearAllMocks();
            await requireInterventionCreate(req as AuthRequest, res as Response, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });
});