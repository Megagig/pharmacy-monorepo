import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Avatar,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Tooltip,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Message as MessageIcon,
  Group as GroupIcon,
  AttachFile as AttachFileIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  differenceInMinutes,
} from 'date-fns';

interface AuditEvent {
  _id: string;
  action: string;
  timestamp: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  targetId: string;
  targetType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
  details: {
    conversationId?: string;
    messageId?: string;
    patientId?: string;
    fileName?: string;
    metadata?: Record<string, any>;
  };
  duration?: number;
  ipAddress: string;
}

interface AuditTrailVisualizationProps {
  conversationId: string;
  height?: string;
  showFilters?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const AuditTrailVisualization: React.FC<AuditTrailVisualizationProps> = ({
  conversationId,
  height = '600px',
  showFilters = true,
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    riskLevel: '',
    userId: '',
    success: '',
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Fetch audit trail
  const fetchAuditTrail = async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(
        `/api/communication/audit/conversation/${conversationId}?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch audit trail');
      }

      const data = await response.json();
      setEvents(data.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch audit trail'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditTrail();
  }, [conversationId, filters]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchAuditTrail, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, conversationId, filters]);

  // Get icon for action type
  const getActionIcon = (action: string, riskLevel: string) => {
    const iconProps = {
      fontSize: 'small' as const,
      color: getRiskColor(riskLevel),
    };

    switch (action) {
      case 'message_sent':
        return <MessageIcon {...iconProps} />;
      case 'message_read':
        return <VisibilityIcon {...iconProps} />;
      case 'message_edited':
        return <EditIcon {...iconProps} />;
      case 'message_deleted':
        return <DeleteIcon {...iconProps} />;
      case 'conversation_created':
      case 'conversation_updated':
        return <GroupIcon {...iconProps} />;
      case 'participant_added':
      case 'participant_removed':
        return <PersonIcon {...iconProps} />;
      case 'file_uploaded':
      case 'file_downloaded':
        return <AttachFileIcon {...iconProps} />;
      default:
        return <SecurityIcon {...iconProps} />;
    }
  };

  // Get risk level color
  const getRiskColor = (
    riskLevel: string
  ): 'success' | 'warning' | 'error' | 'default' => {
    switch (riskLevel) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  // Format action name
  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = parseISO(timestamp);

    if (isToday(date)) {
      return `Today at ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM dd, yyyy HH:mm');
    }
  };

  // Get time difference for timeline spacing
  const getTimeDifference = (current: string, previous?: string) => {
    if (!previous) return 0;
    return differenceInMinutes(parseISO(current), parseISO(previous));
  };

  // Toggle event expansion
  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  // Group events by time periods
  const groupEventsByPeriod = (events: AuditEvent[]) => {
    const groups: { [key: string]: AuditEvent[] } = {};

    events.forEach((event) => {
      const date = parseISO(event.timestamp);
      let key: string;

      if (isToday(date)) {
        key = 'Today';
      } else if (isYesterday(date)) {
        key = 'Yesterday';
      } else {
        key = format(date, 'MMMM dd, yyyy');
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    });

    return groups;
  };

  const eventGroups = groupEventsByPeriod(events);

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <TimelineIcon />
            Audit Trail Visualization
            <Chip
              size="small"
              label={`Conversation: ${conversationId.slice(-8)}`}
            />
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {showFilters && (
              <Button
                startIcon={<FilterIcon />}
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                variant={showFiltersPanel ? 'contained' : 'outlined'}
                size="small"
              >
                Filters
              </Button>
            )}
            <Button
              onClick={fetchAuditTrail}
              disabled={loading}
              size="small"
              variant="outlined"
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Filters Panel */}
        <Collapse in={showFiltersPanel}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Action</InputLabel>
                    <Select
                      value={filters.action}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          action: e.target.value,
                        }))
                      }
                      label="Action"
                    >
                      <MenuItem value="">All Actions</MenuItem>
                      <MenuItem value="message_sent">Message Sent</MenuItem>
                      <MenuItem value="message_read">Message Read</MenuItem>
                      <MenuItem value="message_edited">Message Edited</MenuItem>
                      <MenuItem value="participant_added">
                        Participant Added
                      </MenuItem>
                      <MenuItem value="file_uploaded">File Uploaded</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Risk Level</InputLabel>
                    <Select
                      value={filters.riskLevel}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          riskLevel: e.target.value,
                        }))
                      }
                      label="Risk Level"
                    >
                      <MenuItem value="">All Levels</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.success}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          success: e.target.value,
                        }))
                      }
                      label="Status"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="true">Success</MenuItem>
                      <MenuItem value="false">Failed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() =>
                      setFilters({
                        action: '',
                        riskLevel: '',
                        userId: '',
                        success: '',
                      })
                    }
                    size="small"
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Collapse>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Timeline Content */}
      {!loading && (
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {Object.keys(eventGroups).length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No audit events found for this conversation
              </Typography>
            </Box>
          ) : (
            Object.entries(eventGroups).map(([period, periodEvents]) => (
              <Box key={period} sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                  {period}
                </Typography>
                <Timeline>
                  {periodEvents.map((event, index) => {
                    const isExpanded = expandedEvents.has(event._id);
                    const timeDiff = getTimeDifference(
                      event.timestamp,
                      index > 0 ? periodEvents[index - 1].timestamp : undefined
                    );

                    return (
                      <TimelineItem key={event._id}>
                        <TimelineOppositeContent
                          sx={{ m: 'auto 0', minWidth: 120 }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {format(parseISO(event.timestamp), 'HH:mm:ss')}
                          </Typography>
                          {event.duration && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {event.duration}ms
                            </Typography>
                          )}
                        </TimelineOppositeContent>
                        <TimelineSeparator>
                          <TimelineDot color={getRiskColor(event.riskLevel)}>
                            {getActionIcon(event.action, event.riskLevel)}
                          </TimelineDot>
                          {index < periodEvents.length - 1 && (
                            <TimelineConnector />
                          )}
                        </TimelineSeparator>
                        <TimelineContent sx={{ py: '12px', px: 2 }}>
                          <Card
                            variant="outlined"
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                            onClick={() => toggleEventExpansion(event._id)}
                          >
                            <CardContent sx={{ pb: '16px !important' }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  mb: 1,
                                }}
                              >
                                <Box>
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight="medium"
                                  >
                                    {formatAction(event.action)}
                                  </Typography>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                      mt: 0.5,
                                    }}
                                  >
                                    <Avatar
                                      sx={{
                                        width: 24,
                                        height: 24,
                                        fontSize: '0.75rem',
                                      }}
                                    >
                                      {event.userId.firstName[0]}
                                      {event.userId.lastName[0]}
                                    </Avatar>
                                    <Typography variant="body2">
                                      {event.userId.firstName}{' '}
                                      {event.userId.lastName}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={event.userId.role}
                                      variant="outlined"
                                    />
                                  </Box>
                                </Box>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                  }}
                                >
                                  <Chip
                                    size="small"
                                    label={event.success ? 'Success' : 'Failed'}
                                    color={event.success ? 'success' : 'error'}
                                    variant="outlined"
                                  />
                                  <IconButton size="small">
                                    {isExpanded ? (
                                      <ExpandLessIcon />
                                    ) : (
                                      <ExpandMoreIcon />
                                    )}
                                  </IconButton>
                                </Box>
                              </Box>

                              <Collapse in={isExpanded}>
                                <Divider sx={{ my: 1 }} />
                                <Grid container spacing={2}>
                                  <Grid item xs={12} sm={6}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Target Details
                                    </Typography>
                                    <Typography variant="body2">
                                      Type: {event.targetType}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{ wordBreak: 'break-all' }}
                                    >
                                      ID: {event.targetId}
                                    </Typography>
                                    {event.details.messageId && (
                                      <Typography variant="body2">
                                        Message:{' '}
                                        {event.details.messageId.slice(-8)}
                                      </Typography>
                                    )}
                                    {event.details.fileName && (
                                      <Typography variant="body2">
                                        File: {event.details.fileName}
                                      </Typography>
                                    )}
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Security Info
                                    </Typography>
                                    <Typography variant="body2">
                                      Risk Level: {event.riskLevel}
                                    </Typography>
                                    <Typography variant="body2">
                                      IP: {event.ipAddress}
                                    </Typography>
                                    <Typography variant="body2">
                                      Timestamp:{' '}
                                      {formatTimestamp(event.timestamp)}
                                    </Typography>
                                  </Grid>
                                  {event.details.metadata && (
                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        Additional Details
                                      </Typography>
                                      <Paper
                                        variant="outlined"
                                        sx={{
                                          p: 1,
                                          bgcolor: 'grey.50',
                                          mt: 0.5,
                                        }}
                                      >
                                        <pre
                                          style={{
                                            margin: 0,
                                            fontSize: '0.75rem',
                                            whiteSpace: 'pre-wrap',
                                          }}
                                        >
                                          {JSON.stringify(
                                            event.details.metadata,
                                            null,
                                            2
                                          )}
                                        </pre>
                                      </Paper>
                                    </Grid>
                                  )}
                                </Grid>
                              </Collapse>
                            </CardContent>
                          </Card>
                        </TimelineContent>
                      </TimelineItem>
                    );
                  })}
                </Timeline>
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};

export default AuditTrailVisualization;
