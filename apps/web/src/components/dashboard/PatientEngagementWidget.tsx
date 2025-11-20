import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  Button,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Event as EventIcon,
  Task as TaskIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface PatientEngagementWidgetProps {
  height?: number;
  compact?: boolean;
}

const PatientEngagementWidget: React.FC<PatientEngagementWidgetProps> = ({
  height = 400,
  compact = false,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Mock data - in real implementation, this would come from hooks
  const engagementData = {
    todayAppointments: 8,
    upcomingAppointments: 24,
    overdueFollowUps: 5,
    completedToday: 12,
    recentActivities: [
      {
        id: 1,
        type: 'appointment',
        title: 'Consultation with John Doe',
        time: '10:30 AM',
        status: 'completed',
      },
      {
        id: 2,
        type: 'followup',
        title: 'Medication adherence check - Jane Smith',
        time: '2:15 PM',
        status: 'pending',
      },
      {
        id: 3,
        type: 'appointment',
        title: 'MTR Session - Robert Johnson',
        time: '3:45 PM',
        status: 'upcoming',
      },
      {
        id: 4,
        type: 'followup',
        title: 'Lab results review - Mary Wilson',
        time: '4:30 PM',
        status: 'overdue',
      },
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return theme.palette.success.main;
      case 'pending':
        return theme.palette.warning.main;
      case 'upcoming':
        return theme.palette.info.main;
      case 'overdue':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'appointment':
        return <EventIcon fontSize="small" />;
      case 'followup':
        return <TaskIcon fontSize="small" />;
      default:
        return <ScheduleIcon fontSize="small" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        sx={{
          height: height,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  bgcolor: theme.palette.primary.main,
                  width: 40,
                  height: 40,
                }}
              >
                <TrendingUpIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Patient Engagement
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Today's activity overview
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/patient-engagement')}
              sx={{ textTransform: 'none' }}
            >
              View All
            </Button>
          </Box>

          {/* Quick Stats */}
          {!compact && (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: alpha(theme.palette.success.main, 0.1),
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                    {engagementData.todayAppointments}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Today's Appointments
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: alpha(theme.palette.warning.main, 0.1),
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                    {engagementData.overdueFollowUps}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Overdue Follow-ups
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 2 }} />
            </>
          )}

          {/* Recent Activities */}
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Recent Activities
            </Typography>
            <List sx={{ py: 0, overflow: 'auto', maxHeight: compact ? 200 : 250 }}>
              {engagementData.recentActivities.map((activity, index) => (
                <ListItem
                  key={activity.id}
                  sx={{
                    px: 0,
                    py: 1,
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: alpha(getStatusColor(activity.status), 0.2),
                        color: getStatusColor(activity.status),
                      }}
                    >
                      {getActivityIcon(activity.type)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {activity.title}
                      </Typography>
                    }
                    secondary={
                      <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {activity.time}
                        </Typography>
                        <Chip
                          label={activity.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: alpha(getStatusColor(activity.status), 0.1),
                            color: getStatusColor(activity.status),
                            border: `1px solid ${alpha(getStatusColor(activity.status), 0.3)}`,
                          }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Quick Actions */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mt: 2,
              pt: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Button
              size="small"
              variant="outlined"
              startIcon={<EventIcon />}
              onClick={() => navigate('/appointments')}
              sx={{ flex: 1, textTransform: 'none' }}
            >
              Appointments
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TaskIcon />}
              onClick={() => navigate('/follow-ups')}
              sx={{ flex: 1, textTransform: 'none' }}
            >
              Follow-ups
            </Button>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PatientEngagementWidget;