import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';

// Import services
import ClinicalInterventionService, {
    CreateInterventionDTO,
    UpdateInterventionDTO,
    InterventionFilters,
    PaginatedResult
} from '../services/clinicalInterventionService';

// Import models
import ClinicalIntervention, { IClinicalIntervention } from '../models/ClinicalIntervention';

// Import utilities
import {
    sendSuccess,
    sendError,
    asyncHandler,
    getRequestContext,
    createValidationError,
    createNotFoundError,
    createBusinessRuleError,
    PatientManagementError,
    ErrorCode
} from '../utils/responseHelpers';
import logger from '../utils/logger';

// Helper function to validate and convert ObjectId
const validateObjectId = (id: string | undefined, fieldName: string): mongoose.Types.ObjectId => {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw createValidationError(`Invalid ${fieldName} format`);
    }
    return new mongoose.Types.ObjectId(id);
};

/**
 * Clinical Intervention Controller
 * Handles HTTP requests for Clinical Interventions module
 */

// Helper function to safely convert context to ObjectIds
const getValidatedContext = (req: AuthRequest) => {
    const context = getRequestContext(req);

    if (!context.userId || !context.workplaceId) {
        throw createValidationError('Missing user or workplace context');
    }

    return {
        ...context,
        userIdObj: new mongoose.Types.ObjectId(context.userId),
        workplaceIdObj: new mongoose.Types.ObjectId(context.workplaceId),
        isSuperAdmin: context.isSuperAdmin || req.user?.role === 'super_admin'
    };
};

// Type for validated context
type ValidatedContext = ReturnType<typeof getValidatedContext>;

// ===============================
// CORE CRUD OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions
 * List interventions with filtering, sorting, and pagination
 */
export const getClinicalInterventions = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            patientId,
            category,
            priority,
            status,
            identifiedBy,
            assignedTo,
            dateFrom,
            dateTo,
            search,
            sortBy = 'identifiedDate',
            sortOrder = 'desc'
        } = req.query as any;

        // Build filters
        const filters: InterventionFilters = {
            workplaceId: context.workplaceIdObj,
            page: Math.max(1, parseInt(page) || 1),
            limit: Math.min(50, Math.max(1, parseInt(limit) || 20)),
            sortBy,
            sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
            isSuperAdmin: context.isSuperAdmin || req.user?.role === 'super_admin'
        };

        // Add optional filters
        if (patientId) {
            if (!mongoose.Types.ObjectId.isValid(patientId)) {
                throw createValidationError('Invalid patient ID format');
            }
            filters.patientId = new mongoose.Types.ObjectId(patientId);
        }

        if (category) filters.category = category;
        if (priority) filters.priority = priority;
        if (status) filters.status = status;
        if (search) filters.search = search;

        if (identifiedBy) {
            if (!mongoose.Types.ObjectId.isValid(identifiedBy)) {
                throw createValidationError('Invalid identifiedBy ID format');
            }
            filters.identifiedBy = new mongoose.Types.ObjectId(identifiedBy);
        }

        if (assignedTo) {
            if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                throw createValidationError('Invalid assignedTo ID format');
            }
            filters.assignedTo = new mongoose.Types.ObjectId(assignedTo);
        }

        // Parse date filters
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            if (isNaN(fromDate.getTime())) {
                throw createValidationError('Invalid dateFrom format');
            }
            filters.dateFrom = fromDate;
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) {
                throw createValidationError('Invalid dateTo format');
            }
            filters.dateTo = toDate;
        }

        // Get interventions from service
        const result: PaginatedResult<IClinicalIntervention> = await ClinicalInterventionService.getInterventions(filters);

        sendSuccess(res, {
            data: result.data,
            pagination: result.pagination
        }, 'Interventions retrieved successfully');
    }
);

/**
 * POST /api/clinical-interventions
 * Create new clinical intervention
 */
export const createClinicalIntervention = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract and validate request data
        const {
            patientId,
            category,
            priority,
            issueDescription,
            strategies,
            estimatedDuration,
            relatedMTRId,
            relatedDTPIds
        } = req.body;

        // Validate required fields
        if (!patientId || !category || !priority || !issueDescription) {
            throw createValidationError('Missing required fields: patientId, category, priority, issueDescription');
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            throw createValidationError('Invalid patient ID format');
        }

        if (relatedMTRId && !mongoose.Types.ObjectId.isValid(relatedMTRId)) {
            throw createValidationError('Invalid MTR ID format');
        }

        if (relatedDTPIds && Array.isArray(relatedDTPIds)) {
            for (const dtpId of relatedDTPIds) {
                if (!mongoose.Types.ObjectId.isValid(dtpId)) {
                    throw createValidationError('Invalid DTP ID format');
                }
            }
        }

        // Build intervention data
        const interventionData: CreateInterventionDTO = {
            patientId: new mongoose.Types.ObjectId(patientId),
            category,
            priority,
            issueDescription,
            identifiedBy: context.userIdObj,
            workplaceId: context.workplaceIdObj,
            strategies: strategies || [],
            estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
            relatedMTRId: relatedMTRId ? new mongoose.Types.ObjectId(relatedMTRId) : undefined,
            relatedDTPIds: relatedDTPIds ? relatedDTPIds.map((id: string) => new mongoose.Types.ObjectId(id)) : []
        };

        // Create intervention
        const intervention = await ClinicalInterventionService.createIntervention(interventionData);

        // Log access for audit trail
        await ClinicalInterventionService.logActivity(
            'CREATE_INTERVENTION',
            intervention._id.toString(),
            context.userIdObj,
            context.workplaceIdObj,
            { category: interventionData.category, priority: interventionData.priority },
            req
        );

        sendSuccess(res, intervention, 'Clinical intervention created successfully', 201);
    }
);

/**
 * GET /api/clinical-interventions/:id
 * Get intervention details by ID
 */
export const getClinicalIntervention = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const { id } = req.params;

        // Validate and convert IDs
        const interventionId = validateObjectId(id, 'intervention ID');
        const workplaceId = validateObjectId(context.workplaceId, 'workplace ID');

        // Get intervention
        const intervention = await ClinicalInterventionService.getInterventionById(
            interventionId.toString(),
            workplaceId,
            req.user?.role === 'super_admin'
        );

        // Log access for audit trail
        await ClinicalInterventionService.logActivity(
            'VIEW_INTERVENTION',
            id || '',
            new mongoose.Types.ObjectId(context.userId),
            new mongoose.Types.ObjectId(context.workplaceId),
            {
                interventionNumber: intervention.interventionNumber,
                status: intervention.status,
                category: intervention.category
            },
            req
        );

        sendSuccess(res, intervention, 'Intervention retrieved successfully');
    }
);

/**
 * PATCH /api/clinical-interventions/:id
 * Update intervention with partial updates
 */
export const updateClinicalIntervention = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        // Extract update data
        const updates: UpdateInterventionDTO = {};
        const {
            category,
            priority,
            issueDescription,
            status,
            implementationNotes,
            estimatedDuration,
            outcomes,
            followUp
        } = req.body;

        // Build updates object with only provided fields
        if (category !== undefined) updates.category = category;
        if (priority !== undefined) updates.priority = priority;
        if (issueDescription !== undefined) updates.issueDescription = issueDescription;
        if (status !== undefined) updates.status = status;
        if (implementationNotes !== undefined) updates.implementationNotes = implementationNotes;
        if (estimatedDuration !== undefined) updates.estimatedDuration = parseInt(estimatedDuration);
        if (outcomes !== undefined) updates.outcomes = outcomes;
        if (followUp !== undefined) updates.followUp = followUp;

        // Validate that at least one field is being updated
        if (Object.keys(updates).length === 0) {
            throw createValidationError('No valid fields provided for update');
        }

        // Update intervention
        const intervention = await ClinicalInterventionService.updateIntervention(
            id,
            updates,
            context.userIdObj,
            context.workplaceIdObj,
            context.isSuperAdmin || req.user?.role === 'super_admin'
        );

        // Log access for audit trail
        await ClinicalInterventionService.logActivity(
            'UPDATE_INTERVENTION',
            id,
            context.userIdObj,
            context.workplaceIdObj,
            {
                updatedFields: Object.keys(updates),
                statusChange: updates.status ? { to: updates.status } : undefined
            }
        );

        sendSuccess(res, intervention, 'Intervention updated successfully');
    }
);

/**
 * DELETE /api/clinical-interventions/:id
 * Soft delete intervention
 */
export const deleteClinicalIntervention = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        // Delete intervention
        const success = await ClinicalInterventionService.deleteIntervention(
            id,
            context.userIdObj,
            context.workplaceIdObj,
            context.isSuperAdmin || req.user?.role === 'super_admin'
        );

        if (!success) {
            throw createNotFoundError('Intervention not found or could not be deleted');
        }

        // Log access for audit trail
        await ClinicalInterventionService.logActivity(
            'DELETE_INTERVENTION',
            id,
            context.userIdObj,
            context.workplaceIdObj,
            { reason: 'soft_delete' },
            req
        );

        sendSuccess(res, {
            deleted: true
        }, 'Intervention deleted successfully');
    }
);

// ===============================
// WORKFLOW-SPECIFIC OPERATIONS
// ===============================

/**
 * POST /api/clinical-interventions/:id/strategies
 * Add intervention strategy
 */
export const addInterventionStrategy = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        // Extract strategy data
        const {
            type,
            description,
            rationale,
            expectedOutcome,
            priority = 'secondary'
        } = req.body;

        // Validate required fields
        if (!type || !description || !rationale || !expectedOutcome) {
            throw createValidationError('Missing required strategy fields: type, description, rationale, expectedOutcome');
        }

        // Build strategy object
        const strategy = {
            type,
            description,
            rationale,
            expectedOutcome,
            priority
        };

        // Add strategy through service
        const intervention = await ClinicalInterventionService.addStrategy(id!, strategy, context.userIdObj, context.workplaceIdObj);

        sendSuccess(res, {
            intervention
        }, 'Strategy added successfully');
    }
);

/**
 * PATCH /api/clinical-interventions/:id/strategies/:strategyId
 * Update intervention strategy
 */
export const updateInterventionStrategy = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id, strategyId } = req.params;

        // Validate ID formats
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        if (!strategyId || !mongoose.Types.ObjectId.isValid(strategyId)) {
            throw createValidationError('Invalid strategy ID format');
        }

        // Extract update data
        const {
            type,
            description,
            rationale,
            expectedOutcome,
            priority
        } = req.body;

        // Build updates object
        const updates: any = {};
        if (type !== undefined) updates.type = type;
        if (description !== undefined) updates.description = description;
        if (rationale !== undefined) updates.rationale = rationale;
        if (expectedOutcome !== undefined) updates.expectedOutcome = expectedOutcome;
        if (priority !== undefined) updates.priority = priority;

        // Validate that at least one field is being updated
        if (Object.keys(updates).length === 0) {
            throw createValidationError('No valid fields provided for strategy update');
        }

        // Update strategy through service
        const intervention = await ClinicalInterventionService.updateStrategy(
            id!,
            strategyId!,
            updates,
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            intervention
        }, 'Strategy updated successfully');
    }
);

/**
 * POST /api/clinical-interventions/:id/assignments
 * Assign team member to intervention
 */
export const assignTeamMember = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        // Extract assignment data
        const {
            userId,
            role,
            task,
            notes
        } = req.body;

        // Validate required fields
        if (!userId || !role || !task) {
            throw createValidationError('Missing required assignment fields: userId, role, task');
        }

        // Validate user ID format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw createValidationError('Invalid user ID format');
        }

        // Build assignment object
        const assignment = {
            userId: new mongoose.Types.ObjectId(userId),
            role,
            task,
            status: 'pending' as const,
            notes
        };

        // Assign team member through service
        const intervention = await ClinicalInterventionService.assignTeamMember(
            id!,
            assignment,
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            intervention
        }, 'Team member assigned successfully');
    }
);

/**
 * PATCH /api/clinical-interventions/:id/assignments/:assignmentId
 * Update assignment status and notes
 */
export const updateAssignment = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id, assignmentId } = req.params;

        // Validate ID formats
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        if (!assignmentId || !mongoose.Types.ObjectId.isValid(assignmentId)) {
            throw createValidationError('Invalid assignment ID format');
        }

        // Extract update data
        const { status, notes } = req.body;

        // Validate required fields
        if (!status) {
            throw createValidationError('Status is required for assignment update');
        }

        // Update assignment through service
        const intervention = await ClinicalInterventionService.updateAssignmentStatus(
            id!,
            new mongoose.Types.ObjectId(assignmentId!),
            status,
            notes,
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            intervention
        }, 'Assignment updated successfully');
    }
);

/**
 * POST /api/clinical-interventions/:id/outcomes
 * Record intervention outcomes
 */
export const recordOutcome = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        // Extract outcome data
        const {
            patientResponse,
            clinicalParameters,
            adverseEffects,
            additionalIssues,
            successMetrics
        } = req.body;

        // Validate required fields
        if (!patientResponse) {
            throw createValidationError('Patient response is required');
        }

        // Build outcome object
        const outcome = {
            patientResponse,
            clinicalParameters: clinicalParameters || [],
            adverseEffects,
            additionalIssues,
            successMetrics: successMetrics || {}
        };

        // Record outcome through service
        const intervention = await ClinicalInterventionService.recordOutcome(
            id,
            outcome,
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            intervention
        }, 'Outcome recorded successfully');
    }
);

/**
 * POST /api/clinical-interventions/:id/follow-up
 * Schedule follow-up for intervention
 */
export const scheduleFollowUp = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        // Extract follow-up data
        const {
            required,
            scheduledDate,
            notes,
            nextReviewDate
        } = req.body;

        // Validate required fields
        if (required === undefined) {
            throw createValidationError('Follow-up required flag must be specified');
        }

        // Validate dates if provided
        let parsedScheduledDate: Date | undefined;
        let parsedNextReviewDate: Date | undefined;

        if (scheduledDate) {
            parsedScheduledDate = new Date(scheduledDate);
            if (isNaN(parsedScheduledDate.getTime())) {
                throw createValidationError('Invalid scheduled date format');
            }
        }

        if (nextReviewDate) {
            parsedNextReviewDate = new Date(nextReviewDate);
            if (isNaN(parsedNextReviewDate.getTime())) {
                throw createValidationError('Invalid next review date format');
            }
        }

        // Build follow-up object
        const followUp = {
            required,
            scheduledDate: parsedScheduledDate,
            notes,
            nextReviewDate: parsedNextReviewDate
        };

        // Schedule follow-up through service
        const intervention = await ClinicalInterventionService.scheduleFollowUp(
            id,
            followUp,
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            intervention
        }, 'Follow-up scheduled successfully');
    }
);

// ===============================
// SEARCH AND ANALYTICS OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions/search
 * Advanced search with multiple filter criteria
 */
export const searchClinicalInterventions = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract advanced search parameters
        const {
            q, // General search query
            patientName,
            interventionNumber,
            categories, // Array of categories
            priorities, // Array of priorities
            statuses, // Array of statuses
            assignedUsers, // Array of user IDs
            dateRange, // Object with from/to dates
            outcomeTypes, // Array of outcome types
            page = 1,
            limit = 20,
            sortBy = 'identifiedDate',
            sortOrder = 'desc'
        } = req.query as any;

        // Build advanced filters
        const filters: InterventionFilters = {
            workplaceId: context.workplaceIdObj,
            page: Math.max(1, parseInt(page) || 1),
            limit: Math.min(50, Math.max(1, parseInt(limit) || 20)),
            sortBy,
            sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
            isSuperAdmin: context.isSuperAdmin || req.user?.role === 'super_admin'
        };

        // Add search query
        if (q) {
            filters.search = q;
        }

        // Add category filter (multiple categories)
        if (categories) {
            const categoryArray = Array.isArray(categories) ? categories : [categories];
            filters.category = categoryArray.length === 1 ? categoryArray[0] : { $in: categoryArray };
        }

        // Add priority filter (multiple priorities)
        if (priorities) {
            const priorityArray = Array.isArray(priorities) ? priorities : [priorities];
            filters.priority = priorityArray.length === 1 ? priorityArray[0] : { $in: priorityArray };
        }

        // Add status filter (multiple statuses)
        if (statuses) {
            const statusArray = Array.isArray(statuses) ? statuses : [statuses];
            filters.status = statusArray.length === 1 ? statusArray[0] : { $in: statusArray };
        }

        // Add date range filter
        if (dateRange) {
            try {
                const range = typeof dateRange === 'string' ? JSON.parse(dateRange) : dateRange;
                if (range.from) {
                    filters.dateFrom = new Date(range.from);
                }
                if (range.to) {
                    filters.dateTo = new Date(range.to);
                }
            } catch (error) {
                throw createValidationError('Invalid date range format');
            }
        }

        // Get interventions with advanced search
        const result = await ClinicalInterventionService.advancedSearch(filters, {
            patientName,
            interventionNumber,
            assignedUsers: assignedUsers ? (Array.isArray(assignedUsers) ? assignedUsers : [assignedUsers]) : undefined,
            outcomeTypes: outcomeTypes ? (Array.isArray(outcomeTypes) ? outcomeTypes : [outcomeTypes]) : undefined
        });

        sendSuccess(res, {
            interventions: result.data,
            pagination: result.pagination,
            searchCriteria: {
                query: q,
                patientName,
                interventionNumber,
                categories,
                priorities,
                statuses,
                assignedUsers,
                dateRange,
                outcomeTypes
            }
        }, 'Advanced search completed successfully');
    }
);

/**
 * GET /api/clinical-interventions/patient/:patientId
 * Get patient-specific interventions
 */
export const getPatientInterventions = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { patientId } = req.params;

        // Validate patient ID format
        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            throw createValidationError('Invalid patient ID format');
        }

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            status,
            category,
            sortBy = 'identifiedDate',
            sortOrder = 'desc'
        } = req.query as any;

        // Build filters for patient-specific interventions
        const filters: InterventionFilters = {
            workplaceId: context.workplaceIdObj,
            patientId: new mongoose.Types.ObjectId(patientId),
            page: Math.max(1, parseInt(page) || 1),
            limit: Math.min(50, Math.max(1, parseInt(limit) || 20)),
            sortBy,
            sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
            isSuperAdmin: context.isSuperAdmin || req.user?.role === 'super_admin'
        };

        // Add optional filters
        if (status) filters.status = status;
        if (category) filters.category = category;

        // Get patient interventions
        const result = await ClinicalInterventionService.getInterventions(filters);

        // Get patient intervention summary
        const summary = await ClinicalInterventionService.getPatientInterventionSummary(
            new mongoose.Types.ObjectId(patientId),
            context.workplaceIdObj
        );

        sendSuccess(res, {
            interventions: result.data,
            pagination: result.pagination,
            summary
        }, 'Patient interventions retrieved successfully');
    }
);

/**
 * GET /api/clinical-interventions/assigned-to-me
 * Get user's assigned interventions ("my interventions" view)
 */
export const getAssignedInterventions = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            status,
            priority,
            sortBy = 'identifiedDate',
            sortOrder = 'desc'
        } = req.query as any;

        // Build filters for user assignments
        const filters: InterventionFilters = {
            workplaceId: context.workplaceIdObj,
            assignedTo: context.userIdObj,
            page: Math.max(1, parseInt(page) || 1),
            limit: Math.min(50, Math.max(1, parseInt(limit) || 20)),
            sortBy,
            sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
            isSuperAdmin: context.isSuperAdmin || req.user?.role === 'super_admin'
        };

        // Add optional filters
        if (status) filters.status = status;
        if (priority) filters.priority = priority;

        // Get assigned interventions
        const result = await ClinicalInterventionService.getUserAssignments(
            context.userIdObj,
            context.workplaceIdObj,
            status ? [status] : undefined
        );

        // Get user assignment statistics
        const stats = await ClinicalInterventionService.getUserAssignmentStats(
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            interventions: result,
            stats
        }, 'Assigned interventions retrieved successfully');
    }
);

/**
 * GET /api/clinical-interventions/analytics/summary
 * Get dashboard metrics and analytics
 */
export const getInterventionAnalytics = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract date range parameters
        const {
            dateFrom,
            dateTo,
            period = 'month' // month, quarter, year
        } = req.query as any;

        // Parse date range
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (dateFrom) {
            fromDate = new Date(dateFrom);
            if (isNaN(fromDate.getTime())) {
                throw createValidationError('Invalid dateFrom format');
            }
        }

        if (dateTo) {
            toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) {
                throw createValidationError('Invalid dateTo format');
            }
        }

        // Default to current month if no dates provided
        if (!fromDate && !toDate) {
            const now = new Date();
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        // Get dashboard metrics
        const metrics = await ClinicalInterventionService.getDashboardMetrics(
            context.workplaceIdObj,
            { from: fromDate!, to: toDate! },
            context.isSuperAdmin || req.user?.role === 'super_admin'
        );

        sendSuccess(res, metrics, 'Analytics retrieved successfully');
    }
);

/**
 * GET /api/clinical-interventions/analytics/trends
 * Get trend analysis data
 */
export const getInterventionTrends = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract parameters
        const {
            period = 'month', // day, week, month, quarter
            groupBy = 'category', // category, priority, status, user
            dateFrom,
            dateTo
        } = req.query as any;

        // Parse date range
        let fromDate: Date;
        let toDate: Date;

        if (dateFrom && dateTo) {
            fromDate = new Date(dateFrom);
            toDate = new Date(dateTo);

            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                throw createValidationError('Invalid date format');
            }
        } else {
            // Default to last 6 months
            toDate = new Date();
            fromDate = new Date();
            fromDate.setMonth(fromDate.getMonth() - 6);
        }

        // Get trend analysis
        const trends = await ClinicalInterventionService.getTrendAnalysis(
            context.workplaceIdObj,
            { from: fromDate, to: toDate, period, groupBy }
        );

        sendSuccess(res, {
            trends,
            parameters: {
                period,
                groupBy,
                dateRange: { from: fromDate, to: toDate }
            }
        }, 'Trend analysis retrieved successfully');
    }
);

/**
 * GET /api/clinical-interventions/reports/outcomes
 * Get outcome reports
 */
export const getOutcomeReports = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract parameters
        const {
            dateFrom,
            dateTo,
            category,
            priority,
            outcome,
            pharmacist,
            includeDetails = false
        } = req.query as any;

        // Parse date range
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (dateFrom) {
            fromDate = new Date(dateFrom);
            if (isNaN(fromDate.getTime())) {
                throw createValidationError('Invalid dateFrom format');
            }
        }

        if (dateTo) {
            toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) {
                throw createValidationError('Invalid dateTo format');
            }
        }

        // Build filters
        const filters = {
            dateFrom: fromDate,
            dateTo: toDate,
            category,
            priority,
            outcome,
            pharmacist
        };

        // Generate outcome report
        const report = await ClinicalInterventionService.generateOutcomeReport(
            context.workplaceIdObj,
            filters,
            context.isSuperAdmin || req.user?.role === 'super_admin'
        );

        sendSuccess(res, report, 'Outcome report generated successfully');
    }
);

/**
 * GET /api/clinical-interventions/reports/cost-savings
 * Calculate cost savings with configurable parameters
 */
export const getCostSavingsReport = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract parameters
        const {
            dateFrom,
            dateTo,
            adverseEventCost,
            hospitalAdmissionCost,
            medicationWasteCost,
            pharmacistHourlyCost
        } = req.query as any;

        // Parse date range
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (dateFrom) {
            fromDate = new Date(dateFrom);
            if (isNaN(fromDate.getTime())) {
                throw createValidationError('Invalid dateFrom format');
            }
        }

        if (dateTo) {
            toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) {
                throw createValidationError('Invalid dateTo format');
            }
        }

        // Build query for interventions
        const query: any = {
            workplaceId: context.workplaceIdObj,
            isDeleted: { $ne: true },
            status: 'completed'
        };

        if (fromDate || toDate) {
            query.completedAt = {};
            if (fromDate) query.completedAt.$gte = fromDate;
            if (toDate) query.completedAt.$lte = toDate;
        }

        // Get interventions
        const interventions = await ClinicalInterventionService.getInterventions({
            workplaceId: context.workplaceIdObj,
            dateFrom: fromDate,
            dateTo: toDate,
            status: 'completed',
            limit: 1000 // Get all completed interventions
        });

        // Calculate cost savings
        const costSavingsParameters = {
            adverseEventCost: adverseEventCost ? parseFloat(adverseEventCost) : undefined,
            hospitalAdmissionCost: hospitalAdmissionCost ? parseFloat(hospitalAdmissionCost) : undefined,
            medicationWasteCost: medicationWasteCost ? parseFloat(medicationWasteCost) : undefined,
            pharmacistHourlyCost: pharmacistHourlyCost ? parseFloat(pharmacistHourlyCost) : undefined
        };

        const costSavings = await ClinicalInterventionService.calculateCostSavings(
            interventions.data,
            costSavingsParameters
        );

        sendSuccess(res, {
            costSavings,
            parameters: costSavingsParameters,
            interventionCount: interventions.data.length,
            dateRange: { from: fromDate, to: toDate }
        }, 'Cost savings calculated successfully');
    }
);

/**
 * GET /api/clinical-interventions/reports/export
 * Export interventions data in various formats
 */
export const exportInterventionsReport = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        // Extract parameters
        const {
            format = 'excel',
            dateFrom,
            dateTo,
            category,
            priority,
            status,
            includeOutcomes = true
        } = req.query as any;

        // Validate format
        if (!['excel', 'csv', 'pdf'].includes(format)) {
            throw createValidationError('Invalid export format. Supported formats: excel, csv, pdf');
        }

        // Parse date range
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (dateFrom) {
            fromDate = new Date(dateFrom);
            if (isNaN(fromDate.getTime())) {
                throw createValidationError('Invalid dateFrom format');
            }
        }

        if (dateTo) {
            toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) {
                throw createValidationError('Invalid dateTo format');
            }
        }

        // Build filters
        const validatedContext = getValidatedContext(req);
        const filters: InterventionFilters = {
            workplaceId: validatedContext.workplaceIdObj,
            dateFrom: fromDate,
            dateTo: toDate,
            category,
            priority,
            status,
            limit: 10000 // Large limit for export
        };

        // Get interventions data
        const result = await ClinicalInterventionService.getInterventions(filters);

        // For now, return JSON data - in production, this would generate actual files
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                format,
                filters,
                totalRecords: result.data.length
            },
            data: result.data.map(intervention => ({
                interventionNumber: intervention.interventionNumber,
                patientName: intervention.patientId ?
                    `${(intervention.patientId as any).firstName} ${(intervention.patientId as any).lastName}` :
                    'Unknown',
                category: intervention.category,
                priority: intervention.priority,
                status: intervention.status,
                issueDescription: intervention.issueDescription,
                identifiedDate: intervention.identifiedDate,
                identifiedBy: intervention.identifiedBy ?
                    `${(intervention.identifiedBy as any).firstName} ${(intervention.identifiedBy as any).lastName}` :
                    'Unknown',
                completedDate: intervention.completedAt,
                resolutionTime: intervention.completedAt && intervention.startedAt ?
                    Math.ceil((intervention.completedAt.getTime() - intervention.startedAt.getTime()) / (1000 * 60 * 60 * 24)) : null,
                ...(includeOutcomes && intervention.outcomes ? {
                    patientResponse: intervention.outcomes.patientResponse,
                    costSavings: intervention.outcomes.successMetrics?.costSavings,
                    problemResolved: intervention.outcomes.successMetrics?.problemResolved,
                    medicationOptimized: intervention.outcomes.successMetrics?.medicationOptimized
                } : {})
            }))
        };

        // Set appropriate headers for file download
        const filename = `clinical-interventions-${format}-${new Date().toISOString().split('T')[0]}`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.setHeader('Content-Type', 'application/json');

        sendSuccess(res, exportData, `Data exported successfully as ${format}`);
    }
);

/**
 * GET /api/clinical-interventions/reports/export
 * Export intervention data
 */
export const exportInterventionData = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        // Extract parameters
        const {
            format = 'csv', // csv, excel, pdf
            dateFrom,
            dateTo,
            category,
            priority,
            status,
            includeOutcomes = true
        } = req.query as any;

        // Validate format
        if (!['csv', 'excel', 'pdf'].includes(format)) {
            throw createValidationError('Invalid export format. Supported formats: csv, excel, pdf');
        }

        // Parse date range
        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (dateFrom) {
            fromDate = new Date(dateFrom);
            if (isNaN(fromDate.getTime())) {
                throw createValidationError('Invalid dateFrom format');
            }
        }

        if (dateTo) {
            toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) {
                throw createValidationError('Invalid dateTo format');
            }
        }

        // Build export filters
        const exportFilters = {
            workplaceId: context.workplaceIdObj,
            dateFrom: fromDate,
            dateTo: toDate,
            category,
            priority,
            status,
            includeOutcomes: includeOutcomes === 'true'
        };

        // Generate export
        const exportData = await ClinicalInterventionService.exportData(exportFilters, format);

        // Set appropriate headers based on format
        switch (format) {
            case 'csv':
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="interventions.csv"');
                break;
            case 'excel':
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="interventions.xlsx"');
                break;
            case 'pdf':
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename="interventions.pdf"');
                break;
        }

        res.send(exportData);
    }
);

// ===============================
// INTEGRATION OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions/recommendations/:category
 * Get strategy recommendations for intervention category
 */
export const getStrategyRecommendations = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { category } = req.params;
        const { priority, issueDescription } = req.query as any;

        // Validate category
        if (!category) {
            throw createValidationError('Category is required');
        }

        // Get strategy recommendations
        const recommendations = ClinicalInterventionService.getRecommendedStrategies(category);

        // Generate enhanced recommendations if additional context provided
        let enhancedRecommendations = recommendations;
        if (priority && issueDescription) {
            enhancedRecommendations = ClinicalInterventionService.generateRecommendations(
                category,
                priority,
                issueDescription
            );
        }

        sendSuccess(res, {
            category,
            recommendations: enhancedRecommendations,
            totalCount: enhancedRecommendations.length
        }, 'Strategy recommendations retrieved successfully');
    }
);

/**
 * POST /api/clinical-interventions/:id/link-mtr
 * Link intervention to MTR
 */
export const linkToMTR = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;
        const { mtrId } = req.body;

        // Validate ID formats
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        if (!mtrId || !mongoose.Types.ObjectId.isValid(mtrId)) {
            throw createValidationError('Invalid MTR ID format');
        }

        // Link intervention to MTR
        const intervention = await ClinicalInterventionService.linkToMTR(
            id,
            mtrId,
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            intervention
        }, 'Intervention linked to MTR successfully');
    }
);

/**
 * POST /api/clinical-interventions/:id/notifications
 * Send intervention notifications
 */
export const sendInterventionNotifications = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;
        const {
            notificationType,
            recipients,
            message,
            urgency = 'normal'
        } = req.body;

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        // Validate required fields
        if (!notificationType || !recipients) {
            throw createValidationError('Notification type and recipients are required');
        }

        // Validate recipients
        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw createValidationError('Recipients must be a non-empty array');
        }

        // Validate recipient IDs
        for (const recipientId of recipients) {
            if (!mongoose.Types.ObjectId.isValid(recipientId)) {
                throw createValidationError(`Invalid recipient ID format: ${recipientId}`);
            }
        }

        // Send notifications
        const result = await ClinicalInterventionService.sendNotifications(
            id!,
            {
                type: notificationType,
                recipients: recipients.map((id: string) => new mongoose.Types.ObjectId(id)),
                message,
                urgency,
                sentBy: context.userId
            },
            context.userIdObj,
            context.workplaceIdObj
        );

        sendSuccess(res, {
            notificationsSent: result.sent,
            failedNotifications: result.failed,
            totalRecipients: recipients.length
        }, 'Notifications sent successfully');
    }
);

// ===============================
// ERROR HANDLING
// ===============================

/**
 * Error handler middleware for clinical intervention operations
 */
export const handleClinicalInterventionError = (error: any, req: AuthRequest, res: Response, next: any) => {
    logger.error('Clinical Intervention Controller Error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        workplaceId: req.user?.workplaceId
    });

    // Handle specific error types
    if (error instanceof PatientManagementError) {
        return sendError(res, error.code, error.message, error.statusCode || 400);
    }

    if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => ({
            field: err.path,
            message: err.message
        }));

        return sendError(res, 'VALIDATION_ERROR', 'Validation failed', 400, {
            errors: validationErrors
        });
    }

    if (error.name === 'CastError') {
        return sendError(res, 'BAD_REQUEST', 'Invalid ID format', 400);
    }

    if (error.code === 11000) {
        return sendError(res, 'DUPLICATE_RESOURCE', 'Duplicate entry detected', 409);
    }

    // Default error response
    sendError(res, 'SERVER_ERROR', 'Internal server error', 500);
};

// ===============================
// MTR INTEGRATION ENDPOINTS
// ===============================

/**
 * Create interventions from MTR problems
 * POST /api/clinical-interventions/from-mtr
 */
export const createInterventionsFromMTR = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { mtrId, problemIds, priority, estimatedDuration } = req.body;

        // Validate required fields
        if (!mtrId || !problemIds || !Array.isArray(problemIds) || problemIds.length === 0) {
            throw createValidationError('MTR ID and problem IDs are required');
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(mtrId)) {
            throw createValidationError('Invalid MTR ID format');
        }

        for (const problemId of problemIds) {
            if (!mongoose.Types.ObjectId.isValid(problemId)) {
                throw createValidationError(`Invalid problem ID format: ${problemId}`);
            }
        }

        try {
            const interventions = await ClinicalInterventionService.createInterventionFromMTR(
                mtrId,
                problemIds,
                context.userIdObj,
                context.workplaceIdObj,
                { priority, estimatedDuration }
            );

            sendSuccess(
                res,
                {
                    interventions,
                    count: interventions.length,
                    mtrId
                },
                `Created ${interventions.length} interventions from MTR problems`,
                201
            );
        } catch (error: any) {
            logger.error('Error creating interventions from MTR:', error);
            throw error;
        }
    }
);

/**
 * Get MTR reference data for intervention
 * GET /api/clinical-interventions/:id/mtr-reference
 */
export const getMTRReference = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { id } = req.params;

        // Validate intervention ID
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        try {
            // Get intervention to find MTR ID
            const intervention = await ClinicalInterventionService.getInterventionById(
                id,
                context.workplaceIdObj
            );

            if (!intervention.relatedMTRId) {
                return sendSuccess(
                    res,
                    { mtrReference: null },
                    'No MTR linked to this intervention'
                );
            }

            const mtrReference = await ClinicalInterventionService.getMTRReferenceData(
                intervention.relatedMTRId.toString(),
                context.workplaceIdObj
            );

            sendSuccess(
                res,
                { mtrReference },
                'MTR reference data retrieved successfully'
            );
        } catch (error: any) {
            logger.error('Error getting MTR reference:', error);
            throw error;
        }
    }
);

/**
 * Get interventions for MTR
 * GET /api/clinical-interventions/mtr/:mtrId
 */
export const getInterventionsForMTR = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { mtrId } = req.params;

        // Validate MTR ID
        if (!mtrId || !mongoose.Types.ObjectId.isValid(mtrId)) {
            throw createValidationError('Invalid MTR ID format');
        }

        try {
            const interventions = await ClinicalInterventionService.getInterventionsForMTR(
                mtrId,
                new mongoose.Types.ObjectId(context.workplaceId)
            );

            sendSuccess(
                res,
                {
                    interventions,
                    count: interventions.length,
                    mtrId
                },
                `Found ${interventions.length} interventions for MTR`
            );
        } catch (error: any) {
            logger.error('Error getting interventions for MTR:', error);
            throw error;
        }
    }
);

/**
 * Sync intervention with MTR data
 * POST /api/clinical-interventions/:id/sync-mtr
 */
export const syncWithMTR = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const { id } = req.params;

        // Validate intervention ID
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        try {
            await ClinicalInterventionService.syncWithMTR(id, new mongoose.Types.ObjectId(context.workplaceId));

            sendSuccess(
                res,
                null,
                'Intervention synced with MTR successfully'
            );
        } catch (error: any) {
            logger.error('Error syncing intervention with MTR:', error);
            throw error;
        }
    }
);

// ===============================
// AUDIT LOGGING ENDPOINTS
// ===============================

/**
 * Get intervention audit trail
 * GET /api/clinical-interventions/:id/audit-trail
 */
export const getInterventionAuditTrail = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { page = 1, limit = 20, startDate, endDate, riskLevel, action } = req.query as any;

        // Validate intervention ID
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw createValidationError('Invalid intervention ID format');
        }

        try {
            const { AuditService } = await import('../services/auditService');

            const options = {
                page: Math.max(1, parseInt(page) || 1),
                limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
                startDate: startDate as string,
                endDate: endDate as string,
                riskLevel: riskLevel as string,
                action: action as string
            };

            const result = await AuditService.getInterventionAuditLogs(id, options);

            sendSuccess(
                res,
                result,
                'Intervention audit trail retrieved successfully'
            );
        } catch (error: any) {
            logger.error('Error getting intervention audit trail:', error);
            throw error;
        }
    }
);

/**
 * Generate compliance report for interventions
 * GET /api/clinical-interventions/compliance/report
 */
export const getComplianceReport = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const {
            startDate,
            endDate,
            includeDetails = 'false',
            interventionIds
        } = req.query as any;

        // Validate date range
        if (!startDate || !endDate) {
            throw createValidationError('Start date and end date are required');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Validate date range
        if (start >= end) {
            throw createValidationError('Start date must be before end date');
        }

        // Validate date range is not too large (max 1 year)
        const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
        if (end.getTime() - start.getTime() > maxRange) {
            throw createValidationError('Date range cannot exceed 1 year');
        }

        try {
            const { AuditService } = await import('../services/auditService');

            const interventionIdsArray = interventionIds
                ? interventionIds.split(',')
                : undefined;

            const options = {
                startDate: startDate as string,
                endDate: endDate as string,
                includeDetails: includeDetails === 'true',
                interventionIds: interventionIdsArray
            };

            const report = await AuditService.getComplianceReport(options);

            sendSuccess(
                res,
                report,
                'Compliance report generated successfully'
            );
        } catch (error: any) {
            logger.error('Error generating compliance report:', error);
            throw error;
        }
    }
);

/**
 * Export audit data for compliance
 * GET /api/clinical-interventions/audit/export
 */
export const exportAuditData = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const {
            format = 'csv',
            startDate,
            endDate,
            riskLevel,
            userId,
            action,
            interventionIds,
            includeDetails = 'true'
        } = req.query as any;

        // Validate required parameters
        if (!startDate || !endDate) {
            throw createValidationError('Start date and end date are required');
        }

        // Validate format
        if (!['json', 'csv'].includes(format)) {
            throw createValidationError('Format must be json or csv');
        }

        try {
            const { AuditService } = await import('../services/auditService');

            const interventionIdsArray = interventionIds
                ? interventionIds.split(',')
                : undefined;

            const options = {
                format: format as 'csv' | 'json',
                startDate: startDate as string,
                endDate: endDate as string,
                riskLevel: riskLevel as string,
                userId: userId as string,
                action: action as string,
                interventionId: interventionIdsArray?.[0] // For single intervention export
            };

            const exportData = await AuditService.exportAuditLogs(options);

            // Set appropriate headers
            const filename = `audit_export_${new Date().toISOString().split('T')[0]}.${format}`;
            const contentType = format === 'csv' ? 'text/csv' : 'application/json';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(exportData);
        } catch (error: any) {
            logger.error('Error exporting audit data:', error);
            throw error;
        }
    }
);

// ===============================
// MISSING UTILITY METHODS
// ===============================

/**
 * GET /api/clinical-interventions/check-duplicates
 * Check for duplicate interventions
 */
export const checkDuplicates = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);
        const { patientId, category } = req.query as any;

        // Validate required parameters
        if (!patientId || !category) {
            throw createValidationError('patientId and category are required');
        }

        // Validate patient ID format
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            throw createValidationError('Invalid patient ID format');
        }

        try {
            // Check for duplicate interventions using the service method
            const duplicates = await ClinicalInterventionService.checkDuplicateInterventions(
                new mongoose.Types.ObjectId(patientId),
                category,
                context.workplaceIdObj
            );

            sendSuccess(res, {
                duplicates,
                count: duplicates.length
            }, 'Duplicate check completed successfully');
        } catch (error) {
            throw createBusinessRuleError('Failed to check for duplicates');
        }
    }
);

/**
 * GET /api/clinical-interventions/analytics/categories
 * Get intervention categories with counts
 */
export const getCategoryCounts = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        try {
            // Get category counts from database
            const matchStage: any = {
                isDeleted: { $ne: true }
            };

            // Add workplaceId filter only if not super_admin
            if (!context.isSuperAdmin && req.user?.role !== 'super_admin') {
                matchStage.workplaceId = context.workplaceIdObj;
            }

            const categoryStats = await ClinicalIntervention.aggregate([
                {
                    $match: matchStage
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            const categoryCounts: Record<string, number> = {};
            categoryStats.forEach((stat: any) => {
                categoryCounts[stat._id] = stat.count;
            });

            sendSuccess(res, categoryCounts, 'Category counts retrieved successfully');
        } catch (error) {
            throw createBusinessRuleError('Failed to get category counts');
        }
    }
);

/**
 * GET /api/clinical-interventions/analytics/priorities
 * Get priority distribution
 */
export const getPriorityDistribution = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getValidatedContext(req);

        try {
            // Get priority distribution from database
            const matchStage: any = {
                isDeleted: { $ne: true }
            };

            // Add workplaceId filter only if not super_admin
            if (!context.isSuperAdmin && req.user?.role !== 'super_admin') {
                matchStage.workplaceId = context.workplaceIdObj;
            }

            const priorityStats = await ClinicalIntervention.aggregate([
                {
                    $match: matchStage
                },
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            const priorityDistribution: Record<string, number> = {};
            priorityStats.forEach((stat: any) => {
                priorityDistribution[stat._id] = stat.count;
            });

            sendSuccess(res, priorityDistribution, 'Priority distribution retrieved successfully');
        } catch (error) {
            throw createBusinessRuleError('Failed to get priority distribution');
        }
    }
);

/**
 * POST /api/clinical-interventions/:id/notifications
 * Send notifications for intervention (alias for sendInterventionNotifications)
 */
export const sendNotifications = sendInterventionNotifications;
