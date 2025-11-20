import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  Divider,
  InputAdornment,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Icons
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import BiotechIcon from '@mui/icons-material/Biotech';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SearchIcon from '@mui/icons-material/Search';

import { RBACGuard } from '../hooks/useRBAC';
import {
  ErrorDisplay,
  LoadingSkeleton,
  LoadingState,
} from './common/ErrorDisplay';
import { useCRUDNotifications } from './common/NotificationSystem';
import { useAsyncOperation } from '../hooks/useErrorHandling';
import { useResponsive } from '../hooks/useResponsive';
import {
  ResponsiveContainer,
  ResponsiveHeader,
  ResponsiveCard,
} from './common/ResponsiveComponents';

import {
  usePatientAssessments,
  useCreateAssessment,
  useUpdateAssessment,
} from '../queries/usePatientResources';
import type {
  ClinicalAssessment,
  CreateAssessmentData,
  UpdateAssessmentData,
} from '../types/patientManagement';

interface ClinicalAssessmentProps {
  patientId: string;
}

interface AssessmentFormData {
  // Vitals
  bpSys?: number;
  bpDia?: number;
  rr?: number;
  tempC?: number;
  heartSounds?: string;
  pallor?: 'none' | 'mild' | 'moderate' | 'severe';
  dehydration?: 'none' | 'mild' | 'moderate' | 'severe';

  // Labs
  pcv?: number;
  mcs?: string;
  eucr?: string;
  fbc?: string;
  fbs?: number;
  hba1c?: number;

  recordedAt: Date;
}

const PALLOR_LEVELS = [
  { value: 'none', label: 'None', color: 'success' as const },
  { value: 'mild', label: 'Mild', color: 'warning' as const },
  { value: 'moderate', label: 'Moderate', color: 'error' as const },
  { value: 'severe', label: 'Severe', color: 'error' as const },
];

const ClinicalAssessmentComponent: React.FC<ClinicalAssessmentProps> = ({
  patientId,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] =
    useState<ClinicalAssessment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Enhanced notifications, error handling and responsive design
  const crudNotifications = useCRUDNotifications();
  const { executeOperation, isLoading } = useAsyncOperation();
  const { isMobile } = useResponsive();

  // React Query hooks
  const {
    data: assessmentsResponse,
    isLoading: allLoading,
    isError: allError,
    error,
  } = usePatientAssessments(patientId);
  const createAssessmentMutation = useCreateAssessment();
  const updateAssessmentMutation = useUpdateAssessment();

  const assessments = assessmentsResponse?.data?.results || [];

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssessmentFormData>({
    defaultValues: {
      bpSys: undefined,
      bpDia: undefined,
      rr: undefined,
      tempC: undefined,
      heartSounds: '',
      pallor: 'none',
      dehydration: 'none',
      pcv: undefined,
      mcs: '',
      eucr: '',
      fbc: '',
      fbs: undefined,
      hba1c: undefined,
      recordedAt: new Date(),
    },
  });

  const handleOpenDialog = (assessment?: ClinicalAssessment) => {


    if (assessment) {
      setSelectedAssessment(assessment);
      reset({
        bpSys: assessment.vitals?.bpSys,
        bpDia: assessment.vitals?.bpDia,
        rr: assessment.vitals?.rr,
        tempC: assessment.vitals?.tempC,
        heartSounds: assessment.vitals?.heartSounds || '',
        pallor: assessment.vitals?.pallor || 'none',
        dehydration: assessment.vitals?.dehydration || 'none',
        pcv: assessment.labs?.pcv,
        mcs: assessment.labs?.mcs || '',
        eucr: assessment.labs?.eucr || '',
        fbc: assessment.labs?.fbc || '',
        fbs: assessment.labs?.fbs,
        hba1c: assessment.labs?.hba1c,
        recordedAt: new Date(assessment.recordedAt),
      });
    } else {
      setSelectedAssessment(null);
      reset({
        bpSys: undefined,
        bpDia: undefined,
        rr: undefined,
        tempC: undefined,
        heartSounds: '',
        pallor: 'none',
        dehydration: 'none',
        pcv: undefined,
        mcs: '',
        eucr: '',
        fbc: '',
        fbs: undefined,
        hba1c: undefined,
        recordedAt: new Date(),
      });
    }

    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAssessment(null);
    reset();
  };

  const handleSaveAssessment = async (formData: AssessmentFormData) => {
    const assessmentData: CreateAssessmentData | UpdateAssessmentData = {
      vitals: {
        bpSys: formData.bpSys ? Number(formData.bpSys) : undefined,
        bpDia: formData.bpDia ? Number(formData.bpDia) : undefined,
        rr: formData.rr ? Number(formData.rr) : undefined,
        tempC: formData.tempC ? Number(formData.tempC) : undefined,
        heartSounds: formData.heartSounds?.trim() || undefined,
        pallor: formData.pallor,
        dehydration: formData.dehydration,
      },
      labs: {
        pcv: formData.pcv ? Number(formData.pcv) : undefined,
        mcs: formData.mcs?.trim() || undefined,
        eucr: formData.eucr?.trim() || undefined,
        fbc: formData.fbc?.trim() || undefined,
        fbs: formData.fbs ? Number(formData.fbs) : undefined,
        hba1c: formData.hba1c ? Number(formData.hba1c) : undefined,
      },
      recordedAt: formData.recordedAt.toISOString(),
    };

    const operation = selectedAssessment
      ? () =>
          updateAssessmentMutation.mutateAsync({
            assessmentId: selectedAssessment._id,
            assessmentData: assessmentData as UpdateAssessmentData,
          })
      : () =>
          createAssessmentMutation.mutateAsync({
            patientId,
            assessmentData: assessmentData as CreateAssessmentData,
          });

    await executeOperation(
      selectedAssessment ? 'updateAssessment' : 'createAssessment',
      operation,
      {
        onSuccess: () => {
          handleCloseDialog();
          if (selectedAssessment) {
            crudNotifications.updated('assessment');
          } else {
            crudNotifications.created('assessment');
          }
        },
        onError: (error: unknown) => {
          const operation = selectedAssessment ? 'update' : 'create';
          crudNotifications[`${operation}Failed`](
            'assessment',
            error instanceof Error ? error : new Error('Unknown error')
          );
        },
      }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFilteredAssessments = () => {
    let filtered = assessments;

    if (searchTerm) {
      filtered = filtered.filter((assessment: ClinicalAssessment) =>
        formatDate(assessment.recordedAt)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredAssessments = getFilteredAssessments();

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <ResponsiveContainer>
        <LoadingState
          loading={allLoading}
          error={allError ? error : null}
          loadingComponent={
            <LoadingSkeleton variant="table" count={5} animation="wave" />
          }
          errorComponent={
            <ErrorDisplay
              error={error}
              title="Failed to load assessments"
              type={allError ? 'server' : 'error'}
              retry={() => window.location.reload()}
              showDetails={process.env.NODE_ENV === 'development'}
            />
          }
          emptyComponent={
            <ResponsiveCard
              title="No assessments recorded"
              subtitle="Start by adding the patient's clinical assessments and lab results."
            >
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <MonitorHeartIcon
                  sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add First Assessment
                </Button>
              </Box>
            </ResponsiveCard>
          }
          isEmpty={!allLoading && !allError && assessments.length === 0}
        >
          {/* Header */}
          <ResponsiveHeader
            title="Clinical Assessments"
            subtitle={`${assessments.length} assessment${
              assessments.length !== 1 ? 's' : ''
            } recorded`}
            actions={
              <RBACGuard action="canCreate">
                <Button
                  variant="contained"
                  startIcon={
                    isLoading('createAssessment') ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AddIcon />
                    )
                  }
                  onClick={() => handleOpenDialog()}
                  disabled={
                    isLoading('createAssessment') ||
                    isLoading('updateAssessment')
                  }
                  fullWidth={isMobile}
                >
                  {isLoading('createAssessment')
                    ? 'Adding...'
                    : 'Add Assessment'}
                </Button>
              </RBACGuard>
            }
          />

          {/* Simple assessment list */}
          {assessments.length > 0 && (
            <Card>
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Search assessments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <SearchIcon sx={{ mr: 1, opacity: 0.5 }} />
                      ),
                    }}
                  />
                </Box>

                {filteredAssessments.length === 0 ? (
                  <Typography color="text.secondary">
                    No assessments found.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {filteredAssessments.map(
                      (assessment: ClinicalAssessment) => (
                        <Card key={assessment._id} variant="outlined">
                          <CardContent sx={{ py: 2 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 2,
                              }}
                            >
                              <Typography variant="subtitle2">
                                {formatDate(assessment.recordedAt)}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <RBACGuard action="canUpdate">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenDialog(assessment)}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </RBACGuard>
                              </Box>
                            </Box>

                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                  xs: '1fr',
                                  md: '1fr 1fr',
                                },
                                gap: 2,
                              }}
                            >
                              {/* Vitals */}
                              <Box>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  gutterBottom
                                >
                                  Vitals
                                </Typography>
                                {assessment.vitals?.bpSys &&
                                  assessment.vitals?.bpDia && (
                                    <Typography variant="body2">
                                      BP: {assessment.vitals.bpSys}/
                                      {assessment.vitals.bpDia} mmHg
                                    </Typography>
                                  )}
                                {assessment.vitals?.tempC && (
                                  <Typography variant="body2">
                                    Temp: {assessment.vitals.tempC}°C
                                  </Typography>
                                )}
                                {assessment.vitals?.rr && (
                                  <Typography variant="body2">
                                    RR: {assessment.vitals.rr}/min
                                  </Typography>
                                )}
                              </Box>

                              {/* Labs */}
                              <Box>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  gutterBottom
                                >
                                  Lab Results
                                </Typography>
                                {assessment.labs?.pcv && (
                                  <Typography variant="body2">
                                    PCV: {assessment.labs.pcv}%
                                  </Typography>
                                )}
                                {assessment.labs?.fbs && (
                                  <Typography variant="body2">
                                    FBS: {assessment.labs.fbs} mg/dL
                                  </Typography>
                                )}
                                {assessment.labs?.hba1c && (
                                  <Typography variant="body2">
                                    HbA1c: {assessment.labs.hba1c}%
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}
        </LoadingState>

        {/* Add/Edit Assessment Dialog - Outside LoadingState so it can always render */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MonitorHeartIcon color="primary" />
              <Typography variant="h6">
                {selectedAssessment ? 'Edit Assessment' : 'Add New Assessment'}
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent>
            <form onSubmit={handleSubmit(handleSaveAssessment)}>
              <Stack spacing={3} sx={{ mt: 1 }}>
                <Controller
                  name="recordedAt"
                  control={control}
                  rules={{ required: 'Date and time is required' }}
                  render={({ field }) => (
                    <DateTimePicker
                      {...field}
                      label="Date & Time *"
                      maxDate={new Date()}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.recordedAt,
                          helperText: errors.recordedAt?.message,
                        },
                      }}
                    />
                  )}
                />

                <Divider />

                {/* Vitals Section */}
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <FavoriteIcon color="primary" />
                    Vital Signs
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="bpSys"
                      control={control}
                      rules={{
                        min: {
                          value: 50,
                          message: 'Systolic BP must be at least 50',
                        },
                        max: {
                          value: 300,
                          message: 'Systolic BP cannot exceed 300',
                        },
                      }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          value={value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === '' ? undefined : Number(val));
                          }}
                          label="Systolic BP"
                          type="number"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                mmHg
                              </InputAdornment>
                            ),
                          }}
                          error={!!errors.bpSys}
                          helperText={errors.bpSys?.message}
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="bpDia"
                      control={control}
                      rules={{
                        min: {
                          value: 30,
                          message: 'Diastolic BP must be at least 30',
                        },
                        max: {
                          value: 200,
                          message: 'Diastolic BP cannot exceed 200',
                        },
                      }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          value={value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === '' ? undefined : Number(val));
                          }}
                          label="Diastolic BP"
                          type="number"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                mmHg
                              </InputAdornment>
                            ),
                          }}
                          error={!!errors.bpDia}
                          helperText={errors.bpDia?.message}
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="tempC"
                      control={control}
                      rules={{
                        min: {
                          value: 30,
                          message: 'Temperature must be at least 30°C',
                        },
                        max: {
                          value: 45,
                          message: 'Temperature cannot exceed 45°C',
                        },
                      }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          value={value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === '' ? undefined : Number(val));
                          }}
                          label="Temperature"
                          type="number"
                          inputProps={{ step: '0.1' }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">°C</InputAdornment>
                            ),
                          }}
                          error={!!errors.tempC}
                          helperText={errors.tempC?.message}
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="rr"
                      control={control}
                      rules={{
                        min: {
                          value: 5,
                          message: 'Respiratory rate must be at least 5',
                        },
                        max: {
                          value: 60,
                          message: 'Respiratory rate cannot exceed 60',
                        },
                      }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          value={value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === '' ? undefined : Number(val));
                          }}
                          label="Respiratory Rate"
                          type="number"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                /min
                              </InputAdornment>
                            ),
                          }}
                          error={!!errors.rr}
                          helperText={errors.rr?.message}
                          fullWidth
                        />
                      )}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                      gap: 2,
                      mt: 2,
                    }}
                  >
                    <Controller
                      name="pallor"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Pallor</InputLabel>
                          <Select {...field} label="Pallor">
                            {PALLOR_LEVELS.map((level) => (
                              <MenuItem key={level.value} value={level.value}>
                                {level.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />

                    <Controller
                      name="dehydration"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Dehydration</InputLabel>
                          <Select {...field} label="Dehydration">
                            {PALLOR_LEVELS.map((level) => (
                              <MenuItem key={level.value} value={level.value}>
                                {level.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />

                    <Controller
                      name="heartSounds"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Heart Sounds"
                          placeholder="e.g., Normal S1, S2"
                          fullWidth
                        />
                      )}
                    />
                  </Box>
                </Box>

                <Divider />

                {/* Lab Results Section */}
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <BiotechIcon color="primary" />
                    Lab Results
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="pcv"
                      control={control}
                      rules={{
                        min: {
                          value: 10,
                          message: 'PCV must be at least 10%',
                        },
                        max: { value: 60, message: 'PCV cannot exceed 60%' },
                      }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          value={value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === '' ? undefined : Number(val));
                          }}
                          label="PCV"
                          type="number"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">%</InputAdornment>
                            ),
                          }}
                          error={!!errors.pcv}
                          helperText={errors.pcv?.message}
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="fbs"
                      control={control}
                      rules={{
                        min: {
                          value: 30,
                          message: 'FBS must be at least 30 mg/dL',
                        },
                        max: {
                          value: 500,
                          message: 'FBS cannot exceed 500 mg/dL',
                        },
                      }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          value={value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === '' ? undefined : Number(val));
                          }}
                          label="FBS"
                          type="number"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                mg/dL
                              </InputAdornment>
                            ),
                          }}
                          error={!!errors.fbs}
                          helperText={errors.fbs?.message}
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="hba1c"
                      control={control}
                      rules={{
                        min: {
                          value: 3,
                          message: 'HbA1c must be at least 3%',
                        },
                        max: {
                          value: 15,
                          message: 'HbA1c cannot exceed 15%',
                        },
                      }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          value={value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === '' ? undefined : Number(val));
                          }}
                          label="HbA1c"
                          type="number"
                          inputProps={{ step: '0.1' }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">%</InputAdornment>
                            ),
                          }}
                          error={!!errors.hba1c}
                          helperText={errors.hba1c?.message}
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="mcs"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="MCS"
                          placeholder="e.g., No growth"
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="eucr"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="E/U/Cr"
                          placeholder="e.g., Normal"
                          fullWidth
                        />
                      )}
                    />

                    <Controller
                      name="fbc"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="FBC"
                          placeholder="e.g., Normal"
                          fullWidth
                        />
                      )}
                    />
                  </Box>
                </Box>
              </Stack>
            </form>
          </DialogContent>

          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit(handleSaveAssessment)}
              variant="contained"
              disabled={
                isLoading('createAssessment') || isLoading('updateAssessment')
              }
            >
              {selectedAssessment ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </ResponsiveContainer>
    </LocalizationProvider>
  );
};

export default ClinicalAssessmentComponent;
