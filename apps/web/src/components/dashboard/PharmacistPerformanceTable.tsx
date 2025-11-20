import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Grid,
  Paper,
} from '@mui/material';
import {
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Star as StarIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import DashboardChart from './DashboardChart';

interface PharmacistPerformance {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  metrics: {
    totalMTRs: number;
    completedMTRs: number;
    completionRate: number;
    averageTime: number; // in hours
    patientSatisfaction: number; // 1-5 scale
    clinicalInterventions: number;
    costSavings: number; // in currency
  };
  trends: {
    mtrTrend: number; // percentage change
    satisfactionTrend: number;
    interventionTrend: number;
  };
  recentActivity: {
    lastMTR: string;
    lastIntervention: string;
  };
}

const mockPharmacistData: PharmacistPerformance[] = [
  {
    id: '1',
    name: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@PharmacyCopilot.com',
    metrics: {
      totalMTRs: 45,
      completedMTRs: 42,
      completionRate: 93.3,
      averageTime: 2.5,
      patientSatisfaction: 4.8,
      clinicalInterventions: 28,
      costSavings: 15420,
    },
    trends: {
      mtrTrend: 12.5,
      satisfactionTrend: 5.2,
      interventionTrend: 8.7,
    },
    recentActivity: {
      lastMTR: '2024-01-15',
      lastIntervention: '2024-01-14',
    },
  },
  {
    id: '2',
    name: 'Dr. Michael Chen',
    email: 'michael.chen@PharmacyCopilot.com',
    metrics: {
      totalMTRs: 38,
      completedMTRs: 35,
      completionRate: 92.1,
      averageTime: 3.1,
      patientSatisfaction: 4.6,
      clinicalInterventions: 22,
      costSavings: 12850,
    },
    trends: {
      mtrTrend: 8.3,
      satisfactionTrend: -2.1,
      interventionTrend: 15.4,
    },
    recentActivity: {
      lastMTR: '2024-01-14',
      lastIntervention: '2024-01-13',
    },
  },
  {
    id: '3',
    name: 'Dr. Emily Rodriguez',
    email: 'emily.rodriguez@PharmacyCopilot.com',
    metrics: {
      totalMTRs: 52,
      completedMTRs: 48,
      completionRate: 92.3,
      averageTime: 2.8,
      patientSatisfaction: 4.9,
      clinicalInterventions: 35,
      costSavings: 18750,
    },
    trends: {
      mtrTrend: 18.2,
      satisfactionTrend: 7.8,
      interventionTrend: 22.1,
    },
    recentActivity: {
      lastMTR: '2024-01-15',
      lastIntervention: '2024-01-15',
    },
  },
  {
    id: '4',
    name: 'Dr. James Wilson',
    email: 'james.wilson@PharmacyCopilot.com',
    metrics: {
      totalMTRs: 31,
      completedMTRs: 28,
      completionRate: 90.3,
      averageTime: 3.5,
      patientSatisfaction: 4.4,
      clinicalInterventions: 18,
      costSavings: 9680,
    },
    trends: {
      mtrTrend: -5.2,
      satisfactionTrend: 3.1,
      interventionTrend: -8.7,
    },
    recentActivity: {
      lastMTR: '2024-01-12',
      lastIntervention: '2024-01-11',
    },
  },
];

const PharmacistPerformanceTable: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [pharmacistData, setPharmacistData] = useState<PharmacistPerformance[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setPharmacistData(mockPharmacistData);
      setLoading(false);
    }, 1000);
  }, []);

  const getPerformanceColor = (
    value: number,
    type: 'completion' | 'satisfaction' | 'trend'
  ) => {
    switch (type) {
      case 'completion':
        if (value >= 95) return theme.palette.success.main;
        if (value >= 90) return theme.palette.warning.main;
        return theme.palette.error.main;
      case 'satisfaction':
        if (value >= 4.5) return theme.palette.success.main;
        if (value >= 4.0) return theme.palette.warning.main;
        return theme.palette.error.main;
      case 'trend':
        return value >= 0
          ? theme.palette.success.main
          : theme.palette.error.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <StarIcon
        key={index}
        sx={{
          fontSize: 16,
          color:
            index < Math.floor(rating)
              ? theme.palette.warning.main
              : theme.palette.grey[300],
        }}
      />
    ));
  };

  // Prepare chart data
  const performanceChartData = pharmacistData.map((pharmacist) => ({
    name: pharmacist.name.split(' ')[1], // Last name
    completionRate: pharmacist.metrics.completionRate,
    satisfaction: pharmacist.metrics.patientSatisfaction * 20, // Scale to 100
    interventions: pharmacist.metrics.clinicalInterventions,
  }));

  const costSavingsData = pharmacistData.map((pharmacist) => ({
    name: pharmacist.name.split(' ')[1],
    value: pharmacist.metrics.costSavings,
  }));

  if (loading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Pharmacist Performance
        </Typography>
        <Card>
          <CardContent>
            <Box sx={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
              {[...Array(4)].map((_, index) => (
                <Box
                  key={index}
                  sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
                >
                  <Box
                    sx={{
                      bgcolor: 'grey.200',
                      height: 40,
                      width: 40,
                      borderRadius: '50%',
                      mr: 2,
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        bgcolor: 'grey.200',
                        height: 16,
                        width: '60%',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    />
                    <Box
                      sx={{
                        bgcolor: 'grey.200',
                        height: 12,
                        width: '40%',
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Pharmacist Performance
        </Typography>

        {/* Performance Charts */}
        <Box
          className="performance-charts-grid"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            gap: 3,
            mb: 4,
            width: '100%',
          }}
        >
          <Box sx={{ width: '100%' }}>
            <DashboardChart
              title="Performance Metrics Comparison"
              data={performanceChartData}
              type="bar"
              height={350}
              colors={[
                theme.palette.primary.main,
                theme.palette.success.main,
                theme.palette.warning.main,
              ]}
              subtitle="Comparative performance analysis"
              showLegend={true}
              interactive={true}
            />
          </Box>
          <Box sx={{ width: '100%' }}>
            <DashboardChart
              title="Cost Savings by Pharmacist"
              data={costSavingsData}
              type="pie"
              height={350}
              colors={[
                theme.palette.primary.main,
                theme.palette.secondary.main,
                theme.palette.success.main,
                theme.palette.warning.main,
              ]}
              subtitle="Individual cost savings contribution"
              showLegend={true}
              interactive={true}
            />
          </Box>
        </Box>

        {/* Performance Table */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      Pharmacist
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      MTRs
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      Completion Rate
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      Avg. Time
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      Satisfaction
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      Interventions
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      Cost Savings
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      Trends
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pharmacistData.map((pharmacist, index) => (
                    <motion.tr
                      key={pharmacist.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      component={TableRow}
                      sx={{
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.02),
                        },
                      }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: theme.palette.primary.main,
                              mr: 2,
                              width: 40,
                              height: 40,
                            }}
                          >
                            {pharmacist.avatar ? (
                              <img
                                src={pharmacist.avatar}
                                alt={pharmacist.name}
                              />
                            ) : (
                              <PersonIcon />
                            )}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 'bold' }}
                            >
                              {pharmacist.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {pharmacist.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 'bold' }}
                          >
                            {pharmacist.metrics.completedMTRs}/
                            {pharmacist.metrics.totalMTRs}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Total/Completed
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box>
                          <Chip
                            label={`${pharmacist.metrics.completionRate.toFixed(
                              1
                            )}%`}
                            color={
                              pharmacist.metrics.completionRate >= 95
                                ? 'success'
                                : pharmacist.metrics.completionRate >= 90
                                ? 'warning'
                                : 'error'
                            }
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                          <LinearProgress
                            variant="determinate"
                            value={pharmacist.metrics.completionRate}
                            sx={{
                              mt: 1,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: alpha(
                                getPerformanceColor(
                                  pharmacist.metrics.completionRate,
                                  'completion'
                                ),
                                0.2
                              ),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: getPerformanceColor(
                                  pharmacist.metrics.completionRate,
                                  'completion'
                                ),
                              },
                            }}
                          />
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <ScheduleIcon
                            sx={{
                              fontSize: 16,
                              mr: 0.5,
                              color: 'text.secondary',
                            }}
                          />
                          <Typography variant="body2">
                            {pharmacist.metrics.averageTime}h
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" mb={0.5}>
                            {renderStars(
                              pharmacist.metrics.patientSatisfaction
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {pharmacist.metrics.patientSatisfaction.toFixed(1)}
                            /5.0
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <AssignmentIcon
                            sx={{
                              fontSize: 16,
                              mr: 0.5,
                              color: 'text.secondary',
                            }}
                          />
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 'bold' }}
                          >
                            {pharmacist.metrics.clinicalInterventions}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 'bold', color: 'success.main' }}
                        >
                          {formatCurrency(pharmacist.metrics.costSavings)}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          gap={0.5}
                        >
                          <Box display="flex" alignItems="center">
                            {pharmacist.trends.mtrTrend >= 0 ? (
                              <TrendingUpIcon
                                sx={{ fontSize: 16, color: 'success.main' }}
                              />
                            ) : (
                              <TrendingDownIcon
                                sx={{ fontSize: 16, color: 'error.main' }}
                              />
                            )}
                            <Typography
                              variant="caption"
                              sx={{
                                color:
                                  pharmacist.trends.mtrTrend >= 0
                                    ? 'success.main'
                                    : 'error.main',
                                fontWeight: 'bold',
                              }}
                            >
                              {pharmacist.trends.mtrTrend > 0 ? '+' : ''}
                              {pharmacist.trends.mtrTrend.toFixed(1)}%
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            MTRs
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton size="small" color="primary">
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Box
          className="performance-summary-grid"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: 'repeat(4, 1fr)',
            },
            gap: 3,
            mt: 2,
            width: '100%',
          }}
        >
          <Box sx={{ width: '100%' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Avg. Completion
                  </Typography>
                </Box>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 'bold', color: 'success.main' }}
                >
                  {(
                    pharmacistData.reduce(
                      (sum, p) => sum + p.metrics.completionRate,
                      0
                    ) / pharmacistData.length
                  ).toFixed(1)}
                  %
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <StarIcon sx={{ color: 'warning.main', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Avg. Satisfaction
                  </Typography>
                </Box>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 'bold', color: 'warning.main' }}
                >
                  {(
                    pharmacistData.reduce(
                      (sum, p) => sum + p.metrics.patientSatisfaction,
                      0
                    ) / pharmacistData.length
                  ).toFixed(1)}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <AssignmentIcon sx={{ color: 'info.main', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Total Interventions
                  </Typography>
                </Box>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 'bold', color: 'info.main' }}
                >
                  {pharmacistData.reduce(
                    (sum, p) => sum + p.metrics.clinicalInterventions,
                    0
                  )}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <TrendingUpIcon sx={{ color: 'success.main', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Total Savings
                  </Typography>
                </Box>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 'bold', color: 'success.main' }}
                >
                  {formatCurrency(
                    pharmacistData.reduce(
                      (sum, p) => sum + p.metrics.costSavings,
                      0
                    )
                  )}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default PharmacistPerformanceTable;
