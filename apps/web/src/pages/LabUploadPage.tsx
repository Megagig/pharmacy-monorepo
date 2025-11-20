import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  IconButton,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Avatar,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ArrowBack as ArrowBackIcon,
  FileDownload as FileDownloadIcon,
  Science as ScienceIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { usePatientStore } from '../stores';

/**
 * Lab Upload Page
 * Upload PDF lab reports or CSV batch files
 * Route: /laboratory/upload
 */

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`upload-tabpanel-${index}`}
      aria-labelledby={`upload-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const LabUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdFromQuery = searchParams.get('patientId');
  const selectedPatientFromQuery = searchParams.get('selectedPatient');
  const [activeTab, setActiveTab] = useState(0);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Patient store
  const patients = usePatientStore((state) => state.patients);
  const loading = usePatientStore((state) => state.loading.fetchPatients || false);
  const fetchPatients = usePatientStore((state) => state.fetchPatients);

  // Fetch patients on mount
  useEffect(() => {
    const loadPatients = async () => {
      try {
        await fetchPatients();
      } catch (error) {
        console.error('Failed to fetch patients:', error);
        toast.error('Failed to load patients');
      }
    };
    loadPatients();
  }, [fetchPatients]);

  // Handle patient selection from URL parameters
  useEffect(() => {
    const patientId = patientIdFromQuery || selectedPatientFromQuery;
    if (patientId && patients.length > 0) {
      const patientExists = patients.some((p) => p._id === patientId);
      if (patientExists) {
        setSelectedPatientId(patientId);
      }
    }
  }, [patientIdFromQuery, selectedPatientFromQuery, patients]);

  // Handler functions for patient selection buttons
  const handleRefreshPatients = async () => {
    try {
      await fetchPatients();
      toast.success('Patients refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh patients');
    }
  };

  const handleBrowsePatients = () => {
    navigate(`/patients?mode=select&returnTo=${encodeURIComponent('/laboratory/upload')}`);
  };

  const handleNewPatient = () => {
    navigate('/patients/new');
  };

  // PDF upload mutation
  const pdfUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('documents', file);
      });
      if (selectedPatientId) {
        formData.append('patientId', selectedPatientId);
      }

      const response = await api.post('/laboratory/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('PDF uploaded and parsed successfully');
      setUploadResults(data.data);
      setPdfFiles([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to upload PDF');
    },
  });

  // CSV upload mutation
  const csvUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      if (selectedPatientId) {
        formData.append('patientId', selectedPatientId);
      }

      const response = await api.post('/laboratory/batch-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully uploaded ${data.data.successCount} lab results`);
      setUploadResults(data.data);
      setCsvFile(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to upload CSV');
    },
  });

  // PDF dropzone
  const pdfDropzone = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 10,
    onDrop: (acceptedFiles) => {
      setPdfFiles(acceptedFiles);
      setUploadResults(null);
    },
  });

  // CSV dropzone
  const csvDropzone = useDropzone({
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setCsvFile(acceptedFiles[0] || null);
      setUploadResults(null);
    },
  });

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setUploadResults(null);
  };

  // Handle PDF upload
  const handlePdfUpload = () => {
    if (pdfFiles.length === 0) {
      toast.error('Please select at least one PDF file');
      return;
    }
    pdfUploadMutation.mutate(pdfFiles);
  };

  // Handle CSV upload
  const handleCsvUpload = () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }
    csvUploadMutation.mutate(csvFile);
  };

  // Handle download CSV template
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/laboratory/batch-upload/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'lab_results_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
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
            <CloudUploadIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              Upload Lab Results
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload PDF reports or CSV batch files
            </Typography>
          </Box>
        </Box>

      </Box>

      {/* Patient Selection Section */}
      <Box sx={{ mb: 4 }}>
        {/* Action Buttons */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshPatients}
            disabled={loading}
            sx={{
              borderRadius: 3,
              textTransform: 'none',
              fontWeight: 600,
              flex: 1
            }}
          >
            Refresh Patients
          </Button>
          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={handleBrowsePatients}
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
            onClick={handleNewPatient}
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

        {/* Selected Patient Display */}
        {selectedPatientId && (
          <Paper
            elevation={0}
            sx={{
              mb: 3,
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
                    const selectedPatient = patients.find((p) => p._id === selectedPatientId);
                    return selectedPatient
                      ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                      : 'Loading patient details...';
                  })()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(() => {
                    const selectedPatient = patients.find((p) => p._id === selectedPatientId);
                    return selectedPatient
                      ? `MRN: ${selectedPatient.patientId}`
                      : '';
                  })()}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Patient Selection Dropdown */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
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
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Choose Patient (Optional)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select a patient to automatically link uploaded results
              </Typography>
            </Box>
          </Box>

          <FormControl fullWidth>
            <InputLabel>Select Patient</InputLabel>
            <Select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              label="Select Patient"
              disabled={loading}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">
                <em>None (Manual assignment later)</em>
              </MenuItem>
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
                          bgcolor: selectedPatientId === patient._id ? 'success.main' : 'grey.300',
                          width: 32,
                          height: 32,
                          mr: 2,
                        }}
                      >
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {`${patient.firstName} ${patient.lastName}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          MRN: {patient.patientId}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Paper>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="PDF Upload" icon={<PdfIcon />} iconPosition="start" />
          <Tab label="CSV Batch Upload" icon={<CsvIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* PDF Upload Tab */}
      <TabPanel value={activeTab} index={0}>
        <Paper sx={{ p: 4 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Upload PDF lab reports. The system will automatically extract test results using AI-powered parsing.
            Supports up to 10 PDF files at once.
          </Alert>

          {/* Dropzone */}
          <Box
            {...pdfDropzone.getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: pdfDropzone.isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 6,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: pdfDropzone.isDragActive ? 'action.hover' : 'background.default',
              transition: 'all 0.2s',
              mb: 3,
            }}
          >
            <input {...pdfDropzone.getInputProps()} />
            <PdfIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {pdfDropzone.isDragActive
                ? 'Drop PDF files here'
                : 'Drag & drop PDF files here, or click to select'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supports: PDF files (max 10 files, 15MB each)
            </Typography>
          </Box>

          {/* Selected Files */}
          {pdfFiles.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Selected Files ({pdfFiles.length})
              </Typography>
              <List>
                {pdfFiles.map((file, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <PdfIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Upload Progress */}
          {pdfUploadMutation.isPending && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Uploading and parsing PDFs...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Upload Results */}
          {uploadResults && activeTab === 0 && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Successfully parsed {uploadResults.extractedResults?.length || 0} test results from PDF
            </Alert>
          )}

          {/* Upload Button */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setPdfFiles([]);
                setUploadResults(null);
              }}
              disabled={pdfUploadMutation.isPending}
            >
              Clear
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handlePdfUpload}
              disabled={pdfFiles.length === 0 || pdfUploadMutation.isPending}
            >
              Upload & Parse PDFs
            </Button>
          </Box>
        </Paper>
      </TabPanel>

      {/* CSV Upload Tab */}
      <TabPanel value={activeTab} index={1}>
        <Paper sx={{ p: 4 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Upload a CSV file containing multiple lab results. Download the template below to see the required format.
          </Alert>

          {/* Download Template Button */}
          <Box sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleDownloadTemplate}
              fullWidth
            >
              Download CSV Template
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Dropzone */}
          <Box
            {...csvDropzone.getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: csvDropzone.isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 6,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: csvDropzone.isDragActive ? 'action.hover' : 'background.default',
              transition: 'all 0.2s',
              mb: 3,
            }}
          >
            <input {...csvDropzone.getInputProps()} />
            <CsvIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {csvDropzone.isDragActive
                ? 'Drop CSV file here'
                : 'Drag & drop CSV file here, or click to select'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supports: CSV files (max 15MB)
            </Typography>
          </Box>

          {/* Selected File */}
          {csvFile && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Selected File
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CsvIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={csvFile.name}
                    secondary={`${(csvFile.size / 1024 / 1024).toFixed(2)} MB`}
                  />
                </ListItem>
              </List>
            </Box>
          )}

          {/* Upload Progress */}
          {csvUploadMutation.isPending && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Uploading and processing CSV...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Upload Results */}
          {uploadResults && activeTab === 1 && (
            <Box sx={{ mb: 3 }}>
              <Alert
                severity={uploadResults.failedCount > 0 ? 'warning' : 'success'}
                sx={{ mb: 2 }}
              >
                <Typography variant="body2" gutterBottom>
                  <strong>Upload Summary:</strong>
                </Typography>
                <Typography variant="body2">
                  • Total rows: {uploadResults.totalRows}
                </Typography>
                <Typography variant="body2">
                  • Successfully created: {uploadResults.successCount}
                </Typography>
                {uploadResults.failedCount > 0 && (
                  <Typography variant="body2" color="error">
                    • Failed: {uploadResults.failedCount}
                  </Typography>
                )}
              </Alert>

              {/* Errors */}
              {uploadResults.errors && uploadResults.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom color="error">
                    Errors:
                  </Typography>
                  <List dense>
                    {uploadResults.errors.map((error: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <ErrorIcon color="error" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Row ${error.row}: ${error.message}`}
                          secondary={error.details}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Warnings */}
              {uploadResults.warnings && uploadResults.warnings.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    Warnings:
                  </Typography>
                  <List dense>
                    {uploadResults.warnings.map((warning: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <ErrorIcon color="warning" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Row ${warning.row}: ${warning.message}`}
                          secondary={warning.details}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Success */}
              {uploadResults.successCount > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => navigate('/laboratory')}
                    fullWidth
                  >
                    View Lab Results
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Upload Button */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setCsvFile(null);
                setUploadResults(null);
              }}
              disabled={csvUploadMutation.isPending}
            >
              Clear
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleCsvUpload}
              disabled={!csvFile || csvUploadMutation.isPending}
            >
              Upload & Process CSV
            </Button>
          </Box>
        </Paper>
      </TabPanel>
    </Container>
  );
};

export default LabUploadPage;

