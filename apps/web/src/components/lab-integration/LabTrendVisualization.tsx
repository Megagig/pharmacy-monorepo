import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Stack,
  Grid,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Science as ScienceIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Dot,
} from 'recharts';
import { format } from 'date-fns';
import { useLabTrends } from '../../hooks/useLabIntegration';

interface LabTrendVisualizationProps {
  patientId: string;
  labResultIds: string[];
}

const LabTrendVisualization: React.FC<LabTrendVisualizationProps> = ({
  patientId,
  labResultIds,
}) => {
  const theme = useTheme();
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [daysBack, setDaysBack] = useState<number>(90);

  // Fetch trend data
  const { data: trendData, isLoading, error } = useLabTrends(
    patientId,
    selectedTest,
    daysBack,
    !!selectedTest
  );

  // Mock available tests (in real app, this would come from lab results)
  const availableTests = [
    { code: 'HbA1c', name: 'Hemoglobin A1c', unit: '%' },
    { code: 'glucose', name: 'Blood Glucose', unit: 'mg/dL' },
    { code: 'creatinine', name: 'Creatinine', unit: 'mg/dL' },
    { code: 'inr', name: 'INR', unit: '' },
    { code: 'alt', name: 'ALT', unit: 'U/L' },
    { code: 'ast', name: 'AST', unit: 'U/L' },
    { code: 'cholesterol', name: 'Total Cholesterol', unit: 'mg/dL' },
    { code: 'ldl', name: 'LDL Cholesterol', unit: 'mg/dL' },
    { code: 'hdl', name: 'HDL Cholesterol', unit: 'mg/dL' },
    { code: 'triglycerides', name: 'Triglycerides', unit: 'mg/dL' },
  ];

  const getTrendIcon = (direction: string) => {
    if (direction === 'increasing') return <TrendingUpIcon color="error" />;
    if (direction === 'decreasing') return <TrendingDownIcon color="success" />;
    return <TrendingFlatIcon color="info" />;
  };

  const getTrendColor = (direction: string) => {
    if (direction === 'increasing') return 'error';
    if (direction === 'decreasing') return 'success';
    return 'info';
  };

  // Custom dot to mark therapy changes
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.therapyChange) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={6} fill={theme.palette.warning.main} stroke="#fff" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={3} fill="#fff" />
        </g>
      );
    }
    return <Dot {...props} />;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            {format(new Date(data.date), 'MMM dd, yyyy')}
          </Typography>
          <Typography variant="body2" color="primary">
            Value: {data.value} {data.unit}
          </Typography>
          {data.referenceRange && (
            <Typography variant="caption" color="text.secondary" display="block">
              Normal: {data.referenceRange}
            </Typography>
          )}
          {data.therapyChange && (
            <Chip
              label="Therapy Change"
              size="small"
              color="warning"
              sx={{ mt: 1 }}
            />
          )}
        </Paper>
      );
    }
    return null;
  };

  if (!selectedTest) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <ScienceIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Select a Lab Test to View Trends
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Choose a lab test from the dropdown below to visualize longitudinal trends.
        </Typography>
        <FormControl sx={{ minWidth: 300 }}>
          <InputLabel>Select Lab Test</InputLabel>
          <Select
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            label="Select Lab Test"
          >
            {availableTests.map((test) => (
              <MenuItem key={test.code} value={test.code}>
                {test.name} ({test.unit})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="body1">Loading trend data...</Typography>
      </Box>
    );
  }

  if (error || !trendData) {
    return (
      <Alert severity="error">
        Failed to load trend data. Please try again.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Controls */}
      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Lab Test</InputLabel>
                <Select
                  value={selectedTest}
                  onChange={(e) => setSelectedTest(e.target.value)}
                  label="Lab Test"
                >
                  {availableTests.map((test) => (
                    <MenuItem key={test.code} value={test.code}>
                      {test.name} ({test.unit})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Time Period</InputLabel>
                <Select
                  value={daysBack}
                  onChange={(e) => setDaysBack(Number(e.target.value))}
                  label="Time Period"
                >
                  <MenuItem value={30}>Last 30 Days</MenuItem>
                  <MenuItem value={90}>Last 90 Days</MenuItem>
                  <MenuItem value={180}>Last 6 Months</MenuItem>
                  <MenuItem value={365}>Last Year</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Trend Metrics */}
      {trendData.metrics && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Trend Analysis
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Direction
                  </Typography>
                  <Chip
                    icon={getTrendIcon(trendData.metrics.direction)}
                    label={trendData.metrics.direction.toUpperCase()}
                    color={getTrendColor(trendData.metrics.direction) as any}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Percent Change
                  </Typography>
                  <Typography variant="h6" color={trendData.metrics.percentChange > 0 ? 'error.main' : 'success.main'}>
                    {trendData.metrics.percentChange > 0 ? '+' : ''}
                    {trendData.metrics.percentChange.toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Target Achievement
                  </Typography>
                  <Typography variant="h6" color={trendData.metrics.targetAchievement ? 'success.main' : 'warning.main'}>
                    {trendData.metrics.targetAchievement ? 'Yes' : 'No'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Data Points
                  </Typography>
                  <Typography variant="h6">
                    {trendData.dataPoints.length}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Longitudinal Trend
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.dataPoints} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <YAxis
                  tick={{ fill: theme.palette.text.secondary }}
                  label={{ value: trendData.unit, angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Reference range (shaded area) */}
                {trendData.referenceRange && (
                  <ReferenceArea
                    y1={trendData.referenceRange.min}
                    y2={trendData.referenceRange.max}
                    fill={theme.palette.success.light}
                    fillOpacity={0.1}
                    label="Normal Range"
                  />
                )}

                {/* Target line */}
                {trendData.targetValue && (
                  <ReferenceLine
                    y={trendData.targetValue}
                    stroke={theme.palette.info.main}
                    strokeDasharray="5 5"
                    label="Target"
                  />
                )}

                {/* Data line */}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={{ r: 8 }}
                  name={selectedTest}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Legend */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip
              icon={<InfoIcon />}
              label="Therapy Change Marker"
              size="small"
              sx={{ bgcolor: theme.palette.warning.light }}
            />
            {trendData.referenceRange && (
              <Chip
                label={`Normal Range: ${trendData.referenceRange.min}-${trendData.referenceRange.max} ${trendData.unit}`}
                size="small"
                variant="outlined"
                color="success"
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default LabTrendVisualization;

