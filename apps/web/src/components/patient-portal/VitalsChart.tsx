import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

interface VitalReading {
  date: string;
  source?: 'patient' | 'pharmacist';
  verified?: boolean;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  weight?: number;
  glucose?: number;
  temperature?: number;
  oxygenSaturation?: number;
}

interface VitalsTrend {
  metric: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  status: 'normal' | 'warning' | 'critical';
}

interface VitalsInsight {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  metric?: string;
}

interface VitalsTrendsData {
  readings: VitalReading[];
  trends: VitalsTrend[];
  insights: VitalsInsight[];
  summary: {
    totalReadings: number;
    daysTracked: number;
    lastReading: string;
    averages: {
      bloodPressure?: { systolic: number; diastolic: number };
      heartRate?: number;
      weight?: number;
      glucose?: number;
    };
  };
}

interface VitalsChartProps {
  data: VitalsTrendsData;
  loading?: boolean;
}

const VitalsChart: React.FC<VitalsChartProps> = ({ data, loading }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Typography>Loading vitals data...</Typography>
      </Box>
    );
  }

  // Enhanced validation for data structure
  if (!data) {
    return (
      <Alert severity="info">
        No vitals data available. Start logging your vitals to see trends and charts.
      </Alert>
    );
  }

  // Safely access readings array
  const readings = (data.readings || []) as VitalReading[];
  
  if (readings.length === 0) {
    return (
      <Alert severity="info">
        No vitals data available. Start logging your vitals to see trends and charts.
      </Alert>
    );
  }

  // Prepare chart data with error handling
  const chartData = readings.map(reading => ({
    date: reading.date ? new Date(reading.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    fullDate: reading.date || new Date().toISOString(),
    systolic: reading.bloodPressureSystolic,
    diastolic: reading.bloodPressureDiastolic,
    heartRate: reading.heartRate,
    weight: reading.weight,
    glucose: reading.glucose,
    temperature: reading.temperature,
    oxygenSaturation: reading.oxygenSaturation
  })).sort((a, b) => {
    try {
      return new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime();
    } catch (error) {
      return 0;
    }
  });

  // Reference ranges for vitals
  const referenceRanges = {
    systolic: { min: 90, max: 120, optimal: 110 },
    diastolic: { min: 60, max: 80, optimal: 70 },
    heartRate: { min: 60, max: 100, optimal: 80 },
    glucose: { min: 70, max: 140, optimal: 100 },
    temperature: { min: 36.1, max: 37.2, optimal: 36.5 },
    oxygenSaturation: { min: 95, max: 100, optimal: 98 }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon fontSize="small" />;
      case 'down':
        return <TrendingDownIcon fontSize="small" />;
      default:
        return <TrendingFlatIcon fontSize="small" />;
    }
  };

  const getTrendColor = (trend: string, metric: string) => {
    // For some metrics, up trend might be bad (e.g., blood pressure, glucose)
    const badUpTrends = ['bloodPressure', 'glucose', 'weight'];
    const goodUpTrends = ['oxygenSaturation'];
    
    if (trend === 'stable') return 'default';
    
    if (badUpTrends.some(m => metric.includes(m))) {
      return trend === 'up' ? 'error' : 'success';
    }
    
    if (goodUpTrends.some(m => metric.includes(m))) {
      return trend === 'up' ? 'success' : 'error';
    }
    
    return trend === 'up' ? 'success' : 'warning';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card sx={{ p: 2, maxWidth: 300 }}>
          <Typography variant="subtitle2" gutterBottom>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey === 'systolic' || entry.dataKey === 'diastolic' ? ' mmHg' : ''}
              {entry.dataKey === 'heartRate' ? ' bpm' : ''}
              {entry.dataKey === 'weight' ? ' kg' : ''}
              {entry.dataKey === 'glucose' ? ' mg/dL' : ''}
              {entry.dataKey === 'temperature' ? ' °C' : ''}
              {entry.dataKey === 'oxygenSaturation' ? ' %' : ''}
            </Typography>
          ))}
        </Card>
      );
    }
    return null;
  };

  // Safely access trends, insights, and summary with defaults
  const trends = data.trends || [];
  const insights = data.insights || [];
  const summary = data.summary || {
    totalReadings: readings.length,
    daysTracked: 0,
    lastReading: readings[readings.length - 1]?.date || new Date().toISOString(),
    averages: {}
  };

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h6" color="primary">
                {summary.totalReadings || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Readings
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h6" color="primary">
                {summary.daysTracked || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Days Tracked
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Last Reading
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {summary.lastReading ? new Date(summary.lastReading).toLocaleDateString() : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Avg BP
              </Typography>
              {summary.averages?.bloodPressure ? (
                <Typography variant="body2" fontWeight="medium">
                  {Math.round(summary.averages.bloodPressure.systolic)}/
                  {Math.round(summary.averages.bloodPressure.diastolic)}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  N/A
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Trends Overview */}
      {trends.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Trends Overview
            </Typography>
            <Grid container spacing={2}>
              {trends.map((trend, index) => {
                const trendColor = getTrendColor(trend.trend, trend.metric);
                // Map color names to theme palette colors
                const getThemeColor = (colorName: string) => {
                  switch (colorName) {
                    case 'success':
                      return theme.palette.success?.main || '#4caf50';
                    case 'error':
                      return theme.palette.error?.main || '#f44336';
                    case 'warning':
                      return theme.palette.warning?.main || '#ff9800';
                    default:
                      return theme.palette.grey?.[300] || '#e0e0e0';
                  }
                };
                
                return (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      p: 2,
                      borderRadius: 1,
                      bgcolor: alpha(getThemeColor(trendColor), 0.1)
                    }}>
                      {getTrendIcon(trend.trend)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {trend.metric}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {trend.change > 0 ? '+' : ''}{trend.change}%
                          </Typography>
                          <Chip 
                            label={trend.status} 
                            size="small" 
                            color={getStatusColor(trend.status) as any}
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Blood Pressure Chart */}
        {chartData.some(d => d.systolic || d.diastolic) && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Blood Pressure Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    
                    {/* Reference lines */}
                    <ReferenceLine y={120} stroke={theme.palette.warning.main} strokeDasharray="5 5" />
                    <ReferenceLine y={80} stroke={theme.palette.warning.main} strokeDasharray="5 5" />
                    
                    <Line 
                      type="monotone" 
                      dataKey="systolic" 
                      stroke={theme.palette.error.main} 
                      strokeWidth={2}
                      name="Systolic"
                      connectNulls={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="diastolic" 
                      stroke={theme.palette.primary.main} 
                      strokeWidth={2}
                      name="Diastolic"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Heart Rate Chart */}
        {chartData.some(d => d.heartRate) && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Heart Rate Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Reference lines */}
                    <ReferenceLine y={60} stroke={theme.palette.info.main} strokeDasharray="5 5" />
                    <ReferenceLine y={100} stroke={theme.palette.info.main} strokeDasharray="5 5" />
                    
                    <Area 
                      type="monotone" 
                      dataKey="heartRate" 
                      stroke={theme.palette.secondary.main} 
                      fill={alpha(theme.palette.secondary.main, 0.3)}
                      name="Heart Rate (bpm)"
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Weight Chart */}
        {chartData.some(d => d.weight) && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Weight Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip content={<CustomTooltip />} />
                    
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke={theme.palette.success.main} 
                      strokeWidth={2}
                      name="Weight (kg)"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Glucose Chart */}
        {chartData.some(d => d.glucose) && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Blood Glucose Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Reference lines */}
                    <ReferenceLine y={70} stroke={theme.palette.warning.main} strokeDasharray="5 5" />
                    <ReferenceLine y={140} stroke={theme.palette.warning.main} strokeDasharray="5 5" />
                    
                    <Line 
                      type="monotone" 
                      dataKey="glucose" 
                      stroke={theme.palette.warning.main} 
                      strokeWidth={2}
                      name="Glucose (mg/dL)"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Insights */}
      {insights.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="primary" />
              Health Insights
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {insights.map((insight, index) => (
                <Alert 
                  key={index} 
                  severity={insight.type}
                  icon={insight.type === 'warning' ? <WarningIcon /> : undefined}
                >
                  {insight.message}
                </Alert>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default VitalsChart;