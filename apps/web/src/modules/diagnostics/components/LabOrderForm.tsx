import React, { useState, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Autocomplete,
  IconButton,
  Divider,
  Alert,
  Tooltip,
  Chip,
  Paper,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import type { LabOrderFormProps, LabTestCatalogItem } from '../types';
import { useLabStore } from '../store/labStore';

// Common lab tests for quick selection
const COMMON_LAB_TESTS = [
  {
    code: 'CBC',
    name: 'Complete Blood Count',
    loincCode: '58410-2',
    category: 'Hematology',
    description: 'Complete blood count with differential',
  },
  {
    code: 'CMP',
    name: 'Comprehensive Metabolic Panel',
    loincCode: '24323-8',
    category: 'Chemistry',
    description: 'Basic metabolic panel plus liver function tests',
  },
  {
    code: 'LIPID',
    name: 'Lipid Panel',
    loincCode: '57698-3',
    category: 'Chemistry',
    description: 'Total cholesterol, HDL, LDL, triglycerides',
  },
  {
    code: 'TSH',
    name: 'Thyroid Stimulating Hormone',
    loincCode: '3016-3',
    category: 'Endocrinology',
    description: 'Thyroid function screening',
  },
  {
    code: 'HBA1C',
    name: 'Hemoglobin A1c',
    loincCode: '4548-4',
    category: 'Chemistry',
    description: 'Diabetes monitoring',
  },
  {
    code: 'PT_INR',
    name: 'Prothrombin Time/INR',
    loincCode: '6301-6',
    category: 'Coagulation',
    description: 'Anticoagulation monitoring',
  },
  {
    code: 'URINALYSIS',
    name: 'Urinalysis',
    loincCode: '5804-0',
    category: 'Urinalysis',
    description: 'Complete urinalysis with microscopy',
  },
  {
    code: 'CRP',
    name: 'C-Reactive Protein',
    loincCode: '1988-5',
    category: 'Immunology',
    description: 'Inflammation marker',
  },
];

const PRIORITY_OPTIONS = [
  {
    value: 'stat',
    label: 'STAT (Immediate)',
    color: 'error' as const,
    description: 'Results needed immediately',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    color: 'warning' as const,
    description: 'Results needed within 2-4 hours',
  },
  {
    value: 'routine',
    label: 'Routine',
    color: 'success' as const,
    description: 'Standard processing time',
  },
];

interface LabTest {
  code: string;
  name: string;
  loincCode?: string;
  indication: string;
  priority: 'stat' | 'urgent' | 'routine';
}

interface LabOrderFormData {
  patientId: string;
  tests: LabTest[];
  expectedDate?: string;
  clinicalIndication: string;
}

const LabOrderForm: React.FC<LabOrderFormProps> = ({
  patientId,
  onSubmit,
  loading = false,
  error,
}) => {
  const [showTestCatalog, setShowTestCatalog] = useState(false);
  const [testSearch, setTestSearch] = useState('');

  const {
    testCatalog,
    fetchTestCatalog,
    searchTestCatalog,
    loading: storeLoading,
  } = useLabStore();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<LabOrderFormData>({
    defaultValues: {
      patientId,
      tests: [],
      expectedDate: '',
      clinicalIndication: '',
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tests',
  });

  const watchedTests = watch('tests');

  // Load test catalog on mount
  React.useEffect(() => {
    if (testCatalog.length === 0) {
      fetchTestCatalog();
    }
  }, [testCatalog.length, fetchTestCatalog]);

  const handleAddTest = useCallback(
    (test: LabTestCatalogItem | (typeof COMMON_LAB_TESTS)[0]) => {
      const newTest: LabTest = {
        code: test.code,
        name: test.name,
        loincCode: test.loincCode,
        indication: '',
        priority: 'routine',
      };

      // Check if test already exists
      const exists = watchedTests.some((t) => t.code === test.code);
      if (!exists) {
        append(newTest);
      }
    },
    [watchedTests, append]
  );

  const handleQuickAddTest = useCallback(
    (test: (typeof COMMON_LAB_TESTS)[0]) => {
      handleAddTest(test);
    },
    [handleAddTest]
  );

  const handleSearchTests = useCallback(
    (searchTerm: string) => {
      setTestSearch(searchTerm);
      if (searchTerm.length > 2) {
        fetchTestCatalog(searchTerm);
      }
    },
    [fetchTestCatalog]
  );

  const getFilteredCatalog = useCallback(() => {
    return searchTestCatalog(testSearch);
  }, [testSearch, searchTestCatalog]);

  const getPriorityColor = (priority: string) => {
    const option = PRIORITY_OPTIONS.find((opt) => opt.value === priority);
    return option?.color || 'default';
  };

  const onFormSubmit = (data: LabOrderFormData) => {
    const formattedData = {
      patientId: data.patientId,
      tests: data.tests.map((test) => ({
        ...test,
        indication: test.indication || data.clinicalIndication,
      })),
      expectedDate: data.expectedDate || undefined,
    };
    onSubmit(formattedData);
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <LocalHospitalIcon sx={{ mr: 1, color: 'primary.main' }} />
            Lab Order Form
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a new laboratory test order for the patient
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onFormSubmit)}>
          <Stack spacing={4}>
            {/* Clinical Indication */}
            <Box>
              <Controller
                name="clinicalIndication"
                control={control}
                rules={{
                  required: 'Clinical indication is required',
                  minLength: {
                    value: 10,
                    message: 'Please provide a detailed clinical indication',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Clinical Indication"
                    placeholder="Describe the clinical reason for ordering these tests..."
                    multiline
                    rows={3}
                    error={!!errors.clinicalIndication}
                    helperText={
                      errors.clinicalIndication?.message ||
                      'Provide the clinical reason for ordering these tests'
                    }
                    disabled={loading}
                  />
                )}
              />
            </Box>

            <Divider />

            {/* Test Selection */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Select Laboratory Tests
              </Typography>

              {/* Current Tests */}
              {fields.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 2, color: 'text.secondary' }}
                  >
                    Selected Tests ({fields.length})
                  </Typography>
                  <Stack spacing={2}>
                    {fields.map((field, index) => (
                      <Paper key={field.id} sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} md={4}>
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {field.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Code: {field.code}
                                {field.loincCode &&
                                  ` • LOINC: ${field.loincCode}`}
                              </Typography>
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={3}>
                            <Controller
                              name={`tests.${index}.priority`}
                              control={control}
                              render={({ field: priorityField }) => (
                                <FormControl fullWidth size="small">
                                  <InputLabel>Priority</InputLabel>
                                  <Select
                                    {...priorityField}
                                    label="Priority"
                                    disabled={loading}
                                  >
                                    {PRIORITY_OPTIONS.map((option) => (
                                      <MenuItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Chip
                                            label={option.label}
                                            size="small"
                                            color={option.color}
                                            variant="outlined"
                                            sx={{ mr: 1 }}
                                          />
                                        </Box>
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                            />
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Controller
                              name={`tests.${index}.indication`}
                              control={control}
                              render={({ field: indicationField }) => (
                                <TextField
                                  {...indicationField}
                                  fullWidth
                                  size="small"
                                  label="Specific Indication"
                                  placeholder="Optional specific indication..."
                                  disabled={loading}
                                />
                              )}
                            />
                          </Grid>

                          <Grid item xs={12} md={1}>
                            <IconButton
                              onClick={() => remove(index)}
                              color="error"
                              disabled={loading}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Quick Add Common Tests */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Common Tests
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', gap: 1 }}
                >
                  {COMMON_LAB_TESTS.map((test) => (
                    <Chip
                      key={test.code}
                      label={test.name}
                      onClick={() => handleQuickAddTest(test)}
                      disabled={
                        loading ||
                        watchedTests.some((t) => t.code === test.code)
                      }
                      sx={{ cursor: 'pointer' }}
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                </Stack>
              </Box>

              {/* Test Catalog Search */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowTestCatalog(!showTestCatalog)}
                    disabled={loading}
                    startIcon={<SearchIcon />}
                  >
                    {showTestCatalog ? 'Hide' : 'Search'} Test Catalog
                  </Button>
                </Box>

                {showTestCatalog && (
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search for lab tests..."
                      value={testSearch}
                      onChange={(e) => handleSearchTests(e.target.value)}
                      disabled={loading || storeLoading.fetchCatalog}
                      sx={{ mb: 2 }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <SearchIcon
                              sx={{ mr: 1, color: 'text.secondary' }}
                            />
                          ),
                        },
                      }}
                    />

                    {testSearch.length > 2 && (
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {getFilteredCatalog().map((test) => (
                          <Paper
                            key={test.code}
                            sx={{
                              p: 2,
                              mb: 1,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' },
                              opacity: watchedTests.some(
                                (t) => t.code === test.code
                              )
                                ? 0.5
                                : 1,
                            }}
                            onClick={() => handleAddTest(test)}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                              }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {test.name}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {test.code} • {test.category}
                                  {test.loincCode &&
                                    ` • LOINC: ${test.loincCode}`}
                                </Typography>
                                {test.description && (
                                  <Typography
                                    variant="caption"
                                    sx={{ display: 'block', mt: 0.5 }}
                                  >
                                    {test.description}
                                  </Typography>
                                )}
                              </Box>
                              {watchedTests.some(
                                (t) => t.code === test.code
                              ) && (
                                <Chip
                                  label="Added"
                                  size="small"
                                  color="success"
                                />
                              )}
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Expected Date */}
            <Box>
              <Controller
                name="expectedDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Expected Results Date"
                    slotProps={{
                      inputLabel: { shrink: true },
                    }}
                    helperText="Optional: When do you expect the results?"
                    disabled={loading}
                    sx={{ maxWidth: 300 }}
                  />
                )}
              />
            </Box>

            {/* Validation Summary */}
            {fields.length === 0 && (
              <Alert severity="warning">
                <Typography variant="body2">
                  Please select at least one laboratory test to create an order.
                </Typography>
              </Alert>
            )}

            {/* Order Summary */}
            {fields.length > 0 && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Order Summary:
                </Typography>
                <Typography variant="body2">
                  {fields.length} test(s) selected
                  {fields.some((t) => t.priority === 'stat') &&
                    ' • Contains STAT orders'}
                  {fields.some((t) => t.priority === 'urgent') &&
                    ' • Contains urgent orders'}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {PRIORITY_OPTIONS.map((priority) => {
                    const count = fields.filter(
                      (t) => t.priority === priority.value
                    ).length;
                    return count > 0 ? (
                      <Chip
                        key={priority.value}
                        label={`${count} ${priority.label}`}
                        size="small"
                        color={priority.color}
                        variant="outlined"
                        sx={{ mr: 1, mb: 0.5 }}
                      />
                    ) : null;
                  })}
                </Box>
              </Alert>
            )}

            {/* Submit Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !isValid || fields.length === 0}
                sx={{ minWidth: 120 }}
              >
                {loading ? 'Creating Order...' : 'Create Order'}
              </Button>
            </Box>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
};

export default LabOrderForm;
