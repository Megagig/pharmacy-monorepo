import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  useTheme,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Badge,
  Fade,
  Zoom,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Assignment as TaskIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Event as EventIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import ResponsiveAppointmentCalendar from '../components/appointments/ResponsiveAppointmentCalendar';
import ResponsiveFollowUpTaskList from '../components/followups/ResponsiveFollowUpTaskList';
import AppointmentAnalyticsDashboard from '../components/appointments/AppointmentAnalyticsDashboard';
import { useAuth } from '../hooks/useAuth';
import { useAppointments } from '../hooks/useAppointments';
import { useFollowUpTasks } from '../hooks/useFollowUps';
import { format } from 'date-fns';

const MotionCard = motion(Card);
const MotionBox = motion(Box);

/**
 * Modern Patient Engagement Dashboard
 * Combines appointment management and follow-up tasks with stunning visuals
 */
const PatientEngagement: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data for quick stats
  const { data: appointmentsData } = useAppointments({ limit: 100 });
  const { data: followUpsData } = useFollowUpTasks({ limit: 100 });

  // Calculate quick stats
  const todayAppointments = appointmentsData?.data?.appointments?.filter(
    (apt: any) => format(new Date(apt.scheduledDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ).length || 0;

  const pendingFollowUps = followUpsData?.data?.tasks?.filter(
    (task: any) => task.status === 'pending'
  ).length || 0;

  const overdueFollowUps = followUpsData?.data?.tasks?.filter(
    (task: any) => task.status === 'overdue'
  ).length || 0;

  const upcomingAppointments = appointmentsData?.data?.appointments?.filter(
    (apt: any) => new Date(apt.scheduledDate) > new Date() && apt.status === 'scheduled'
  ).length || 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 4 },
        maxWidth: '100%',
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
      }}
    >
      {/* Modern Header */}
      <MotionBox
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        sx={{ mb: 4 }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
                fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' },
              }}
            >
              Patient Engagement Hub
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontWeight: 500, fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              {user?.name ? `Welcome back, ${user.name.split(' ')[0]}!` : 'Manage appointments and patient follow-up tasks'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh data">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Notifications">
              <IconButton
                sx={{
                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.2) },
                }}
              >
                <Badge badgeContent={overdueFollowUps} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {refreshing && <LinearProgress sx={{ mt: 2, borderRadius: 2 }} />}
      </MotionBox>

      {/* Quick Stats Cards */}
      <MotionBox
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        component={Grid}
        container
        spacing={3}
        sx={{ mb: 4 }}
      >
        <Grid item xs={12} sm={6} md={3}>
          <MotionCard
            variants={itemVariants}
            whileHover={{ scale: 1.05, boxShadow: theme.shadows[8] }}
            sx={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.primary.dark, 0.9)} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.1),
              }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <EventIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                  <Chip label="Today" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                </Stack>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {todayAppointments}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Appointments Today
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </MotionCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MotionCard
            variants={itemVariants}
            whileHover={{ scale: 1.05, boxShadow: theme.shadows[8] }}
            sx={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.9)} 0%, ${alpha(theme.palette.success.dark, 0.9)} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.1),
              }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <CalendarIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                  <Chip label="Upcoming" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                </Stack>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {upcomingAppointments}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Scheduled Appointments
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </MotionCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MotionCard
            variants={itemVariants}
            whileHover={{ scale: 1.05, boxShadow: theme.shadows[8] }}
            sx={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.9)} 0%, ${alpha(theme.palette.warning.dark, 0.9)} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.1),
              }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <TaskIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                  <Chip label="Pending" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                </Stack>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {pendingFollowUps}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Follow-up Tasks
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </MotionCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MotionCard
            variants={itemVariants}
            whileHover={{ scale: 1.05, boxShadow: theme.shadows[8] }}
            sx={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.9)} 0%, ${alpha(theme.palette.error.dark, 0.9)} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.1),
              }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <WarningIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                  <Chip label="Urgent" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                </Stack>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {overdueFollowUps}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Overdue Tasks
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </MotionCard>
        </Grid>
      </MotionBox>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Appointment Calendar - Full Width */}
        <Grid item xs={12}>
          <Fade in timeout={800}>
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ boxShadow: theme.shadows[12] }}
              sx={{
                borderRadius: 4,
                boxShadow: theme.shadows[8],
                background: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  p: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                      <CalendarIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Appointment Calendar
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Manage and schedule patient appointments
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton size="small">
                    <MoreVertIcon />
                  </IconButton>
                </Stack>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <ResponsiveAppointmentCalendar />
              </CardContent>
            </MotionCard>
          </Fade>
        </Grid>

        {/* Follow-up Tasks */}
        <Grid item xs={12} lg={8}>
          <Fade in timeout={1000}>
            <MotionCard
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ boxShadow: theme.shadows[12] }}
              sx={{
                borderRadius: 4,
                boxShadow: theme.shadows[8],
                background: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                height: '700px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  p: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                      <TaskIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Follow-up Tasks
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Track and complete patient follow-ups
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={`${pendingFollowUps} Pending`}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600 }}
                    />
                    <IconButton size="small">
                      <MoreVertIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
              <CardContent sx={{ p: 3, flex: 1, overflow: 'hidden' }}>
                <Box sx={{ height: '100%' }}>
                  <ResponsiveFollowUpTaskList />
                </Box>
              </CardContent>
            </MotionCard>
          </Fade>
        </Grid>

        {/* Analytics Summary */}
        <Grid item xs={12} lg={4}>
          <Fade in timeout={1200}>
            <MotionCard
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ boxShadow: theme.shadows[12] }}
              sx={{
                borderRadius: 4,
                boxShadow: theme.shadows[8],
                background: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                height: '700px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  p: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Quick Analytics
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Performance insights at a glance
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton size="small">
                    <MoreVertIcon />
                  </IconButton>
                </Stack>
              </Box>
              <CardContent sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                <AppointmentAnalyticsDashboard compact />
              </CardContent>
            </MotionCard>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatientEngagement;
