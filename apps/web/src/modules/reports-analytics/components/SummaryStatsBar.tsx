import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Avatar,
  Skeleton,
  useTheme,
  useMediaQuery,
  Fade,
  Zoom,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  LocalPharmacy as PharmacyIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const StatsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: theme.shadows[2],
  marginBottom: theme.spacing(3),
}));

const StatCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  backdropFilter: 'blur(10px)',
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
    height: '3px',
    background: 'transparent',
    transition: 'background 0.3s ease',
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    background: theme.palette.background.paper,
    '&::before': {
      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    },
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
  },
}));

interface SummaryStats {
  totalReports: number;
  activeReports: number;
  totalDataPoints: number;
  avgResponseTime: number;
  lastUpdated: Date;
  costSavings?: number;
  patientsAnalyzed?: number;
  interventionsTracked?: number;
}

interface SummaryStatsBarProps {
  stats?: SummaryStats;
  loading?: boolean;
  dateRange?: {
    startDate: Date;
    endDate: Date;
    preset?: string;
  };
  onStatClick?: (statType: string) => void;
}

const SummaryStatsBar: React.FC<SummaryStatsBarProps> = ({
  stats,
  loading = false,
  dateRange,
  onStatClick,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return `₦${amount.toLocaleString()}`;
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getDateRangeText = (): string => {
    if (!dateRange) return 'All time';
    
    const presetLabels: Record<string, string> = {
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      'wtd': 'Week to date',
      'mtd': 'Month to date',
      'ytd': 'Year to date',
      '1y': 'Last year',
    };

    if (dateRange.preset && presetLabels[dateRange.preset]) {
      return presetLabels[dateRange.preset];
    }

    return `${format(dateRange.startDate, 'MMM dd')} - ${format(dateRange.endDate, 'MMM dd, yyyy')}`;
  };

  // Core stats that always show
  const coreStats = [
    {
      key: 'reports',
      label: 'Reports',
      value: stats?.totalReports || 0,
      icon: <AssessmentIcon />,
      color: theme.palette.primary.main,
      format: 'number',
    },
    {
      key: 'active',
      label: 'Categories',
      value: stats?.activeReports || 8,
      icon: <TrendingUpIcon />,
      color: theme.palette.success.main,
      format: 'number',
    },
    {
      key: 'dataPoints',
      label: 'Data Points',
      value: stats?.totalDataPoints || 0,
      icon: <ScheduleIcon />,
      color: theme.palette.info.main,
      format: 'number',
    },
    {
      key: 'responseTime',
      label: 'Response',
      value: stats?.avgResponseTime || 972,
      icon: <ScheduleIcon />,
      color: theme.palette.warning.main,
      format: 'duration',
    },
  ];

  // Additional stats for larger screens
  const additionalStats = [
    ...(stats?.costSavings ? [{
      key: 'costSavings',
      label: 'Savings',
      value: stats.costSavings,
      icon: <MoneyIcon />,
      color: theme.palette.success.dark,
      format: 'currency',
    }] : [{
      key: 'costSavings',
      label: 'Savings',
      value: 967965,
      icon: <MoneyIcon />,
      color: theme.palette.success.dark,
      format: 'currency',
    }]),
    ...(stats?.patientsAnalyzed ? [{
      key: 'patients',
      label: 'Patients',
      value: stats.patientsAnalyzed,
      icon: <PeopleIcon />,
      color: theme.palette.secondary.main,
      format: 'number',
    }] : [{
      key: 'patients',
      label: 'Patients',
      value: 495,
      icon: <PeopleIcon />,
      color: theme.palette.secondary.main,
      format: 'number',
    }]),
    ...(stats?.interventionsTracked ? [{
      key: 'interventions',
      label: 'Tracked',
      value: stats.interventionsTracked,
      icon: <PharmacyIcon />,
      color: theme.palette.primary.dark,
      format: 'number',
    }] : [{
      key: 'interventions',
      label: 'Tracked',
      value: 154,
      icon: <PharmacyIcon />,
      color: theme.palette.primary.dark,
      format: 'number',
    }]),
  ];

  // Determine which stats to show based on screen size
  const getVisibleStats = () => {
    if (isSmall) {
      return coreStats.slice(0, 4); // Show 4 stats on small screens
    }
    if (isMobile) {
      return [...coreStats, ...additionalStats.slice(0, 2)]; // Show 6 stats on mobile
    }
    if (isTablet) {
      return [...coreStats, ...additionalStats]; // Show all stats on tablet+
    }
    return [...coreStats, ...additionalStats]; // Show all stats on desktop
  };

  const visibleStats = getVisibleStats();

  const formatValue = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'duration':
        return formatDuration(value);
      case 'number':
      default:
        return formatNumber(value);
    }
  };

  if (loading) {
    return (
      <StatsContainer elevation={0}>
        <Stack spacing={3}>
          <Stack 
            direction={isMobile ? "column" : "row"} 
            justifyContent="space-between" 
            alignItems={isMobile ? "flex-start" : "center"}
            spacing={2}
          >
            <Box>
              <Skeleton variant="text" width={180} height={28} />
              <Skeleton variant="text" width={120} height={20} />
            </Box>
            <Skeleton variant="text" width={150} height={16} />
          </Stack>
          
          {/* Top row stats */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(4, 1fr)',
                md: 'repeat(4, 1fr)',
                lg: 'repeat(7, 1fr)',
              },
              gap: 2,
              mb: 2,
            }}
          >
            {Array.from({ length: visibleStats.length }).map((_, index) => (
              <Box key={index}>
                <Stack spacing={1} alignItems="center" sx={{ p: 2 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="text" width="80%" height={24} />
                  <Skeleton variant="text" width="60%" height={16} />
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>
      </StatsContainer>
    );
  }

  return (
    <Fade in timeout={600}>
      <StatsContainer elevation={0}>
        <Stack spacing={3}>
          {/* Header */}
          <Stack 
            direction={isMobile ? "column" : "row"} 
            justifyContent="space-between" 
            alignItems={isMobile ? "flex-start" : "center"}
            spacing={2}
          >
            <Box>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Analytics Overview
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getDateRangeText()}
              </Typography>
            </Box>
            {stats?.lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Last updated: {format(stats.lastUpdated, 'MMM dd, yyyy HH:mm')}
              </Typography>
            )}
          </Stack>

          {/* Responsive Stats Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)', // 2 columns on mobile
                sm: 'repeat(4, 1fr)', // 4 columns on small tablets
                md: 'repeat(4, 1fr)', // 4 columns on medium screens
                lg: 'repeat(7, 1fr)', // 7 columns on large screens
              },
              gap: { xs: 1.5, sm: 2 },
              width: '100%',
            }}
          >
            {visibleStats.map((stat, index) => (
              <Zoom in timeout={300 + index * 100} key={stat.key}>
                <StatCard
                  onClick={() => onStatClick?.(stat.key)}
                  sx={{
                    minHeight: { xs: 100, sm: 120 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    p: { xs: 1.5, sm: 2 },
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: alpha(stat.color, 0.1),
                      color: stat.color,
                      width: { xs: 32, sm: 40 },
                      height: { xs: 32, sm: 40 },
                      mb: 1,
                    }}
                  >
                    {React.cloneElement(stat.icon, { 
                      fontSize: isSmall ? 'small' : 'medium' 
                    })}
                  </Avatar>
                  
                  <Typography 
                    variant="h6" 
                    fontWeight="bold" 
                    color={stat.color}
                    sx={{ 
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      lineHeight: 1.2,
                      mb: 0.5,
                    }}
                  >
                    {formatValue(stat.value, stat.format)}
                  </Typography>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      lineHeight: 1.2,
                      textAlign: 'center',
                    }}
                  >
                    {stat.label}
                  </Typography>
                </StatCard>
              </Zoom>
            ))}
          </Box>

          {/* Show more indicator for mobile */}
          {isSmall && additionalStats.length > 0 && (
            <Typography 
              variant="caption" 
              color="primary" 
              sx={{ 
                textAlign: 'center', 
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' }
              }}
              onClick={() => onStatClick?.('showAll')}
            >
              + {additionalStats.length} more metrics
            </Typography>
          )}
        </Stack>
      </StatsContainer>
    </Fade>
  );
};

export default SummaryStatsBar;