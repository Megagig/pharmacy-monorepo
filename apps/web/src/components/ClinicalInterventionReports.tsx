import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,

  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GetAppIcon from '@mui/icons-material/GetApp';
import FilterListIcon from '@mui/icons-material/FilterList';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TimelineIcon from '@mui/icons-material/Timeline';
import PieChartIcon from '@mui/icons-material/PieChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import PrintIcon from '@mui/icons-material/Print';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useClinicalInterventionStore } from '../stores/clinicalInterventionStore';

interface OutcomeReport {
  summary: {
    totalInterventions: number;
    completedInterventions: number;
    successfulInterventions: number;
    successRate: number;
    totalCostSavings: number;
    averageResolutionTime: number;
    patientSatisfactionScore: number;
  };
  categoryAnalysis: Array<{
    category: string;
    total: number;
    successful: number;
    successRate: number;
    avgCostSavings: number;
    avgResolutionTime: number;
  }>;
  trendAnalysis: Array<{
    period: string;
    interventions: number;
    successRate: number;
    costSavings: number;
    resolutionTime: number;
  }>;
  comparativeAnalysis: {
    currentPeriod: {
      interventions: number;
      successRate: number;
      costSavings: number;
    };
    previousPeriod: {
      interventions: number;
      successRate: number;
      costSavings: number;
    };
    percentageChange: {
      interventions: number;
      successRate: number;
      costSavings: number;
    };
  };
  detailedOutcomes: Array<{
    interventionId: string;
    interventionNumber: string;
    patientName: string;
    category: string;
    priority: string;
    outcome: string;
    costSavings: number;
    resolutionTime: number;
    patientResponse: string;
    completedDate: string;
  }>;
  auditTrail?: {
    summary: {
      totalActions: number;
      uniqueUsers: number;
      riskActivities: number;
      lastActivity: string | null;
    };
    logs: Array<{
      _id: string;
      timestamp: string;
      action: string;
      userId: {
        firstName?: string;
        lastName?: string;
        email: string;
      };
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      complianceCategory: string;
      details: any;
      interventionId?: {
        interventionNumber: string;
      };
    }>;
    total: number;
    page: number;
    pages: number;
  };
}

interface ReportFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  category: string;
  priority: string;
  outcome: string;
  pharmacist: string;
  costSavingsMin: number | null;
  costSavingsMax: number | null;
  riskLevel?: string;
}

const ClinicalInterventionReports: React.FC = () => {
  const { loading } = useClinicalInterventionStore();

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [reportData, setReportData] = useState<OutcomeReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>(
    'pdf'
  );

  // Filter state
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: startOfMonth(subMonths(new Date(), 1)),
    dateTo: endOfMonth(new Date()),
    category: 'all',
    priority: 'all',
    outcome: 'all',
    pharmacist: 'all',
    costSavingsMin: null,
    costSavingsMax: null,
  });

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Load report data
  const loadReportData = useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);

    try {
      // Import the service dynamically to avoid circular dependencies
      const { clinicalInterventionService } = await import(
        '../services/clinicalInterventionService'
      );

      // Convert filters to the format expected by the API
      const apiFilters = {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        category: filters.category !== 'all' ? filters.category : undefined,
        priority: filters.priority !== 'all' ? filters.priority : undefined,
        outcome: filters.outcome !== 'all' ? filters.outcome : undefined,
        pharmacist:
          filters.pharmacist !== 'all' ? filters.pharmacist : undefined,
      };

      const response = await clinicalInterventionService.generateOutcomeReport(
        apiFilters
      );

      if (response.success && response.data) {

        setReportData(response.data);
      } else {

        // If no data is available, create a mock structure to show the UI
        const mockReportData: OutcomeReport = {
          summary: {
            totalInterventions: 0,
            completedInterventions: 0,
            successfulInterventions: 0,
            successRate: 0,
            totalCostSavings: 0,
            averageResolutionTime: 0,
            patientSatisfactionScore: 0,
          },
          categoryAnalysis: [],
          trendAnalysis: [],
          comparativeAnalysis: {
            currentPeriod: {
              interventions: 0,
              successRate: 0,
              costSavings: 0,
            },
            previousPeriod: {
              interventions: 0,
              successRate: 0,
              costSavings: 0,
            },
            percentageChange: {
              interventions: 0,
              successRate: 0,
              costSavings: 0,
            },
          },
          detailedOutcomes: [],
        };

        setReportData(mockReportData);
        setReportError(
          response.message ||
          'No report data available. Create some clinical interventions to see reports.'
        );
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      setReportError(
        error instanceof Error ? error.message : 'Failed to load report data'
      );

      // Provide empty structure even on error so UI doesn't break
      const emptyReportData: OutcomeReport = {
        summary: {
          totalInterventions: 0,
          completedInterventions: 0,
          successfulInterventions: 0,
          successRate: 0,
          totalCostSavings: 0,
          averageResolutionTime: 0,
          patientSatisfactionScore: 0,
        },
        categoryAnalysis: [],
        trendAnalysis: [],
        comparativeAnalysis: {
          currentPeriod: { interventions: 0, successRate: 0, costSavings: 0 },
          previousPeriod: { interventions: 0, successRate: 0, costSavings: 0 },
          percentageChange: {
            interventions: 0,
            successRate: 0,
            costSavings: 0,
          },
        },
        detailedOutcomes: [],
      };
      setReportData(emptyReportData);
    } finally {
      setLoadingReport(false);
    }
  }, [filters]);

  // Load data on component mount and filter changes
  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Memoized safe data for charts
  const safeReportData = useMemo(() => {
    if (!reportData) return null;

    return {
      ...reportData,
      categoryAnalysis: Array.isArray(reportData.categoryAnalysis) ? reportData.categoryAnalysis : [],
      trendAnalysis: Array.isArray(reportData.trendAnalysis) ? reportData.trendAnalysis : [],
      detailedOutcomes: Array.isArray(reportData.detailedOutcomes) ? reportData.detailedOutcomes : [],
      summary: reportData.summary || {
        totalInterventions: 0,
        completedInterventions: 0,
        successfulInterventions: 0,
        successRate: 0,
        totalCostSavings: 0,
        averageResolutionTime: 0,
        patientSatisfactionScore: 0,
      },
      comparativeAnalysis: reportData.comparativeAnalysis || {
        currentPeriod: { interventions: 0, successRate: 0, costSavings: 0 },
        previousPeriod: { interventions: 0, successRate: 0, costSavings: 0 },
        percentageChange: { interventions: 0, successRate: 0, costSavings: 0 },
      }
    };
  }, [reportData]);

  // Handle filter changes
  const handleFilterChange = (field: keyof ReportFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  // Handle export
  const handleExport = async () => {
    try {
      // Mock export functionality - replace with actual API call

      // Create mock file download
      const filename = `clinical-interventions-report-${format(
        new Date(),
        'yyyy-MM-dd'
      )}.${exportFormat}`;
      const content = JSON.stringify(reportData, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportDialogOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Modern gradient colors

  const gradientColors = [
    { start: '#667eea', end: '#764ba2' },
    { start: '#f093fb', end: '#f5576c' },
    { start: '#4facfe', end: '#00f2fe' },
    { start: '#43e97b', end: '#38f9d7' },
    { start: '#fa709a', end: '#fee140' },
    { start: '#a8edea', end: '#fed6e3' },
    { start: '#ffecd2', end: '#fcb69f' },
    { start: '#ff9a9e', end: '#fecfef' },
  ];

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper
          sx={{
            p: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => {
            const entryName = entry.name || entry.dataKey || 'Value';
            const entryValue = entry.value || 0;

            // Determine suffix based on entry name or data key
            let suffix = '';
            if (typeof entryName === 'string') {
              if (entryName.toLowerCase().includes('rate')) {
                suffix = '%';
              } else if (entryName.toLowerCase().includes('savings') || entryName.toLowerCase().includes('cost')) {
                suffix = ' ₦';
              } else if (entryName.toLowerCase().includes('time')) {
                suffix = ' days';
              }
            }

            return (
              <Typography
                key={index}
                variant="body2"
                sx={{ color: entry.color, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: entry.color,
                  }}
                />
                {entryName}: {entryValue}{suffix}
              </Typography>
            );
          })}
        </Paper>
      );
    }
    return null;
  };

  if (loadingReport && !reportData) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (reportError && !reportData) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading report: {reportError}
      </Alert>
    );
  }

  if (!reportData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <AssessmentIcon />
          Outcome Reports & Analytics
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            No Report Data Available
          </Typography>
          <Typography variant="body2">
            No clinical interventions have been completed yet. Once clinical
            interventions are created and processed, comprehensive reports will
            be available including:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0 }}>
            <li>Success rates by category</li>
            <li>Cost savings analysis</li>
            <li>Trend analysis over time</li>
            <li>Comparative performance metrics</li>
            <li>Detailed outcome tracking</li>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
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
            variant="h4"
            component="h1"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <AssessmentIcon />
            Outcome Reports & Analytics
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={loadReportData} disabled={loadingReport}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<GetAppIcon />}
              onClick={() => setExportDialogOpen(true)}
            >
              Export Report
            </Button>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <FilterListIcon />
              Report Filters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={(date) => handleFilterChange('dateFrom', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="To Date"
                  value={filters.dateTo}
                  onChange={(date) => handleFilterChange('dateTo', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    label="Category"
                    onChange={(e) =>
                      handleFilterChange('category', e.target.value)
                    }
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    <MenuItem value="drug_therapy_problem">
                      Drug Therapy Problem
                    </MenuItem>
                    <MenuItem value="adverse_drug_reaction">
                      Adverse Drug Reaction
                    </MenuItem>
                    <MenuItem value="medication_nonadherence">
                      Medication Non-adherence
                    </MenuItem>
                    <MenuItem value="drug_interaction">
                      Drug Interaction
                    </MenuItem>
                    <MenuItem value="dosing_issue">Dosing Issue</MenuItem>
                    <MenuItem value="contraindication">
                      Contraindication
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    label="Priority"
                    onChange={(e) =>
                      handleFilterChange('priority', e.target.value)
                    }
                  >
                    <MenuItem value="all">All Priorities</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
          >
            <Tab label="Summary Overview" />
            <Tab label="Category Analysis" />
            <Tab label="Trend Analysis" />
            <Tab label="Comparative Analysis" />
            <Tab label="Detailed Outcomes" />
            <Tab label="Audit Trail" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        {activeTab === 0 && (
          <Box>
            {/* Modern KPI Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <AssessmentIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      {safeReportData?.summary?.totalInterventions || 0}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Total Interventions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(67, 233, 123, 0.3)',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(67, 233, 123, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <TrendingUpIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      {(safeReportData?.summary?.successRate || 0).toFixed(1)}%
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Success Rate
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(250, 112, 154, 0.3)',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(250, 112, 154, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <AttachMoneyIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      ₦{(reportData?.summary?.totalCostSavings || 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Total Cost Savings
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(79, 172, 254, 0.3)',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(79, 172, 254, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <TimelineIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      {(reportData?.summary?.averageResolutionTime || 0).toFixed(1)}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Avg Resolution Time (days)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(240, 147, 251, 0.3)',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(240, 147, 251, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <AssessmentIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      {reportData?.summary?.completedInterventions || 0}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Completed Interventions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                    color: '#333',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(168, 237, 234, 0.3)',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(168, 237, 234, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <TrendingUpIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      {(reportData?.summary?.patientSatisfactionScore || 0).toFixed(1)}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.8 }}>
                      Patient Satisfaction (5.0)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Modern Summary Charts */}
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Card
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: 2,
                          p: 1,
                          mr: 2,
                        }}
                      >
                        <BarChartIcon sx={{ color: 'white', fontSize: 24 }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Success Rate by Category
                      </Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={reportData?.categoryAnalysis || []}
                        margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                      >
                        <defs>
                          <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#667eea" stopOpacity={1} />
                            <stop offset="100%" stopColor="#764ba2" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="category"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                        />
                        <RechartsTooltip
                          content={<CustomTooltip />}
                          formatter={(value: any, name: any) => [`${value}%`, name || 'Success Rate']}
                        />
                        <Bar
                          dataKey="successRate"
                          name="Success Rate"
                          fill="url(#successGradient)"
                          radius={[4, 4, 0, 0]}
                          animationDuration={1000}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Card
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                          borderRadius: 2,
                          p: 1,
                          mr: 2,
                        }}
                      >
                        <PieChartIcon sx={{ color: 'white', fontSize: 24 }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Category Distribution
                      </Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <defs>
                          {gradientColors.map((gradient, index) => (
                            <linearGradient
                              key={index}
                              id={`pieGradient${index}`}
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="1"
                            >
                              <stop offset="0%" stopColor={gradient.start} />
                              <stop offset="100%" stopColor={gradient.end} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={reportData?.categoryAnalysis || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="total"
                          nameKey="category"
                          animationDuration={1000}
                        >
                          {(reportData?.categoryAnalysis || []).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={`url(#pieGradient${index % gradientColors.length})`}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          content={<CustomTooltip />}
                          formatter={(value: any, name: any) => [value, name || 'Total']}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                          borderRadius: 2,
                          p: 1,
                          mr: 2,
                        }}
                      >
                        <AttachMoneyIcon sx={{ color: 'white', fontSize: 24 }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Cost Savings by Category
                      </Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart
                        data={reportData?.categoryAnalysis || []}
                        margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                      >
                        <defs>
                          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fa709a" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#fee140" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="category"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                        />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="avgCostSavings"
                          name="Avg Cost Savings"
                          stroke="#fa709a"
                          strokeWidth={3}
                          fill="url(#costGradient)"
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 1 && (
          <Box>
            {/* Category Analysis Table */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Category Performance Analysis
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">Successful</TableCell>
                        <TableCell align="right">Success Rate</TableCell>
                        <TableCell align="right">Avg Cost Savings</TableCell>
                        <TableCell align="right">Avg Resolution Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(reportData?.categoryAnalysis || []).map((category) => (
                        <TableRow key={category.category}>
                          <TableCell component="th" scope="row">
                            {category.category}
                          </TableCell>
                          <TableCell align="right">{category.total}</TableCell>
                          <TableCell align="right">
                            {category.successful}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${category.successRate.toFixed(1)}%`}
                              color={
                                category.successRate >= 90
                                  ? 'success'
                                  : category.successRate >= 80
                                    ? 'warning'
                                    : 'error'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            ₦{category.avgCostSavings}
                          </TableCell>
                          <TableCell align="right">
                            {category.avgResolutionTime.toFixed(1)} days
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {activeTab === 2 && (
          <Box>
            {/* Enhanced Trend Analysis Dashboard */}

            {/* Key Metrics Row */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(102, 126, 234, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 56,
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 1.5,
                      }}
                    >
                      <ShowChartIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {(safeReportData?.trendAnalysis || []).reduce((sum, item) => sum + (item.interventions || 0), 0)}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                      Total Interventions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(67, 233, 123, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(67, 233, 123, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 56,
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 1.5,
                      }}
                    >
                      <TrendingUpIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {((safeReportData?.trendAnalysis || []).reduce((sum, item) => sum + (item.successRate || 0), 0) / Math.max((safeReportData?.trendAnalysis || []).length, 1)).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                      Avg Success Rate
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(250, 112, 154, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(250, 112, 154, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 56,
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 1.5,
                      }}
                    >
                      <AttachMoneyIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                      ₦{((safeReportData?.trendAnalysis || []).reduce((sum, item) => sum + (item.costSavings || 0), 0)).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                      Total Savings
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(240, 147, 251, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(240, 147, 251, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 56,
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 1.5,
                      }}
                    >
                      <TimelineIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {((safeReportData?.trendAnalysis || []).reduce((sum, item) => sum + (item.resolutionTime || 0), 0) / Math.max((safeReportData?.trendAnalysis || []).length, 1)).toFixed(1)}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                      Avg Resolution (days)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Main Performance Chart */}
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card
                  sx={{
                    borderRadius: 4,
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            borderRadius: 3,
                            p: 1.5,
                            mr: 3,
                            boxShadow: '0 8px 24px rgba(79, 172, 254, 0.3)',
                          }}
                        >
                          <ShowChartIcon sx={{ color: 'white', fontSize: 32 }} />
                        </Box>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                            Performance Trends Over Time
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Comprehensive view of interventions, success rates, and cost savings
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    <ResponsiveContainer width="100%" height={500}>
                      <ComposedChart
                        data={safeReportData?.trendAnalysis || []}
                        margin={{ top: 30, right: 40, left: 20, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="interventionsGradientTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#667eea" stopOpacity={0.9} />
                            <stop offset="50%" stopColor="#764ba2" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#764ba2" stopOpacity={0.2} />
                          </linearGradient>
                          <linearGradient id="costSavingsGradientTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fa709a" stopOpacity={0.8} />
                            <stop offset="50%" stopColor="#fee140" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#fee140" stopOpacity={0.1} />
                          </linearGradient>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="2 4"
                          stroke="#e2e8f0"
                          strokeOpacity={0.6}
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          dx={-10}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          dx={10}
                        />
                        <RechartsTooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: 'rgba(79, 172, 254, 0.1)', stroke: 'none' }}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: '20px',
                            fontSize: '14px',
                            fontWeight: 500
                          }}
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="interventions"
                          fill="url(#interventionsGradientTrend)"
                          stroke="#667eea"
                          strokeWidth={3}
                          name="Interventions"
                          animationDuration={2000}
                          animationBegin={0}
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="costSavings"
                          fill="url(#costSavingsGradientTrend)"
                          stroke="#fa709a"
                          strokeWidth={3}
                          name="Cost Savings (₦)"
                          animationDuration={2000}
                          animationBegin={500}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="successRate"
                          stroke="#43e97b"
                          strokeWidth={4}
                          dot={{
                            fill: '#43e97b',
                            strokeWidth: 3,
                            r: 8,
                            filter: 'url(#glow)'
                          }}
                          activeDot={{
                            r: 12,
                            stroke: '#43e97b',
                            strokeWidth: 3,
                            fill: '#ffffff',
                            filter: 'url(#glow)'
                          }}
                          name="Success Rate (%)"
                          animationDuration={2000}
                          animationBegin={1000}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Enhanced Secondary Charts */}
              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    borderRadius: 4,
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                          borderRadius: 3,
                          p: 1.5,
                          mr: 2,
                          boxShadow: '0 8px 24px rgba(240, 147, 251, 0.3)',
                        }}
                      >
                        <TimelineIcon sx={{ color: 'white', fontSize: 28 }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                          Resolution Time Analysis
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Average time to resolve interventions
                        </Typography>
                      </Box>
                    </Box>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart
                        data={safeReportData?.trendAnalysis || []}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="resolutionAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f093fb" stopOpacity={0.8} />
                            <stop offset="50%" stopColor="#f5576c" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#f5576c" stopOpacity={0.1} />
                          </linearGradient>
                          <filter id="dropShadow">
                            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#f093fb" floodOpacity="0.3" />
                          </filter>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="2 4"
                          stroke="#e2e8f0"
                          strokeOpacity={0.6}
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: 'rgba(240, 147, 251, 0.1)', stroke: 'none' }}
                        />
                        <Area
                          type="monotone"
                          taKey="resolutionTime"
                          me="Resolution Time (days)"
                          fill="url(#resolutionAreaGradient)"
                          stroke="#f093fb"
                          strokeWidth={3}
                          dot={{
                            fill: '#f093fb',
                            strokeWidth: 2,
                            r: 6,
                            filter: 'url(#dropShadow)'
                          }}
                          activeDot={{
                            r: 10,
                            stroke: '#f093fb',
                            strokeWidth: 3,
                            fill: '#ffffff',
                            filter: 'url(#dropShadow)'
                          }}
                          animationDuration={2500}
                          animationBegin={300}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    borderRadius: 4,
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                          borderRadius: 3,
                          p: 1.5,
                          mr: 2,
                          boxShadow: '0 8px 24px rgba(67, 233, 123, 0.3)',
                        }}
                      >
                        <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                          Success Rate Progress
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Overall intervention success metrics
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ position: 'relative', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ResponsiveContainer width="100%" height="80%">
                        <RadialBarChart
                          cx="50%"
                          cy="50%"
                          innerRadius="30%"
                          outerRadius="85%"
                          data={[
                            {
                              name: 'Success Rate',
                              value: safeReportData?.summary?.successRate || 0,
                              fill: '#43e97b',
                            },
                          ]}
                        >
                          <defs>
                            <linearGradient id="successRadialGradient" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#43e97b" />
                              <stop offset="100%" stopColor="#38f9d7" />
                            </linearGradient>
                          </defs>
                          <RadialBar
                            label={false}
                            background={{ fill: '#f1f5f9', opacity: 0.3 }}
                            dataKey="value"
                            cornerRadius={15}
                            fill="url(#successRadialGradient)"
                            animationDuration={2000}
                          />
                          <RechartsTooltip
                            content={<CustomTooltip />}
                            formatter={(value: any, name: any) => [`${value}%`, name || 'Success Rate']}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                        }}
                      >
                        <Typography
                          variant="h2"
                          sx={{
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 0.5,
                          }}
                        >
                          {(safeReportData?.summary?.successRate || 0).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                          Success Rate
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Performance Insights */}
              <Grid item xs={12}>
                <Card
                  sx={{
                    borderRadius: 4,
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: 3,
                          p: 1.5,
                          mr: 3,
                          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                        }}
                      >
                        <AssessmentIcon sx={{ color: 'white', fontSize: 28 }} />
                      </Box>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                          Performance Insights
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Key performance indicators and trends
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="body1" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                        The trend analysis shows comprehensive performance metrics across all clinical interventions,
                        providing insights into success rates, cost savings, and resolution times to help optimize
                        pharmaceutical care delivery.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 3 && (
          <Box>
            {/* Modern Comparative Analysis */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    }}
                  />
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <AssessmentIcon sx={{ color: 'white', fontSize: 28 }} />
                    </Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Interventions
                    </Typography>
                    <Typography
                      variant="h3"
                      sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}
                    >
                      {reportData?.comparativeAnalysis?.currentPeriod?.interventions || 0}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          (reportData?.comparativeAnalysis?.percentageChange?.interventions || 0) >= 0
                            ? 'rgba(67, 233, 123, 0.1)'
                            : 'rgba(245, 87, 108, 0.1)',
                        borderRadius: 2,
                        p: 1,
                      }}
                    >
                      <TrendingUpIcon
                        sx={{
                          color:
                            (reportData?.comparativeAnalysis?.percentageChange?.interventions || 0) >= 0
                              ? '#43e97b'
                              : '#f5576c',
                          mr: 0.5,
                          fontSize: 20,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          color:
                            (reportData?.comparativeAnalysis?.percentageChange?.interventions || 0) >= 0
                              ? '#43e97b'
                              : '#f5576c',
                          fontWeight: 600,
                        }}
                      >
                        {Math.abs(
                          reportData?.comparativeAnalysis?.percentageChange?.interventions || 0
                        ).toFixed(1)}% vs previous period
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
                    }}
                  />
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} />
                    </Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Success Rate
                    </Typography>
                    <Typography
                      variant="h3"
                      sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}
                    >
                      {(reportData?.comparativeAnalysis?.currentPeriod?.successRate || 0).toFixed(1)}%
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          (reportData?.comparativeAnalysis?.percentageChange?.successRate || 0) >= 0
                            ? 'rgba(67, 233, 123, 0.1)'
                            : 'rgba(245, 87, 108, 0.1)',
                        borderRadius: 2,
                        p: 1,
                      }}
                    >
                      <TrendingUpIcon
                        sx={{
                          color:
                            (reportData?.comparativeAnalysis?.percentageChange?.successRate || 0) >= 0
                              ? '#43e97b'
                              : '#f5576c',
                          mr: 0.5,
                          fontSize: 20,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          color:
                            (reportData?.comparativeAnalysis?.percentageChange?.successRate || 0) >= 0
                              ? '#43e97b'
                              : '#f5576c',
                          fontWeight: 600,
                        }}
                      >
                        {Math.abs(
                          reportData?.comparativeAnalysis?.percentageChange?.successRate || 0
                        ).toFixed(1)}% vs previous period
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #fa709a 0%, #fee140 100%)',
                    }}
                  />
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <AttachMoneyIcon sx={{ color: 'white', fontSize: 28 }} />
                    </Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Cost Savings
                    </Typography>
                    <Typography
                      variant="h3"
                      sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}
                    >
                      ₦{(reportData?.comparativeAnalysis?.currentPeriod?.costSavings || 0).toLocaleString()}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          (reportData?.comparativeAnalysis?.percentageChange?.costSavings || 0) >= 0
                            ? 'rgba(67, 233, 123, 0.1)'
                            : 'rgba(245, 87, 108, 0.1)',
                        borderRadius: 2,
                        p: 1,
                      }}
                    >
                      <TrendingUpIcon
                        sx={{
                          color:
                            (reportData?.comparativeAnalysis?.percentageChange?.costSavings || 0) >= 0
                              ? '#43e97b'
                              : '#f5576c',
                          mr: 0.5,
                          fontSize: 20,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          color:
                            (reportData?.comparativeAnalysis?.percentageChange?.costSavings || 0) >= 0
                              ? '#43e97b'
                              : '#f5576c',
                          fontWeight: 600,
                        }}
                      >
                        {Math.abs(
                          reportData?.comparativeAnalysis?.percentageChange?.costSavings || 0
                        ).toFixed(1)}% vs previous period
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Modern Charts Section */}
              <Grid container spacing={3} sx={{ mt: 2 }}>
                {/* Performance Trends Over Time */}
                <Grid item xs={12} md={8}>
                  <Card
                    sx={{
                      borderRadius: 4,
                      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: 3,
                            p: 1.5,
                            mr: 3,
                            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                          }}
                        >
                          <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} />
                        </Box>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                            Performance Trends Over Time
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Comprehensive view of interventions, success rates, and cost savings
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ height: 500, position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={safeReportData?.trendAnalysis || []}
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          >
                            <defs>
                              <linearGradient id="interventionsGradientComp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#667eea" stopOpacity={0.9} />
                                <stop offset="50%" stopColor="#764ba2" stopOpacity={0.6} />
                                <stop offset="100%" stopColor="#764ba2" stopOpacity={0.2} />
                              </linearGradient>
                              <linearGradient id="costSavingsGradientComp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fa709a" stopOpacity={0.8} />
                                <stop offset="50%" stopColor="#fee140" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#fee140" stopOpacity={0.1} />
                              </linearGradient>
                              <filter id="glowComp">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                  <feMergeNode in="coloredBlur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} horizontal={true} vertical={false} />
                            <XAxis
                              dataKey="period"
                              stroke="#64748b"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              yAxisId="left"
                              stroke="#64748b"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              stroke="#64748b"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <RechartsTooltip
                              content={<CustomTooltip />}
                              cursor={{ fill: 'rgba(102, 126, 234, 0.1)' }}
                            />
                            <Legend />
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="interventions"
                              stroke="#667eea"
                              strokeWidth={3}
                              fill="url(#interventionsGradientComp)"
                              name="Interventions"
                              animationDuration={2000}
                              animationBegin={0}
                              filter="url(#glowComp)"
                            />
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="costSavings"
                              stroke="#fa709a"
                              strokeWidth={3}
                              fill="url(#costSavingsGradientComp)"
                              name="Cost Savings (₦)"
                              animationDuration={2000}
                              animationBegin={500}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="successRate"
                              stroke="#43e97b"
                              strokeWidth={4}
                              dot={{ fill: '#43e97b', strokeWidth: 2, r: 6 }}
                              activeDot={{ r: 8, stroke: '#43e97b', strokeWidth: 2, fill: '#ffffff' }}
                              name="Success Rate (%)"
                              animationDuration={2000}
                              animationBegin={1000}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Resolution Time Trend */}
                <Grid item xs={12} md={4}>
                  <Card
                    sx={{
                      borderRadius: 4,
                      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box
                          sx={{
                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                            borderRadius: 3,
                            p: 1.5,
                            mr: 2,
                            boxShadow: '0 8px 24px rgba(240, 147, 251, 0.3)',
                          }}
                        >
                          <AccessTimeIcon sx={{ color: 'white', fontSize: 28 }} />
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                            Resolution Time Trend
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Average resolution time analysis
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ height: 350, position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={safeReportData?.trendAnalysis || []}
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          >
                            <defs>
                              <linearGradient id="resolutionTimeGradientComp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f093fb" stopOpacity={0.8} />
                                <stop offset="50%" stopColor="#f5576c" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#f5576c" stopOpacity={0.1} />
                              </linearGradient>
                              <filter id="dropShadowComp">
                                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#f093fb" floodOpacity="0.3" />
                              </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                            <XAxis
                              dataKey="period"
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <RechartsTooltip
                              content={<CustomTooltip />}
                              formatter={(value: any, name: any) => [`${value} days`, name || 'Resolution Time']}
                            />
                            <Area
                              type="monotone"
                              dataKey="avgResolutionTime"
                              stroke="#f093fb"
                              strokeWidth={3}
                              fill="url(#resolutionTimeGradientComp)"
                              dot={{ fill: '#f093fb', strokeWidth: 2, r: 5 }}
                              activeDot={{ r: 7, stroke: '#f093fb', strokeWidth: 2, fill: '#ffffff' }}
                              animationDuration={2500}
                              filter="url(#dropShadowComp)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Success Rate Progress */}
                <Grid item xs={12} md={4}>
                  <Card
                    sx={{
                      borderRadius: 4,
                      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box
                          sx={{
                            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                            borderRadius: 3,
                            p: 1.5,
                            mr: 2,
                            boxShadow: '0 8px 24px rgba(67, 233, 123, 0.3)',
                          }}
                        >
                          <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} />
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                            Success Rate Progress
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Overall intervention success metrics
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ position: 'relative', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ResponsiveContainer width="100%" height="80%">
                          <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="30%"
                            outerRadius="85%"
                            data={[
                              {
                                name: 'Success Rate',
                                value: safeReportData?.comparativeAnalysis?.currentPeriod?.successRate || 0,
                                fill: '#43e97b',
                              },
                            ]}
                          >
                            <defs>
                              <linearGradient id="successRadialGradientComp" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#43e97b" />
                                <stop offset="100%" stopColor="#38f9d7" />
                              </linearGradient>
                            </defs>
                            <RadialBar
                              label={false}
                              background={{ fill: '#f1f5f9', opacity: 0.3 }}
                              dataKey="value"
                              cornerRadius={15}
                              fill="url(#successRadialGradientComp)"
                              animationDuration={2000}
                            />
                            <RechartsTooltip
                              content={<CustomTooltip />}
                              formatter={(value: any, name: any) => [`${value}%`, name || 'Success Rate']}
                            />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                          }}
                        >
                          <Typography
                            variant="h2"
                            sx={{
                              fontWeight: 800,
                              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                              backgroundClip: 'text',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              mb: 0.5,
                            }}
                          >
                            {(safeReportData?.comparativeAnalysis?.currentPeriod?.successRate || 0).toFixed(1)}%
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                            Success Rate
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 4 && (
          <Box>
            {/* Detailed Outcomes Table */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Detailed Intervention Outcomes
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Intervention #</TableCell>
                        <TableCell>Patient</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Outcome</TableCell>
                        <TableCell align="right">Cost Savings</TableCell>
                        <TableCell align="right">Resolution Time</TableCell>
                        <TableCell>Completed Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(reportData?.detailedOutcomes || [])
                        .slice(
                          page * rowsPerPage,
                          page * rowsPerPage + rowsPerPage
                        )
                        .map((outcome) => (
                          <TableRow key={outcome.interventionId}>
                            <TableCell>{outcome.interventionNumber}</TableCell>
                            <TableCell>{outcome.patientName}</TableCell>
                            <TableCell>{outcome.category}</TableCell>
                            <TableCell>
                              <Chip
                                label={outcome.priority}
                                color={
                                  outcome.priority === 'high'
                                    ? 'error'
                                    : outcome.priority === 'medium'
                                      ? 'warning'
                                      : 'default'
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={outcome.patientResponse}
                                color={
                                  outcome.patientResponse === 'improved'
                                    ? 'success'
                                    : outcome.patientResponse === 'no_change'
                                      ? 'warning'
                                      : 'error'
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              ₦{outcome.costSavings}
                            </TableCell>
                            <TableCell align="right">
                              {outcome.resolutionTime} days
                            </TableCell>
                            <TableCell>
                              {format(
                                new Date(outcome.completedDate),
                                'MMM dd, yyyy'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  component="div"
                  count={reportData?.detailedOutcomes?.length || 0}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(parseInt(event.target.value, 10));
                    setPage(0);
                  }}
                />
              </CardContent>
            </Card>
          </Box>
        )}

        {activeTab === 5 && (
          <Box>
            {/* Modern Audit Trail */}
            <Grid container spacing={3}>
              {/* Audit Statistics Cards */}
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(102, 126, 234, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <HistoryIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                      {reportData?.auditTrail?.summary?.totalActions || 0}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Total Actions
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      All recorded activities
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(67, 233, 123, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(67, 233, 123, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                      {reportData?.auditTrail?.summary?.uniqueUsers || 0}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Unique Users
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Active participants
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(250, 112, 154, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(250, 112, 154, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <WarningIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                      {reportData?.auditTrail?.summary?.riskActivities || 0}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Risk Activities
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      High/Critical risk events
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(240, 147, 251, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 20px 40px rgba(240, 147, 251, 0.4)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: 64,
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <AccessTimeIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                      {reportData?.auditTrail?.summary?.lastActivity ? 'Recent' : 'No'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Last Activity
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {reportData?.auditTrail?.summary?.lastActivity
                        ? format(new Date(reportData.auditTrail.summary.lastActivity), 'MMM dd, HH:mm')
                        : 'No activity'
                      }
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Audit Trail Filters */}
            <Card sx={{ mt: 3, mb: 3 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}
                >
                  <FilterListIcon />
                  Audit Trail Filters
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="Start Date"
                      value={filters.dateFrom}
                      onChange={(date) => handleFilterChange('dateFrom', date)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="End Date"
                      value={filters.dateTo}
                      onChange={(date) => handleFilterChange('dateTo', date)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Risk Level</InputLabel>
                      <Select
                        value={filters.riskLevel || 'all'}
                        label="Risk Level"
                        onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                      >
                        <MenuItem value="all">All Risk Levels</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => {
                        // Clear filters logic would go here

                      }}
                      sx={{ height: '40px' }}
                    >
                      Clear Filters
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Modern Audit Trail Table */}
            <Card
              sx={{
                borderRadius: 4,
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                },
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 3,
                        p: 1.5,
                        mr: 3,
                        boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                      }}
                    >
                      <HistoryIcon sx={{ color: 'white', fontSize: 28 }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                        Clinical Interventions Audit Trail
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Comprehensive audit log of all system activities and changes
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<GetAppIcon />}
                    onClick={() => {
                      // Export audit trail logic would go here

                    }}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Export
                  </Button>
                </Box>

                {(reportData?.auditTrail?.logs || []).length > 0 ? (
                  <>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Timestamp</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Action</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>User</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Risk Level</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Category</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Details</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(reportData?.auditTrail?.logs || [])
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((log: any, index: number) => (
                              <TableRow
                                key={log._id || index}
                                sx={{
                                  '&:hover': {
                                    backgroundColor: 'rgba(102, 126, 234, 0.04)',
                                  },
                                }}
                              >
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {format(new Date(log.timestamp), 'MMM dd, yyyy')}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={log.action?.replace(/_/g, ' ') || 'Unknown Action'}
                                    size="small"
                                    sx={{
                                      backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                      color: '#667eea',
                                      fontWeight: 500,
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {log.userId?.firstName && log.userId?.lastName
                                        ? `${log.userId.firstName} ${log.userId.lastName}`
                                        : log.userId?.email || 'Unknown User'
                                      }
                                    </Typography>
                                    {log.userId?.email && (
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                                        {log.userId.email}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={log.riskLevel || 'Low'}
                                    size="small"
                                    color={
                                      log.riskLevel === 'critical' ? 'error' :
                                        log.riskLevel === 'high' ? 'error' :
                                          log.riskLevel === 'medium' ? 'warning' : 'success'
                                    }
                                    sx={{ fontWeight: 500 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{
                                    textTransform: 'capitalize',
                                    color: '#64748b'
                                  }}>
                                    {log.complianceCategory?.replace(/_/g, ' ') || 'General'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      maxWidth: 200,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      color: '#64748b'
                                    }}
                                    title={JSON.stringify(log.details, null, 2)}
                                  >
                                    {log.interventionId?.interventionNumber && (
                                      <strong>#{log.interventionId.interventionNumber}</strong>
                                    )}
                                    {log.details && typeof log.details === 'object'
                                      ? Object.keys(log.details).length > 0
                                        ? ` - ${Object.keys(log.details).join(', ')}`
                                        : ' - No details'
                                      : log.details || 'No details'
                                    }
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <TablePagination
                      rowsPerPageOptions={[5, 10, 25, 50]}
                      component="div"
                      count={reportData?.auditTrail?.total || 0}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={(_, newPage) => setPage(newPage)}
                      onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(0);
                      }}
                    />
                  </>
                ) : (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 8,
                      px: 4,
                      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                      borderRadius: 3,
                      border: '2px dashed #cbd5e1',
                    }}
                  >
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '50%',
                        width: 80,
                        height: 80,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                        opacity: 0.8,
                      }}
                    >
                      <HistoryIcon sx={{ color: 'white', fontSize: 40 }} />
                    </Box>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: '#1e293b',
                        mb: 2,
                      }}
                    >
                      No Audit Data Available
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        color: '#64748b',
                        mb: 3,
                        maxWidth: 400,
                        mx: 'auto',
                        lineHeight: 1.6,
                      }}
                    >
                      No audit logs match the selected criteria. Try adjusting your filters or check back later as audit data is generated through system usage.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        // Clear filters logic would go here

                      }}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                      }}
                    >
                      Clear Filters
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Export Dialog */}
        <Dialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
        >
          <DialogTitle>Export Report</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Choose the format for exporting the report:
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={exportFormat}
                label="Export Format"
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel' | 'csv')}
              >
                <MenuItem value="pdf">PDF Report</MenuItem>
                <MenuItem value="excel">Excel Spreadsheet</MenuItem>
                <MenuItem value="csv">CSV Data</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} variant="contained">
              Export
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ClinicalInterventionReports;
