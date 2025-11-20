import React from 'react';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

interface AdherenceData {
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  medicationScores: Array<{
    medicationId: string;
    medicationName: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    daysTracked: number;
    missedDoses: number;
    totalDoses: number;
  }>;
  weeklyScores: Array<{
    week: string;
    score: number;
  }>;
  insights: Array<{
    type: 'success' | 'warning' | 'error';
    message: string;
  }>;
}

interface AdherenceChartProps {
  data: AdherenceData;
  loading?: boolean;
}

const AdherenceChart: React.FC<AdherenceChartProps> = ({ data, loading = false }) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircleIcon color="success" />;
    if (score >= 70) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon color="success" sx={{ fontSize: '1rem' }} />;
      case 'down':
        return <TrendingDownIcon color="error" sx={{ fontSize: '1rem' }} />;
      case 'stable':
        return <TrendingFlatIcon color="info" sx={{ fontSize: '1rem' }} />;
    }
  };

  const getScoreDescription = (score: number) => {
    if (score >= 90) return 'Excellent adherence';
    if (score >= 80) return 'Good adherence';
    if (score >= 70) return 'Fair adherence';
    if (score >= 60) return 'Poor adherence';
    return 'Very poor adherence';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Loading adherence data...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Overall Adherence Score */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Overall Adherence Score
          </Typography>
          {getTrendIcon(data.trend)}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ mr: 2 }}>
            {getScoreIcon(data.overallScore)}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h3" color={`${getScoreColor(data.overallScore)}.main`}>
              {data.overallScore}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getScoreDescription(data.overallScore)}
            </Typography>
          </Box>
        </Box>

        <LinearProgress
          variant="determinate"
          value={data.overallScore}
          color={getScoreColor(data.overallScore) as any}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Paper>

      {/* Individual Medication Adherence */}
      {data.medicationScores && data.medicationScores.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Individual Medication Adherence
          </Typography>
          
          <Grid container spacing={2}>
            {data.medicationScores.map((medication) => (
              <Grid item xs={12} md={6} key={medication.medicationId}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                        {medication.medicationName}
                      </Typography>
                      {getTrendIcon(medication.trend)}
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography 
                        variant="h4" 
                        color={`${getScoreColor(medication.score)}.main`}
                        sx={{ mr: 1 }}
                      >
                        {medication.score}%
                      </Typography>
                      {getScoreIcon(medication.score)}
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={medication.score}
                      color={getScoreColor(medication.score) as any}
                      sx={{ height: 6, borderRadius: 3, mb: 2 }}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Days tracked: {medication.daysTracked}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Missed: {medication.missedDoses}/{medication.totalDoses}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      {getScoreDescription(medication.score)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Weekly Trend */}
      {data.weeklyScores && data.weeklyScores.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Weekly Adherence Trend
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'end', gap: 1, height: 120, mb: 2 }}>
            {data.weeklyScores.map((week, index) => (
              <Box 
                key={index}
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  flex: 1
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: 40,
                    height: `${week.score}%`,
                    bgcolor: `${getScoreColor(week.score)}.main`,
                    borderRadius: 1,
                    mb: 1,
                    minHeight: 4
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {week.week}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                  {week.score}%
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Insights and Recommendations */}
      {data.insights && data.insights.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Insights & Recommendations
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.insights.map((insight, index) => (
              <Chip
                key={index}
                label={insight.message}
                color={insight.type as any}
                variant="outlined"
                sx={{ 
                  justifyContent: 'flex-start',
                  height: 'auto',
                  py: 1,
                  '& .MuiChip-label': {
                    whiteSpace: 'normal',
                    textAlign: 'left'
                  }
                }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* No Data State */}
      {(!data.medicationScores || data.medicationScores.length === 0) && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Adherence Data Available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start tracking your medication adherence to see detailed insights and trends here.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default AdherenceChart;