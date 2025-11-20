import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import type { MTRSummaryReport } from '../../types/mtr';

interface MTRSummaryReportCardProps {
  data: MTRSummaryReport;
  loading?: boolean;
}

const MTRSummaryReportCard: React.FC<MTRSummaryReportCardProps> = ({
  data,
  loading = false,
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            MTR Summary
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  const getCompletionTimeColor = (days: number) => {
    if (days <= 3) return 'success';
    if (days <= 7) return 'warning';
    return 'error';
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AssessmentIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">MTR Summary Report</Typography>
        </Box>

        <Grid container spacing={2}>
          {/* Total Reviews */}
          <Grid item xs={12} sm={6} md={3}>
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
              }}
            >
              <Typography variant="h4" color="primary.main">
                {data.summary.totalReviews}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Reviews
              </Typography>
            </Box>
          </Grid>

          {/* Completion Rate */}
          <Grid item xs={12} sm={6} md={3}>
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1,
                }}
              >
                <Typography
                  variant="h4"
                  color={`${getCompletionRateColor(
                    data.summary.completionRate
                  )}.main`}
                >
                  {data.summary.completionRate.toFixed(1)}%
                </Typography>
                {data.summary.completionRate >= 80 ? (
                  <TrendingUpIcon color="success" sx={{ ml: 1 }} />
                ) : (
                  <TrendingDownIcon color="error" sx={{ ml: 1 }} />
                )}
              </Box>
              <Typography variant="body2" color="textSecondary">
                Completion Rate
              </Typography>
            </Box>
          </Grid>

          {/* Average Completion Time */}
          <Grid item xs={12} sm={6} md={3}>
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
              }}
            >
              <Typography
                variant="h4"
                color={`${getCompletionTimeColor(
                  data.summary.avgCompletionTime
                )}.main`}
              >
                {data.summary.avgCompletionTime.toFixed(1)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Avg Days to Complete
              </Typography>
            </Box>
          </Grid>

          {/* Problems Resolved */}
          <Grid item xs={12} sm={6} md={3}>
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
              }}
            >
              <Typography variant="h4" color="success.main">
                {data.summary.totalProblemsResolved}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Problems Resolved
              </Typography>
            </Box>
          </Grid>

          {/* Status Breakdown */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Review Status Breakdown
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`Completed: ${data.summary.completedReviews}`}
                color="success"
                variant="outlined"
                size="small"
              />
              <Chip
                label={`In Progress: ${data.summary.inProgressReviews}`}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip
                label={`On Hold: ${data.summary.onHoldReviews}`}
                color="warning"
                variant="outlined"
                size="small"
              />
              <Chip
                label={`Cancelled: ${data.summary.cancelledReviews}`}
                color="error"
                variant="outlined"
                size="small"
              />
            </Box>
          </Grid>

          {/* Clinical Outcomes */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Clinical Impact
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Medications Optimized
                </Typography>
                <Typography variant="h6" color="primary.main">
                  {data.summary.totalMedicationsOptimized}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Adherence Improved
                </Typography>
                <Typography variant="h6" color="info.main">
                  {data.summary.adherenceImprovedCount}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Adverse Events Reduced
                </Typography>
                <Typography variant="h6" color="warning.main">
                  {data.summary.adverseEventsReducedCount}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Cost Savings
                </Typography>
                <Typography variant="h6" color="success.main">
                  ${data.summary.totalCostSavings?.toLocaleString() || 0}
                </Typography>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default MTRSummaryReportCard;
