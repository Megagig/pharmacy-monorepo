import express, { Request, Response, NextFunction } from 'express';
import {
    getMTRSessions,
    getMTRSession,
    createMTRSession,
    updateMTRSession,
    deleteMTRSession,
    updateMTRStep,
    getMTRProgress,
    getPatientMTRHistory,
    createPatientMTRSession,
    getMTRProblems,
    createMTRProblem,
    updateMTRProblem,
    deleteMTRProblem,
    getMTRInterventions,
    createMTRIntervention,
    updateMTRIntervention,
    getMTRFollowUps,
    createMTRFollowUp,
    updateMTRFollowUp,
    getMTRReports,
    getMTROutcomes,
    getMTRAuditTrail,
    checkDrugInteractions,
    checkDuplicateTherapies,
} from '../controllers/mtrController';
import {
    getMTRSummaryReport,
    getInterventionEffectivenessReport,
    getPharmacistPerformanceReport,
    getQualityAssuranceReport,
    getOutcomeMetricsReport,
    getPatientOutcomeAnalytics,
    getCostEffectivenessAnalysis,
    getOperationalEfficiencyMetrics,
    getTrendForecastingAnalytics,
} from '../controllers/mtrReportsController';
import { auth, requireLicense } from '../middlewares/auth';
import { auditTimer, auditMTRActivity, auditPatientAccess } from '../middlewares/auditMiddleware';
import {
    createMTRSessionSchema,
    updateMTRSessionSchema,
    updateStepSchema,
    createProblemSchema,
    updateProblemSchema,
    createInterventionSchema,
    updateInterventionSchema,
    createFollowUpSchema,
    updateFollowUpSchema,
    mtrParamsSchema,
    problemParamsSchema,
    interventionParamsSchema,
    followUpParamsSchema,
    patientParamsSchema,
    mtrQuerySchema,
    reportsQuerySchema,
    drugInteractionSchema,
    medicationSchema,
} from '../validators/mtrValidators';
import {
    mtrValidationMiddleware,
} from '../middlewares/mtrValidation';

const router = express.Router();

// Apply authentication, license requirement, and MTR access validation to all routes
router.use(auth);
router.use(requireLicense);
router.use(mtrValidationMiddleware.validateMTRAccess);
router.use(mtrValidationMiddleware.validateMTRBusinessLogic);

// ===============================
// CORE MTR SESSION ROUTES
// ===============================

// GET /api/mtr - List MTR sessions with filters and pagination
router.get('/', mtrQuerySchema, mtrValidationMiddleware.handleValidationErrors, auditMTRActivity('VIEW_MTR_SESSIONS'), getMTRSessions);

// POST /api/mtr - Create new MTR session
router.post('/', createMTRSessionSchema, mtrValidationMiddleware.handleValidationErrors, auditMTRActivity('CREATE_MTR_SESSION'), createMTRSession);

// GET /api/mtr/:id - Get specific MTR session
router.get('/:id', mtrParamsSchema, mtrValidationMiddleware.handleValidationErrors, auditMTRActivity('VIEW_MTR_SESSION'), getMTRSession);

// PUT /api/mtr/:id - Update MTR session
router.put('/:id', [...mtrParamsSchema, ...updateMTRSessionSchema], mtrValidationMiddleware.handleValidationErrors, auditMTRActivity('UPDATE_MTR_SESSION'), updateMTRSession);

// DELETE /api/mtr/:id - Delete MTR session
router.delete('/:id', mtrParamsSchema, mtrValidationMiddleware.handleValidationErrors, auditMTRActivity('DELETE_MTR_SESSION'), deleteMTRSession);

// ===============================
// WORKFLOW STEP ROUTES
// ===============================

// PUT /api/mtr/:id/step/:stepName - Update specific workflow step
router.put('/:id/step/:stepName',
    [...mtrParamsSchema, ...updateStepSchema],
    mtrValidationMiddleware.handleValidationErrors,
    // Add medication history validation for medicationHistory step
    (req: Request, res: Response, next: NextFunction) => {
        if (req.params.stepName === 'medicationHistory' && req.body.data?.medications) {
            return mtrValidationMiddleware.validateMedicationHistory(req, res, next);
        }
        next();
    },
    // Add therapy plan validation for planDevelopment step
    (req: Request, res: Response, next: NextFunction) => {
        if (req.params.stepName === 'planDevelopment' && req.body.data?.plan) {
            return mtrValidationMiddleware.validateTherapyPlan(req, res, next);
        }
        next();
    },
    updateMTRStep
);

// GET /api/mtr/:id/progress - Get workflow progress
router.get('/:id/progress', mtrParamsSchema, mtrValidationMiddleware.handleValidationErrors, getMTRProgress);

// ===============================
// PATIENT-SPECIFIC ROUTES
// ===============================

// GET /api/mtr/patient/:patientId - Get patient's MTR history
router.get('/patient/:patientId', [...patientParamsSchema, ...mtrQuerySchema], mtrValidationMiddleware.handleValidationErrors, getPatientMTRHistory);

// POST /api/mtr/patient/:patientId - Create MTR for specific patient
router.post('/patient/:patientId', [...patientParamsSchema, ...createMTRSessionSchema], mtrValidationMiddleware.handleValidationErrors, createPatientMTRSession);

// ===============================
// DRUG THERAPY PROBLEMS ROUTES
// ===============================

// GET /api/mtr/:id/problems - Get identified problems
router.get('/:id/problems', mtrParamsSchema, mtrValidationMiddleware.handleValidationErrors, getMTRProblems);

// POST /api/mtr/:id/problems - Add new problem
router.post('/:id/problems', [...mtrParamsSchema, ...createProblemSchema], mtrValidationMiddleware.handleValidationErrors, createMTRProblem);

// PUT /api/mtr/:id/problems/:problemId - Update problem
router.put('/:id/problems/:problemId', [...problemParamsSchema, ...updateProblemSchema], mtrValidationMiddleware.handleValidationErrors, updateMTRProblem);

// DELETE /api/mtr/:id/problems/:problemId - Delete problem
router.delete('/:id/problems/:problemId', problemParamsSchema, mtrValidationMiddleware.handleValidationErrors, deleteMTRProblem);

// ===============================
// INTERVENTIONS ROUTES
// ===============================

// GET /api/mtr/:id/interventions - Get interventions
router.get('/:id/interventions', mtrParamsSchema, mtrValidationMiddleware.handleValidationErrors, getMTRInterventions);

// POST /api/mtr/:id/interventions - Record new intervention
router.post('/:id/interventions', [...mtrParamsSchema, ...createInterventionSchema], mtrValidationMiddleware.handleValidationErrors, createMTRIntervention);

// PUT /api/mtr/:id/interventions/:interventionId - Update intervention
router.put('/:id/interventions/:interventionId', [...interventionParamsSchema, ...updateInterventionSchema], mtrValidationMiddleware.handleValidationErrors, updateMTRIntervention);

// ===============================
// FOLLOW-UPS ROUTES
// ===============================

// GET /api/mtr/:id/followups - Get follow-ups
router.get('/:id/followups', mtrParamsSchema, mtrValidationMiddleware.handleValidationErrors, getMTRFollowUps);

// POST /api/mtr/:id/followups - Schedule follow-up
router.post('/:id/followups', [...mtrParamsSchema, ...createFollowUpSchema], mtrValidationMiddleware.handleValidationErrors, createMTRFollowUp);

// PUT /api/mtr/:id/followups/:followupId - Update follow-up
router.put('/:id/followups/:followupId', [...followUpParamsSchema, ...updateFollowUpSchema], mtrValidationMiddleware.handleValidationErrors, updateMTRFollowUp);

// ===============================
// REPORTS AND ANALYTICS ROUTES
// ===============================

// GET /api/mtr/reports/summary - MTR summary reports
router.get('/reports/summary', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getMTRSummaryReport);

// GET /api/mtr/reports/interventions - Intervention effectiveness reports
router.get('/reports/interventions', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getInterventionEffectivenessReport);

// GET /api/mtr/reports/pharmacists - Pharmacist performance reports
router.get('/reports/pharmacists', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getPharmacistPerformanceReport);

// GET /api/mtr/reports/quality - Quality assurance reports
router.get('/reports/quality', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getQualityAssuranceReport);

// GET /api/mtr/reports/outcomes - Outcome metrics reports
router.get('/reports/outcomes', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getOutcomeMetricsReport);

// GET /api/mtr/reports/audit - Audit trail reports
router.get('/reports/audit', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getMTRAuditTrail);

// GET /api/mtr/reports/patient-outcomes - Patient outcome analytics
router.get('/reports/patient-outcomes', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getPatientOutcomeAnalytics);

// GET /api/mtr/reports/cost-effectiveness - Cost-effectiveness analysis
router.get('/reports/cost-effectiveness', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getCostEffectivenessAnalysis);

// GET /api/mtr/reports/operational-efficiency - Operational efficiency metrics
router.get('/reports/operational-efficiency', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getOperationalEfficiencyMetrics);

// GET /api/mtr/reports/trend-forecasting - Trend identification and forecasting
router.get('/reports/trend-forecasting', reportsQuerySchema, mtrValidationMiddleware.handleValidationErrors, getTrendForecastingAnalytics);

// ===============================
// DRUG INTERACTION CHECKING ROUTES
// ===============================

// POST /api/mtr/check-interactions - Check drug interactions
router.post('/check-interactions', drugInteractionSchema, mtrValidationMiddleware.handleValidationErrors, checkDrugInteractions);

// POST /api/mtr/check-duplicates - Check duplicate therapies
router.post('/check-duplicates', drugInteractionSchema, mtrValidationMiddleware.handleValidationErrors, checkDuplicateTherapies);

export default router;