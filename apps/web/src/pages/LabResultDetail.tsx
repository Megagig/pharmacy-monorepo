import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  CircularProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Science as ScienceIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  LocalHospital as HospitalIcon,
  Description as DescriptionIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Lab Result Detail Page
 * Displays detailed information about a lab result
 * Route: /laboratory/:id
 */

interface LabResult {
  _id: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    patientId: string;
    dateOfBirth: string;
    gender: string;
  };
  testName: string;
  testCode?: string;
  loincCode?: string;
  testCategory: string;
  specimenType: string;
  testValue: string;
  numericValue?: number;
  unit?: string;
  referenceRange?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  interpretation: 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal' | 'Pending';
  isCritical: boolean;
  isAbnormal: boolean;
  status: 'Pending' | 'Completed' | 'Reviewed' | 'Signed Off' | 'Cancelled';
  testDate: string;
  resultDate?: string;
  laboratoryName?: string;
  accessionNumber?: string;
  orderingPhysician?: string;
  performingTechnician?: string;
  notes?: string;
  clinicalIndication?: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileType: string;
    uploadedAt: string;
  }>;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  updatedBy?: {
    firstName: string;
    lastName: string;
  };
  signedOffBy?: {
    firstName: string;
    lastName: string;
  };
  signedOffAt?: string;
  createdAt: string;
  updatedAt: string;
}

const LabResultDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Fetch lab result
  const { data: labResult, isLoading, refetch } = useQuery<LabResult>({
    queryKey: ['lab-result', id],
    queryFn: async () => {
      const response = await api.get(`/laboratory/results/${id}`);
      return response.data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/laboratory/results/${id}`);
    },
    onSuccess: () => {
      toast.success('Lab result deleted successfully');
      navigate('/laboratory');
    },
    onError: () => {
      toast.error('Failed to delete lab result');
    },
  });

  // Sign-off mutation
  const signOffMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/laboratory/results/${id}/signoff`);
    },
    onSuccess: () => {
      toast.success('Lab result signed off successfully');
      refetch();
    },
    onError: () => {
      toast.error('Failed to sign off lab result');
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/laboratory/results/${id}/review`);
    },
    onSuccess: () => {
      toast.success('Lab result marked as reviewed');
      refetch();
    },
    onError: () => {
      toast.error('Failed to review lab result');
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this lab result?')) {
      deleteMutation.mutate();
    }
  };

  const handleSignOff = () => {
    if (window.confirm('Are you sure you want to sign off this lab result? This action cannot be undone.')) {
      signOffMutation.mutate();
    }
  };

  const handleReview = () => {
    reviewMutation.mutate();
  };

  // Get interpretation color
  const getInterpretationColor = (interpretation: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
    switch (interpretation) {
      case 'Normal':
        return 'success';
      case 'Low':
        return 'info';
      case 'High':
        return 'warning';
      case 'Critical':
        return 'error';
      case 'Abnormal':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Get status color
  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'Pending':
        return 'warning';
      case 'Completed':
        return 'primary';
      case 'Reviewed':
        return 'success';
      case 'Signed Off':
        return 'success';
      case 'Cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!labResult) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Lab result not found
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/laboratory')}
            sx={{ mt: 2 }}
          >
            Back to Laboratory
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/laboratory')} color="primary">
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
                {labResult.testName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {labResult.testCode && `Code: ${labResult.testCode} • `}
                {format(new Date(labResult.testDate), 'MMMM dd, yyyy')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {labResult.status !== 'Signed Off' && (
              <>
                {labResult.status !== 'Reviewed' && (
                  <Button
                    variant="outlined"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleReview}
                    disabled={reviewMutation.isPending}
                  >
                    Mark as Reviewed
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleSignOff}
                  disabled={signOffMutation.isPending}
                >
                  Sign Off
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/laboratory/${id}/edit`)}
                >
                  Edit
                </Button>
              </>
            )}
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Box>
        </Box>

        {/* Status Chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={labResult.interpretation}
            color={getInterpretationColor(labResult.interpretation)}
            icon={labResult.isCritical ? <WarningIcon /> : <CheckCircleIcon />}
          />
          <Chip label={labResult.status} color={getStatusColor(labResult.status)} />
          <Chip label={labResult.testCategory} variant="outlined" />
          {labResult.isCritical && <Chip label="CRITICAL" color="error" />}
          {labResult.isAbnormal && <Chip label="ABNORMAL" color="warning" />}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Patient Information */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <PersonIcon color="primary" />
                <Typography variant="h6">Patient Information</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                  {labResult.patientId.firstName[0]}{labResult.patientId.lastName[0]}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {labResult.patientId.firstName} {labResult.patientId.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {labResult.patientId.patientId}
                  </Typography>
                </Box>
              </Box>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Date of Birth"
                    secondary={format(new Date(labResult.patientId.dateOfBirth), 'MMM dd, yyyy')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Gender" secondary={labResult.patientId.gender} />
                </ListItem>
              </List>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(`/patients/${labResult.patientId._id}`)}
                sx={{ mt: 2 }}
              >
                View Patient Profile
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Test Results */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <ScienceIcon color="primary" />
                <Typography variant="h6">Test Results</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="caption" color="text.secondary">
                      Test Value
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {labResult.testValue} {labResult.unit}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="caption" color="text.secondary">
                      Reference Range
                    </Typography>
                    <Typography variant="h6" fontWeight="medium">
                      {labResult.referenceRange || 'N/A'}
                    </Typography>
                    {labResult.referenceRangeLow !== undefined && labResult.referenceRangeHigh !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        ({labResult.referenceRangeLow} - {labResult.referenceRangeHigh})
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Specimen Type" secondary={labResult.specimenType} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Test Category" secondary={labResult.testCategory} />
                    </ListItem>
                    {labResult.loincCode && (
                      <ListItem>
                        <ListItemText primary="LOINC Code" secondary={labResult.loincCode} />
                      </ListItem>
                    )}
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Test Date"
                        secondary={format(new Date(labResult.testDate), 'MMM dd, yyyy')}
                      />
                    </ListItem>
                    {labResult.resultDate && (
                      <ListItem>
                        <ListItemText
                          primary="Result Date"
                          secondary={format(new Date(labResult.resultDate), 'MMM dd, yyyy')}
                        />
                      </ListItem>
                    )}
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Laboratory Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <HospitalIcon color="primary" />
                <Typography variant="h6">Laboratory Information</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <List dense>
                {labResult.laboratoryName && (
                  <ListItem>
                    <ListItemText primary="Laboratory Name" secondary={labResult.laboratoryName} />
                  </ListItem>
                )}
                {labResult.accessionNumber && (
                  <ListItem>
                    <ListItemText primary="Accession Number" secondary={labResult.accessionNumber} />
                  </ListItem>
                )}
                {labResult.orderingPhysician && (
                  <ListItem>
                    <ListItemText primary="Ordering Physician" secondary={labResult.orderingPhysician} />
                  </ListItem>
                )}
                {labResult.performingTechnician && (
                  <ListItem>
                    <ListItemText primary="Performing Technician" secondary={labResult.performingTechnician} />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Additional Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <DescriptionIcon color="primary" />
                <Typography variant="h6">Additional Information</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {labResult.clinicalIndication && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Clinical Indication
                  </Typography>
                  <Typography variant="body2">{labResult.clinicalIndication}</Typography>
                </Box>
              )}
              {labResult.notes && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body2">{labResult.notes}</Typography>
                </Box>
              )}
              {!labResult.clinicalIndication && !labResult.notes && (
                <Typography variant="body2" color="text.secondary">
                  No additional information available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Attachments */}
        {labResult.attachments && labResult.attachments.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <AttachFileIcon color="primary" />
                  <Typography variant="h6">Attachments</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {labResult.attachments.map((attachment, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Paper
                        sx={{
                          p: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => window.open(attachment.fileUrl, '_blank')}
                      >
                        <AttachFileIcon color="primary" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap>
                            {attachment.fileName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(attachment.uploadedAt), 'MMM dd, yyyy')}
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Audit Trail */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CalendarIcon color="primary" />
                <Typography variant="h6">Audit Trail</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Created By
                  </Typography>
                  <Typography variant="body2">
                    {labResult.createdBy
                      ? `${labResult.createdBy.firstName} ${labResult.createdBy.lastName}`
                      : 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(labResult.createdAt), 'MMM dd, yyyy HH:mm')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated By
                  </Typography>
                  <Typography variant="body2">
                    {labResult.updatedBy
                      ? `${labResult.updatedBy.firstName} ${labResult.updatedBy.lastName}`
                      : 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(labResult.updatedAt), 'MMM dd, yyyy HH:mm')}
                  </Typography>
                </Grid>
                {labResult.signedOffBy && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Signed Off By
                    </Typography>
                    <Typography variant="body2">
                      {`${labResult.signedOffBy.firstName} ${labResult.signedOffBy.lastName}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {labResult.signedOffAt &&
                        format(new Date(labResult.signedOffAt), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default LabResultDetail;

