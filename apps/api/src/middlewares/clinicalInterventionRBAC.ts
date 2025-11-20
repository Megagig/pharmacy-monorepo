import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { requirePermission } from './rbac';
import ClinicalIntervention from '../models/ClinicalIntervention';
import logger from '../utils/logger';

/**
 * RBAC middleware for clinical intervention create operations
 */
export const requireInterventionCreate = requirePermission('clinical_intervention.create');

/**
 * RBAC middleware for clinical intervention read operations
 */
export const requireInterventionRead = requirePermission('clinical_intervention.read');

/**
 * RBAC middleware for clinical intervention update operations
 */
export const requireInterventionUpdate = requirePermission('clinical_intervention.update');

/**
 * RBAC middleware for clinical intervention delete operations
 */
export const requireInterventionDelete = requirePermission('clinical_intervention.delete');

/**
 * RBAC middleware for clinical intervention assignment operations
 */
export const requireInterventionAssign = requirePermission('clinical_intervention.assign');

/**
 * RBAC middleware for clinical intervention reporting operations
 */
export const requireInterventionReports = requirePermission('clinical_intervention.reports');

/**
 * RBAC middleware for clinical intervention export operations
 */
export const requireInterventionExport = requirePermission('clinical_intervention.export');

/**
 * Middleware to check if user can access specific intervention
 * Ensures users can only access interventions from their workplace
 */
export const checkInterventionAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        if (!req.workspaceContext?.workspace) {
            res.status(403).json({
                success: false,
                message: 'No workspace associated with user',
            });
            return;
        }

        const interventionId = req.params.id;
        if (!interventionId) {
            // No specific intervention ID, allow general access
            return next();
        }

        // Super admin bypasses workspace checks
        if (req.user.role === 'super_admin') {
            return next();
        }

        // Check if intervention belongs to user's workplace
        const intervention = await ClinicalIntervention.findById(interventionId)
            .select('workplaceId identifiedBy')
            .lean();

        if (!intervention) {
            res.status(404).json({
                success: false,
                message: 'Clinical intervention not found',
            });
            return;
        }

        const userWorkplaceId = req.workspaceContext.workspace._id.toString();
        const interventionWorkplaceId = intervention.workplaceId.toString();

        if (interventionWorkplaceId !== userWorkplaceId) {
            res.status(403).json({
                success: false,
                message: 'Access denied. Intervention belongs to different workplace.',
            });
            return;
        }

        // Store intervention data in request for potential use by controllers
        req.interventionData = intervention;

        next();
    } catch (error) {
        logger.error('Error checking intervention access:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking intervention access',
        });
    }
};

/**
 * Middleware to check if user can modify specific intervention
 * Only allows modification by intervention creator or workplace owners/pharmacists
 */
export const checkInterventionModifyAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const interventionId = req.params.id;
        if (!interventionId) {
            res.status(400).json({
                success: false,
                message: 'Intervention ID is required',
            });
            return;
        }

        // Super admin bypasses all checks
        if (req.user.role === 'super_admin') {
            return next();
        }

        // Workplace owners and pharmacists can modify any intervention in their workplace
        if (['Owner', 'Pharmacist'].includes(req.user.workplaceRole || '')) {
            return next();
        }

        // Other roles can only modify interventions they created
        const intervention = await ClinicalIntervention.findById(interventionId)
            .select('identifiedBy workplaceId')
            .lean();

        if (!intervention) {
            res.status(404).json({
                success: false,
                message: 'Clinical intervention not found',
            });
            return;
        }

        const isCreator = intervention.identifiedBy.toString() === req.user._id.toString();
        if (!isCreator) {
            res.status(403).json({
                success: false,
                message: 'Access denied. You can only modify interventions you created.',
            });
            return;
        }

        next();
    } catch (error) {
        logger.error('Error checking intervention modify access:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking intervention modify access',
        });
    }
};

/**
 * Middleware to check if user can assign team members to interventions
 * Requires team management permissions and appropriate role
 */
export const checkInterventionAssignAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        if (!req.workspaceContext) {
            res.status(500).json({
                success: false,
                message: 'Workspace context not loaded',
            });
            return;
        }

        // Super admin bypasses all checks
        if (req.user.role === 'super_admin') {
            return next();
        }

        // Check if user has team management permissions
        const hasTeamManagement = req.workspaceContext.permissions.includes('teamManagement');
        if (!hasTeamManagement) {
            res.status(402).json({
                success: false,
                message: 'Team management feature not available in your plan',
                upgradeRequired: true,
            });
            return;
        }

        // Only owners and pharmacists can assign team members
        if (!['Owner', 'Pharmacist'].includes(req.user.workplaceRole || '')) {
            res.status(403).json({
                success: false,
                message: 'Insufficient role permissions for team assignment',
                requiredRoles: ['Owner', 'Pharmacist'],
                userRole: req.user.workplaceRole,
            });
            return;
        }

        next();
    } catch (error) {
        logger.error('Error checking intervention assign access:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking intervention assign access',
        });
    }
};

/**
 * Middleware to check if user can access intervention reports
 * Requires advanced reporting permissions and appropriate plan tier
 */
export const checkInterventionReportAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        if (!req.workspaceContext) {
            res.status(500).json({
                success: false,
                message: 'Workspace context not loaded',
            });
            return;
        }

        // Super admin bypasses all checks
        if (req.user.role === 'super_admin') {
            return next();
        }

        // Check if user has advanced reporting permissions
        const hasAdvancedReports = req.workspaceContext.permissions.includes('advancedReports');
        if (!hasAdvancedReports) {
            res.status(402).json({
                success: false,
                message: 'Advanced reporting feature not available in your plan',
                upgradeRequired: true,
                requiredFeatures: ['advancedReports'],
            });
            return;
        }

        // Check plan tier for advanced reporting
        const currentTier = req.workspaceContext.plan?.tier;
        const allowedTiers = ['pro', 'pharmily', 'network', 'enterprise'];

        if (!currentTier || !allowedTiers.includes(currentTier)) {
            res.status(402).json({
                success: false,
                message: 'Advanced reporting requires Pro plan or higher',
                upgradeRequired: true,
                currentTier,
                requiredTiers: allowedTiers,
            });
            return;
        }

        // Only owners and pharmacists can access reports
        if (!['Owner', 'Pharmacist'].includes(req.user.workplaceRole || '')) {
            res.status(403).json({
                success: false,
                message: 'Insufficient role permissions for reporting',
                requiredRoles: ['Owner', 'Pharmacist'],
                userRole: req.user.workplaceRole,
            });
            return;
        }

        next();
    } catch (error) {
        logger.error('Error checking intervention report access:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking intervention report access',
        });
    }
};

/**
 * Middleware to check intervention plan limits
 * Ensures user hasn't exceeded their intervention creation limits
 */
export const checkInterventionPlanLimits = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        if (!req.workspaceContext) {
            res.status(500).json({
                success: false,
                message: 'Workspace context not loaded',
            });
            return;
        }

        // Super admin bypasses limits
        if (req.user.role === 'super_admin') {
            return next();
        }

        // Check if there are intervention limits in the plan
        const interventionLimit = req.workspaceContext.limits?.interventions;
        if (interventionLimit === null || interventionLimit === undefined) {
            // No limit set, allow creation
            return next();
        }

        // Count current interventions for this workspace
        const currentCount = await ClinicalIntervention.countDocuments({
            workplaceId: req.workspaceContext.workspace?._id,
            isDeleted: false,
        });

        if (currentCount >= interventionLimit) {
            res.status(429).json({
                success: false,
                message: 'Intervention limit exceeded for your plan',
                limit: interventionLimit,
                current: currentCount,
                upgradeRequired: true,
            });
            return;
        }

        next();
    } catch (error) {
        logger.error('Error checking intervention plan limits:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking intervention plan limits',
        });
    }
};

export default {
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
};