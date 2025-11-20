import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Stack,
  Avatar,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';

interface PatientAnalyticsProps {
  patientId: string;
}

const PatientAnalytics: React.FC<PatientAnalyticsProps> = () => {
  // Mock analytics data
  const analytics = {
    totalVisits: 12,
    totalAssessments: 8,
    medicationAdherence: 85,
    dtpResolutionRate: 75,
    averageVitals: {
      bloodPressure: { systolic: 128, diastolic: 82 },
      heartRate: 72,
      temperature: 36.8,
    },
    trends: {
      bloodPressure: 'improving',
      weight: 'stable',
      adherence: 'good',
    },
    recentMilestones: [
      {
        id: 1,
        date: new Date().toISOString(),
        type: 'assessment',
        description: 'Clinical assessment completed',
      },
      {
        id: 2,
        date: new Date(Date.now() - 86400000).toISOString(),
        type: 'medication',
        description: 'Medication regimen updated',
      },
    ],
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 600,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <AssessmentIcon color="primary" />
          Patient Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive health insights and trend analysis
        </Typography>
      </Box>

      {/* Key Metrics */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <ScheduleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {analytics.totalVisits}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Visits
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <AssessmentIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {analytics.totalAssessments}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Clinical Assessments
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {analytics.medicationAdherence}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Medication Adherence
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={analytics.medicationAdherence}
                sx={{ mt: 2, height: 6, borderRadius: 3 }}
                color={
                  analytics.medicationAdherence >= 80
                    ? 'success'
                    : analytics.medicationAdherence >= 60
                    ? 'warning'
                    : 'error'
                }
              />
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Clinical Trends */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card>
            <CardHeader
              title="Clinical Trends"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              avatar={<TimelineIcon color="primary" />}
            />
            <CardContent>
              <Stack spacing={3}>
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Blood Pressure Trend
                    </Typography>
                    <Chip
                      label={analytics.trends.bloodPressure}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="body1">
                    {analytics.averageVitals.bloodPressure.systolic}/
                    {analytics.averageVitals.bloodPressure.diastolic} mmHg avg
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card>
            <CardHeader
              title="Risk Assessment"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              avatar={<WarningIcon color="warning" />}
            />
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  bgcolor: 'success.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'success.200',
                }}
              >
                <CheckCircleIcon color="success" />
                <Box>
                  <Typography variant="subtitle2" color="success.main">
                    Low Risk Profile
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No immediate concerns identified
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Recent Milestones */}
      <Card>
        <CardHeader
          title="Recent Milestones"
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          avatar={<TrendingUpIcon color="primary" />}
        />
        <CardContent>
          <List>
            {analytics.recentMilestones.map((milestone) => (
              <ListItem
                key={milestone.id}
                sx={{
                  px: 0,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <ListItemIcon>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: 'primary.main',
                      fontSize: '0.75rem',
                    }}
                  >
                    {milestone.type[0].toUpperCase()}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={milestone.description}
                  secondary={new Date(milestone.date).toLocaleDateString()}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PatientAnalytics;
