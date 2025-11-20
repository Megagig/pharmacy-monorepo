import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Skeleton,
  Alert,
  Button,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import TimelineIcon from '@mui/icons-material/Timeline';
import ScienceIcon from '@mui/icons-material/Science';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MedicationIcon from '@mui/icons-material/Medication';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { usePatientLabOrders } from '../hooks/useManualLabOrders';
import { ManualLabOrder } from '../types/manualLabOrder';
import { formatDate, formatRelativeTime } from '../utils/formatters';

interface PatientTimelineWidgetProps {
  patientId: string;
  maxItems?: number;
  onViewLabOrder?: (orderId: string) => void;
  onViewClinicalNote?: (noteId: string) => void;
  onViewMTR?: (mtrId: string) => void;
}

interface TimelineEvent {
  id: string;
  type: 'lab_order' | 'clinical_note' | 'mtr' | 'medication';
  title: string;
  description: string;
  date: string;
  status?: string;
  priority?: string;
  data?: unknown;
}

const PatientTimelineWidget: React.FC<PatientTimelineWidgetProps> = ({
  patientId,
  maxItems = 10,
  onViewLabOrder,
  onViewClinicalNote,
  onViewMTR,
}) => {
  const theme = useTheme();

  // Fetch lab orders
  const {
    data: labOrders = [],
    isLoading: labOrdersLoading,
    isError: labOrdersError,
    refetch: refetchLabOrders,
  } = usePatientLabOrders(patientId, { enabled: !!patientId });

  // TODO: Add hooks for clinical notes and MTRs when available
  // const { data: clinicalNotes = [] } = usePatientClinicalNotes(patientId);
  // const { data: mtrs = [] } = usePatientMTRs(patientId);

  // Combine all events into a timeline
  const timelineEvents = useMemo((): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Add lab orders
    labOrders.forEach((order: ManualLabOrder) => {
      events.push({
        id: order.orderId,
        type: 'lab_order',
        title: `Lab Order ${order.orderId}`,
        description: `${order.tests.length} test${
          order.tests.length !== 1 ? 's' : ''
        } ordered: ${order.indication}`,
        date: order.createdAt,
        status: order.status,
        priority: order.priority,
        data: order,
      });

      // Add results entry as separate event if completed
      if (order.status === 'completed' && order.updatedAt !== order.createdAt) {
        events.push({
          id: `${order.orderId}_results`,
          type: 'lab_order',
          title: `Lab Results ${order.orderId}`,
          description: `Results entered for ${order.tests.length} test${
            order.tests.length !== 1 ? 's' : ''
          }`,
          date: order.updatedAt,
          status: 'results_entered',
          data: order,
        });
      }
    });

    // TODO: Add clinical notes and MTRs
    // clinicalNotes.forEach(note => { ... });
    // mtrs.forEach(mtr => { ... });

    // Sort by date (newest first)
    events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return events.slice(0, maxItems);
  }, [labOrders, maxItems]);

  const getEventIcon = (event: TimelineEvent) => {
    switch (event.type) {
      case 'lab_order':
        return event.status === 'results_entered' ? (
          <AssignmentIcon />
        ) : (
          <ScienceIcon />
        );
      case 'clinical_note':
        return <AssignmentIcon />;
      case 'mtr':
        return <MedicationIcon />;
      default:
        return <TimelineIcon />;
    }
  };

  const getEventColor = (event: TimelineEvent) => {
    switch (event.type) {
      case 'lab_order':
        if (
          event.status === 'completed' ||
          event.status === 'results_entered'
        ) {
          return theme.palette.success.main;
        } else if (event.status === 'result_awaited') {
          return theme.palette.warning.main;
        } else if (event.status === 'referred') {
          return theme.palette.error.main;
        }
        return theme.palette.primary.main;
      case 'clinical_note':
        return theme.palette.info.main;
      case 'mtr':
        return theme.palette.secondary.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getStatusChip = (event: TimelineEvent) => {
    if (!event.status) return null;

    let color:
      | 'default'
      | 'primary'
      | 'secondary'
      | 'error'
      | 'info'
      | 'success'
      | 'warning' = 'default';
    let label = event.status;

    switch (event.status) {
      case 'completed':
      case 'results_entered':
        color = 'success';
        label =
          event.status === 'results_entered' ? 'Results Entered' : 'Completed';
        break;
      case 'requested':
        color = 'info';
        label = 'Requested';
        break;
      case 'sample_collected':
        color = 'primary';
        label = 'Sample Collected';
        break;
      case 'result_awaited':
        color = 'warning';
        label = 'Awaiting Results';
        break;
      case 'referred':
        color = 'error';
        label = 'Referred';
        break;
    }

    return <Chip label={label} size="small" color={color} />;
  };

  const handleEventClick = (event: TimelineEvent) => {
    switch (event.type) {
      case 'lab_order':
        if (onViewLabOrder) {
          onViewLabOrder(event.data.orderId);
        }
        break;
      case 'clinical_note':
        if (onViewClinicalNote) {
          onViewClinicalNote(event.id);
        }
        break;
      case 'mtr':
        if (onViewMTR) {
          onViewMTR(event.id);
        }
        break;
    }
  };

  if (labOrdersLoading) {
    return (
      <Card>
        <CardHeader title="Patient Timeline" />
        <CardContent>
          <List>
            {[...Array(5)].map((_, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <Skeleton variant="circular" width={40} height={40} />
                </ListItemIcon>
                <ListItemText
                  primary={<Skeleton variant="text" width="60%" />}
                  secondary={<Skeleton variant="text" width="80%" />}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  }

  if (labOrdersError) {
    return (
      <Card>
        <CardHeader title="Patient Timeline" />
        <CardContent>
          <Alert severity="error">
            <Typography variant="body2">
              Failed to load timeline data:{' '}
              {labOrdersError instanceof Error
                ? labOrdersError.message
                : 'Unknown error'}
            </Typography>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => refetchLabOrders()}
              sx={{ mt: 1 }}
            >
              Retry
            </Button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Patient Timeline
            </Typography>
          </Box>
        }
        action={
          <IconButton onClick={() => refetchLabOrders()}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <CardContent>
        {timelineEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <TimelineIcon
              sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              No recent activity
            </Typography>
          </Box>
        ) : (
          <Timeline>
            {timelineEvents.map((event, index) => (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ flex: 0.3, py: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatRelativeTime(event.date)}
                  </Typography>
                  <Typography
                    variant="caption"
                    display="block"
                    color="text.secondary"
                  >
                    {formatDate(event.date)}
                  </Typography>
                </TimelineOppositeContent>

                <TimelineSeparator>
                  <TimelineDot sx={{ bgcolor: getEventColor(event) }}>
                    {getEventIcon(event)}
                  </TimelineDot>
                  {index < timelineEvents.length - 1 && <TimelineConnector />}
                </TimelineSeparator>

                <TimelineContent sx={{ py: 2 }}>
                  <Box
                    sx={{
                      cursor: 'pointer',
                      p: 2,
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => handleEventClick(event)}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 1,
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {event.title}
                      </Typography>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        {getStatusChip(event)}
                        <IconButton size="small">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      {event.description}
                    </Typography>

                    {event.priority && event.priority !== 'routine' && (
                      <Chip
                        label={event.priority.toUpperCase()}
                        size="small"
                        color={event.priority === 'stat' ? 'error' : 'warning'}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientTimelineWidget;
