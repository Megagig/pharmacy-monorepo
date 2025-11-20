import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { MTRMedication } from '../../../stores/mtrStore';

interface MedicationHistoryProps {
  patientId?: string;
  onMedicationsUpdate: (medications: MTRMedication[]) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const MedicationHistory: React.FC<MedicationHistoryProps> = ({
  patientId,
  onMedicationsUpdate,
  onNext,
  onBack,
}) => {
  const [medications, setMedications] = useState<MTRMedication[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<MTRMedication | null>(null);
  const [formData, setFormData] = useState({
    drugName: '',
    genericName: '',
    strength: { value: 0, unit: 'mg' },
    dosageForm: '',
    instructions: {
      dose: '',
      frequency: '',
      route: 'oral',
      duration: '',
    },
    category: 'prescribed' as const,
    indication: '',
    notes: '',
  });

  useEffect(() => {
    onMedicationsUpdate(medications);
  }, [medications, onMedicationsUpdate]);

  const handleAddMedication = () => {
    setEditingMedication(null);
    setFormData({
      drugName: '',
      genericName: '',
      strength: { value: 0, unit: 'mg' },
      dosageForm: '',
      instructions: {
        dose: '',
        frequency: '',
        route: 'oral',
        duration: '',
      },
      category: 'prescribed',
      indication: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleEditMedication = (medication: MTRMedication) => {
    setEditingMedication(medication);
    setFormData({
      drugName: medication.drugName,
      genericName: medication.genericName || '',
      strength: medication.strength,
      dosageForm: medication.dosageForm,
      instructions: medication.instructions,
      category: medication.category,
      indication: medication.indication,
      notes: medication.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSaveMedication = () => {
    const medication: MTRMedication = {
      id: editingMedication?.id || Date.now().toString(),
      ...formData,
      startDate: new Date(),
      isManual: true,
    };

    if (editingMedication) {
      setMedications(prev => 
        prev.map(med => med.id === editingMedication.id ? medication : med)
      );
    } else {
      setMedications(prev => [...prev, medication]);
    }

    setDialogOpen(false);
  };

  const handleDeleteMedication = (id: string) => {
    setMedications(prev => prev.filter(med => med.id !== id));
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Medication History
      </Typography>

      <Card>
        <CardContent>
          {medications.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No medications added yet. Click the + button to add medications.
            </Typography>
          ) : (
            <List>
              {medications.map((medication) => (
                <ListItem
                  key={medication.id}
                  secondaryAction={
                    <Box>
                      <IconButton onClick={() => handleEditMedication(medication)}>
                        <Edit />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteMedication(medication.id!)}>
                        <Delete />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={medication.drugName}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {medication.strength.value} {medication.strength.unit} - {medication.dosageForm}
                        </Typography>
                        <Typography variant="body2">
                          {medication.instructions.dose} {medication.instructions.frequency}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Indication: {medication.indication}
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

      <Fab
        color="primary"
        onClick={handleAddMedication}
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
      >
        <Add />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingMedication ? 'Edit Medication' : 'Add Medication'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Drug Name"
                value={formData.drugName}
                onChange={(e) => setFormData(prev => ({ ...prev, drugName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Generic Name"
                value={formData.genericName}
                onChange={(e) => setFormData(prev => ({ ...prev, genericName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Strength"
                type="number"
                value={formData.strength.value}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  strength: { ...prev.strength, value: Number(e.target.value) }
                }))}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                select
                label="Unit"
                value={formData.strength.unit}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  strength: { ...prev.strength, unit: e.target.value }
                }))}
              >
                <MenuItem value="mg">mg</MenuItem>
                <MenuItem value="g">g</MenuItem>
                <MenuItem value="ml">ml</MenuItem>
                <MenuItem value="units">units</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Dosage Form"
                value={formData.dosageForm}
                onChange={(e) => setFormData(prev => ({ ...prev, dosageForm: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Indication"
                value={formData.indication}
                onChange={(e) => setFormData(prev => ({ ...prev, indication: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveMedication} variant="contained">
            {editingMedication ? 'Update' : 'Add'}
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
          disabled={medications.length === 0}
          sx={{ ml: 'auto' }}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};

export default MedicationHistory;