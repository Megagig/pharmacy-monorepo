import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
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
  Alert,
  Snackbar,
  Card,
  CardContent,
  Stack,
  Switch,
  FormControlLabel,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDebounce } from '../hooks/useDebounce';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import VirtualizedClinicalNotesList from './VirtualizedClinicalNotesList';
import { useEnhancedClinicalNoteStore } from '../stores/enhancedClinicalNoteStore';
import { useClinicalNotes } from '../queries/clinicalNoteQueries';
import {
  ClinicalNote,
  ClinicalNoteFilters,
  NOTE_TYPES,
  NOTE_PRIORITIES,
} from '../types/clinicalNote';

interface OptimizedClinicalNotesDashboardProps {
  patientId?: string;
  embedded?: boolean;
  maxHeight?: number;
  onNoteSelect?: (noteId: string) => void;
  onNoteEdit?: (noteId: string) => void;
  onNoteCreate?: () => void;
  enableVirtualization?: boolean;
  itemHeight?: number;
}

const OptimizedClinicalNotesDashboard: React.FC<
  OptimizedClinicalNotesDashboardProps
> = ({
  patientId,
  embedded = false,
  maxHeight,
  onNoteSelect,
  onNoteEdit,
  onNoteCreate,
  enableVirtualization = true,
  itemHeight = 160,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Refs for performance optimization
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Store state
  const {
    notes,
    selectedNotes,
    filters,
    searchQuery,
    loading,
    pagination,
    setFilters,
    setSearchQuery,
    toggleNoteSelection,
    clearSelection,
    deleteNote,
    bulkDeleteNotes,
  } = useEnhancedClinicalNoteStore();

  // Local state
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Debounced search for performance
  const debouncedSearchQuery = useDebounce(searchInput, 300);

  // Current filters with patient context
  const currentFilters = useMemo(
    () => ({
      ...filters,
      ...(patientId && { patientId }),
      search: debouncedSearchQuery,
    }),
    [filters, patientId, debouncedSearchQuery]
  );

  // React Query for data fetching
  const { data, isLoading, error, refetch, isFetching } =
    useClinicalNotes(currentFilters);

  // Memoized notes list for performance
  const memoizedNotes = useMemo(() => {
    return data?.notes || [];
  }, [data?.notes]);

  // Update search query when debounced value changes
  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) {
      setSearchQuery(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, searchQuery, setSearchQuery]);

  // Intersection observer for infinite scrolling
  const { targetRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
  });

  // Load more data when reaching the bottom
  useEffect(() => {
    if (
      isIntersecting &&
      !isLoading &&
      !isFetching &&
      data &&
      data.currentPage < data.totalPages
    ) {
      setFilters({
        ...currentFilters,
        page: data.currentPage + 1,
      });
    }
  }, [isIntersecting, isLoading, isFetching, data, currentFilters, setFilters]);

  // Handle search input change
  const handleSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(event.target.value);
    },
    []
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (key: keyof ClinicalNoteFilters, value: any) => {
      const newFilters = { ...filters, [key]: value, page: 1 }; // Reset to first page
      setFilters(newFilters);
    },
    [filters, setFilters]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    setSearchInput('');
    setSearchQuery('');
  }, [setFilters, setSearchQuery]);

  // Handle note actions
  const handleViewNote = useCallback(
    (note: ClinicalNote) => {
      if (onNoteSelect) {
        onNoteSelect(note._id);
      } else if (embedded) {
        window.open(`/notes/${note._id}`, '_blank');
      } else {
        navigate(`/notes/${note._id}`);
      }
    },
    [onNoteSelect, embedded, navigate]
  );

  const handleEditNote = useCallback(
    (note: ClinicalNote) => {
      if (onNoteEdit) {
        onNoteEdit(note._id);
      } else {
        navigate(`/notes/${note._id}/edit`);
      }
    },
    [onNoteEdit, navigate]
  );

  const handleDeleteNote = useCallback(
    async (note: ClinicalNote) => {
      try {
        await deleteNote(note._id);
        setSnackbar({
          open: true,
          message: 'Note deleted successfully',
          severity: 'success',
        });
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Failed to delete note',
          severity: 'error',
        });
      }
    },
    [deleteNote]
  );

  const handleNoteSelect = useCallback(
    (noteId: string) => {
      toggleNoteSelection(noteId);
    },
    [toggleNoteSelection]
  );

  // Bulk operations
  const handleBulkDelete = useCallback(async () => {
    try {
      await bulkDeleteNotes(selectedNotes);
      setSnackbar({
        open: true,
        message: `Successfully deleted ${selectedNotes.length} notes`,
        severity: 'success',
      });
      clearSelection();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete notes',
        severity: 'error',
      });
    }
  }, [bulkDeleteNotes, selectedNotes, clearSelection]);

  // Calculate container height for virtualization
  const containerHeight = useMemo(() => {
    if (maxHeight) return maxHeight;
    if (embedded) return 600;
    return window.innerHeight - 300; // Account for header and toolbar
  }, [maxHeight, embedded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      // Escape to clear selection
      if (event.key === 'Escape') {
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  return (
    <Box ref={containerRef} sx={{ height: '100%', width: '100%' }}>
      {!embedded && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, mb: 1 }}
          >
            Clinical Notes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage SOAP notes and clinical documentation
          </Typography>
        </Box>
      )}

      {/* Optimized Toolbar */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: 2 }}>
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            alignItems={isMobile ? 'stretch' : 'center'}
          >
            {/* Search */}
            <TextField
              ref={searchInputRef}
              placeholder="Search notes... (Ctrl+K)"
              value={searchInput}
              onChange={handleSearchInputChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchInput && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchInput('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1, minWidth: isMobile ? 'auto' : 300 }}
              size="small"
            />

            {/* View Mode Toggle */}
            {!isMobile && (
              <Stack direction="row" spacing={0}>
                <IconButton
                  size="small"
                  onClick={() => setViewMode('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                >
                  <ViewListIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setViewMode('grid')}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                >
                  <ViewModuleIcon />
                </IconButton>
              </Stack>
            )}

            {/* Filters */}
            <Button
              startIcon={<FilterIcon />}
              onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
              variant="outlined"
              size="small"
            >
              Filters
            </Button>

            {/* Advanced Filters Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={showAdvancedFilters}
                  onChange={(e) => setShowAdvancedFilters(e.target.checked)}
                  size="small"
                />
              }
              label="Advanced"
              sx={{ ml: 0 }}
            />

            {/* Create Note */}
            <Button
              startIcon={<AddIcon />}
              onClick={() => onNoteCreate?.() || navigate('/notes/new')}
              variant="contained"
              size="small"
            >
              New Note
            </Button>

            {/* Bulk Actions */}
            {selectedNotes.length > 0 && (
              <Button
                onClick={handleBulkDelete}
                variant="outlined"
                color="error"
                size="small"
              >
                Delete ({selectedNotes.length})
              </Button>
            )}
          </Stack>

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
                <Button
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  variant="text"
                  size="small"
                  color="secondary"
                >
                  Clear All
                </Button>
              </Stack>
            </Box>
          )}

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filters.type || ''}
                    onChange={(e) =>
                      handleFilterChange('type', e.target.value || undefined)
                    }
                    label="Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    {NOTE_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'priority',
                        e.target.value || undefined
                      )
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
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && memoizedNotes.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Loading clinical notes...
          </Typography>
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load clinical notes. Please try again.
        </Alert>
      )}

      {/* Notes List */}
      {enableVirtualization && memoizedNotes.length > 10 ? (
        <VirtualizedClinicalNotesList
          notes={memoizedNotes}
          height={containerHeight}
          itemHeight={itemHeight}
          onNoteView={handleViewNote}
          onNoteEdit={handleEditNote}
          onNoteDelete={handleDeleteNote}
          onNoteSelect={handleNoteSelect}
          selectedNotes={selectedNotes}
          loading={isLoading}
        />
      ) : (
        <Box sx={{ height: containerHeight, overflow: 'auto' }}>
          {memoizedNotes.map((note) => (
            <Card
              key={note._id}
              sx={{
                mb: 2,
                cursor: 'pointer',
                border: selectedNotes.includes(note._id)
                  ? `2px solid ${theme.palette.primary.main}`
                  : '1px solid #e0e0e0',
                '&:hover': {
                  boxShadow: theme.shadows[4],
                },
              }}
              onClick={() => handleNoteSelect(note._id)}
            >
              <CardContent>
                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                  {note.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Patient: {note.patient.firstName} {note.patient.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(note.createdAt).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          ))}

          {/* Infinite scroll trigger */}
          {data && data.currentPage < data.totalPages && (
            <div ref={targetRef} style={{ height: 20, margin: '20px 0' }}>
              {isFetching && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  Loading more notes...
                </Typography>
              )}
            </div>
          )}
        </Box>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
          <TuneIcon sx={{ mr: 1 }} />
          Advanced Filters
        </MenuItem>
        <MenuItem onClick={handleClearFilters}>
          <ClearIcon sx={{ mr: 1 }} />
          Clear All Filters
        </MenuItem>
      </Menu>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(OptimizedClinicalNotesDashboard);
