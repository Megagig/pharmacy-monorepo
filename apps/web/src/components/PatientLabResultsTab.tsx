import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Avatar,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Science as ScienceIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../services/api';
import QuickAddLabResultModal from './laboratory/QuickAddLabResultModal';

/**
 * Patient Lab Results Tab
 * Display lab results for a specific patient
 * Used in PatientDetails component
 */

interface PatientLabResultsTabProps {
  patientId: string;
}

interface LabResult {
  _id: string;
  testName: string;
  testValue: string;
  unit: string;
  interpretation: 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal' | 'Pending';
  status: 'Pending' | 'Completed' | 'Reviewed' | 'Signed Off' | 'Cancelled';
  testCategory: string;
  testDate: string;
  isCritical: boolean;
  isAbnormal: boolean;
  laboratoryName?: string;
}

const PatientLabResultsTab: React.FC<PatientLabResultsTabProps> = ({ patientId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [interpretationFilter, setInterpretationFilter] = useState('');
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);

  // Fetch patient lab results
  const { data: labResults, isLoading, refetch } = useQuery({
    queryKey: ['patient-lab-results', patientId, categoryFilter, statusFilter, interpretationFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        patientId,
        ...(categoryFilter && { category: categoryFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(interpretationFilter && { interpretation: interpretationFilter }),
      });
      const response = await api.get(`/laboratory/results?${params.toString()}`);
      return response.data.data;
    },
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['patient-lab-stats', patientId],
    queryFn: async () => {
      const response = await api.get(`/laboratory/results/statistics?patientId=${patientId}`);
      return response.data.data;
    },
  });

  // Fetch patient data for modal
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const response = await api.get(`/patients/${patientId}`);
      return response.data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/laboratory/results/${id}`);
    },
    onSuccess: () => {
      toast.success('Lab result deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['patient-lab-results', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-lab-stats', patientId] });
    },
    onError: () => {
      toast.error('Failed to delete lab result');
    },
  });

  // Handle delete
  const handleDelete = (id: string, testName: string) => {
    if (window.confirm(`Are you sure you want to delete the lab result for "${testName}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Handle page change
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get interpretation icon
  const getInterpretationIcon = (interpretation: string) => {
    switch (interpretation) {
      case 'Normal':
        return <CheckCircleIcon fontSize="small" />;
      case 'Critical':
        return <WarningIcon fontSize="small" />;
      default:
        return <WarningIcon fontSize="small" />;
    }
  };

  // Get interpretation color
  const getInterpretationColor = (interpretation: string) => {
    switch (interpretation) {
      case 'Normal':
        return 'success';
      case 'Low':
        return 'warning';
      case 'High':
        return 'warning';
      case 'Critical':
        return 'error';
      case 'Abnormal':
        return 'warning';
      case 'Pending':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'Reviewed':
        return 'info';
      case 'Signed Off':
        return 'primary';
      case 'Pending':
        return 'warning';
      case 'Cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const results = labResults?.results || [];
  const paginatedResults = results.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <ScienceIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {stats?.totalResults || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Results
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <WarningIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {stats?.criticalResults || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Critical
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <WarningIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {stats?.abnormalResults || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Abnormal
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <TrendingUpIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {stats?.thisWeekResults || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This Week
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All Categories</MenuItem>
              <MenuItem value="Hematology">Hematology</MenuItem>
              <MenuItem value="Chemistry">Chemistry</MenuItem>
              <MenuItem value="Microbiology">Microbiology</MenuItem>
              <MenuItem value="Immunology">Immunology</MenuItem>
              <MenuItem value="Pathology">Pathology</MenuItem>
              <MenuItem value="Radiology">Radiology</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Reviewed">Reviewed</MenuItem>
              <MenuItem value="Signed Off">Signed Off</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Interpretation"
              value={interpretationFilter}
              onChange={(e) => setInterpretationFilter(e.target.value)}
            >
              <MenuItem value="">All Interpretations</MenuItem>
              <MenuItem value="Normal">Normal</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="Abnormal">Abnormal</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Tooltip title="Refresh">
                <IconButton onClick={() => refetch()} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<TrendingUpIcon />}
                onClick={() => navigate(`/laboratory/trends?patientId=${patientId}`)}
                size="small"
              >
                Trends
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => navigate(`/laboratory/upload?patientId=${patientId}`)}
                size="small"
              >
                Upload
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setQuickAddModalOpen(true)}
                size="small"
              >
                Add
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Results Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Test Name</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Interpretation</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Test Date</TableCell>
              <TableCell>Laboratory</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box sx={{ py: 4 }}>
                    <ScienceIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      No lab results found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Add lab results to track patient's test history
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => navigate(`/laboratory/add?patientId=${patientId}`)}
                    >
                      Add Lab Result
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedResults.map((result: LabResult) => (
                <TableRow
                  key={result._id}
                  sx={{
                    bgcolor: result.isCritical ? 'error.lighter' : 'inherit',
                    '&:hover': { bgcolor: result.isCritical ? 'error.light' : 'action.hover' },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {result.testName}
                      </Typography>
                      {result.isCritical && (
                        <Chip label="Critical" size="small" color="error" />
                      )}
                      {result.isAbnormal && !result.isCritical && (
                        <Chip label="Abnormal" size="small" color="warning" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {result.testValue} {result.unit}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getInterpretationIcon(result.interpretation)}
                      label={result.interpretation}
                      size="small"
                      color={getInterpretationColor(result.interpretation) as any}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={result.status}
                      size="small"
                      color={getStatusColor(result.status) as any}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{result.testCategory}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {format(new Date(result.testDate), 'MMM dd, yyyy')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {result.laboratoryName || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/laboratory/${result._id}`)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/laboratory/${result._id}/edit`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(result._id, result.testName)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={results.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Critical Results Alert */}
      {stats?.criticalResults > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight="medium">
            This patient has {stats.criticalResults} critical lab result(s) that require immediate attention.
          </Typography>
        </Alert>
      )}

      {/* Quick Add Modal */}
      <QuickAddLabResultModal
        open={quickAddModalOpen}
        onClose={() => setQuickAddModalOpen(false)}
        patientId={patientId}
        patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
      />
    </Box>
  );
};

export default PatientLabResultsTab;

