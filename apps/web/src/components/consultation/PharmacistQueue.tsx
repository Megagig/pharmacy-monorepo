import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  Divider,
  IconButton,
  Tooltip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  TrendingUp as EscalateIcon,
  CheckCircle as AcceptIcon,
} from '@mui/icons-material';
import { consultationApi, ConsultationRequest } from '../../services/api/consultationApi';
import { useSocket } from '../../hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';

interface PharmacistQueueProps {
  onAcceptRequest?: (requestId: string, conversationId: string) => void;
  onEscalateRequest?: (requestId: string) => void;
  refreshInterval?: number; // in milliseconds
  autoRefresh?: boolean;
}

export const PharmacistQueue: React.FC<PharmacistQueueProps> = ({
  onAcceptRequest,
  onEscalateRequest,
  refreshInterval = 30000, // 30 seconds default
  autoRefresh = true,
}) => {
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [escalatingRequest, setEscalatingRequest] = useState<ConsultationRequest | null>(null);
  const [escalationReason, setEscalationReason] = useState('');
  const socket = useSocket();

  const fetchRequests = useCallback(async () => {
    try {
      const response = await consultationApi.getPendingRequests();
      setRequests(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load consultation requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();

    // Set up auto-refresh
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(fetchRequests, refreshInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchRequests, autoRefresh, refreshInterval]);

  // Listen for WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleNewRequest = (data: any) => {
      // Play notification sound
      playNotificationSound();
      // Refresh queue
      fetchRequests();
    };

    const handleQueueUpdate = (data: any) => {
      // Refresh queue on any update
      fetchRequests();
    };

    socket.on('consultation:new_request', handleNewRequest);
    socket.on('consultation:queue_update', handleQueueUpdate);

    return () => {
      socket.off('consultation:new_request', handleNewRequest);
      socket.off('consultation:queue_update', handleQueueUpdate);
    };
  }, [socket, fetchRequests]);

  const playNotificationSound = () => {
    // Play a notification sound (you can add an actual audio file)
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(() => {
      // Ignore errors if sound can't play
    });
  };

  const handleAccept = async (request: ConsultationRequest) => {
    setAcceptingId(request._id);
    try {
      const response = await consultationApi.acceptRequest(request._id);
      
      // Remove from queue
      setRequests(prev => prev.filter(r => r._id !== request._id));
      
      // Notify parent component
      if (onAcceptRequest && response.data.conversationId) {
        onAcceptRequest(request._id, response.data.conversationId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to accept consultation request');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleEscalateClick = (request: ConsultationRequest) => {
    setEscalatingRequest(request);
    setEscalateDialogOpen(true);
  };

  const handleEscalateConfirm = async () => {
    if (!escalatingRequest) return;

    try {
      await consultationApi.escalateRequest(escalatingRequest._id, escalationReason);
      
      // Notify parent component
      if (onEscalateRequest) {
        onEscalateRequest(escalatingRequest._id);
      }
      
      // Refresh queue
      fetchRequests();
      
      // Close dialog
      setEscalateDialogOpen(false);
      setEscalatingRequest(null);
      setEscalationReason('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to escalate consultation request');
    }
  };

  const getWaitTime = (requestedAt: string): string => {
    return formatDistanceToNow(new Date(requestedAt), { addSuffix: true });
  };

  const getWaitTimeMinutes = (requestedAt: string): number => {
    return Math.floor((Date.now() - new Date(requestedAt).getTime()) / 1000 / 60);
  };

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'default' => {
    return priority === 'urgent' ? 'error' : 'default';
  };

  const getWaitTimeColor = (waitMinutes: number, priority: string): string => {
    const threshold = priority === 'urgent' ? 2 : 5;
    if (waitMinutes >= threshold) return 'error.main';
    if (waitMinutes >= threshold * 0.7) return 'warning.main';
    return 'text.secondary';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5">
            Consultation Queue
          </Typography>
          <Badge badgeContent={requests.length} color="primary">
            <Chip label="Pending" size="small" />
          </Badge>
        </Box>
        <Tooltip title="Refresh queue">
          <IconButton onClick={fetchRequests} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Queue List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Pending Requests
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All consultation requests have been handled. Great job!
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
          {requests.map((request, index) => {
            const waitMinutes = getWaitTimeMinutes(request.requestedAt);
            const isAccepting = acceptingId === request._id;

            return (
              <React.Fragment key={request._id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    py: 2,
                    bgcolor: request.priority === 'urgent' ? 'error.lighter' : 'transparent',
                  }}
                >
                  {/* Header Row */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon color="action" />
                      <Typography variant="subtitle1" fontWeight="medium">
                        {request.patientId?.firstName} {request.patientId?.lastName}
                      </Typography>
                      <Chip
                        label={request.priority.toUpperCase()}
                        size="small"
                        color={getPriorityColor(request.priority)}
                        icon={request.priority === 'urgent' ? <WarningIcon /> : undefined}
                      />
                      {request.escalationLevel > 0 && (
                        <Chip
                          label={`Escalated (${request.escalationLevel})`}
                          size="small"
                          color="warning"
                          icon={<EscalateIcon />}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 16, color: getWaitTimeColor(waitMinutes, request.priority) }} />
                      <Typography
                        variant="caption"
                        sx={{ color: getWaitTimeColor(waitMinutes, request.priority) }}
                      >
                        {getWaitTime(request.requestedAt)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Reason */}
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {request.reason}
                  </Typography>

                  {/* Contact Method */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Preferred contact:
                    </Typography>
                    <Chip label={request.preferredContactMethod} size="small" variant="outlined" />
                    {request.preferredContactMethod === 'phone' && request.patientPhone && (
                      <Typography variant="caption" color="text.secondary">
                        {request.patientPhone}
                      </Typography>
                    )}
                    {request.preferredContactMethod === 'email' && request.patientEmail && (
                      <Typography variant="caption" color="text.secondary">
                        {request.patientEmail}
                      </Typography>
                    )}
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={isAccepting ? <CircularProgress size={16} /> : <AcceptIcon />}
                      onClick={() => handleAccept(request)}
                      disabled={isAccepting}
                      fullWidth
                    >
                      {isAccepting ? 'Accepting...' : 'Accept Request'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<EscalateIcon />}
                      onClick={() => handleEscalateClick(request)}
                      disabled={isAccepting}
                    >
                      Escalate
                    </Button>
                  </Box>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}

      {/* Escalate Dialog */}
      <Dialog open={escalateDialogOpen} onClose={() => setEscalateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Escalate Consultation Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will notify supervisors and managers about this request. Please provide a reason for escalation.
          </Typography>
          <TextField
            label="Escalation Reason (Optional)"
            multiline
            rows={3}
            fullWidth
            value={escalationReason}
            onChange={(e) => setEscalationReason(e.target.value)}
            placeholder="e.g., Requires specialized knowledge, Complex medication interaction..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEscalateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEscalateConfirm} variant="contained" color="warning">
            Escalate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PharmacistQueue;
