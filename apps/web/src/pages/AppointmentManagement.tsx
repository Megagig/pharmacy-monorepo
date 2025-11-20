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
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EventIcon from '@mui/icons-material/Event';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { motion } from 'framer-motion';
import ResponsiveAppointmentCalendar from '../components/appointments/ResponsiveAppointmentCalendar';
import AppointmentAnalyticsDashboard from '../components/appointments/AppointmentAnalyticsDashboard';
import PharmacistScheduleView from '../components/appointments/PharmacistScheduleView';
import CapacityUtilizationChart from '../components/appointments/CapacityUtilizationChart';
import ReminderEffectivenessChart from '../components/appointments/ReminderEffectivenessChart';
import CreateAppointmentDialog from '../components/appointments/CreateAppointmentDialog';
import WaitlistManagement from '../components/appointments/WaitlistManagement';
import SmartSchedulingDialog from '../components/appointments/SmartSchedulingDialog';
import { useAppointments } from '../hooks/useAppointments';
import { usePharmacistSelection } from '../hooks/usePharmacistSelection';
import { format, endOfWeek } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../components/common/ErrorBoundary';

const MotionCard = motion(Card);
const MotionBox = motion(Box);

/**
 * Modern Appointment Management Page
 * Professional appointment scheduling with comprehensive analytics
 */
const AppointmentManagement: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [createAppointmentOpen, setCreateAppointmentOpen] = useState(false);
  const [smartSchedulingOpen, setSmartSchedulingOpen] = useState(false);

  // Set initial tab based on URL
  const [currentTab, setCurrentTab] = useState(
    location.pathname.includes('/waitlist') ? 1 : 0
  );

  // Pharmacist selection for schedule management
  const { selectedPharmacistId, selectedPharmacist, setSelectedPharmacistId, pharmacists } = usePharmacistSelection();

  // Fetch appointments data
  const { data: appointmentsData, refetch } = useAppointments({ limit: 100 });

  // Calculate stats - data.results is the appointments array
  const appointments = appointmentsData?.data?.results || [];

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const todayAppointments = appointments.filter(
    (apt: any) => {
      const aptDateStr = format(new Date(apt.scheduledDate), 'yyyy-MM-dd');
      return aptDateStr === todayStr;
    }
  ).length || 0;

  const completedToday = appointments.filter(
    (apt: any) => {
      const aptDateStr = format(new Date(apt.scheduledDate), 'yyyy-MM-dd');
      return aptDateStr === todayStr && apt.status === 'completed';
    }
  ).length || 0;

  const upcomingThisWeek = appointments.filter(
    (apt: any) => {
      const aptDate = new Date(apt.scheduledDate);
      const weekEnd = endOfWeek(today);
      return aptDate >= today && aptDate <= weekEnd && ['scheduled', 'confirmed'].includes(apt.status);
    }
  ).length || 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    // Update URL based on tab selection
    if (newValue === 0) {
      navigate('/appointments');
    } else if (newValue === 1) {
      navigate('/appointments/waitlist');
    }
  };

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
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
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
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
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
                fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' },
              }}
            >
              Appointment Management
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontWeight: 500, fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              Schedule, manage, and analyze patient appointments with ease
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setCreateAppointmentOpen(true)}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: theme.shadows[4],
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                '&:hover': {
                  boxShadow: theme.shadows[8],
                },
              }}
            >
              New Appointment
            </Button>
            <Button
              variant="outlined"
              startIcon={<SmartToyIcon />}
              onClick={() => setSmartSchedulingOpen(true)}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: theme.palette.info.main,
                color: theme.palette.info.main,
                '&:hover': {
                  borderColor: theme.palette.info.dark,
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                },
              }}
            >
              Smart Schedule
            </Button>
            <Tooltip title="Refresh">
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
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.2) },
                }}
              >
                <Badge badgeContent={todayAppointments} color="primary">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {refreshing && <LinearProgress sx={{ mt: 2, borderRadius: 2 }} />}
      </MotionBox>

      {/* Navigation Tabs */}
      <MotionBox
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        sx={{ mb: 4 }}
      >
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: theme.shadows[4],
            background: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{
              px: 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                minHeight: 64,
                '&.Mui-selected': {
                  color: theme.palette.primary.main,
                },
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.main} 100%)`,
              },
            }}
          >
            <Tab
              icon={<CalendarMonthIcon />}
              iconPosition="start"
              label="Calendar & Analytics"
              sx={{ mr: 2 }}
            />
            <Tab
              icon={<HourglassEmptyIcon />}
              iconPosition="start"
              label="Waitlist Management"
            />
          </Tabs>
        </Card>
      </MotionBox>

      {/* Tab Content */}
      {currentTab === 0 && (
        <>
          {/* Quick Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={4} component="div">
              <MotionCard
                initial="hidden"
                animate="visible"
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

            <Grid item xs={12} sm={6} md={4} component="div">
              <MotionCard
                initial="hidden"
                animate="visible"
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
                      <Chip label="Completed" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                    </Stack>
                    <Box>
                      <Typography variant="h3" sx={{ fontWeight: 800 }}>
                        {completedToday}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                        Completed Today
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </MotionCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4} component="div">
              <MotionCard
                initial="hidden"
                animate="visible"
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
                      <CalendarMonthIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                      <Chip label="This Week" size="small" sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }} />
                    </Stack>
                    <Box>
                      <Typography variant="h3" sx={{ fontWeight: 800 }}>
                        {upcomingThisWeek}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                        Upcoming This Week
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </MotionCard>
            </Grid>
          </Grid>

          {/* Main Content Grid - Calendar and Analytics Side by Side */}
          <Grid container spacing={3}>
            {/* Left Column - Appointment Calendar */}
            <Grid item xs={12} lg={6} component="div">
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
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    overflow: 'hidden',
                    height: '100%',
                    minHeight: '700px',
                  }}
                >
                  <Box
                    sx={{
                      p: 2.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.08)} 100%)`,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 44, height: 44 }}>
                          <CalendarMonthIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            Appointment Calendar
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            View and manage all patient appointments
                          </Typography>
                        </Box>
                      </Stack>
                      <IconButton size="small">
                        <MoreVertIcon />
                      </IconButton>
                    </Stack>
                  </Box>
                  <CardContent sx={{ p: 2.5 }}>
                    <ResponsiveAppointmentCalendar />
                  </CardContent>
                </MotionCard>
              </Fade>
            </Grid>

            {/* Right Column - Analytics Dashboard */}
            <Grid item xs={12} lg={6} component="div">
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
                    border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                    height: '100%',
                    minHeight: '700px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box
                    sx={{
                      p: 2.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: theme.palette.success.main, width: 44, height: 44 }}>
                          <AnalyticsIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            Appointment Analytics
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Key performance metrics and insights
                          </Typography>
                        </Box>
                      </Stack>
                      <IconButton size="small">
                        <MoreVertIcon />
                      </IconButton>
                    </Stack>
                  </Box>
                  <CardContent sx={{ p: 2.5, flex: 1, overflow: 'auto' }}>
                    <ErrorBoundary>
                      <React.Suspense fallback={<CircularProgress />}>
                        <AppointmentAnalyticsDashboard compact={true} />
                      </React.Suspense>
                    </ErrorBoundary>
                  </CardContent>
                </MotionCard>
              </Fade>
            </Grid>

            {/* Bottom Row - Schedule, Capacity, and Reminder Charts */}
            <Grid item xs={12} lg={4} component="div">
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
                    border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                    height: '450px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box
                    sx={{
                      p: 2.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: theme.palette.info.main, width: 44, height: 44 }}>
                          <ScheduleIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            Schedule Management
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Pharmacist availability
                          </Typography>
                        </Box>
                      </Stack>
                      <IconButton size="small">
                        <MoreVertIcon />
                      </IconButton>
                    </Stack>
                  </Box>
                  <CardContent sx={{ p: 2.5, flex: 1, overflow: 'auto' }}>
                    <ErrorBoundary>
                      <PharmacistScheduleView
                        pharmacistId={selectedPharmacistId}
                        canEdit={true}
                        showCapacityMetrics={true}
                      />
                    </ErrorBoundary>
                  </CardContent>
                </MotionCard>
              </Fade>
            </Grid>

            {/* Capacity Utilization Chart */}
            <Grid item xs={12} md={6} lg={4} component="div">
              <Fade in timeout={1200}>
                <MotionCard
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ boxShadow: theme.shadows[12] }}
                  sx={{
                    borderRadius: 4,
                    boxShadow: theme.shadows[8],
                    background: theme.palette.background.paper,
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                    height: '450px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box
                    sx={{
                      p: 2.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)} 0%, ${alpha(theme.palette.error.main, 0.08)} 100%)`,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 44, height: 44 }}>
                          <TrendingUpIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            Capacity Utilization
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Appointment slot usage
                          </Typography>
                        </Box>
                      </Stack>
                      <IconButton size="small">
                        <MoreVertIcon />
                      </IconButton>
                    </Stack>
                  </Box>
                  <CardContent sx={{ p: 2.5, flex: 1, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%' }}>
                      <ErrorBoundary>
                        <React.Suspense fallback={<CircularProgress />}>
                          <CapacityUtilizationChart />
                        </React.Suspense>
                      </ErrorBoundary>
                    </Box>
                  </CardContent>
                </MotionCard>
              </Fade>
            </Grid>

            {/* Reminder Effectiveness Chart */}
            <Grid item xs={12} md={6} lg={4} component="div">
              <Fade in timeout={1400}>
                <MotionCard
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ boxShadow: theme.shadows[12] }}
                  sx={{
                    borderRadius: 4,
                    boxShadow: theme.shadows[8],
                    background: theme.palette.background.paper,
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                    height: '450px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box
                    sx={{
                      p: 2.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: theme.palette.secondary.main, width: 44, height: 44 }}>
                          <NotificationsIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            Reminder Effectiveness
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Reminder success rates
                          </Typography>
                        </Box>
                      </Stack>
                      <IconButton size="small">
                        <MoreVertIcon />
                      </IconButton>
                    </Stack>
                  </Box>
                  <CardContent sx={{ p: 2.5, flex: 1, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%' }}>
                      <ErrorBoundary>
                        <React.Suspense fallback={<CircularProgress />}>
                          <ReminderEffectivenessChart />
                        </React.Suspense>
                      </ErrorBoundary>
                    </Box>
                  </CardContent>
                </MotionCard>
              </Fade>
            </Grid>
          </Grid>

        </>
      )}

      {/* Waitlist Management Tab */}
      {currentTab === 1 && (
        <Fade in timeout={600}>
          <Box>
            <WaitlistManagement />
          </Box>
        </Fade>
      )}



      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog
        open={createAppointmentOpen}
        onClose={() => setCreateAppointmentOpen(false)}
      />

      {/* Smart Scheduling Dialog */}
      <SmartSchedulingDialog
        open={smartSchedulingOpen}
        onClose={() => setSmartSchedulingOpen(false)}
      />
    </Box>
  );
};

export default AppointmentManagement;
