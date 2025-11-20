import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  LinearProgress,
  Divider,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PauseIcon from '@mui/icons-material/Pause';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import { useMTRSessionsByPatient, useCreateMTRSession } from '../queries/useMTRQueries';
import type { MedicationTherapyReview } from '../types/mtr';

interface PatientMTRSessionsListProps {
  patientId: string;
}

const PatientMTRSessionsList: React.FC<PatientMTRSessionsListProps> = ({
  patientId,
}) => {
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState<MedicationTherapyReview | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Queries
  const {
    data: sessionsResponse,
    isLoading,
    isError,
    error,
  } = useMTRSessionsByPatient(patientId);



  // Mutations
  const createMTRMutation = useCreateMTRSession();

  const sessions = sessionsResponse?.results || [];
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s: MedicationTherapyReview) => s.status === 'completed').length;
  const activeSessions = sessions.filter((s: MedicationTherapyReview) => s.status === 'in_progress').length;

  const handleStartMTR = async () => {
    try {
      const result = await createMTRMutation.mutateAsync({
        patientId,
        reviewType: 'initial',
        priority: 'routine',
        patientConsent: true,
        confidentialityAgreed: true,
      });

      const newMTRId = result?.data?.review?._id || result?.review?._id || (result as any)?._id;
      if (newMTRId) {
        navigate(`/pharmacy/medication-therapy/${newMTRId}`);
      }
    } catch (error) {
      console.error('Failed to start MTR:', error);
    }
  };

  const handleViewSession = (session: MedicationTherapyReview) => {
    setSelectedSession(session);
    setShowDetailsDialog(true);
  };

  const handleEditSession = (sessionId: string) => {
    navigate(`/pharmacy/medication-therapy/${sessionId}`);
  };

  const getStatusIcon = (status: MedicationTherapyReview['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'in_progress':
        return <PlayArrowIcon color="primary" />;
      case 'on_hold':
        return <PauseIcon color="warning" />;
      case 'cancelled':
        return <CancelIcon color="error" />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusColor = (status: MedicationTherapyReview['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'on_hold':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: MedicationTherapyReview['priority']) => {
    switch (priority) {
      case 'high_risk':
        return 'error';
      case 'urgent':
        return 'warning';
      case 'routine':
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon />
              <Typography variant="h6">MTR Sessions</Typography>
            </Box>
          }
        />
        <CardContent>
          <Stack spacing={2}>
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} variant="rectangular" height={60} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon />
              <Typography variant="h6">MTR Sessions</Typography>
            </Box>
          }
        />
        <CardContent>
          <Alert severity="error">
            Failed to load MTR sessions: {error?.message || 'Unknown error'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon />
              <Typography variant="h6">MTR Sessions</Typography>
            </Box>
          }
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleStartMTR}
              disabled={createMTRMutation.isPending}
            >
              Start MTR
            </Button>
          }
        />
        <CardContent>
          {/* Summary Stats */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              mb: 3,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {totalSessions}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Sessions
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {completedSessions}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completed
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {activeSessions}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Sessions Table */}
          {sessions.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Review Number</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session._id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {session.reviewNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(session.status)}
                          label={session.status.replace('_', ' ')}
                          color={getStatusColor(session.status) as any}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={session.priority.replace('_', ' ')}
                          color={getPriorityColor(session.priority) as any}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(session.startedAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {session.completedAt
                            ? new Date(session.completedAt).toLocaleDateString()
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={session.completionPercentage || 0}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption">
                            {session.completionPercentage || 0}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewSession(session)}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit MTR">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleEditSession(session._id)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            /* Empty State */
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <AssignmentIcon
                sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No MTR Sessions
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3 }}
              >
                Start the first medication therapy review for this patient
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleStartMTR}
                disabled={createMTRMutation.isPending}
              >
                Start First MTR
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Session Details Dialog */}
      <Dialog
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon />
            <Typography variant="h6">
              MTR Session Details - {selectedSession?.reviewNumber}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedSession && (
            <Stack spacing={3}>
              {/* Basic Info */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Session Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        icon={getStatusIcon(selectedSession.status)}
                        label={selectedSession.status.replace('_', ' ')}
                        color={getStatusColor(selectedSession.status) as any}
                        size="small"
                      />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Priority
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={selectedSession.priority.replace('_', ' ')}
                        color={getPriorityColor(selectedSession.priority) as any}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Review Type
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedSession.reviewType.replace('_', ' ')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Progress
                    </Typography>
                    <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={selectedSession.completionPercentage || 0}
                        sx={{ flex: 1, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption">
                        {selectedSession.completionPercentage || 0}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Divider />

              {/* Dates */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Timeline
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Started
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {new Date(selectedSession.startedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Completed
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedSession.completedAt
                        ? new Date(selectedSession.completedAt).toLocaleString()
                        : 'Not completed'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Divider />

              {/* Clinical Data Summary */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Clinical Summary
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="primary">
                      {selectedSession.medications?.length || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Medications
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="warning.main">
                      {selectedSession.problems?.length || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Problems
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="info.main">
                      {selectedSession.interventions?.length || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Interventions
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Additional Info */}
              {(selectedSession.referralSource || selectedSession.reviewReason) && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Additional Information
                    </Typography>
                    {selectedSession.referralSource && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Referral Source
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {selectedSession.referralSource}
                        </Typography>
                      </Box>
                    )}
                    {selectedSession.reviewReason && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Review Reason
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {selectedSession.reviewReason}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => {
              if (selectedSession) {
                handleEditSession(selectedSession._id);
                setShowDetailsDialog(false);
              }
            }}
          >
            Edit MTR
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PatientMTRSessionsList;