import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  Stack,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Chip,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningIcon from '@mui/icons-material/Warning';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  usePendingReviews,
  useCriticalCases,
  useCasesRequiringEscalation,
  useLabIntegrationStats,
} from '../hooks/useLabIntegration';
import QuickReviewCard from '../components/lab-integration/QuickReviewCard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const LabIntegrationReviewQueue: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
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

  const stats = useLabIntegrationStats();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleBack = () => {
    navigate('/pharmacy/lab-integration');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchPending(), refetchCritical(), refetchEscalation()]);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const isLoading = pendingLoading || criticalLoading || escalationLoading;

  return (
    <>
      <Helmet>
        <title>Review Queue | Lab Integration | PharmaCare</title>
      </Helmet>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon fontSize="large" />
              Review Queue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage pending lab integration reviews and approvals
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              disabled
            >
              Filters
            </Button>
          </Box>
        </Box>

        {/* Stats Overview */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Pending Reviews
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {stats.pendingCount}
                    </Typography>
                  </Box>
                  <AssignmentIcon sx={{ fontSize: 40, color: 'warning.main' }} />
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
                    <Typography variant="h4" color="error.main">
                      {stats.criticalCount}
                    </Typography>
                  </Box>
                  <WarningIcon sx={{ fontSize: 40, color: 'error.main' }} />
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
                    <Typography variant="h4" color="info.main">
                      {stats.escalationCount}
                    </Typography>
                  </Box>
                  <LocalHospitalIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                    <Typography variant="h4" color="primary.main">
                      {stats.totalActionRequired}
                    </Typography>
                  </Box>
                  <AssignmentIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon />
                    Pending Reviews
                    {stats.pendingCount > 0 && (
                      <Chip label={stats.pendingCount} size="small" color="warning" />
                    )}
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon />
                    Critical Cases
                    {stats.criticalCount > 0 && (
                      <Chip label={stats.criticalCount} size="small" color="error" />
                    )}
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocalHospitalIcon />
                    Escalation Required
                    {stats.escalationCount > 0 && (
                      <Chip label={stats.escalationCount} size="small" color="info" />
                    )}
                  </Box>
                }
              />
            </Tabs>
          </Box>

          <TabPanel value={activeTab} index={0}>
            {pendingLoading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography>Loading pending reviews...</Typography>
              </Box>
            ) : pendingReviews && pendingReviews.length > 0 ? (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Cases Requiring Review ({pendingReviews.length})
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Stack spacing={2}>
                  {pendingReviews.map((case_) => (
                    <QuickReviewCard key={case_._id} labIntegration={case_} />
                  ))}
                </Stack>
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Alert severity="success">
                  No pending reviews at this time. Great job staying on top of things!
                </Alert>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {criticalLoading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography>Loading critical cases...</Typography>
              </Box>
            ) : criticalCases && criticalCases.length > 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Critical Cases Require Immediate Attention
                  </Typography>
                  <Typography variant="body2">
                    These cases have critical lab values or high-priority recommendations that need urgent review.
                  </Typography>
                </Alert>
                <Stack spacing={2}>
                  {criticalCases.map((case_) => (
                    <QuickReviewCard key={case_._id} labIntegration={case_} />
                  ))}
                </Stack>
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Alert severity="success">
                  No critical cases at this time.
                </Alert>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            {escalationLoading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography>Loading escalation cases...</Typography>
              </Box>
            ) : escalationCases && escalationCases.length > 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="warning" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Cases Requiring Physician Consultation
                  </Typography>
                  <Typography variant="body2">
                    These cases have been flagged for physician review due to complexity or safety concerns.
                  </Typography>
                </Alert>
                <Stack spacing={2}>
                  {escalationCases.map((case_) => (
                    <QuickReviewCard key={case_._id} labIntegration={case_} />
                  ))}
                </Stack>
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Alert severity="info">
                  No cases requiring escalation at this time.
                </Alert>
              </Box>
            )}
          </TabPanel>
        </Card>
      </Container>
    </>
  );
};

export default LabIntegrationReviewQueue;