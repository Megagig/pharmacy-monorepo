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
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Schedule,
  Person,
  Warning,
  CheckCircle,
  Download,
  Refresh,
  FilterList,
  Analytics,
  AccessTime,
  EventBusy,
  EventAvailable,
  Lightbulb,
  CalendarToday,
  Groups,
  Assessment,
} from '@mui/icons-material';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useCapacityAnalytics } from '../../hooks/useAppointmentAnalytics';
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
  grey: '#757575',
};

const UTILIZATION_COLORS = [
  CHART_COLORS.success,
  CHART_COLORS.info,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.teal,
  CHART_COLORS.indigo,
];

interface CapacityUtilizationChartProps {
  className?: string;
}

const CapacityUtilizationChart: React.FC<CapacityUtilizationChartProps> = ({
  className,
}) => {
  // State for filters
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [selectedPharmacist, setSelectedPharmacist] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data
  const analyticsParams = useMemo(() => ({
    startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
    endDate: format(dateRange.endDate, 'yyyy-MM-dd'),
    ...(selectedPharmacist && { pharmacistId: selectedPharmacist }),
    ...(selectedLocation && { locationId: selectedLocation }),
  }), [dateRange, selectedPharmacist, selectedLocation]);

  const {
    data: capacityData,
    isLoading,
    error,
    refetch,
  } = useCapacityAnalytics(analyticsParams);

  const { data: usersData } = useUsers();

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!capacityData?.data) {
      return null;
    }

    const { overall, byPharmacist = [], byDay = [], byHour = [], recommendations = [] } = capacityData.data;

    // Prepare pharmacist utilization data
    const pharmacistData = (byPharmacist || []).map(pharmacist => ({
      name: pharmacist.pharmacistName || 'Unknown',
      totalSlots: pharmacist.totalSlots || 0,
      bookedSlots: pharmacist.bookedSlots || 0,
      availableSlots: (pharmacist.totalSlots || 0) - (pharmacist.bookedSlots || 0),
      utilizationRate: pharmacist.utilizationRate || 0,
      workingHours: pharmacist.workingHours || 0,
      efficiency: (pharmacist.workingHours || 0) > 0 ? (pharmacist.bookedSlots || 0) / pharmacist.workingHours : 0,
    }));

    // Prepare daily capacity data
    const dailyData = (byDay || []).map(day => ({
      day: (day.day || '').substring(0, 3), // Mon, Tue, etc.
      totalSlots: day.totalSlots || 0,
      bookedSlots: day.bookedSlots || 0,
      availableSlots: (day.totalSlots || 0) - (day.bookedSlots || 0),
      utilizationRate: day.utilizationRate || 0,
      overbooking: (day.bookedSlots || 0) > (day.totalSlots || 0) ? (day.bookedSlots || 0) - (day.totalSlots || 0) : 0,
    }));

    // Prepare hourly capacity data
    const hourlyData = (byHour || []).map(hour => ({
      hour: `${(hour.hour || 0).toString().padStart(2, '0')}:00`,
      totalSlots: hour.totalSlots || 0,
      bookedSlots: hour.bookedSlots || 0,
      availableSlots: (hour.totalSlots || 0) - (hour.bookedSlots || 0),
      utilizationRate: hour.utilizationRate || 0,
      overbooking: (hour.bookedSlots || 0) > (hour.totalSlots || 0) ? (hour.bookedSlots || 0) - (hour.totalSlots || 0) : 0,
    }));

    // Calculate utilization distribution for pie chart
    const utilizationRanges = [
      { range: '0-25%', count: 0, color: CHART_COLORS.error },
      { range: '26-50%', count: 0, color: CHART_COLORS.warning },
      { range: '51-75%', count: 0, color: CHART_COLORS.info },
      { range: '76-90%', count: 0, color: CHART_COLORS.success },
      { range: '91-100%', count: 0, color: CHART_COLORS.primary },
      { range: '>100%', count: 0, color: CHART_COLORS.secondary },
    ];

    (byPharmacist || []).forEach(pharmacist => {
      const rate = pharmacist.utilizationRate || 0;
      if (rate <= 25) utilizationRanges[0].count++;
      else if (rate <= 50) utilizationRanges[1].count++;
      else if (rate <= 75) utilizationRanges[2].count++;
      else if (rate <= 90) utilizationRanges[3].count++;
      else if (rate <= 100) utilizationRanges[4].count++;
      else utilizationRanges[5].count++;
    });

    const utilizationDistribution = utilizationRanges.filter(range => range.count > 0);

    // Identify overbooking incidents
    const overbookingIncidents = [
      ...dailyData.filter(day => day.overbooking > 0).map(day => ({
        type: 'Daily',
        period: day.day,
        overbooking: day.overbooking,
        severity: day.overbooking > 5 ? 'high' : day.overbooking > 2 ? 'medium' : 'low',
      })),
      ...hourlyData.filter(hour => hour.overbooking > 0).map(hour => ({
        type: 'Hourly',
        period: hour.hour,
        overbooking: hour.overbooking,
        severity: hour.overbooking > 3 ? 'high' : hour.overbooking > 1 ? 'medium' : 'low',
      })),
    ];

    return {
      overall,
      pharmacists: pharmacistData,
      daily: dailyData,
      hourly: hourlyData,
      utilizationDistribution,
      overbookingIncidents,
      recommendations,
    };
  }, [capacityData]);

  // Handle export
  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      setIsExporting(true);
      // TODO: Implement export functionality
      toast.success(`Capacity analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export capacity analytics');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    toast.success('Capacity analytics refreshed');
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

  // Get utilization color based on rate
  const getUtilizationColor = (rate: number) => {
    if (rate <= 25) return CHART_COLORS.error;
    if (rate <= 50) return CHART_COLORS.warning;
    if (rate <= 75) return CHART_COLORS.info;
    if (rate <= 90) return CHART_COLORS.success;
    if (rate <= 100) return CHART_COLORS.primary;
    return CHART_COLORS.secondary;
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return CHART_COLORS.error;
      case 'medium': return CHART_COLORS.warning;
      case 'low': return CHART_COLORS.info;
      default: return CHART_COLORS.grey;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading capacity analytics...
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
        Failed to load capacity analytics. Please try again.
      </Alert>
    );
  }

  if (!chartData) {
    return (
      <Alert severity="info">
        No capacity data available for the selected period.
        <br />
        <Typography variant="caption" color="text.secondary">
          This could be due to insufficient permissions or no capacity data in the selected date range.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box className={className} sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            Capacity Utilization Analytics
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
                {usersData?.data?.users?.map((user) => (
                  <MenuItem key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Location filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Location</InputLabel>
              <Select
                value={selectedLocation}
                label="Location"
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <MenuItem value="">All Locations</MenuItem>
                <MenuItem value="main">Main Pharmacy</MenuItem>
                <MenuItem value="branch1">Branch 1</MenuItem>
                <MenuItem value="branch2">Branch 2</MenuItem>
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
                  Overall Utilization
                </Typography>
                <Typography variant="h4" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {chartData.overall.utilizationRate.toFixed(1)}%
                  {chartData.overall.utilizationRate >= 80 ? (
                    <TrendingUp sx={{ color: CHART_COLORS.success }} />
                  ) : chartData.overall.utilizationRate >= 60 ? (
                    <Schedule sx={{ color: CHART_COLORS.warning }} />
                  ) : (
                    <TrendingDown sx={{ color: CHART_COLORS.error }} />
                  )}
                </Typography>
              </Box>
              <Analytics sx={{ fontSize: 40, color: getUtilizationColor(chartData.overall.utilizationRate), opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Slots
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.overall.totalSlots.toLocaleString()}
                </Typography>
              </Box>
              <CalendarToday sx={{ fontSize: 40, color: CHART_COLORS.primary, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Booked Slots
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.overall.bookedSlots.toLocaleString()}
                </Typography>
              </Box>
              <EventBusy sx={{ fontSize: 40, color: CHART_COLORS.success, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Available Slots
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.overall.availableSlots.toLocaleString()}
                </Typography>
              </Box>
              <EventAvailable sx={{ fontSize: 40, color: CHART_COLORS.info, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Overbooking Incidents
                </Typography>
                <Typography variant="h4" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {chartData.overbookingIncidents.length}
                  {chartData.overbookingIncidents.some(incident => incident.severity === 'high') && (
                    <Warning sx={{ color: CHART_COLORS.error }} />
                  )}
                </Typography>
              </Box>
              <Warning sx={{ fontSize: 40, color: CHART_COLORS.warning, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Active Pharmacists
                </Typography>
                <Typography variant="h4" component="div">
                  {chartData.pharmacists.length}
                </Typography>
              </Box>
              <Groups sx={{ fontSize: 40, color: CHART_COLORS.purple, opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        {/* Pharmacist Utilization Rates */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person />
                Pharmacist Utilization Rates
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData.pharmacists} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip 
                      formatter={(value, name) => [
                        typeof value === 'number' ? 
                          (name === 'utilizationRate' ? `${value.toFixed(1)}%` : value.toLocaleString()) : 
                          value,
                        name === 'utilizationRate' ? 'Utilization Rate' :
                        name === 'totalSlots' ? 'Total Slots' :
                        name === 'bookedSlots' ? 'Booked Slots' :
                        name === 'availableSlots' ? 'Available Slots' : name
                      ]}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="totalSlots"
                      fill={CHART_COLORS.grey}
                      name="Total Slots"
                      opacity={0.6}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="bookedSlots"
                      fill={CHART_COLORS.success}
                      name="Booked Slots"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="utilizationRate"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                      name="Utilization Rate (%)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Utilization Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Utilization Distribution
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.utilizationDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ range, count, percent }) => `${range}: ${count} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {chartData.utilizationDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value, name, props) => [
                        `${value} pharmacists`,
                        `${props.payload.range} utilization`
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Available vs. Booked Slots Over Time - Daily */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule />
                Capacity by Day of Week
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="totalSlots"
                      stackId="1"
                      stroke={CHART_COLORS.grey}
                      fill={CHART_COLORS.grey}
                      fillOpacity={0.3}
                      name="Total Capacity"
                    />
                    <Area
                      type="monotone"
                      dataKey="bookedSlots"
                      stackId="2"
                      stroke={CHART_COLORS.success}
                      fill={CHART_COLORS.success}
                      fillOpacity={0.8}
                      name="Booked Slots"
                    />
                    {chartData.daily.some(day => day.overbooking > 0) && (
                      <Area
                        type="monotone"
                        dataKey="overbooking"
                        stackId="3"
                        stroke={CHART_COLORS.error}
                        fill={CHART_COLORS.error}
                        fillOpacity={0.8}
                        name="Overbooking"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Hourly Capacity Analysis */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTime />
                Hourly Capacity Analysis
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.hourly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="totalSlots" fill={CHART_COLORS.grey} name="Total Slots" opacity={0.6} />
                    <Bar dataKey="bookedSlots" fill={CHART_COLORS.success} name="Booked Slots" />
                    {chartData.hourly.some(hour => hour.overbooking > 0) && (
                      <Bar dataKey="overbooking" fill={CHART_COLORS.error} name="Overbooking" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Pharmacist Performance Details */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person />
                Pharmacist Performance Details
              </Typography>
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {chartData.pharmacists.map((pharmacist, index) => (
                  <Box key={index} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {pharmacist.name}
                      </Typography>
                      <Chip
                        label={`${pharmacist.utilizationRate.toFixed(1)}%`}
                        color={
                          pharmacist.utilizationRate >= 80 ? 'success' :
                          pharmacist.utilizationRate >= 60 ? 'warning' : 'error'
                        }
                        size="small"
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(pharmacist.utilizationRate, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        mb: 1,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getUtilizationColor(pharmacist.utilizationRate),
                        },
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', typography: 'body2', color: 'text.secondary' }}>
                      <span>Booked: {pharmacist.bookedSlots}/{pharmacist.totalSlots}</span>
                      <span>Working Hours: {pharmacist.workingHours}h</span>
                      <span>Efficiency: {pharmacist.efficiency.toFixed(1)} slots/h</span>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Overbooking Incidents & Recommendations */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning />
                Overbooking Incidents
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                {chartData.overbookingIncidents.length > 0 ? (
                  <List dense>
                    {chartData.overbookingIncidents.map((incident, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Warning sx={{ color: getSeverityColor(incident.severity) }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${incident.type}: ${incident.period}`}
                          secondary={`+${incident.overbooking} slots (${incident.severity})`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
                    <CheckCircle sx={{ color: CHART_COLORS.success, mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No overbooking incidents
                    </Typography>
                  </Box>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lightbulb />
                Recommendations
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {chartData.recommendations.length > 0 ? (
                  <List dense>
                    {chartData.recommendations.map((recommendation, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Lightbulb sx={{ color: CHART_COLORS.warning }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={recommendation}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
                    <CheckCircle sx={{ color: CHART_COLORS.success, mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Capacity is optimally utilized
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CapacityUtilizationChart;