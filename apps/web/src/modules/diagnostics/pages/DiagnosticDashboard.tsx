import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Avatar,
  Chip,
  LinearProgress,
  Alert,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Paper,
  Fade,
  Zoom,
} from '@mui/material';
import {
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Analytics as AnalyticsIcon,
  Assignment as AssignmentIcon,
  LocalHospital as LocalHospitalIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  useDiagnosticDashboardStats,
  useRecentDiagnosticActivity,
  useDiagnosticReferrals,
  useMarkCaseForFollowUp,
  useMarkCaseAsCompleted,
  useGenerateReferralDocument,
} from '../../../queries/useDiagnosticHistory';
import CaseReviewDialog from '../../../components/diagnostics/CaseReviewDialog';

const DiagnosticDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);

  // Use new hooks for real data
  const {
    data: dashboardStats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useDiagnosticDashboardStats();

  const {
    data: recentActivity,
    isLoading: activityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useRecentDiagnosticActivity(5);

  const {
    data: referralsData,
    isLoading: referralsLoading,
    refetch: refetchReferrals,
  } = useDiagnosticReferrals(
    {
      page: 1,
      limit: 5,
      status: 'pending',
    },
    {
      enabled: true,
    }
  );

  // Extract stats with fallbacks
  const stats = dashboardStats?.summary || {
    totalCases: 0,
    completedCases: 0,
    pendingFollowUps: 0,
    averageConfidence: 0,
    referralsGenerated: 0,
  };

  const recentCases = recentActivity?.cases || [];
  const pendingReferrals = referralsData?.referrals || [];

  // Mutations for case actions
  const markFollowUpMutation = useMarkCaseForFollowUp();
  const markCompletedMutation = useMarkCaseAsCompleted();
  const generateReferralMutation = useGenerateReferralDocument();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchActivity(),
        refetchReferrals(),
      ]);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Navigation handlers for dashboard buttons
  const handleViewAllCases = () => {
    navigate('/pharmacy/diagnostics/cases/all');
  };

  const handleViewAnalytics = () => {
    navigate('/pharmacy/diagnostics/analytics');
  };

  const handleViewReferrals = () => {
    navigate('/pharmacy/diagnostics/referrals');
  };

  const handleNewCase = () => {
    navigate('/pharmacy/diagnostics/case/new');
  };

  const handleViewCase = (case_: any) => {
    if (case_.status === 'pending_review') {
      setSelectedCase(case_);
      setReviewDialogOpen(true);
    } else {
      navigate(`/pharmacy/diagnostics/case/${case_.caseId}/results`);
    }
  };

  const handleMarkFollowUp = async (caseId: string, data: any) => {
    await markFollowUpMutation.mutateAsync({ caseId, data });
  };

  const handleMarkCompleted = async (caseId: string, data: any) => {
    await markCompletedMutation.mutateAsync({ caseId, data });
  };

  const handleGenerateReferral = async (caseId: string, data: any) => {
    await generateReferralMutation.mutateAsync({ caseId, data });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Diagnostic Dashboard
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          AI-powered diagnostic analysis and case management
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={2}>
          <Zoom in timeout={600}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                {statsLoading ? (
                  <Box>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="80%" />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      <AssessmentIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.totalCases}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Cases
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Zoom in timeout={700}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                {statsLoading ? (
                  <Box>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="80%" />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                      <CheckCircleIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.completedCases}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Completed
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Zoom in timeout={800}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                {statsLoading ? (
                  <Box>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="80%" />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                      <ScheduleIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.pendingFollowUps}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pending Follow-ups
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Zoom in timeout={900}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                {statsLoading ? (
                  <Box>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="80%" />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {Math.round(stats.averageConfidence)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Confidence
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Zoom in timeout={1000}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                {statsLoading ? (
                  <Box>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="80%" />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                      <LocalHospitalIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.referralsGenerated}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Referrals
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Zoom in timeout={1100}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                {statsLoading ? (
                  <Box>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="80%" />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'grey.600', mr: 2 }}>
                      <ScheduleIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {Math.round((stats.averageProcessingTime || 0) / 1000)}s
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Processing
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Recent Cases */}
        <Grid item xs={12} md={8}>
          <Fade in timeout={1000}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Recent Cases
                  </Typography>
                  <Button 
                    size="small" 
                    color="primary"
                    onClick={handleViewAllCases}
                    startIcon={<VisibilityIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    View All
                  </Button>
                </Box>
                
                {activityLoading ? (
                  <Box>
                    {[...Array(3)].map((_, index) => (
                      <Box key={index} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                          <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="text" width="40%" />
                          </Box>
                          <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                        </Box>
                        {index < 2 && <Divider sx={{ mt: 2 }} />}
                      </Box>
                    ))}
                  </Box>
                ) : activityError ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load recent cases. Please try refreshing.
                  </Alert>
                ) : recentCases.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No recent cases found
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={handleNewCase}
                      sx={{ mt: 2, textTransform: 'none' }}
                      startIcon={<AddIcon />}
                    >
                      Create New Case
                    </Button>
                  </Box>
                ) : (
                  <List>
                    {recentCases.map((case_, index) => (
                      <React.Fragment key={case_._id}>
                        <ListItem
                          sx={{
                            cursor: 'pointer',
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }}
                          onClick={() => handleViewCase(case_)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              <PersonIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                {case_.patientId?.firstName} {case_.patientId?.lastName}
                              </Typography>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" component="span">
                                  Case ID: {case_.caseId}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  {format(new Date(case_.createdAt), 'MMM dd, yyyy HH:mm')}
                                </Typography>
                              </Box>
                            }
                          />
                          <Box sx={{ textAlign: 'right' }}>
                            <Chip
                              label={
                                case_.status === 'pending_review' 
                                  ? 'Pending Review'
                                  : case_.status === 'completed'
                                  ? 'Completed'
                                  : case_.status === 'referred'
                                  ? 'Referred'
                                  : case_.status === 'follow_up'
                                  ? 'Follow-up'
                                  : case_.status === 'cancelled'
                                  ? 'Cancelled'
                                  : case_.status === 'draft'
                                  ? 'Draft'
                                  : case_.status
                              }
                              color={
                                case_.status === 'completed' 
                                  ? 'success' 
                                  : case_.status === 'pending_review'
                                  ? 'info'
                                  : case_.status === 'referred'
                                  ? 'secondary'
                                  : case_.status === 'follow_up'
                                  ? 'warning'
                                  : case_.status === 'cancelled'
                                  ? 'error'
                                  : 'default'
                              }
                              size="small"
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="caption" display="block" color="text.secondary">
                              {case_.patientId?.age}y, {case_.patientId?.gender}
                            </Typography>
                          </Box>
                        </ListItem>
                        {index < recentCases.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* Quick Actions & Referrals */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
            {/* Quick Actions */}
            <Fade in timeout={1200}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      fullWidth
                      onClick={handleNewCase}
                      sx={{
                        textTransform: 'none',
                        py: 1.5,
                        background: 'linear-gradient(45deg, #1976d2, #1565c0)',
                      }}
                    >
                      New Diagnostic Case
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<AnalyticsIcon />}
                      fullWidth
                      onClick={handleViewAnalytics}
                      sx={{ textTransform: 'none', py: 1.5 }}
                    >
                      View Analytics
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<LocalHospitalIcon />}
                      fullWidth
                      onClick={handleViewReferrals}
                      sx={{ textTransform: 'none', py: 1.5 }}
                    >
                      Referrals
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Fade>

            {/* Pending Referrals */}
            <Fade in timeout={1400}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Pending Referrals
                    </Typography>
                    <Chip
                      label={pendingReferrals.length}
                      color="warning"
                      size="small"
                    />
                  </Box>
                  
                  {referralsLoading ? (
                    <Box>
                      {[...Array(2)].map((_, index) => (
                        <Box key={index} sx={{ mb: 2 }}>
                          <Skeleton variant="text" width="80%" />
                          <Skeleton variant="text" width="60%" />
                        </Box>
                      ))}
                    </Box>
                  ) : pendingReferrals.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <LocalHospitalIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        No pending referrals
                      </Typography>
                    </Box>
                  ) : (
                    <List dense>
                      {pendingReferrals.slice(0, 3).map((referral, index) => (
                        <ListItem key={referral._id} sx={{ px: 0 }}>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {referral.patientId?.firstName} {referral.patientId?.lastName}
                              </Typography>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  {referral.referral?.specialty} • {referral.referral?.urgency}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                      {pendingReferrals.length > 3 && (
                        <ListItem sx={{ px: 0, justifyContent: 'center' }}>
                          <Button
                            size="small"
                            onClick={handleViewReferrals}
                            sx={{ textTransform: 'none' }}
                          >
                            View All ({pendingReferrals.length})
                          </Button>
                        </ListItem>
                      )}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Fade>
          </Box>
        </Grid>

        {/* Follow-up Required Section */}
        <Grid item xs={12} md={4}>
          <Fade in timeout={1600}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Follow-up Required
                  </Typography>
                  <Chip
                    label={stats.pendingFollowUps}
                    color="warning"
                    size="small"
                  />
                </Box>
                
                {statsLoading ? (
                  <Box>
                    {[...Array(2)].map((_, index) => (
                      <Box key={index} sx={{ mb: 2 }}>
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="60%" />
                      </Box>
                    ))}
                  </Box>
                ) : stats.pendingFollowUps === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <ScheduleIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No follow-ups required
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <ScheduleIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {stats.pendingFollowUps} cases need follow-up
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/pharmacy/diagnostics/follow-up')}
                      sx={{ mt: 1, textTransform: 'none' }}
                    >
                      View Follow-ups
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* Case Review Dialog */}
      <CaseReviewDialog
        open={reviewDialogOpen}
        onClose={() => {
          setReviewDialogOpen(false);
          setSelectedCase(null);
        }}
        case={selectedCase}
        onMarkFollowUp={handleMarkFollowUp}
        onMarkCompleted={handleMarkCompleted}
        onGenerateReferral={handleGenerateReferral}
        loading={
          markFollowUpMutation.isPending ||
          markCompletedMutation.isPending ||
          generateReferralMutation.isPending
        }
      />
    </Container>
  );
};

export default DiagnosticDashboard;