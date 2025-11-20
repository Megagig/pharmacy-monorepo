import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface ComplianceMetrics {
  totalActivities: number;
  highRiskActivities: number;
  recentActivities: number;
  complianceSummary: ComplianceCategory[];
  dateRange: {
    start: string;
    end: string;
  };
  generatedAt: string;
}

interface ComplianceCategory {
  _id: {
    complianceCategory: string;
    riskLevel: string;
    success: boolean;
  };
  count: number;
  avgDuration: number;
  actions: string[];
}

interface HighRiskActivity {
  _id: string;
  action: string;
  timestamp: string;
  userId: {
    firstName: string;
    lastName: string;
    role: string;
  };
  riskLevel: string;
  complianceCategory: string;
  details: {
    conversationId?: string;
    patientId?: string;
    fileName?: string;
  };
}

interface ComplianceDashboardProps {
  height?: string;
  refreshInterval?: number;
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  height = '800px',
  refreshInterval = 300000, // 5 minutes
}) => {
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [highRiskActivities, setHighRiskActivities] = useState<
    HighRiskActivity[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  });
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  // Fetch compliance data
  const fetchComplianceData = async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
      });

      const [metricsResponse, highRiskResponse] = await Promise.all([
        fetch(`/api/communication/audit/statistics?${queryParams}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }),
        fetch(`/api/communication/audit/high-risk?${queryParams}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }),
      ]);

      if (!metricsResponse.ok || !highRiskResponse.ok) {
        throw new Error('Failed to fetch compliance data');
      }

      const [metricsData, highRiskData] = await Promise.all([
        metricsResponse.json(),
        highRiskResponse.json(),
      ]);

      setMetrics(metricsData.data);
      setHighRiskActivities(highRiskData.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch compliance data'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplianceData();
  }, [dateRange]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchComplianceData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, dateRange]);

  // Handle period change
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const days = parseInt(period);
    setDateRange({
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    });
  };

  // Calculate compliance score
  const calculateComplianceScore = () => {
    if (!metrics || metrics.totalActivities === 0) return 100;
    const failureRate = metrics.highRiskActivities / metrics.totalActivities;
    return Math.max(0, Math.round((1 - failureRate) * 100));
  };

  // Prepare chart data
  const prepareComplianceByCategory = () => {
    if (!metrics) return [];

    const categoryMap = new Map<
      string,
      { success: number; failed: number; total: number }
    >();

    metrics.complianceSummary.forEach((item) => {
      const category = item._id.complianceCategory;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { success: 0, failed: 0, total: 0 });
      }

      const data = categoryMap.get(category)!;
      data.total += item.count;
      if (item._id.success) {
        data.success += item.count;
      } else {
        data.failed += item.count;
      }
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category: category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      success: data.success,
      failed: data.failed,
      total: data.total,
      successRate:
        data.total > 0 ? Math.round((data.success / data.total) * 100) : 100,
    }));
  };

  const prepareRiskLevelData = () => {
    if (!metrics) return [];

    const riskMap = new Map<string, number>();
    metrics.complianceSummary.forEach((item) => {
      const risk = item._id.riskLevel;
      riskMap.set(risk, (riskMap.get(risk) || 0) + item.count);
    });

    const colors = {
      low: '#4caf50',
      medium: '#ff9800',
      high: '#f44336',
      critical: '#9c27b0',
    };

    return Array.from(riskMap.entries()).map(([risk, count]) => ({
      name: risk.charAt(0).toUpperCase() + risk.slice(1),
      value: count,
      color: colors[risk as keyof typeof colors] || '#757575',
    }));
  };

  // Export compliance report
  const handleExportReport = async () => {
    try {
      const queryParams = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        format: 'json',
      });

      const response = await fetch(
        `/api/communication/audit/compliance-report?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export compliance report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance_report_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    }
  };

  const complianceScore = calculateComplianceScore();
  const categoryData = prepareComplianceByCategory();
  const riskLevelData = prepareRiskLevelData();

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ height, p: 2, overflow: 'auto' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Typography
            variant="h5"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <AssessmentIcon />
            Compliance Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Period</InputLabel>
              <Select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                label="Period"
              >
                <MenuItem value="7">Last 7 days</MenuItem>
                <MenuItem value="30">Last 30 days</MenuItem>
                <MenuItem value="90">Last 90 days</MenuItem>
                <MenuItem value="365">Last year</MenuItem>
              </Select>
            </FormControl>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchComplianceData}
              disabled={loading}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExportReport}
              variant="outlined"
              size="small"
            >
              Export Report
            </Button>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Dashboard Content */}
        {!loading && metrics && (
          <>
            {/* Key Metrics Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <SecurityIcon color="primary" />
                      <Typography variant="h6">Compliance Score</Typography>
                    </Box>
                    <Typography
                      variant="h3"
                      color={
                        complianceScore >= 90
                          ? 'success.main'
                          : complianceScore >= 70
                          ? 'warning.main'
                          : 'error.main'
                      }
                    >
                      {complianceScore}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={complianceScore}
                      color={
                        complianceScore >= 90
                          ? 'success'
                          : complianceScore >= 70
                          ? 'warning'
                          : 'error'
                      }
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <TrendingUpIcon color="primary" />
                      <Typography variant="h6">Total Activities</Typography>
                    </Box>
                    <Typography variant="h3">
                      {metrics.totalActivities.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      In selected period
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <WarningIcon color="warning" />
                      <Typography variant="h6">High Risk</Typography>
                    </Box>
                    <Typography variant="h3" color="warning.main">
                      {metrics.highRiskActivities}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Activities requiring attention
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <CheckCircleIcon color="success" />
                      <Typography variant="h6">Recent Activity</Typography>
                    </Box>
                    <Typography variant="h3" color="success.main">
                      {metrics.recentActivities}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last 24 hours
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Charts Row */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* Risk Level Distribution */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Risk Level Distribution" />
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={riskLevelData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {riskLevelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Compliance by Category */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Success Rate by Category" />
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={categoryData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="category"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          fontSize={12}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="success"
                          stackId="a"
                          fill="#4caf50"
                          name="Success"
                        />
                        <Bar
                          dataKey="failed"
                          stackId="a"
                          fill="#f44336"
                          name="Failed"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Compliance Categories Table */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={8}>
                <Card>
                  <CardHeader title="Compliance Categories Overview" />
                  <CardContent>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell align="right">Success</TableCell>
                            <TableCell align="right">Failed</TableCell>
                            <TableCell align="right">Success Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {categoryData.map((category) => (
                            <TableRow key={category.category}>
                              <TableCell>{category.category}</TableCell>
                              <TableCell align="right">
                                {category.total}
                              </TableCell>
                              <TableCell align="right">
                                <Typography color="success.main">
                                  {category.success}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography color="error.main">
                                  {category.failed}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  size="small"
                                  label={`${category.successRate}%`}
                                  color={
                                    category.successRate >= 95
                                      ? 'success'
                                      : category.successRate >= 85
                                      ? 'warning'
                                      : 'error'
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* High Risk Activities */}
              <Grid item xs={12} md={4}>
                <Card>
                  <CardHeader
                    title="Recent High Risk Activities"
                    action={
                      <Chip
                        size="small"
                        label={highRiskActivities.length}
                        color={
                          highRiskActivities.length === 0
                            ? 'success'
                            : 'warning'
                        }
                      />
                    }
                  />
                  <CardContent>
                    {highRiskActivities.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <CheckCircleIcon
                          color="success"
                          sx={{ fontSize: 48, mb: 1 }}
                        />
                        <Typography color="text.secondary">
                          No high-risk activities detected
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {highRiskActivities.slice(0, 10).map((activity) => (
                          <Box
                            key={activity._id}
                            sx={{
                              mb: 2,
                              p: 1,
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 1,
                              }}
                            >
                              <Typography variant="body2" fontWeight="medium">
                                {activity.action.replace(/_/g, ' ')}
                              </Typography>
                              <Chip
                                size="small"
                                label={activity.riskLevel}
                                color={
                                  activity.riskLevel === 'critical'
                                    ? 'error'
                                    : 'warning'
                                }
                              />
                            </Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {activity.userId.firstName}{' '}
                              {activity.userId.lastName} •{' '}
                              {format(
                                new Date(activity.timestamp),
                                'MMM dd, HH:mm'
                              )}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Report Summary */}
            <Card>
              <CardHeader title="Report Summary" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Report Period
                    </Typography>
                    <Typography variant="body2">
                      {format(dateRange.start, 'PPP')} -{' '}
                      {format(dateRange.end, 'PPP')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Generated: {format(new Date(metrics.generatedAt), 'PPpp')}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Compliance Status
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {complianceScore >= 90 ? (
                        <CheckCircleIcon color="success" />
                      ) : complianceScore >= 70 ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                      <Typography>
                        {complianceScore >= 90
                          ? 'Excellent'
                          : complianceScore >= 70
                          ? 'Good'
                          : 'Needs Attention'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default ComplianceDashboard;
