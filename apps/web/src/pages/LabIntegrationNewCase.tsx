import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Stack,
  Grid,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  IconButton,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListItemIcon,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Science as ScienceIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  CloudUpload as CloudUploadIcon,
  AttachFile as AttachFileIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import { useCreateLabIntegration } from '../hooks/useLabIntegration';
import { usePatientStore } from '../stores';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const LabIntegrationNewCase: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createMutation = useCreateLabIntegration();

  // Patient store
  const patients = usePatientStore((state) => state.patients);
  const loading = usePatientStore((state) => state.loading.fetchPatients || false);
  const fetchPatients = usePatientStore((state) => state.fetchPatients);

  // Form state
  const [patientId, setPatientId] = useState('');
  const [source, setSource] = useState<'manual_entry' | 'pdf_upload' | 'image_upload' | 'fhir_import' | 'lis_integration'>('manual_entry');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'critical'>('routine');
  const [labResultIds, setLabResultIds] = useState<string[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [notes, setNotes] = useState('');

  // Duplicate submission prevention
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Additional form state for enhanced functionality
  const [symptoms, setSymptoms] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [editingLabResult, setEditingLabResult] = useState<any>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Fetch patients on mount
  useEffect(() => {
    const loadPatients = async () => {
      try {
        await fetchPatients();
      } catch (error) {
        toast.error('Failed to load patients');
      }
    };
    loadPatients();
  }, [fetchPatients]);

  // Handle patient selection from URL parameters (when coming from patient list)
  useEffect(() => {
    const selectedPatientId = searchParams.get('selectedPatient');
    if (selectedPatientId && patients.length > 0) {
      const patientExists = patients.some((p) => p._id === selectedPatientId);
      if (patientExists) {
        setPatientId(selectedPatientId);
      }
    }
  }, [searchParams, patients]);

  // Handle selected lab results from Laboratory Findings page
  useEffect(() => {
    const selectedLabResults = searchParams.get('selectedLabResults');
    if (selectedLabResults) {
      try {
        const labResultIds = JSON.parse(decodeURIComponent(selectedLabResults));
        if (Array.isArray(labResultIds)) {
          setLabResultIds(prev => [...new Set([...prev, ...labResultIds])]);
          // Clean up URL parameters
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('selectedLabResults');
          navigate({ search: newSearchParams.toString() }, { replace: true });
          toast.success(`${labResultIds.length} lab result(s) selected from Laboratory Findings`);
        }
      } catch (error) {
        toast.error('Failed to process selected lab results');
      }
    }
  }, [searchParams, navigate]);

  // Fetch lab results for selected patient from Laboratory Findings module
  const { data: labResultsData, isLoading: labResultsLoading, refetch: refetchLabResults } = useQuery({
    queryKey: ['laboratoryResults', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      try {
        const response = await axios.get(`/api/laboratory/results/patient/${patientId}`);
        const results = response.data.data || [];
        return results;
      } catch (error: any) {
        // Show detailed error message
        const errorMessage = error.response?.data?.message || error.message || 'Failed to load lab results for this patient';
        toast.error(errorMessage);

        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30000, // 30 seconds
  });

  const handleBack = () => {
    navigate('/pharmacy/lab-integration');
  };

  const handleAddLabResult = (labResultId: string) => {
    if (!labResultIds.includes(labResultId)) {
      setLabResultIds([...labResultIds, labResultId]);
    }
  };

  const handleRemoveLabResult = (labResultId: string) => {
    setLabResultIds(labResultIds.filter((id) => id !== labResultId));
  };

  // Handle lab result selection with checkbox
  const handleLabResultToggle = (labResultId: string) => {
    if (labResultIds.includes(labResultId)) {
      setLabResultIds(labResultIds.filter((id) => id !== labResultId));
    } else {
      setLabResultIds([...labResultIds, labResultId]);
    }
  };

  // Navigate to Laboratory Findings with return parameters
  const handleGoToLaboratoryFindings = () => {
    const returnUrl = `/pharmacy/lab-integration/new?selectedPatient=${patientId}`;
    navigate(`/laboratory?returnTo=lab-integration&patientId=${patientId}&returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  // Handle file upload for lab results
  const handleFileUpload = async (files: FileList) => {
    if (!patientId) {
      toast.error('Please select a patient first');
      return;
    }

    setUploadingFiles(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      formData.append('patientId', patientId);
      formData.append('processWithAI', 'true');

      const response = await axios.post('/api/laboratory/results/upload-and-process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const newLabResults = response.data.data;
      toast.success(`Successfully processed ${newLabResults.length} lab results from uploaded files`);

      // Auto-select the newly created lab results
      const newLabResultIds = newLabResults.map((lr: any) => lr._id);
      setLabResultIds([...labResultIds, ...newLabResultIds]);

      // Refetch lab results to show the new ones
      refetchLabResults();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process uploaded files');
    } finally {
      setUploadingFiles(false);
    }
  };

  // Handle adding new lab result
  const handleAddNewLabResult = async (labResultData: any) => {
    try {
      const response = await axios.post('/api/laboratory/results', {
        ...labResultData,
        patientId,
      });

      const newLabResult = response.data.data;
      toast.success('Lab result added successfully');

      // Auto-select the newly created lab result
      setLabResultIds([...labResultIds, newLabResult._id]);

      // Refetch lab results to show the new one
      refetchLabResults();
      setShowAddLabModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add lab result');
    }
  };

  // Handle editing lab result
  const handleEditLabResult = async (labResultId: string, updatedData: any) => {
    try {
      await axios.put(`/api/laboratory/results/${labResultId}`, updatedData);
      toast.success('Lab result updated successfully');
      refetchLabResults();
      setEditingLabResult(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update lab result');
    }
  };

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (isSubmitting || createMutation.isPending) {
      return;
    }

    // Validation
    if (!patientId) {
      toast.error('Please select a patient');
      return;
    }

    if (labResultIds.length === 0) {
      toast.error('Please select at least one lab result');
      return;
    }

    if (!consentGiven) {
      toast.error('Patient consent is required');
      return;
    }

    try {
      setIsSubmitting(true);

      const newCase = await createMutation.mutateAsync({
        patientId,
        labResultIds,
        source,
        // Map priority to urgency as backend expects
        urgency: priority === 'critical' ? 'stat' : priority === 'urgent' ? 'urgent' : 'routine',
        // Store symptoms and medicalHistory in notes field
        notes: [
          notes,
          symptoms ? `Symptoms: ${symptoms}` : '',
          medicalHistory ? `Medical History: ${medicalHistory}` : ''
        ].filter(Boolean).join('\n\n') || undefined,
      });

      toast.success('Lab integration case created successfully');
      navigate(`/pharmacy/lab-integration/${newCase._id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create lab integration case');
      setIsSubmitting(false); // Reset on error so user can retry
    }
    // Note: We don't reset isSubmitting on success because we're navigating away
  };

  return (
    <>
      <Helmet>
        <title>New Lab Integration Case | PharmaCare</title>
      </Helmet>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon fontSize="large" />
              Create New Lab Integration Case
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload or select lab results for AI-powered interpretation and therapy recommendations
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Main Form */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Stack spacing={3}>
                  {/* Action Buttons */}
                  <Box sx={{ mb: 4 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Button
                        variant="outlined"
                        onClick={() => fetchPatients()}
                        disabled={loading}
                        startIcon={loading ? <RefreshIcon className="animate-spin" /> : <RefreshIcon />}
                        sx={{
                          borderRadius: 3,
                          textTransform: 'none',
                          fontWeight: 600,
                          flex: 1
                        }}
                      >
                        {loading ? 'Refreshing...' : 'Refresh Patients'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => navigate('/patients?for=lab-integration')}
                        startIcon={<SearchIcon />}
                        sx={{
                          borderRadius: 3,
                          textTransform: 'none',
                          fontWeight: 600,
                          flex: 1
                        }}
                      >
                        Browse Patients
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/patients/new')}
                        sx={{
                          borderRadius: 3,
                          textTransform: 'none',
                          fontWeight: 600,
                          background: 'linear-gradient(45deg, #1976d2, #1565c0)',
                          flex: 1
                        }}
                      >
                        New Patient
                      </Button>
                    </Stack>
                  </Box>

                  {/* Selected Patient Display */}
                  {patientId && (
                    <Paper
                      elevation={0}
                      sx={{
                        mb: 4,
                        p: 3,
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #e8f5e8, #f1f8e9)',
                        border: '2px solid #4caf50',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          sx={{
                            bgcolor: 'success.main',
                            width: 48,
                            height: 48,
                            mr: 2,
                          }}
                        >
                          <CheckCircleIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600, color: 'success.dark', mb: 0.5 }}
                          >
                            Selected Patient
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {(() => {
                              const selectedPatient = patients.find((p) => p._id === patientId);
                              return selectedPatient
                                ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                                : 'Loading patient details...';
                            })()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {(() => {
                              const selectedPatient = patients.find((p) => p._id === patientId);
                              return selectedPatient
                                ? `MRN: ${selectedPatient.mrn} • ${selectedPatient.age}y, ${selectedPatient.gender}`
                                : '';
                            })()}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  )}

                  {/* Patient Selection */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: !patientId ? 'error.main' : 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.50',
                          color: 'primary.main',
                          width: 40,
                          height: 40,
                          mr: 2,
                        }}
                      >
                        <PersonIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Choose Patient
                          </Typography>
                          <Chip
                            label="REQUIRED"
                            size="small"
                            color="error"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Select the patient for this lab integration case
                        </Typography>
                      </Box>
                    </Box>

                    <FormControl fullWidth error={!patientId}>
                      <InputLabel>Select Patient</InputLabel>
                      <Select
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        label="Select Patient"
                        disabled={loading}
                        sx={{ borderRadius: 2 }}
                      >
                        {loading ? (
                          <MenuItem disabled>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <RefreshIcon className="animate-spin" sx={{ mr: 1 }} />
                              Loading patients...
                            </Box>
                          </MenuItem>
                        ) : patients.length === 0 ? (
                          <MenuItem disabled>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                              No patients found. Please add patients first.
                            </Box>
                          </MenuItem>
                        ) : (
                          patients.map((patient) => (
                            <MenuItem key={patient._id} value={patient._id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Avatar
                                  sx={{
                                    bgcolor: patientId === patient._id ? 'success.main' : 'grey.300',
                                    width: 32,
                                    height: 32,
                                    mr: 2,
                                  }}
                                >
                                  {patientId === patient._id ? (
                                    <CheckCircleIcon sx={{ fontSize: 18 }} />
                                  ) : (
                                    <PersonIcon sx={{ fontSize: 18 }} />
                                  )}
                                </Avatar>
                                <Box>
                                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {patient.firstName} {patient.lastName}
                                    {patient.otherNames && ` ${patient.otherNames}`}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    MRN: {patient.mrn} • {patient.age}y, {patient.gender}
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>

                    {/* Empty State */}
                    {!loading && patients.length === 0 && (
                      <Paper
                        elevation={0}
                        sx={{
                          mt: 3,
                          p: 4,
                          borderRadius: 3,
                          bgcolor: 'grey.50',
                          textAlign: 'center',
                          border: '2px dashed',
                          borderColor: 'grey.300'
                        }}
                      >
                        <Avatar
                          sx={{
                            bgcolor: 'grey.200',
                            width: 64,
                            height: 64,
                            mx: 'auto',
                            mb: 2,
                          }}
                        >
                          <PersonIcon sx={{ fontSize: 32 }} />
                        </Avatar>
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                          No Patients Found
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          You need to add patients before creating a lab integration case
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                          <Button
                            variant="contained"
                            onClick={() => navigate('/patients?for=lab-integration')}
                            startIcon={<SearchIcon />}
                            sx={{
                              borderRadius: 3,
                              textTransform: 'none',
                              fontWeight: 600
                            }}
                          >
                            Browse Patients
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/patients/new')}
                            sx={{
                              borderRadius: 3,
                              textTransform: 'none',
                              fontWeight: 600
                            }}
                          >
                            Create New Patient
                          </Button>
                        </Stack>
                      </Paper>
                    )}
                  </Paper>

                  {/* Lab Results Selection */}
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScienceIcon />
                      Lab Results
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    {!patientId ? (
                      <Alert severity="info">
                        Please select a patient first to view their lab results
                      </Alert>
                    ) : labResultsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                      </Box>
                    ) : (
                      <Box>
                        {/* Info message about lab results */}
                        {labResultsData && labResultsData.length > 0 ? (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            This patient has {labResultsData.length} lab result{labResultsData.length > 1 ? 's' : ''} available.
                            Use the options below to select lab results for AI analysis.
                          </Alert>
                        ) : (
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            No lab results found for this patient. Please add lab results first.
                          </Alert>
                        )}

                        <Stack spacing={2}>
                          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                              variant="outlined"
                              startIcon={<ScienceIcon />}
                              onClick={handleGoToLaboratoryFindings}
                            >
                              Go to Laboratory Findings
                            </Button>
                            <Button
                              variant="contained"
                              startIcon={<AddIcon />}
                              onClick={() => setShowAddLabModal(true)}
                            >
                              Add Lab Result
                            </Button>
                          </Box>

                          {/* Upload and Import Section */}
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 3,
                              borderRadius: 2,
                              borderStyle: 'dashed',
                              borderColor: 'primary.main',
                              bgcolor: 'primary.50',
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              <CloudUploadIcon />
                              Upload & Import Test Results
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Upload lab result files (PDF, images) for AI-powered extraction and interpretation
                            </Typography>

                            {uploadingFiles ? (
                              <Box sx={{ width: '100%', mb: 2 }}>
                                <LinearProgress />
                                <Typography variant="caption" color="text.secondary">
                                  Processing uploaded files with AI...
                                </Typography>
                              </Box>
                            ) : (
                              <Button
                                variant="contained"
                                component="label"
                                startIcon={<UploadIcon />}
                                sx={{ mb: 1 }}
                              >
                                Choose Files to Upload
                                <input
                                  type="file"
                                  hidden
                                  multiple
                                  accept=".pdf,.jpg,.jpeg,.png,.csv"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                      handleFileUpload(e.target.files);
                                    }
                                  }}
                                />
                              </Button>
                            )}

                            <Typography variant="caption" display="block" color="text.secondary">
                              Supported formats: PDF, JPG, PNG, CSV
                            </Typography>
                          </Paper>

                          {/* Selected Lab Results Display */}
                          {labResultIds.length > 0 && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {labResultIds.length} lab result{labResultIds.length > 1 ? 's' : ''} selected for AI analysis
                              </Typography>
                            </Alert>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Box>

                  {/* Source and Priority */}
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Source</InputLabel>
                        <Select
                          value={source}
                          onChange={(e) => setSource(e.target.value as any)}
                          label="Source"
                        >
                          <MenuItem value="manual_entry">Manual Entry</MenuItem>
                          <MenuItem value="pdf_upload">PDF Upload</MenuItem>
                          <MenuItem value="image_upload">Image Upload</MenuItem>
                          <MenuItem value="fhir_import">FHIR Import</MenuItem>
                          <MenuItem value="lis_integration">LIS Integration</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Priority</InputLabel>
                        <Select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as any)}
                          label="Priority"
                        >
                          <MenuItem value="routine">Routine</MenuItem>
                          <MenuItem value="urgent">Urgent</MenuItem>
                          <MenuItem value="critical">Critical</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Optional Clinical Information */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Additional Clinical Information (Optional)
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Symptoms (Optional)"
                          multiline
                          rows={3}
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          placeholder="Describe patient symptoms..."
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Medical History (Optional)"
                          multiline
                          rows={3}
                          value={medicalHistory}
                          onChange={(e) => setMedicalHistory(e.target.value)}
                          placeholder="Relevant medical history..."
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Notes */}
                  <TextField
                    label="Notes (Optional)"
                    multiline
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes or context..."
                    fullWidth
                  />

                  {/* Consent */}
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={consentGiven}
                          onChange={(e) => setConsentGiven(e.target.checked)}
                          required
                        />
                      }
                      label="Patient has provided consent for lab data use and AI interpretation"
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* Info Card */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    What Happens Next?
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={2}>
                    <Box>
                      <Chip label="1" size="small" color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" component="span">
                        AI analyzes lab results
                      </Typography>
                    </Box>
                    <Box>
                      <Chip label="2" size="small" color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" component="span">
                        Safety checks performed
                      </Typography>
                    </Box>
                    <Box>
                      <Chip label="3" size="small" color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" component="span">
                        Therapy recommendations generated
                      </Typography>
                    </Box>
                    <Box>
                      <Chip label="4" size="small" color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" component="span">
                        Pharmacist review required
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Privacy Notice */}
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Privacy & Security
                </Typography>
                <Typography variant="body2">
                  All lab data is encrypted and handled in compliance with HIPAA regulations.
                  Patient consent is required and logged for audit purposes.
                </Typography>
              </Alert>

              {/* Action Buttons */}
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  disabled={isSubmitting || createMutation.isPending || !patientId || labResultIds.length === 0 || !consentGiven}
                  fullWidth
                  startIcon={isSubmitting || createMutation.isPending ? <CircularProgress size={20} /> : undefined}
                >
                  {isSubmitting || createMutation.isPending ? 'Creating Case...' : 'Create Case'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  fullWidth
                  disabled={isSubmitting || createMutation.isPending}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>

        {/* Add Lab Result Modal */}
        <Dialog
          open={showAddLabModal}
          onClose={() => setShowAddLabModal(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Add New Lab Result</DialogTitle>
          <DialogContent>
            <AddLabResultForm
              patientId={patientId}
              onSubmit={handleAddNewLabResult}
              onCancel={() => setShowAddLabModal(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Lab Result Modal */}
        <Dialog
          open={!!editingLabResult}
          onClose={() => setEditingLabResult(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Edit Lab Result</DialogTitle>
          <DialogContent>
            <EditLabResultForm
              labResult={editingLabResult}
              onSubmit={(updatedData) => handleEditLabResult(editingLabResult._id, updatedData)}
              onCancel={() => setEditingLabResult(null)}
            />
          </DialogContent>
        </Dialog>
      </Container>
    </>
  );
};

// Add Lab Result Form Component
const AddLabResultForm: React.FC<{
  patientId: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}> = ({ patientId, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    testName: '',
    testCode: '',
    testCategory: '',
    testValue: '',
    unit: '',
    referenceRange: '',
    interpretation: 'Normal',
    isCritical: false,
    isAbnormal: false,
    testDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ pt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label="Test Name"
            value={formData.testName}
            onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
            required
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Test Code"
            value={formData.testCode}
            onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Test Category</InputLabel>
            <Select
              value={formData.testCategory}
              onChange={(e) => setFormData({ ...formData, testCategory: e.target.value })}
              label="Test Category"
            >
              <MenuItem value="Hematology">Hematology</MenuItem>
              <MenuItem value="Chemistry">Chemistry</MenuItem>
              <MenuItem value="Immunology">Immunology</MenuItem>
              <MenuItem value="Microbiology">Microbiology</MenuItem>
              <MenuItem value="Molecular">Molecular</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Test Date"
            type="date"
            value={formData.testDate}
            onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Test Value"
            value={formData.testValue}
            onChange={(e) => setFormData({ ...formData, testValue: e.target.value })}
            required
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Unit"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Reference Range"
            value={formData.referenceRange}
            onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Interpretation</InputLabel>
            <Select
              value={formData.interpretation}
              onChange={(e) => setFormData({ ...formData, interpretation: e.target.value })}
              label="Interpretation"
            >
              <MenuItem value="Normal">Normal</MenuItem>
              <MenuItem value="Abnormal">Abnormal</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', height: '100%' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isCritical}
                  onChange={(e) => setFormData({ ...formData, isCritical: e.target.checked })}
                />
              }
              label="Critical"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isAbnormal}
                  onChange={(e) => setFormData({ ...formData, isAbnormal: e.target.checked })}
                />
              }
              label="Abnormal"
            />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Notes"
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            fullWidth
          />
        </Grid>
      </Grid>

      <DialogActions sx={{ px: 0, pt: 3 }}>
        <Button onClick={onCancel} startIcon={<CancelIcon />}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
          Add Lab Result
        </Button>
      </DialogActions>
    </Box>
  );
};

// Edit Lab Result Form Component
const EditLabResultForm: React.FC<{
  labResult: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}> = ({ labResult, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    testName: labResult?.testName || '',
    testCode: labResult?.testCode || '',
    testCategory: labResult?.testCategory || '',
    testValue: labResult?.testValue || labResult?.value || '',
    unit: labResult?.unit || '',
    referenceRange: labResult?.referenceRange || '',
    interpretation: labResult?.interpretation || 'Normal',
    isCritical: labResult?.isCritical || false,
    isAbnormal: labResult?.isAbnormal || false,
    testDate: labResult?.testDate ? new Date(labResult.testDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    notes: labResult?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!labResult) return null;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ pt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label="Test Name"
            value={formData.testName}
            onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
            required
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Test Code"
            value={formData.testCode}
            onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Test Value"
            value={formData.testValue}
            onChange={(e) => setFormData({ ...formData, testValue: e.target.value })}
            required
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Unit"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Reference Range"
            value={formData.referenceRange}
            onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Interpretation</InputLabel>
            <Select
              value={formData.interpretation}
              onChange={(e) => setFormData({ ...formData, interpretation: e.target.value })}
              label="Interpretation"
            >
              <MenuItem value="Normal">Normal</MenuItem>
              <MenuItem value="Abnormal">Abnormal</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', height: '100%' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isCritical}
                  onChange={(e) => setFormData({ ...formData, isCritical: e.target.checked })}
                />
              }
              label="Critical"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isAbnormal}
                  onChange={(e) => setFormData({ ...formData, isAbnormal: e.target.checked })}
                />
              }
              label="Abnormal"
            />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Notes"
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            fullWidth
          />
        </Grid>
      </Grid>

      <DialogActions sx={{ px: 0, pt: 3 }}>
        <Button onClick={onCancel} startIcon={<CancelIcon />}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
          Update Lab Result
        </Button>
      </DialogActions>
    </Box>
  );
};

export default LabIntegrationNewCase;

