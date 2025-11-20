import { lazyWithRetry } from '../utils/chunkLoadingUtils';

// Heavy page components that should be lazy loaded with retry mechanism
export const LazyModernDashboard = lazyWithRetry(() => import('../pages/ModernDashboardPage'));
export const LazyPatients = lazyWithRetry(() => import('../pages/Patients'));
export const LazyClinicalNotes = lazyWithRetry(() => import('../pages/ClinicalNotes'));
export const LazyClinicalNoteDetail = lazyWithRetry(() => import('../pages/ClinicalNoteDetailPage'));
export const LazyClinicalNoteForm = lazyWithRetry(() => import('../pages/ClinicalNoteFormPage'));
export const LazyMedications = lazyWithRetry(() => import('../pages/Medications'));
export const LazyMedicationTherapyReview = lazyWithRetry(() => import('../pages/MedicationTherapyReview'));
export const LazyCommunicationHub = lazyWithRetry(() => import('../pages/CommunicationHub'));
export const LazyDrugInformationCenter = lazyWithRetry(() => import('../pages/DrugInformationCenter'));
export const LazyDrugInteractionChecker = lazyWithRetry(() => import('../pages/DrugInteractionChecker'));
export const LazyClinicalDecisionSupport = lazyWithRetry(() => import('../pages/ClinicalDecisionSupport'));
export const LazyPharmacyReports = lazyWithRetry(() => import('../pages/PharmacyReports'));
export const LazyPharmacyUserManagement = lazyWithRetry(() => import('../pages/EnhancedUserManagement'));
export const LazyPharmacyUserManagementOld = lazyWithRetry(() => import('../pages/PharmacyUserManagement'));
export const LazyInteractionReviewPage = lazyWithRetry(() => import('../pages/InteractionReviewPage'));

// Module components with retry mechanism
export const LazyDiagnosticDashboard = lazyWithRetry(() => import('../modules/diagnostics/pages/DiagnosticDashboard'));
export const LazyCaseIntakePage = lazyWithRetry(() => import('../modules/diagnostics/pages/CaseIntakePage'));
export const LazyCaseResultsPage = lazyWithRetry(() => import('../modules/diagnostics/pages/CaseResultsPage'));
export const LazyResultsReviewPage = lazyWithRetry(() => import('../modules/diagnostics/pages/ResultsReviewPage'));
export const LazyComponentDemo = lazyWithRetry(() => import('../modules/diagnostics/pages/ComponentDemo'));

// New diagnostic pages
export const LazyAllDiagnosticCasesPage = lazyWithRetry(() => import('../modules/diagnostics/pages/AllDiagnosticCasesPage'));
export const LazyDiagnosticAnalyticsPage = lazyWithRetry(() => import('../modules/diagnostics/pages/DiagnosticAnalyticsPage'));
export const LazyDiagnosticReferralsPage = lazyWithRetry(() => import('../modules/diagnostics/pages/DiagnosticReferralsPage'));
export const LazyFollowUpCasesPage = lazyWithRetry(() => import('../modules/diagnostics/pages/FollowUpCasesPage'));

// Reports & Analytics
export const LazyReportsAnalyticsDashboard = lazyWithRetry(() =>
  import('../modules/reports-analytics/components/ReportsAnalyticsDashboard')
);

// Patient Engagement & Follow-up
export const LazyPatientEngagement = lazyWithRetry(() => import('../pages/PatientEngagement'));
export const LazyAppointmentManagement = lazyWithRetry(() => import('../pages/AppointmentManagement'));
export const LazyFollowUpManagement = lazyWithRetry(() => import('../pages/FollowUpManagement'));
export const LazyPatientPortal = lazyWithRetry(() => import('../pages/PatientPortal'));
export const LazyPatientAuth = lazyWithRetry(() => import('../pages/PatientAuth'));
export const LazyPublicPatientPortal = lazyWithRetry(() => import('../pages/public/PatientPortalLanding'));
export const LazyWorkspaceSearchPage = lazyWithRetry(() => import('../pages/public/WorkspaceSearchPage'));
export const LazyPatientWorkspaceDetailPage = lazyWithRetry(() => import('../pages/public/PatientWorkspaceDetailPage'));

// Admin components with retry mechanism
export const LazyAdminDashboard = lazyWithRetry(() => import('../components/admin/AdminDashboard'));
export const LazyAIUsageMonitoring = lazyWithRetry(() => import('../pages/AIUsageMonitoringPage'));
export const LazyFeatureManagement = lazyWithRetry(() => import('../pages/FeatureManagement'));
export const LazySuperAdminAuditTrail = lazyWithRetry(() => import('../pages/SuperAdminAuditTrail'));
export const LazyRBACManagement = lazyWithRetry(() => import('../pages/admin/RBACManagement'));
export const LazyWorkspaceRBACManagement = lazyWithRetry(() => import('../pages/workspace/WorkspaceRBACManagement'));
export const LazySecurityDashboard = lazyWithRetry(() => import('../components/admin/SecurityDashboard'));
export const LazyPricingManagement = lazyWithRetry(() => import('../components/admin/PricingManagement'));
export const LazyUsageMonitoring = lazyWithRetry(() => import('../components/admin/UsageMonitoring'));
export const LazyLocationManagement = lazyWithRetry(() => import('../components/admin/LocationManagement'));
export const LazyQueueMonitoringDashboard = lazyWithRetry(() => import('../components/admin/QueueMonitoringDashboard'));
export const LazyWebhookManagement = lazyWithRetry(() => import('../components/admin/WebhookManagement'));
export const LazyAppointmentAnalyticsDashboard = lazyWithRetry(() => import('../components/appointments/AppointmentAnalyticsDashboard'));

// Heavy form components with retry mechanism
export const LazyPatientForm = lazyWithRetry(() => import('../components/PatientForm'));
export const LazyPatientManagement = lazyWithRetry(() => import('../components/PatientManagement'));
export const LazyMedicationsManagementDashboard = lazyWithRetry(() =>
  import('../components/medications/MedicationsManagementDashboard')
);
export const LazyPatientMedicationsPage = lazyWithRetry(() =>
  import('../components/medications/PatientMedicationsPage')
);
export const LazyClinicalInterventionsLayout = lazyWithRetry(() =>
  import('../components/ClinicalInterventionsLayout')
);

// Settings and subscription components with retry mechanism
export const LazySubscriptions = lazyWithRetry(() => import('../pages/Subscriptions'));
export const LazySubscriptionManagement = lazyWithRetry(() => import('../pages/SubscriptionManagement'));
export const LazySubscriptionSuccess = lazyWithRetry(() => import('../pages/SubscriptionSuccess'));
export const LazySettings = lazyWithRetry(() => import('../pages/Settings'));
export const LazySettingsTheme = lazyWithRetry(() => import('../pages/SettingsTheme'));
export const LazyNotifications = lazyWithRetry(() => import('../pages/Notifications'));
export const LazyHelp = lazyWithRetry(() => import('../pages/Help'));
export const LazyMTRHelp = lazyWithRetry(() => import('../pages/MTRHelp'));
export const LazyLicenseUpload = lazyWithRetry(() => import('../components/license/LicenseUpload'));

// Additional unrouted pages with retry mechanism
export const LazyLabResultIntegration = lazyWithRetry(() => import('../pages/LabResultIntegration'));
export const LazyLabIntegrationCaseDetail = lazyWithRetry(() => import('../pages/LabIntegrationCaseDetail'));
export const LazyLabIntegrationNewCase = lazyWithRetry(() => import('../pages/LabIntegrationNewCase'));
export const LazyLabIntegrationReviewQueue = lazyWithRetry(() => import('../pages/LabIntegrationReviewQueue'));
export const LazyApprovedLabIntegrations = lazyWithRetry(() => import('../pages/ApprovedLabIntegrations'));

// Laboratory Findings Module with retry mechanism
export const LazyLaboratoryDashboard = lazyWithRetry(() => import('../pages/LaboratoryDashboard'));
export const LazyLabResultForm = lazyWithRetry(() => import('../pages/LabResultForm'));
export const LazyLabResultDetail = lazyWithRetry(() => import('../pages/LabResultDetail'));
export const LazyLabUploadPage = lazyWithRetry(() => import('../pages/LabUploadPage'));
export const LazyLabTemplatesPage = lazyWithRetry(() => import('../pages/LabTemplatesPage'));
export const LazyLabTemplateForm = lazyWithRetry(() => import('../pages/LabTemplateForm'));
export const LazyLabTrendsPage = lazyWithRetry(() => import('../pages/LabTrendsPage'));
export const LazyPaymentSimulation = lazyWithRetry(() => import('../pages/PaymentSimulation'));
export const LazyPricingPlanManagement = lazyWithRetry(() => import('../pages/PricingPlanManagement'));
export const LazyPatientLinkingAdmin = lazyWithRetry(() => import('../pages/admin/PatientLinkingAdmin'));
export const LazyPatientLinkingManagement = lazyWithRetry(() => import('../pages/admin/PatientLinkingManagement'));
export const LazySuperAdminHealthRecordsDashboard = lazyWithRetry(() => import('../pages/super-admin/SuperAdminHealthRecordsDashboard'));
export const LazyMedicationAnalytics = lazyWithRetry(() => import('../pages/MedicationAnalytics'));

// Phase 3: Admin Features with retry mechanism
export const LazySaasAdminDashboard = lazyWithRetry(() => import('../pages/admin/SaasAdminDashboard'));
export const LazySystemMonitoringDashboard = lazyWithRetry(() => import('../components/admin/SystemMonitoringDashboard'));
export const LazyApiManagementDashboard = lazyWithRetry(() => import('../components/admin/ApiManagementDashboard'));

// Workspace management components with retry mechanism
export const LazyWorkspaceTeam = lazyWithRetry(() => import('../pages/workspace/WorkspaceTeam'));

// Workspace admin components with retry mechanism
export const LazyEducationalResourceManagement = lazyWithRetry(() => import('../pages/workspace-admin/EducationalResourceManagement'));
export const LazyPatientPortalAdmin = lazyWithRetry(() => import('../pages/workspace-admin/PatientPortalAdmin'));

// Blog components with retry mechanism
export const LazyBlogPage = lazyWithRetry(() => import('../pages/public/BlogPage'));
export const LazyBlogPostDetails = lazyWithRetry(() => import('../components/blog/BlogPostDetails'));
export const LazyBlogManagement = lazyWithRetry(() => import('../pages/super-admin/BlogManagement'));
export const LazyBlogPostEditor = lazyWithRetry(() => import('../pages/super-admin/BlogPostEditor'));

// Preloading functions for critical routes
export const preloadCriticalRoutes = () => {
  // Preload dashboard and patients as they are most commonly accessed
  import('../pages/ModernDashboardPage');
  import('../pages/Patients');
};

export const preloadSecondaryRoutes = () => {
  // Preload secondary routes that users might navigate to
  import('../pages/ClinicalNotes');
  import('../pages/Medications');
};

export const preloadModuleRoutes = () => {
  // Preload module routes
  import('../modules/diagnostics/pages/DiagnosticDashboard');
  import('../modules/reports-analytics/components/ReportsAnalyticsDashboard');
};