import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Chip,
  Alert
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { useTherapyPlans, useCreateTherapyPlan, useDeleteTherapyPlan } from '../queries/drugQueries';
import { useDrugStore } from '../stores/drugStore';
import { TherapyPlan } from '../types/drugTypes';

const TherapyPlanManager: React.FC = () => {
  const [open, setOpen] = useState<boolean>(false);
  const [planName, setPlanName] = useState<string>('');
  const [guidelines, setGuidelines] = useState<string>('');
  const { selectedDrug } = useDrugStore();
  const { data: savedPlans = [] } = useTherapyPlans();
  const { mutate: createPlan } = useCreateTherapyPlan();
  const { mutate: deletePlan } = useDeleteTherapyPlan();

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setPlanName('');
    setGuidelines('');
  };

  const handleCreatePlan = () => {
    if (!planName.trim()) return;
    
    const newPlan: Omit<TherapyPlan, '_id' | 'createdAt' | 'updatedAt'> = {
      planName,
      drugs: selectedDrug ? [selectedDrug] : [],
      guidelines
    };
    
    createPlan(newPlan, {
      onSuccess: () => {
        handleClose();
      }
    });
  };

  const handleDeletePlan = (id: string) => {
    deletePlan(id);
  };

  return (
    <Paper elevation={2} className="p-4">
      <Box display="flex" justifyContent="space-between" alignItems="center" className="mb-4">
        <Typography variant="h6">
          Therapy Plans
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleOpen}
        >
          New Plan
        </Button>
      </Box>
      
      {savedPlans.length === 0 ? (
        <Alert severity="info">
          No therapy plans created yet. Create your first plan to save drug information.
        </Alert>
      ) : (
        <List>
          {savedPlans.map((plan) => (
            <ListItem key={plan._id} className="border-b last:border-b-0">
              <ListItemText
                primary={plan.planName}
                secondary={
                  <Box>
                    <Typography variant="body2">
                      {plan.drugs.length} drug(s) included
                    </Typography>
                    {plan.guidelines && (
                      <Typography variant="body2" className="mt-1">
                        Guidelines: {plan.guidelines}
                      </Typography>
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton 
                  edge="end" 
                  aria-label="delete"
                  onClick={() => plan._id && handleDeletePlan(plan._id)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
      
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Therapy Plan</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Plan Name"
            fullWidth
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="mb-4"
          />
          <TextField
            margin="dense"
            label="Clinical Guidelines (Optional)"
            fullWidth
            multiline
            rows={3}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
          />
          {selectedDrug && (
            <Box className="mt-4">
              <Typography variant="subtitle1" className="mb-2">
                Selected Drug:
              </Typography>
              <Chip label={selectedDrug.name} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleCreatePlan} 
            variant="contained" 
            disabled={!planName.trim()}
          >
            Create Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TherapyPlanManager;