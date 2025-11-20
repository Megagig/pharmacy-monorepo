import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  Badge,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  History as HistoryIcon,
  Bookmark as BookmarkIcon,
  Visibility as ViewIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  MedicalServices as MedicalIcon,
  Schedule as ScheduleIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, subDays } from 'date-fns';
import { debounce } from 'lodash';

interface SearchFilters {
  query: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  tags?: string[];
  startDate?: Date | null;
  endDate?: Date | null;
  sortBy?: 'relevance' | 'date';
  sortOrder?: 'asc' | 'desc';
}

interface ConversationResult {
  _id: string;
  title: string;
  type: 'direct' | 'group' | 'patient_query' | 'clinical_consultation';
  status: 'active' | 'archived' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  lastMessageAt: string;
  participantDetails: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  }>;
  patientId?: {
    _id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  unreadCount?: number;
  score?: number;
}

interface SearchStats {
  totalResults: number;
  searchTime: number;
}

interface ConversationSearchProps {
  height?: string;
  onConversationSelect?: (conversation: ConversationResult) => void;
  showSavedSearches?: boolean;
  defaultFilters?: Partial<SearchFilters>;
}

const ConversationSearch: React.FC<ConversationSearchProps> = ({
  height = '600px',
  onConversationSelect,
  showSavedSearches = true,
  defaultFilters = {},
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    sortBy: 'relevance',
    sortOrder: 'desc',
    ...defaultFilters,
  });
  const [results, setResults] = useState<ConversationResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchFilters: SearchFilters) => {
      if (!searchFilters.query.trim() && !hasAdvancedFilters(searchFilters)) {
        setResults([]);
        setStats(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();

        if (searchFilters.query.trim()) {
          queryParams.append('q', searchFilters.query.trim());
        }

        // Add other filters
        Object.entries(searchFilters).forEach(([key, value]) => {
          if (
            key !== 'query' &&
            value !== undefined &&
            value !== null &&
            value !== ''
          ) {
            if (value instanceof Date) {
              queryParams.append(key, value.toISOString());
            } else if (Array.isArray(value)) {
              value.forEach((item) => queryParams.append(key, item));
            } else {
              queryParams.append(key, value.toString());
            }
          }
        });

        const response = await fetch(
          `/api/communication/search/conversations?${queryParams}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setResults(data.data || []);
        setStats(data.stats);

        // Add to search history
        if (searchFilters.query.trim()) {
          addToSearchHistory(searchFilters.query.trim());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );

  // Check if advanced filters are set
  const hasAdvancedFilters = (filters: SearchFilters) => {
    return !!(
      filters.priority ||
      (filters.tags && filters.tags.length > 0) ||
      filters.startDate ||
      filters.endDate
    );
  };

  // Add to search history
  const addToSearchHistory = (query: string) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item !== query);
      return [query, ...filtered].slice(0, 10);
    });
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      query: '',
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
    setResults([]);
    setStats(null);
  };

  // Get conversation type icon
  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'direct':
        return <PersonIcon />;
      case 'group':
        return <GroupIcon />;
      case 'patient_query':
      case 'clinical_consultation':
        return <MedicalIcon />;
      default:
        return <GroupIcon />;
    }
  };

  // Get conversation type label
  const getConversationTypeLabel = (type: string) => {
    switch (type) {
      case 'direct':
        return 'Direct Message';
      case 'group':
        return 'Group Chat';
      case 'patient_query':
        return 'Patient Query';
      case 'clinical_consultation':
        return 'Clinical Consultation';
      default:
        return type;
    }
  };

  // Render conversation result
  const renderConversationResult = (
    conversation: ConversationResult,
    index: number
  ) => {
    const participantNames = conversation.participantDetails
      .slice(0, 3)
      .map((p) => `${p.firstName} ${p.lastName}`)
      .join(', ');

    const moreParticipants =
      conversation.participantDetails.length > 3
        ? ` +${conversation.participantDetails.length - 3} more`
        : '';

    return (
      <ListItem
        key={conversation._id}
        button
        onClick={() => onConversationSelect?.(conversation)}
        sx={{ alignItems: 'flex-start', py: 2 }}
      >
        <ListItemAvatar>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {getConversationIcon(conversation.type)}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                {conversation.title}
              </Typography>
              <Chip
                size="small"
                label={getConversationTypeLabel(conversation.type)}
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                label={conversation.priority}
                color={
                  conversation.priority === 'urgent'
                    ? 'error'
                    : conversation.priority === 'high'
                    ? 'warning'
                    : conversation.priority === 'low'
                    ? 'info'
                    : 'default'
                }
                variant="outlined"
              />
              <Chip
                size="small"
                label={conversation.status}
                color={
                  conversation.status === 'active'
                    ? 'success'
                    : conversation.status === 'resolved'
                    ? 'info'
                    : 'default'
                }
                variant="outlined"
              />
              {conversation.unreadCount && conversation.unreadCount > 0 && (
                <Badge
                  badgeContent={conversation.unreadCount}
                  color="primary"
                />
              )}
            </Box>
          }
          secondary={
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Participants: {participantNames}
                {moreParticipants}
              </Typography>
              {conversation.patientId && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Patient: {conversation.patientId.firstName}{' '}
                  {conversation.patientId.lastName}
                  (MRN: {conversation.patientId.mrn})
                </Typography>
              )}
              {conversation.tags.length > 0 && (
                <Box
                  sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}
                >
                  {conversation.tags.map((tag, tagIndex) => (
                    <Chip
                      key={tagIndex}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.6rem', height: 20 }}
                    />
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Last activity:{' '}
                  {format(
                    parseISO(conversation.lastMessageAt),
                    'MMM dd, yyyy HH:mm'
                  )}
                </Typography>
                {conversation.score && (
                  <Typography variant="caption" color="text.secondary">
                    • Score: {conversation.score.toFixed(2)}
                  </Typography>
                )}
              </Box>
            </Box>
          }
        />
        <IconButton>
          <ViewIcon />
        </IconButton>
      </ListItem>
    );
  };

  useEffect(() => {
    debouncedSearch(filters);
  }, [filters, debouncedSearch]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
        {/* Search Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography
            variant="h6"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
          >
            <SearchIcon />
            Conversation Search
            {stats && (
              <Badge
                badgeContent={stats.totalResults}
                color="primary"
                max={999}
              />
            )}
          </Typography>

          {/* Main Search Bar */}
          <TextField
            fullWidth
            placeholder="Search conversations... (e.g., 'patient consultation', 'medication review', 'urgent cases')"
            value={filters.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: filters.query && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => handleFilterChange('query', '')}
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {/* Quick Actions */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button
              startIcon={<FilterIcon />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              variant={showAdvancedFilters ? 'contained' : 'outlined'}
              size="small"
            >
              Advanced Filters
            </Button>
            {hasAdvancedFilters(filters) && (
              <Button
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                size="small"
                variant="outlined"
              >
                Clear All
              </Button>
            )}
          </Box>

          {/* Advanced Filters */}
          <Collapse in={showAdvancedFilters}>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Priority</InputLabel>
                      <Select
                        value={filters.priority || ''}
                        onChange={(e) =>
                          handleFilterChange('priority', e.target.value)
                        }
                        label="Priority"
                      >
                        <MenuItem value="">All Priorities</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="urgent">Urgent</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="Start Date"
                      value={filters.startDate}
                      onChange={(date) => handleFilterChange('startDate', date)}
                      slotProps={{
                        textField: { size: 'small', fullWidth: true },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="End Date"
                      value={filters.endDate}
                      onChange={(date) => handleFilterChange('endDate', date)}
                      slotProps={{
                        textField: { size: 'small', fullWidth: true },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Sort By</InputLabel>
                      <Select
                        value={filters.sortBy || 'relevance'}
                        onChange={(e) =>
                          handleFilterChange('sortBy', e.target.value)
                        }
                        label="Sort By"
                      >
                        <MenuItem value="relevance">Relevance</MenuItem>
                        <MenuItem value="date">Last Activity</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Collapse>

          {/* Search History */}
          {searchHistory.length > 0 && !filters.query && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Recent Searches
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {searchHistory.slice(0, 5).map((query, index) => (
                  <Chip
                    key={index}
                    label={query}
                    onClick={() => handleFilterChange('query', query)}
                    variant="outlined"
                    size="small"
                    icon={<HistoryIcon />}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* Results Area */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {/* Error Alert */}
          {error && (
            <Alert
              severity="error"
              sx={{ m: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Search Stats */}
          {!loading && stats && (
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                {stats.totalResults.toLocaleString()} conversations found in{' '}
                {stats.searchTime}ms
              </Typography>
            </Box>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <List>
              {results.map((result, index) => (
                <React.Fragment key={result._id}>
                  {renderConversationResult(result, index)}
                  {index < results.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}

          {/* No Results */}
          {!loading &&
            results.length === 0 &&
            (filters.query || hasAdvancedFilters(filters)) && (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography color="text.secondary" gutterBottom>
                  No conversations found matching your search criteria
                </Typography>
                <Button onClick={clearFilters} variant="outlined" size="small">
                  Clear Search
                </Button>
              </Box>
            )}

          {/* Initial State */}
          {!loading &&
            results.length === 0 &&
            !filters.query &&
            !hasAdvancedFilters(filters) && (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <SearchIcon
                  sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
                />
                <Typography color="text.secondary" gutterBottom>
                  Enter a search query to find conversations
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try searching for patient names, topics, or conversation types
                </Typography>
              </Box>
            )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default ConversationSearch;
