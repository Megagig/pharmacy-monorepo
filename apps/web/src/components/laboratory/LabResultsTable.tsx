import React, { useState } from 'react';
import {
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
  Tooltip,
  Box,
  Typography,
  CircularProgress,
  Avatar,
  Checkbox,
  Button,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface LabResult {
  _id: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    patientId: string;
  };
  testName: string;
  testCode?: string;
  testCategory: string;
  testValue: string;
  unit?: string;
  referenceRange?: string;
  interpretation: 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal' | 'Pending';
  isCritical: boolean;
  isAbnormal: boolean;
  status: 'Pending' | 'Completed' | 'Reviewed' | 'Signed Off' | 'Cancelled';
  testDate: string;
  resultDate?: string;
  laboratoryName?: string;
  createdAt: string;
}

interface LabResultsTableProps {
  searchQuery?: string;
  filters?: {
    status: string;
    testCategory: string;
    interpretation: string;
  };
  view?: 'all' | 'critical' | 'pending' | 'abnormal';
  selectionMode?: boolean;
  selectedLabResults?: string[];
  onLabResultSelect?: (labResultId: string) => void;
  patientId?: string | null;
}

const LabResultsTable: React.FC<LabResultsTableProps> = ({ 
  searchQuery = '', 
  filters, 
  view = 'all',
  selectionMode = false,
  selectedLabResults = [],
  onLabResultSelect,
  patientId
}) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Build query parameters
  const buildQueryParams = () => {
    const params: any = {
      page: page + 1,
      limit: rowsPerPage,
      sortBy: 'testDate',
      sortOrder: 'desc',
    };

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }

    if (filters?.testCategory && filters.testCategory !== 'all') {
      params.testCategory = filters.testCategory;
    }

    if (filters?.interpretation && filters.interpretation !== 'all') {
      params.interpretation = filters.interpretation;
    }

    // Filter by patient when in selection mode
    if (selectionMode && patientId) {
      params.patientId = patientId;
    }

    return params;
  };

  // Fetch lab results
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lab-results', page, rowsPerPage, searchQuery, filters, view],
    queryFn: async () => {
      let endpoint = '/laboratory/results';
      
      // Use specific endpoints for filtered views
      if (view === 'critical') {
        endpoint = '/laboratory/results/critical';
      } else if (view === 'pending') {
        endpoint = '/laboratory/results/pending';
      } else if (view === 'abnormal') {
        endpoint = '/laboratory/results/abnormal';
      }

      const response = await api.get(endpoint, {
        params: buildQueryParams(),
      });
      return response.data.data;
    },
  });

  const results = data?.results || [];
  const totalResults = data?.pagination?.total || 0;

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
        return <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />;
      case 'Low':
        return <TrendingDownIcon sx={{ fontSize: 18, color: 'info.main' }} />;
      case 'High':
        return <TrendingUpIcon sx={{ fontSize: 18, color: 'warning.main' }} />;
      case 'Critical':
        return <WarningIcon sx={{ fontSize: 18, color: 'error.main' }} />;
      case 'Abnormal':
        return <WarningIcon sx={{ fontSize: 18, color: 'warning.main' }} />;
      default:
        return <RemoveIcon sx={{ fontSize: 18, color: 'text.secondary' }} />;
    }
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

  // Handle delete
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this lab result?')) {
      try {
        await api.delete(`/laboratory/results/${id}`);
        toast.success('Lab result deleted successfully');
        refetch();
      } catch (error) {
        toast.error('Failed to delete lab result');
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (results.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No lab results found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {searchQuery || (filters?.status !== 'all' || filters?.testCategory !== 'all' || filters?.interpretation !== 'all')
            ? 'Try adjusting your search or filters'
            : 'Add your first lab result to get started'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {selectionMode && <TableCell padding="checkbox">Select</TableCell>}
              <TableCell>Patient</TableCell>
              <TableCell>Test Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Reference Range</TableCell>
              <TableCell>Interpretation</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Test Date</TableCell>
              <TableCell>Laboratory</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((result: LabResult) => (
              <TableRow
                key={result._id}
                hover
                sx={{
                  backgroundColor: result.isCritical 
                    ? 'rgba(211, 47, 47, 0.05)' 
                    : selectedLabResults.includes(result._id) && selectionMode
                    ? 'rgba(25, 118, 210, 0.08)'
                    : 'inherit',
                }}
              >
                {selectionMode && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedLabResults.includes(result._id)}
                      onChange={() => onLabResultSelect?.(result._id)}
                      color="primary"
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                      {result.patientId?.firstName?.[0]}{result.patientId?.lastName?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {result.patientId?.firstName} {result.patientId?.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {result.patientId?.patientId}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {result.testName}
                  </Typography>
                  {result.testCode && (
                    <Typography variant="caption" color="text.secondary">
                      {result.testCode}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={result.testCategory} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {result.testValue} {result.unit}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {result.referenceRange || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getInterpretationIcon(result.interpretation)}
                    label={result.interpretation}
                    size="small"
                    color={getInterpretationColor(result.interpretation)}
                  />
                </TableCell>
                <TableCell>
                  <Chip label={result.status} size="small" color={getStatusColor(result.status)} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {format(new Date(result.testDate), 'MMM dd, yyyy')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {result.laboratoryName || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {selectionMode ? (
                    <Button
                      size="small"
                      variant={selectedLabResults.includes(result._id) ? "contained" : "outlined"}
                      startIcon={<ScienceIcon />}
                      onClick={() => onLabResultSelect?.(result._id)}
                      color="primary"
                    >
                      {selectedLabResults.includes(result._id) ? 'Selected' : 'Select'}
                    </Button>
                  ) : (
                    <>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => navigate(`/laboratory/${result._id}`)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => navigate(`/laboratory/${result._id}/edit`)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(result._id)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={totalResults}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default LabResultsTable;

