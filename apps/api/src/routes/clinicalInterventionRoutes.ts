import express from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import {
    requireInterventionCreate,
    requireInterventionRead,
    requireInterventionUpdate,
    requireInterventionDelete
} from '../middlewares/clinicalInterventionRBAC';
import { clinicalInterventionErrorHandler } from '../middlewares/clinicalInterventionErrorHandler';
import { loadWorkspaceContext } from '../middlewares/workspaceContext';
import { auditIntervention } from '../middlewares/auditMiddleware';

// Import controller methods
import {
    getClinicalInterventions,
    createClinicalIntervention,
    getClinicalIntervention,
    updateClinicalIntervention,
    deleteClinicalIntervention,
    addInterventionStrategy,
    updateInterventionStrategy,
    assignTeamMember,
    updateAssignment,
    recordOutcome,
    scheduleFollowUp,
    searchClinicalInterventions,
    getPatientInterventions,
    getAssignedInterventions,
    getInterventionAnalytics,
    getInterventionTrends,
    getOutcomeReports,
    getCostSavingsReport,
    exportInterventionData,
    getStrategyRecommendations,
    linkToMTR,
    sendInterventionNotifications,
    checkDuplicates,
    getCategoryCounts,
    getPriorityDistribution,
    createInterventionsFromMTR,
    getMTRReference,
    getInterventionsForMTR,
    syncWithMTR,
    getInterventionAuditTrail,
    getComplianceReport,
    exportAuditData
} from '../controllers/clinicalInterventionController';

// Import audit controller functions
import {
    getAllAuditTrail,
    getAuditStatistics,
    cleanupAuditLogs
} from '../controllers/auditController';

const router = express.Router();

// Note: Health check endpoint is defined in app.ts to avoid auth middleware conflicts

// Create a separate router for authenticated routes
const authenticatedRouter = express.Router();

// Note: Auth middleware applied per route to avoid conflicts with health endpoint

// ===============================
// CORE CRUD OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions
 * List interventions with filtering, sorting, and pagination
 */
authenticatedRouter.get('/',
    auth,
    loadWorkspaceContext,
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getClinicalInterventions
);

/**
 * POST /api/clinical-interventions
 * Create new clinical intervention
 */
authenticatedRouter.post('/',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionCreate,
    ...auditIntervention('INTERVENTION_CREATED'),
    createClinicalIntervention
);

/**
 * GET /api/clinical-interventions/:id
 * Get intervention details by ID
 */
authenticatedRouter.get('/:id',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getClinicalIntervention
);

/**
 * PATCH /api/clinical-interventions/:id
 * Update intervention with partial updates
 */
authenticatedRouter.patch('/:id',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    ...auditIntervention('INTERVENTION_UPDATED'),
    updateClinicalIntervention
);

/**
 * DELETE /api/clinical-interventions/:id
 * Soft delete intervention
 */
authenticatedRouter.delete('/:id',
    requireRole('pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionDelete,
    ...auditIntervention('INTERVENTION_DELETED'),
    deleteClinicalIntervention
);

// ===============================
// WORKFLOW-SPECIFIC OPERATIONS
// ===============================

/**
 * POST /api/clinical-interventions/:id/strategies
 * Add intervention strategy
 */
authenticatedRouter.post('/:id/strategies',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    addInterventionStrategy
);

/**
 * PATCH /api/clinical-interventions/:id/strategies/:strategyId
 * Update intervention strategy
 */
authenticatedRouter.patch('/:id/strategies/:strategyId',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    updateInterventionStrategy
);

/**
 * POST /api/clinical-interventions/:id/assignments
 * Assign team member to intervention
 */
authenticatedRouter.post('/:id/assignments',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    assignTeamMember
);

/**
 * PATCH /api/clinical-interventions/:id/assignments/:assignmentId
 * Update assignment status and notes
 */
authenticatedRouter.patch('/:id/assignments/:assignmentId',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    updateAssignment
);

/**
 * POST /api/clinical-interventions/:id/outcomes
 * Record intervention outcomes
 */
authenticatedRouter.post('/:id/outcomes',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    ...auditIntervention('INTERVENTION_COMPLETED'),
    recordOutcome
);

/**
 * POST /api/clinical-interventions/:id/follow-up
 * Schedule follow-up for intervention
 */
authenticatedRouter.post('/:id/follow-up',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    scheduleFollowUp
);

// ===============================
// SEARCH AND ANALYTICS OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions/search
 * Advanced search with multiple filter criteria
 */
authenticatedRouter.get('/search',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    searchClinicalInterventions
);

/**
 * GET /api/clinical-interventions/patient/:patientId
 * Get patient-specific interventions
 */
authenticatedRouter.get('/patient/:patientId',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getPatientInterventions
);

/**
 * GET /api/clinical-interventions/assigned-to-me
 * Get user's assigned interventions
 */
authenticatedRouter.get('/assigned-to-me',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getAssignedInterventions
);

/**
 * GET /api/clinical-interventions/analytics/summary
 * Get dashboard metrics and analytics
 */
authenticatedRouter.get('/analytics/summary',
    auth,
    loadWorkspaceContext,
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getInterventionAnalytics
);

/**
 * GET /api/clinical-interventions/analytics/trends
 * Get outcome trends
 */
authenticatedRouter.get('/analytics/trends',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getInterventionTrends
);

/**
 * GET /api/clinical-interventions/analytics/categories
 * Get intervention categories with counts
 */
authenticatedRouter.get('/analytics/categories',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getCategoryCounts
);

/**
 * GET /api/clinical-interventions/analytics/priorities
 * Get priority distribution
 */
authenticatedRouter.get('/analytics/priorities',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getPriorityDistribution
);

// ===============================
// REPORTING OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions/reports/outcomes
 * Generate outcome report
 */
authenticatedRouter.get('/reports/outcomes',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getOutcomeReports
);

/**
 * GET /api/clinical-interventions/reports/cost-savings
 * Calculate cost savings report
 */
authenticatedRouter.get('/reports/cost-savings',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getCostSavingsReport
);

/**
 * GET /api/clinical-interventions/reports/export
 * Export interventions data
 */
authenticatedRouter.get('/reports/export',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    exportInterventionData
);

// ===============================
// UTILITY OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions/recommendations/:category
 * Get strategy recommendations for a category
 */
authenticatedRouter.get('/recommendations/:category',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getStrategyRecommendations
);

/**
 * GET /api/clinical-interventions/check-duplicates
 * Check for duplicate interventions
 */
authenticatedRouter.get('/check-duplicates',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    checkDuplicates
);

// ===============================
// MTR INTEGRATION OPERATIONS
// ===============================

/**
 * POST /api/clinical-interventions/from-mtr
 * Create interventions from MTR problems
 */
authenticatedRouter.post('/from-mtr',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionCreate,
    createInterventionsFromMTR
);

/**
 * GET /api/clinical-interventions/:id/mtr-reference
 * Get MTR reference data for intervention
 */
authenticatedRouter.get('/:id/mtr-reference',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getMTRReference
);

/**
 * GET /api/clinical-interventions/mtr/:mtrId
 * Get interventions for MTR
 */
authenticatedRouter.get('/mtr/:mtrId',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getInterventionsForMTR
);

/**
 * POST /api/clinical-interventions/:id/link-mtr
 * Link intervention to MTR
 */
authenticatedRouter.post('/:id/link-mtr',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    linkToMTR
);

/**
 * POST /api/clinical-interventions/:id/sync-mtr
 * Sync intervention with MTR data
 */
authenticatedRouter.post('/:id/sync-mtr',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    syncWithMTR
);

// ===============================
// NOTIFICATION OPERATIONS
// ===============================

/**
 * POST /api/clinical-interventions/:id/notifications
 * Send notifications for intervention
 */
authenticatedRouter.post('/:id/notifications',
    requireRole('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionUpdate,
    sendInterventionNotifications
);

// ===============================
// AUDIT AND COMPLIANCE OPERATIONS
// ===============================

/**
 * GET /api/clinical-interventions/audit-trail
 * Get all audit trail (general audit view)
 */
authenticatedRouter.get('/audit-trail',
    requireRole('pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getAllAuditTrail
);

/**
 * GET /api/clinical-interventions/:id/audit-trail
 * Get intervention audit trail
 */
authenticatedRouter.get('/:id/audit-trail',
    requireRole('pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getInterventionAuditTrail
);

/**
 * GET /api/clinical-interventions/compliance/report
 * Generate compliance report
 */
authenticatedRouter.get('/compliance/report',
    requireRole('pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getComplianceReport
);

/**
 * GET /api/clinical-interventions/audit/export
 * Export audit data
 */
authenticatedRouter.get('/audit/export',
    requireRole('pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    exportAuditData
);

/**
 * GET /api/clinical-interventions/audit/statistics
 * Get audit statistics
 */
authenticatedRouter.get('/audit/statistics',
    requireRole('pharmacy_outlet', 'owner', 'super_admin'),
    requireInterventionRead,
    getAuditStatistics
);

/**
 * POST /api/clinical-interventions/audit/cleanup
 * Clean up old audit logs (admin only)
 */
authenticatedRouter.post('/audit/cleanup',
    requireRole('super_admin'),
    cleanupAuditLogs
);

// Apply error handling middleware to authenticated routes
authenticatedRouter.use(clinicalInterventionErrorHandler);

// Merge authenticated routes with main router - but not on root path to avoid conflicts
router.use(authenticatedRouter);

export default router;