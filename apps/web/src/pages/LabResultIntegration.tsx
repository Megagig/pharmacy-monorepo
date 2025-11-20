import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ScienceIcon from '@mui/icons-material/Science';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';
import {
  usePendingReviews,
  useCriticalCases,
  useCasesRequiringEscalation,
  useApprovedCases,
  useLabIntegrationStats,
  useLabIntegrationStatusColor,
  useHasCriticalFindings,
} from '../hooks/useLabIntegration';
import type { LabIntegration } from '../services/labIntegrationService';

const LabResultIntegration: React.FC = () => {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data
  const {
    data: pendingReviews,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = usePendingReviews();

  const {
    data: criticalCases,
    isLoading: criticalLoading,
    refetch: refetchCritical,
  } = useCriticalCases();

  const {
    data: escalationCases,
    isLoading: escalationLoading,
    refetch: refetchEscalation,
  } = useCasesRequiringEscalation();

  const {
    data: approvedCases,
    isLoading: approvedLoading,
    refetch: refetchApproved,
  } = useApprovedCases();

  const stats = useLabIntegrationStats();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchPending(), refetchCritical(), refetchEscalation(), refetchApproved()]);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleViewCase = (caseId: string) => {
    navigate(`/pharmacy/lab-integration/${caseId}`);
  };

  const handleNewCase = () => {
    navigate('/pharmacy/lab-integration/new');
  };

  const getPatientName = (patientId: LabIntegration['patientId']) => {
    if (typeof patientId === 'string') {
      return `Patient ID: ${patientId.substring(0, 8)}...`;
    }
    const fullName = `${patientId.firstName} ${patientId.lastName}`;
    return patientId.otherNames ? `${patientId.firstName} ${patientId.otherNames} ${patientId.lastName}` : fullName;
  };

  const getStatusColor = (status: LabIntegration['status']) => {
    const colors: Record<LabIntegration['status'], string> = {
      draft: 'default',
      pending_interpretation: 'info',
      pending_review: 'warning',
      pending_approval: 'warning',
      approved: 'success',
      implemented: 'success',
      completed: 'success',
      cancelled: 'error',
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority: LabIntegration['priority']) => {
    const colors: Record<LabIntegration['priority'], string> = {
      routine: 'default',
      urgent: 'warning',
      critical: 'error',
    };
    return colors[priority] || 'default';
  };

  const isLoading = pendingLoading || criticalLoading || escalationLoading;

  return (
    <>
      <Helmet>
        <title>Lab Result Integration | PharmaCare</title>
      </Helmet>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon fontSize="large" />
              Lab Result Integration
            </Typography>
            <Typography variant="body1" color="text.secondary">
              AI-powered lab result interpretation with therapy recommendations
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {stats.pendingCount > 0 && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<AssignmentIcon />}
                onClick={() => navigate('/pharmacy/lab-integration-reviews')}
              >
                Review Queue ({stats.pendingCount})
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewCase}
            >
              New Lab Integration
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Pending Reviews
                    </Typography>
                    <Typography variant="h4">
                      {isLoading ? <Skeleton width={60} /> : stats.pendingCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <ScheduleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Critical Cases
                    </Typography>
                    <Typography variant="h4">
                      {isLoading ? <Skeleton width={60} /> : stats.criticalCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'error.main' }}>
                    <WarningIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Escalation Required
                    </Typography>
                    <Typography variant="h4">
                      {isLoading ? <Skeleton width={60} /> : stats.escalationCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <LocalHospitalIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Total Action Required
                    </Typography>
                    <Typography variant="h4">
                      {isLoading ? <Skeleton width={60} /> : stats.totalActionRequired}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <AssignmentIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Critical Cases */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="error" />
                    Critical Cases
                  </Typography>
                  <Chip label={stats.criticalCount} color="error" size="small" />
                </Box>
                <Divider sx={{ mb: 2 }} />
                {criticalLoading ? (
                  <Box>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} height={80} sx={{ mb: 1 }} />
                    ))}
                  </Box>
                ) : criticalCases && criticalCases.length > 0 ? (
                  <List>
                    {criticalCases.slice(0, 5).map((case_) => (
                      <ListItem
                        key={case_._id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => handleViewCase(case_._id)}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'error.main' }}>
                            <WarningIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`Patient ID: ${case_.patientId}`}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {format(new Date(case_.createdAt), 'MMM dd, yyyy HH:mm')}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                <Chip
                                  label={case_.priority}
                                  size="small"
                                  color={getPriorityColor(case_.priority) as any}
                                />
                                <Chip
                                  label={case_.status.replace(/_/g, ' ')}
                                  size="small"
                                  color={getStatusColor(case_.status) as any}
                                />
                              </Box>
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          {case_.status === 'pending_review' && (
                            <Tooltip title="Review Now">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/pharmacy/lab-integration/${case_._id}?tab=1`);
                                }}
                              >
                                <AssignmentIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Alert severity="success">No critical cases at this time</Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Pending Reviews */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon color="warning" />
                    Pending Reviews
                  </Typography>
                  <Chip label={stats.pendingCount} color="warning" size="small" />
                </Box>
                <Divider sx={{ mb: 2 }} />
                {pendingLoading ? (
                  <Box>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} height={80} sx={{ mb: 1 }} />
                    ))}
                  </Box>
                ) : pendingReviews && pendingReviews.length > 0 ? (
                  <List>
                    {pendingReviews.slice(0, 5).map((case_) => (
                      <ListItem
                        key={case_._id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => handleViewCase(case_._id)}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'warning.main' }}>
                            <ScheduleIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`Patient ID: ${case_.patientId}`}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {format(new Date(case_.createdAt), 'MMM dd, yyyy HH:mm')}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                <Chip
                                  label={case_.priority}
                                  size="small"
                                  color={getPriorityColor(case_.priority) as any}
                                />
                                <Chip
                                  label={case_.status.replace(/_/g, ' ')}
                                  size="small"
                                  color={getStatusColor(case_.status) as any}
                                />
                              </Box>
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Review Now">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pharmacy/lab-integration/${case_._id}?tab=1`);
                              }}
                            >
                              <AssignmentIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Alert severity="info">No pending reviews</Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Approved Cases */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon color="success" />
                    Approved Cases
                  </Typography>
                  <Chip label={stats.approvedCount} color="success" size="small" />
                </Box>
                <Divider sx={{ mb: 2 }} />
                {approvedLoading ? (
                  <Box>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} height={80} sx={{ mb: 1 }} />
                    ))}
                  </Box>
                ) : approvedCases && approvedCases.length > 0 ? (
                  <>
                    <List>
                      {approvedCases.slice(0, 5).map((case_) => (
                        <ListItem
                          key={case_._id}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 1,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={() => handleViewCase(case_._id)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'success.main' }}>
                              <CheckCircleIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={getPatientName(case_.patientId)}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {format(new Date(case_.createdAt), 'MMM dd, yyyy HH:mm')}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                  <Chip
                                    label={case_.status.replace(/_/g, ' ')}
                                    size="small"
                                    color={getStatusColor(case_.status) as any}
                                  />
                                </Box>
                              </Box>
                            }
                          />
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="View Details">
                              <IconButton size="small">
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                    {approvedCases.length > 5 && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Button
                          variant="outlined"
                          color="success"
                          onClick={() => navigate('/pharmacy/lab-integration/approved')}
                        >
                          View All ({approvedCases.length})
                        </Button>
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">No approved cases yet</Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default LabResultIntegration;
