import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Card,
  CardContent,
  Chip,
  Autocomplete,
  Alert,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { format, subMonths, subYears } from 'date-fns';
import api from '../services/api';

/**
 * Lab Trends Page
 * Visualize lab result trends over time using Recharts
 * Route: /laboratory/trends
 */

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  patientId: string;
}

interface TrendData {
  date: string;
  value: number;
  interpretation: string;
  isCritical: boolean;
  isAbnormal: boolean;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
}

const LabTrendsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdFromQuery = searchParams.get('patientId');
  const testNameFromQuery = searchParams.get('testName');

  const [selectedPatient, setSelectedPatient] = useState<string>(patientIdFromQuery || '');
  const [selectedTest, setSelectedTest] = useState<string>(testNameFromQuery || '');
  const [dateRange, setDateRange] = useState<string>('6months');
  const [showReferenceRange, setShowReferenceRange] = useState(true);

  // Fetch patients
  const { data: patientsData } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => {
      const response = await api.get('/patients', { params: { limit: 1000 } });
      return response.data.data.patients;
    },
  });

  const patients: Patient[] = patientsData || [];

  // Fetch available tests for selected patient
  const { data: testsData } = useQuery({
    queryKey: ['patient-tests', selectedPatient],
    queryFn: async () => {
      const response = await api.get(`/laboratory/results/patient/${selectedPatient}/tests`);
      return response.data.data;
    },
    enabled: !!selectedPatient,
  });

  const availableTests: string[] = testsData || [];

  // Fetch trend data
  const { data: trendData, isLoading, refetch } = useQuery({
    queryKey: ['lab-trends', selectedPatient, selectedTest, dateRange],
    queryFn: async () => {
      const endDate = new Date();
      let startDate = new Date();

      switch (dateRange) {
        case '1month':
          startDate = subMonths(endDate, 1);
          break;
        case '3months':
          startDate = subMonths(endDate, 3);
          break;
        case '6months':
          startDate = subMonths(endDate, 6);
          break;
        case '1year':
          startDate = subYears(endDate, 1);
          break;
        case '2years':
          startDate = subYears(endDate, 2);
          break;
        default:
          startDate = subMonths(endDate, 6);
      }

      const response = await api.get('/laboratory/results/trends', {
        params: {
          patientId: selectedPatient,
          testName: selectedTest,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
      return response.data.data;
    },
    enabled: !!selectedPatient && !!selectedTest,
  });

  // Transform data for chart
  const chartData: TrendData[] = trendData?.results?.map((result: any) => ({
    date: format(new Date(result.testDate), 'MMM dd, yyyy'),
    value: parseFloat(result.testValue),
    interpretation: result.interpretation,
    isCritical: result.isCritical,
    isAbnormal: result.isAbnormal,
    referenceRangeLow: result.referenceRangeLow,
    referenceRangeHigh: result.referenceRangeHigh,
  })) || [];

  // Get reference range (use first non-null value)
  const referenceRange = chartData.find(d => d.referenceRangeLow !== undefined && d.referenceRangeHigh !== undefined);

  // Calculate trend
  const calculateTrend = () => {
    if (chartData.length < 2) return 'insufficient-data';
    const firstValue = chartData[0].value;
    const lastValue = chartData[chartData.length - 1].value;
    const change = ((lastValue - firstValue) / firstValue) * 100;

    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  };

  const trend = calculateTrend();

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            {data.date}
          </Typography>
          <Typography variant="body2">
            Value: <strong>{data.value}</strong>
          </Typography>
          <Chip
            label={data.interpretation}
            size="small"
            color={data.isCritical ? 'error' : data.isAbnormal ? 'warning' : 'success'}
            sx={{ mt: 1 }}
          />
          {data.referenceRangeLow !== undefined && data.referenceRangeHigh !== undefined && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Reference: {data.referenceRangeLow} - {data.referenceRangeHigh}
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  // Export chart as image
  const handleExportChart = () => {
    // This would require html2canvas or similar library
    // For now, just show a toast
    alert('Export functionality would be implemented with html2canvas library');
  };

  const selectedPatientObj = patients.find(p => p._id === selectedPatient);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate('/laboratory')} color="primary">
            <ArrowBackIcon />
          </IconButton>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              Lab Result Trends
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Visualize lab test trends over time
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={patients}
              getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.patientId})`}
              value={selectedPatientObj || null}
              onChange={(_, newValue) => {
                setSelectedPatient(newValue?._id || '');
                setSelectedTest('');
              }}
              renderInput={(params) => (
                <TextField {...params} label="Select Patient" required />
              )}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Select Test"
              value={selectedTest}
              onChange={(e) => setSelectedTest(e.target.value)}
              disabled={!selectedPatient}
              required
            >
              {availableTests.map((test) => (
                <MenuItem key={test} value={test}>
                  {test}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Date Range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="1month">Last Month</MenuItem>
              <MenuItem value="3months">Last 3 Months</MenuItem>
              <MenuItem value="6months">Last 6 Months</MenuItem>
              <MenuItem value="1year">Last Year</MenuItem>
              <MenuItem value="2years">Last 2 Years</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1, height: '100%', alignItems: 'center' }}>
              <IconButton onClick={() => refetch()} disabled={!selectedPatient || !selectedTest}>
                <RefreshIcon />
              </IconButton>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportChart}
                disabled={!chartData.length}
                fullWidth
              >
                Export
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Trend Summary */}
      {chartData.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  Total Data Points
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {chartData.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  Latest Value
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {chartData[chartData.length - 1]?.value}
                </Typography>
                <Chip
                  label={chartData[chartData.length - 1]?.interpretation}
                  size="small"
                  color={
                    chartData[chartData.length - 1]?.isCritical
                      ? 'error'
                      : chartData[chartData.length - 1]?.isAbnormal
                        ? 'warning'
                        : 'success'
                  }
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  Trend
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <TrendingUpIcon
                    color={
                      trend === 'increasing'
                        ? 'error'
                        : trend === 'decreasing'
                          ? 'success'
                          : 'action'
                    }
                    sx={{
                      transform: trend === 'decreasing' ? 'rotate(180deg)' : 'none',
                    }}
                  />
                  <Typography variant="h6" fontWeight="bold">
                    {trend === 'increasing'
                      ? 'Increasing'
                      : trend === 'decreasing'
                        ? 'Decreasing'
                        : 'Stable'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  Critical Values
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="error">
                  {chartData.filter(d => d.isCritical).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Chart */}
      <Paper sx={{ p: 3 }}>
        {!selectedPatient || !selectedTest ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <DateRangeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select Patient and Test
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a patient and test to view trend visualization
            </Typography>
          </Box>
        ) : isLoading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              Loading trend data...
            </Typography>
          </Box>
        ) : chartData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Alert severity="info">
              No data available for the selected patient, test, and date range.
            </Alert>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                {selectedTest} Trend - {selectedPatientObj?.firstName} {selectedPatientObj?.lastName}
              </Typography>
              <Button
                size="small"
                onClick={() => setShowReferenceRange(!showReferenceRange)}
              >
                {showReferenceRange ? 'Hide' : 'Show'} Reference Range
              </Button>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Reference Range Area */}
                {showReferenceRange && referenceRange && (
                  <>
                    <ReferenceLine
                      y={referenceRange.referenceRangeLow}
                      stroke="#ff9800"
                      strokeDasharray="3 3"
                      label={{ value: 'Low', position: 'right', fill: '#ff9800' }}
                    />
                    <ReferenceLine
                      y={referenceRange.referenceRangeHigh}
                      stroke="#ff9800"
                      strokeDasharray="3 3"
                      label={{ value: 'High', position: 'right', fill: '#ff9800' }}
                    />
                    <Area
                      type="monotone"
                      dataKey={() => referenceRange.referenceRangeHigh}
                      fill="#4caf50"
                      fillOpacity={0.1}
                      stroke="none"
                      name="Normal Range"
                    />
                  </>
                )}

                {/* Main trend line */}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1976d2"
                  strokeWidth={3}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={
                          payload.isCritical
                            ? '#d32f2f'
                            : payload.isAbnormal
                              ? '#ff9800'
                              : '#4caf50'
                        }
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 8 }}
                  name={selectedTest}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <Box sx={{ mt: 3, display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#4caf50' }} />
                <Typography variant="caption">Normal</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#ff9800' }} />
                <Typography variant="caption">Abnormal</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#d32f2f' }} />
                <Typography variant="caption">Critical</Typography>
              </Box>
              {showReferenceRange && referenceRange && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      bgcolor: '#4caf50',
                      opacity: 0.2,
                    }}
                  />
                  <Typography variant="caption">Reference Range</Typography>
                </Box>
              )}
            </Box>

            {/* Data Table */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Data Points
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1}>
                {chartData.map((data, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {data.date}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {data.value}
                        </Typography>
                        <Chip
                          label={data.interpretation}
                          size="small"
                          color={data.isCritical ? 'error' : data.isAbnormal ? 'warning' : 'success'}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default LabTrendsPage;

