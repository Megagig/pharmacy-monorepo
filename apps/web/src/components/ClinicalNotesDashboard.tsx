import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
  Card,
  CardContent,
  Stack,
  Divider,
  Badge,
  CircularProgress,
  CardActions,
  Collapse,
  useTheme,
} from '@mui/material';
import ClinicalNotesErrorBoundary from './ClinicalNotesErrorBoundary';
import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
  GridActionsCellItem,
  GridToolbar,
  GridSortModel,
  GridRowParams,
} from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewIcon from '@mui/icons-material/Visibility';
import FilterIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SecurityIcon from '@mui/icons-material/Security';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import NoteIcon from '@mui/icons-material/Note';
import { format, parseISO } from 'date-fns';
import { useEnhancedClinicalNoteStore } from '../stores/enhancedClinicalNoteStore';
import { useClinicalNotes } from '../queries/clinicalNoteQueries';
import { useResponsive } from '../hooks/useResponsive';
import {
  ClinicalNote,
  ClinicalNoteFilters,
  NOTE_TYPES,
  NOTE_PRIORITIES,
} from '../types/clinicalNote';

interface ClinicalNotesDashboardProps {
  patientId?: string;
  embedded?: boolean;
  maxHeight?: number;
  onNoteSelect?: (noteId: string) => void;
  onNoteEdit?: (noteId: string) => void;
  onNoteCreate?: () => void;
}

const ClinicalNotesDashboard: React.FC<ClinicalNotesDashboardProps> = ({
  patientId,
  embedded = false,
  maxHeight,
  onNoteSelect,
  onNoteEdit,
  onNoteCreate,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isMobile, shouldUseCardLayout } = useResponsive();

  // Store state
  const {
    selectedNotes,
    filters,
    searchQuery,
    loading,
    errors,
    ui,
    // Actions
    fetchNotes,
    searchNotes,
    deleteNote,
    bulkDeleteNotes,
    bulkUpdateNotes,
    toggleNoteSelection,
    clearSelection,
    setFilters,
    clearFilters,
    setSearchQuery,
    setPage,
    setCreateModalOpen,
    setEditModalOpen,
    setDeleteConfirmOpen,
    setBulkDeleteConfirmOpen,
  } = useEnhancedClinicalNoteStore();

  // Local state
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [bulkActionAnchor, setBulkActionAnchor] = useState<null | HTMLElement>(
    null
  );
  const [selectedNoteForAction, setSelectedNoteForAction] =
    useState<ClinicalNote | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // React Query for data fetching - stabilize filters to prevent unnecessary re-renders
  const currentFilters = useMemo(() => {
    const baseFilters = filters || {};
    const result = { ...baseFilters };
    if (patientId) {
      result.patientId = patientId;
    }
    return result;
  }, [filters, patientId]);

  const { data, isLoading, error } = useClinicalNotes(currentFilters);

  // Handle search - directly update filters for React Query
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      const newFilters = {
        ...filters,
        ...(patientId && { patientId }),
        page: 1, // Reset to first page
      };

      if (query.trim()) {
        newFilters.search = query.trim();
      } else {
        // Remove search parameter when query is empty
        delete newFilters.search;
      }

      setFilters(newFilters);
    },
    [filters, patientId, setSearchQuery, setFilters]
  );

  // Debounced search - use useRef to maintain stable reference
  const debouncedSearchRef = React.useRef<(query: string) => void>();

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    debouncedSearchRef.current = (query: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handleSearch(query), 300);
    };

    return () => clearTimeout(timeoutId);
  }, [handleSearch]);

  const debouncedSearch = useCallback((query: string) => {
    debouncedSearchRef.current?.(query);
  }, []);

  // Handle search input change
  const handleSearchInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Handle filter changes - directly update filters for React Query
  const handleFilterChange = (
    key: keyof ClinicalNoteFilters,
    value: string | undefined
  ) => {
    if (value === undefined || value === '') {
      // Create new filters object without the specified key
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: unused, ...rest } = filters;
      setFilters({ ...rest, page: 1 });
    } else {
      // Type-safe approach with explicit object creation
      const updatedFilters: ClinicalNoteFilters = { ...filters, page: 1 };

      // Handle each specific key type-safely
      if (
        key === 'search' ||
        key === 'patientId' ||
        key === 'type' ||
        key === 'priority' ||
        key === 'dateFrom' ||
        key === 'dateTo'
      ) {
        updatedFilters[key] = value;
      } else if (
        key === 'sortBy' &&
        (value === 'title' ||
          value === 'createdAt' ||
          value === 'updatedAt' ||
          value === 'priority')
      ) {
        updatedFilters.sortBy = value;
      } else if (key === 'sortOrder' && (value === 'asc' || value === 'desc')) {
        updatedFilters.sortOrder = value;
      }

      setFilters(updatedFilters);
    }
  };

  // Clear all filters - reset to initial state
  const handleClearFilters = () => {
    // Use the store's clearFilters method
    clearFilters();

    // Reset local state
    setSearchInput('');
    setSearchQuery('');
  }; // Handle row selection with simplified approach
  const handleRowSelectionChange = useCallback(
    (selectionModel: GridRowSelectionModel) => {
      try {
        // Clear current selection first
        clearSelection();

        // Add new selections
        const selectedIds = Array.isArray(selectionModel)
          ? selectionModel
          : Array.from(selectionModel.ids || []);

        selectedIds.forEach((id) => {
          if (typeof id === 'string' && id.trim().length > 0) {
            toggleNoteSelection(id);
          }
        });
      } catch (error) {
        console.error('Error handling row selection change:', error);
        clearSelection();
      }
    },
    [toggleNoteSelection, clearSelection]
  ); // Handle bulk actions
  const handleBulkDelete = async () => {
    try {
      const success = await bulkDeleteNotes(selectedNotes);
      if (success) {
        setSnackbar({
          open: true,
          message: `Successfully deleted ${selectedNotes.length} notes`,
          severity: 'success',
        });
        clearSelection();
      }
    } catch {
      setSnackbar({
        open: true,
        message: 'Failed to delete notes',
        severity: 'error',
      });
    }
    setBulkDeleteConfirmOpen(false);
  };

  const handleBulkToggleConfidential = async (isConfidential: boolean) => {
    try {
      const success = await bulkUpdateNotes(selectedNotes, { isConfidential });
      if (success) {
        setSnackbar({
          open: true,
          message: `Successfully updated ${selectedNotes.length} notes`,
          severity: 'success',
        });
        clearSelection();
      }
    } catch {
      setSnackbar({
        open: true,
        message: 'Failed to update notes',
        severity: 'error',
      });
    }
    setBulkActionAnchor(null);
  };

  // Handle individual note actions
  const handleViewNote = (note: ClinicalNote) => {
    // Use callback if provided, otherwise fallback to navigation
    if (onNoteSelect) {
      onNoteSelect(note._id);
    } else if (embedded) {
      // For embedded views, open in new tab
      window.open(`/notes/${note._id}`, '_blank');
    } else {
      // For main dashboard, navigate in same tab
      navigate(`/notes/${note._id}`);
    }
  };

  const handleEditNote = (note: ClinicalNote) => {
    // Use callback if provided, otherwise fallback to modal
    if (onNoteEdit) {
      onNoteEdit(note._id);
    } else {
      setSelectedNoteForAction(note);
      setEditModalOpen(true);
    }
  };

  const handleDeleteNote = async (note: ClinicalNote) => {
    try {
      const success = await deleteNote(note._id);
      if (success) {
        setSnackbar({
          open: true,
          message: 'Note deleted successfully',
          severity: 'success',
        });
      }
    } catch {
      setSnackbar({
        open: true,
        message: 'Failed to delete note',
        severity: 'error',
      });
    }
    setDeleteConfirmOpen(false);
  };

  // Format functions
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatPatientName = (patient: ClinicalNote['patient']) => {
    if (!patient) return 'Unknown Patient';
    return `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown Patient';
  };

  const formatPharmacistName = (pharmacist: ClinicalNote['pharmacist']) => {
    if (!pharmacist) return 'Unknown Pharmacist';
    return `${pharmacist.firstName || ''} ${pharmacist.lastName || ''}`.trim() || 'Unknown Pharmacist';
  };

  // Priority chip component
  const PriorityChip = ({
    priority,
  }: {
    priority: ClinicalNote['priority'];
  }) => {
    const priorityInfo = NOTE_PRIORITIES.find((p) => p.value === priority);
    const priorityConfig = {
      high: {
        color: theme.palette.error.main,
        bg: `${theme.palette.error.main}15`,
        icon: '🔴',
      },
      medium: {
        color: theme.palette.warning.main,
        bg: `${theme.palette.warning.main}15`,
        icon: '🟡',
      },
      low: {
        color: theme.palette.success.main,
        bg: `${theme.palette.success.main}15`,
        icon: '🟢',
      },
    };

    const config = priorityConfig[priority] || priorityConfig.low;

    return (
      <Chip
        label={`${config.icon} ${priorityInfo?.label || priority}`}
        size="small"
        sx={{
          backgroundColor: config.bg,
          color: config.color,
          fontWeight: 600,
          border: `1px solid ${config.color}30`,
          fontSize: '0.75rem',
          '&:hover': {
            backgroundColor: `${config.color}25`,
          },
          transition: 'all 0.2s ease-in-out',
        }}
      />
    );
  };

  // Type chip component
  const TypeChip = ({ type }: { type: ClinicalNote['type'] }) => {
    const typeInfo = NOTE_TYPES.find((t) => t.value === type);
    const typeConfig = {
      consultation: { icon: '👩‍⚕️', color: theme.palette.primary.main },
      medication_review: { icon: '💊', color: theme.palette.secondary.main },
      follow_up: { icon: '📅', color: theme.palette.info.main },
      adverse_event: { icon: '⚠️', color: theme.palette.error.main },
      other: { icon: '📝', color: theme.palette.grey[600] },
    };

    const config = typeConfig[type] || typeConfig.other;

    return (
      <Chip
        label={`${config.icon} ${typeInfo?.label || type}`}
        size="small"
        sx={{
          backgroundColor: `${config.color}10`,
          color: config.color,
          border: `1px solid ${config.color}30`,
          fontWeight: 500,
          fontSize: '0.75rem',
          '&:hover': {
            backgroundColor: `${config.color}20`,
          },
          transition: 'all 0.2s ease-in-out',
        }}
      />
    );
  };

  // Initialize filters on component mount
  useEffect(() => {
    if (!filters || Object.keys(filters).length === 0) {
      const initFilters = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        ...(patientId && { patientId }),
      };
      setFilters(initFilters);
    }
  }, [filters, setFilters, patientId]);

  // Define DataGrid columns
  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={500} noWrap>
            {params.value}
          </Typography>
          {params.row.isConfidential && (
            <Chip
              icon={<SecurityIcon />}
              label="Confidential"
              size="small"
              color="warning"
              sx={{ mt: 0.5 }}
            />
          )}
        </Box>
      ),
    },
    {
      field: 'patient',
      headerName: 'Patient',
      width: 180,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {formatPatientName(params.value)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            MRN: {params.value?.mrn || 'N/A'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      renderCell: (params) => <TypeChip type={params.value} />,
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
      renderCell: (params) => <PriorityChip priority={params.value} />,
    },
    {
      field: 'pharmacist',
      headerName: 'Pharmacist',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {formatPharmacistName(params.value)}
        </Typography>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">{formatDate(params.value)}</Typography>
      ),
    },
    {
      field: 'attachments',
      headerName: 'Attachments',
      width: 120,
      align: 'center',
      renderCell: (params) =>
        params.value?.length > 0 ? (
          <Badge badgeContent={params.value.length} color="primary">
            <AttachFileIcon color="action" />
          </Badge>
        ) : null,
    },
    {
      field: 'followUpRequired',
      headerName: 'Follow-up',
      width: 100,
      align: 'center',
      renderCell: (params) =>
        params.value ? (
          <Tooltip
            title={`Follow-up: ${
              params.row.followUpDate
                ? formatDate(params.row.followUpDate)
                : 'Not scheduled'
            }`}
          >
            <ScheduleIcon color="warning" />
          </Tooltip>
        ) : null,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          icon={<ViewIcon />}
          label="View"
          onClick={() => handleViewNote(params.row)}
        />,
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Edit"
          onClick={() => handleEditNote(params.row)}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => {
            setSelectedNoteForAction(params.row);
            setDeleteConfirmOpen(true);
          }}
        />,
      ],
    },
  ];

  // Handle sorting
  const handleSortChange = (model: GridSortModel) => {
    if (Array.isArray(model) && model.length > 0) {
      const sort = model[0];
      if (sort && typeof sort.field === 'string') {
        handleFilterChange('sortBy', sort.field);
        handleFilterChange('sortOrder', sort.sort || undefined);
      }
    }
  };

  // Mobile Card Component
  const NoteCard: React.FC<{ note: ClinicalNote }> = ({ note }) => {
    const [cardExpanded, setCardExpanded] = useState(false);
    const isSelected = selectedNotes.includes(note._id);

    return (
      <Card
        sx={{
          mb: 3,
          border: isSelected
            ? `2px solid ${theme.palette.primary.main}`
            : `1px solid ${theme.palette.divider}`,
          borderRadius: 3,
          background: isSelected
            ? `linear-gradient(135deg, ${theme.palette.primary.main}08, ${theme.palette.background.paper})`
            : theme.palette.background.paper,
          boxShadow: isSelected
            ? '0 8px 30px rgba(37, 99, 235, 0.15)'
            : '0 2px 12px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            transform: 'translateY(-2px)',
          },
          transition: 'all 0.3s ease-in-out',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background:
              note.priority === 'high'
                ? theme.palette.error.main
                : note.priority === 'medium'
                ? theme.palette.warning.main
                : theme.palette.success.main,
          },
        }}
      >
        <CardContent sx={{ pb: 1, pl: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontWeight: 700,
                  mb: 1.5,
                  color: theme.palette.text.primary,
                  lineHeight: 1.3,
                }}
              >
                {note.title}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                <TypeChip type={note.type} />
                <PriorityChip priority={note.priority} />
                {note.isConfidential && (
                  <Chip
                    icon={<SecurityIcon sx={{ fontSize: '0.875rem' }} />}
                    label="Confidential"
                    size="small"
                    sx={{
                      backgroundColor: theme.palette.warning.main,
                      color: 'white',
                      fontWeight: 500,
                      '& .MuiChip-icon': {
                        color: 'white',
                      },
                    }}
                  />
                )}
              </Stack>
            </Box>
            <IconButton
              size="small"
              onClick={() => toggleNoteSelection(note._id)}
              sx={{
                color: isSelected
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary,
                backgroundColor: isSelected
                  ? `${theme.palette.primary.main}15`
                  : 'transparent',
                border: `2px solid ${
                  isSelected
                    ? theme.palette.primary.main
                    : theme.palette.divider
                }`,
                borderRadius: '50%',
                width: 32,
                height: 32,
                '&:hover': {
                  backgroundColor: `${theme.palette.primary.main}20`,
                  borderColor: theme.palette.primary.main,
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {isSelected ? '✓' : '○'}
            </IconButton>
          </Box>

          {/* Patient Info */}
          <Box
            sx={{
              mb: 2,
              p: 2,
              backgroundColor: `${theme.palette.grey[50]}`,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography
              variant="body2"
              sx={{ mb: 1, display: 'flex', alignItems: 'center' }}
            >
              <Box
                component="span"
                sx={{
                  color: theme.palette.text.secondary,
                  minWidth: '70px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Patient:
              </Box>
              <Box
                component="span"
                sx={{ fontWeight: 600, color: theme.palette.text.primary }}
              >
                {formatPatientName(note.patient)}
              </Box>
              <Chip
                label={`MRN: ${note.patient?.mrn || 'N/A'}`}
                size="small"
                variant="outlined"
                sx={{ ml: 1, fontSize: '0.7rem', height: '20px' }}
              />
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 1, display: 'flex', alignItems: 'center' }}
            >
              <Box
                component="span"
                sx={{
                  color: theme.palette.text.secondary,
                  minWidth: '70px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Provider:
              </Box>
              <Box component="span" sx={{ color: theme.palette.text.primary }}>
                {formatPharmacistName(note.pharmacist)}
              </Box>
            </Typography>
            <Typography
              variant="body2"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <Box
                component="span"
                sx={{
                  color: theme.palette.text.secondary,
                  minWidth: '70px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Created:
              </Box>
              <Box component="span" sx={{ color: theme.palette.text.primary }}>
                {formatDate(note.createdAt)}
              </Box>
            </Typography>
          </Box>

          {/* Indicators */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            {note.followUpRequired && (
              <Tooltip
                title={`Follow-up: ${
                  note.followUpDate
                    ? formatDate(note.followUpDate)
                    : 'Not scheduled'
                }`}
              >
                <Chip
                  icon={<ScheduleIcon sx={{ fontSize: '0.875rem' }} />}
                  label="Follow-up"
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.warning.main,
                    color: 'white',
                    fontWeight: 500,
                    '& .MuiChip-icon': {
                      color: 'white',
                    },
                  }}
                />
              </Tooltip>
            )}
            {note.attachments?.length > 0 && (
              <Chip
                icon={<AttachFileIcon sx={{ fontSize: '0.875rem' }} />}
                label={`${note.attachments.length} files`}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  '& .MuiChip-icon': {
                    color: theme.palette.primary.main,
                  },
                }}
              />
            )}
          </Stack>

          {/* Content Preview */}
          <Collapse in={cardExpanded}>
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              {note.content.subjective && (
                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="primary"
                  >
                    Subjective:
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {note.content.subjective}
                  </Typography>
                </Box>
              )}
              {note.content.objective && (
                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="primary"
                  >
                    Objective:
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {note.content.objective}
                  </Typography>
                </Box>
              )}
              {note.content.assessment && (
                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="primary"
                  >
                    Assessment:
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {note.content.assessment}
                  </Typography>
                </Box>
              )}
              {note.content.plan && (
                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="primary"
                  >
                    Plan:
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {note.content.plan}
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </CardContent>

        <CardActions
          sx={{
            justifyContent: 'space-between',
            px: 3,
            pb: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: `${theme.palette.grey[25]}`,
          }}
        >
          <Button
            size="small"
            onClick={() => setCardExpanded(!cardExpanded)}
            startIcon={cardExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: `${theme.palette.primary.main}10`,
                color: theme.palette.primary.main,
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {cardExpanded ? 'Show Less' : 'Show More'}
          </Button>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={() => handleViewNote(note)}
              sx={{
                color: theme.palette.primary.main,
                backgroundColor: `${theme.palette.primary.main}10`,
                '&:hover': {
                  backgroundColor: `${theme.palette.primary.main}20`,
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleEditNote(note)}
              sx={{
                color: theme.palette.secondary.main,
                backgroundColor: `${theme.palette.secondary.main}10`,
                '&:hover': {
                  backgroundColor: `${theme.palette.secondary.main}20`,
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                setSelectedNoteForAction(note);
                setDeleteConfirmOpen(true);
              }}
              sx={{
                color: theme.palette.error.main,
                backgroundColor: `${theme.palette.error.main}10`,
                '&:hover': {
                  backgroundColor: `${theme.palette.error.main}20`,
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </CardActions>
      </Card>
    );
  };

  return (
    <Box sx={{ height: maxHeight || (embedded ? 600 : '100%'), width: '100%' }}>
      {!embedded && (
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}10 100%)`,
              borderRadius: 3,
              p: 4,
              mb: 3,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.03"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                opacity: 0.5,
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  mb: 1,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                }}
              >
                Clinical Notes
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ fontSize: '1.1rem', opacity: 0.8 }}
              >
                Manage SOAP notes and clinical documentation with enhanced
                workflow
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Statistics Cards */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          mb: 3,
        }}
      >
        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
          <Card
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: 3,
              height: '100%',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  p: 1.5,
                  mr: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <NoteIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {data?.totalNotes || 0}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Total Notes
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
          <Card
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              borderRadius: 3,
              height: '100%',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 40px rgba(79, 172, 254, 0.4)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  p: 1.5,
                  mr: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ScheduleIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {data?.notes?.filter((note: ClinicalNote) => {
                      const noteDate = new Date(note.createdAt);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return noteDate >= weekAgo;
                    }).length || 0}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Recent (7 days)
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
          <Card
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
              borderRadius: 3,
              height: '100%',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 40px rgba(250, 112, 154, 0.4)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  p: 1.5,
                  mr: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <SecurityIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {data?.notes?.filter((note: ClinicalNote) => note.isConfidential).length || 0}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Confidential
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
          <Card
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
              color: 'white',
              borderRadius: 3,
              height: '100%',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 40px rgba(255, 107, 107, 0.4)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  p: 1.5,
                  mr: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FilterIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {data?.notes?.filter((note: ClinicalNote) => note.priority === 'high' || note.priority === 'urgent').length || 0}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    High Priority
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Toolbar */}
      <Card
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          },
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <CardContent sx={{ pb: 2 }}>
          {isMobile ? (
            // Mobile Toolbar Layout
            <Stack spacing={2}>
              {/* Search Row */}
              <TextField
                placeholder="Search notes, patients, or content..."
                value={searchInput}
                onChange={handleSearchInputChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.primary.main }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchInput && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchInput('');
                          handleSearch('');
                        }}
                        sx={{
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                fullWidth
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 3,
                    '&:hover': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                      },
                    },
                    '&.Mui-focused': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                        borderWidth: 2,
                      },
                    },
                  },
                }}
              />

              {/* Action Buttons Row */}
              <Stack direction="row" spacing={1} justifyContent="space-between">
                <Stack direction="row" spacing={1}>
                  <IconButton
                    onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                    color="primary"
                    size="small"
                  >
                    <FilterIcon />
                  </IconButton>
                  {(filters.type ||
                    filters.priority ||
                    filters.dateFrom ||
                    filters.dateTo) && (
                    <IconButton
                      onClick={handleClearFilters}
                      color="secondary"
                      size="small"
                    >
                      <ClearIcon />
                    </IconButton>
                  )}
                  {selectedNotes.length > 0 && (
                    <IconButton
                      onClick={(e) => setBulkActionAnchor(e.currentTarget)}
                      color="secondary"
                      size="small"
                    >
                      <Badge
                        badgeContent={selectedNotes.length}
                        color="primary"
                      >
                        <MoreVertIcon />
                      </Badge>
                    </IconButton>
                  )}
                </Stack>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() =>
                    onNoteCreate ? onNoteCreate() : setCreateModalOpen(true)
                  }
                  variant="contained"
                  size="small"
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                    '&:hover': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                      boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.3s ease-in-out',
                    borderRadius: 2,
                  }}
                >
                  New
                </Button>
              </Stack>
            </Stack>
          ) : (
            // Desktop Toolbar Layout
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
            >
              {/* Search */}
              <TextField
                placeholder="Search notes, patients, or content..."
                value={searchInput}
                onChange={handleSearchInputChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.primary.main }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchInput && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchInput('');
                          handleSearch('');
                        }}
                        sx={{
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: 300,
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 3,
                    '&:hover': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                      },
                    },
                    '&.Mui-focused': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                        borderWidth: 2,
                      },
                    },
                  },
                }}
              />

              {/* Filters */}
              <Button
                startIcon={<FilterIcon />}
                onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                variant="outlined"
                sx={{
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    borderColor: theme.palette.primary.dark,
                    backgroundColor: `${theme.palette.primary.main}08`,
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.3s ease-in-out',
                  borderRadius: 2,
                }}
              >
                Filters
              </Button>

              {/* Clear Filters */}
              {(filters.type ||
                filters.priority ||
                filters.dateFrom ||
                filters.dateTo) && (
                <Button
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  variant="text"
                  color="secondary"
                >
                  Clear Filters
                </Button>
              )}

              {/* Create Note */}
              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  onNoteCreate ? onNoteCreate() : setCreateModalOpen(true)
                }
                variant="contained"
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                    boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.3s ease-in-out',
                  borderRadius: 2,
                  px: 3,
                }}
              >
                New Note
              </Button>

              {/* Bulk Actions */}
              {selectedNotes.length > 0 && (
                <Button
                  startIcon={<MoreVertIcon />}
                  onClick={(e) => setBulkActionAnchor(e.currentTarget)}
                  variant="outlined"
                  color="secondary"
                >
                  Actions ({selectedNotes.length})
                </Button>
              )}
            </Stack>
          )}

          {/* Active Filters Display */}
          {(filters.type ||
            filters.priority ||
            filters.dateFrom ||
            filters.dateTo) && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {filters.type && (
                  <Chip
                    label={`Type: ${
                      NOTE_TYPES.find((t) => t.value === filters.type)?.label
                    }`}
                    onDelete={() => handleFilterChange('type', undefined)}
                    size="small"
                  />
                )}
                {filters.priority && (
                  <Chip
                    label={`Priority: ${
                      NOTE_PRIORITIES.find((p) => p.value === filters.priority)
                        ?.label
                    }`}
                    onDelete={() => handleFilterChange('priority', undefined)}
                    size="small"
                  />
                )}
                {filters.dateFrom && (
                  <Chip
                    label={`From: ${format(
                      parseISO(filters.dateFrom),
                      'MMM dd, yyyy'
                    )}`}
                    onDelete={() => handleFilterChange('dateFrom', undefined)}
                    size="small"
                  />
                )}
                {filters.dateTo && (
                  <Chip
                    label={`To: ${format(
                      parseISO(filters.dateTo),
                      'MMM dd, yyyy'
                    )}`}
                    onDelete={() => handleFilterChange('dateTo', undefined)}
                    size="small"
                  />
                )}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Data Display - Table or Cards */}
      {shouldUseCardLayout ? (
        // Mobile Card Layout
        <Box>
          {isLoading || loading.fetchNotes ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
                gap: 2,
              }}
            >
              <CircularProgress
                size={48}
                sx={{
                  color: theme.palette.primary.main,
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  },
                }}
              />
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                Loading clinical notes...
              </Typography>
            </Box>
          ) : (data?.notes || []).length === 0 ? (
            <Card
              sx={{
                textAlign: 'center',
                py: 8,
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
                border: `2px dashed ${theme.palette.divider}`,
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Box sx={{ mb: 3 }}>
                  <NoteIcon
                    sx={{
                      fontSize: 64,
                      color: theme.palette.text.secondary,
                      opacity: 0.5,
                      mb: 2,
                    }}
                  />
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    mb: 2,
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                  }}
                >
                  No clinical notes found
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mb: 4, maxWidth: 400, mx: 'auto', lineHeight: 1.6 }}
                >
                  {searchQuery || filters.type || filters.priority
                    ? "Try adjusting your search criteria or filters to find the notes you're looking for."
                    : 'Get started by creating your first clinical note. Document patient consultations, medication reviews, and follow-ups all in one place.'}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  size="large"
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                    '&:hover': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                      boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.3s ease-in-out',
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                  }}
                  onClick={() =>
                    onNoteCreate ? onNoteCreate() : setCreateModalOpen(true)
                  }
                >
                  Create Note
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Notes List */}
              <Box>
                {(data?.notes || []).map((note) => (
                  <NoteCard key={note._id} note={note} />
                ))}
              </Box>

              {/* Mobile Pagination */}
              {data && data.totalPages > 1 && (
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="body2" color="text.secondary">
                        Page {data.currentPage} of {data.totalPages}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          disabled={data.currentPage <= 1}
                          onClick={() => setPage(data.currentPage - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          size="small"
                          disabled={data.currentPage >= data.totalPages}
                          onClick={() => setPage(data.currentPage + 1)}
                        >
                          Next
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </Box>
      ) : (
        // Desktop Table Layout
        <Card
          elevation={0}
          sx={{
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            transition: 'box-shadow 0.3s ease',
            '&:hover': {
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }
          }}
        >
          {/* Render DataGrid with simplified conditions */}
          {isLoading || loading.fetchNotes ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight={200}
              flexDirection="column"
              gap={2}
            >
              <CircularProgress
                size={48}
                sx={{
                  color: theme.palette.primary.main,
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  },
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Loading clinical notes...
              </Typography>
            </Box>
          ) : error ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight={200}
              flexDirection="column"
              gap={2}
            >
              <Typography variant="h6" color="error">
                Error loading notes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {error.message}
              </Typography>
            </Box>
          ) : (
            <>
              {/* DataGrid wrapped in error boundary for additional protection */}
              <ClinicalNotesErrorBoundary>
                <DataGrid
                  rows={(data?.notes || []).map((note) => ({
                    ...note,
                    id: note._id, // Ensure id field exists for DataGrid
                  }))}
                  columns={columns}
                  loading={isLoading || loading.fetchNotes}
                  checkboxSelection={Array.isArray(selectedNotes)} // Only enable when we have a valid array
                  disableRowSelectionOnClick
                  rowSelectionModel={{
                    type: 'include',
                    ids: new Set(selectedNotes),
                  }}
                  onRowSelectionModelChange={handleRowSelectionChange}
                  paginationMode="client"
                  sortingMode="client"
                  filterMode="client"
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: {
                      paginationModel: {
                        page: 0,
                        pageSize: 10,
                      },
                    },
                  }}
                  getRowId={(row) => row._id || row.id}
                  onSortModelChange={handleSortChange}
                  slots={{
                    toolbar: GridToolbar,
                    footer: () => null,
                  }}
                  slotProps={{
                    toolbar: {
                      showQuickFilter: false,
                      printOptions: { disableToolbarButton: true },
                    },
                  }}
                  sx={{
                    border: 'none',
                    '& .MuiDataGrid-cell': {
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      fontSize: '0.875rem',
                      py: 2,
                    },
                    '& .MuiDataGrid-columnHeaders': {
                      background: `linear-gradient(135deg, ${theme.palette.grey[100]} 0%, ${theme.palette.grey[50]} 100%)`,
                      borderBottom: `2px solid ${theme.palette.primary.main}`,
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: theme.palette.text.primary,
                      '& .MuiDataGrid-columnHeaderTitle': {
                        fontWeight: 700,
                      },
                    },
                    '& .MuiDataGrid-row': {
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: `${theme.palette.primary.main}08`,
                        transform: 'translateX(4px)',
                        boxShadow: `0 2px 8px ${theme.palette.primary.main}20`,
                      },
                      '&.Mui-selected': {
                        backgroundColor: `${theme.palette.primary.main}15`,
                        '&:hover': {
                          backgroundColor: `${theme.palette.primary.main}20`,
                        },
                      },
                    },
                    '& .MuiDataGrid-footerContainer': {
                      borderTop: `2px solid ${theme.palette.divider}`,
                      background: `linear-gradient(135deg, ${theme.palette.grey[50]} 0%, ${theme.palette.background.paper} 100%)`,
                    },
                    // Additional CSS to prevent size property issues
                    '& .MuiDataGrid-columnHeader .MuiCheckbox-root': {
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.25rem',
                      },
                    },
                    '& .MuiDataGrid-row .MuiCheckbox-root': {
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.25rem',
                      },
                    },
                  }}
                />
              </ClinicalNotesErrorBoundary>
              {/* Custom Pagination Controls */}
              {data && data.totalPages > 1 && (
                <Box
                  sx={{
                    p: 2,
                    borderTop: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Showing {data.notes.length} of {data.total} total rows
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      disabled={data.currentPage <= 1}
                      onClick={() => {
                        const newFilters = {
                          ...filters,
                          page: data.currentPage - 1,
                        };
                        setFilters(newFilters);
                        if (searchQuery) {
                          searchNotes(searchQuery, newFilters);
                        } else {
                          fetchNotes(newFilters);
                        }
                      }}
                    >
                      Previous
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      Page {data.currentPage} of {data.totalPages}
                    </Typography>
                    <Button
                      size="small"
                      disabled={data.currentPage >= data.totalPages}
                      onClick={() => {
                        const newFilters = {
                          ...filters,
                          page: data.currentPage + 1,
                        };
                        setFilters(newFilters);
                        if (searchQuery) {
                          searchNotes(searchQuery, newFilters);
                        } else {
                          fetchNotes(newFilters);
                        }
                      }}
                    >
                      Next
                    </Button>
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Card>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        PaperProps={{ sx: { minWidth: 300, p: 2 } }}
      >
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Note Type</InputLabel>
            <Select
              value={filters.type || ''}
              onChange={(e: SelectChangeEvent) =>
                handleFilterChange('type', e.target.value || undefined)
              }
              label="Note Type"
            >
              <MenuItem value="">All Types</MenuItem>
              {NOTE_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              value={filters.priority || ''}
              onChange={(e: SelectChangeEvent) =>
                handleFilterChange('priority', e.target.value || undefined)
              }
              label="Priority"
            >
              <MenuItem value="">All Priorities</MenuItem>
              {NOTE_PRIORITIES.map((priority) => (
                <MenuItem key={priority.value} value={priority.value}>
                  {priority.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Date From"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) =>
              handleFilterChange('dateFrom', e.target.value || undefined)
            }
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
          />

          <TextField
            label="Date To"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) =>
              handleFilterChange('dateTo', e.target.value || undefined)
            }
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
          />
        </Stack>
      </Menu>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkActionAnchor}
        open={Boolean(bulkActionAnchor)}
        onClose={() => setBulkActionAnchor(null)}
      >
        <MenuItem onClick={() => handleBulkToggleConfidential(true)}>
          <SecurityIcon sx={{ mr: 1 }} />
          Mark as Confidential
        </MenuItem>
        <MenuItem onClick={() => handleBulkToggleConfidential(false)}>
          <SecurityIcon sx={{ mr: 1 }} />
          Remove Confidential
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => setBulkDeleteConfirmOpen(true)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Selected
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={ui?.isDeleteConfirmOpen || false}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Note</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this note? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={() =>
              selectedNoteForAction && handleDeleteNote(selectedNoteForAction)
            }
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={ui?.isBulkDeleteConfirmOpen || false}
        onClose={() => setBulkDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Multiple Notes</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedNotes.length} selected
            notes? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleBulkDelete} color="error" variant="contained">
            Delete {selectedNotes.length} Notes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Error Display */}
      {(error || errors.fetchNotes) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error?.message ||
            errors.fetchNotes ||
            'An error occurred while loading notes'}
        </Alert>
      )}
    </Box>
  );
};

// Wrap with error boundary
const ClinicalNotesDashboardWithErrorBoundary: React.FC<
  ClinicalNotesDashboardProps
> = (props) => {
  return (
    <ClinicalNotesErrorBoundary context="clinical-notes-dashboard">
      <ClinicalNotesDashboard {...props} />
    </ClinicalNotesErrorBoundary>
  );
};

export default ClinicalNotesDashboardWithErrorBoundary;
