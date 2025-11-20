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
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Notifications,
  CheckCircle,
  Error,
  Warning,
  Download,
  Refresh,
  FilterList,
  Analytics,
  Message,
  Email,
  Sms,
  Phone,
  WhatsApp,
  Schedule,
  Assessment,
  CompareArrows,
} from '@mui/icons-material';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useReminderAnalytics } from '../../hooks/useAppointmentAnalytics';
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

const CHANNEL_COLORS = {
  email: CHART_COLORS.primary,
  sms: CHART_COLORS.success,
  whatsapp: CHART_COLORS.teal,
  push: CHART_COLORS.purple,
};

const CHANNEL_ICONS = {
  email: Email,
  sms: Sms,
  whatsapp: WhatsApp,
  push: Notifications,
};

interface ReminderEffectivenessChartProps {
  className?: string;
}

const ReminderEffectivenessChart: React.FC<ReminderEffectivenessChartProps> = ({
  className,
}) => {
  // State for filters
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data
  const analyticsParams = useMemo(() => ({
    startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
    endDate: format(dateRange.endDate, 'yyyy-MM-dd'),
    ...(selectedChannel && { channel: selectedChannel }),
    ...(selectedTemplate && { templateId: selectedTemplate }),
  }), [dateRange, selectedChannel, selectedTemplate]);

  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useReminderAnalytics(analyticsParams);

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!analyticsData?.data) {
      return null;
    }

    const { summary, byChannel = [], byTiming = [], templatePerformance = [], trends = {} } = analyticsData.data;

    // Prepare channel comparison data
    const channelData = (byChannel || []).map(channel => ({
      name: (channel.channel || '').charAt(0).toUpperCase() + (channel.channel || '').slice(1),
      channel: channel.channel || '',
      sent: channel.sent || 0,
      delivered: channel.delivered || 0,
      failed: channel.failed || 0,
      deliveryRate: channel.deliveryRate || 0,
      responseRate: channel.responseRate || 0,
      successRate: channel.deliveryRate || 0,
    }));

    // Prepare timing effectiveness data
    const timingData = (byTiming || []).map(timing => ({
      name: timing.timingLabel || '',
      sent: timing.sent || 0,
      effectiveness: timing.effectiveness || 0,
    }));

    // Prepare template performance data
    const templateData = templatePerformance.map(template => ({
      name: template.templateName,
      id: template.templateId,
      sent: template.sent,
      deliveryRate: template.deliveryRate,
      responseRate: template.responseRate,
    }));

    // Prepare trend data for line chart
    const trendData = trends.daily.map(day => ({
      date: format(new Date(day.date), 'MMM dd'),
      sent: day.sent,
      delivered: day.delivered,
      failed: day.failed,
      deliveryRate: day.sent > 0 ? Math.round((day.delivered / day.sent) * 100) : 0,
    }));

    // Prepare channel comparison for radial chart
    const channelRadialData = byChannel.map((channel, index) => ({
      name: channel.channel.charAt(0).toUpperCase() + channel.channel.slice(1),
      value: channel.deliveryRate,
      fill: Object.values(CHANNEL_COLORS)[index % Object.values(CHANNEL_COLORS).length],
    }));

    return {
      summary,
      channels: channelData,
      timing: timingData,
      templates: templateData,
      trends: trendData,
      channelRadial: channelRadialData,
    };
  }, [analyticsData]);

  // Handle export
  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      setIsExporting(true);
      // TODO: Implement export functionality
      toast.success(`Reminder analytics exported as ${format.toUpperCase()}`);
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
          Loading reminder analytics...
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
        Failed to load reminder analytics. Please try again.
      </Alert>
    );
  }

  if (!chartData) {
    return (
      <Alert severity="info">
        No reminder data available for the selected period.
        <br />
        <Typography variant="caption" color="text.secondary">
          This could be due to insufficient permissions or no reminder data in the selected date range.
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
            <Message color="primary" />
            Reminder Effectiveness Analytics
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

            {/* Channel filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Channel</InputLabel>
              <Select
                value={selectedChannel}
                label="Channel"
                onChange={(e) => setSelectedChannel(e.target.value)}
              >
                <MenuItem value="">All Channels</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="push">Push Notification</MenuItem>
              </Select>
            </FormControl>

            {/* Template filter */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Template</InputLabel>
              <Select
                value={selectedTemplate}
                label="Template"
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <MenuItem value="">All Templates</MenuItem>
                {chartData.templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>
      </Box>

      {/* Summary Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Reminders
                  </Typography>
                  <Typography variant="h4" component="div">
                    {chartData.summary.totalReminders.toLocaleString()}
                  </Typography>
                </Box>
                <Notifications sx={{ fontSize: 40, color: CHART_COLORS.primary, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Delivery Success Rate
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {chartData.summary.deliverySuccessRate}%
                    {chartData.summary.deliverySuccessRate >= 90 ? (
                      <TrendingUp sx={{ color: CHART_COLORS.success }} />
                    ) : chartData.summary.deliverySuccessRate >= 70 ? (
                      <Warning sx={{ color: CHART_COLORS.warning }} />
                    ) : (
                      <TrendingDown sx={{ color: CHART_COLORS.error }} />
                    )}
                  </Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 40, color: CHART_COLORS.success, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Patient Response Rate
                  </Typography>
                  <Typography variant="h4" component="div">
                    {chartData.summary.patientResponseRate}%
                  </Typography>
                </Box>
                <Assessment sx={{ fontSize: 40, color: CHART_COLORS.info, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    No-Show Impact
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    -{chartData.summary.impactOnNoShowRate}%
                    <TrendingDown sx={{ color: CHART_COLORS.success }} />
                  </Typography>
                </Box>
                <Schedule sx={{ fontSize: 40, color: CHART_COLORS.purple, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        {/* Channel Comparison Chart */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CompareArrows />
                Channel Comparison
              </Typography>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData.channels}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip 
                      formatter={(value, name) => [
                        `${value}${name.includes('Rate') ? '%' : ''}`,
                        name === 'sent' ? 'Sent' : 
                        name === 'delivered' ? 'Delivered' : 
                        name === 'deliveryRate' ? 'Delivery Rate' : 
                        name === 'responseRate' ? 'Response Rate' : name
                      ]}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="sent"
                      fill={CHART_COLORS.primary}
                      name="Sent"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="delivered"
                      fill={CHART_COLORS.success}
                      name="Delivered"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="deliveryRate"
                      stroke={CHART_COLORS.warning}
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.warning, strokeWidth: 2, r: 4 }}
                      name="Delivery Rate (%)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="responseRate"
                      stroke={CHART_COLORS.info}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: CHART_COLORS.info, strokeWidth: 2, r: 3 }}
                      name="Response Rate (%)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Channel Performance Radial Chart */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Channel Performance Overview
              </Typography>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="80%" data={chartData.channelRadial}>
                    <RadialBar
                      minAngle={15}
                      label={{ position: 'insideStart', fill: '#fff' }}
                      background
                      clockWise
                      dataKey="value"
                    />
                    <Legend iconSize={18} layout="vertical" verticalAlign="middle" align="right" />
                    <RechartsTooltip formatter={(value) => [`${value}%`, 'Delivery Rate']} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Reminder Timing Effectiveness */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Reminder Timing Effectiveness
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.timing}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value, name) => [
                        `${value}${name === 'effectiveness' ? '%' : ''}`,
                        name === 'sent' ? 'Reminders Sent' : 'Effectiveness'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="sent" fill={CHART_COLORS.primary} name="Sent" />
                    <Bar dataKey="effectiveness" fill={CHART_COLORS.success} name="Effectiveness %" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Template Performance */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Template Performance
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData.templates}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip 
                      formatter={(value, name) => [
                        `${value}${name.includes('Rate') ? '%' : ''}`,
                        name === 'sent' ? 'Sent' : 
                        name === 'deliveryRate' ? 'Delivery Rate' : 
                        name === 'responseRate' ? 'Response Rate' : name
                      ]}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="sent"
                      fill={CHART_COLORS.primary}
                      name="Sent"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="deliveryRate"
                      stroke={CHART_COLORS.success}
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.success, strokeWidth: 2, r: 4 }}
                      name="Delivery Rate (%)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="responseRate"
                      stroke={CHART_COLORS.warning}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: CHART_COLORS.warning, strokeWidth: 2, r: 3 }}
                      name="Response Rate (%)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Delivery Trends */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp />
                Reminder Delivery Trends
              </Typography>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip 
                      formatter={(value, name) => [
                        `${value}${name === 'deliveryRate' ? '%' : ''}`,
                        name === 'sent' ? 'Sent' : 
                        name === 'delivered' ? 'Delivered' : 
                        name === 'failed' ? 'Failed' : 
                        name === 'deliveryRate' ? 'Delivery Rate' : name
                      ]}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="sent"
                      stackId="1"
                      stroke={CHART_COLORS.primary}
                      fill={CHART_COLORS.primary}
                      fillOpacity={0.6}
                      name="Sent"
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="delivered"
                      stackId="2"
                      stroke={CHART_COLORS.success}
                      fill={CHART_COLORS.success}
                      fillOpacity={0.6}
                      name="Delivered"
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="failed"
                      stackId="3"
                      stroke={CHART_COLORS.error}
                      fill={CHART_COLORS.error}
                      fillOpacity={0.6}
                      name="Failed"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="deliveryRate"
                      stroke={CHART_COLORS.warning}
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.warning, strokeWidth: 2, r: 4 }}
                      name="Delivery Rate (%)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Channel Details Cards */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Analytics />
            Channel Performance Details
          </Typography>
          <Grid container spacing={2}>
            {chartData.channels.map((channel) => {
              const IconComponent = CHANNEL_ICONS[channel.channel as keyof typeof CHANNEL_ICONS] || Message;
              return (
                <Grid item xs={12} sm={6} md={3} key={channel.channel}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconComponent sx={{ color: CHANNEL_COLORS[channel.channel as keyof typeof CHANNEL_COLORS] }} />
                          {channel.name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="textSecondary">Sent:</Typography>
                          <Typography variant="body2" fontWeight="bold">{channel.sent.toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="textSecondary">Delivered:</Typography>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {channel.delivered.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="textSecondary">Failed:</Typography>
                          <Typography variant="body2" fontWeight="bold" color="error.main">
                            {channel.failed.toLocaleString()}
                          </Typography>
                        </Box>
                        <Divider />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="textSecondary">Delivery Rate:</Typography>
                          <Typography 
                            variant="body2" 
                            fontWeight="bold"
                            color={channel.deliveryRate >= 90 ? 'success.main' : 
                                   channel.deliveryRate >= 70 ? 'warning.main' : 'error.main'}
                          >
                            {channel.deliveryRate}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="textSecondary">Response Rate:</Typography>
                          <Typography variant="body2" fontWeight="bold" color="info.main">
                            {channel.responseRate}%
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReminderEffectivenessChart;