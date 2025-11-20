import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Box,
  Typography,
  IconButton,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * Quick Add Lab Result Modal
 * Simplified modal for quickly adding lab results from patient page
 */

interface QuickAddLabResultModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
}

// Simplified validation schema for quick add
const quickLabResultSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  testCategory: z.enum(['Hematology', 'Chemistry', 'Microbiology', 'Immunology', 'Pathology', 'Radiology', 'Other']),
  specimenType: z.enum(['Blood', 'Urine', 'Stool', 'Saliva', 'Tissue', 'Swab', 'Other']),
  testValue: z.string().min(1, 'Test value is required'),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  interpretation: z.enum(['Normal', 'Low', 'High', 'Critical', 'Abnormal', 'Pending']),
  isCritical: z.boolean(),
  testDate: z.string().min(1, 'Test date is required'),
  laboratoryName: z.string().optional(),
  notes: z.string().optional(),
});

type QuickLabResultFormData = z.infer<typeof quickLabResultSchema>;

const QuickAddLabResultModal: React.FC<QuickAddLabResultModalProps> = ({
  open,
  onClose,
  patientId,
  patientName,
}) => {
  const queryClient = useQueryClient();
  const [autoInterpret, setAutoInterpret] = useState(true);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<QuickLabResultFormData>({
    resolver: zodResolver(quickLabResultSchema),
    defaultValues: {
      testName: '',
      testCategory: 'Chemistry',
      specimenType: 'Blood',
      testValue: '',
      unit: '',
      referenceRange: '',
      interpretation: 'Pending',
      isCritical: false,
      testDate: new Date().toISOString().split('T')[0],
      laboratoryName: '',
      notes: '',
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: QuickLabResultFormData) => {
      const response = await api.post('/laboratory/results', {
        ...data,
        patientId,
        status: 'Completed',
        isAbnormal: data.interpretation !== 'Normal' && data.interpretation !== 'Pending',
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Lab result added successfully');
      queryClient.invalidateQueries({ queryKey: ['patient-lab-results', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-lab-stats', patientId] });
      queryClient.invalidateQueries({ queryKey: ['lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['lab-statistics'] });
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add lab result');
    },
  });

  const handleClose = () => {
    reset();
    setAutoInterpret(true);
    onClose();
  };

  const onSubmit = (data: QuickLabResultFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScienceIcon sx={{ color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6">Quick Add Lab Result</Typography>
              {patientName && (
                <Typography variant="caption" color="text.secondary">
                  Patient: {patientName}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {/* Test Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Test Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="testName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Test Name"
                    required
                    error={!!errors.testName}
                    helperText={errors.testName?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="testCategory"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="Category"
                    required
                  >
                    <MenuItem value="Hematology">Hematology</MenuItem>
                    <MenuItem value="Chemistry">Chemistry</MenuItem>
                    <MenuItem value="Microbiology">Microbiology</MenuItem>
                    <MenuItem value="Immunology">Immunology</MenuItem>
                    <MenuItem value="Pathology">Pathology</MenuItem>
                    <MenuItem value="Radiology">Radiology</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="specimenType"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="Specimen Type"
                    required
                  >
                    <MenuItem value="Blood">Blood</MenuItem>
                    <MenuItem value="Urine">Urine</MenuItem>
                    <MenuItem value="Stool">Stool</MenuItem>
                    <MenuItem value="Saliva">Saliva</MenuItem>
                    <MenuItem value="Tissue">Tissue</MenuItem>
                    <MenuItem value="Swab">Swab</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="testDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="date"
                    label="Test Date"
                    required
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.testDate}
                    helperText={errors.testDate?.message}
                  />
                )}
              />
            </Grid>

            {/* Test Results */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Test Results
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="testValue"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Test Value"
                    required
                    error={!!errors.testValue}
                    helperText={errors.testValue?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Unit"
                    placeholder="e.g., mg/dL, mmol/L"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="referenceRange"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Reference Range"
                    placeholder="e.g., 70-100"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="interpretation"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="Interpretation"
                    required
                  >
                    <MenuItem value="Normal">Normal</MenuItem>
                    <MenuItem value="Low">Low</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Critical">Critical</MenuItem>
                    <MenuItem value="Abnormal">Abnormal</MenuItem>
                    <MenuItem value="Pending">Pending</MenuItem>
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="isCritical"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Mark as Critical"
                  />
                )}
              />
            </Grid>

            {/* Additional Information */}
            <Grid item xs={12}>
              <Controller
                name="laboratoryName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Laboratory Name"
                    placeholder="Optional"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes"
                    placeholder="Optional notes or comments"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving...' : 'Save Result'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default QuickAddLabResultModal;

