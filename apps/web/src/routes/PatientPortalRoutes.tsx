import React, { lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import PatientPortalRoute from '../components/patient-portal/PatientPortalRoute';
import { LazyWrapper } from '../components/LazyWrapper';
import { PageSkeleton } from '../components/skeletons/LoadingSkeletons';
import { useAuth } from '../context/AuthContext';

// Lazy load patient portal pages
const LazyPatientDashboard = lazy(() => import('../pages/patient-portal/PatientDashboard'));
const LazyPatientProfile = lazy(() => import('../pages/patient-portal/PatientProfile'));
const LazyPatientMedications = lazy(() => import('../pages/patient-portal/PatientMedications'));
const LazyPatientHealthRecords = lazy(() => import('../pages/patient-portal/PatientHealthRecords'));
const LazyPatientMessages = lazy(() => import('../pages/patient-portal/PatientMessages'));
const LazyPatientAppointments = lazy(() => import('../pages/patient-portal/PatientAppointments'));
const LazyPatientBilling = lazy(() => import('../pages/patient-portal/PatientBilling'));
const LazyPatientEducation = lazy(() => import('../pages/patient-portal/PatientEducation'));

// Lazy load public pages
const LazyPublicPatientPortal = lazy(() => import('../pages/public/PatientPortalLanding'));
const LazyPatientAuth = lazy(() => import('../pages/PatientAuth'));
const LazyBlogPage = lazy(() => import('../pages/public/BlogPage'));
const LazyBlogPostDetails = lazy(() => import('../components/blog/BlogPostDetails'));

// Lazy load admin pages
const LazyBlogManagement = lazy(() => import('../pages/super-admin/BlogManagement'));
const LazyBlogPostEditor = lazy(() => import('../pages/super-admin/BlogPostEditor'));
const LazyPatientPortalAdmin = lazy(() => import('../pages/workspace-admin/PatientPortalAdmin'));

// Lazy load super admin overview
const LazyPatientPortalOverview = lazy(() => import('../pages/super-admin/PatientPortalOverview'));

/**
 * Patient Portal Routes Configuration
 * Handles patient portal dashboard, blog, and workspace admin routes
 * 
 * Note: These routes use relative paths because they're nested under:
 * - /workspace-admin/patient-portal/* → matches path="/" for admin dashboard (or overview for super admin)
 * - /patient-portal/* → matches path="/:workspaceId", path="/:workspaceId/profile", etc.
 * - /blog/* → matches path="/", path="/:slug"
 * - /super-admin/blog/* → matches absolute paths for blog management
 */
const PatientPortalRoutes: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isBlogRoute = location.pathname.startsWith('/blog');
  const isWorkspaceAdminRoute = location.pathname.startsWith('/workspace-admin/patient-portal');
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <Routes>
      {/* Workspace Admin Patient Portal Routes - Must check first */}
      {isWorkspaceAdminRoute ? (
        <>
          {/* Super Admin sees overview of all workspaces */}
          {isSuperAdmin ? (
            <Route
              path="/"
              element={
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientPortalOverview />
                </LazyWrapper>
              }
            />
          ) : (
            /* Workspace admins see their workspace dashboard */
            <Route
              path="/"
              element={
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientPortalAdmin />
                </LazyWrapper>
              }
            />
          )}
          
          {/* Super Admin drill-down into specific workspace */}
          {isSuperAdmin && (
            <Route
              path="/:workspaceId"
              element={
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientPortalAdmin />
                </LazyWrapper>
              }
            />
          )}
        </>
      ) : isBlogRoute ? (
        <>
          <Route
            path="/"
            element={
              <LazyWrapper fallback={PageSkeleton}>
                <LazyBlogPage />
              </LazyWrapper>
            }
          />
          <Route
            path="/:slug"
            element={
              <LazyWrapper fallback={PageSkeleton}>
                <LazyBlogPostDetails />
              </LazyWrapper>
            }
          />
        </>
      ) : (
        <>
          {/* Protected Patient Portal Routes - For /patient-portal/* parent */}

          {/* Dashboard - Default route for authenticated patients */}
          <Route
            path="/:workspaceId"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientDashboard />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />

          {/* Patient Profile Management */}
          <Route
            path="/:workspaceId/profile"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientProfile />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />

          {/* Medication Management */}
          <Route
            path="/:workspaceId/medications"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientMedications />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />

          {/* Health Records & Vitals */}
          <Route
            path="/:workspaceId/health-records"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientHealthRecords />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />

          {/* Secure Messaging */}
          <Route
            path="/:workspaceId/messages"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientMessages />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />

          {/* Appointment Management */}
          <Route
            path="/:workspaceId/appointments"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientAppointments />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />

          {/* Billing & Payments */}
          <Route
            path="/:workspaceId/billing"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientBilling />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />

          {/* Health Education */}
          <Route
            path="/:workspaceId/education"
            element={
              <PatientPortalRoute requiresAuth={true}>
                <LazyWrapper fallback={PageSkeleton}>
                  <LazyPatientEducation />
                </LazyWrapper>
              </PatientPortalRoute>
            }
          />
        </>
      )}

      {/* Admin Routes for Blog Management */}
      <Route
        path="/super-admin/blog"
        element={
          <LazyWrapper fallback={PageSkeleton}>
            <LazyBlogManagement />
          </LazyWrapper>
        }
      />
      <Route
        path="/super-admin/blog/new"
        element={
          <LazyWrapper fallback={PageSkeleton}>
            <LazyBlogPostEditor />
          </LazyWrapper>
        }
      />
      <Route
        path="/super-admin/blog/edit/:postId"
        element={
          <LazyWrapper fallback={PageSkeleton}>
            <LazyBlogPostEditor />
          </LazyWrapper>
        }
      />
    </Routes>
  );
};

export default PatientPortalRoutes;