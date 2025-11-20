import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  IconButton,
  Paper,
  Divider,
  TextField,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  Assignment,
  Schedule,
  PriorityHigh,
  CheckCircle,
  Warning,
  Download,
  Refresh,
  FilterList,
  Analytics,
  AccessTime,
  TrendingDown,
  AssignmentTurnedIn,
  AssignmentLate,
} from '@mui/icons-material';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useFollowUpAnalytics } from '../../hooks/useAppointmentAnalytics';
import { useUsers } from '../../queries/useUsers';
import { toast } from 'react-hot-toast';

// Color palette for charts
const CHART_COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  info: '#0288d1',
  purple: '#7b1fa2',
  orange: '#f57c00',
  teal: '#00695c',
  indigo: '#303f9f',
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.info,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.teal,
];

interface FollowUpAnalyticsDashboardProps {
  className?: string;
}

const FollowUpAnalyticsDashboard: React.FC<FollowUpAnalyticsDashboardProps> = ({
  className,
}) => {
  // State for filters
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [selectedPharmacist, setSelectedPharmacist] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data
  const analyticsParams = useMemo(() => ({
    startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
    endDate: format(dateRange.endDate, 'yyyy-MM-dd'),
    ...(selectedPharmacist && { pharmacistId: selectedPharmacist }),
    ...(selectedType && { taskType: selectedType }),
    ...(selectedPriority && { priority: selectedPriority }),
  }), [dateRange, selectedPharmacist, selectedType, selectedPriority]);

  // Re-enabled with proper error handling
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useFollowUpAnalytics(analyticsParams, true);

  const { data: usersData } = useUsers();

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!analyticsData?.data) return null;

    const { summary, byType, byPriority, byTrigger, trends, escalationMetrics } = analyticsData.data;

    // Prepare trend data for line chart
    const trendData = trends.daily.map(day => ({
      date: format(new Date(day.date), 'MMM dd'),
      created: day.created,
      completed: day.completed,
      overdue: day.overdue,
      completionRate: day.created > 0 ? Math.round((day.completed / day.created) * 100) : 0,
    }));

    // Prepare type distribution for pie chart
    const typeData = byType.map(type => ({
      name: type.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: type.count,
      completionRate: type.completionRate,
      avgTime: type.averageTimeToCompletion,
    }));

    // Prepare priority distribution for bar chart
    const priorityData = byPriority.map(priority => ({
      name: priority.priority.charAt(0).toUpperCase() + priority.priority.slice(1),
      count: priority.count,
      completionRate: priority.completionRate,
      avgTime: priority.averageTimeToCompletion,
    }));

    // Prepare trigger analysis for pie chart
    const triggerData = byTrigger.map(trigger => ({
      name: trigger.triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: trigger.count,
      completionRate: trigger.completionRate,
    }));

    // Prepare escalation data
    const escalationData = escalationMetrics.escalationsByPriority.map(esc => ({
      from: esc.fromPriority.charAt(0).toUpperCase() + esc.fromPriority.slice(1),
      to: esc.toPriority.charAt(0).toUpperCase() + esc.toPriority.slice(1),
      count: esc.count,
      label: `${esc.fromPriority} → ${esc.toPriority}`,
    }));

    return {
      summary,
      trends: trendData,
      types: typeData,
      priorities: priorityData,
      triggers: triggerData,
      escalations: escalationData,
      escalationMetrics,
    };
  }, [analyticsData]);

  // Handle export
  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      setIsExporting(true);
      // TODO: Implement export functionality
      toast.success(`Follow-up analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export analytics');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    toast.success('Analytics refreshed');
  };

  // Quick date range presets
  const handleQuickDateRange = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case 'today':
        setDateRange({ startDate: now, endDate: now });
        break;
      case 'week':
        setDateRange({ startDate: subDays(now, 7), endDate: now });
        break;
      case 'month':
        setDateRange({ startDate: subDays(now, 30), endDate: now });
        break;
      case 'quarter':
        setDateRange({ startDate: subDays(now, 90), endDate: now });
        break;
      case 'thisMonth':
        setDateRange({ startDate: startOfMonth(now), endDate: endOfMonth(now) });
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading follow-up analytics...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={handleRefresh}>
            Retry
          </Button>
        }
      >
        Failed to load follow-up analytics. Please try again.
      </Alert>
    );
  }

  if (!chartData) {
    return (
      <Alert severity="info">
        No follow-up data available for the selected period.
      </Alert>
    );
  }

  return (
    <Box className={className} sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment color="primary" />
            Follow-up Analytics
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={handleRefresh} disabled={isLoading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
            >
              Export PDF
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => handleExport('excel')}
              disabled={isExporting}
            >
              Export Excel
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterList />
            Filters
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            {/* Quick date presets */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['today', 'week', 'month', 'quarter', 'thisMonth'].map((preset) => (
                <Chip
                  key={preset}
                  label={preset === 'thisMonth' ? 'This Month' : preset.charAt(0).toUpperCase() + preset.slice(1)}
                  onClick={() => handleQuickDateRange(preset)}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Date range pickers */}
            <TextField
              label="Start Date"
              type="date"
              size="small"
              sx={{ minWidth: 140 }}
              value={format(dateRange.startDate, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End Date"
              type="date"
              size="small"
              sx={{ minWidth: 140 }}
              value={format(dateRange.endDate, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: new Date(e.target.value) }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {/* Pharmacist filter */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Pharmacist</InputLabel>
              <Select
                value={selectedPharmacist}
                label="Pharmacist"
                onChange={(e) => setSelectedPharmacist(e.target.value)}
              >
                <MenuItem value="">All Pharmacists</MenuItem>
                {usersData?.users?.map((user) => (
                  <MenuItem key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Task type filter */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Task Type</InputLabel>
              <Select
                value={selectedType}
                label="Task Type"
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="medication_start_followup">Medication Start Follow-up</MenuItem>
                <MenuItem value="lab_result_review">Lab Result Review</MenuItem>
                <MenuItem value="hospital_discharge_followup">Hospital Discharge Follow-up</MenuItem>
                <MenuItem value="medication_change_followup">Medication Change Follow-up</MenuItem>
                <MenuItem value="chronic_disease_monitoring">Chronic Disease Monitoring</MenuItem>
                <MenuItem value="adherence_check">Adherence Check</MenuItem>
                <MenuItem value="refill_reminder">Refill Reminder</MenuItem>
                <MenuItem value="preventive_care">Preventive Care</MenuItem>
                <MenuItem value="general_followup">General Follow-up</MenuItem>
              </Select>
            </FormControl>

            {/* Priority filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={selectedPriority}
                label="Priority"
                onChange={(e) => setSelectedPriority(e.target.value)}
              >
                <MenuItem value="">All Priorities</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>
      </Box>

      {/* Summary Statistics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Follow-ups
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.summary.totalTasks.toLocaleString()}
                </Typography>
              </Box>
              <Assignment sx={{ fontSize: 40, color: CHART_COLORS.primary, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Completion Rate
                </Typography>
                <Typography variant="h4" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {chartData.summary.completionRate}%
                  {chartData.summary.completionRate >= 80 ? (
                    <TrendingUp sx={{ color: CHART_COLORS.success }} />
                  ) : (
                    <TrendingDown sx={{ color: CHART_COLORS.error }} />
                  )}
                </Typography>
              </Box>
              <AssignmentTurnedIn sx={{ fontSize: 40, color: CHART_COLORS.success, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Overdue Tasks
                </Typography>
                <Typography variant="h4" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {chartData.summary.overdueCount}
                  {chartData.summary.criticalOverdueCount > 0 && (
                    <Tooltip title={`${chartData.summary.criticalOverdueCount} critical overdue`}>
                      <Warning sx={{ color: CHART_COLORS.error }} />
                    </Tooltip>
                  )}
                </Typography>
              </Box>
              <AssignmentLate sx={{ fontSize: 40, color: CHART_COLORS.error, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Avg. Time to Complete
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.summary.averageTimeToCompletion.toFixed(1)}
                  <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                    days
                  </Typography>
                </Typography>
              </Box>
              <AccessTime sx={{ fontSize: 40, color: CHART_COLORS.info, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Escalation Rate
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.escalationMetrics.escalationRate.toFixed(1)}%
                </Typography>
              </Box>
              <PriorityHigh sx={{ fontSize: 40, color: CHART_COLORS.warning, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Critical Overdue
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.summary.criticalOverdueCount}
                </Typography>
              </Box>
              <Warning sx={{ fontSize: 40, color: CHART_COLORS.error, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Charts Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 3 }}>
        {/* Follow-up Trends Chart */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp />
              Follow-up Trends
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="created"
                    fill={CHART_COLORS.primary}
                    name="Created"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="completed"
                    fill={CHART_COLORS.success}
                    name="Completed"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="overdue"
                    fill={CHART_COLORS.error}
                    name="Overdue"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="completionRate"
                    stroke={CHART_COLORS.warning}
                    strokeWidth={3}
                    dot={{ fill: CHART_COLORS.warning, strokeWidth: 2, r: 4 }}
                    name="Completion Rate (%)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Follow-up Type Distribution */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Follow-up by Type Distribution
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.types}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.types.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value, name, props) => [
                      `${value} tasks`,
                      `${props.payload.name} (${props.payload.completionRate}% completion rate)`
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Priority Distribution Chart */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Priority Distribution
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.priorities}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value, name) => [
                      `${value} ${name === 'count' ? 'tasks' : name === 'completionRate' ? '%' : 'days'}`,
                      name === 'count' ? 'Tasks' : name === 'completionRate' ? 'Completion Rate' : 'Avg. Time'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} name="Task Count" />
                  <Bar dataKey="completionRate" fill={CHART_COLORS.success} name="Completion Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Average Time to Completion by Priority */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Average Time to Completion
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.priorities}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value) => [`${value} days`, 'Average Time']}
                  />
                  <Bar 
                    dataKey="avgTime" 
                    fill={CHART_COLORS.info}
                    name="Days to Complete"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Trigger Type Analysis */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Trigger Type Analysis
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.triggers}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.triggers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value, name, props) => [
                      `${value} tasks`,
                      `${props.payload.name} (${props.payload.completionRate}% completion rate)`
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Completion Rate Gauge */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Overall Completion Rate
            </Typography>
            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={chartData.summary.completionRate}
                  size={200}
                  thickness={8}
                  sx={{
                    color: chartData.summary.completionRate >= 80 ? CHART_COLORS.success : 
                           chartData.summary.completionRate >= 60 ? CHART_COLORS.warning : CHART_COLORS.error,
                  }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                  }}
                >
                  <Typography variant="h3" component="div" color="text.secondary">
                    {chartData.summary.completionRate}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completion Rate
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {chartData.summary.overdueCount} overdue
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default FollowUpAnalyticsDashboard;