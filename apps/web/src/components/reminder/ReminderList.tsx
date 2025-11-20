import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Button,
  List,
  ListItem,
  Divider,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Alarm as AlarmIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { reminderApi } from '../../services/api/reminderApi';
import { format } from 'date-fns';

interface ReminderListProps {
  patientId: string;
  onEdit?: (reminder: any) => void;
}

export const ReminderList: React.FC<ReminderListProps> = ({ patientId, onEdit }) => {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<any>(null);

  useEffect(() => {
    fetchReminders();
  }, [patientId]);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await reminderApi.getReminders({ patientId, isActive: true });
      setReminders(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async (reminder: any) => {
    try {
      await reminderApi.updateReminder(reminder._id, {
        isPaused: !reminder.isPaused,
      });
      fetchReminders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update reminder');
    }
  };

  const handleDeleteClick = (reminder: any) => {
    setReminderToDelete(reminder);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reminderToDelete) return;

    try {
      await reminderApi.deleteReminder(reminderToDelete._id);
      setDeleteDialogOpen(false);
      setReminderToDelete(null);
      fetchReminders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete reminder');
    }
  };

  const getFrequencyLabel = (frequency: string): string => {
    const labels: Record<string, string> = {
      daily: 'Once daily',
      twice_daily: 'Twice daily',
      three_times_daily: 'Three times daily',
      weekly: 'Weekly',
      custom: 'Custom',
    };
    return labels[frequency] || frequency;
  };

  const getConfirmationRate = (reminder: any): number => {
    if (!reminder.confirmations || reminder.confirmations.length === 0) {
      return 100;
    }

    const confirmed = reminder.confirmations.filter(
      (c: any) => c.status === 'confirmed'
    ).length;

    return Math.round((confirmed / reminder.confirmations.length) * 100);
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

      {reminders.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AlarmIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Active Reminders
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Set up medication reminders to help stay on track.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
          {reminders.map((reminder, index) => {
            const confirmationRate = getConfirmationRate(reminder);

            return (
              <React.Fragment key={reminder._id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    py: 2,
                    bgcolor: reminder.isPaused ? 'action.hover' : 'transparent',
                  }}
                >
                  {/* Header Row */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AlarmIcon color={reminder.isPaused ? 'disabled' : 'primary'} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {reminder.medicationName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {reminder.dosage}
                        </Typography>
                      </Box>
                      {reminder.isPaused && (
                        <Chip label="Paused" size="small" color="warning" />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleTogglePause(reminder)}
                        title={reminder.isPaused ? 'Resume' : 'Pause'}
                      >
                        {reminder.isPaused ? <PlayIcon /> : <PauseIcon />}
                      </IconButton>
                      {onEdit && (
                        <IconButton size="small" onClick={() => onEdit(reminder)} title="Edit">
                          <EditIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(reminder)}
                        title="Delete"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Details */}
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Frequency:</strong> {getFrequencyLabel(reminder.frequency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Times:</strong> {reminder.times.join(', ')}
                    </Typography>
                    {reminder.frequency === 'weekly' && reminder.daysOfWeek && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Days:</strong>{' '}
                        {reminder.daysOfWeek
                          .map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                          .join(', ')}
                      </Typography>
                    )}
                    {reminder.instructions && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Instructions:</strong> {reminder.instructions}
                      </Typography>
                    )}
                  </Box>

                  {/* Dates */}
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Started: {format(new Date(reminder.startDate), 'MMM d, yyyy')}
                      {reminder.endDate && ` • Ends: ${format(new Date(reminder.endDate), 'MMM d, yyyy')}`}
                    </Typography>
                  </Box>

                  {/* Confirmation Rate */}
                  {reminder.confirmations && reminder.confirmations.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckIcon
                        sx={{
                          fontSize: 16,
                          color: confirmationRate >= 80 ? 'success.main' : confirmationRate >= 50 ? 'warning.main' : 'error.main',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Confirmation Rate: {confirmationRate}% ({reminder.confirmations.filter((c: any) => c.status === 'confirmed').length}/
                        {reminder.confirmations.length})
                      </Typography>
                    </Box>
                  )}
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Reminder?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the reminder for {reminderToDelete?.medicationName}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReminderList;
