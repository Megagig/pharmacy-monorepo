/**
 * Diagnostics Module Index
 * Main entry point for the AI-Powered Diagnostics & Therapeutics module
 */

// Import routes
import diagnosticRoutes from './routes/diagnosticRoutes';
import labRoutes from './routes/labRoutes';
import labIntegrationRoutes from './routes/labIntegrationRoutes';
import drugInteractionRoutes from './routes/drugInteractionRoutes';
import followUpRoutes from './routes/followUp.routes';
import adherenceRoutes from './routes/adherence.routes';
import analyticsRoutes from './routes/analytics.routes';
import auditRoutes from './routes/audit.routes';
import integrationRoutes from './routes/integration.routes';

// Import services
export { DiagnosticService } from './services/diagnosticService';
export { PharmacistReviewService } from './services/pharmacistReviewService';
export { default as labService } from './services/labService';
export { default as clinicalApiService } from './services/clinicalApiService';
export { default as diagnosticFollowUpService } from './services/diagnosticFollowUpService';
export { default as adherenceService } from './services/adherenceService';
export { default as diagnosticNotificationService } from './services/diagnosticNotificationService';
export { default as diagnosticAnalyticsService } from './services/diagnosticAnalyticsService';
export { default as diagnosticAuditService } from './services/diagnosticAuditService';
export { default as diagnosticIntegrationService } from './services/integrationService';

// Import models
export { default as DiagnosticRequest } from './models/DiagnosticRequest';
export { default as DiagnosticResult } from './models/DiagnosticResult';
export { default as LabOrder } from './models/LabOrder';
export { default as LabResult } from './models/LabResult';
export { default as DiagnosticFollowUp } from './models/DiagnosticFollowUp';
export { default as AdherenceTracking } from './models/AdherenceTracking';

// Import types
export type {
    IDiagnosticRequest,
    IInputSnapshot,
    ISymptomData,
    IVitalSigns,
    IMedicationEntry,
} from './models/DiagnosticRequest';

export type {
    IDiagnosticResult,
    IDiagnosis,
    ISuggestedTest,
    IMedicationSuggestion,
    IRedFlag,
    IReferralRecommendation,
    IAIMetadata,
    IPharmacistReview,
} from './models/DiagnosticResult';

export type {
    ILabOrder,
    ILabTest,
} from './models/LabOrder';

export type {
    ILabResult,
    IReferenceRange,
} from './models/LabResult';

export type {
    IDiagnosticFollowUp,
    IFollowUpOutcome,
    IFollowUpReminder,
} from './models/DiagnosticFollowUp';

export type {
    IAdherenceTracking,
    IMedicationAdherence,
    IAdherenceAlert,
    IAdherenceIntervention,
} from './models/AdherenceTracking';

// Import middleware
export { default as diagnosticRBAC } from './middlewares/diagnosticRBAC';

// Import validators
export { default as diagnosticValidators } from './validators/diagnosticValidators';
export { default as labValidators } from './validators/labValidators';
export { default as drugInteractionValidators } from './validators/drugInteractionValidators';

// Export routes
export const routes = {
    diagnostics: diagnosticRoutes,
    lab: labRoutes,
    labIntegration: labIntegrationRoutes,
    drugInteractions: drugInteractionRoutes,
    followUps: followUpRoutes,
    adherence: adherenceRoutes,
    analytics: analyticsRoutes,
    audit: auditRoutes,
    integration: integrationRoutes,
};

// Module configuration
export const moduleConfig = {
    name: 'ai-diagnostics-therapeutics',
    version: '1.0.0',
    description: 'AI-Powered Diagnostics & Therapeutics module for comprehensive clinical decision support',
    features: [
        'ai_diagnostics',
        'lab_integration',
        'drug_interactions',
        'diagnostic_analytics',
        'follow_up_tracking',
        'adherence_monitoring',
        'automated_notifications',
    ],
    permissions: [
        'diagnostic:read',
        'diagnostic:create',
        'diagnostic:process',
        'diagnostic:review',
        'diagnostic:approve',
        'diagnostic:intervention',
        'diagnostic:cancel',
        'diagnostic:retry',
        'diagnostic:analytics',
        'lab:read',
        'lab:create_order',
        'lab:update_order',
        'lab:cancel_order',
        'lab:add_result',
        'lab:update_result',
        'lab:delete_result',
        'lab:import_fhir',
        'drug_interactions:check',
        'drug_interactions:lookup',
        'drug_interactions:allergy_check',
        'drug_interactions:contraindications',
        'drug_interactions:search',
        'follow_up:read',
        'follow_up:create',
        'follow_up:update',
        'follow_up:complete',
        'follow_up:reschedule',
        'follow_up:cancel',
        'follow_up:analytics',
        'adherence:read',
        'adherence:create',
        'adherence:update',
        'adherence:add_refill',
        'adherence:add_intervention',
        'adherence:acknowledge_alert',
        'adherence:resolve_alert',
        'adherence:generate_report',
    ],
    routes: {
        diagnostics: '/api/diagnostics',
        lab: '/api/lab',
        labIntegration: '/api/lab-integration',
        drugInteractions: '/api/interactions',
        followUps: '/api/diagnostics/follow-ups',
        adherence: '/api/diagnostics/adherence',
        analytics: '/api/diagnostics/analytics',
        audit: '/api/diagnostics/audit',
        integration: '/api/diagnostics/integration',
    },
    dependencies: [
        'openRouterService',
        'rxnormService',
        'openfdaService',
        'auditService',
    ],
};

export default {
    routes,
    moduleConfig,
};