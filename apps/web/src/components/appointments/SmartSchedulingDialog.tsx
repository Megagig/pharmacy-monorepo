/**
 * Smart Scheduling Dialog
 * Provides intelligent appointment scheduling with AI-powered suggestions
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Rating,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Close as CloseIcon,
  AutoAwesome as AutoAwesomeIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  CalendarMonth as CalendarIcon,
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { format, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient } from '../../types/patientManagement';

interface SmartSchedulingSuggestion {
  pharmacistId: string;
  pharmacistName: string;
  date: Date;
  time: string;
  score: number;
  reasons: string[];
  alternativeSlots?: Array<{
    date: Date;
    time: string;
    score: number;
  }>;
}

interface SmartSchedulingDialogProps {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  appointmentType: string;
  duration: number;
  onScheduleConfirm: (suggestion: SmartSchedulingSuggestion) => void;
}

const SmartSchedulingDialog: React.FC<SmartSchedulingDialogProps> = ({
  open,
  onClose,
  patient,
  appointmentType,
  duration,
  onScheduleConfirm,
}) => {
  const [suggestions, setSuggestions] = useState<SmartSchedulingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SmartSchedulingSuggestion | null>(null);
  const [urgencyLevel, setUrgencyLevel] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [preferences, setPreferences] = useState({
    morningPreferred: false,
    afternoonPreferred: false,
    avoidLunchTime: true,
    preferredLanguage: 'en'
  });
  const [autoSchedule, setAutoSchedule] = useState(false);

  // Fetch smart suggestions
  const fetchSuggestions = async () => {
    if (!patient) return;

    setLoading(true);
    try {
      // Simulate API call - in real implementation, this would call the backend
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock suggestions data
      const mockSuggestions: SmartSchedulingSuggestion[] = [
        {
          pharmacistId: '1',
          pharmacistName: 'Dr. Sarah Johnson',
          date: addDays(new Date(), 1),
          time: '10:00',
          score: 95,
          reasons: [
            'Matches morning preference',
            'Preferred pharmacist available',
            'Optimal appointment timing',
            'Low utilization period'
          ],
          alternativeSlots: [
            { date: addDays(new Date(), 1), time: '10:30', score: 90 },
            { date: addDays(new Date(), 1), time: '11:00', score: 88 }
          ]
        },
        {
          pharmacistId: '2',
          pharmacistName: 'Dr. Michael Chen',
          date: addDays(new Date(), 2),
          time: '14:00',
          score: 88,
          reasons: [
            'Matches afternoon preference',
            'Specialist in chronic disease management',
            'Good availability'
          ],
          alternativeSlots: [
            { date: addDays(new Date(), 2), time: '14:30', score: 85 },
            { date: addDays(new Date(), 2), time: '15:00', score: 82 }
          ]
        },
        {
          pharmacistId: '3',
          pharmacistName: 'Dr. Emily Rodriguez',
          date: addDays(new Date(), 3),
          time: '09:30',
          score: 82,
          reasons: [
            'Early morning slot',
            'Experienced with MTM sessions',
            'Bilingual (English/Spanish)'
          ]
        }
      ];

      setSuggestions(mockSuggestions);
      if (mockSuggestions.length > 0) {
        setSelectedSuggestion(mockSuggestions[0]);
      }

    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && patient) {
      fetchSuggestions();
    }
  }, [open, patient, urgencyLevel, preferences]);

  const handleScheduleConfirm = () => {
    if (selectedSuggestion) {
      onScheduleConfirm(selectedSuggestion);
      onClose();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 75) return 'info';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <PsychologyIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">
                Smart Appointment Scheduling
              </Typography>
              <Typography variant="body2" color="text.secondary">
                AI-powered suggestions for {patient?.firstName} {patient?.lastName}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Preferences Panel */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <AutoAwesomeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Scheduling Preferences
                </Typography>

                {/* Urgency Level */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Urgency Level</InputLabel>
                  <Select
                    value={urgencyLevel}
                    label="Urgency Level"
                    onChange={(e) => setUrgencyLevel(e.target.value as any)}
                  >
                    <MenuItem value="low">Low Priority</MenuItem>
                    <MenuItem value="medium">Medium Priority</MenuItem>
                    <MenuItem value="high">High Priority</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>

                <Chip
                  label={urgencyLevel.toUpperCase()}
                  color={getUrgencyColor(urgencyLevel) as any}
                  size="small"
                  sx={{ mb: 2 }}
                />

                <Divider sx={{ my: 2 }} />

                {/* Time Preferences */}
                <Typography variant="subtitle2" gutterBottom>
                  Time Preferences
                </Typography>
                
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.morningPreferred}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          morningPreferred: e.target.checked
                        }))}
                      />
                    }
                    label="Prefer morning appointments"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.afternoonPreferred}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          afternoonPreferred: e.target.checked
                        }))}
                      />
                    }
                    label="Prefer afternoon appointments"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.avoidLunchTime}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          avoidLunchTime: e.target.checked
                        }))}
                      />
                    }
                    label="Avoid lunch time (12-1 PM)"
                  />
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Auto-scheduling */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoSchedule}
                      onChange={(e) => setAutoSchedule(e.target.checked)}
                    />
                  }
                  label="Auto-schedule best suggestion"
                />
                
                {autoSchedule && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    The top-rated suggestion will be automatically scheduled
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Suggestions Panel */}
          <Grid item xs={12} md={8}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                  <Typography variant="h6">
                    <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Smart Suggestions
                  </Typography>
                  {loading && <CircularProgress size={20} sx={{ ml: 2 }} />}
                </Box>

                {loading ? (
                  <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Analyzing schedules and generating optimal suggestions...
                    </Typography>
                  </Box>
                ) : suggestions.length > 0 ? (
                  <List>
                    <AnimatePresence>
                      {suggestions.map((suggestion, index) => (
                        <motion.div
                          key={`${suggestion.pharmacistId}-${suggestion.time}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <ListItem
                            button
                            selected={selectedSuggestion?.pharmacistId === suggestion.pharmacistId && 
                                     selectedSuggestion?.time === suggestion.time}
                            onClick={() => setSelectedSuggestion(suggestion)}
                            sx={{
                              border: 1,
                              borderColor: selectedSuggestion?.pharmacistId === suggestion.pharmacistId && 
                                          selectedSuggestion?.time === suggestion.time
                                ? 'primary.main'
                                : 'divider',
                              borderRadius: 2,
                              mb: 1,
                              '&:hover': {
                                borderColor: 'primary.main',
                              }
                            }}
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: 'primary.main' }}>
                                <PersonIcon />
                              </Avatar>
                            </ListItemAvatar>
                            
                            <ListItemText
                              primary={
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    {suggestion.pharmacistName}
                                  </Typography>
                                  <Chip
                                    label={`${suggestion.score}% match`}
                                    color={getScoreColor(suggestion.score) as any}
                                    size="small"
                                  />
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Box display="flex" alignItems="center" gap={2} mb={1}>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                      <CalendarIcon fontSize="small" />
                                      <Typography variant="body2">
                                        {format(suggestion.date, 'MMM dd, yyyy')}
                                      </Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                      <AccessTimeIcon fontSize="small" />
                                      <Typography variant="body2">
                                        {suggestion.time}
                                      </Typography>
                                    </Box>
                                  </Box>
                                  
                                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {suggestion.reasons.slice(0, 2).map((reason, idx) => (
                                      <Chip
                                        key={idx}
                                        label={reason}
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                      />
                                    ))}
                                    {suggestion.reasons.length > 2 && (
                                      <Chip
                                        label={`+${suggestion.reasons.length - 2} more`}
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                </Box>
                              }
                            />
                            
                            <ListItemSecondaryAction>
                              <Rating
                                value={suggestion.score / 20}
                                precision={0.1}
                                size="small"
                                readOnly
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </List>
                ) : (
                  <Alert severity="warning">
                    No suitable appointments found with current preferences. Try adjusting your preferences or urgency level.
                  </Alert>
                )}

                {/* Selected Suggestion Details */}
                {selectedSuggestion && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                  >
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Suggestion Details
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Card variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Why this suggestion?
                          </Typography>
                          <Stack spacing={0.5} mt={1}>
                            {selectedSuggestion.reasons.map((reason, idx) => (
                              <Box key={idx} display="flex" alignItems="center" gap={1}>
                                <CheckCircleIcon color="success" fontSize="small" />
                                <Typography variant="body2">{reason}</Typography>
                              </Box>
                            ))}
                          </Stack>
                        </Card>
                      </Grid>
                      
                      {selectedSuggestion.alternativeSlots && selectedSuggestion.alternativeSlots.length > 0 && (
                        <Grid item xs={12} sm={6}>
                          <Card variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Alternative times
                            </Typography>
                            <Stack spacing={1} mt={1}>
                              {selectedSuggestion.alternativeSlots.map((alt, idx) => (
                                <Box key={idx} display="flex" justifyContent="space-between" alignItems="center">
                                  <Typography variant="body2">
                                    {format(alt.date, 'MMM dd')} at {alt.time}
                                  </Typography>
                                  <Chip
                                    label={`${alt.score}%`}
                                    size="small"
                                    color={getScoreColor(alt.score) as any}
                                  />
                                </Box>
                              ))}
                            </Stack>
                          </Card>
                        </Grid>
                      )}
                    </Grid>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={fetchSuggestions}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
        >
          Refresh Suggestions
        </Button>
        <Button
          onClick={handleScheduleConfirm}
          variant="contained"
          disabled={!selectedSuggestion || loading}
          startIcon={<ScheduleIcon />}
        >
          Schedule Appointment
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SmartSchedulingDialog;