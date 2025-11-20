import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import MTRErrorBoundary from '../components/MTRErrorBoundary';

// Import MTR components
import MTRDashboard from '../components/MTRDashboard';
import MTRSummary from '../components/MTRSummary';

// Import store and types
import { useMTRStore } from '../stores/mtrStore';

const MedicationTherapyReview: React.FC = () => {
  const navigate = useNavigate();
  const { reviewId, patientId } = useParams<{
    reviewId?: string;
    patientId?: string;
  }>();
  const isSummaryRoute = window.location.pathname.includes('/summary');

  // Store
  const {
    currentReview,
    selectedPatient,
    errors,
    loadReview,
    createReview,
    clearStore,
  } = useMTRStore();

  // Local state
  const [showDashboard, setShowDashboard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize MTR session
  useEffect(() => {
    const initializeMTR = async () => {
      if (reviewId) {
        setIsLoading(true);
        try {
          await loadReview(reviewId);
          setShowDashboard(true);
        } catch (error) {
          console.error('Failed to load MTR session:', error);
        } finally {
          setIsLoading(false);
        }
      } else if (patientId) {
        setIsLoading(true);
        try {
          await createReview(patientId);
          setShowDashboard(true);
        } catch (error) {
          console.error('Failed to create MTR session:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // For base route, show dashboard immediately for patient selection
        setShowDashboard(true);
      }
    };

    initializeMTR();

    // Cleanup on unmount only if we're leaving the MTR module entirely
    return () => {
      if (
        !reviewId &&
        !patientId &&
        !window.location.pathname.includes('/medication-therapy')
      ) {
        clearStore();
      }
    };
  }, [reviewId, patientId, loadReview, createReview, clearStore]);

  // Handle MTR completion
  const handleMTRComplete = (completedReviewId: string) => {
    navigate(`/pharmacy/medication-therapy/${completedReviewId}/summary`);
  };

  // Handle MTR cancellation
  const handleMTRCancel = () => {
    navigate('/pharmacy/medication-therapy');
  };

  // Show loading state
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Breadcrumbs
          aria-label="breadcrumb"
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 3 }}
        >
          <Link component={RouterLink} to="/dashboard" color="inherit">
            Dashboard
          </Link>
          <Link
            component={RouterLink}
            to="/pharmacy/medication-therapy"
            color="inherit"
          >
            Medication Therapy Review
          </Link>
          <Typography color="textPrimary">Loading...</Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width="60%" height={40} />
          <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} />
        </Box>

        <Skeleton variant="rectangular" height={400} />
      </Container>
    );
  }

  // Show MTR Summary if this is a summary route
  if (isSummaryRoute && reviewId) {
    return <MTRSummary />;
  }

  // Show MTR Dashboard if we should show it
  if (showDashboard) {
    return (
      <MTRErrorBoundary>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          {/* Breadcrumb Navigation */}
          <Breadcrumbs
            aria-label="breadcrumb"
            separator={<NavigateNextIcon fontSize="small" />}
            sx={{ mb: 3 }}
          >
            <Link component={RouterLink} to="/dashboard" color="inherit">
              Dashboard
            </Link>
            <Link
              component={RouterLink}
              to="/pharmacy/medication-therapy"
              color="inherit"
            >
              Medication Therapy Review
            </Link>
            {selectedPatient && (
              <Typography color="textPrimary">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </Typography>
            )}
            {currentReview && (
              <Typography color="textPrimary">
                Review #{currentReview.reviewNumber}
              </Typography>
            )}
          </Breadcrumbs>

          {/* Session Header */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleMTRCancel}
              variant="outlined"
              size="sm"
            >
              Back to Overview
            </Button>

            {currentReview && currentReview.status && (
              <Chip
                label={`Status: ${currentReview.status
                  .replace('_', ' ')
                  .toUpperCase()}`}
                color={
                  currentReview.status === 'completed' ? 'success' : 'primary'
                }
                variant="outlined"
              />
            )}
          </Box>

          {/* Error Display */}
          {errors.general && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errors.general}
            </Alert>
          )}

          {/* MTR Dashboard */}
          <MTRDashboard
            patientId={patientId}
            reviewId={reviewId}
            onComplete={handleMTRComplete}
            onCancel={handleMTRCancel}
          />
        </Container>
      </MTRErrorBoundary>
    );
  }

  // Fallback - should not reach here with proper initialization
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Alert severity="warning">
        MTR session initialization failed. Please refresh the page.
      </Alert>
    </Container>
  );
};

export default MedicationTherapyReview;
