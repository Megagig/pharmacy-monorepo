import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientPortalService } from '../../services/patientPortalService';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Divider,
  Paper,
  Stack,
} from '@mui/material';
import {
  Add,
  Schedule,
  CalendarToday,
  AccessTime,
  Person,
  LocationOn,
  Edit,
  Cancel,
  Visibility,
  CheckCircle,
  Warning,
  Error,
  Close,
  Refresh,
} from '@mui/icons-material';
import { format, parseISO, isAfter, isToday, isTomorrow, addDays } from 'date-fns';

import { usePatientAuth } from '../../hooks/usePatientAuth';
import MyAppointmentsList from '../../components/patient-portal/MyAppointmentsList';
import BookAppointmentForm from '../../components/patient-portal/BookAppointmentForm';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`appointments-tabpanel-${index}`}
      aria-labelledby={`appointments-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const PatientAppointments: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated } = usePatientAuth();

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Live stats from patient portal dashboard
  const { data: dashboardData } = useQuery({
    queryKey: ['patient-portal', 'dashboard'],
    queryFn: () => patientPortalService.getDashboardData(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const appointmentStats = useMemo(() => {
    const stats = dashboardData?.data?.stats;
    if (!stats) {
      return {
        upcoming: 0,
        completed: 0,
        cancelled: 0,
        nextAppointment: null as null | { date: string; time: string; type: string; pharmacist?: string },
      };
    }
    const next = stats.nextAppointments && stats.nextAppointments.length > 0 ? stats.nextAppointments[0] : null;
    return {
      upcoming: stats.upcomingAppointments || 0,
      completed: stats.completedAppointments || 0,
      cancelled: stats.cancelledAppointments || 0,
      nextAppointment: next
        ? {
          date: next.date,
          time: next.time,
          type: next.type,
          pharmacist: next.pharmacistName,
        }
        : null,
    };
  }, [dashboardData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleBookingSuccess = (appointment: any) => {
    setShowBookingDialog(false);
    setRefreshKey(prev => prev + 1);
    // Show success message or redirect
  };

  const handleAppointmentUpdate = (appointment: any) => {
    setRefreshKey(prev => prev + 1);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!isAuthenticated || !user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Alert severity="warning">
          Please log in to view your appointments.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: isMobile ? 2 : 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            My Appointments
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your appointments and book new consultations
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            size={isMobile ? 'small' : 'medium'}
          >
            Refresh
          </Button>

          {!isMobile && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowBookingDialog(true)}
              size="large"
            >
              Book Appointment
            </Button>
          )}
        </Box>
      </Box>

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary" gutterBottom>
                {appointmentStats.upcoming}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upcoming
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main" gutterBottom>
                {appointmentStats.completed}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="error.main" gutterBottom>
                {appointmentStats.cancelled}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cancelled
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card sx={{ border: `2px solid ${theme.palette.primary.main}` }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Next Appointment
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {appointmentStats.nextAppointment ? appointmentStats.nextAppointment.date : 'None'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {appointmentStats.nextAppointment?.time || '-'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Next Appointment Highlight */}
      {appointmentStats.nextAppointment ? (
        <Card sx={{ mb: 4, bgcolor: 'primary.50', border: `1px solid ${theme.palette.primary.main}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Schedule color="primary" />
              <Typography variant="h6" color="primary">
                Upcoming Appointment
              </Typography>
            </Box>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CalendarToday fontSize="small" />
                  <Typography variant="body1">
                    {format(parseISO(appointmentStats.nextAppointment.date), 'EEEE, MMMM d, yyyy')}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccessTime fontSize="small" />
                  <Typography variant="body1">
                    {appointmentStats.nextAppointment.time}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person fontSize="small" />
                  <Typography variant="body1">
                    {appointmentStats.nextAppointment.pharmacist}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="h6" gutterBottom>
                  {appointmentStats.nextAppointment.type}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Visibility />}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Edit />}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Cancel />}
                  >
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : null}

      {/* Main Content Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="appointment management tabs"
            variant={isMobile ? 'fullWidth' : 'standard'}
          >
            <Tab
              label="All Appointments"
              icon={<Schedule />}
              iconPosition="start"
              id="appointments-tab-0"
              aria-controls="appointments-tabpanel-0"
            />
            <Tab
              label="Book New"
              icon={<Add />}
              iconPosition="start"
              id="appointments-tab-1"
              aria-controls="appointments-tabpanel-1"
            />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <MyAppointmentsList
            key={refreshKey}
            workplaceId={user.workspaceId}
            patientId={user.id}
            onAppointmentUpdate={handleAppointmentUpdate}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <BookAppointmentForm
            workplaceId={user.workspaceId}
            patientId={user.id}
            onSuccess={handleBookingSuccess}
            onCancel={() => setActiveTab(0)}
          />
        </TabPanel>
      </Card>

      {/* Mobile FAB for booking */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="book appointment"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          onClick={() => setShowBookingDialog(true)}
        >
          <Add />
        </Fab>
      )}

      {/* Mobile Booking Dialog */}
      <Dialog
        open={showBookingDialog}
        onClose={() => setShowBookingDialog(false)}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Book New Appointment</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setShowBookingDialog(false)}
              aria-label="close"
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <BookAppointmentForm
            workplaceId={user.workspaceId}
            patientId={user.id}
            onSuccess={handleBookingSuccess}
            onCancel={() => setShowBookingDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default PatientAppointments;