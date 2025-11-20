import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  Skeleton,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import Grid from '@mui/material/Grid2';

import { usePatientDashboardMTRData } from '../queries/usePatientMTRIntegration';
import { formatDistanceToNow, format } from 'date-fns';

interface PatientMTRSessionsTabProps {
  patientId: string;
}

const PatientMTRSessionsTab: React.FC<PatientMTRSessionsTabProps> = ({ patientId }) => {
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen for MTR completion events to refresh the component
  useEffect(() => {
    const handleMTRCompleted = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    // Listen for custom events when MTR sessions are completed
    window.addEventListener('mtr-session-completed', handleMTRCompleted);

    return () => {
      window.removeEventListener('mtr-session-completed', handleMTRCompleted);
    };
  }, []);

  // Fetch MTR data for this patient
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
  } = usePatientDashboardMTRData(
    patientId,
    !!patientId && patientId.length === 24
  );

  // Extract data with proper typing - backend API only
  const typedData = dashboardData as any;
  const { activeMTRs = [], recentMTRs = [], mtrSummary } = typedData || {};

  // Force re-calculation when refreshTrigger changes
  useEffect(() => {
    // This effect will cause the component to re-render when refreshTrigger changes
  }, [refreshTrigger]);

  // Calculate statistics from backend data only
  const totalSessions = mtrSummary?.totalMTRSessions || 0;
  const completedSessions = mtrSummary?.completedMTRSessions || 0;
  const activeSessions = mtrSummary?.activeMTRSessions || 0;
  const lastMTRDate = mtrSummary?.lastMTRDate;

  // Use backend sessions only
  const allSessions = [...(activeMTRs || []), ...(recentMTRs || [])];

  const handleStartNewMTR = () => {
    // Navigate directly to new MTR page with patient pre-selected
    navigate(`/pharmacy/medication-therapy/new?patientId=${patientId}`);
  };

  const handleViewSession = (sessionId: string) => {
    // Navigate to MTR summary
    navigate(`/pharmacy/medication-therapy/${sessionId}/summary`);
  };

  const handleContinueSession = (sessionId: string) => {
    // Navigate to continue MTR session
    navigate(`/pharmacy/medication-therapy/${sessionId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon />;
      case 'in_progress':
        return <ScheduleIcon />;
      default:
        return <AssignmentIcon />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load MTR sessions. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Start MTR Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Medication Therapy Review
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleStartNewMTR}
          sx={{ minWidth: 140 }}
        >
          Start MTR
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                {totalSessions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Sessions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold' }}>
                {completedSessions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" color="warning.main" sx={{ fontWeight: 'bold' }}>
                {activeSessions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {lastMTRDate ? formatDistanceToNow(new Date(lastMTRDate), { addSuffix: true }) : 'Never'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last MTR
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sessions List */}
      {totalSessions === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No MTR Sessions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Start the first medication therapy review for this patient
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleStartNewMTR}
              size="large"
            >
              Start First MTR
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              MTR Sessions History
            </Typography>
            <List>
              {allSessions.map((session: any, index: number) => (
                <React.Fragment key={session._id}>
                  <ListItem
                    sx={{
                      py: 2,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                            Review #{session.reviewNumber}
                          </Typography>
                          <Chip
                            icon={getStatusIcon(session.status)}
                            label={session.status.replace('_', ' ').toUpperCase()}
                            color={getStatusColor(session.status) as any}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Created: {format(new Date(session.createdAt || session.startedAt), 'MMM dd, yyyy HH:mm')}
                          </Typography>
                          {session.completedAt && (
                            <Typography variant="body2" color="text.secondary">
                              Completed: {format(new Date(session.completedAt), 'MMM dd, yyyy HH:mm')}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">
                            Type: {session.reviewType} • Priority: {session.priority}
                          </Typography>
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        {session.status === 'in_progress' ? (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => handleContinueSession(session._id)}
                          >
                            Continue
                          </Button>
                        ) : (
                          <IconButton
                            onClick={() => handleViewSession(session._id)}
                            color="primary"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        )}
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < allSessions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PatientMTRSessionsTab;