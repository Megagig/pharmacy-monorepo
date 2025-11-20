import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  Divider,
  Alert,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  Campaign as BroadcastIcon,
  CheckCircle as CheckIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { broadcastApi } from '../../services/api/broadcastApi';
import { format } from 'date-fns';

interface BroadcastHistoryProps {
  onViewBroadcast?: (broadcast: any) => void;
}

export const BroadcastHistory: React.FC<BroadcastHistoryProps> = ({ onViewBroadcast }) => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      const response = await broadcastApi.getBroadcasts();
      setBroadcasts(response.data);

      // Fetch stats for each broadcast
      const statsPromises = response.data.map((broadcast: any) =>
        broadcastApi.getBroadcastStats(broadcast._id).catch(() => null)
      );
      const statsResults = await Promise.all(statsPromises);

      const statsMap: Record<string, any> = {};
      statsResults.forEach((stat, index) => {
        if (stat) {
          statsMap[response.data[index]._id] = stat.data;
        }
      });
      setStats(statsMap);

      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'default' => {
    if (priority === 'urgent') return 'error';
    if (priority === 'high') return 'warning';
    return 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {broadcasts.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <BroadcastIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Broadcasts Sent
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Broadcast messages will appear here once sent.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
          {broadcasts.map((broadcast, index) => {
            const broadcastStats = stats[broadcast._id];

            return (
              <React.Fragment key={broadcast._id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    py: 2,
                  }}
                >
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <BroadcastIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight="medium">
                        {broadcast.title}
                      </Typography>
                      <Chip
                        label={broadcast.priority?.toUpperCase() || 'NORMAL'}
                        size="small"
                        color={getPriorityColor(broadcast.priority)}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(broadcast.createdAt), 'MMM d, yyyy h:mm a')}
                    </Typography>
                  </Box>

                  {/* Message Preview */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {broadcast.lastMessage?.content?.text || 'No message content'}
                  </Typography>

                  {/* Statistics */}
                  {broadcastStats && (
                    <Box sx={{ mb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Recipients: {broadcastStats.totalRecipients}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Read: {broadcastStats.read} ({broadcastStats.readRate}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={broadcastStats.readRate}
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  )}

                  {/* Stats Summary */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      <Typography variant="caption" color="text.secondary">
                        {broadcastStats?.delivered || broadcast.participants?.length || 0} Delivered
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ViewIcon sx={{ fontSize: 16, color: 'info.main' }} />
                      <Typography variant="caption" color="text.secondary">
                        {broadcastStats?.read || 0} Read
                      </Typography>
                    </Box>
                  </Box>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default BroadcastHistory;
