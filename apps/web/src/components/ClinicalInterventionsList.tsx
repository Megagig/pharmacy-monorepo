import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Grid,
  Collapse,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import {
  useClinicalInterventions,
  useDeleteIntervention,
} from '../queries/useClinicalInterventions';
import { clinicalInterventionService } from '../services/clinicalInterventionService';

import type {
  ClinicalIntervention,
  InterventionFilters,
} from '../stores/clinicalInterventionStore';

const ClinicalInterventionsList: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  // State for filters and pagination
  const [filters, setFilters] = useState<InterventionFilters>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [interventionToDelete, setInterventionToDelete] = useState<
    string | null
  >(null);

  // API queries
  const {
    data: interventionsResponse,
    isLoading,
    error,
    refetch,
  } = useClinicalInterventions(filters);
  const deleteInterventionMutation = useDeleteIntervention();

  // Memoized data
  const interventions = useMemo(() => {
    return interventionsResponse?.data?.data || [];
  }, [interventionsResponse]);

  const pagination = useMemo(() => {
    return (
      interventionsResponse?.data?.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
        hasNext: false,
        hasPrev: false,
      }
    );
  }, [interventionsResponse]);

  // Handlers
  const handleFilterChange = (field: keyof InterventionFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handleSearch = () => {
    handleFilterChange('search', searchQuery);
  };

  const handlePageChange = (event: unknown, newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage + 1 }));
  };

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFilters((prev) => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
      page: 1,
    }));
  };

  const handleDeleteClick = (interventionId: string) => {
    setInterventionToDelete(interventionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (interventionToDelete) {
      await deleteInterventionMutation.mutateAsync(interventionToDelete);
      setDeleteDialogOpen(false);
      setInterventionToDelete(null);
      refetch();
    }
  };

  const handleExport = async () => {
    try {
      const response = await clinicalInterventionService.exportInterventions(
        filters,
        'xlsx'
      );
      if (response.success && response.data) {
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `clinical-interventions-${format(
          new Date(),
          'yyyy-MM-dd'
        )}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'implemented':
        return 'primary';
      case 'planning':
        return 'warning';
      case 'identified':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon />;
      case 'in_progress':
        return <ScheduleIcon />;
      case 'implemented':
        return <CheckCircleIcon />;
      case 'planning':
        return <ScheduleIcon />;
      case 'identified':
        return <WarningIcon />;
      case 'cancelled':
        return <WarningIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Error loading interventions: {error.message}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header Actions */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" component="h2">
          Clinical Interventions
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/pharmacy/clinical-interventions/create')}
          >
            Create New
          </Button>
        </Box>
      </Box>

      {/* Filters Panel */}
      <Collapse in={showFilters}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleSearch}>
                        <SearchIcon />
                      </IconButton>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category || ''}
                    label="Category"
                    onChange={(e) =>
                      handleFilterChange(
                        'category',
                        e.target.value || undefined
                      )
                    }
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    <MenuItem value="drug_therapy_problem">
                      Drug Therapy Problem
                    </MenuItem>
                    <MenuItem value="adverse_drug_reaction">
                      Adverse Drug Reaction
                    </MenuItem>
                    <MenuItem value="medication_nonadherence">
                      Medication Non-adherence
                    </MenuItem>
                    <MenuItem value="drug_interaction">
                      Drug Interaction
                    </MenuItem>
                    <MenuItem value="dosing_issue">Dosing Issue</MenuItem>
                    <MenuItem value="contraindication">
                      Contraindication
                    </MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority || ''}
                    label="Priority"
                    onChange={(e) =>
                      handleFilterChange(
                        'priority',
                        e.target.value || undefined
                      )
                    }
                  >
                    <MenuItem value="">All Priorities</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status || ''}
                    label="Status"
                    onChange={(e) =>
                      handleFilterChange('status', e.target.value || undefined)
                    }
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="identified">Identified</MenuItem>
                    <MenuItem value="planning">Planning</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="implemented">Implemented</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFilters({
                        page: 1,
                        limit: 10,
                        sortBy: 'createdAt',
                        sortOrder: 'desc',
                      });
                      setSearchQuery('');
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>

      {/* Interventions Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Intervention #</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Identified Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interventions.length > 0 ? (
                interventions.map((intervention: ClinicalIntervention) => (
                  <TableRow key={intervention._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {intervention.interventionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PersonIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2">
                            {intervention.patient
                              ? `${intervention.patient.firstName} ${intervention.patient.lastName}`
                              : 'Unknown Patient'}
                          </Typography>
                          {intervention.patient?.dateOfBirth && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              DOB:{' '}
                              {format(
                                parseISO(intervention.patient.dateOfBirth),
                                'MMM dd, yyyy'
                              )}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={intervention.category
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={intervention.priority.toUpperCase()}
                        size="small"
                        color={getPriorityColor(intervention.priority) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(intervention.status)}
                        label={intervention.status
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                        size="small"
                        color={getStatusColor(intervention.status) as unknown}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(
                          parseISO(intervention.identifiedDate),
                          'MMM dd, yyyy'
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(parseISO(intervention.identifiedDate), 'HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() =>
                              navigate(
                                `/pharmacy/clinical-interventions/details/${intervention._id}`
                              )
                            }
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() =>
                              navigate(
                                `/pharmacy/clinical-interventions/edit/${intervention._id}`
                              )
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(intervention._id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <Box>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        No Clinical Interventions Found
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        paragraph
                      >
                        {filters.search ||
                        filters.category ||
                        filters.priority ||
                        filters.status
                          ? 'No interventions match your current filters. Try adjusting your search criteria.'
                          : 'No clinical interventions have been created yet. Create your first intervention to get started.'}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() =>
                          navigate('/pharmacy/clinical-interventions/create')
                        }
                      >
                        Create First Intervention
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={pagination.total}
          rowsPerPage={pagination.limit}
          page={pagination.page - 1}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Intervention</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this clinical intervention? This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteInterventionMutation.isPending}
          >
            {deleteInterventionMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClinicalInterventionsList;
