import React from 'react';
import { Box, Card, CardContent, Grid, Stack } from '@mui/material';
import '../../../styles/dashboardTheme.css';

interface SkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
  className = '',
}) => {
  const classes = [
    'skeleton',
    variant === 'circular' ? 'rounded-full' : '',
    animation === 'pulse' ? 'animate-pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={{
        width: width || '100%',
        height: height || (variant === 'text' ? '1.2em' : '100%'),
        borderRadius: variant === 'circular' ? '50%' : undefined,
      }}
    />
  );
};

export const MetricCardSkeleton: React.FC = () => (
  <Card className="dashboard-card" sx={{ height: '100%' }}>
    <CardContent>
      <Skeleton height="24px" width="40%" className="mb-2" />
      <Skeleton height="40px" className="mb-2" />
      <Skeleton height="8px" width="100%" />
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton height="20px" width="30%" />
        <Skeleton height="20px" width="20%" />
      </Box>
    </CardContent>
  </Card>
);

export const ChartSkeleton: React.FC<{ height?: string | number }> = ({
  height = 300,
}) => (
  <Card className="dashboard-card" sx={{ height: '100%' }}>
    <CardContent>
      <Skeleton height="24px" width="40%" className="mb-4" />
      <Skeleton height={height} className="mb-2" />
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton height="16px" width="20%" />
        <Skeleton height="16px" width="20%" />
      </Box>
    </CardContent>
  </Card>
);

export const AppointmentSkeleton: React.FC = () => (
  <Card className="dashboard-card" sx={{ mb: 2, p: 1 }}>
    <CardContent sx={{ p: 1 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Skeleton variant="circular" width={40} height={40} />
        <Box sx={{ width: '100%' }}>
          <Skeleton height="20px" width="60%" className="mb-1" />
          <Skeleton height="16px" width="40%" className="mb-1" />
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton height="14px" width="30%" />
            <Skeleton height="14px" width="20%" />
          </Box>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

export const DashboardSkeleton: React.FC = () => (
  <Box sx={{ width: '100%' }}>
    <Grid container spacing={3}>
      {/* Metric cards skeletons */}
      <Grid item xs={12} sm={6} md={3}>
        <MetricCardSkeleton />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCardSkeleton />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCardSkeleton />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCardSkeleton />
      </Grid>

      {/* Chart skeletons */}
      <Grid item xs={12} md={8}>
        <ChartSkeleton height={300} />
      </Grid>
      <Grid item xs={12} md={4}>
        <ChartSkeleton height={300} />
      </Grid>

      {/* List skeletons */}
      <Grid item xs={12} md={6}>
        <Card className="dashboard-card">
          <CardContent>
            <Skeleton height="24px" width="50%" className="mb-3" />
            <Stack spacing={2}>
              <AppointmentSkeleton />
              <AppointmentSkeleton />
              <AppointmentSkeleton />
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card className="dashboard-card">
          <CardContent>
            <Skeleton height="24px" width="50%" className="mb-3" />
            <Stack spacing={2}>
              <AppointmentSkeleton />
              <AppointmentSkeleton />
              <AppointmentSkeleton />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);
