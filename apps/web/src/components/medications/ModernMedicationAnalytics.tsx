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
} from 'recharts';
import {
  useAdherenceAnalytics,
  usePrescriptionPatternAnalytics,
  useInteractionAnalytics,
  useMedicationCostAnalytics,
  usePatientMedicationSummary,
} from '../../queries/medicationManagementQueries';

interface ModernMedicationAnalyticsProps {
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

const ModernMedicationAnalytics: React.FC<ModernMedicationAnalyticsProps> = ({
  patientId,
}) => {
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

  // Color schemes for charts
  const primaryColors = ['#1976d2', '#42a5f5', '#90caf9', '#e3f2fd'];
  const successColors = ['#2e7d32', '#4caf50', '#81c784', '#c8e6c9'];
  const warningColors = ['#ed6c02', '#ff9800', '#ffb74d', '#ffe0b2'];
  const errorColors = ['#d32f2f', '#f44336', '#e57373', '#ffcdd2'];

  // Render trend icon
  const renderTrendIcon = (trend: 'up' | 'down' | 'stable' | 'increasing' | 'decreasing') => {
    switch (trend) {
      case 'up':
      case 'increasing':
        return <TrendingUpIcon color="success" />;
      case 'down':
      case 'decreasing':
        return <TrendingDownIcon color="error" />;
      default:
        return <TrendingFlatIcon color="info" />;
    }
  };

  // Summary Cards Component
  const SummaryCards = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                <MedicationIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {summaryData?.activeCount || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Medications
                </Typography>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={summaryData?.activeCount ? Math.min((summaryData.activeCount / 10) * 100, 100) : 0}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                <CheckIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {summaryData?.adherenceRate || 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Adherence Rate
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {renderTrendIcon(summaryData?.adherenceTrend || 'stable')}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {summaryData?.adherenceTrend || 'stable'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                <WarningIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {summaryData?.interactionCount || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Interactions
                </Typography>
              </Box>
            </Box>
            <Chip
              label={summaryData?.interactionCount === 0 ? 'No Issues' : 'Needs Review'}
              color={summaryData?.interactionCount === 0 ? 'success' : 'warning'}
              size="small"
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                <MoneyIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {summaryData?.costAnalysis?.formattedMonthlyCost || '₦0.00'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monthly Cost
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Complexity: {summaryData?.medicationComplexity?.complexityScore || 0}/100
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  if (summaryLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (summaryError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Error Loading Analytics</Typography>
        Unable to load medication analytics data. Please try again.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AnalyticsIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" component="h1" fontWeight="bold">
              Medication Analytics
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Refresh Data">
              <IconButton onClick={() => refetchAdherence()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Report">
              <IconButton>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Comprehensive medication analytics and insights for informed clinical decisions
        </Typography>
      </Box>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Analytics Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 3 }}
          >
            <Tab label="Adherence Trends" />
            <Tab label="Prescription Patterns" />
            <Tab label="Drug Interactions" />
            <Tab label="Cost Analysis" />
          </Tabs>
        </Box>

        {/* Adherence Analytics Tab */}
        <TabPanel value={currentTab} index={0}>
          <Box sx={{ px: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold">
                Adherence Trends Analysis
              </Typography>
              <ButtonGroup size="small">
                <Button
                  variant={adherencePeriod === '3months' ? 'contained' : 'outlined'}
                  onClick={() => handlePeriodChange('3months')}
                >
                  3M
                </Button>
                <Button
                  variant={adherencePeriod === '6months' ? 'contained' : 'outlined'}
                  onClick={() => handlePeriodChange('6months')}
                >
                  6M
                </Button>
                <Button
                  variant={adherencePeriod === '1year' ? 'contained' : 'outlined'}
                  onClick={() => handlePeriodChange('1year')}
                >
                  1Y
                </Button>
              </ButtonGroup>
            </Box>

            {adherenceLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : adherenceError ? (
              <Alert severity="error">Failed to load adherence data</Alert>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Monthly Adherence Trend
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={adherenceData?.monthlyAdherence || []}>
                          <defs>
                            <linearGradient id="adherenceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#1976d2" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" stroke="#666" />
                          <YAxis stroke="#666" />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="adherence"
                            stroke="#1976d2"
                            fillOpacity={1}
                            fill="url(#adherenceGradient)"
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Adherence by Time of Day
                      </Typography>
                      <ResponsiveContainer width="100%" height={200}>
                        <RadialBarChart
                          cx="50%"
                          cy="50%"
                          innerRadius="20%"
                          outerRadius="80%"
                          data={adherenceData?.adherenceByTimeOfDay || []}
                        >
                          <RadialBar dataKey="adherence" cornerRadius={10} fill="#1976d2" />
                          <RechartsTooltip />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Cost Impact
                      </Typography>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="success.main" fontWeight="bold">
                          {adherenceData?.costsData?.formattedSaved || '₦0.00'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Saved through adherence
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="body1" color="text.secondary">
                          Potential savings: {adherenceData?.costsData?.formattedPotential || '₦0.00'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Prescription Patterns Tab */}
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ px: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Prescription Pattern Analysis
            </Typography>

            {prescriptionLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : prescriptionError ? (
              <Alert severity="error">Failed to load prescription data</Alert>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Medications by Category
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={prescriptionData?.medicationsByCategory || []}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {(prescriptionData?.medicationsByCategory || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={primaryColors[index % primaryColors.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Prescription Frequency
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={prescriptionData?.prescriptionFrequency || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" stroke="#666" />
                          <YAxis stroke="#666" />
                          <RechartsTooltip />
                          <Bar dataKey="count" fill="#1976d2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Top Prescribers
                      </Typography>
                      <List>
                        {(prescriptionData?.topPrescribers || []).map((prescriber, index) => (
                          <ListItem key={index}>
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: primaryColors[index % primaryColors.length] }}>
                                <PersonIcon />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={prescriber.prescriber}
                              secondary={`${prescriber.count} prescriptions`}
                            />
                            <Chip
                              label={`${prescriber.count}`}
                              color="primary"
                              variant="outlined"
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Drug Interactions Tab */}
        <TabPanel value={currentTab} index={2}>
          <Box sx={{ px: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Drug Interaction Analysis
            </Typography>

            {interactionLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : interactionError ? (
              <Alert severity="error">Failed to load interaction data</Alert>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Severity Distribution
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={interactionData?.severityDistribution || []}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {(interactionData?.severityDistribution || []).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.severity === 'Severe'
                                    ? errorColors[0]
                                    : entry.severity === 'Moderate'
                                    ? warningColors[0]
                                    : successColors[0]
                                }
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Interaction Trends
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={interactionData?.interactionTrends || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" stroke="#666" />
                          <YAxis stroke="#666" />
                          <RechartsTooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#ff9800"
                            strokeWidth={3}
                            dot={{ fill: '#ff9800', strokeWidth: 2, r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Common Interactions
                      </Typography>
                      <List>
                        {(interactionData?.commonInteractions || []).map((interaction, index) => (
                          <ListItem key={index}>
                            <ListItemAvatar>
                              <Avatar
                                sx={{
                                  bgcolor:
                                    interaction.severityLevel === 'severe'
                                      ? 'error.main'
                                      : interaction.severityLevel === 'moderate'
                                      ? 'warning.main'
                                      : 'success.main',
                                }}
                              >
                                <WarningIcon />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={interaction.medications.join(' + ')}
                              secondary={interaction.description}
                            />
                            <Chip
                              label={interaction.severityLevel}
                              color={
                                interaction.severityLevel === 'severe'
                                  ? 'error'
                                  : interaction.severityLevel === 'moderate'
                                  ? 'warning'
                                  : 'success'
                              }
                              size="small"
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Cost Analysis Tab */}
        <TabPanel value={currentTab} index={3}>
          <Box sx={{ px: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Cost Analysis & Financial Impact
            </Typography>

            {costLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : costError ? (
              <Alert severity="error">Failed to load cost data</Alert>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Monthly Cost Trends
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={costData?.monthlyCosts || []}>
                          <defs>
                            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#2e7d32" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" stroke="#666" />
                          <YAxis stroke="#666" />
                          <RechartsTooltip
                            formatter={(value: any) => [`₦${value.toLocaleString()}`, 'Cost']}
                          />
                          <Area
                            type="monotone"
                            dataKey="totalCost"
                            stroke="#2e7d32"
                            fillOpacity={1}
                            fill="url(#costGradient)"
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Financial Summary
                      </Typography>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary.main" fontWeight="bold">
                          {costData?.formattedTotalCost || '₦0.00'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Total Cost
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h5" color="success.main" fontWeight="bold">
                          {costData?.formattedTotalRevenue || '₦0.00'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Total Revenue
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h5" color="info.main" fontWeight="bold">
                          {costData?.formattedTotalProfit || '₦0.00'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Net Profit
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Profit Margin
                      </Typography>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" color="success.main" fontWeight="bold">
                          {costData?.formattedProfitMargin || '0%'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Overall Margin
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Top Profitable Medications
                      </Typography>
                      <List>
                        {(costData?.topProfitableMedications || []).map((medication, index) => (
                          <ListItem key={index}>
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: successColors[index % successColors.length] }}>
                                <MedicationIcon />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={medication.medicationName}
                              secondary={`Profit: ${medication.formattedProfit} | Margin: ${medication.formattedProfitMargin}`}
                            />
                            <Chip
                              label={medication.formattedProfit}
                              color="success"
                              variant="outlined"
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default ModernMedicationAnalytics;