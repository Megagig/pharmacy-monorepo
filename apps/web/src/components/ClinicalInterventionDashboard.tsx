import React, { useState } from 'react';

type DateRange = 'week' | 'month' | 'quarter' | 'year';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  useTheme,
  alpha,
  Collapse,
  Fab,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import GetAppIcon from '@mui/icons-material/GetApp';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { formatDistanceToNow } from 'date-fns';
import { useResponsive } from '../hooks/useResponsive';
import { useClinicalInterventionDashboard } from '../hooks/useClinicalInterventionDashboard';

interface ClinicalInterventionDashboardProps {
  workplaceId?: string;
}

const ClinicalInterventionDashboard: React.FC<
  ClinicalInterventionDashboardProps
> = () => {
  const theme = useTheme();
  const { isMobile, getColumns } = useResponsive();

  // State for filters and date range
  const [dateRange, setDateRange] = useState<
    'week' | 'month' | 'quarter' | 'year'
  >('month');

  // Use custom hook for dashboard data management
  const {
    dashboardMetrics,
    loading,
    error,
    refreshing,
    refresh,
    isAuthenticated,
  } = useClinicalInterventionDashboard(dateRange);

  // Mobile-specific state
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    kpis: true,
    charts: false,
    recent: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Mobile helper functions
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getResponsiveColumns = () => {
    return getColumns(1, 2, 3, 3, 4);
  };

  // KPI Card Component
  const KPICard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
    trend?: { value: number; isPositive: boolean };
  }> = ({ title, value, subtitle, icon, color, trend }) => (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        borderRadius: isMobile ? 2 : undefined,
      }}
    >
      <CardContent sx={{ p: isMobile ? 2 : 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: isMobile ? 1 : 2,
            flexDirection: isMobile ? 'column' : 'row',
            textAlign: isMobile ? 'center' : 'left',
          }}
        >
          <Box
            sx={{
              p: isMobile ? 0.75 : 1,
              borderRadius: 2,
              backgroundColor: alpha(color, 0.1),
              color: color,
              mr: isMobile ? 0 : 2,
              mb: isMobile ? 1 : 0,
            }}
          >
            {React.cloneElement(icon as React.ReactElement, {
              sx: { fontSize: isMobile ? 20 : 24 },
            })}
          </Box>
          <Typography
            variant={isMobile ? 'subtitle2' : 'h6'}
            component="div"
            sx={{
              flexGrow: 1,
              fontSize: isMobile ? '0.875rem' : undefined,
            }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          variant={isMobile ? 'h5' : 'h3'}
          component="div"
          sx={{
            mb: 1,
            fontWeight: 'bold',
            textAlign: isMobile ? 'center' : 'left',
          }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography
            variant={isMobile ? 'caption' : 'body2'}
            color="text.secondary"
            sx={{ textAlign: isMobile ? 'center' : 'left' }}
          >
            {subtitle}
          </Typography>
        )}
        {trend && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mt: 1,
              justifyContent: isMobile ? 'center' : 'flex-start',
            }}
          >
            <TrendingUpIcon
              sx={{
                fontSize: isMobile ? 14 : 16,
                color: trend.isPositive ? 'success.main' : 'error.main',
                transform: trend.isPositive ? 'none' : 'rotate(180deg)',
                mr: 0.5,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: trend.isPositive ? 'success.main' : 'error.main',
                fontWeight: 'medium',
                fontSize: isMobile ? '0.7rem' : undefined,
              }}
            >
              {Math.abs(trend.value)}% vs last period
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // Show loading spinner while loading
  if (loading && !dashboardMetrics) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Show login prompt if user is not authenticated
  if (!isAuthenticated) {
    return (
      <Alert
        severity="warning"
        sx={{ m: 2 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => (window.location.href = '/login')}
          >
            Login
          </Button>
        }
      >
        Please log in to access clinical interventions data.
      </Alert>
    );
  }

  if (error) {
    const isAuthError =
      error.includes('Invalid token') ||
      error.includes('Unauthorized') ||
      error.includes('401');

    return (
      <Alert
        severity={isAuthError ? 'warning' : 'error'}
        sx={{ m: 2 }}
        action={
          isAuthError ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => (window.location.href = '/login')}
            >
              Login
            </Button>
          ) : (
            <Button color="inherit" size="small" onClick={refresh}>
              Retry
            </Button>
          )
        }
      >
        {isAuthError
          ? 'Please log in to access clinical interventions data.'
          : `Error loading dashboard: ${error}`}
      </Alert>
    );
  }

  if (!dashboardMetrics) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No dashboard data available
      </Alert>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          mb: isMobile ? 2 : 3,
          gap: isMobile ? 2 : 0,
        }}
      >
        <Typography
          variant={isMobile ? 'h5' : 'h4'}
          component="h1"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textAlign: isMobile ? 'center' : 'left',
          }}
        >
          <DashboardIcon sx={{ fontSize: isMobile ? 24 : 32 }} />
          {isMobile ? 'Interventions' : 'Clinical Interventions Dashboard'}
        </Typography>

        {isMobile ? (
          <Box>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ mb: 1 }}
            >
              Filters & Actions
            </Button>
            <Collapse in={showFilters}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={dateRange}
                    label="Time Period"
                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                  >
                    <MenuItem value="week">Last Week</MenuItem>
                    <MenuItem value="month">Last Month</MenuItem>
                    <MenuItem value="quarter">Last Quarter</MenuItem>
                    <MenuItem value="year">Last Year</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={refresh}
                    disabled={refreshing}
                    size="small"
                    sx={{ flex: 1 }}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<GetAppIcon />}
                    onClick={() => {

                    }}
                    size="small"
                    sx={{ flex: 1 }}
                  >
                    Export
                  </Button>
                </Box>
              </Box>
            </Collapse>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={dateRange}
                label="Time Period"
                onChange={(e) => setDateRange(e.target.value as DateRange)}
              >
                <MenuItem value="week">Last Week</MenuItem>
                <MenuItem value="month">Last Month</MenuItem>
                <MenuItem value="quarter">Last Quarter</MenuItem>
                <MenuItem value="year">Last Year</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh Dashboard">
              <IconButton onClick={refresh} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<GetAppIcon />}
              onClick={() => {

              }}
            >
              Export
            </Button>
          </Box>
        )}
      </Box>

      {/* KPI Cards */}
      {isMobile ? (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              p: 1,
              borderRadius: 1,
              bgcolor: 'grey.50',
              mb: 1,
            }}
            onClick={() => toggleSection('kpis')}
          >
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AssessmentIcon color="primary" />
              Key Metrics
            </Typography>
            {expandedSections.kpis ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
          <Collapse in={expandedSections.kpis}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 2,
              }}
            >
              <KPICard
                title="Total"
                value={dashboardMetrics.totalInterventions}
                subtitle="All interventions"
                icon={<AssessmentIcon />}
                color={theme.palette.primary.main}
              />
              <KPICard
                title="Active"
                value={dashboardMetrics.activeInterventions}
                subtitle="In progress"
                icon={<ScheduleIcon />}
                color={theme.palette.info.main}
              />
              <KPICard
                title="Success Rate"
                value={`${Math.round(dashboardMetrics.successRate || 0)}%`}
                subtitle="Completed successfully"
                icon={<CheckCircleIcon />}
                color={theme.palette.success.main}
              />
              <KPICard
                title="Avg Time"
                value={`${Math.round(
                  dashboardMetrics.averageResolutionTime || 0
                )}d`}
                subtitle="Resolution time"
                icon={<TrendingUpIcon />}
                color={theme.palette.warning.main}
              />
              <KPICard
                title="Savings"
                value={`${(
                  (dashboardMetrics.totalCostSavings || 0) / 1000
                ).toFixed(0)}K`}
                subtitle="Cost savings"
                icon={<TrendingUpIcon />}
                color={theme.palette.success.main}
              />
              <KPICard
                title="Overdue"
                value={dashboardMetrics.overdueInterventions}
                subtitle="Need attention"
                icon={<WarningIcon />}
                color={theme.palette.error.main}
              />
            </Box>
          </Collapse>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${getResponsiveColumns()}, 1fr)`,
            gap: 3,
            mb: 4,
          }}
        >
          <KPICard
            title="Total Interventions"
            value={dashboardMetrics.totalInterventions}
            subtitle="All time interventions"
            icon={<AssessmentIcon />}
            color={theme.palette.primary.main}
          />
          <KPICard
            title="Active Interventions"
            value={dashboardMetrics.activeInterventions}
            subtitle="Currently in progress"
            icon={<ScheduleIcon />}
            color={theme.palette.info.main}
          />
          <KPICard
            title="Success Rate"
            value={`${Math.round(dashboardMetrics.successRate || 0)}%`}
            subtitle="Completed successfully"
            icon={<CheckCircleIcon />}
            color={theme.palette.success.main}
          />
          <KPICard
            title="Avg Resolution Time"
            value={`${Math.round(
              dashboardMetrics.averageResolutionTime || 0
            )} days`}
            subtitle="Time to completion"
            icon={<TrendingUpIcon />}
            color={theme.palette.warning.main}
          />
          <KPICard
            title="Cost Savings"
            value={`₦${(
              dashboardMetrics.totalCostSavings || 0
            ).toLocaleString()}`}
            subtitle="Estimated savings"
            icon={<TrendingUpIcon />}
            color={theme.palette.success.main}
          />
          <KPICard
            title="Overdue Items"
            value={dashboardMetrics.overdueInterventions}
            subtitle="Require attention"
            icon={<WarningIcon />}
            color={theme.palette.error.main}
          />
        </Box>
      )}

      {/* Charts Section */}
      {isMobile ? (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              p: 1,
              borderRadius: 1,
              bgcolor: 'grey.50',
              mb: 1,
            }}
            onClick={() => toggleSection('charts')}
          >
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <TrendingUpIcon color="primary" />
              Charts & Analytics
            </Typography>
            {expandedSections.charts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
          <Collapse in={expandedSections.charts}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Mobile Monthly Trends Chart */}
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <TrendingUpIcon />
                    Volume Trends
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dashboardMetrics.monthlyTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        name="Total"
                      />
                      <Line
                        type="monotone"
                        dataKey="completed"
                        stroke={theme.palette.success.main}
                        strokeWidth={2}
                        name="Completed"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Mobile Priority Distribution */}
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <AssessmentIcon />
                    Priority Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={dashboardMetrics.priorityDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(dashboardMetrics.priorityDistribution || []).map(
                          (entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          )
                        )}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Box>
          </Collapse>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
            gap: 3,
            mb: 4,
          }}
        >
          {/* Monthly Trends Chart */}
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <TrendingUpIcon />
                Intervention Volume Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardMetrics.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    name="Total Interventions"
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke={theme.palette.success.main}
                    strokeWidth={2}
                    name="Completed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Priority Distribution Pie Chart */}
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <AssessmentIcon />
                Priority Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardMetrics.priorityDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(dashboardMetrics.priorityDistribution || []).map(
                      (entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      )
                    )}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Category Distribution and Success Rate - Desktop Only */}
      {!isMobile && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 3,
            mb: 4,
          }}
        >
          {/* Category Distribution Bar Chart */}
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <AssessmentIcon />
                Category Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardMetrics.categoryDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill={theme.palette.primary.main} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Success Rate by Category */}
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <CheckCircleIcon />
                Success Rate by Category
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardMetrics.categoryDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip
                    formatter={(value) => [`${value}%`, 'Success Rate']}
                  />
                  <Bar
                    dataKey="successRate"
                    fill={theme.palette.success.main}
                    name="Success Rate (%)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Recent Interventions List */}
      {isMobile ? (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              p: 1,
              borderRadius: 1,
              bgcolor: 'grey.50',
              mb: 1,
            }}
            onClick={() => toggleSection('recent')}
          >
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <ScheduleIcon color="primary" />
              Recent Interventions
            </Typography>
            {expandedSections.recent ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
          <Collapse in={expandedSections.recent}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(dashboardMetrics.recentInterventions || [])
                .slice(0, 5)
                .map((intervention) => (
                  <Card key={intervention._id} sx={{ p: 1 }}>
                    <Box sx={{ p: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight="medium">
                          {intervention.interventionNumber}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {

                          }}
                        >
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                          mb: 1,
                        }}
                      >
                        <Chip
                          label={intervention.category.replace('_', ' ')}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                        <Chip
                          label={intervention.priority}
                          size="small"
                          color={
                            intervention.priority === 'critical'
                              ? 'error'
                              : intervention.priority === 'high'
                              ? 'warning'
                              : intervention.priority === 'medium'
                              ? 'info'
                              : 'default'
                          }
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                        <Chip
                          label={intervention.status}
                          size="small"
                          color={
                            intervention.status === 'completed'
                              ? 'success'
                              : intervention.status === 'in_progress'
                              ? 'info'
                              : 'default'
                          }
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        Patient: {intervention.patientName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(
                          new Date(intervention.identifiedDate),
                          { addSuffix: true }
                        )}
                      </Typography>
                    </Box>
                  </Card>
                ))}
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => {

                }}
                sx={{ mt: 1 }}
              >
                View All Interventions
              </Button>
            </Box>
          </Collapse>
        </Box>
      ) : (
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
              <Typography
                variant="h6"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <ScheduleIcon />
                Recent Interventions
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  // TODO: Navigate to full interventions list

                }}
              >
                View All
              </Button>
            </Box>
            <List>
              {(dashboardMetrics.recentInterventions || [])
                .slice(0, 10)
                .map((intervention, index) => (
                  <React.Fragment key={intervention._id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography variant="subtitle1" component="span">
                              {intervention.interventionNumber}
                            </Typography>
                            <Chip
                              label={intervention.category.replace('_', ' ')}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={intervention.priority}
                              size="small"
                              color={
                                intervention.priority === 'critical'
                                  ? 'error'
                                  : intervention.priority === 'high'
                                  ? 'warning'
                                  : intervention.priority === 'medium'
                                  ? 'info'
                                  : 'default'
                              }
                            />
                            <Chip
                              label={intervention.status}
                              size="small"
                              color={
                                intervention.status === 'completed'
                                  ? 'success'
                                  : intervention.status === 'in_progress'
                                  ? 'info'
                                  : 'default'
                              }
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Patient: {intervention.patientName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {formatDistanceToNow(
                                new Date(intervention.identifiedDate),
                                { addSuffix: true }
                              )}
                              {intervention.assignedTo &&
                                ` • Assigned to: ${intervention.assignedTo}`}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="View Details">
                          <IconButton
                            edge="end"
                            onClick={() => {
                              // TODO: Navigate to intervention details

                            }}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index <
                      (dashboardMetrics.recentInterventions || []).length -
                        1 && <Divider />}
                  </React.Fragment>
                ))}
              {(dashboardMetrics.recentInterventions || []).length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <InfoIcon
                    sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                  />
                  <Typography variant="body1" color="text.secondary">
                    No recent interventions found
                  </Typography>
                </Box>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="add intervention"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
          onClick={() => {

          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default ClinicalInterventionDashboard;
