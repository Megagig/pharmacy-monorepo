import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import type { InterventionEffectivenessReport } from '../../types/mtr';

interface InterventionEffectivenessChartProps {
  data: InterventionEffectivenessReport;
  loading?: boolean;
}

const InterventionEffectivenessChart: React.FC<
  InterventionEffectivenessChartProps
> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Intervention Effectiveness
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  const outcomeData = [
    {
      name: 'Accepted',
      value: data.summary.acceptedInterventions,
      color: '#4CAF50',
    },
    {
      name: 'Rejected',
      value: data.summary.rejectedInterventions,
      color: '#F44336',
    },
    {
      name: 'Modified',
      value: data.summary.modifiedInterventions,
      color: '#FF9800',
    },
    {
      name: 'Pending',
      value: data.summary.pendingInterventions,
      color: '#2196F3',
    },
  ];

  const getAcceptanceRateColor = (rate: number) => {
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'warning';
    return 'error';
  };

  return (
    <Grid container spacing={3}>
      {/* Summary Card */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUpIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                Intervention Effectiveness Summary
              </Typography>
            </Box>

            <Grid container spacing={2}>
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
                    {data.summary.totalInterventions}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Interventions
                  </Typography>
                </Box>
              </Grid>

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
                    color={`${getAcceptanceRateColor(
                      data.summary.overallAcceptanceRate
                    )}.main`}
                  >
                    {data.summary.overallAcceptanceRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Acceptance Rate
                  </Typography>
                </Box>
              </Grid>

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
                    {data.summary.acceptedInterventions}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Accepted
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h4" color="warning.main">
                    {data.summary.pendingInterventions}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Pending
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Outcome Status Chips */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Intervention Outcomes
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`Accepted: ${data.summary.acceptedInterventions}`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`Rejected: ${data.summary.rejectedInterventions}`}
                  color="error"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`Modified: ${data.summary.modifiedInterventions}`}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`Pending: ${data.summary.pendingInterventions}`}
                  color="info"
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Outcome Distribution Pie Chart */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Intervention Outcome Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={outcomeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {outcomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Effectiveness by Type */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Effectiveness by Intervention Type
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.effectiveness.byType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="acceptanceRate"
                  fill="#8884d8"
                  name="Acceptance Rate %"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Effectiveness by Category */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Effectiveness by Category
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.effectiveness.byCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="acceptanceRate"
                  fill="#82ca9d"
                  name="Acceptance Rate %"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Top Performing Pharmacists */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top Performing Pharmacists
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.pharmacistPerformance.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pharmacistName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="totalInterventions"
                  fill="#8884d8"
                  name="Total Interventions"
                />
                <Bar
                  dataKey="acceptanceRate"
                  fill="#82ca9d"
                  name="Acceptance Rate %"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default InterventionEffectivenessChart;
