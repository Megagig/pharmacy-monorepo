import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Visibility as ViewIcon,
  TouchApp as ClickIcon,
  Schedule as TimeIcon,
  Star as StarIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material';
import apiClient from '../../services/apiClient';

interface AnalyticsSummary {
  totalResources: number;
  totalViews: number;
  totalDownloads: number;
  totalDashboardViews: number;
  totalDashboardClicks: number;
  totalEducationPageViews: number;
  averageRating: number;
  totalRatings: number;
  averageClickThroughRate: number;
  averageTimeSpent: number;
  resourcesByDisplayLocation: {
    patientDashboard: number;
    workspaceDashboard: number;
    educationPage: number;
  };
  pinnedResources: number;
  scheduledResources: number;
  topPerformingResources: Array<{
    id: string;
    title: string;
    slug: string;
    views: number;
    rating: number;
    clickThroughRate: number;
  }>;
}

interface ResourceAnalytics {
  resourceId: string;
  title: string;
  slug: string;
  displaySettings: {
    displayLocations: string[];
    isPinned: boolean;
    isScheduled: boolean;
    scheduledStartDate?: string;
    scheduledEndDate?: string;
  };
  analytics: {
    dashboardViews: number;
    dashboardClicks: number;
    educationPageViews: number;
    totalViews: number;
    downloads: number;
    clickThroughRate: number;
    averageTimeSpent: number;
    completionRate: number;
    lastViewedAt?: string;
  };
  engagement: {
    averageRating: number;
    totalRatings: number;
    ratingBreakdown?: any;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ResourceAnalyticsDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [resourceAnalytics, setResourceAnalytics] = useState<ResourceAnalytics | null>(null);

  useEffect(() => {
    fetchAnalyticsSummary();
  }, []);

  const fetchAnalyticsSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/educational-resources/analytics/summary');
      setSummary(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load analytics');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResourceAnalytics = async (resourceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/educational-resources/${resourceId}/analytics`);
      setResourceAnalytics(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load resource analytics');
      console.error('Resource analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading && !summary) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !summary) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Educational Resources Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track performance and engagement metrics for your educational content
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" icon={<ChartIcon />} iconPosition="start" />
          <Tab label="Top Performers" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="Resource Details" icon={<ViewIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        {summary && (
          <>
            {/* Key Metrics Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Total Resources */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Total Resources
                        </Typography>
                        <Typography variant="h4">{summary.totalResources}</Typography>
                      </Box>
                      <ChartIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Total Views */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Total Views
                        </Typography>
                        <Typography variant="h4">{formatNumber(summary.totalViews)}</Typography>
                      </Box>
                      <ViewIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Average CTR */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Avg Click-Through Rate
                        </Typography>
                        <Typography variant="h4">{summary.averageClickThroughRate.toFixed(1)}%</Typography>
                      </Box>
                      <ClickIcon sx={{ fontSize: 40, color: 'info.main', opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Average Rating */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Average Rating
                        </Typography>
                        <Typography variant="h4">{summary.averageRating.toFixed(1)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({summary.totalRatings} ratings)
                        </Typography>
                      </Box>
                      <StarIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Engagement Metrics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Dashboard vs Page Views */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      View Distribution
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Dashboard Views</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatNumber(summary.totalDashboardViews)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(summary.totalDashboardViews / summary.totalViews) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Education Page Views</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatNumber(summary.totalEducationPageViews)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(summary.totalEducationPageViews / summary.totalViews) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                        color="secondary"
                      />
                    </Box>
                    <Box>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Dashboard Clicks</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatNumber(summary.totalDashboardClicks)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(summary.totalDashboardClicks / summary.totalDashboardViews) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                        color="success"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Display Location Distribution */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Display Location Distribution
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Patient Dashboard</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {summary.resourcesByDisplayLocation.patientDashboard}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={
                          (summary.resourcesByDisplayLocation.patientDashboard /
                            summary.totalResources) *
                          100
                        }
                        sx={{ height: 8, borderRadius: 1 }}
                        color="primary"
                      />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Workspace Dashboard</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {summary.resourcesByDisplayLocation.workspaceDashboard}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={
                          (summary.resourcesByDisplayLocation.workspaceDashboard /
                            summary.totalResources) *
                          100
                        }
                        sx={{ height: 8, borderRadius: 1 }}
                        color="secondary"
                      />
                    </Box>
                    <Box>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Education Page Only</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {summary.resourcesByDisplayLocation.educationPage}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={
                          (summary.resourcesByDisplayLocation.educationPage / summary.totalResources) *
                          100
                        }
                        sx={{ height: 8, borderRadius: 1 }}
                        color="info"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Additional Stats */}
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Pinned Resources
                    </Typography>
                    <Typography variant="h5">{summary.pinnedResources}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Scheduled Resources
                    </Typography>
                    <Typography variant="h5">{summary.scheduledResources}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Average Time Spent
                    </Typography>
                    <Typography variant="h5">{formatTime(Math.round(summary.averageTimeSpent))}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </TabPanel>

      {/* Top Performers Tab */}
      <TabPanel value={tabValue} index={1}>
        {summary && summary.topPerformingResources.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Performing Resources
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>Resource Title</TableCell>
                      <TableCell align="right">Views</TableCell>
                      <TableCell align="right">Rating</TableCell>
                      <TableCell align="right">CTR</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.topPerformingResources.map((resource, index) => (
                      <TableRow
                        key={resource.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedResource(resource.id);
                          fetchResourceAnalytics(resource.id);
                          setTabValue(2);
                        }}
                      >
                        <TableCell>
                          <Chip
                            label={`#${index + 1}`}
                            size="small"
                            color={index < 3 ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{resource.title}</TableCell>
                        <TableCell align="right">{formatNumber(resource.views)}</TableCell>
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                            <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                            {resource.rating.toFixed(1)}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{resource.clickThroughRate.toFixed(1)}%</TableCell>
                        <TableCell>
                          <Chip
                            label="Active"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* Resource Details Tab */}
      <TabPanel value={tabValue} index={2}>
        {resourceAnalytics ? (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {resourceAnalytics.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Slug: {resourceAnalytics.slug}
                  </Typography>
                  <Box display="flex" gap={1} mt={2}>
                    {resourceAnalytics.displaySettings.displayLocations.map((loc) => (
                      <Chip key={loc} label={loc.replace('_', ' ')} size="small" />
                    ))}
                    {resourceAnalytics.displaySettings.isPinned && (
                      <Chip label="Pinned" size="small" color="primary" />
                    )}
                    {resourceAnalytics.displaySettings.isScheduled && (
                      <Chip label="Scheduled" size="small" color="secondary" />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Analytics Metrics */}
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Dashboard Views
                  </Typography>
                  <Typography variant="h4">
                    {formatNumber(resourceAnalytics.analytics.dashboardViews)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Dashboard Clicks
                  </Typography>
                  <Typography variant="h4">
                    {formatNumber(resourceAnalytics.analytics.dashboardClicks)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Page Views
                  </Typography>
                  <Typography variant="h4">
                    {formatNumber(resourceAnalytics.analytics.educationPageViews)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Click-Through Rate
                  </Typography>
                  <Typography variant="h4">
                    {resourceAnalytics.analytics.clickThroughRate.toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Engagement Metrics */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Engagement
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Average Time Spent
                    </Typography>
                    <Typography variant="h6">
                      {formatTime(resourceAnalytics.analytics.averageTimeSpent)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Completion Rate
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2} mt={1}>
                      <LinearProgress
                        variant="determinate"
                        value={resourceAnalytics.analytics.completionRate}
                        sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                      />
                      <Typography variant="body2" fontWeight="bold">
                        {resourceAnalytics.analytics.completionRate}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ratings
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <StarIcon sx={{ color: 'warning.main', fontSize: 32 }} />
                    <Typography variant="h4">
                      {resourceAnalytics.engagement.averageRating.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      / 5.0
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Based on {resourceAnalytics.engagement.totalRatings} ratings
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">
            Select a resource from the Top Performers tab to view detailed analytics
          </Alert>
        )}
      </TabPanel>
    </Box>
  );
};

export default ResourceAnalyticsDashboard;
