import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Tooltip,
  Stack,
  Badge,
  Fade,
  Grow,
  Slide,
  useTheme,
  alpha,
  Container,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Medication as MedicationIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Timeline as TimelineIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  ShowChart as ShowChartIcon,
  Assessment as AssessmentIcon,
  LocalPharmacy as PharmacyIcon,
  Security as SecurityIcon,
  AccountBalance as AccountBalanceIcon,
  Insights as InsightsIcon,
  Speed as SpeedIcon,
  Star as StarIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Scatter,
  ScatterChart,
  Treemap,
} from 'recharts';
import {
  useAdherenceAnalytics,
  usePrescriptionPatternAnalytics,
  useInteractionAnalytics,
  useMedicationCostAnalytics,
  usePatientMedicationSummary,
} from '../../queries/medicationAnalyticsQueries';

interface EnhancedMedicationAnalyticsProps {
  patientId: string;
}

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
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const EnhancedMedicationAnalytics: React.FC<EnhancedMedicationAnalyticsProps> = ({
  patientId,
}) => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [adherencePeriod, setAdherencePeriod] = useState('6months');

  // Fetch analytics data
  const {
    data: adherenceData,
    isLoading: adherenceLoading,
    error: adherenceError,
    refetch: refetchAdherence,
  } = useAdherenceAnalytics(patientId, adherencePeriod);

  const {
    data: prescriptionData,
    isLoading: prescriptionLoading,
    error: prescriptionError,
  } = usePrescriptionPatternAnalytics(patientId);

  const {
    data: interactionData,
    isLoading: interactionLoading,
    error: interactionError,
  } = useInteractionAnalytics(patientId);

  const {
    data: costData,
    isLoading: costLoading,
    error: costError,
  } = useMedicationCostAnalytics(patientId);

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = usePatientMedicationSummary(patientId);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handlePeriodChange = (period: string) => {
    setAdherencePeriod(period);
  };

  // Enhanced color schemes
  const colorSchemes = {
    primary: ['#1976d2', '#42a5f5', '#90caf9', '#e3f2fd'],
    success: ['#2e7d32', '#4caf50', '#81c784', '#c8e6c9'],
    warning: ['#ed6c02', '#ff9800', '#ffb74d', '#ffe0b2'],
    error: ['#d32f2f', '#f44336', '#e57373', '#ffcdd2'],
    info: ['#0288d1', '#03a9f4', '#4fc3f7', '#b3e5fc'],
    gradient: {
      primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      warning: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      error: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
    }
  };

  // Render trend icon with enhanced styling
  const renderTrendIcon = (trend: 'up' | 'down' | 'stable' | 'increasing' | 'decreasing') => {
    const iconProps = { fontSize: 'small' as const, sx: { mr: 0.5 } };
    switch (trend) {
      case 'up':
      case 'increasing':
        return <TrendingUpIcon {...iconProps} color="success" />;
      case 'down':
      case 'decreasing':
        return <TrendingDownIcon {...iconProps} color="error" />;
      default:
        return <TrendingFlatIcon {...iconProps} color="info" />;
    }
  };

  // Enhanced Summary Cards Component
  const EnhancedSummaryCards = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Grow in timeout={500}>
          <Card 
            elevation={0} 
            sx={{ 
              background: colorSchemes.gradient.primary,
              color: 'white',
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
              }
            }}
          >
            <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 56, height: 56 }}>
                  <MedicationIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {summaryData?.activeCount || 0}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Active Medications
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={summaryData?.activeCount ? Math.min((summaryData.activeCount / 10) * 100, 100) : 0}
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'rgba(255,255,255,0.8)'
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grow>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Grow in timeout={700}>
          <Card 
            elevation={0} 
            sx={{ 
              background: colorSchemes.gradient.success,
              color: 'white',
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 56, height: 56 }}>
                  <SpeedIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {summaryData?.adherenceRate || 0}%
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Adherence Rate
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {renderTrendIcon(summaryData?.adherenceTrend || 'stable')}
                <Typography variant="body2" sx={{ opacity: 0.9, textTransform: 'capitalize' }}>
                  {summaryData?.adherenceTrend || 'stable'} trend
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grow>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Grow in timeout={900}>
          <Card 
            elevation={0} 
            sx={{ 
              background: colorSchemes.gradient.warning,
              color: 'white',
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 56, height: 56 }}>
                  <SecurityIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {summaryData?.interactionCount || 0}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Interactions
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={summaryData?.interactionCount === 0 ? 'All Clear' : 'Needs Review'}
                sx={{
                  bgcolor: summaryData?.interactionCount === 0 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 152, 0, 0.8)',
                  color: 'white',
                  fontWeight: 'bold'
                }}
                size="small"
              />
            </CardContent>
          </Card>
        </Grow>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Grow in timeout={1100}>
          <Card 
            elevation={0} 
            sx={{ 
              background: colorSchemes.gradient.error,
              color: 'white',
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 56, height: 56 }}>
                  <AccountBalanceIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5, fontSize: '1.8rem' }}>
                    {summaryData?.costAnalysis?.formattedMonthlyCost || '₦0.00'}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Monthly Cost
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Complexity Score
                </Typography>
                <Chip
                  label={`${summaryData?.medicationComplexity?.complexityScore || 0}/100`}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grow>
      </Grid>
    </Grid>
  );

  if (summaryLoading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
            Loading Analytics Dashboard...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (summaryError) {
    return (
      <Container maxWidth="xl">
        <Alert severity="error" sx={{ m: 2, borderRadius: 3 }}>
          <Typography variant="h6">Error Loading Analytics</Typography>
          Unable to load medication analytics data. Please try refreshing the page.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Enhanced Header */}
      <Fade in timeout={300}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar 
                sx={{ 
                  bgcolor: theme.palette.primary.main, 
                  mr: 2, 
                  width: 56, 
                  height: 56,
                  background: colorSchemes.gradient.primary
                }}
              >
                <InsightsIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography variant="h3" component="h1" fontWeight="bold" sx={{ mb: 0.5 }}>
                  Medication Analytics
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Comprehensive insights and data-driven medication management
                </Typography>
              </Box>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh All Data">
                <IconButton 
                  onClick={() => refetchAdherence()}
                  sx={{ 
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Analytics Report">
                <IconButton 
                  sx={{ 
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.2) }
                  }}
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Box>
      </Fade>

      {/* Enhanced Summary Cards */}
      <EnhancedSummaryCards />

      {/* Enhanced Analytics Tabs */}
      <Paper 
        elevation={0} 
        sx={{ 
          border: '1px solid', 
          borderColor: 'divider', 
          borderRadius: 4,
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
        }}
      >
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ 
              px: 3,
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem',
                '&.Mui-selected': {
                  color: 'white',
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'white',
                height: 3,
                borderRadius: '3px 3px 0 0'
              }
            }}
          >
            <Tab 
              label="Adherence Trends" 
              icon={<TimelineIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Prescription Patterns" 
              icon={<BarChartIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Drug Interactions" 
              icon={<SecurityIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Cost Analysis" 
              icon={<AccountBalanceIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Enhanced Adherence Analytics Tab */}
        <TabPanel value={currentTab} index={0}>
          <Box sx={{ px: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Box>
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                  Adherence Trends Analysis
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Track medication compliance patterns and identify improvement opportunities
                </Typography>
              </Box>
              <ButtonGroup 
                size="medium" 
                sx={{ 
                  '& .MuiButton-root': {
                    borderRadius: 3,
                    px: 3,
                    fontWeight: 600
                  }
                }}
              >
                <Button
                  variant={adherencePeriod === '3months' ? 'contained' : 'outlined'}
                  onClick={() => handlePeriodChange('3months')}
                >
                  3 Months
                </Button>
                <Button
                  variant={adherencePeriod === '6months' ? 'contained' : 'outlined'}
                  onClick={() => handlePeriodChange('6months')}
                >
                  6 Months
                </Button>
                <Button
                  variant={adherencePeriod === '1year' ? 'contained' : 'outlined'}
                  onClick={() => handlePeriodChange('1year')}
                >
                  1 Year
                </Button>
              </ButtonGroup>
            </Box>

            {adherenceLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={60} />
              </Box>
            ) : adherenceError ? (
              <Alert severity="error" sx={{ borderRadius: 3 }}>
                Failed to load adherence data. Please try again.
              </Alert>
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} lg={8}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <ShowChartIcon sx={{ mr: 2, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Monthly Adherence Trend
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={adherenceData?.monthlyAdherence || []}>
                          <defs>
                            <linearGradient id="adherenceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#667eea" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#764ba2" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis 
                            dataKey="month" 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="adherence"
                            stroke="#667eea"
                            fillOpacity={1}
                            fill="url(#adherenceGradient)"
                            strokeWidth={4}
                            dot={{ fill: '#667eea', strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8, stroke: '#667eea', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Stack spacing={3}>
                    <Card 
                      elevation={0} 
                      sx={{ 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 3,
                        background: colorSchemes.gradient.success
                      }}
                    >
                      <CardContent sx={{ p: 3, color: 'white' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <ScheduleIcon sx={{ mr: 2 }} />
                          <Typography variant="h6" fontWeight="bold">
                            Adherence by Time
                          </Typography>
                        </Box>
                        <ResponsiveContainer width="100%" height={200}>
                          <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="30%"
                            outerRadius="80%"
                            data={adherenceData?.adherenceByTimeOfDay || []}
                          >
                            <RadialBar 
                              dataKey="adherence" 
                              cornerRadius={10} 
                              fill="rgba(255,255,255,0.8)" 
                            />
                            <RechartsTooltip 
                              contentStyle={{
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white'
                              }}
                            />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card 
                      elevation={0} 
                      sx={{ 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 3,
                        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                          <MoneyIcon sx={{ mr: 2, color: 'success.main' }} />
                          <Typography variant="h6" fontWeight="bold">
                            Cost Impact
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h3" color="success.main" fontWeight="bold" sx={{ mb: 1 }}>
                            {adherenceData?.costsData?.formattedSaved || '₦0.00'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Saved through adherence
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          <Box sx={{ 
                            p: 2, 
                            bgcolor: alpha(theme.palette.info.main, 0.1), 
                            borderRadius: 2 
                          }}>
                            <Typography variant="body1" fontWeight="medium" color="info.main">
                              Potential Savings
                            </Typography>
                            <Typography variant="h5" color="info.main" fontWeight="bold">
                              {adherenceData?.costsData?.formattedPotential || '₦0.00'}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Stack>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Enhanced Prescription Patterns Tab */}
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ px: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                Prescription Pattern Analysis
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Analyze prescription trends, categories, and prescriber patterns
              </Typography>
            </Box>

            {prescriptionLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={60} />
              </Box>
            ) : prescriptionError ? (
              <Alert severity="error" sx={{ borderRadius: 3 }}>
                Failed to load prescription data. Please try again.
              </Alert>
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <PieChartIcon sx={{ mr: 2, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Medications by Category
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={prescriptionData?.medicationsByCategory || []}
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="count"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {(prescriptionData?.medicationsByCategory || []).map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={colorSchemes.primary[index % colorSchemes.primary.length]} 
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <BarChartIcon sx={{ mr: 2, color: 'success.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Prescription Frequency
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={prescriptionData?.prescriptionFrequency || []}>
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4facfe" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.6} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis 
                            dataKey="month" 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            }}
                          />
                          <Bar 
                            dataKey="count" 
                            fill="url(#barGradient)" 
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <PersonIcon sx={{ mr: 2, color: 'info.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Top Prescribers
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        {(prescriptionData?.topPrescribers || []).map((prescriber, index) => (
                          <Grid item xs={12} sm={6} md={4} key={index}>
                            <Card 
                              elevation={0}
                              sx={{ 
                                p: 2, 
                                border: '1px solid', 
                                borderColor: 'divider',
                                borderRadius: 2,
                                background: alpha(colorSchemes.primary[index % colorSchemes.primary.length], 0.1)
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Avatar 
                                  sx={{ 
                                    bgcolor: colorSchemes.primary[index % colorSchemes.primary.length],
                                    mr: 2,
                                    width: 48,
                                    height: 48
                                  }}
                                >
                                  <PersonIcon />
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    {prescriber.prescriber}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {prescriber.count} prescriptions
                                  </Typography>
                                </Box>
                                <Chip
                                  label={prescriber.count}
                                  color="primary"
                                  variant="outlined"
                                  sx={{ fontWeight: 'bold' }}
                                />
                              </Box>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Enhanced Drug Interactions Tab */}
        <TabPanel value={currentTab} index={2}>
          <Box sx={{ px: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                Drug Interaction Analysis
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Monitor and analyze potential drug interactions for patient safety
              </Typography>
            </Box>

            {interactionLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={60} />
              </Box>
            ) : interactionError ? (
              <Alert severity="error" sx={{ borderRadius: 3 }}>
                Failed to load interaction data. Please try again.
              </Alert>
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <SecurityIcon sx={{ mr: 2, color: 'warning.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Severity Distribution
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={interactionData?.severityDistribution || []}
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="count"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {(interactionData?.severityDistribution || []).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.severity === 'Severe'
                                    ? colorSchemes.error[0]
                                    : entry.severity === 'Moderate'
                                    ? colorSchemes.warning[0]
                                    : colorSchemes.success[0]
                                }
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <TimelineIcon sx={{ mr: 2, color: 'error.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Interaction Trends
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={interactionData?.interactionTrends || []}>
                          <defs>
                            <linearGradient id="interactionGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#feca57" stopOpacity={0.3} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis 
                            dataKey="month" 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#ff6b6b"
                            fill="url(#interactionGradient)"
                            strokeWidth={4}
                            dot={{ fill: '#ff6b6b', strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8, stroke: '#ff6b6b', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <ErrorIcon sx={{ mr: 2, color: 'warning.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Common Interactions
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        {(interactionData?.commonInteractions || []).map((interaction, index) => (
                          <Grid item xs={12} md={6} key={index}>
                            <Card 
                              elevation={0}
                              sx={{ 
                                p: 3, 
                                border: '1px solid', 
                                borderColor: 'divider',
                                borderRadius: 2,
                                background: alpha(
                                  interaction.severityLevel === 'severe'
                                    ? theme.palette.error.main
                                    : interaction.severityLevel === 'moderate'
                                    ? theme.palette.warning.main
                                    : theme.palette.success.main,
                                  0.1
                                )
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                <Avatar 
                                  sx={{ 
                                    bgcolor: 
                                      interaction.severityLevel === 'severe'
                                        ? 'error.main'
                                        : interaction.severityLevel === 'moderate'
                                        ? 'warning.main'
                                        : 'success.main',
                                    mr: 2,
                                    width: 48,
                                    height: 48
                                  }}
                                >
                                  <WarningIcon />
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                                    {interaction.medications.join(' + ')}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {interaction.description}
                                  </Typography>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Chip
                                      label={interaction.severityLevel.toUpperCase()}
                                      color={
                                        interaction.severityLevel === 'severe'
                                          ? 'error'
                                          : interaction.severityLevel === 'moderate'
                                          ? 'warning'
                                          : 'success'
                                      }
                                      size="small"
                                      sx={{ fontWeight: 'bold' }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                      {interaction.count} occurrences
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Enhanced Cost Analysis Tab */}
        <TabPanel value={currentTab} index={3}>
          <Box sx={{ px: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                Cost Analysis & Financial Impact
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Comprehensive financial analysis of medication costs and profitability
              </Typography>
            </Box>

            {costLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={60} />
              </Box>
            ) : costError ? (
              <Alert severity="error" sx={{ borderRadius: 3 }}>
                Failed to load cost data. Please try again.
              </Alert>
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} lg={8}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <ShowChartIcon sx={{ mr: 2, color: 'success.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Monthly Financial Trends
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={400}>
                        <ComposedChart data={costData?.monthlyCosts || []}>
                          <defs>
                            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#4caf50" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis 
                            dataKey="month" 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#666" 
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartsTooltip
                            formatter={(value: any) => [`₦${value.toLocaleString()}`, 'Cost']}
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="totalCost"
                            stroke="#2e7d32"
                            fillOpacity={1}
                            fill="url(#costGradient)"
                            strokeWidth={4}
                            dot={{ fill: '#2e7d32', strokeWidth: 2, r: 6 }}
                            activeDot={{ r: 8, stroke: '#2e7d32', strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Stack spacing={3}>
                    <Card 
                      elevation={0} 
                      sx={{ 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 3,
                        background: colorSchemes.gradient.success
                      }}
                    >
                      <CardContent sx={{ p: 3, color: 'white' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                          <AccountBalanceIcon sx={{ mr: 2 }} />
                          <Typography variant="h6" fontWeight="bold">
                            Financial Summary
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
                            {costData?.formattedTotalCost || '₦0.00'}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9, mb: 3 }}>
                            Total Cost
                          </Typography>
                          <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
                          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                            {costData?.formattedTotalRevenue || '₦0.00'}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9, mb: 3 }}>
                            Total Revenue
                          </Typography>
                          <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
                          <Typography variant="h5" fontWeight="bold">
                            {costData?.formattedTotalProfit || '₦0.00'}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            Net Profit
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>

                    <Card 
                      elevation={0} 
                      sx={{ 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 3,
                        background: colorSchemes.gradient.primary
                      }}
                    >
                      <CardContent sx={{ p: 3, color: 'white', textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                          <AssessmentIcon sx={{ mr: 2 }} />
                          <Typography variant="h6" fontWeight="bold">
                            Profit Margin
                          </Typography>
                        </Box>
                        <Typography variant="h2" fontWeight="bold" sx={{ mb: 1 }}>
                          {costData?.formattedProfitMargin || '0%'}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Overall Performance
                        </Typography>
                      </CardContent>
                    </Card>
                  </Stack>
                </Grid>

                <Grid item xs={12}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 3,
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <StarIcon sx={{ mr: 2, color: 'warning.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                          Top Profitable Medications
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        {(costData?.topProfitableMedications || []).map((medication, index) => (
                          <Grid item xs={12} sm={6} md={4} key={index}>
                            <Card 
                              elevation={0}
                              sx={{ 
                                p: 3, 
                                border: '1px solid', 
                                borderColor: 'divider',
                                borderRadius: 2,
                                background: alpha(colorSchemes.success[index % colorSchemes.success.length], 0.1)
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Avatar 
                                  sx={{ 
                                    bgcolor: colorSchemes.success[index % colorSchemes.success.length],
                                    mr: 2,
                                    width: 48,
                                    height: 48
                                  }}
                                >
                                  <PharmacyIcon />
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                                    {medication.medicationName}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Profit: {medication.formattedProfit}
                                  </Typography>
                                  <Typography variant="caption" color="success.main" fontWeight="bold">
                                    Margin: {medication.formattedProfitMargin}
                                  </Typography>
                                </Box>
                                <Chip
                                  label={medication.formattedProfit}
                                  color="success"
                                  variant="outlined"
                                  sx={{ fontWeight: 'bold' }}
                                />
                              </Box>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default EnhancedMedicationAnalytics;