import * as React from 'react';
import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Tabs,
  Tab,
} from '@mui/material';
import {
  useAdherenceAnalytics,
  usePrescriptionPatternAnalytics,
  useInteractionAnalytics,
  usePatientMedicationSummary,
  useMedicationCostAnalytics,
} from '../../queries/medicationAnalyticsQueries';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

interface MedicationAnalyticsPanelProps {
  patientId: string;
}

interface MedicationCostAnalyticsData {
  monthlyCosts?: { month: string; totalCost: number; formattedCost: string }[];
  costByCategory?: { category: string; cost: number; formattedCost: string }[];
  monthlyFinancials?: {
    month: string;
    cost: number;
    revenue: number;
    profit: number;
    formattedCost: string;
    formattedRevenue: string;
    formattedProfit: string;
  }[];
  topProfitableMedications?: {
    name: string;
    cost: number;
    sellingPrice: number;
    profit: number;
    profitMargin: number;
  }[];
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  formattedTotalCost: string;
  formattedTotalRevenue: string;
  formattedTotalProfit: string;
  formattedProfitMargin: string;
  currency: {
    code: string;
    symbol: string;
  };
}

const MedicationAnalyticsPanel: React.FC<MedicationAnalyticsPanelProps> = ({
  patientId,
}) => {
  // State for UI controls
  const [adherencePeriod, setAdherencePeriod] = useState<string>('6months');
  const [activeTab, setActiveTab] = useState<number>(0);

  // Event handlers
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Fetch analytics data with enhanced hooks
  const { data: adherenceData, isLoading: isLoadingAdherence } =
    useAdherenceAnalytics(patientId, adherencePeriod);

  const { data: prescriptionData, isLoading: isLoadingPrescription } =
    usePrescriptionPatternAnalytics(patientId);

  const { data: interactionData, isLoading: isLoadingInteraction } =
    useInteractionAnalytics(patientId);

  const { data: summaryData, isLoading: isLoadingSummary } =
    usePatientMedicationSummary(patientId);

  // Get cost analytics data and handle loading state
  const { data: costData, isLoading: isLoadingCostAnalytics } =
    useMedicationCostAnalytics(patientId) as {
      data: MedicationCostAnalyticsData | undefined;
      isLoading: boolean;
    };

  const handleAdherencePeriodChange = (event: SelectChangeEvent) => {
    setAdherencePeriod(event.target.value);
  };

  // Show loading state if any data is loading
  if (
    isLoadingAdherence ||
    isLoadingPrescription ||
    isLoadingInteraction ||
    isLoadingSummary ||
    isLoadingCostAnalytics
  ) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Determine the title based on patientId
  const analyticsTitle =
    patientId === 'system'
      ? 'System-wide Medication Analytics'
      : 'Patient Medication Analytics';

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {analyticsTitle}
      </Typography>

      {/* Analytics Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {summaryData?.activeCount || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Medications
              </Typography>
            </Box>
          </Grid>
          <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {summaryData?.adherenceRate || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Adherence Rate
              </Typography>
            </Box>
          </Grid>
          <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="error">
                {summaryData?.interactionCount || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Potential Interactions
              </Typography>
            </Box>
          </Grid>
          <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {costData?.formattedTotalCost || '₦0.00'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monthly Cost
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Analytics Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Adherence" />
          <Tab label="Prescriptions" />
          <Tab label="Interactions" />
          <Tab label="Financial" />
        </Tabs>
      </Box>

      {/* Adherence Analytics */}
      {activeTab === 0 && adherenceData && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Typography variant="h6">Adherence Analytics</Typography>
            <FormControl sx={{ minWidth: 150 }} size="small">
              <InputLabel>Time Period</InputLabel>
              <Select
                value={adherencePeriod}
                label="Time Period"
                onChange={handleAdherencePeriodChange}
              >
                <MenuItem value="3months">Last 3 Months</MenuItem>
                <MenuItem value="6months">Last 6 Months</MenuItem>
                <MenuItem value="1year">Last Year</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: 'span 12', md: 6 }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Monthly Adherence Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={adherenceData?.monthlyAdherence || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="adherence"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                      name="Adherence %"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mt: 2,
                    color:
                      adherenceData?.trendDirection === 'up'
                        ? 'success.main'
                        : adherenceData?.trendDirection === 'down'
                        ? 'error.main'
                        : 'text.secondary',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {adherenceData?.trendDirection === 'up'
                      ? '↑ Improving Trend'
                      : adherenceData?.trendDirection === 'down'
                      ? '↓ Declining Trend'
                      : '→ Stable Trend'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid sx={{ gridColumn: 'span 12', md: 6 }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Overall Adherence Rate
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 300,
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'inline-flex',
                      mb: 2,
                    }}
                  >
                    <CircularProgress
                      variant="determinate"
                      value={adherenceData?.averageAdherence || 0}
                      size={160}
                      thickness={5}
                      sx={{ color: 'primary.main' }}
                    />
                    <Box
                      sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        variant="h3"
                        component="div"
                        color="text.secondary"
                      >
                        {`${adherenceData?.averageAdherence || 0}%`}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body1" align="center">
                    {(adherenceData?.averageAdherence || 0) >= 90
                      ? 'Excellent Adherence'
                      : (adherenceData?.averageAdherence || 0) >= 80
                      ? 'Good Adherence'
                      : (adherenceData?.averageAdherence || 0) >= 70
                      ? 'Fair Adherence'
                      : 'Needs Improvement'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Prescription Pattern Analytics */}
      {activeTab === 1 && prescriptionData && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Prescription Pattern Analytics
          </Typography>
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: 'span 12', md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Medications by Category
                </Typography>
                <Box sx={{ height: 300 }}>
                  {prescriptionData?.medicationsByCategory && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={prescriptionData?.prescriptionFrequency || []}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#82ca9d"
                          name="Prescriptions"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Interaction Analytics */}
      {activeTab === 2 && interactionData && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Medication Interaction Analytics
          </Typography>
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: 'span 12' }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Interaction Trend Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={interactionData?.interactionTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#ff7300"
                      activeDot={{ r: 8 }}
                      name="Interactions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Financial Analytics */}
      {activeTab === 3 && costData && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Medication Financial Analytics
          </Typography>
          <Grid container spacing={3}>
            {/* Financial Summary Cards */}
            <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
              <Paper sx={{ p: 2, height: '100%', textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Total Revenue
                </Typography>
                <Typography variant="h4" color="primary.main">
                  {costData?.formattedTotalRevenue || '₦0.00'}
                </Typography>
              </Paper>
            </Grid>
            <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
              <Paper sx={{ p: 2, height: '100%', textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Total Cost
                </Typography>
                <Typography variant="h4" color="error.main">
                  {costData?.formattedTotalCost || '₦0.00'}
                </Typography>
              </Paper>
            </Grid>
            <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
              <Paper sx={{ p: 2, height: '100%', textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Total Profit
                </Typography>
                <Typography variant="h4" color="success.main">
                  {costData?.formattedTotalProfit || '₦0.00'}
                </Typography>
              </Paper>
            </Grid>
            <Grid sx={{ gridColumn: 'span 12', md: 3 }}>
              <Paper sx={{ p: 2, height: '100%', textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Profit Margin
                </Typography>
                <Typography
                  variant="h4"
                  color={
                    costData?.profitMargin && costData.profitMargin > 0
                      ? 'success.main'
                      : 'error.main'
                  }
                >
                  {costData?.formattedProfitMargin || '0%'}
                </Typography>
              </Paper>
            </Grid>

            {/* Financial Analytics Charts */}
            <Grid sx={{ gridColumn: 'span 12', md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Monthly Revenue vs Cost
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={costData?.monthlyFinancials || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₦${value}`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#8884d8"
                      name="Revenue"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="#ff7300"
                      name="Cost"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#82ca9d"
                      name="Profit"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid sx={{ gridColumn: 'span 12', md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Top 5 Most Profitable Medications
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costData?.topProfitableMedications || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₦${value}`} />
                    <Legend />
                    <Bar dataKey="profit" fill="#82ca9d" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default MedicationAnalyticsPanel;
