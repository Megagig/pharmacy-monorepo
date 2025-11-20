/**
 * Alerts Components Index
 * Export all alert-related components
 */

export { default as PatientAlertsPanel } from './PatientAlertsPanel';
export { default as DashboardAlertsWidget } from './DashboardAlertsWidget';
export { default as AlertsDemo } from './AlertsDemo';

// Re-export types for convenience
export type { PatientAlert, DashboardAlert, AlertFilters } from '../../types/alerts';