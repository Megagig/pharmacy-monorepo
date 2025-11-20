import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import {
  Science as ScienceIcon,
  Warning as WarningIcon,
  Pending as PendingIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

interface LabStatistics {
  totalResults: number;
  pendingResults: number;
  criticalResults: number;
  abnormalResults: number;
  resultsThisWeek: number;
}

interface StatisticsCardsProps {
  statistics?: LabStatistics;
  loading?: boolean;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, bgColor, loading }) => {
  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Skeleton variant="rectangular" height={80} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h3" fontWeight="bold" color={color}>
              {value.toLocaleString()}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              background: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 2,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ statistics, loading }) => {
  const stats = [
    {
      title: 'Total Results',
      value: statistics?.totalResults || 0,
      icon: <ScienceIcon sx={{ color: 'white', fontSize: 28 }} />,
      color: '#1976d2',
      bgColor: '#e3f2fd',
    },
    {
      title: 'Critical Results',
      value: statistics?.criticalResults || 0,
      icon: <WarningIcon sx={{ color: 'white', fontSize: 28 }} />,
      color: '#d32f2f',
      bgColor: '#ffebee',
    },
    {
      title: 'Pending Review',
      value: statistics?.pendingResults || 0,
      icon: <PendingIcon sx={{ color: 'white', fontSize: 28 }} />,
      color: '#ed6c02',
      bgColor: '#fff3e0',
    },
    {
      title: 'Abnormal Results',
      value: statistics?.abnormalResults || 0,
      icon: <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} />,
      color: '#f57c00',
      bgColor: '#fff3e0',
    },
    {
      title: 'This Week',
      value: statistics?.resultsThisWeek || 0,
      icon: <CalendarIcon sx={{ color: 'white', fontSize: 28 }} />,
      color: '#2e7d32',
      bgColor: '#e8f5e9',
    },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {stats.map((stat, index) => (
        <Grid item xs={12} sm={6} md={2.4} key={index}>
          <StatCard {...stat} loading={loading} />
        </Grid>
      ))}
    </Grid>
  );
};

export default StatisticsCards;

