import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
} from '@mui/lab';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import { format, parseISO } from 'date-fns';
import {
  useClinicalIntervention,
  useUpdateIntervention,
} from '../queries/useClinicalInterventions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const ClinicalInterventionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState(0);

  // API queries
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useClinicalIntervention(id || '');
  const updateMutation = useUpdateIntervention();

  const intervention = response?.data;

  const handleStatusChange = async (
    newStatus:
      | 'identified'
      | 'planning'
      | 'in_progress'
      | 'implemented'
      | 'completed'
      | 'cancelled'
  ) => {
    if (id) {
      await updateMutation.mutateAsync({
        interventionId: id,
        updates: { status: newStatus },
      });
      refetch();
    }
  };

  const getPriorityColor = (
    priority: string
  ): 'error' | 'warning' | 'info' | 'default' => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (
    status: string
  ): 'success' | 'info' | 'primary' | 'warning' | 'default' | 'error' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'implemented':
        return 'primary';
      case 'planning':
        return 'warning';
      case 'identified':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !intervention) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error?.message || 'Failed to load intervention details'}
      </Alert>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Clinical Intervention Details
          </Typography>
          <Box display="flex" gap={1}>
            <Chip
              label={intervention.priority.toUpperCase()}
              color={getPriorityColor(intervention.priority)}
            />
            <Chip
              label={intervention.status
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())}
              color={getStatusColor(intervention.status)}
            />
          </Box>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/interventions/${id}/edit`)}
          >
            Edit
          </Button>
          {intervention.followUp?.required && (
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => navigate(`/interventions/${id}/schedule-followup`)}
              color="primary"
            >
              Schedule Follow-up
            </Button>
          )}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={intervention.status}
              label="Status"
              onChange={(e) =>
                handleStatusChange(
                  e.target.value as
                    | 'identified'
                    | 'planning'
                    | 'in_progress'
                    | 'implemented'
                    | 'completed'
                    | 'cancelled'
                )
              }
            >
              <MenuItem value="identified">Identified</MenuItem>
              <MenuItem value="planning">Planning</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="implemented">Implemented</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Patient Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Patient Information
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <Box display="flex" alignItems="center" gap={2}>
                <PersonIcon color="action" />
                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    {intervention.patient
                      ? `${intervention.patient.firstName} ${intervention.patient.lastName}`
                      : 'Unknown Patient'}
                  </Typography>
                  {intervention.patient?.dateOfBirth && (
                    <Typography variant="body2" color="text.secondary">
                      DOB:{' '}
                      {format(
                        parseISO(intervention.patient.dateOfBirth),
                        'MMM dd, yyyy'
                      )}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <Box display="flex" gap={2}>
                {intervention.patient?.phoneNumber && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {intervention.patient.phoneNumber}
                    </Typography>
                  </Box>
                )}
                {intervention.patient?.email && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <EmailIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {intervention.patient.email}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Box display="flex" flexWrap="wrap" gap={2}>
        <Box sx={{ width: { xs: '100%', md: '66%' } }}>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Overview" />
              <Tab label="Strategies" />
              <Tab label="Outcomes" />
              <Tab label="Timeline" />
            </Tabs>

            <TabPanel value={activeTab} index={0}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Issue Description
                  </Typography>
                  <Typography variant="body1" paragraph>
                    {intervention.issueDescription}
                  </Typography>

                  <Typography variant="h6" gutterBottom>
                    Intervention Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Category:{' '}
                    {intervention.category
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Priority: {intervention.priority.toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status:{' '}
                    {intervention.status
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Typography>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <Card>
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Typography variant="h6">Strategies</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                    >
                      Add Strategy
                    </Button>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    No strategies have been added yet.
                  </Typography>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <Card>
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Typography variant="h6">Outcomes</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<TrendingUpIcon />}
                    >
                      Record Outcome
                    </Button>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    No outcomes have been recorded yet.
                  </Typography>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Intervention Timeline
                  </Typography>
                  <Timeline>
                    <TimelineItem>
                      <TimelineOppositeContent color="text.secondary">
                        {format(
                          parseISO(intervention.createdAt),
                          'MMM dd, yyyy HH:mm'
                        )}
                      </TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot color="primary">
                          <InfoIcon />
                        </TimelineDot>
                        <TimelineConnector />
                      </TimelineSeparator>
                      <TimelineContent>
                        <Typography variant="h6" component="span">
                          Intervention Created
                        </Typography>
                        <Typography>Issue identified and recorded</Typography>
                      </TimelineContent>
                    </TimelineItem>

                    {intervention.updatedAt &&
                      intervention.updatedAt !== intervention.createdAt && (
                        <TimelineItem>
                          <TimelineOppositeContent color="text.secondary">
                            {format(
                              parseISO(intervention.updatedAt),
                              'MMM dd, yyyy HH:mm'
                            )}
                          </TimelineOppositeContent>
                          <TimelineSeparator>
                            <TimelineDot color="info">
                              <EditIcon />
                            </TimelineDot>
                          </TimelineSeparator>
                          <TimelineContent>
                            <Typography variant="h6" component="span">
                              Intervention Updated
                            </Typography>
                            <Typography>Last modification made</Typography>
                          </TimelineContent>
                        </TimelineItem>
                      )}
                  </Timeline>
                </CardContent>
              </Card>
            </TabPanel>
          </Paper>
        </Box>

        <Box sx={{ width: { xs: '100%', md: '33%' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<AssignmentIcon />}
                  fullWidth
                >
                  Assign Team Member
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TrendingUpIcon />}
                  fullWidth
                >
                  Record Outcome
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ScheduleIcon />}
                  fullWidth
                >
                  Schedule Follow-up
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default ClinicalInterventionDetails;
