import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  Chip,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Assignment,
  NoteAdd,
  Science,
  FilterList,
  DateRange,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useUnifiedPatientTimeline } from '../hooks/useIntegration';
import { format, parseISO } from 'date-fns';

interface UnifiedPatientTimelineProps {
  patientId: string;
  maxItems?: number;
  showFilters?: boolean;
  onEventClick?: (event: TimelineEvent) => void;
}

interface TimelineEvent {
  type: 'diagnostic' | 'clinical_note' | 'mtr';
  id: string;
  date: string;
  title: string;
  summary: string;
  priority?: string;
  status?: string;
  data: any;
}

interface TimelineFilters {
  eventType: 'all' | 'diagnostic' | 'clinical_note' | 'mtr';
  startDate: Date | null;
  endDate: Date | null;
  priority: 'all' | 'low' | 'medium' | 'high';
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'diagnostic':
      return <Science />;
    case 'clinical_note':
      return <NoteAdd />;
    case 'mtr':
      return <Assignment />;
    default:
      return <Science />;
  }
};

const getEventColor = (type: string, priority?: string, status?: string) => {
  if (priority === 'high' || status === 'critical') return 'error';
  if (priority === 'medium' || status === 'urgent') return 'warning';

  switch (type) {
    case 'diagnostic':
      return 'primary';
    case 'clinical_note':
      return 'secondary';
    case 'mtr':
      return 'info';
    default:
      return 'default';
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
    case 'processing':
      return 'info';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
};

const TimelineEventItem: React.FC<{
  event: TimelineEvent;
  isLast: boolean;
  onEventClick?: (event: TimelineEvent) => void;
}> = ({ event, isLast, onEventClick }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
  };

  const handleEventClick = () => {
    onEventClick?.(event);
  };

  return (
    <TimelineItem>
      <TimelineSeparator>
        <TimelineDot
          color={getEventColor(event.type, event.priority, event.status)}
        >
          {getEventIcon(event.type)}
        </TimelineDot>
        {!isLast && <TimelineConnector />}
      </TimelineSeparator>
      <TimelineContent>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ pb: 1 }}>
            <Box
              display="flex"
              justifyContent="between"
              alignItems="flex-start"
              mb={1}
            >
              <Box flex={1}>
                <Typography
                  variant="h6"
                  component="div"
                  sx={{
                    cursor: onEventClick ? 'pointer' : 'default',
                    '&:hover': onEventClick
                      ? { textDecoration: 'underline' }
                      : {},
                  }}
                  onClick={handleEventClick}
                >
                  {event.title}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {format(parseISO(event.date), 'PPp')}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                {event.priority && (
                  <Chip
                    label={event.priority}
                    size="small"
                    color={getPriorityColor(event.priority)}
                    variant="outlined"
                  />
                )}
                {event.status && (
                  <Chip
                    label={event.status}
                    size="small"
                    color={getStatusColor(event.status)}
                    variant="filled"
                  />
                )}
                <IconButton
                  size="small"
                  onClick={handleToggleExpanded}
                  aria-label="expand"
                >
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
            </Box>

            <Typography variant="body2" color="textSecondary">
              {event.summary}
            </Typography>

            <Collapse in={expanded}>
              <Box mt={2}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Event Details
                </Typography>

                {/* Event-specific details */}
                {event.type === 'diagnostic' && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      <strong>Type:</strong> Diagnostic Assessment
                    </Typography>
                    {event.data?.clinicalContext?.chiefComplaint && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Chief Complaint:</strong>{' '}
                        {event.data.clinicalContext.chiefComplaint}
                      </Typography>
                    )}
                    {event.data?.inputSnapshot?.symptoms?.subjective && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Symptoms:</strong>{' '}
                        {event.data.inputSnapshot.symptoms.subjective.join(
                          ', '
                        )}
                      </Typography>
                    )}
                  </Box>
                )}

                {event.type === 'clinical_note' && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      <strong>Type:</strong>{' '}
                      {event.data?.type || 'Clinical Note'}
                    </Typography>
                    {event.data?.content?.assessment && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Assessment:</strong>{' '}
                        {event.data.content.assessment.substring(0, 200)}
                        {event.data.content.assessment.length > 200 && '...'}
                      </Typography>
                    )}
                    {event.data?.followUpRequired && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Follow-up Required:</strong> Yes
                        {event.data.followUpDate &&
                          ` (${format(parseISO(event.data.followUpDate), 'PP')})`}
                      </Typography>
                    )}
                  </Box>
                )}

                {event.type === 'mtr' && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      <strong>Review Number:</strong> {event.data?.reviewNumber}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <strong>Review Type:</strong> {event.data?.reviewType}
                    </Typography>
                    {event.data?.medications?.length > 0 && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Medications:</strong>{' '}
                        {event.data.medications.length} reviewed
                      </Typography>
                    )}
                    {event.data?.completionPercentage !== undefined && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Progress:</strong>{' '}
                        {event.data.completionPercentage}% complete
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </TimelineContent>
    </TimelineItem>
  );
};

export const UnifiedPatientTimeline: React.FC<UnifiedPatientTimelineProps> = ({
  patientId,
  maxItems = 20,
  showFilters = true,
  onEventClick,
}) => {
  const [filters, setFilters] = useState<TimelineFilters>({
    eventType: 'all',
    startDate: null,
    endDate: null,
    priority: 'all',
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const {
    data: timelineData,
    isLoading,
    error,
    refetch,
  } = useUnifiedPatientTimeline(patientId, {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    limit: maxItems,
  });

  const handleFilterChange = (field: keyof TimelineFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      eventType: 'all',
      startDate: null,
      endDate: null,
      priority: 'all',
    });
  };

  const applyFilters = () => {
    refetch();
    setShowFilterPanel(false);
  };

  // Filter events based on client-side filters
  const filteredEvents =
    timelineData?.data?.timeline?.filter((event: TimelineEvent) => {
      if (filters.eventType !== 'all' && event.type !== filters.eventType) {
        return false;
      }
      if (filters.priority !== 'all' && event.priority !== filters.priority) {
        return false;
      }
      return true;
    }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" p={3}>
            <CircularProgress />
            <Typography variant="body2" ml={2}>
              Loading patient timeline...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Failed to load patient timeline. Please try again.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
          <Typography variant="h6">Patient Timeline</Typography>
          {showFilters && (
            <Button
              startIcon={<FilterList />}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              variant="outlined"
              size="small"
            >
              Filters
            </Button>
          )}
        </Box>

        {/* Filter Panel */}
        <Collapse in={showFilterPanel}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Filter Timeline Events
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Event Type</InputLabel>
                  <Select
                    value={filters.eventType}
                    onChange={(e) =>
                      handleFilterChange('eventType', e.target.value)
                    }
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="diagnostic">Diagnostic</MenuItem>
                    <MenuItem value="clinical_note">Clinical Notes</MenuItem>
                    <MenuItem value="mtr">MTR</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    onChange={(e) =>
                      handleFilterChange('priority', e.target.value)
                    }
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>

                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(date) => handleFilterChange('startDate', date)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <DatePicker
                    label="End Date"
                    value={filters.endDate}
                    onChange={(date) => handleFilterChange('endDate', date)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </LocalizationProvider>
              </Box>
              <Box display="flex" gap={1}>
                <Button onClick={applyFilters} variant="contained" size="small">
                  Apply Filters
                </Button>
                <Button onClick={clearFilters} variant="outlined" size="small">
                  Clear
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Collapse>

        {/* Timeline */}
        {filteredEvents.length === 0 ? (
          <Alert severity="info">
            No timeline events found for this patient.
          </Alert>
        ) : (
          <Timeline>
            {filteredEvents.map((event: TimelineEvent, index: number) => (
              <TimelineEventItem
                key={event.id}
                event={event}
                isLast={index === filteredEvents.length - 1}
                onEventClick={onEventClick}
              />
            ))}
          </Timeline>
        )}

        {filteredEvents.length > 0 && (
          <Box mt={2} textAlign="center">
            <Typography variant="body2" color="textSecondary">
              Showing {filteredEvents.length} of{' '}
              {timelineData?.data?.count || 0} events
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
