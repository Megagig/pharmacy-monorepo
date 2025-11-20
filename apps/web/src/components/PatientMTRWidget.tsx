import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import MTRIcon from '@mui/icons-material/Assignment';
import StartIcon from '@mui/icons-material/PlayArrow';
import ViewIcon from '@mui/icons-material/Visibility';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import CompletedIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/Timeline';
import { useNavigate } from 'react-router-dom';
import {
  usePatientDashboardMTRData,
  useSyncMedicationsWithMTR,
  useSyncDTPsWithMTR,
} from '../queries/usePatientMTRIntegration';
import { useCreateMTRSession } from '../queries/useMTRQueries';
import type { MedicationTherapyReview } from '../types/mtr';

// ===============================
// PATIENT MTR WIDGET COMPONENT
// ===============================

interface PatientMTRWidgetProps {
  patientId: string;
  onStartMTR?: (mtrId: string) => void;
  onViewMTR?: (mtrId: string) => void;
}

export const PatientMTRWidget: React.FC<PatientMTRWidgetProps> = ({
  patientId,
  onStartMTR,
  onViewMTR,
}) => {
  const navigate = useNavigate();
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [selectedMTRForSync, setSelectedMTRForSync] = useState<string | null>(
    null
  );

  // Queries
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
  } = usePatientDashboardMTRData(
    patientId,
    !!patientId && patientId.length === 24
  );

  // Mutations
  const createMTRMutation = useCreateMTRSession();
  const syncMedicationsMutation = useSyncMedicationsWithMTR();
  const syncDTPsMutation = useSyncDTPsWithMTR();

  const handleStartMTR = async (event?: React.MouseEvent) => {
    // Prevent default behavior and event propagation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Prevent multiple clicks
    if (createMTRMutation.isPending) {

      return;
    }

    try {

      const result = await createMTRMutation.mutateAsync({
        patientId,
        reviewType: 'initial',
        priority: 'routine',
        patientConsent: true,
        confidentialityAgreed: true,
      });

      // Check different possible response structures
      let newMTRId =
        result?.review?._id || result?.data?.review?._id || result?._id;

      if (!newMTRId) {
        console.error('No MTR ID returned from creation:', result);
        console.error(
          'Full result structure:',
          JSON.stringify(result, null, 2)
        );
        throw new Error('Failed to create MTR session - no ID returned');
      }

      if (onStartMTR) {
        onStartMTR(newMTRId);
      } else {
        // Navigate to the correct MTR route

        // Use setTimeout to ensure the navigation happens after the current event loop
        setTimeout(() => {
          navigate(`/pharmacy/medication-therapy/${newMTRId}`, {
            replace: false,
          });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to start MTR:', error);
      // The error notification is already handled by the mutation's onError
    }
  };

  const handleViewMTR = (mtrId: string) => {
    if (onViewMTR) {
      onViewMTR(mtrId);
    } else {
      navigate(`/pharmacy/medication-therapy/${mtrId}`);
    }
  };

  const handleSyncData = (mtrId: string) => {
    setSelectedMTRForSync(mtrId);
    setShowSyncDialog(true);
  };

  const handleConfirmSync = async () => {
    if (!selectedMTRForSync) return;

    try {
      await Promise.all([
        syncMedicationsMutation.mutateAsync({
          patientId,
          mtrId: selectedMTRForSync,
        }),
        syncDTPsMutation.mutateAsync({
          patientId,
          mtrId: selectedMTRForSync,
        }),
      ]);
    } catch (error) {
      console.error('Failed to sync data:', error);
    } finally {
      setShowSyncDialog(false);
      setSelectedMTRForSync(null);
    }
  };

  const getStatusIcon = (status: MedicationTherapyReview['status']) => {
    switch (status) {
      case 'completed':
        return <CompletedIcon color="success" />;
      case 'in_progress':
        return <StartIcon color="primary" />;
      case 'on_hold':
        return <ScheduleIcon color="warning" />;
      case 'cancelled':
        return <WarningIcon color="error" />;
      default:
        return <MTRIcon />;
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
              <MTRIcon />
              <Typography variant="h6">Medication Therapy Review</Typography>
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
              <MTRIcon />
              <Typography variant="h6">Medication Therapy Review</Typography>
            </Box>
          }
        />
        <CardContent>
          <Alert severity="error">
            Failed to load MTR data: {error?.message || 'Unknown error'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Type the dashboard data properly
  interface MTRSummary {
    totalMTRSessions: number;
    completedMTRSessions: number;
    activeMTRSessions: number;
    lastMTRDate?: string;
  }

  interface MTRSession {
    _id: string;
    reviewNumber: string;
    status: 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
    priority: 'routine' | 'urgent' | 'high_risk';
    startedAt: string;
    completedAt?: string;
    completionPercentage: number;
    isOverdue?: boolean;
  }

  interface PendingAction {
    description: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: string;
  }

  interface DashboardData {
    activeMTRs: MTRSession[];
    recentMTRs: MTRSession[];
    mtrSummary: MTRSummary;
    pendingActions: PendingAction[];
  }

  const typedData = dashboardData as DashboardData | undefined;
  const { activeMTRs, recentMTRs, mtrSummary, pendingActions } = typedData || {
    activeMTRs: [],
    recentMTRs: [],
    mtrSummary: {
      totalMTRSessions: 0,
      completedMTRSessions: 0,
      activeMTRSessions: 0,
    },
    pendingActions: [],
  };

  return (
    <>
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MTRIcon />
              <Typography variant="h6">Medication Therapy Review</Typography>
            </Box>
          }
          action={
            <Stack direction="row" spacing={1}>
              {mtrSummary && mtrSummary.totalMTRSessions > 0 && (
                <Tooltip title="View MTR History">
                  <IconButton
                    size="small"
                    onClick={() =>
                      navigate(`/patients/${patientId}/mtr-history`)
                    }
                  >
                    <HistoryIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={(e) => handleStartMTR(e)}
                disabled={createMTRMutation.isPending}
                type="button"
              >
                Start MTR
              </Button>
            </Stack>
          }
        />
        <CardContent>
          <Stack spacing={3}>
            {/* MTR Summary Stats */}
            {mtrSummary && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 2,
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {mtrSummary.totalMTRSessions}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Sessions
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {mtrSummary.completedMTRSessions}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Completed
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {mtrSummary.activeMTRSessions}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {mtrSummary.lastMTRDate
                      ? new Date(mtrSummary.lastMTRDate).toLocaleDateString()
                      : 'Never'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last MTR
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Active MTR Sessions */}
            {activeMTRs && activeMTRs.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    Active MTR Sessions
                  </Typography>
                  <List dense>
                    {activeMTRs.map((mtr: MTRSession) => (
                      <ListItem
                        key={mtr._id as string}
                        sx={{
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                        }}
                        secondaryAction={
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Sync patient data">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  handleSyncData(mtr._id as string)
                                }
                              >
                                <SyncIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View MTR">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleViewMTR(mtr._id as string)}
                              >
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        }
                      >
                        <ListItemIcon>
                          {getStatusIcon(
                            mtr.status as
                              | 'in_progress'
                              | 'completed'
                              | 'cancelled'
                              | 'on_hold'
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                              >
                                {mtr.reviewNumber as string}
                              </Typography>
                              <Chip
                                size="small"
                                label={mtr.priority as string}
                                color={getPriorityColor(
                                  mtr.priority as
                                    | 'routine'
                                    | 'urgent'
                                    | 'high_risk'
                                )}
                                variant="outlined"
                              />
                              {(mtr.isOverdue as boolean) && (
                                <Chip
                                  size="small"
                                  label="Overdue"
                                  color="error"
                                  icon={<WarningIcon />}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Started{' '}
                              {new Date(
                                mtr.startedAt as string
                              ).toLocaleDateString()}{' '}
                              •{mtr.completionPercentage as number}% complete
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </>
            )}

            {/* Pending Actions */}
            {pendingActions && pendingActions.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    Pending Actions
                  </Typography>
                  <List dense>
                    {pendingActions
                      .slice(0, 3)
                      .map((action: PendingAction, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <ScheduleIcon
                              color={
                                (action.priority as string) === 'high'
                                  ? 'error'
                                  : 'warning'
                              }
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={action.description as string}
                            secondary={
                              action.dueDate && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Due:{' '}
                                  {new Date(
                                    action.dueDate as string
                                  ).toLocaleDateString()}
                                </Typography>
                              )
                            }
                          />
                        </ListItem>
                      ))}
                  </List>
                </Box>
              </>
            )}

            {/* Recent MTR Sessions */}
            {recentMTRs && recentMTRs.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    Recent MTR Sessions
                  </Typography>
                  <List dense>
                    {recentMTRs.slice(0, 3).map((mtr: MTRSession) => (
                      <ListItem
                        key={mtr._id as string}
                        component="div"
                        onClick={() => handleViewMTR(mtr._id as string)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <ListItemIcon>
                          {getStatusIcon(
                            mtr.status as
                              | 'in_progress'
                              | 'completed'
                              | 'cancelled'
                              | 'on_hold'
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <Typography variant="body2">
                                {mtr.reviewNumber as string}
                              </Typography>
                              <Chip
                                size="small"
                                label={mtr.status as string}
                                color={
                                  (mtr.status as string) === 'completed'
                                    ? 'success'
                                    : 'default'
                                }
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {new Date(
                                mtr.startedAt as string
                              ).toLocaleDateString()}
                              {mtr.completedAt &&
                                ` - ${new Date(
                                  mtr.completedAt as string
                                ).toLocaleDateString()}`}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </>
            )}

            {/* Empty State */}
            {(!mtrSummary || mtrSummary.totalMTRSessions === 0) && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <MTRIcon
                  sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No MTR Sessions
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Start the first medication therapy review for this patient
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={(e) => handleStartMTR(e)}
                  disabled={createMTRMutation.isPending}
                  type="button"
                >
                  Start First MTR
                </Button>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Sync Data Dialog */}
      <Dialog open={showSyncDialog} onClose={() => setShowSyncDialog(false)}>
        <DialogTitle>Sync Patient Data with MTR</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will synchronize the patient's medications and drug therapy
            problems with the selected MTR session. Any conflicts will be
            highlighted for manual resolution.
          </Typography>
          <Alert severity="info">
            <Typography variant="body2">
              • Patient medications will be imported into the MTR session
              <br />
              • Existing DTPs will be linked to the MTR
              <br />• Any conflicts will require manual review
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSyncDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmSync}
            disabled={
              syncMedicationsMutation.isPending || syncDTPsMutation.isPending
            }
            startIcon={<SyncIcon />}
          >
            Sync Data
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PatientMTRWidget;
