import React, { useMemo } from 'react';
import { ThemeProvider, CssBaseline, Box, Toolbar } from '@mui/material';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { createAppTheme } from './theme/index';
import { AuthProvider } from './context/AuthContext';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { useTheme as useThemeStore } from './stores/themeStore';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import { NotificationProvider } from './components/common/NotificationSystem';

// Import theme styles
import './styles/theme.css';
import './styles/dark-mode-overrides.css';

import Landing from './pages/Landing';
import About from './pages/About';
import Contact from './pages/Contact';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import MultiStepRegister from './pages/MultiStepRegister';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
// Modern Dashboard is now the default dashboard
import ModernDashboardPage from './pages/ModernDashboardPage';
import Patients from './pages/Patients';
// Lazy load Clinical Notes components for better performance
// Lazy loading components is handled directly in routes
// import {
//   LazyClinicalNotesDashboard,
//   LazyClinicalNoteDetail,
//   LazyClinicalNoteForm,
//   preloadClinicalNotesComponents,
// } from './components/ClinicalNotesLazy';

// Keep original imports as fallback
import ClinicalNotes from './pages/ClinicalNotes';
import ClinicalNoteDetailPage from './pages/ClinicalNoteDetailPage';
import ClinicalNoteFormPage from './pages/ClinicalNoteFormPage';
import Medications from './pages/Medications';
import MedicationsManagementDashboard from './components/medications/MedicationsManagementDashboard';
import PatientMedicationsPage from './components/medications/PatientMedicationsPage';
import Subscriptions from './pages/Subscriptions';
import SaasSettings from './pages/SaasSettings';
import FeatureFlagsPage from './pages/FeatureFlags';
import Settings from './pages/Settings';
import SettingsTheme from './pages/SettingsTheme';
import Help from './pages/Help';
import MTRHelp from './pages/MTRHelp';
import Profile from './pages/Profile';

// Pharmacy Module Components
import MedicationTherapyReview from './pages/MedicationTherapyReview';
import ClinicalInterventionsLayout from './components/ClinicalInterventionsLayout';
import CommunicationHub from './pages/CommunicationHub';
import DrugInformationCenter from './pages/DrugInformationCenter';
import ClinicalDecisionSupport from './pages/ClinicalDecisionSupport';
import PharmacyReports from './pages/PharmacyReports';
import PharmacyUserManagement from './pages/PharmacyUserManagement';
import PharmacySettings from './pages/PharmacySettings';

// Diagnostic Module Components
import DiagnosticDashboard from './modules/diagnostics/pages/DiagnosticDashboard';
import CaseIntakePage from './modules/diagnostics/pages/CaseIntakePage';
import CaseResultsPage from './modules/diagnostics/pages/CaseResultsPage';
import ResultsReviewPage from './modules/diagnostics/pages/ResultsReviewPage';
import ComponentDemo from './modules/diagnostics/pages/ComponentDemo';

// Drug Interaction Module
import InteractionReviewPage from './pages/InteractionReviewPage';
import TestInteractionPage from './components/TestInteractionPage';

// Test Components
import SidebarTest from './components/SidebarTest';

// Patient Management Components
import PatientForm from './components/PatientForm';
import PatientManagement from './components/PatientManagement';

// RBAC and Enhanced Components
import AdminDashboard from './components/admin/AdminDashboard';
import LicenseUpload from './components/license/LicenseUpload';
import SubscriptionManagementNew from './pages/SubscriptionManagement';
import SubscriptionSuccessNew from './pages/SubscriptionSuccess';
import TrialExpiryHandler from './components/TrialExpiryHandler';

function ThemedApp(): JSX.Element {
  // Get current theme from store
  const { resolvedTheme } = useThemeStore();

  // Create dynamic theme based on current theme mode
  const dynamicTheme = useMemo(
    () => createAppTheme(resolvedTheme === 'dark' ? 'dark' : 'light'),
    [resolvedTheme]
  );

  return (
    <ThemeProvider theme={dynamicTheme}>
      <CssBaseline />
      <AuthProvider>
        <SubscriptionProvider>
          <FeatureFlagProvider>
            <NotificationProvider>
              <Router>
                <Box
                  sx={{
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                  }}
                >
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: '#363636',
                        color: '#fff',
                      },
                      success: {
                        duration: 3000,
                        iconTheme: {
                          primary: '#4ade80',
                          secondary: '#fff',
                        },
                      },
                      error: {
                        duration: 4000,
                        iconTheme: {
                          primary: '#ef4444',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<MultiStepRegister />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPassword />}
                    />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    {/* Protected Routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <ModernDashboardPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Removed old dashboard route */}
                    <Route
                      path="/patients"
                      element={
                        <ProtectedRoute
                          requiredFeature="patient_management"
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <Patients />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/patients/new"
                      element={
                        <ProtectedRoute
                          requiredFeature="patient_management"
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <PatientForm />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/patients/:patientId"
                      element={
                        <ProtectedRoute
                          requiredFeature="patient_management"
                          requiresActiveSubscription
                        >
                          <PatientManagement />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/patients/:patientId/medications"
                      element={
                        <ProtectedRoute
                          requiredFeature="medication_management"
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <PatientMedicationsPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/patients/:patientId/edit"
                      element={
                        <ProtectedRoute
                          requiredFeature="patient_management"
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <PatientForm />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/notes"
                      element={
                        <ProtectedRoute
                          requiredFeature="clinical_notes"
                          requiresLicense
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <ClinicalNotes />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/notes/new"
                      element={
                        <ProtectedRoute
                          requiredFeature="clinical_notes"
                          requiresLicense
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <ClinicalNoteFormPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/notes/:id"
                      element={
                        <ProtectedRoute
                          requiredFeature="clinical_notes"
                          requiresLicense
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <ClinicalNoteDetailPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/notes/:id/edit"
                      element={
                        <ProtectedRoute
                          requiredFeature="clinical_notes"
                          requiresLicense
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <ClinicalNoteFormPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/medications"
                      element={
                        <ProtectedRoute
                          requiredFeature="medication_management"
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <Medications />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/medications/dashboard"
                      element={
                        <ProtectedRoute
                          requiredFeature="medication_management"
                          requiresActiveSubscription
                        >
                          <AppLayout>
                            <MedicationsManagementDashboard />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/subscriptions"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Subscriptions />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />

                    {/* Pharmacy Module Routes */}
                    <Route
                      path="/pharmacy/medication-therapy"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <MedicationTherapyReview />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/medication-therapy/new"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <MedicationTherapyReview />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/medication-therapy/patient/:patientId"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <MedicationTherapyReview />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/medication-therapy/:reviewId"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <MedicationTherapyReview />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/medication-therapy/:reviewId/step/:stepId"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <MedicationTherapyReview />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/medication-therapy/:reviewId/summary"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <MedicationTherapyReview />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/clinical-interventions/*"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <ClinicalInterventionsLayout />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/diagnostics"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <DiagnosticDashboard />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/diagnostics/case/new"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <CaseIntakePage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/diagnostics/case/:requestId"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <ResultsReviewPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/diagnostics/case/:caseId/results"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <CaseResultsPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/diagnostics/demo"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <ComponentDemo />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/communication"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <CommunicationHub />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/drug-information"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <DrugInformationCenter />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/decision-support"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <ClinicalDecisionSupport />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/reports"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <PharmacyReports />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/user-management"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <PharmacyUserManagement />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pharmacy/settings"
                      element={
                        <ProtectedRoute requiresActiveSubscription>
                          <AppLayout>
                            <PharmacySettings />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />

                    {/* Drug Interaction Routes */}
                    <Route
                      path="/interactions"
                      element={
                        <AppLayout>
                          <InteractionReviewPage />
                        </AppLayout>
                      }
                    />
                    <Route
                      path="/interactions/pending-reviews"
                      element={<TestInteractionPage />}
                    />
                    <Route
                      path="/interactions/:interactionId"
                      element={
                        <AppLayout>
                          <InteractionReviewPage />
                        </AppLayout>
                      }
                    />

                    {/* Admin Routes */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute requiredRole="super_admin">
                          <AppLayout>
                            <AdminDashboard />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Feature Flags Route */}
                    <Route
                      path="/feature-flags"
                      element={
                        <ProtectedRoute requiredRole="super_admin">
                          <AppLayout>
                            <FeatureFlagsPage />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* License Management */}
                    <Route
                      path="/license"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <LicenseUpload />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Enhanced Subscription Management */}
                    <Route
                      path="/subscription-management"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <SubscriptionManagementNew />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Subscription Success Page - No auth required for payment redirection */}
                    <Route
                      path="/subscription/success"
                      element={
                        <AppLayout>
                          <SubscriptionSuccessNew />
                        </AppLayout>
                      }
                    />
                    {/* Subscription Plans - This should not require active subscription */}
                    <Route
                      path="/dashboard/subscription/plans"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <SubscriptionManagementNew />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/subscription/plans"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <SubscriptionManagementNew />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* SaaS Settings - accessible to everyone */}
                    <Route
                      path="/saas-settings"
                      element={
                        <AppLayout>
                          <SaasSettings />
                        </AppLayout>
                      }
                    />
                    {/* Profile Page */}
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Profile />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Settings Page */}
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Settings />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Theme Settings Page */}
                    <Route
                      path="/settings/theme"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <SettingsTheme />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Help & Support Page */}
                    <Route
                      path="/help"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Help />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* MTR Help & Documentation */}
                    <Route
                      path="/help/mtr"
                      element={
                        <ProtectedRoute requiredFeature="medication_therapy_review">
                          <AppLayout>
                            <MTRHelp />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Sidebar Test Page - Development Only */}
                    <Route
                      path="/test/sidebar"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <SidebarTest />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    {/* Redirect any unknown routes to dashboard */}
                    <Route
                      path="*"
                      element={<Navigate to="/dashboard" replace />}
                    />
                  </Routes>
                </Box>
              </Router>
            </NotificationProvider>
          </FeatureFlagProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Layout wrapper for protected routes
interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <TrialExpiryHandler>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: 'background.default',
          color: 'text.primary',
          transition: 'background-color 0.3s ease, color 0.3s ease',
        }}
      >
        <Navbar />
        <Toolbar /> {/* This creates space for the fixed AppBar */}
        <Box
          sx={{
            display: 'flex',
            flex: 1,
            backgroundColor: 'background.default',
            transition: 'background-color 0.3s ease',
          }}
        >
          <ErrorBoundary>
            <Sidebar />
          </ErrorBoundary>
          <Box
            component="main"
            sx={{
              flex: 1,
              overflow: 'auto',
              backgroundColor: 'background.default',
              color: 'text.primary',
              minHeight: 'calc(100vh - 64px)', // Account for navbar height
              transition: 'background-color 0.3s ease, color 0.3s ease',
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </TrialExpiryHandler>
  );
};

export default ThemedApp;
