import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Stack,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  Toolbar,
  Tooltip,
  Collapse,
  Alert,
  Pagination,
  Skeleton,
  Avatar,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import {
  useClinicalInterventions,
  useDeleteIntervention,
} from '../queries/useClinicalInterventions';
import { useClinicalInterventionStore } from '../stores/clinicalInterventionStore';
import type {
  ClinicalIntervention,
  InterventionFilters,
} from '../stores/clinicalInterventionStore';

// ===============================
// TYPES AND INTERFACES
// ===============================

interface InterventionListProps {
  onEdit?: (intervention: ClinicalIntervention) => void;
  onView?: (intervention: ClinicalIntervention) => void;
  onDelete?: (intervention: ClinicalIntervention) => void;
  filters?: Partial<InterventionFilters>;
  showPatientColumn?: boolean;
  compact?: boolean;
}

type ViewMode = 'table' | 'cards';
type SortField = keyof ClinicalIntervention;
type SortOrder = 'asc' | 'desc';

// ===============================
// CONSTANTS
// ===============================

const INTERVENTION_CATEGORIES = {
  drug_therapy_problem: { label: 'Drug Therapy Problem', color: '#f44336' },
  adverse_drug_reaction: { label: 'Adverse Drug Reaction', color: '#ff9800' },
  medication_nonadherence: {
    label: 'Medication Non-adherence',
    color: '#2196f3',
  },
  drug_interaction: { label: 'Drug Interaction', color: '#9c27b0' },
  dosing_issue: { label: 'Dosing Issue', color: '#4caf50' },
  contraindication: { label: 'Contraindication', color: '#e91e63' },
  other: { label: 'Other', color: '#607d8b' },
} as const;

const PRIORITY_LEVELS = {
  low: { label: 'Low', color: '#4caf50' },
  medium: { label: 'Medium', color: '#ff9800' },
  high: { label: 'High', color: '#f44336' },
  critical: { label: 'Critical', color: '#d32f2f' },
} as const;

const STATUS_LABELS = {
  identified: { label: 'Identified', color: '#2196f3' },
  planning: { label: 'Planning', color: '#ff9800' },
  in_progress: { label: 'In Progress', color: '#9c27b0' },
  implemented: { label: 'Implemented', color: '#4caf50' },
  completed: { label: 'Completed', color: '#388e3c' },
  cancelled: { label: 'Cancelled', color: '#757575' },
} as const;

// ===============================
// MAIN COMPONENT
// ===============================

const InterventionList: React.FC<InterventionListProps> = ({
  onEdit,
  onView,
  onDelete,
  filters: propFilters = {},
  showPatientColumn = true,
  compact = false,
}) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>(
    []
  );
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedIntervention, setSelectedIntervention] =
    useState<ClinicalIntervention | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('identifiedDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Local filters state
  const [localFilters, setLocalFilters] = useState<InterventionFilters>({
    search: '',
    category: undefined,
    priority: undefined,
    status: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    sortBy: 'identifiedDate',
    sortOrder: 'desc',
    page: 1,
    limit: 20,
    ...propFilters,
  });

  // Store
  const { setFilters, clearFilters, selectIntervention, setShowDetailsModal } =
    useClinicalInterventionStore();

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalFilters((prev) => ({
        ...prev,
        search: searchQuery,
        page: 1,
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Combine filters
  const combinedFilters = useMemo(
    () => ({
      ...localFilters,
      sortBy: sortField,
      sortOrder,
      page,
      limit: pageSize,
    }),
    [localFilters, sortField, sortOrder, page, pageSize]
  );

  // Queries
  const {
    data: interventionsResponse,
    isLoading,
    error,
    refetch,
  } = useClinicalInterventions(combinedFilters);

  const deleteMutation = useDeleteIntervention();

  // Data processing
  const interventions = interventionsResponse?.data?.data || [];
  const pagination = interventionsResponse?.data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false,
  };

  // ===============================
  // HANDLERS
  // ===============================

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleFilterChange = (
    filterKey: keyof InterventionFilters,
    value: any
  ) => {
    setLocalFilters((prev) => ({
      ...prev,
      [filterKey]: value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handleClearFilters = () => {
    setLocalFilters({
      search: '',
      sortBy: 'identifiedDate',
      sortOrder: 'desc',
      page: 1,
      limit: 20,
    });
    setSearchQuery('');
    clearFilters();
  };

  const handleSelectIntervention = (interventionId: string) => {
    setSelectedInterventions((prev) =>
      prev.includes(interventionId)
        ? prev.filter((id) => id !== interventionId)
        : [...prev, interventionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInterventions.length === interventions.length) {
      setSelectedInterventions([]);
    } else {
      setSelectedInterventions(interventions.map((i) => i._id));
    }
  };

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    intervention: ClinicalIntervention
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedIntervention(intervention);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIntervention(null);
  };

  const handleView = (intervention: ClinicalIntervention) => {
    selectIntervention(intervention);
    setShowDetailsModal(true);
    onView?.(intervention);
    handleMenuClose();
  };

  const handleEdit = (intervention: ClinicalIntervention) => {
    onEdit?.(intervention);
    handleMenuClose();
  };

  const handleDelete = async (intervention: ClinicalIntervention) => {
    if (
      window.confirm(
        `Are you sure you want to delete intervention ${intervention.interventionNumber}?`
      )
    ) {
      try {
        await deleteMutation.mutateAsync(intervention._id);
        onDelete?.(intervention);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
    handleMenuClose();
  };

  const handleBulkDelete = async () => {
    if (selectedInterventions.length === 0) return;

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedInterventions.length} intervention(s)?`
      )
    ) {
      try {
        await Promise.all(
          selectedInterventions.map((id) => deleteMutation.mutateAsync(id))
        );
        setSelectedInterventions([]);
      } catch (error) {
        console.error('Bulk delete failed:', error);
      }
    }
  };

  // ===============================
  // RENDER HELPERS
  // ===============================

  const renderFilters = () => (
    <Collapse in={showFilters}>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={localFilters.category || ''}
                label="Category"
                onChange={(e) =>
                  handleFilterChange('category', e.target.value || undefined)
                }
              >
                <MenuItem value="">All Categories</MenuItem>
                {Object.entries(INTERVENTION_CATEGORIES).map(
                  ([value, config]) => (
                    <MenuItem key={value} value={value}>
                      {config.label}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={localFilters.priority || ''}
                label="Priority"
                onChange={(e) =>
                  handleFilterChange('priority', e.target.value || undefined)
                }
              >
                <MenuItem value="">All Priorities</MenuItem>
                {Object.entries(PRIORITY_LEVELS).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={localFilters.status || ''}
                label="Status"
                onChange={(e) =>
                  handleFilterChange('status', e.target.value || undefined)
                }
              >
                <MenuItem value="">All Statuses</MenuItem>
                {Object.entries(STATUS_LABELS).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date From"
                value={
                  localFilters.dateFrom ? new Date(localFilters.dateFrom) : null
                }
                onChange={(date) =>
                  handleFilterChange('dateFrom', date?.toISOString())
                }
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date To"
                value={
                  localFilters.dateTo ? new Date(localFilters.dateTo) : null
                }
                onChange={(date) =>
                  handleFilterChange('dateTo', date?.toISOString())
                }
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleClearFilters}
              startIcon={<ClearIcon />}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Collapse>
  );

  const renderToolbar = () => (
    <Toolbar sx={{ px: 0, minHeight: '64px !important' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search interventions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />

        {/* Filter Toggle */}
        <Button
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'contained' : 'outlined'}
          size="small"
        >
          Filters
        </Button>

        {/* Bulk Actions */}
        {selectedInterventions.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedInterventions.length} selected
            </Typography>
            <Button
              size="small"
              color="error"
              onClick={handleBulkDelete}
              startIcon={<DeleteIcon />}
            >
              Delete
            </Button>
          </Box>
        )}
      </Box>

      {/* View Mode Toggle */}
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(_, newMode) => newMode && setViewMode(newMode)}
        size="small"
      >
        <ToggleButton value="table">
          <ViewListIcon />
        </ToggleButton>
        <ToggleButton value="cards">
          <ViewModuleIcon />
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Export">
          <IconButton>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Toolbar>
  );

  const renderTableView = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={
                  selectedInterventions.length > 0 &&
                  selectedInterventions.length < interventions.length
                }
                checked={
                  interventions.length > 0 &&
                  selectedInterventions.length === interventions.length
                }
                onChange={handleSelectAll}
              />
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'interventionNumber'}
                direction={
                  sortField === 'interventionNumber' ? sortOrder : 'asc'
                }
                onClick={() => handleSort('interventionNumber')}
              >
                ID
              </TableSortLabel>
            </TableCell>
            {showPatientColumn && (
              <TableCell>
                <TableSortLabel
                  active={sortField === 'patientId'}
                  direction={sortField === 'patientId' ? sortOrder : 'asc'}
                  onClick={() => handleSort('patientId')}
                >
                  Patient
                </TableSortLabel>
              </TableCell>
            )}
            <TableCell>
              <TableSortLabel
                active={sortField === 'category'}
                direction={sortField === 'category' ? sortOrder : 'asc'}
                onClick={() => handleSort('category')}
              >
                Category
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'priority'}
                direction={sortField === 'priority' ? sortOrder : 'asc'}
                onClick={() => handleSort('priority')}
              >
                Priority
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'status'}
                direction={sortField === 'status' ? sortOrder : 'asc'}
                onClick={() => handleSort('status')}
              >
                Status
              </TableSortLabel>
            </TableCell>
            <TableCell>Issue Description</TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'identifiedDate'}
                direction={sortField === 'identifiedDate' ? sortOrder : 'asc'}
                onClick={() => handleSort('identifiedDate')}
              >
                Date
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton width={24} height={24} />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} />
                </TableCell>
                {showPatientColumn && (
                  <TableCell>
                    <Skeleton width={120} />
                  </TableCell>
                )}
                <TableCell>
                  <Skeleton width={100} />
                </TableCell>
                <TableCell>
                  <Skeleton width={60} />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} />
                </TableCell>
                <TableCell>
                  <Skeleton width={200} />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} />
                </TableCell>
                <TableCell>
                  <Skeleton width={40} />
                </TableCell>
              </TableRow>
            ))
          ) : interventions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showPatientColumn ? 9 : 8}
                align="center"
                sx={{ py: 4 }}
              >
                <Typography variant="body1" color="text.secondary">
                  No interventions found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery || Object.values(localFilters).some((v) => v)
                    ? 'Try adjusting your search or filters'
                    : 'Create your first intervention to get started'}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            interventions.map((intervention) => (
              <TableRow
                key={intervention._id}
                hover
                selected={selectedInterventions.includes(intervention._id)}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedInterventions.includes(intervention._id)}
                    onChange={() => handleSelectIntervention(intervention._id)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {intervention.interventionNumber}
                  </Typography>
                </TableCell>
                {showPatientColumn && (
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
                      >
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {intervention.patient?.firstName}{' '}
                          {intervention.patient?.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {intervention.patient?.phoneNumber}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                )}
                <TableCell>
                  <Chip
                    label={
                      INTERVENTION_CATEGORIES[intervention.category]?.label
                    }
                    size="small"
                    sx={{
                      bgcolor:
                        INTERVENTION_CATEGORIES[intervention.category]?.color +
                        '20',
                      color:
                        INTERVENTION_CATEGORIES[intervention.category]?.color,
                      fontWeight: 'medium',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={PRIORITY_LEVELS[intervention.priority]?.label}
                    size="small"
                    sx={{
                      bgcolor:
                        PRIORITY_LEVELS[intervention.priority]?.color + '20',
                      color: PRIORITY_LEVELS[intervention.priority]?.color,
                      fontWeight: 'medium',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={STATUS_LABELS[intervention.status]?.label}
                    size="small"
                    sx={{
                      bgcolor: STATUS_LABELS[intervention.status]?.color + '20',
                      color: STATUS_LABELS[intervention.status]?.color,
                      fontWeight: 'medium',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {intervention.issueDescription}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(intervention.identifiedDate).toLocaleDateString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {intervention.identifiedByUser?.firstName}{' '}
                    {intervention.identifiedByUser?.lastName}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, intervention)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderCardView = () => (
    <Grid container spacing={2}>
      {isLoading ? (
        Array.from({ length: 6 }).map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height={60}
                  sx={{ mt: 1 }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Skeleton variant="rounded" width={80} height={24} />
                  <Skeleton variant="rounded" width={60} height={24} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))
      ) : interventions.length === 0 ? (
        <Grid item xs={12}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No interventions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery || Object.values(localFilters).some((v) => v)
                ? 'Try adjusting your search or filters'
                : 'Create your first intervention to get started'}
            </Typography>
          </Paper>
        </Grid>
      ) : (
        interventions.map((intervention) => (
          <Grid item xs={12} sm={6} md={4} key={intervention._id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': { boxShadow: 4 },
              }}
              onClick={() => handleView(intervention)}
            >
              <CardContent sx={{ flex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1,
                  }}
                >
                  <Typography variant="h6" component="div" noWrap>
                    {intervention.interventionNumber}
                  </Typography>
                  <Checkbox
                    size="small"
                    checked={selectedInterventions.includes(intervention._id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectIntervention(intervention._id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Box>

                {showPatientColumn && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Avatar
                      sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}
                    >
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="body2" fontWeight="medium">
                      {intervention.patient?.firstName}{' '}
                      {intervention.patient?.lastName}
                    </Typography>
                  </Box>
                )}

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {intervention.issueDescription}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    label={
                      INTERVENTION_CATEGORIES[intervention.category]?.label
                    }
                    size="small"
                    sx={{
                      bgcolor:
                        INTERVENTION_CATEGORIES[intervention.category]?.color +
                        '20',
                      color:
                        INTERVENTION_CATEGORIES[intervention.category]?.color,
                      fontWeight: 'medium',
                    }}
                  />
                  <Chip
                    label={PRIORITY_LEVELS[intervention.priority]?.label}
                    size="small"
                    sx={{
                      bgcolor:
                        PRIORITY_LEVELS[intervention.priority]?.color + '20',
                      color: PRIORITY_LEVELS[intervention.priority]?.color,
                      fontWeight: 'medium',
                    }}
                  />
                </Stack>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Chip
                    label={STATUS_LABELS[intervention.status]?.label}
                    size="small"
                    sx={{
                      bgcolor: STATUS_LABELS[intervention.status]?.color + '20',
                      color: STATUS_LABELS[intervention.status]?.color,
                      fontWeight: 'medium',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(intervention.identifiedDate).toLocaleDateString()}
                  </Typography>
                </Box>
              </CardContent>

              <CardActions
                sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}
              >
                <Button
                  size="small"
                  startIcon={<ViewIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleView(intervention);
                  }}
                >
                  View
                </Button>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuOpen(e, intervention);
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))
      )}
    </Grid>
  );

  const renderPagination = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 3,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
        {pagination.total} interventions
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControl size="small">
          <InputLabel>Per page</InputLabel>
          <Select
            value={pageSize}
            label="Per page"
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ minWidth: 100 }}
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={20}>20</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </Select>
        </FormControl>

        <Pagination
          count={pagination.pages}
          page={pagination.page}
          onChange={(_, newPage) => setPage(newPage)}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>
    </Box>
  );

  // ===============================
  // MAIN RENDER
  // ===============================

  return (
    <Box>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load interventions. Please try again.
        </Alert>
      )}

      {/* Toolbar */}
      {renderToolbar()}

      {/* Filters */}
      {renderFilters()}

      {/* Content */}
      {viewMode === 'table' ? renderTableView() : renderCardView()}

      {/* Pagination */}
      {!isLoading && interventions.length > 0 && renderPagination()}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() =>
            selectedIntervention && handleView(selectedIntervention)
          }
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() =>
            selectedIntervention && handleEdit(selectedIntervention)
          }
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() =>
            selectedIntervention && handleDelete(selectedIntervention)
          }
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default InterventionList;
