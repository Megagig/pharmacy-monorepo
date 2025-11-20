import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Pill,
  MessageCircle,
  FileText,
  AlertCircle,
  Activity,
  Heart,
  Thermometer,
  Weight,
  BookOpen,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { Box, Typography, LinearProgress, CircularProgress, Grid } from '@mui/material';
import PatientOnboarding from '../../components/patient-portal/PatientOnboarding';
import { patientPortalService, DashboardData } from '../../services/patientPortalService';
import EducationalResourceCard from '../../components/educational-resources/EducationalResourceCard';
import RecommendationsCarousel from '../../components/recommendations/RecommendationsCarousel';

interface VitalReading {
  type: 'blood_pressure' | 'weight' | 'glucose' | 'temperature';
  value: string;
  unit: string;
  date: string;
  status: 'normal' | 'high' | 'low';
}

export const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await patientPortalService.getDashboardData();

        if (response.success && response.data) {
          setDashboardData(response.data);

          // Check if onboarding should be shown
          if (!response.data.user.onboardingCompleted) {
            setShowOnboarding(true);
          }
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    // Optionally update backend that onboarding is completed
    // This can be done through a separate API call if needed
  };

  const getVitalIcon = (type: VitalReading['type']) => {
    switch (type) {
      case 'blood_pressure':
        return <Heart className="h-4 w-4" />;
      case 'weight':
        return <Weight className="h-4 w-4" />;
      case 'glucose':
        return <Activity className="h-4 w-4" />;
      case 'temperature':
        return <Thermometer className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'high':
        return 'warning';
      case 'low':
        return 'error';
      default:
        return 'primary';
    }
  };

  const getAdherenceColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 80) return 'warning';
    return 'error';
  };

  // Navigation functions
  const navigateToAppointments = () => {
    navigate(`/patient-portal/${workspaceId}/appointments`);
  };

  const navigateToMedications = () => {
    navigate(`/patient-portal/${workspaceId}/medications`);
  };

  const navigateToMessages = () => {
    navigate(`/patient-portal/${workspaceId}/messages`);
  };

  const navigateToHealthRecords = () => {
    navigate(`/patient-portal/${workspaceId}/health-records`);
  };

  const navigateToEducation = () => {
    navigate(`/patient-portal/${workspaceId}/education`);
  };

  const handleBookAppointment = () => {
    navigateToAppointments();
  };

  const handleRequestRefill = () => {
    navigateToMedications();
  };

  const handleMessagePharmacist = () => {
    navigateToMessages();
  };

  const handleViewHealthRecords = () => {
    navigateToHealthRecords();
  };

  const handleLogVitals = () => {
    navigateToHealthRecords();
  };

  // Loading state
  if (loading) {
    return (
      <Box className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Box className="text-center">
          <CircularProgress size={60} />
          <Typography variant="h6" className="mt-4 text-gray-700 dark:text-gray-300">
            Loading your dashboard...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error || !dashboardData) {
    return (
      <Box className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Box className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <span>{error || 'Failed to load dashboard data. Please try again.'}</span>
          </Alert>
        </Box>
      </Box>
    );
  }

  const { user, stats, upcomingAppointments, currentMedications, recentMessages, recentVitals, recentHealthRecords, educationalResources } = dashboardData;

  return (
    <Box className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Box className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <Box className="mb-8">
          <Typography variant="h4" className="text-gray-900 dark:text-white font-bold">
            Welcome back, {user.firstName}!
          </Typography>
          <Typography variant="body1" className="text-gray-600 dark:text-gray-400 mt-1">
            Here's an overview of your health information
          </Typography>
        </Box>

        {/* Quick Stats */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
            <Card className="p-6">
              <Box className="flex items-center">
                <Box className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </Box>
                <Box className="ml-4">
                  <Typography variant="h6" className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.upcomingAppointments}
                  </Typography>
                  <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                    Upcoming Appointments
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
            <Card className="p-6">
              <Box className="flex items-center">
                <Box className="flex-shrink-0">
                  <Pill className="h-8 w-8 text-green-600" />
                </Box>
                <Box className="ml-4">
                  <Typography variant="h6" className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.activeMedications}
                  </Typography>
                  <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                    Active Medications
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
            <Card className="p-6">
              <Box className="flex items-center">
                <Box className="flex-shrink-0">
                  <MessageCircle className="h-8 w-8 text-purple-600" />
                </Box>
                <Box className="ml-4">
                  <Typography variant="h6" className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.unreadMessages}
                  </Typography>
                  <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                    Unread Messages
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
            <Card className="p-6">
              <Box className="flex items-center">
                <Box className="flex-shrink-0">
                  <AlertCircle className="h-8 w-8 text-orange-600" />
                </Box>
                <Box className="ml-4">
                  <Typography variant="h6" className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.pendingRefills}
                  </Typography>
                  <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                    Pending Refills
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Box>
        </Box>

        {/* Main Content Grid */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {/* Left Column */}
          <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 calc(66.67% - 24px)' } }}>
            {/* Upcoming Appointments */}
            <Card className="p-6 mb-6">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Upcoming Appointments
                </Typography>
                <Button variant="outline" size="sm" onClick={navigateToAppointments}>
                  View All
                </Button>
              </Box>

              <Box className="space-y-4">
                {upcomingAppointments.length > 0 ? (
                  upcomingAppointments.map((appointment) => (
                    <Box key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Box className="flex items-center space-x-4">
                        <Box className="flex-shrink-0">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" className="font-medium text-gray-900 dark:text-white">
                            {appointment.type}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                            {new Date(appointment.date).toLocaleDateString()} at {appointment.time}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                            with {appointment.pharmacistName}
                          </Typography>
                        </Box>
                      </Box>
                      <Box className="flex items-center space-x-2">
                        <Badge
                          variant={appointment.status === 'confirmed' ? 'success' : 'warning'}
                          size="sm"
                        >
                          {appointment.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={navigateToAppointments}>
                          Reschedule
                        </Button>
                      </Box>
                    </Box>
                  ))
                ) : (
                  <Box className="text-center py-8">
                    <Typography variant="body1" className="text-gray-500 dark:text-gray-400">
                      No upcoming appointments
                    </Typography>
                    <Button variant="primary" size="sm" className="mt-4" onClick={handleBookAppointment}>
                      Book an Appointment
                    </Button>
                  </Box>
                )}
              </Box>
            </Card>

            {/* Current Medications */}
            <Card className="p-6 mb-6">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current Medications
                </Typography>
                <Button variant="outline" size="sm" onClick={navigateToMedications}>
                  View All
                </Button>
              </Box>

              <Box className="space-y-4">
                {currentMedications.length > 0 ? (
                  currentMedications.slice(0, 3).map((medication) => (
                    <Box key={medication.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Box className="flex items-start justify-between">
                        <Box className="flex-1">
                          <Typography variant="subtitle1" className="font-medium text-gray-900 dark:text-white">
                            {medication.name} {medication.dosage}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                            {medication.frequency}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                            Next refill: {medication.nextRefillDate ? new Date(medication.nextRefillDate).toLocaleDateString() : 'N/A'}
                          </Typography>
                        </Box>
                        <Box className="text-right">
                          <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-1">
                            Adherence
                          </Typography>
                          <Box className="flex items-center space-x-2">
                            <LinearProgress
                              variant="determinate"
                              value={medication.adherenceScore}
                              className="w-16"
                              color={getAdherenceColor(medication.adherenceScore) as any}
                            />
                            <Typography variant="body2" className="text-gray-900 dark:text-white font-medium">
                              {medication.adherenceScore}%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {medication.refillsRemaining === 0 && (
                        <Box className="mt-3">
                          <Alert variant="warning">
                            <AlertCircle className="h-4 w-4" />
                            <span>Refill needed - contact your pharmacy</span>
                          </Alert>
                        </Box>
                      )}
                    </Box>
                  ))
                ) : (
                  <Box className="text-center py-8">
                    <Typography variant="body1" className="text-gray-500 dark:text-gray-400">
                      No active medications
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>

            {/* Recent Health Records */}
            <Card className="p-6 mb-6">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Health Records
                </Typography>
                <Button variant="outline" size="sm" onClick={navigateToHealthRecords}>
                  View All
                </Button>
              </Box>

              <Box className="space-y-3">
                {recentHealthRecords.map((record) => (
                  <Box 
                    key={record.id} 
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                    onClick={navigateToHealthRecords}
                  >
                    <Box className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <Box>
                        <Typography variant="subtitle2" className="font-medium text-gray-900 dark:text-white">
                          {record.title}
                        </Typography>
                        <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                          {new Date(record.date).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                    {record.status === 'new' && (
                      <Badge variant="primary" size="sm">
                        New
                      </Badge>
                    )}
                  </Box>
                ))}
              </Box>
            </Card>

            {/* Educational Resources */}
            <Card className="p-6 mb-6">
              <Box className="flex items-center justify-between mb-4">
                <Box className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <Typography variant="h6" className="text-lg font-semibold text-gray-900 dark:text-white">
                    Featured Resources
                  </Typography>
                </Box>
                <Button variant="outline" size="sm" onClick={navigateToEducation}>
                  View All
                </Button>
              </Box>

              <Box>
                {educationalResources && educationalResources.length > 0 ? (
                  <Grid container spacing={2}>
                    {educationalResources.slice(0, 3).map((resource) => (
                      <Grid item xs={12} sm={6} md={4} key={resource.id}>
                        <EducationalResourceCard 
                          resource={resource} 
                          compact 
                          onClick={() => navigateToEducation()}
                        />
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Box className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <Typography variant="body1" className="text-gray-500 dark:text-gray-400">
                      No educational resources available at this time
                    </Typography>
                    <Typography variant="body2" className="text-gray-400 dark:text-gray-500 mt-1">
                      Check back later for health education materials
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>

            {/* Personalized Recommendations Carousel */}
            <Card className="p-6">
              <RecommendationsCarousel 
                workspaceId={workspaceId || ''} 
                type="personalized"
                maxItems={6}
              />
            </Card>
          </Box>

          {/* Right Column */}
          <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 calc(33.33% - 24px)' } }}>
            {/* Quick Actions */}
            <Card className="p-6 mb-6">
              <Typography variant="h6" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </Typography>

              <Box className="space-y-3">
                <Button variant="primary" className="w-full justify-start" onClick={handleBookAppointment}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Appointment
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleRequestRefill}>
                  <Pill className="h-4 w-4 mr-2" />
                  Request Refill
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleMessagePharmacist}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message Pharmacist
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleViewHealthRecords}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Health Records
                </Button>
              </Box>
            </Card>

            {/* Recent Messages */}
            <Card className="p-6 mb-6">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Messages
                </Typography>
                <Button variant="outline" size="sm" onClick={navigateToMessages}>
                  View All
                </Button>
              </Box>

              <Box className="space-y-3">
                {recentMessages.length > 0 ? (
                  recentMessages.slice(0, 3).map((message) => (
                    <Box 
                      key={message.id} 
                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                      onClick={navigateToMessages}
                    >
                      <Box className="flex items-start justify-between">
                        <Box className="flex-1 min-w-0">
                          <Typography variant="subtitle2" className={`font-medium ${!message.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                            {message.from}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600 dark:text-gray-400 truncate">
                            {message.subject}
                          </Typography>
                          <Typography variant="caption" className="text-gray-500 dark:text-gray-500">
                            {message.timestamp}
                          </Typography>
                        </Box>
                        {!message.isRead && (
                          <Box className="w-2 h-2 bg-blue-600 rounded-full ml-2 mt-2"></Box>
                        )}
                      </Box>
                    </Box>
                  ))
                ) : (
                  <Box className="text-center py-8">
                    <Typography variant="body1" className="text-gray-500 dark:text-gray-400">
                      No messages yet
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>

            {/* Recent Vitals */}
            <Card className="p-6">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Vitals
                </Typography>
                <Button variant="outline" size="sm" onClick={handleLogVitals}>
                  Log Vitals
                </Button>
              </Box>

              <Box className="space-y-3">
                {recentVitals.length > 0 ? (
                  recentVitals.map((vital, index) => (
                    <Box key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Box className="flex items-center space-x-3">
                        {getVitalIcon(vital.type)}
                        <Box>
                          <Typography variant="subtitle2" className="font-medium text-gray-900 dark:text-white capitalize">
                            {vital.type.replace('_', ' ')}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                            {new Date(vital.date).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                      <Box className="text-right">
                        <Typography variant="subtitle2" className="font-medium text-gray-900 dark:text-white">
                          {vital.value} {vital.unit}
                        </Typography>
                        <Badge variant={getStatusColor(vital.status) as any} size="sm">
                          {vital.status}
                        </Badge>
                      </Box>
                    </Box>
                  ))
                ) : (
                  <Box className="text-center py-8">
                    <Typography variant="body1" className="text-gray-500 dark:text-gray-400">
                      No vitals recorded yet
                    </Typography>
                    <Button variant="primary" size="sm" className="mt-4" onClick={handleLogVitals}>
                      Log Your First Vital
                    </Button>
                  </Box>
                )}
              </Box>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Patient Onboarding Modal */}
      <PatientOnboarding
        open={showOnboarding}
        onClose={handleOnboardingComplete}
        workspaceName={user.workspaceName}
        patientName={user.firstName}
      />
    </Box>
  );
};

export default PatientDashboard;