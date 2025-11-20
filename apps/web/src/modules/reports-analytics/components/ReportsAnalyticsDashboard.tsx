// Modern Reports Analytics Dashboard - Redesigned UI
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ReportDisplay from './ReportDisplay';
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Fade,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Avatar,
  Stack,
  Divider,
  Tooltip,
  Badge,
  LinearProgress,
  CardActions,
  CardHeader,
  Skeleton,
  Alert,
  Breadcrumbs,
  Link,
  Zoom,
  Slide,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useReportsStore } from '../stores';
import { useDashboardStore } from '../stores/dashboardStore';
import { ReportType } from '../types/reports';
import type { ReportFilters } from '../types/filters';
import FixedGrid from '../../../components/common/FixedGrid';
import { reportsService } from '../../../services/reportsService';
import DateRangePicker, { DateRange } from './DateRangePicker';
import SummaryStatsBar from './SummaryStatsBar';

// Modern Icons
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import WarningIcon from '@mui/icons-material/Warning';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SecurityIcon from '@mui/icons-material/Security';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TimelineIcon from '@mui/icons-material/Timeline';
import SpeedIcon from '@mui/icons-material/Speed';
import InventoryIcon from '@mui/icons-material/Inventory';
import BuildIcon from '@mui/icons-material/Build';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InsightsIcon from '@mui/icons-material/Insights';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import RefreshIcon from '@mui/icons-material/Refresh';
import GetAppIcon from '@mui/icons-material/GetApp';
import ShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';

// Styled Components for Modern UI
const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(4),
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
}));

const HeroSection = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  borderRadius: theme.spacing(3),
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  color: theme.palette.primary.contrastText,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    right: 0,
    width: '200px',
    height: '200px',
    background: `radial-gradient(circle, ${alpha(theme.palette.common.white, 0.1)} 0%, transparent 70%)`,
    borderRadius: '50%',
    transform: 'translate(50%, -50%)',
  },
}));

const StatsCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    borderColor: alpha(theme.palette.primary.main, 0.2),
  },
}));

const ReportCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  background: theme.palette.background.paper,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'transparent',
    transition: 'background 0.3s ease',
  },
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: theme.shadows[12],
    '&::before': {
      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    },
  },
  '&.active': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
    '&::before': {
      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    },
  },
}));

const CategoryChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.spacing(3),
  fontWeight: 600,
  textTransform: 'capitalize',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'scale(1.05)',
  },
  '&.selected': {
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
    },
  },
}));

const SearchField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(3),
    background: alpha(theme.palette.background.paper, 0.8),
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: theme.palette.background.paper,
      boxShadow: theme.shadows[2],
    },
    '&.Mui-focused': {
      background: theme.palette.background.paper,
      boxShadow: theme.shadows[4],
    },
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  textTransform: 'none',
  fontWeight: 600,
  padding: theme.spacing(1.5, 3),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[6],
  },
}));

interface ReportsAnalyticsDashboardProps {
  initialReportType?: string;
  workspaceId?: string;
  userPermissions?: string[];
}

const ReportsAnalyticsDashboard: React.FC<ReportsAnalyticsDashboardProps> = () => {
  // Local state for UI
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showReportDisplay, setShowReportDisplay] = useState(false);
  
  // Date range state with default to last 30 days
  const [globalDateRange, setGlobalDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      startDate,
      endDate,
      preset: '30d',
    };
  });

  // Summary stats state (initialized with default, will be updated after reportConfig is available)
  const [summaryStats, setSummaryStats] = useState({
    totalReports: 12, // Default count, will be updated
    activeReports: 0,
    totalDataPoints: 0,
    avgResponseTime: 850, // ms
    lastUpdated: new Date(),
    costSavings: 0,
    patientsAnalyzed: 0,
    interventionsTracked: 0,
  });

  // Get store state directly for reactive updates
  const activeReport = useReportsStore((state) => state.activeReport);
  const setActiveReportStore = useReportsStore((state) => state.setActiveReport);
  const addToHistory = useReportsStore((state) => state.addToHistory);
  const reportData = useReportsStore((state) => state.reportData);
  const loading = useReportsStore((state) => state.loading);
  const getCurrentReportData = useReportsStore((state) => state.getCurrentReportData);
  const isCurrentReportLoading = useReportsStore((state) => state.isCurrentReportLoading);

  const searchQuery = useDashboardStore((state) => state.searchQuery);
  const selectedCategory = useDashboardStore((state) => state.selectedCategory);
  const favoriteReports = useDashboardStore((state) => state.favoriteReports);
  const setSearchQueryStore = useDashboardStore((state) => state.setSearchQuery);
  const setSelectedCategoryStore = useDashboardStore((state) => state.setSelectedCategory);
  const toggleFavoriteStore = useDashboardStore((state) => state.toggleFavorite);
  const addToRecentlyViewed = useDashboardStore((state) => state.addToRecentlyViewed);
  const recentlyViewed = useDashboardStore((state) => state.recentlyViewed);

  // Get store instances for fallback
  const reportsStore = useReportsStore();
  const dashboardStore = useDashboardStore();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Clear any loading states when component mounts (only run once)
  useEffect(() => {



    reportsStore.clearAllLoadingStates();
    
    // Test basic reports endpoint connectivity
    const testReportsEndpoint = async () => {
      try {

        const availableReports = await reportsService.getAvailableReports();

      } catch (error) {
        console.error('❌ Reports endpoint test failed:', error);
      }
    };
    
    testReportsEndpoint();
  }, []); // Empty dependency array - only run once on mount

  // Create modern icon elements with enhanced styling
  const icons = useMemo(
    () => ({
      trendingUp: <TrendingUpIcon sx={{ fontSize: 28 }} />,
      localPharmacy: <LocalPharmacyIcon sx={{ fontSize: 28 }} />,
      analytics: <AnalyticsIcon sx={{ fontSize: 28 }} />,
      star: <StarIcon sx={{ fontSize: 28 }} />,
      security: <SecurityIcon sx={{ fontSize: 28 }} />,
      attachMoney: <AttachMoneyIcon sx={{ fontSize: 28 }} />,
      timeline: <TimelineIcon sx={{ fontSize: 28 }} />,
      speed: <SpeedIcon sx={{ fontSize: 28 }} />,
      inventory: <InventoryIcon sx={{ fontSize: 28 }} />,
      people: <PeopleIcon sx={{ fontSize: 28 }} />,
      warning: <WarningIcon sx={{ fontSize: 28 }} />,
      build: <BuildIcon sx={{ fontSize: 28 }} />,
    }),
    []
  );

  // Report configuration with categories, icons, and metadata
  const reportConfig = useMemo(() => {
    const config = {
      [ReportType.PATIENT_OUTCOMES]: {
        label: 'Patient Outcomes',
        description: 'Analyze patient therapy outcomes, clinical improvements, and quality of life metrics.',
        icon: icons.trendingUp,
        category: 'Clinical',
        priority: 1,
        tags: ['outcomes', 'clinical', 'therapy'],
        color: theme.palette.success.main,
      },
      [ReportType.PHARMACIST_INTERVENTIONS]: {
        label: 'Pharmacist Interventions',
        description: 'Track pharmacist interventions, acceptance rates, and clinical impact.',
        icon: icons.localPharmacy,
        category: 'Clinical',
        priority: 2,
        tags: ['interventions', 'pharmacist', 'clinical'],
        color: theme.palette.primary.main,
      },
      [ReportType.THERAPY_EFFECTIVENESS]: {
        label: 'Therapy Effectiveness',
        description: 'Evaluate medication adherence, therapy completion rates, and effectiveness.',
        icon: icons.analytics,
        category: 'Clinical',
        priority: 3,
        tags: ['therapy', 'effectiveness', 'adherence'],
        color: theme.palette.info.main,
      },
      [ReportType.QUALITY_IMPROVEMENT]: {
        label: 'Quality Improvement',
        description: 'Monitor quality metrics, completion times, and process improvements.',
        icon: icons.star,
        category: 'Quality',
        priority: 4,
        tags: ['quality', 'improvement', 'metrics'],
        color: theme.palette.warning.main,
      },
      [ReportType.REGULATORY_COMPLIANCE]: {
        label: 'Regulatory Compliance',
        description: 'Ensure regulatory compliance with audit trails and documentation.',
        icon: icons.security,
        category: 'Compliance',
        priority: 5,
        tags: ['compliance', 'regulatory', 'audit'],
        color: theme.palette.error.main,
      },
      [ReportType.COST_EFFECTIVENESS]: {
        label: 'Cost Effectiveness',
        description: 'Analyze cost savings, ROI, and financial impact of interventions.',
        icon: icons.attachMoney,
        category: 'Financial',
        priority: 6,
        tags: ['cost', 'financial', 'roi'],
        color: theme.palette.success.dark,
      },
      [ReportType.TREND_FORECASTING]: {
        label: 'Trend Forecasting',
        description: 'Identify trends and generate forecasts for strategic planning.',
        icon: icons.timeline,
        category: 'Analytics',
        priority: 7,
        tags: ['trends', 'forecasting', 'analytics'],
        color: theme.palette.secondary.main,
      },
      [ReportType.OPERATIONAL_EFFICIENCY]: {
        label: 'Operational Efficiency',
        description: 'Optimize workflows, resource utilization, and operational performance.',
        icon: icons.speed,
        category: 'Operations',
        priority: 8,
        tags: ['operations', 'efficiency', 'workflow'],
        color: theme.palette.info.dark,
      },
      [ReportType.MEDICATION_INVENTORY]: {
        label: 'Medication Inventory',
        description: 'Manage inventory, track usage patterns, and forecast demand.',
        icon: icons.inventory,
        category: 'Operations',
        priority: 9,
        tags: ['inventory', 'medication', 'demand'],
        color: theme.palette.primary.dark,
      },
      [ReportType.PATIENT_DEMOGRAPHICS]: {
        label: 'Patient Demographics',
        description: 'Understand patient populations and service utilization patterns.',
        icon: icons.people,
        category: 'Analytics',
        priority: 10,
        tags: ['demographics', 'patients', 'population'],
        color: theme.palette.secondary.dark,
      },
      [ReportType.ADVERSE_EVENTS]: {
        label: 'Adverse Events',
        description: 'Monitor adverse events, safety patterns, and risk assessment.',
        icon: icons.warning,
        category: 'Safety',
        priority: 11,
        tags: ['safety', 'adverse', 'events'],
        color: theme.palette.error.dark,
      },
      [ReportType.CUSTOM_TEMPLATES]: {
        label: 'Custom Templates',
        description: 'Create and manage custom report templates for specific needs.',
        icon: icons.build,
        category: 'Templates',
        priority: 12,
        tags: ['templates', 'custom', 'builder'],
        color: theme.palette.grey[600],
      },
    };
    return config;
  }, [theme, icons]);

  // Get report categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(Object.values(reportConfig).map((r) => r.category)));
    return ['all', ...cats.sort()];
  }, [reportConfig]);

  // Update summary stats when reportConfig is available
  useEffect(() => {
    setSummaryStats(prev => ({
      ...prev,
      totalReports: Object.keys(reportConfig).length,
    }));
  }, [reportConfig]);

  // Get recent reports from store
  const recentReports = recentlyViewed.slice(0, 5);

  // Store interaction functions
  const handleReportClick = useCallback(
    (reportType: string) => {

      try {
        const reportTypeEnum = reportType as ReportType;

        // Update stores directly using the store functions
        setActiveReportStore(reportTypeEnum);

        // Check if we already have data for this report
        const existingData = reportData[reportTypeEnum];
        if (existingData) {
          // Show existing report
          setShowReportDisplay(true);
        }

        // Add to recent reports
        const filters = {
          dateRange: {
            startDate: new Date(),
            endDate: new Date(),
            preset: '30d' as const,
          },
        };
        addToHistory(reportTypeEnum, filters);

        // Add to dashboard recents
        addToRecentlyViewed(reportTypeEnum, filters);

      } catch (error) {
        console.error('❌ Error handling report click:', error);
      }
    },
    [setActiveReportStore, addToHistory, addToRecentlyViewed, reportData]
  );

  const handleFavoriteToggle = useCallback(
    (reportType: string) => {

      try {
        const reportTypeEnum = reportType as ReportType;

        // Update store directly
        toggleFavoriteStore(reportTypeEnum);

      } catch (error) {
        console.error('❌ Error toggling favorite:', error);
      }
    },
    [toggleFavoriteStore]
  );

  const isFavoriteReport = (reportType: string) =>
    favoriteReports.includes(reportType as ReportType);

  // Handle global date range changes
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {

    setGlobalDateRange(newDateRange);
    
    // Update summary stats based on new date range
    // This would typically fetch new data from the API
    setSummaryStats(prev => ({
      ...prev,
      lastUpdated: new Date(),
    }));
  }, []);

  // Handle date range application (when user clicks apply)
  const handleDateRangeApply = useCallback(async (dateRange: DateRange) => {

    // Here you would typically refresh all active reports with the new date range
    // For now, we'll just update the global state
    setGlobalDateRange(dateRange);
    
    // Simulate fetching updated summary stats
    try {
      // This would be a real API call to get summary stats for the date range
      const mockStats = {
        totalReports: Object.keys(reportConfig).length,
        activeReports: Math.floor(Math.random() * 5) + 1,
        totalDataPoints: Math.floor(Math.random() * 10000) + 1000,
        avgResponseTime: Math.floor(Math.random() * 1000) + 500,
        lastUpdated: new Date(),
        costSavings: Math.floor(Math.random() * 100000) + 10000,
        patientsAnalyzed: Math.floor(Math.random() * 500) + 50,
        interventionsTracked: Math.floor(Math.random() * 200) + 20,
      };
      
      setSummaryStats(mockStats);

    } catch (error) {
      console.error('❌ Error updating summary stats:', error);
    }
  }, [reportConfig]);

  // Handle summary stat clicks
  const handleStatClick = useCallback((statType: string) => {

    // You could navigate to detailed views or filter reports based on the stat clicked
    switch (statType) {
      case 'reports':
        // Show all reports
        setSelectedCategoryStore('all');
        break;
      case 'active':
        // Show only active/recent reports
        break;
      case 'showAll':
        // Show expanded stats view on mobile
        break;
      default:

    }
  }, [setSelectedCategoryStore]);

  // Handle report generation using real API
  const handleGenerateReport = useCallback(
    async (reportType: ReportType) => {

      // Prevent multiple rapid clicks
      if (loading[reportType]) {

        return;
      }

      try {
        // Set the active report first
        setActiveReportStore(reportType);
        
        // Use the global date range for report generation
        const filters = {
          dateRange: {
            startDate: globalDateRange.startDate,
            endDate: globalDateRange.endDate,
            preset: globalDateRange.preset || 'custom',
          },
        };

        // Use the store's generateReport method which calls the real API
        await reportsStore.generateReport(reportType, filters);
        
        // Show the report display after successful generation
        setShowReportDisplay(true);

      } catch (error) {
        console.error('❌ Error generating report:', error);
      }
    },
    [reportsStore, setActiveReportStore, loading]
  );

  // Filter reports based on search and category
  const filteredReports = useMemo(() => {
    let reports = Object.entries(reportConfig);

    // Filter by category
    if (selectedCategory !== 'all') {
      reports = reports.filter(([, config]) => config.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      reports = reports.filter(
        ([, config]) =>
          config.label.toLowerCase().includes(query) ||
          config.description.toLowerCase().includes(query) ||
          config.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort by priority
    return reports.sort(([, a], [, b]) => a.priority - b.priority);
  }, [reportConfig, selectedCategory, searchQuery]);

  // Handle search with store sync
  const handleSearchChange = useCallback(
    (value: string) => {

      // Update store directly
      setSearchQueryStore(value);

    },
    [setSearchQueryStore]
  );

  // Handle category change with store sync
  const handleCategoryChange = useCallback(
    (category: string) => {

      // Update store directly
      setSelectedCategoryStore(category);

    },
    [setSelectedCategoryStore]
  );

  // Handle back from report display
  const handleBackFromReport = useCallback(() => {
    setShowReportDisplay(false);
  }, []);

  // Show report display if we have an active report and should show it
  if (showReportDisplay && activeReport) {
    return (
      <ReportDisplay
        reportType={activeReport}
        onBack={handleBackFromReport}
      />
    );
  }

  // Render modern dashboard
  return (
    <StyledContainer maxWidth="xl">
      {/* Breadcrumbs */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link 
          color="inherit" 
          href="#" 
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Dashboard
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <AssessmentIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Reports & Analytics
        </Typography>
      </Breadcrumbs>

      {/* Hero Section */}
      <HeroSection>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box sx={{ zIndex: 1 }}>
            <Typography
              variant={isMobile ? 'h4' : 'h3'}
              component="h1"
              gutterBottom
              sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(45deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Reports & Analytics
            </Typography>
            <Typography
              variant="h6"
              sx={{ 
                opacity: 0.9,
                maxWidth: 600,
                lineHeight: 1.6,
                fontWeight: 400,
              }}
            >
              Generate comprehensive reports and gain actionable insights into your
              pharmacy operations with advanced analytics and real-time data.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <ActionButton
                variant="contained"
                size="large"
                startIcon={<InsightsIcon />}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)',
                  }
                }}
              >
                Quick Insights
              </ActionButton>
              <ActionButton
                variant="outlined"
                size="large"
                startIcon={<AutoGraphIcon />}
                sx={{ 
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  }
                }}
              >
                View Trends
              </ActionButton>
              {process.env.NODE_ENV === 'development' && (
                <ActionButton
                  variant="outlined"
                  size="small"
                  onClick={() => {

                    reportsStore.resetStore();
                    localStorage.removeItem('reports-store');
                    localStorage.removeItem('dashboard-store');
                    window.location.reload();
                  }}
                  sx={{ 
                    borderColor: 'rgba(255,255,255,0.3)',
                    color: 'white',
                    fontSize: '0.75rem',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                      bgcolor: 'rgba(255,255,255,0.1)',
                    }
                  }}
                >
                  Reset & Reload
                </ActionButton>
              )}
            </Stack>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <DashboardIcon sx={{ fontSize: 80, opacity: 0.2 }} />
          </Box>
        </Stack>
      </HeroSection>

      {/* Enhanced Date Range Picker */}
      <Fade in timeout={800}>
        <Box sx={{ mb: 4 }}>
          <DateRangePicker
            value={globalDateRange}
            onChange={handleDateRangeChange}
            onApply={handleDateRangeApply}
            showPresets={true}
            showCustomRange={true}
            maxRange={1095} // 3 years
            compact={isMobile}
          />
        </Box>
      </Fade>

      {/* Summary Statistics Bar */}
      <SummaryStatsBar
        stats={summaryStats}
        loading={false}
        dateRange={globalDateRange}
        onStatClick={handleStatClick}
      />

      {/* Modern Stats Cards */}
      <FixedGrid container spacing={3} sx={{ mb: 4 }}>
        <FixedGrid item xs={6} sm={3}>
          <Zoom in timeout={300}>
            <StatsCard>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    width: 56,
                    height: 56,
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <AssessmentIcon fontSize="large" />
                </Avatar>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {Object.keys(reportConfig).length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Report Types Available
                </Typography>
              </CardContent>
            </StatsCard>
          </Zoom>
        </FixedGrid>
        <FixedGrid item xs={6} sm={3}>
          <Zoom in timeout={400}>
            <StatsCard>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: 'success.main',
                    width: 56,
                    height: 56,
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <FilterListIcon fontSize="large" />
                </Avatar>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {categories.length - 1}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Categories
                </Typography>
              </CardContent>
            </StatsCard>
          </Zoom>
        </FixedGrid>
        <FixedGrid item xs={6} sm={3}>
          <Zoom in timeout={500}>
            <StatsCard>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: 'info.main',
                    width: 56,
                    height: 56,
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <TimelineIcon fontSize="large" />
                </Avatar>
                <Typography variant="h4" color="info.main" fontWeight="bold">
                  {recentReports.length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Recent Reports
                </Typography>
              </CardContent>
            </StatsCard>
          </Zoom>
        </FixedGrid>

      </FixedGrid>

      {/* Modern Search and Filter Section */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 4, 
          borderRadius: 3,
          background: alpha(theme.palette.background.paper, 0.7),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Stack spacing={3}>
          {/* Header with View Controls */}
          <Stack 
            direction="row" 
            justifyContent="space-between" 
            alignItems="center"
            flexWrap="wrap"
            spacing={2}
          >
            <Typography variant="h6" fontWeight="600">
              Discover Reports
            </Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Grid View">
                <IconButton
                  onClick={() => setViewMode('grid')}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                  size="small"
                >
                  <ViewModuleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="List View">
                <IconButton
                  onClick={() => setViewMode('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  size="small"
                >
                  <ViewListIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Toggle Filters">
                <IconButton
                  onClick={() => setShowFilters(!showFilters)}
                  color={showFilters ? 'primary' : 'default'}
                  size="small"
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Search Bar */}
          <SearchField
            fullWidth
            placeholder="Search reports by name, category, or description..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <Tooltip title="Clear search">
                      <IconButton
                        size="small"
                        onClick={() => handleSearchChange('')}
                        edge="end"
                      >
                        <ClearIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Category Filters */}
          <Slide in direction="down">
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                Filter by Category
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {categories.map((category) => (
                  <CategoryChip
                    key={category}
                    label={category === 'all' ? 'All Categories' : category}
                    onClick={() => handleCategoryChange(category)}
                    className={selectedCategory === category ? 'selected' : ''}
                    variant={selectedCategory === category ? 'filled' : 'outlined'}
                    size="medium"
                  />
                ))}
              </Stack>
            </Box>
          </Slide>
        </Stack>
      </Paper>

      {/* Modern Reports Grid */}
      {filteredReports.length === 0 ? (
        <Fade in>
          <Paper 
            elevation={0}
            sx={{ 
              p: 6, 
              textAlign: 'center', 
              mb: 4,
              borderRadius: 3,
              background: alpha(theme.palette.background.paper, 0.7),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            >
              <SearchIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h5" color="text.primary" gutterBottom fontWeight="600">
              No reports found
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
              We couldn't find any reports matching your search criteria. Try adjusting your filters or search terms.
            </Typography>
            <ActionButton
              variant="outlined"
              onClick={() => handleSearchChange('')}
            >
              Clear Filters
            </ActionButton>
          </Paper>
        </Fade>
      ) : (
        <FixedGrid container spacing={3}>
          {filteredReports.map(([reportType, config], index) => (
            <FixedGrid
              item
              xs={12}
              sm={viewMode === 'list' ? 12 : 6}
              md={viewMode === 'list' ? 12 : 4}
              lg={viewMode === 'list' ? 12 : 3}
              key={reportType}
            >
              <Fade in timeout={300 + index * 100}>
                <ReportCard
                  className={activeReport === reportType ? 'active' : ''}
                  onClick={() => handleReportClick(reportType)}
                >
                  <CardHeader
                    avatar={
                      <Avatar
                        sx={{
                          bgcolor: alpha(config.color, 0.1),
                          color: config.color,
                          width: 48,
                          height: 48,
                        }}
                      >
                        {config.icon}
                      </Avatar>
                    }
                    action={
                      <Tooltip title={isFavoriteReport(reportType) ? 'Remove from favorites' : 'Add to favorites'}>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFavoriteToggle(reportType);
                          }}
                          color={isFavoriteReport(reportType) ? 'warning' : 'default'}
                        >
                          {isFavoriteReport(reportType) ? <StarIcon /> : <StarBorderIcon />}
                        </IconButton>
                      </Tooltip>
                    }
                    title={
                      <Typography variant="h6" fontWeight="600">
                        {config.label}
                      </Typography>
                    }
                    subheader={
                      <Chip
                        label={config.category}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    }
                  />
                  <CardContent sx={{ pt: 0 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        lineHeight: 1.6,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {config.description}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {config.tags.slice(0, 3).map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <ActionButton
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateReport(reportType as ReportType);
                      }}
                      disabled={loading[reportType] || false}
                      startIcon={loading[reportType] ? <CircularProgress size={16} /> : <GetAppIcon />}
                    >
                      {loading[reportType] ? 'Generating...' : 'Generate'}
                    </ActionButton>
                    <Tooltip title="Share Report">
                      <IconButton size="small" color="primary">
                        <ShareIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </ReportCard>
              </Fade>
            </FixedGrid>
          ))}
        </FixedGrid>
      )}

      {/* Loading Overlay - Only show when actively generating a report */}
      {activeReport && isCurrentReportLoading() && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: alpha(theme.palette.background.default, 0.8),
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: theme.zIndex.modal,
          }}
        >
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Generating Report...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Please wait while we process your request
            </Typography>
          </Card>
        </Paper>
      )}
    </StyledContainer>
  );
};

export default ReportsAnalyticsDashboard;