import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { MTRFollowUp, MTRIntervention } from '../../../types/mtr';

interface FollowUpProps {
  reviewId?: string;
  patientId?: string;
  interventions: MTRIntervention[];
  onFollowUpScheduled: (followUp: MTRFollowUp) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const FollowUp: React.FC<FollowUpProps> = ({
  reviewId,
  patientId,
  interventions,
  onFollowUpScheduled,
  onNext,
  onBack,
}) => {
  const [followUps, setFollowUps] = useState<Partial<MTRFollowUp>[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'phone_call' as const,
    priority: 'medium' as const,
    description: '',
    objectives: [] as string[],
    scheduledDate: '',
    estimatedDuration: 30,
    assignedTo: 'current-user',
    relatedInterventions: [] as string[],
  });
  const [newObjective, setNewObjective] = useState('');

  const handleAddFollowUp = () => {
    setFormData({
      type: 'phone_call',
      priority: 'medium',
      description: '',
      objectives: [],
      scheduledDate: '',
      estimatedDuration: 30,
      assignedTo: 'current-user',
      relatedInterventions: [],
    });
    setDialogOpen(true);
  };

  const handleAddObjective = () => {
    if (newObjective.trim()) {
      setFormData(prev => ({
        ...prev,
        objectives: [...prev.objectives, newObjective.trim()],
      }));
      setNewObjective('');
    }
  };

  const handleRemoveObjective = (index: number) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.filter((_, i) => i !== index),
    }));
  };

  const handleSaveFollowUp = () => {
    const followUp: Partial<MTRFollowUp> = {
      ...formData,
      _id: Date.now().toString(),
      workplaceId: 'default',
      reviewId: reviewId || 'default',
      patientId: patientId || 'default',
      status: 'scheduled',
    };

    const updatedFollowUps = [...followUps, followUp];
    setFollowUps(updatedFollowUps);
    onFollowUpScheduled(followUp as MTRFollowUp);
    setDialogOpen(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'missed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Follow-Up Planning
      </Typography>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Scheduled Follow-Ups ({followUps.length})
            </Typography>
            <Button
              startIcon={<Add />}
              onClick={handleAddFollowUp}
              variant="outlined"
              size="small"
            >
              Schedule Follow-Up
            </Button>
          </Box>

          {followUps.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No follow-ups scheduled yet. Click "Schedule Follow-Up" to plan future activities.
            </Typography>
          ) : (
            <List>
              {followUps.map((followUp, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="body1">
                          {followUp.description}
                        </Typography>
                        <Chip
                          label={followUp.priority}
                          size="small"
                          color={getPriorityColor(followUp.priority!) as any}
                        />
                        <Chip
                          label={followUp.status}
                          size="small"
                          color={getStatusColor(followUp.status!) as any}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Type: {followUp.type} | Scheduled: {followUp.scheduledDate}
                        </Typography>
                        <Typography variant="body2">
                          Duration: {followUp.estimatedDuration} minutes | Assigned to: {followUp.assignedTo}
                        </Typography>
                        {followUp.objectives && followUp.objectives.length > 0 && (
                          <Typography variant="body2">
                            Objectives: {followUp.objectives.join(', ')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Schedule Follow-Up</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              >
                <MenuItem value="phone_call">Phone Call</MenuItem>
                <MenuItem value="appointment">Appointment</MenuItem>
                <MenuItem value="lab_review">Lab Review</MenuItem>
                <MenuItem value="adherence_check">Adherence Check</MenuItem>
                <MenuItem value="outcome_assessment">Outcome Assessment</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
              >
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Scheduled Date"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={formData.scheduledDate}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Estimated Duration (minutes)"
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Assigned To"
                value={formData.assignedTo}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
              />
            </Grid>
            
            {/* Objectives */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Objectives
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  label="Add objective"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddObjective();
                    }
                  }}
                />
                <Button onClick={handleAddObjective} variant="outlined">
                  Add
                </Button>
              </Box>
              {formData.objectives.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.objectives.map((objective, index) => (
                    <Chip
                      key={index}
                      label={objective}
                      onDelete={() => handleRemoveObjective(index)}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            </Grid>

            {/* Related Interventions */}
            {interventions.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Related Interventions
                </Typography>
                {interventions.map((intervention) => (
                  <FormControlLabel
                    key={intervention._id}
                    control={
                      <Checkbox
                        checked={formData.relatedInterventions.includes(intervention._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              relatedInterventions: [...prev.relatedInterventions, intervention._id],
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              relatedInterventions: prev.relatedInterventions.filter(id => id !== intervention._id),
                            }));
                          }
                        }}
                      />
                    }
                    label={intervention.description}
                  />
                ))}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveFollowUp} variant="contained">
            Schedule Follow-Up
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        {onBack && (
          <Button onClick={onBack} variant="outlined">
            Back
          </Button>
        )}
        <Button
          onClick={onNext}
          variant="contained"
          disabled={followUps.length === 0}
          sx={{ ml: 'auto' }}
        >
          Complete MTR
        </Button>
      </Box>
    </Box>
  );
};

export default FollowUp;