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
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { MTRIntervention } from '../../../types/mtr';

interface InterventionsProps {
  reviewId?: string;
  patientId?: string;
  onInterventionRecorded: (intervention: MTRIntervention) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const Interventions: React.FC<InterventionsProps> = ({
  reviewId,
  patientId,
  onInterventionRecorded,
  onNext,
  onBack,
}) => {
  const [interventions, setInterventions] = useState<Partial<MTRIntervention>[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'recommendation' as const,
    category: 'medication_change' as const,
    description: '',
    rationale: '',
    targetAudience: 'patient' as const,
    communicationMethod: 'verbal' as const,
    documentation: '',
    priority: 'medium' as const,
    urgency: 'routine' as const,
    followUpRequired: false,
    followUpDate: '',
  });

  const handleAddIntervention = () => {
    setFormData({
      type: 'recommendation',
      category: 'medication_change',
      description: '',
      rationale: '',
      targetAudience: 'patient',
      communicationMethod: 'verbal',
      documentation: '',
      priority: 'medium',
      urgency: 'routine',
      followUpRequired: false,
      followUpDate: '',
    });
    setDialogOpen(true);
  };

  const handleSaveIntervention = () => {
    const intervention: Partial<MTRIntervention> = {
      ...formData,
      _id: Date.now().toString(),
      workplaceId: 'default',
      reviewId: reviewId || 'default',
      patientId: patientId || 'default',
      outcome: 'pending',
      outcomeDetails: '',
      followUpCompleted: false,
      pharmacistId: 'current-user',
      performedAt: new Date().toISOString(),
    };

    const updatedInterventions = [...interventions, intervention];
    setInterventions(updatedInterventions);
    onInterventionRecorded(intervention as MTRIntervention);
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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate': return 'error';
      case 'within_24h': return 'warning';
      case 'within_week': return 'info';
      case 'routine': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Interventions
      </Typography>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Recorded Interventions ({interventions.length})
            </Typography>
            <Button
              startIcon={<Add />}
              onClick={handleAddIntervention}
              variant="outlined"
              size="small"
            >
              Add Intervention
            </Button>
          </Box>

          {interventions.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No interventions recorded yet. Click "Add Intervention" to document your first intervention.
            </Typography>
          ) : (
            <List>
              {interventions.map((intervention, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="body1">
                          {intervention.description}
                        </Typography>
                        <Chip
                          label={intervention.priority}
                          size="small"
                          color={getPriorityColor(intervention.priority!) as any}
                        />
                        <Chip
                          label={intervention.urgency}
                          size="small"
                          color={getUrgencyColor(intervention.urgency!) as any}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Type: {intervention.type} | Category: {intervention.category}
                        </Typography>
                        <Typography variant="body2">
                          Target: {intervention.targetAudience} | Method: {intervention.communicationMethod}
                        </Typography>
                        <Typography variant="body2">
                          Rationale: {intervention.rationale}
                        </Typography>
                        {intervention.followUpRequired && (
                          <Typography variant="body2" color="warning.main">
                            Follow-up required: {intervention.followUpDate}
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
        <DialogTitle>Record Intervention</DialogTitle>
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
                <MenuItem value="recommendation">Recommendation</MenuItem>
                <MenuItem value="counseling">Counseling</MenuItem>
                <MenuItem value="monitoring">Monitoring</MenuItem>
                <MenuItem value="communication">Communication</MenuItem>
                <MenuItem value="education">Education</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
              >
                <MenuItem value="medication_change">Medication Change</MenuItem>
                <MenuItem value="adherence_support">Adherence Support</MenuItem>
                <MenuItem value="monitoring_plan">Monitoring Plan</MenuItem>
                <MenuItem value="patient_education">Patient Education</MenuItem>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rationale"
                multiline
                rows={2}
                value={formData.rationale}
                onChange={(e) => setFormData(prev => ({ ...prev, rationale: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Target Audience"
                value={formData.targetAudience}
                onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value as any }))}
              >
                <MenuItem value="patient">Patient</MenuItem>
                <MenuItem value="prescriber">Prescriber</MenuItem>
                <MenuItem value="caregiver">Caregiver</MenuItem>
                <MenuItem value="healthcare_team">Healthcare Team</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Communication Method"
                value={formData.communicationMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, communicationMethod: e.target.value as any }))}
              >
                <MenuItem value="verbal">Verbal</MenuItem>
                <MenuItem value="written">Written</MenuItem>
                <MenuItem value="phone">Phone</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="fax">Fax</MenuItem>
                <MenuItem value="in_person">In Person</MenuItem>
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
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Urgency"
                value={formData.urgency}
                onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value as any }))}
              >
                <MenuItem value="immediate">Immediate</MenuItem>
                <MenuItem value="within_24h">Within 24h</MenuItem>
                <MenuItem value="within_week">Within Week</MenuItem>
                <MenuItem value="routine">Routine</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Documentation"
                multiline
                rows={3}
                value={formData.documentation}
                onChange={(e) => setFormData(prev => ({ ...prev, documentation: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveIntervention} variant="contained">
            Record Intervention
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
          disabled={interventions.length === 0}
          sx={{ ml: 'auto' }}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};

export default Interventions;