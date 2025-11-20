import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  useTheme,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  LinearProgress,
  Avatar,
  Badge,
  Fade,
  Button,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  AddTask as AddTaskIcon,
  Analytics as AnalyticsIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import ResponsiveFollowUpTaskList from '../components/followups/ResponsiveFollowUpTaskList';
import FollowUpAnalyticsDashboard from '../components/follow-ups/FollowUpAnalyticsDashboard';
import CreateFollowUpDialog from '../components/followups/CreateFollowUpDialog';
import { useAuth } from '../hooks/useAuth';
import { useFollowUpTasks } from '../hooks/useFollowUps';
import { format, startOfWeek, endOfWeek, isToday, isPast, parseISO } from 'date-fns';

const MotionCard = motion(Card);
const MotionBox = motion(Box);

/**
 * Modern Follow-up Management Page
 * Professional task management with comprehensive tracking
 */
const FollowUpManagement: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [createFollowUpOpen, setCreateFollowUpOpen] = useState(false);

  // Fetch follow-up tasks data
  const { data: followUpsData, refetch } = useFollowUpTasks({ limit: 100 });

  // Calculate stats
  const pendingTasks = followUpsData?.data?.tasks?.filter(
    (task: any) => task.status === 'pending' || task.status === 'in_progress'
  ).length || 0;

  const overdueTasks = followUpsData?.data?.tasks?.filter(
    (task: any) => task.status === 'overdue' || (task.status === 'pending' && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)))
  ).length || 0;

  const dueTodayTasks = followUpsData?.data?.tasks?.filter(
    (task: any) => (task.status === 'pending' || task.status === 'in_progress') && isToday(parseISO(task.dueDate))
  ).length || 0;

  const completedThisWeek = followUpsData?.data?.tasks?.filter(
    (task: any) => {
      if (task.status !== 'completed' || !task.completedDate) return false;
      const completedDate = parseISO(task.completedDate);
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      return completedDate >= weekStart && completedDate <= weekEnd;
    }
  ).length || 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
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
        background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.02)} 0%, ${alpha(theme.palette.warning.main, 0.02)} 100%)`,
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
                background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.warning.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
                fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' },
              }}
            >
              Follow-up Management
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontWeight: 500, fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              Track, manage, and complete patient follow-up tasks efficiently
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddTaskIcon />}
              onClick={() => setCreateFollowUpOpen(true)}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: theme.shadows[4],
                background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                '&:hover': {
                  boxShadow: theme.shadows[8],
                },
              }}
            >
              New Follow-up Task
            </Button>
            <Tooltip title="Refresh">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.success.main, 0.2),
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
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) },
                }}
              >
                <Badge badgeContent={overdueTasks} color="error">
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
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.9)} 0%, ${alpha(theme.palette.warning.dark, 0.9)} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 120,
                height: 120,
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
                    {pendingTasks}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Pending Tasks
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
                top: -30,
                right: -30,
                width: 120,
                height: 120,
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
                    {overdueTasks}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Overdue Tasks
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
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.9)} 0%, ${alpha(theme.palette.info.dark, 0.9)} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.1),
              }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <TimeIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                  <Chip label="Today" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                </Stack>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {dueTodayTasks}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Due Today
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
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.1),
              }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <CheckCircleIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                  <Chip label="This Week" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                </Stack>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {completedThisWeek}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Completed This Week
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </MotionCard>
        </Grid>
      </MotionBox>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Follow-up Task List */}
        <Grid item xs={12} lg={8}>
          <Fade in timeout={600}>
            <MotionCard
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ boxShadow: theme.shadows[12] }}
              sx={{
                borderRadius: 4,
                boxShadow: theme.shadows[8],
                background: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                minHeight: '600px',
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
                    <Avatar sx={{ bgcolor: theme.palette.success.main, width: 48, height: 48 }}>
                      <TaskIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Follow-up Tasks
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        View and manage all patient follow-up tasks
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={`${pendingTasks} Pending`}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600 }}
                    />
                    {overdueTasks > 0 && (
                      <Chip
                        label={`${overdueTasks} Overdue`}
                        size="small"
                        color="error"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
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

        {/* Follow-up Analytics */}
        <Grid item xs={12} lg={4}>
          <Fade in timeout={800}>
            <MotionCard
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ boxShadow: theme.shadows[12] }}
              sx={{
                borderRadius: 4,
                boxShadow: theme.shadows[8],
                background: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                minHeight: '600px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  p: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.05)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 48, height: 48 }}>
                      <AnalyticsIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Follow-up Analytics
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Track completion rates and trends
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton size="small">
                    <MoreVertIcon />
                  </IconButton>
                </Stack>
              </Box>
              <CardContent sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                <FollowUpAnalyticsDashboard />
              </CardContent>
            </MotionCard>
          </Fade>
        </Grid>

        {/* Task Priority Distribution - Optional Additional Card */}
        <Grid item xs={12}>
          <Fade in timeout={1000}>
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ boxShadow: theme.shadows[12] }}
              sx={{
                borderRadius: 4,
                boxShadow: theme.shadows[8],
                background: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
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
                    <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 48, height: 48 }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Quick Actions & Insights
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Common tasks and productivity tips
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton size="small">
                    <MoreVertIcon />
                  </IconButton>
                </Stack>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<EventIcon />}
                      sx={{
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Convert to Appointment
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<CheckCircleIcon />}
                      sx={{
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Mark Complete
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<WarningIcon />}
                      sx={{
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      View Overdue
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<TimeIcon />}
                      sx={{
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Schedule Reminder
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </MotionCard>
          </Fade>
        </Grid>
      </Grid>

      {/* Create Follow-up Dialog */}
      <CreateFollowUpDialog
        open={createFollowUpOpen}
        onClose={() => setCreateFollowUpOpen(false)}
      />
    </Box>
  );
};

export default FollowUpManagement;
