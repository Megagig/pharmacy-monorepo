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
  Autocomplete,
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
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  History as HistoryIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingIcon,
  Person as PersonIcon,
  Message as MessageIcon,
  AttachFile as AttachFileIcon,
  Mention as MentionIcon,
  Schedule as ScheduleIcon,
  Save as SaveIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, subDays } from 'date-fns';
import { debounce } from 'lodash';

interface SearchFilters {
  query: string;
  conversationId?: string;
  senderId?: string;
  participantId?: string;
  messageType?:
    | 'text'
    | 'file'
    | 'image'
    | 'clinical_note'
    | 'system'
    | 'voice_note';
  fileType?: string;
  priority?: 'normal' | 'high' | 'urgent';
  hasAttachments?: boolean;
  hasMentions?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  tags?: string[];
  sortBy?: 'relevance' | 'date' | 'sender';
  sortOrder?: 'asc' | 'desc';
}

interface SearchResult {
  message: {
    _id: string;
    content: {
      text?: string;
      type: string;
      attachments?: any[];
    };
    senderId: string;
    mentions: string[];
    priority: string;
    createdAt: string;
    sender: {
      _id: string;
      firstName: string;
      lastName: string;
      role: string;
    };
  };
  conversation: {
    _id: string;
    title: string;
    type: string;
    status: string;
  };
  highlights?: {
    content?: string;
    title?: string;
  };
  score?: number;
}

interface SearchStats {
  totalResults: number;
  searchTime: number;
  facets: {
    messageTypes: { type: string; count: number }[];
    senders: { userId: string; name: string; count: number }[];
    conversations: { conversationId: string; title: string; count: number }[];
  };
}

interface SavedSearch {
  _id: string;
  name: string;
  description?: string;
  query: string;
  filters: SearchFilters;
  searchType: 'message' | 'conversation';
  isPublic: boolean;
  lastUsed?: string;
  useCount: number;
  createdAt: string;
}

interface MessageSearchProps {
  height?: string;
  onResultSelect?: (result: SearchResult) => void;
  onConversationSelect?: (conversationId: string) => void;
  showSavedSearches?: boolean;
  showSuggestions?: boolean;
  defaultFilters?: Partial<SearchFilters>;
}

const MessageSearch: React.FC<MessageSearchProps> = ({
  height = '600px',
  onResultSelect,
  onConversationSelect,
  showSavedSearches = true,
  showSuggestions = true,
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveSearchDescription, setSaveSearchDescription] = useState('');
  const [saveAsPublic, setSaveAsPublic] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

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
          `/api/communication/search/messages?${queryParams}`,
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
      filters.conversationId ||
      filters.senderId ||
      filters.participantId ||
      filters.messageType ||
      filters.fileType ||
      filters.priority ||
      filters.hasAttachments !== undefined ||
      filters.hasMentions !== undefined ||
      filters.startDate ||
      filters.endDate ||
      (filters.tags && filters.tags.length > 0)
    );
  };

  // Add to search history
  const addToSearchHistory = (query: string) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item !== query);
      return [query, ...filtered].slice(0, 10);
    });
  };

  // Load search suggestions
  const loadSuggestions = async () => {
    try {
      const response = await fetch('/api/communication/search/suggestions', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  // Load saved searches
  const loadSavedSearches = async () => {
    try {
      const response = await fetch(
        '/api/communication/search/saved?type=message&includePublic=true',
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data.data.userSearches || []);
      }
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    }
  };

  // Save current search
  const saveCurrentSearch = async () => {
    if (!saveSearchName.trim()) return;

    try {
      const response = await fetch('/api/communication/search/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: saveSearchName.trim(),
          description: saveSearchDescription.trim() || undefined,
          query: filters.query,
          filters: {
            conversationId: filters.conversationId,
            senderId: filters.senderId,
            messageType: filters.messageType,
            priority: filters.priority,
            dateFrom: filters.startDate,
            dateTo: filters.endDate,
            tags: filters.tags,
          },
          searchType: 'message',
          isPublic: saveAsPublic,
        }),
      });

      if (response.ok) {
        setShowSaveDialog(false);
        setSaveSearchName('');
        setSaveSearchDescription('');
        setSaveAsPublic(false);
        loadSavedSearches();
      } else {
        throw new Error('Failed to save search');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save search');
    }
  };

  // Load saved search
  const loadSavedSearch = async (savedSearch: SavedSearch) => {
    try {
      // Use the saved search
      await fetch(`/api/communication/search/saved/${savedSearch._id}/use`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      // Apply the filters
      setFilters({
        ...savedSearch.filters,
        query: savedSearch.query,
      });
    } catch (err) {
      console.error('Failed to load saved search:', err);
    }
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

  // Render search result item
  const renderSearchResult = (result: SearchResult, index: number) => {
    const { message, conversation, highlights } = result;
    const sender = message.sender;

    return (
      <ListItem
        key={message._id}
        button
        onClick={() => onResultSelect?.(result)}
        sx={{ alignItems: 'flex-start', py: 2 }}
      >
        <ListItemAvatar>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {sender.firstName[0]}
            {sender.lastName[0]}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <Typography variant="subtitle2">
                {sender.firstName} {sender.lastName}
              </Typography>
              <Chip
                size="small"
                label={sender.role}
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                label={message.priority}
                color={
                  message.priority === 'urgent'
                    ? 'error'
                    : message.priority === 'high'
                    ? 'warning'
                    : 'default'
                }
                variant="outlined"
              />
              {message.content.attachments &&
                message.content.attachments.length > 0 && (
                  <AttachFileIcon
                    sx={{ fontSize: 16, color: 'text.secondary' }}
                  />
                )}
              {message.mentions.length > 0 && (
                <MentionIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              )}
            </Box>
          }
          secondary={
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
                dangerouslySetInnerHTML={{
                  __html:
                    highlights?.content ||
                    message.content.text ||
                    'No text content',
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  in {conversation.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • {format(parseISO(message.createdAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
                {result.score && (
                  <Typography variant="caption" color="text.secondary">
                    • Score: {result.score.toFixed(2)}
                  </Typography>
                )}
              </Box>
            </Box>
          }
        />
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onConversationSelect?.(conversation._id);
          }}
        >
          <ViewIcon />
        </IconButton>
      </ListItem>
    );
  };

  useEffect(() => {
    debouncedSearch(filters);
  }, [filters, debouncedSearch]);

  useEffect(() => {
    if (showSuggestions) {
      loadSuggestions();
    }
    if (showSavedSearches) {
      loadSavedSearches();
    }
  }, [showSuggestions, showSavedSearches]);

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
            Message Search
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
            placeholder="Search messages... (e.g., 'medication dosage', 'patient symptoms', 'prescription changes')"
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
            {results.length > 0 && (
              <>
                <Button
                  startIcon={<SaveIcon />}
                  onClick={() => setShowSaveDialog(true)}
                  size="small"
                  variant="outlined"
                >
                  Save Search
                </Button>
              </>
            )}
          </Box>

          {/* Advanced Filters */}
          <Collapse in={showAdvancedFilters}>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Message Type</InputLabel>
                      <Select
                        value={filters.messageType || ''}
                        onChange={(e) =>
                          handleFilterChange('messageType', e.target.value)
                        }
                        label="Message Type"
                      >
                        <MenuItem value="">All Types</MenuItem>
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="file">File</MenuItem>
                        <MenuItem value="image">Image</MenuItem>
                        <MenuItem value="clinical_note">Clinical Note</MenuItem>
                        <MenuItem value="voice_note">Voice Note</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
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
                    <FormControlLabel
                      control={
                        <Switch
                          checked={filters.hasAttachments || false}
                          onChange={(e) =>
                            handleFilterChange(
                              'hasAttachments',
                              e.target.checked
                            )
                          }
                        />
                      }
                      label="Has Attachments"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={filters.hasMentions || false}
                          onChange={(e) =>
                            handleFilterChange('hasMentions', e.target.checked)
                          }
                        />
                      }
                      label="Has Mentions"
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
                        <MenuItem value="date">Date</MenuItem>
                        <MenuItem value="sender">Sender</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Sort Order</InputLabel>
                      <Select
                        value={filters.sortOrder || 'desc'}
                        onChange={(e) =>
                          handleFilterChange('sortOrder', e.target.value)
                        }
                        label="Sort Order"
                      >
                        <MenuItem value="desc">Descending</MenuItem>
                        <MenuItem value="asc">Ascending</MenuItem>
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

        {/* Content Area */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Saved Searches Sidebar */}
          {showSavedSearches && savedSearches.length > 0 && (
            <Box
              sx={{
                width: 250,
                borderRight: 1,
                borderColor: 'divider',
                overflow: 'auto',
              }}
            >
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Saved Searches
                </Typography>
                <List dense>
                  {savedSearches.map((savedSearch) => (
                    <ListItem
                      key={savedSearch._id}
                      button
                      onClick={() => loadSavedSearch(savedSearch)}
                    >
                      <ListItemText
                        primary={savedSearch.name}
                        secondary={`${savedSearch.useCount} uses • ${format(
                          parseISO(savedSearch.createdAt),
                          'MMM dd'
                        )}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Box>
          )}

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
                  {stats.totalResults.toLocaleString()} results found in{' '}
                  {stats.searchTime}ms
                </Typography>
              </Box>
            )}

            {/* Results */}
            {!loading && results.length > 0 && (
              <List>
                {results.map((result, index) => (
                  <React.Fragment key={result.message._id}>
                    {renderSearchResult(result, index)}
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
                    No messages found matching your search criteria
                  </Typography>
                  <Button
                    onClick={clearFilters}
                    variant="outlined"
                    size="small"
                  >
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
                    Enter a search query to find messages
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try searching for medications, symptoms, or patient names
                  </Typography>
                </Box>
              )}
          </Box>
        </Box>

        {/* Save Search Dialog */}
        <Collapse in={showSaveDialog}>
          <Paper sx={{ p: 2, m: 2, border: 1, borderColor: 'divider' }}>
            <Typography variant="h6" gutterBottom>
              Save Search
            </Typography>
            <TextField
              fullWidth
              label="Search Name"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description (optional)"
              value={saveSearchDescription}
              onChange={(e) => setSaveSearchDescription(e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={saveAsPublic}
                  onChange={(e) => setSaveAsPublic(e.target.checked)}
                />
              }
              label="Share with team"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={saveCurrentSearch}
                disabled={!saveSearchName.trim()}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
            </Box>
          </Paper>
        </Collapse>
      </Box>
    </LocalizationProvider>
  );
};

export default MessageSearch;
