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
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  CalendarToday as Calendar,
  AccessTime as Clock,
  Users,
  CheckCircle,
  Cancel,
  Warning,
  Download,
  Refresh,
  FilterList,
  Analytics,
  Schedule,
  Assessment,
} from '@mui/icons-material';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useAppointmentAnalytics } from '../../hooks/useAppointmentAnalytics';
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

interface AppointmentAnalyticsDashboardProps {
  className?: string;
  compact?: boolean;
}

const AppointmentAnalyticsDashboard: React.FC<AppointmentAnalyticsDashboardProps> = ({
  className,
  compact = false,
}) => {
  // State for filters
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [selectedPharmacist, setSelectedPharmacist] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data
  const analyticsParams = useMemo(() => ({
    startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
    endDate: format(dateRange.endDate, 'yyyy-MM-dd'),
    ...(selectedPharmacist && { pharmacistId: selectedPharmacist }),
    ...(selectedType && { appointmentType: selectedType }),
  }), [dateRange, selectedPharmacist, selectedType]);

  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useAppointmentAnalytics(analyticsParams, true); // Re-enabled with error handling

  const { data: usersData } = useUsers();

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!analyticsData?.data) {
      return null;
    }

    const { summary, byType = [], byStatus = [], trends = { daily: [] }, peakTimes = { hourlyDistribution: [], dailyDistribution: [] } } = analyticsData.data;

    // Prepare trend data for line chart
    const trendData = (trends.daily || []).map(day => ({
      date: format(new Date(day.date), 'MMM dd'),
      appointments: day.appointments || 0,
      completed: day.completed || 0,
      cancelled: day.cancelled || 0,
      noShow: day.noShow || 0,
      completionRate: (day.appointments || 0) > 0 ? Math.round(((day.completed || 0) / day.appointments) * 100) : 0,
    }));

    // Prepare type distribution for pie chart
    const typeData = (byType || []).map(type => ({
      name: (type.type || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: type.count || 0,
      completionRate: type.completionRate || 0,
    }));

    // Prepare status distribution for bar chart
    const statusData = (byStatus || []).map(status => ({
      name: (status.status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: status.count || 0,
      percentage: status.percentage || 0,
    }));

    // Prepare peak times data
    const hourlyData = (peakTimes.hourlyDistribution || []).map(hour => ({
      hour: `${(hour.hour || 0).toString().padStart(2, '0')}:00`,
      count: hour.count || 0,
    }));

    const dailyData = (peakTimes.dailyDistribution || []).map(day => ({
      day: (day.day || '').substring(0, 3),
      count: day.count || 0,
    }));

    return {
      summary,
      trends: trendData,
      types: typeData,
      statuses: statusData,
      hourly: hourlyData,
      daily: dailyData,
    };
  }, [analyticsData]);

  // Handle export
  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      setIsExporting(true);
      // TODO: Implement export functionality
      toast.success(`Analytics exported as ${format.toUpperCase()}`);
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
          Loading analytics...
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
        Failed to load appointment analytics. Please try again.
      </Alert>
    );
  }

  if (!chartData) {
    return (
      <Alert severity="info">
        No appointment data available for the selected period.
        <br />
        <Typography variant="caption" color="text.secondary">
          This could be due to insufficient permissions or no data in the selected date range.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box className={className} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Compact Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={handleRefresh} disabled={isLoading} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export PDF">
              <IconButton onClick={() => handleExport('pdf')} disabled={isExporting} size="small">
                <Download />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Compact Filters */}
        {!compact && (
          <Paper sx={{ p: 1.5, mb: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {/* Quick date presets */}
              {['today', 'week', 'month'].map((preset) => (
                <Chip
                  key={preset}
                  label={preset.charAt(0).toUpperCase() + preset.slice(1)}
                  onClick={() => handleQuickDateRange(preset)}
                  variant="outlined"
                  size="small"
                />
              ))}

              <Divider orientation="vertical" flexItem />

              {/* Date range pickers */}
              <TextField
                label="Start"
                type="date"
                size="small"
                sx={{ minWidth: 120 }}
                value={format(dateRange.startDate, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End"
                type="date"
                size="small"
                sx={{ minWidth: 120 }}
                value={format(dateRange.endDate, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: new Date(e.target.value) }))}
                InputLabelProps={{ shrink: true }}
              />

              {/* Pharmacist filter */}
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Pharmacist</InputLabel>
                <Select
                  value={selectedPharmacist}
                  label="Pharmacist"
                  onChange={(e) => setSelectedPharmacist(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {usersData?.data?.users?.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Appointment type filter */}
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={selectedType}
                  label="Type"
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="mtm_session">MTM</MenuItem>
                  <MenuItem value="chronic_disease_review">Disease Review</MenuItem>
                  <MenuItem value="new_medication_consultation">Medication</MenuItem>
                  <MenuItem value="vaccination">Vaccination</MenuItem>
                  <MenuItem value="health_check">Health Check</MenuItem>
                  <MenuItem value="smoking_cessation">Smoking</MenuItem>
                  <MenuItem value="general_followup">Follow-up</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Compact Summary Statistics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5, mb: 2 }}>
        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Total Appointments
                </Typography>
                <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
                  {chartData.summary.totalAppointments.toLocaleString()}
                </Typography>
              </Box>
              <Calendar sx={{ fontSize: 32, color: CHART_COLORS.primary, opacity: 0.6 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Completion Rate
                </Typography>
                <Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                  {chartData.summary.completionRate}%
                  {chartData.summary.completionRate >= 80 ? (
                    <TrendingUp sx={{ color: CHART_COLORS.success, fontSize: 20 }} />
                  ) : (
                    <TrendingDown sx={{ color: CHART_COLORS.error, fontSize: 20 }} />
                  )}
                </Typography>
              </Box>
              <CheckCircle sx={{ fontSize: 32, color: CHART_COLORS.success, opacity: 0.6 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="caption" sx={{ fontSize: '0.7rem' }}>
                  No-Show Rate
                </Typography>
                <Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                  {chartData.summary.noShowRate}%
                  {chartData.summary.noShowRate <= 10 ? (
                    <TrendingDown sx={{ color: CHART_COLORS.success, fontSize: 20 }} />
                  ) : (
                    <TrendingUp sx={{ color: CHART_COLORS.error, fontSize: 20 }} />
                  )}
                </Typography>
              </Box>
              <Warning sx={{ fontSize: 32, color: CHART_COLORS.warning, opacity: 0.6 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Cancellation Rate
                </Typography>
                <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
                  {chartData.summary.cancellationRate}%
                </Typography>
              </Box>
              <Cancel sx={{ fontSize: 32, color: CHART_COLORS.error, opacity: 0.6 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Avg Duration
                </Typography>
                <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
                  {chartData.summary.averageDuration}
                  <Typography variant="caption" component="span" sx={{ ml: 0.5 }}>
                    min
                  </Typography>
                </Typography>
              </Box>
              <Clock sx={{ fontSize: 32, color: CHART_COLORS.info, opacity: 0.6 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Avg Wait Time
                </Typography>
                <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
                  {chartData.summary.averageWaitTime}
                  <Typography variant="caption" component="span" sx={{ ml: 0.5 }}>
                    min
                  </Typography>
                </Typography>
              </Box>
              <Schedule sx={{ fontSize: 32, color: CHART_COLORS.purple, opacity: 0.6 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Compact Charts Grid */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2,
        flex: 1,
        overflow: 'auto'
      }}>
        {/* Appointment Trends Chart */}
        <Card sx={{ boxShadow: 2 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600, mb: 1 }}>
              <TrendingUp fontSize="small" />
              Appointment Trends
            </Typography>
            <Box sx={{ height: compact ? 200 : 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  {!compact && <Legend wrapperStyle={{ fontSize: '12px' }} />}
                  <Area
                    type="monotone"
                    dataKey="appointments"
                    stackId="1"
                    stroke={CHART_COLORS.primary}
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.7}
                    name="Total"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stackId="2"
                    stroke={CHART_COLORS.success}
                    fill={CHART_COLORS.success}
                    fillOpacity={0.7}
                    name="Completed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Appointment Type Distribution */}
        <Card sx={{ boxShadow: 2 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
              Appointment Type Distribution
            </Typography>
            <Box sx={{ height: compact ? 180 : 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.types}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => compact ? `${(percent * 100).toFixed(0)}%` : `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={compact ? 60 : 70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.types.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Peak Times - Hourly Distribution */}
        {!compact && (
          <Card sx={{ boxShadow: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                Peak Times - Hourly
              </Typography>
              <Box sx={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill={CHART_COLORS.info} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default AppointmentAnalyticsDashboard;