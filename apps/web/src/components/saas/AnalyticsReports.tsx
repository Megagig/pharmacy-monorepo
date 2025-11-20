import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as AttachMoneyIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  DateRange as DateRangeIcon,
  PictureAsPdf as PictureAsPdfIcon,
  TableChart as TableChartIcon,
  InsertChart as InsertChartIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useSaasSettings } from '../../queries/useSaasSettings';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

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
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface SubscriptionAnalytics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  ltv: number; // Lifetime Value
  cac: number; // Customer Acquisition Cost
  churnRate: number;
  upgradeRate: number;
  downgradeRate: number;
  planDistribution: PlanDistribution[];
  revenueByPlan: RevenueByPlan[];
  growthTrend: GrowthTrend[];
}

interface PlanDistribution {
  planName: string;
  count: number;
  percentage: number;
  revenue: number;
}

interface RevenueByPlan {
  planName: string;
  revenue: number;
  growth: number;
}

interface GrowthTrend {
  month: string;
  mrr: number;
  subscribers: number;
  churn: number;
}

interface PharmacyUsageReport {
  pharmacyId: string;
  pharmacyName: string;
  subscriptionPlan: string;
  prescriptionsProcessed: number;
  diagnosticsPerformed: number;
  patientsManaged: number;
  activeUsers: number;
  lastActivity: string;
  clinicalOutcomes: {
    interventions: number;
    adherenceImprovement: number;
    costSavings: number;
  };
}

interface ExportOptions {
  format: 'pdf' | 'csv' | 'excel';
  reportType: 'subscription' | 'pharmacy' | 'clinical' | 'financial';
  dateRange: {
    start: string;
    end: string;
  };
  includeCharts: boolean;
  scheduledDelivery?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

const AnalyticsReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('30d');
  const [subscriptionAnalytics, setSubscriptionAnalytics] = useState<SubscriptionAnalytics | null>(null);
  const [pharmacyReports, setPharmacyReports] = useState<PharmacyUsageReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    reportType: 'subscription',
    dateRange: {
      start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    },
    includeCharts: true,
  });
  const [exporting, setExporting] = useState(false);

  const { 
    getSubscriptionAnalytics, 
    getPharmacyUsageReports, 
    getClinicalOutcomesReport,
    exportReport,
    scheduleReport 
  } = useSaasSettings();

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, activeTab]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 0) {
        // Load subscription analytics
        const response = await getSubscriptionAnalytics({ timeRange });
        if (response.success) {
          setSubscriptionAnalytics(response.data);
        }
      } else if (activeTab === 1) {
        // Load pharmacy usage reports
        const response = await getPharmacyUsageReports({ timeRange });
        if (response.success) {
          setPharmacyReports(response.data.reports);
        }
      }
    } catch (err) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await exportReport(exportOptions);
      
      if (response.success) {
        // Create download link
        const blob = new Blob([response.data], { 
          type: getContentType(exportOptions.format) 
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.${exportOptions.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setExportDialogOpen(false);
      }
    } catch (err) {
      setError('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const getContentType = (format: string) => {
    switch (format) {
      case 'pdf': return 'application/pdf';
      case 'csv': return 'text/csv';
      case 'excel': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default: return 'application/octet-stream';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUpIcon color="success" />;
    if (growth < 0) return <TrendingDownIcon color="error" />;
    return null;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'success';
    if (growth < 0) return 'error';
    return 'default';
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ boxShadow: 3, borderRadius: 2 }}>
        <CardContent>
          {/* Header with Controls */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 2,
            mb: 3 
          }}>
            <Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontWeight: 700,
                  color: 'primary.main'
                }}
              >
                <AnalyticsIcon sx={{ fontSize: 32 }} />
                Analytics & Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Comprehensive insights into your subscription and workspace metrics
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              gap: 1.5, 
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  label="Time Range"
                  startAdornment={<DateRangeIcon sx={{ mr: 1, fontSize: 20, color: 'action.active' }} />}
                >
                  <MenuItem value="7d">Last 7 days</MenuItem>
                  <MenuItem value="30d">Last 30 days</MenuItem>
                  <MenuItem value="90d">Last 90 days</MenuItem>
                  <MenuItem value="1y">Last year</MenuItem>
                </Select>
              </FormControl>
              
              <Tooltip title="Export Report">
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => setExportDialogOpen(true)}
                  sx={{ minWidth: { xs: 'auto', sm: 'auto' } }}
                >
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Export</Box>
                </Button>
              </Tooltip>
              
              <Tooltip title="Refresh Data">
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={loadAnalyticsData}
                  disabled={loading}
                  sx={{ minWidth: { xs: 'auto', sm: 'auto' } }}
                >
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Refresh</Box>
                </Button>
              </Tooltip>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                icon={<AttachMoneyIcon />} 
                label="Subscription Analytics" 
                id="analytics-tab-0"
                aria-controls="analytics-tabpanel-0"
                sx={{ minHeight: 72 }}
              />
              <Tab 
                icon={<BusinessIcon />} 
                label="Workspace Usage" 
                id="analytics-tab-1"
                aria-controls="analytics-tabpanel-1"
                sx={{ minHeight: 72 }}
              />
              <Tab 
                icon={<AssessmentIcon />} 
                label="Clinical Impact" 
                id="analytics-tab-2"
                aria-controls="analytics-tabpanel-2"
                sx={{ minHeight: 72 }}
              />
            </Tabs>
          </Box>

          {/* Subscription Analytics Tab */}
          <TabPanel value={activeTab} index={0}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : subscriptionAnalytics ? (
              <Grid container spacing={3}>
                {/* Key Metrics Cards */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      height: '100%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                            Monthly Recurring Revenue
                          </Typography>
                          <AttachMoneyIcon sx={{ fontSize: 32, opacity: 0.8 }} />
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                          {formatCurrency(subscriptionAnalytics.mrr)}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Active subscriptions revenue
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      height: '100%',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                            Annual Recurring Revenue
                          </Typography>
                          <TrendingUpIcon sx={{ fontSize: 32, opacity: 0.8 }} />
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                          {formatCurrency(subscriptionAnalytics.arr)}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Projected annual revenue
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      height: '100%',
                      background: subscriptionAnalytics.churnRate > 0.05 
                        ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                        : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                      color: 'white',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                            Churn Rate
                          </Typography>
                          {getGrowthIcon(-subscriptionAnalytics.churnRate)}
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                          {formatPercentage(subscriptionAnalytics.churnRate)}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          {subscriptionAnalytics.churnRate > 0.05 ? 'Needs attention' : 'Healthy retention'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      height: '100%',
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      color: 'white',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                            Customer LTV
                          </Typography>
                          <PeopleIcon sx={{ fontSize: 32, opacity: 0.8 }} />
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                          {formatCurrency(subscriptionAnalytics.ltv)}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Average lifetime value
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Plan Distribution */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                        Subscription Plan Distribution
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Subscribers</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Percentage</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Revenue</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {subscriptionAnalytics.planDistribution.map((plan, index) => (
                              <TableRow 
                                key={plan.planName}
                                sx={{ 
                                  '&:hover': { bgcolor: 'action.hover' },
                                  transition: 'background-color 0.2s'
                                }}
                              >
                                <TableCell>
                                  <Chip 
                                    label={plan.planName} 
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight={500}>
                                    {plan.count}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={plan.percentage}
                                      sx={{ 
                                        width: 80, 
                                        height: 8, 
                                        borderRadius: 4,
                                        bgcolor: 'action.hover'
                                      }}
                                    />
                                    <Typography variant="body2" fontWeight={500}>
                                      {formatPercentage(plan.percentage / 100)}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight={600} color="primary">
                                    {formatCurrency(plan.revenue)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Revenue by Plan */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                        Revenue Growth by Plan
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Revenue</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Growth</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {subscriptionAnalytics.revenueByPlan.map((plan) => (
                              <TableRow 
                                key={plan.planName}
                                sx={{ 
                                  '&:hover': { bgcolor: 'action.hover' },
                                  transition: 'background-color 0.2s'
                                }}
                              >
                                <TableCell>
                                  <Chip 
                                    label={plan.planName} 
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight={600} color="primary">
                                    {formatCurrency(plan.revenue)}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                    {getGrowthIcon(plan.growth)}
                                    <Chip
                                      label={formatPercentage(Math.abs(plan.growth))}
                                      color={getGrowthColor(plan.growth) as any}
                                      size="small"
                                      sx={{ fontWeight: 600 }}
                                    />
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            ) : (
              <Typography>No subscription analytics data available</Typography>
            )}
          </TabPanel>

          {/* Workspace Usage Tab */}
          <TabPanel value={activeTab} index={1}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                  Workspace Activity & Engagement
                </Typography>
                <TableContainer component={Paper} sx={{ boxShadow: 2, borderRadius: 2 }}>
                  <Table>
                    <TableHead sx={{ bgcolor: 'primary.main' }}>
                      <TableRow>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Workspace</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Plan</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Prescriptions</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Diagnostics</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Patients</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Active Users</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Interventions</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Last Activity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pharmacyReports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                            <Typography variant="body1" color="text.secondary">
                              No workspace usage data available for the selected time range
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        pharmacyReports.map((pharmacy, index) => (
                          <TableRow 
                            key={pharmacy.pharmacyId}
                            sx={{ 
                              '&:hover': { bgcolor: 'action.hover' },
                              transition: 'background-color 0.2s',
                              bgcolor: index % 2 === 0 ? 'background.default' : 'background.paper'
                            }}
                          >
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {pharmacy.pharmacyName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {pharmacy.pharmacyId.slice(-8)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={pharmacy.subscriptionPlan}
                                color="primary"
                                size="small"
                                sx={{ fontWeight: 500 }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500}>
                                {pharmacy.prescriptionsProcessed.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500}>
                                {pharmacy.diagnosticsPerformed.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500}>
                                {pharmacy.patientsManaged.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={pharmacy.activeUsers} 
                                size="small" 
                                color="success"
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500} color="primary">
                                {pharmacy.clinicalOutcomes.interventions}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {format(new Date(pharmacy.lastActivity), 'MMM dd, yyyy')}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </TabPanel>

          {/* Clinical Impact Tab */}
          <TabPanel value={activeTab} index={2}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Clinical Outcomes & Impact Metrics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    height: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                          Total Interventions
                        </Typography>
                        <AssessmentIcon sx={{ fontSize: 32, opacity: 0.8 }} />
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                        {pharmacyReports.reduce((sum, p) => sum + p.clinicalOutcomes.interventions, 0).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Clinical interventions performed
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    height: '100%',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                          Adherence Improvement
                        </Typography>
                        <TrendingUpIcon sx={{ fontSize: 32, opacity: 0.8 }} />
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                        {formatPercentage(
                          pharmacyReports.reduce((sum, p) => sum + p.clinicalOutcomes.adherenceImprovement, 0) / 
                          Math.max(pharmacyReports.length, 1) / 100
                        )}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Average medication adherence gain
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    height: '100%',
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    color: 'white',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                          Cost Savings
                        </Typography>
                        <AttachMoneyIcon sx={{ fontSize: 32, opacity: 0.8 }} />
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                        {formatCurrency(
                          pharmacyReports.reduce((sum, p) => sum + p.clinicalOutcomes.costSavings, 0)
                        )}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Total healthcare cost savings
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Detailed breakdown by workspace */}
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Clinical Impact by Workspace
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Workspace</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Interventions</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Adherence Improvement</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Cost Savings</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pharmacyReports.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                <Typography variant="body1" color="text.secondary">
                                  No clinical impact data available
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            pharmacyReports.map((pharmacy, index) => (
                              <TableRow 
                                key={pharmacy.pharmacyId}
                                sx={{ 
                                  '&:hover': { bgcolor: 'action.hover' },
                                  transition: 'background-color 0.2s'
                                }}
                              >
                                <TableCell>
                                  <Typography variant="body2" fontWeight={600}>
                                    {pharmacy.pharmacyName}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={pharmacy.clinicalOutcomes.interventions.toLocaleString()} 
                                    size="small"
                                    color="primary"
                                    sx={{ fontWeight: 600 }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight={500} color="success.main">
                                    {formatPercentage(pharmacy.clinicalOutcomes.adherenceImprovement / 100)}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight={600} color="primary">
                                    {formatCurrency(pharmacy.clinicalOutcomes.costSavings)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Analytics Report</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
                  label="Format"
                >
                  <MenuItem value="pdf">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PictureAsPdfIcon />
                      PDF Report
                    </Box>
                  </MenuItem>
                  <MenuItem value="csv">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TableChartIcon />
                      CSV Data
                    </Box>
                  </MenuItem>
                  <MenuItem value="excel">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InsertChartIcon />
                      Excel Workbook
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Report Type</InputLabel>
                <Select
                  value={exportOptions.reportType}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, reportType: e.target.value as any }))}
                  label="Report Type"
                >
                  <MenuItem value="subscription">Subscription Analytics</MenuItem>
                  <MenuItem value="pharmacy">Pharmacy Usage</MenuItem>
                  <MenuItem value="clinical">Clinical Outcomes</MenuItem>
                  <MenuItem value="financial">Financial Summary</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={exportOptions.dateRange.start}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, start: e.target.value }
                }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={exportOptions.dateRange.end}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, end: e.target.value }
                }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={exporting}
            startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
          >
            {exporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnalyticsReports;