import { PermissionMatrix, UserRole, WorkplaceRole, SubscriptionTier } from '../types/auth';

/**
 * Comprehensive permission matrix configuration
 * Defines which roles and features are required for each action
 */
export const PERMISSION_MATRIX: PermissionMatrix = {
    // ========================================
    // INVITATION MANAGEMENT
    // ========================================
    'invitation.create': {
        workplaceRoles: ['Owner'],
        features: ['teamManagement'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'invitation.delete': {
        workplaceRoles: ['Owner'],
        features: ['teamManagement'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'invitation.list': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'invitation.resend': {
        workplaceRoles: ['Owner'],
        features: ['teamManagement'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'invitation.view': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },

    // ========================================
    // PATIENT MANAGEMENT
    // ========================================
    'patient.create': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        features: ['patientLimit'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'patient.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician', 'Assistant'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'patient.update': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'patient.delete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'patient.export': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['dataExport'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'patient.import': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['dataImport'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // CLINICAL NOTES
    // ========================================
    'clinical_notes.create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['clinicalNotesLimit'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_notes.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_notes.update': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_notes.delete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'clinical_notes.export': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['careNoteExport'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'clinical_notes.confidential_access': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_notes.bulk_operations': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['bulkOperations'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'clinical_notes.audit_access': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        features: ['auditLogs'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'clinical_notes.attachment_upload': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['fileAttachments'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_notes.search_advanced': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        features: ['advancedSearch'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },

    // ========================================
    // MEDICATION MANAGEMENT
    // ========================================
    'medication.create': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'medication.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician', 'Assistant'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'medication.update': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'medication.delete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // CLINICAL INTERVENTIONS
    // ========================================
    'clinical_intervention.create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['clinicalInterventions'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_intervention.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        features: ['clinicalInterventions'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_intervention.update': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['clinicalInterventions'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_intervention.delete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['clinicalInterventions'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'clinical_intervention.assign': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['clinicalInterventions', 'teamManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'clinical_intervention.reports': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['clinicalInterventions', 'advancedReports'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'clinical_intervention.export': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['clinicalInterventions', 'dataExport'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // AI DIAGNOSTICS & THERAPEUTICS
    // ========================================
    'diagnostic:read': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'diagnostic:create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'diagnostic:process': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'diagnostic:review': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'diagnostic:approve': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'diagnostic:intervention': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics', 'clinicalInterventions'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'diagnostic:cancel': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'diagnostic:retry': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'diagnostic:analytics': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['ai_diagnostics', 'advancedReports'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },

    // ========================================
    // LAB INTEGRATION (AI-Powered Lab Result Interpretation & Therapy Management)
    // ========================================
    'lab_integration:create': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        features: ['lab_integration'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_integration:read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'intern_pharmacist', 'pharmacy_outlet'],
        features: ['lab_integration'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_integration:update': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        features: ['lab_integration'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_integration:approve': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        systemRoles: ['pharmacist', 'pharmacy_outlet'],
        features: ['lab_integration'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_integration:escalate': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        systemRoles: ['pharmacist', 'pharmacy_outlet'],
        features: ['lab_integration'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_integration:trends': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        features: ['lab_integration', 'advancedReports'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },

    // ========================================
    // LABORATORY FINDINGS (Universal Lab Results Management)
    // ========================================
    'lab_results:read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet', 'intern_pharmacist'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'lab_technician', 'intern_pharmacist'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_results:create': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'lab_technician', 'pharmacy_outlet'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_results:update': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        systemRoles: ['pharmacist', 'lab_technician', 'pharmacy_outlet'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_results:delete': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'lab_results:signoff': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        systemRoles: ['pharmacist', 'pharmacy_outlet'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_results:upload': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'lab_technician', 'pharmacy_outlet'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_templates:read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet', 'intern_pharmacist'],
        systemRoles: ['pharmacist', 'pharmacy_team', 'lab_technician', 'intern_pharmacist', 'pharmacy_outlet'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_templates:create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        systemRoles: ['pharmacist', 'pharmacy_outlet'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_templates:update': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        systemRoles: ['pharmacist', 'pharmacy_outlet'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'lab_templates:delete': {
        workplaceRoles: ['Owner'],
        features: ['laboratory_findings'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // APPOINTMENT MANAGEMENT
    // ========================================
    'appointment.create': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician', 'Assistant', 'pharmacy_outlet'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.update': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.delete': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'appointment.reschedule': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.cancel': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.confirm': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.complete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.manage': {
        workplaceRoles: ['Owner', 'pharmacy_outlet'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.calendar_view': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician', 'Assistant'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.available_slots': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician', 'Assistant'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'appointment.analytics': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling', 'advancedReports'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // FOLLOW-UP TASK MANAGEMENT
    // ========================================
    'followup.create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['followUpManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        features: ['followUpManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.update': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['followUpManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.delete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['followUpManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'followup.complete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['followUpManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.escalate': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['followUpManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.convert_to_appointment': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['followUpManagement', 'appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.assign': {
        workplaceRoles: ['Owner'],
        features: ['followUpManagement', 'teamManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.manage': {
        workplaceRoles: ['Owner'],
        features: ['followUpManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'followup.analytics': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['followUpManagement', 'advancedReports'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // SCHEDULE MANAGEMENT
    // ========================================
    'schedule.create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['scheduleManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'schedule.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        features: ['scheduleManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'schedule.update': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['scheduleManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'schedule.delete': {
        workplaceRoles: ['Owner'],
        features: ['scheduleManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'schedule.time_off_request': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['scheduleManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'schedule.time_off_approve': {
        workplaceRoles: ['Owner'],
        features: ['scheduleManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'schedule.capacity_view': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['scheduleManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },

    // ========================================
    // REMINDER MANAGEMENT
    // ========================================
    'reminder.create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'reminder.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'reminder.send': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'reminder.template_manage': {
        workplaceRoles: ['Owner'],
        features: ['appointmentScheduling'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'reminder.analytics': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['appointmentScheduling', 'advancedReports'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // SUBSCRIPTION MANAGEMENT
    // ========================================
    'subscription.manage': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'subscription.view': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'subscription.upgrade': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'subscription.downgrade': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'subscription.cancel': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // WORKSPACE SETTINGS
    // ========================================
    'workspace.settings': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'workspace.delete': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: false,
    },
    'workspace.transfer': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'workspace.manage': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'workspace.analytics': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },

    // ========================================
    // REPORTS AND ANALYTICS
    // ========================================
    'reports.basic': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'reports.advanced': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['advancedReports'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'reports.export': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['reportsExport'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'reports.schedule': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['scheduledReports'],
        planTiers: ['pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // ADR (ADVERSE DRUG REACTION) FEATURES
    // ========================================
    'adr.create': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['adrModule', 'adrReporting'],
        planTiers: ['pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'adr.read': {
        workplaceRoles: ['Owner', 'Pharmacist', 'Technician'],
        features: ['adrModule'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'adr.update': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['adrModule'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'adr.delete': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['adrModule'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'adr.report': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['adrReporting'],
        planTiers: ['pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // MULTI-LOCATION FEATURES
    // ========================================
    'location.create': {
        workplaceRoles: ['Owner'],
        features: ['multiLocationDashboard'],
        planTiers: ['network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'location.read': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['multiLocationDashboard'],
        planTiers: ['network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'location.update': {
        workplaceRoles: ['Owner'],
        features: ['multiLocationDashboard'],
        planTiers: ['network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'location.delete': {
        workplaceRoles: ['Owner'],
        features: ['multiLocationDashboard'],
        planTiers: ['network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'location.manage': {
        workplaceRoles: ['Owner'],
        features: ['multiLocationDashboard'],
        planTiers: ['network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // TEAM MANAGEMENT
    // ========================================
    'team.invite': {
        workplaceRoles: ['Owner'],
        features: ['multiUserSupport', 'teamManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'team.manage': {
        workplaceRoles: ['Owner'],
        features: ['teamManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'team.remove': {
        workplaceRoles: ['Owner'],
        features: ['teamManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'team.role_change': {
        workplaceRoles: ['Owner'],
        features: ['teamManagement'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },

    // ========================================
    // API ACCESS
    // ========================================
    'api.access': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['apiAccess'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'api.key_generate': {
        workplaceRoles: ['Owner'],
        features: ['apiAccess'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'api.key_revoke': {
        workplaceRoles: ['Owner'],
        features: ['apiAccess'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // BILLING AND PAYMENTS
    // ========================================
    'billing.view': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'billing.manage': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'billing.history': {
        workplaceRoles: ['Owner'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },

    // ========================================
    // ADMIN FEATURES
    // ========================================
    'admin.users': {
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'admin.workspaces': {
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'admin.subscriptions': {
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'admin.feature_flags': {
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },
    'admin.system_settings': {
        systemRoles: ['super_admin'],
        requiresActiveSubscription: false,
        allowTrialAccess: true,
    },

    // ========================================
    // ANALYTICS AND REPORTING
    // ========================================
    'view_analytics': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'view_appointment_analytics': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'view_followup_analytics': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'view_reminder_analytics': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'view_capacity_analytics': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        requiresActiveSubscription: true,
        allowTrialAccess: true,
    },
    'export_analytics': {
        workplaceRoles: ['Owner', 'Pharmacist', 'pharmacy_outlet'],
        features: ['dataExport'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // AUDIT AND COMPLIANCE
    // ========================================
    'audit.view': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        features: ['auditLogs'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'audit.export': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        features: ['auditLogs', 'dataExport'],
        planTiers: ['pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'audit.security': {
        workplaceRoles: ['Owner'],
        systemRoles: ['super_admin'],
        features: ['auditLogs', 'securityMonitoring'],
        planTiers: ['pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // INTEGRATIONS
    // ========================================
    'integration.configure': {
        workplaceRoles: ['Owner'],
        features: ['integrations'],
        planTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'integration.manage': {
        workplaceRoles: ['Owner', 'Pharmacist'],
        features: ['integrations'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },

    // ========================================
    // BACKUP AND RESTORE
    // ========================================
    'backup.create': {
        workplaceRoles: ['Owner'],
        features: ['dataBackup'],
        planTiers: ['pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'backup.restore': {
        workplaceRoles: ['Owner'],
        features: ['dataBackup'],
        planTiers: ['pharmily', 'network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
    'backup.schedule': {
        workplaceRoles: ['Owner'],
        features: ['dataBackup', 'scheduledBackups'],
        planTiers: ['network', 'enterprise'],
        requiresActiveSubscription: true,
        allowTrialAccess: false,
    },
};

/**
 * Role hierarchy for permission inheritance
 * Higher roles inherit permissions from lower roles
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
    super_admin: [
        'super_admin',
        'pharmacy_outlet',
        'pharmacy_team',
        'pharmacist',
        'intern_pharmacist',
        'lab_technician',
        'owner',
    ],
    pharmacy_outlet: ['pharmacy_outlet', 'pharmacy_team', 'pharmacist'],
    pharmacy_team: ['pharmacy_team', 'pharmacist'],
    pharmacist: ['pharmacist'],
    intern_pharmacist: ['intern_pharmacist'],
    lab_technician: ['lab_technician'],
    owner: ['owner', 'pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'lab_technician'],
};

/**
 * Workplace role hierarchy for permission inheritance
 * Higher roles inherit permissions from lower roles
 */
export const WORKPLACE_ROLE_HIERARCHY: Record<WorkplaceRole, WorkplaceRole[]> = {
    Owner: ['Owner', 'Pharmacist', 'Staff', 'Technician', 'Cashier', 'Assistant', 'intern_pharmacist'],
    pharmacy_outlet: ['pharmacy_outlet', 'Owner', 'Pharmacist', 'Staff', 'Technician', 'Cashier', 'Assistant', 'intern_pharmacist'],
    Pharmacist: ['Pharmacist', 'Technician', 'Assistant', 'intern_pharmacist'],
    Staff: ['Staff', 'Technician', 'Assistant'],
    Technician: ['Technician', 'Assistant'],
    Cashier: ['Cashier', 'Assistant'],
    Assistant: ['Assistant'],
    intern_pharmacist: ['intern_pharmacist'],
};

/**
 * Plan tier hierarchy for upgrade/downgrade logic
 */
export const PLAN_TIER_HIERARCHY: Record<SubscriptionTier, number> = {
    free_trial: 0,
    basic: 1,
    pro: 2,
    pharmily: 3,
    network: 4,
    enterprise: 5,
};

/**
 * Default features available to all plans
 */
export const DEFAULT_FEATURES = [
    'dashboard',
    'basicReports',
    'userManagement',
];

/**
 * Features that require specific plan tiers
 */
export const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
    free_trial: ['*'], // All features during trial
    basic: [
        'dashboard',
        'patientLimit',
        'basicReports',
        'emailReminders',
        'clinicalInterventions',
    ],
    pro: [
        'dashboard',
        'patientLimit',
        'basicReports',
        'advancedReports',
        'emailReminders',
        'dataExport',
        'apiAccess',
        'auditLogs',
        'integrations',
        'ai_diagnostics',
        'lab_integration',
        'laboratory_findings',
        'clinicalInterventions',
    ],
    pharmily: [
        'dashboard',
        'patientLimit',
        'basicReports',
        'advancedReports',
        'emailReminders',
        'dataExport',
        'dataImport',
        'apiAccess',
        'auditLogs',
        'integrations',
        'adrModule',
        'adrReporting',
        'scheduledReports',
        'dataBackup',
        'ai_diagnostics',
        'lab_integration',
        'laboratory_findings',
        'clinicalInterventions',
    ],
    network: [
        'dashboard',
        'patientLimit',
        'basicReports',
        'advancedReports',
        'emailReminders',
        'dataExport',
        'dataImport',
        'apiAccess',
        'auditLogs',
        'integrations',
        'adrModule',
        'adrReporting',
        'scheduledReports',
        'dataBackup',
        'scheduledBackups',
        'multiLocationDashboard',
        'teamManagement',
        'multiUserSupport',
        'ai_diagnostics',
        'lab_integration',
        'laboratory_findings',
        'clinicalInterventions',
    ],
    enterprise: [
        'dashboard',
        'patientLimit',
        'basicReports',
        'advancedReports',
        'emailReminders',
        'dataExport',
        'dataImport',
        'apiAccess',
        'auditLogs',
        'integrations',
        'adrModule',
        'adrReporting',
        'scheduledReports',
        'dataBackup',
        'scheduledBackups',
        'multiLocationDashboard',
        'teamManagement',
        'multiUserSupport',
        'customIntegrations',
        'prioritySupport',
        'dedicatedManager',
        'ai_diagnostics',
        'lab_integration',
        'laboratory_findings',
        'clinicalInterventions',
    ],
};