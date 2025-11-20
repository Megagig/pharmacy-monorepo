import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { MTRMedication } from '../../../stores/mtrStore';
import { DrugTherapyProblem } from '../../../types/mtr';

interface PatientInfo {
  age: number;
  gender: string;
  conditions: string[];
  allergies: string[];
}

interface TherapyAssessmentProps {
  patientId?: string;
  medications: MTRMedication[];
  patientInfo?: PatientInfo;
  onProblemsIdentified: (problems: DrugTherapyProblem[]) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const TherapyAssessment: React.FC<TherapyAssessmentProps> = ({
  patientId,
  medications,
  patientInfo,
  onProblemsIdentified,
  onNext,
  onBack,
}) => {
  const [problems, setProblems] = useState<Partial<DrugTherapyProblem>[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'indication' as const,
    subcategory: '',
    type: 'unnecessary' as const,
    severity: 'moderate' as const,
    description: '',
    clinicalSignificance: '',
    affectedMedications: [] as string[],
    evidenceLevel: 'probable' as const,
  });

  const handleAddProblem = () => {
    setFormData({
      category: 'indication',
      subcategory: '',
      type: 'unnecessary',
      severity: 'moderate',
      description: '',
      clinicalSignificance: '',
      affectedMedications: [],
      evidenceLevel: 'probable',
    });
    setDialogOpen(true);
  };

  const handleSaveProblem = () => {
    const problem: Partial<DrugTherapyProblem> = {
      ...formData,
      _id: Date.now().toString(),
      workplaceId: 'default',
      patientId: patientId || 'default',
      status: 'identified',
      identifiedBy: 'current-user',
      identifiedAt: new Date().toISOString(),
    };

    const updatedProblems = [...problems, problem];
    setProblems(updatedProblems);
    onProblemsIdentified(updatedProblems as DrugTherapyProblem[]);
    setDialogOpen(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'major': return 'warning';
      case 'moderate': return 'info';
      case 'minor': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Therapy Assessment
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Review the patient's medications and identify any drug therapy problems.
      </Alert>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Current Medications ({medications.length})
          </Typography>
          {medications.length === 0 ? (
            <Typography color="text.secondary">
              No medications to assess
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {medications.map((med) => (
                <Chip
                  key={med.id}
                  label={`${med.drugName} ${med.strength.value}${med.strength.unit}`}
                  size="small"
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Identified Problems ({problems.length})
            </Typography>
            <Button
              startIcon={<Add />}
              onClick={handleAddProblem}
              variant="outlined"
              size="small"
            >
              Add Problem
            </Button>
          </Box>

          {problems.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No problems identified yet
            </Typography>
          ) : (
            <List>
              {problems.map((problem, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          {problem.description}
                        </Typography>
                        <Chip
                          label={problem.severity}
                          size="small"
                          color={getSeverityColor(problem.severity!) as any}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Category: {problem.category} | Type: {problem.type}
                        </Typography>
                        <Typography variant="body2">
                          Clinical Significance: {problem.clinicalSignificance}
                        </Typography>
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
        <DialogTitle>Add Drug Therapy Problem</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
              >
                <MenuItem value="indication">Indication</MenuItem>
                <MenuItem value="effectiveness">Effectiveness</MenuItem>
                <MenuItem value="safety">Safety</MenuItem>
                <MenuItem value="adherence">Adherence</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              >
                <MenuItem value="unnecessary">Unnecessary</MenuItem>
                <MenuItem value="wrongDrug">Wrong Drug</MenuItem>
                <MenuItem value="doseTooLow">Dose Too Low</MenuItem>
                <MenuItem value="doseTooHigh">Dose Too High</MenuItem>
                <MenuItem value="adverseReaction">Adverse Reaction</MenuItem>
                <MenuItem value="inappropriateAdherence">Inappropriate Adherence</MenuItem>
                <MenuItem value="needsAdditional">Needs Additional</MenuItem>
                <MenuItem value="interaction">Interaction</MenuItem>
                <MenuItem value="duplication">Duplication</MenuItem>
                <MenuItem value="contraindication">Contraindication</MenuItem>
                <MenuItem value="monitoring">Monitoring</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Severity"
                value={formData.severity}
                onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as any }))}
              >
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="major">Major</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="minor">Minor</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Evidence Level"
                value={formData.evidenceLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, evidenceLevel: e.target.value as any }))}
              >
                <MenuItem value="definite">Definite</MenuItem>
                <MenuItem value="probable">Probable</MenuItem>
                <MenuItem value="possible">Possible</MenuItem>
                <MenuItem value="unlikely">Unlikely</MenuItem>
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
                label="Clinical Significance"
                multiline
                rows={2}
                value={formData.clinicalSignificance}
                onChange={(e) => setFormData(prev => ({ ...prev, clinicalSignificance: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveProblem} variant="contained">
            Add Problem
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
          disabled={problems.length === 0}
          sx={{ ml: 'auto' }}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};

export default TherapyAssessment;