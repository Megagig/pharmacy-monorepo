import React, { useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  IconButton,
  MenuItem,
  Divider,
  Card,
  CardContent,
  CardActions,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Lab Template Form
 * Create or edit test panel templates
 * Routes: /laboratory/templates/new, /laboratory/templates/:id/edit
 */

// Test categories
const TEST_CATEGORIES = [
  'Hematology',
  'Chemistry',
  'Microbiology',
  'Immunology',
  'Pathology',
  'Radiology',
  'Other',
];

// Template categories
const TEMPLATE_CATEGORIES = [
  'Complete Blood Count',
  'Metabolic Panel',
  'Lipid Panel',
  'Liver Function',
  'Kidney Function',
  'Thyroid Function',
  'Diabetes Screening',
  'Cardiac Markers',
  'Infectious Disease',
  'Custom',
];

// Validation schema
const templateItemSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  testCode: z.string().optional(),
  loincCode: z.string().optional(),
  testCategory: z.enum([
    'Hematology',
    'Chemistry',
    'Microbiology',
    'Immunology',
    'Pathology',
    'Radiology',
    'Other',
  ]),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
});

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  items: z.array(templateItemSchema).min(1, 'At least one test is required'),
});

type TemplateFormData = z.infer<typeof templateSchema>;

const LabTemplateForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      items: [
        {
          testName: '',
          testCode: '',
          loincCode: '',
          testCategory: 'Chemistry',
          unit: '',
          referenceRange: '',
          referenceRangeLow: undefined,
          referenceRangeHigh: undefined,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Fetch template for editing
  const { data: template } = useQuery({
    queryKey: ['lab-template', id],
    queryFn: async () => {
      const response = await api.get(`/laboratory/templates/${id}`);
      return response.data.data;
    },
    enabled: isEditMode,
  });

  // Populate form when editing
  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description || '',
        category: template.category,
        items: template.items,
      });
    }
  }, [template, reset]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const response = await api.post('/laboratory/templates', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Template created successfully');
      queryClient.invalidateQueries({ queryKey: ['lab-templates-all'] });
      queryClient.invalidateQueries({ queryKey: ['lab-templates-workplace'] });
      navigate('/laboratory/templates');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create template');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const response = await api.put(`/laboratory/templates/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Template updated successfully');
      queryClient.invalidateQueries({ queryKey: ['lab-templates-all'] });
      queryClient.invalidateQueries({ queryKey: ['lab-templates-workplace'] });
      queryClient.invalidateQueries({ queryKey: ['lab-template', id] });
      navigate('/laboratory/templates');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update template');
    },
  });

  // Handle form submission
  const onSubmit = (data: TemplateFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Add new test item
  const handleAddTest = () => {
    append({
      testName: '',
      testCode: '',
      loincCode: '',
      testCategory: 'Chemistry',
      unit: '',
      referenceRange: '',
      referenceRangeLow: undefined,
      referenceRangeHigh: undefined,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate('/laboratory/templates')} color="primary">
            <ArrowBackIcon />
          </IconButton>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ScienceIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {isEditMode ? 'Edit Template' : 'Create New Template'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEditMode ? 'Update test panel template' : 'Create a reusable test panel template'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Template Information */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Template Information
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Template Name"
                    fullWidth
                    required
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Category"
                    fullWidth
                    required
                    select
                    error={!!errors.category}
                    helperText={errors.category?.message}
                  >
                    {TEMPLATE_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={2}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Test Items */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Test Items ({fields.length})</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddTest}>
              Add Test
            </Button>
          </Box>
          <Divider sx={{ mb: 3 }} />

          {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errors.items.message}
            </Alert>
          )}

          <Grid container spacing={3}>
            {fields.map((field, index) => (
              <Grid item xs={12} key={field.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        Test #{index + 1}
                      </Typography>
                      {fields.length > 1 && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => remove(index)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name={`items.${index}.testName`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Test Name"
                              fullWidth
                              required
                              error={!!errors.items?.[index]?.testName}
                              helperText={errors.items?.[index]?.testName?.message}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Controller
                          name={`items.${index}.testCode`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Test Code"
                              fullWidth
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Controller
                          name={`items.${index}.loincCode`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="LOINC Code"
                              fullWidth
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`items.${index}.testCategory`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Category"
                              fullWidth
                              required
                              select
                              error={!!errors.items?.[index]?.testCategory}
                              helperText={errors.items?.[index]?.testCategory?.message}
                            >
                              {TEST_CATEGORIES.map((category) => (
                                <MenuItem key={category} value={category}>
                                  {category}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`items.${index}.unit`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Unit"
                              fullWidth
                              placeholder="e.g., mg/dL, mmol/L"
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Controller
                          name={`items.${index}.referenceRange`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Reference Range"
                              fullWidth
                              placeholder="e.g., 70-100 mg/dL"
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name={`items.${index}.referenceRangeLow`}
                          control={control}
                          render={({ field: { value, onChange, ...field } }) => (
                            <TextField
                              {...field}
                              label="Reference Range Low"
                              fullWidth
                              type="number"
                              value={value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                onChange(val === '' ? undefined : parseFloat(val));
                              }}
                              inputProps={{ step: 'any' }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name={`items.${index}.referenceRangeHigh`}
                          control={control}
                          render={({ field: { value, onChange, ...field } }) => (
                            <TextField
                              {...field}
                              label="Reference Range High"
                              fullWidth
                              type="number"
                              value={value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                onChange(val === '' ? undefined : parseFloat(val));
                              }}
                              inputProps={{ step: 'any' }}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/laboratory/templates')}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isPending}
          >
            {isPending ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
          </Button>
        </Box>
      </form>
    </Container>
  );
};

export default LabTemplateForm;

