// Lazy Loading Component for Report Modules with Beautiful Loading States
import React, { Suspense, lazy, ComponentType } from 'react';
import {
  Box,
  Paper,
  Skeleton,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Fade,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { Assessment as AssessmentIcon } from '@mui/icons-material';
import { ReportType } from '../../types/reports';

// Lazy load all report components
const PatientOutcomeReport = lazy(
  () => import('../reports/PatientOutcomeReport')
);
const PharmacistInterventionReport = lazy(
  () => import('../reports/PharmacistInterventionReport')
);
const TherapyEffectivenessReport = lazy(
  () => import('../reports/TherapyEffectivenessReport')
);
const QualityImprovementReport = lazy(
  () => import('../reports/QualityImprovementReport')
);
const RegulatoryComplianceReport = lazy(
  () => import('../reports/RegulatoryComplianceReport')
);
const CostEffectivenessReport = lazy(
  () => import('../reports/CostEffectivenessReport')
);
const TrendForecastingReport = lazy(
  () => import('../reports/TrendForecastingReport')
);
const OperationalEfficiencyReport = lazy(
  () => import('../reports/OperationalEfficiencyReport')
);
const MedicationInventoryReport = lazy(
  () => import('../reports/MedicationInventoryReport')
);
const PatientDemographicsReport = lazy(
  () => import('../reports/PatientDemographicsReport')
);
const AdverseEventReport = lazy(() => import('../reports/AdverseEventReport'));

// Report component mapping
const reportComponents: Record<ReportType, ComponentType<any>> = {
  [ReportType.PATIENT_OUTCOMES]: PatientOutcomeReport,
  [ReportType.PHARMACIST_INTERVENTIONS]: PharmacistInterventionReport,
  [ReportType.THERAPY_EFFECTIVENESS]: TherapyEffectivenessReport,
  [ReportType.QUALITY_IMPROVEMENT]: QualityImprovementReport,
  [ReportType.REGULATORY_COMPLIANCE]: RegulatoryComplianceReport,
  [ReportType.COST_EFFECTIVENESS]: CostEffectivenessReport,
  [ReportType.TREND_FORECASTING]: TrendForecastingReport,
  [ReportType.OPERATIONAL_EFFICIENCY]: OperationalEfficiencyReport,
  [ReportType.MEDICATION_INVENTORY]: MedicationInventoryReport,
  [ReportType.PATIENT_DEMOGRAPHICS]: PatientDemographicsReport,
  [ReportType.ADVERSE_EVENTS]: AdverseEventReport,
  [ReportType.CUSTOM_TEMPLATES]: PatientOutcomeReport, // Fallback for now
};

interface LazyReportLoaderProps {
  reportType: ReportType;
  [key: string]: any; // Allow passing through other props
}

// Beautiful skeleton loading component
const ReportSkeleton: React.FC<{ reportType: ReportType }> = ({
  reportType,
}) => {
  const theme = useTheme();

  return (
    <Fade in timeout={300}>
      <Box sx={{ p: 3 }}>
        {/* Header skeleton */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Skeleton
              variant="circular"
              width={40}
              height={40}
              sx={{ mr: 2 }}
            />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
          </Box>
          <LinearProgress
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.palette.grey[200],
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          />
        </Box>

        {/* KPI Cards skeleton */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}10, ${theme.palette.secondary.main}10)`,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Skeleton variant="text" width="60%" height={20} />
                    <Skeleton
                      variant="rectangular"
                      width={60}
                      height={24}
                      sx={{ borderRadius: 1 }}
                    />
                  </Box>
                  <Skeleton
                    variant="text"
                    width="80%"
                    height={40}
                    sx={{ mb: 1 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Skeleton
                      variant="circular"
                      width={16}
                      height={16}
                      sx={{ mr: 1 }}
                    />
                    <Skeleton variant="text" width="50%" height={16} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Charts skeleton */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, height: 400 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}
              >
                <Skeleton variant="text" width="30%" height={24} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Skeleton
                    variant="rectangular"
                    width={80}
                    height={32}
                    sx={{ borderRadius: 1 }}
                  />
                  <Skeleton
                    variant="rectangular"
                    width={80}
                    height={32}
                    sx={{ borderRadius: 1 }}
                  />
                </Box>
              </Box>
              <Skeleton
                variant="rectangular"
                width="100%"
                height={300}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(45deg, ${theme.palette.grey[100]}, ${theme.palette.grey[200]})`,
                }}
              />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: 400 }}>
              <Skeleton variant="text" width="60%" height={24} sx={{ mb: 3 }} />
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Skeleton variant="circular" width={200} height={200} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[1, 2, 3].map((i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Skeleton
                      variant="circular"
                      width={12}
                      height={12}
                      sx={{ mr: 1 }}
                    />
                    <Skeleton variant="text" width="70%" height={16} />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Additional content skeleton */}
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            {[1, 2].map((i) => (
              <Grid item xs={12} md={6} key={i}>
                <Paper sx={{ p: 3 }}>
                  <Skeleton
                    variant="text"
                    width="50%"
                    height={24}
                    sx={{ mb: 2 }}
                  />
                  <Skeleton
                    variant="rectangular"
                    width="100%"
                    height={150}
                    sx={{ borderRadius: 1, mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Skeleton
                      variant="rectangular"
                      width={60}
                      height={20}
                      sx={{ borderRadius: 1 }}
                    />
                    <Skeleton
                      variant="rectangular"
                      width={60}
                      height={20}
                      sx={{ borderRadius: 1 }}
                    />
                    <Skeleton
                      variant="rectangular"
                      width={60}
                      height={20}
                      sx={{ borderRadius: 1 }}
                    />
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </Fade>
  );
};

// Enhanced loading component with progress indicator
const ReportLoadingState: React.FC<{ reportType: ReportType }> = ({
  reportType,
}) => {
  const theme = useTheme();
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          return 100;
        }
        const diff = Math.random() * 10;
        return Math.min(prevProgress + diff, 100);
      });
    }, 200);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: 600,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Loading overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          background: `linear-gradient(135deg, ${theme.palette.background.paper}95, ${theme.palette.background.paper}85)`,
          backdropFilter: 'blur(4px)',
          borderRadius: 2,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AssessmentIcon
            sx={{
              fontSize: 40,
              color: theme.palette.primary.main,
              mr: 2,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          />
          <Box>
            <Typography variant="h6" color="primary" gutterBottom>
              Loading Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Preparing {reportType.replace(/-/g, ' ')} data...
            </Typography>
          </Box>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 300, mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.palette.grey[200],
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          {Math.round(progress)}% complete
        </Typography>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
          <CircularProgress size={16} sx={{ mr: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Optimizing visualizations...
          </Typography>
        </Box>
      </Box>

      {/* Background skeleton */}
      <ReportSkeleton reportType={reportType} />
    </Box>
  );
};

// Error boundary for lazy loading
class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; reportType: ReportType },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; reportType: ReportType }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            minHeight: 400,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <AssessmentIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" color="error" gutterBottom>
            Failed to Load Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            There was an error loading the{' '}
            {this.props.reportType.replace(/-/g, ' ')} report.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                background: '#1976d2',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </Box>
        </Paper>
      );
    }

    return this.props.children;
  }
}

// Main lazy report loader component
const LazyReportLoader: React.FC<LazyReportLoaderProps> = ({
  reportType,
  ...props
}) => {
  const ReportComponent = reportComponents[reportType];

  if (!ReportComponent) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom>
          Report Not Found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The requested report type "{reportType}" is not available.
        </Typography>
      </Paper>
    );
  }

  return (
    <LazyLoadErrorBoundary reportType={reportType}>
      <Suspense fallback={<ReportLoadingState reportType={reportType} />}>
        <ReportComponent {...props} />
      </Suspense>
    </LazyLoadErrorBoundary>
  );
};

export default LazyReportLoader;
