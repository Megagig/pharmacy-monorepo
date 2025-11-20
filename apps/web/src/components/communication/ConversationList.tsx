import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Fab,
  Badge,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  Search,
  FilterList,
  Add,
  Sort,
  Refresh,
  MoreVert,
} from '@mui/icons-material';
import { useCommunicationStore } from '../../stores/communicationStore';
import { useDebounce } from '../../hooks/useDebounce';
import ConversationItem from './ConversationItem';
import NewConversationModal from './NewConversationModal';
import { Conversation, ConversationFilters } from '../../stores/types';

interface ConversationListProps {
  onConversationSelect?: (conversation: Conversation) => void;
  selectedConversationId?: string;
  height?: string | number;
  showNewButton?: boolean;
  patientId?: string; // Filter by specific patient
  compact?: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({
  onConversationSelect,
  selectedConversationId,
  height = '100%',
  showNewButton = true,
  patientId,
  compact = false,
}) => {
  const {
    conversations,
    conversationFilters,
    conversationPagination,
    loading,
    errors,
    fetchConversations,
    setConversationFilters,
    clearConversationFilters,
    archiveConversation,
    resolveConversation,
    deleteConversation,
  } = useCommunicationStore();

  // Local state
  const [searchTerm, setSearchTerm] = useState(
    conversationFilters.search || ''
  );
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<
    Partial<ConversationFilters>
  >({
    type: conversationFilters.type,
    status: conversationFilters.status,
    priority: conversationFilters.priority,
  });

  // Debounced search
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Update filters when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== conversationFilters.search) {
      setConversationFilters({ search: debouncedSearchTerm, page: 1 });
    }
  }, [debouncedSearchTerm, conversationFilters.search, setConversationFilters]);

  // Apply patient filter if provided
  useEffect(() => {
    if (patientId && conversationFilters.patientId !== patientId) {
      setConversationFilters({ patientId, page: 1 });
    }
  }, [patientId, conversationFilters.patientId, setConversationFilters]);

  // Fetch conversations on mount and filter changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Filter conversations for display
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];

    // Apply local filters that aren't handled by the server
    if (
      selectedFilters.type &&
      selectedFilters.type !== conversationFilters.type
    ) {
      filtered = filtered.filter((conv) => conv.type === selectedFilters.type);
    }

    if (
      selectedFilters.status &&
      selectedFilters.status !== conversationFilters.status
    ) {
      filtered = filtered.filter(
        (conv) => conv.status === selectedFilters.status
      );
    }

    if (
      selectedFilters.priority &&
      selectedFilters.priority !== conversationFilters.priority
    ) {
      filtered = filtered.filter(
        (conv) => conv.priority === selectedFilters.priority
      );
    }

    return filtered;
  }, [conversations, selectedFilters, conversationFilters]);

  // Handle conversation selection
  const handleConversationSelect = (conversation: Conversation) => {
    onConversationSelect?.(conversation);
  };

  // Debug conversations loading (removed for performance)

  // Handle filter changes
  const handleFilterChange = (
    filterKey: keyof ConversationFilters,
    value: any
  ) => {
    const newFilters = { ...selectedFilters, [filterKey]: value };
    setSelectedFilters(newFilters);
    setConversationFilters({ ...newFilters, page: 1 });
    setFilterMenuAnchor(null);
  };

  // Handle sort changes
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setConversationFilters({ sortBy, sortOrder, page: 1 });
    setSortMenuAnchor(null);
  };

  // Handle conversation actions
  const handleConversationAction = async (
    action: string,
    conversationId: string
  ) => {
    try {
      switch (action) {
        case 'archive':
          await archiveConversation(conversationId);
          break;
        case 'resolve':
          await resolveConversation(conversationId);
          break;
        case 'delete':
          if (
            window.confirm('Are you sure you want to delete this conversation?')
          ) {
            await deleteConversation(conversationId);
          }
          break;
        default:
          console.warn('Unknown conversation action:', action);
      }
    } catch (error) {
      console.error('Failed to perform conversation action:', error);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedFilters({});
    clearConversationFilters();
    setFilterMenuAnchor(null);
  };

  // Refresh conversations
  const handleRefresh = () => {
    fetchConversations();
  };

  // Get active filter count
  const activeFilterCount =
    Object.values(selectedFilters).filter(Boolean).length;

  // Loading skeleton
  const renderSkeleton = () => (
    <Box sx={{ p: 1 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Box key={index} sx={{ mb: 1 }}>
          <Skeleton
            variant="rectangular"
            height={72}
            sx={{ borderRadius: 1 }}
          />
        </Box>
      ))}
    </Box>
  );

  return (
    <Paper
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {!compact && (
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Conversations
            </Typography>

            <Tooltip title="Refresh">
              <IconButton size="small" onClick={handleRefresh}>
                <Refresh />
              </IconButton>
            </Tooltip>

            <Tooltip title="Sort">
              <IconButton
                size="small"
                onClick={(e) => setSortMenuAnchor(e.currentTarget)}
              >
                <Sort />
              </IconButton>
            </Tooltip>

            <Tooltip title="Filter">
              <Badge badgeContent={activeFilterCount} color="primary">
                <IconButton
                  size="small"
                  onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                >
                  <FilterList />
                </IconButton>
              </Badge>
            </Tooltip>
          </Box>

          {/* Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          {/* Active Filters */}
          {activeFilterCount > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              {selectedFilters.type && (
                <Chip
                  label={`Type: ${selectedFilters.type}`}
                  size="small"
                  onDelete={() => handleFilterChange('type', undefined)}
                />
              )}
              {selectedFilters.status && (
                <Chip
                  label={`Status: ${selectedFilters.status}`}
                  size="small"
                  onDelete={() => handleFilterChange('status', undefined)}
                />
              )}
              {selectedFilters.priority && (
                <Chip
                  label={`Priority: ${selectedFilters.priority}`}
                  size="small"
                  onDelete={() => handleFilterChange('priority', undefined)}
                />
              )}
              <Chip
                label="Clear all"
                size="small"
                variant="outlined"
                onClick={handleClearFilters}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Error Display */}
      {errors.fetchConversations && (
        <Alert severity="error" sx={{ m: 1 }}>
          {errors.fetchConversations}
        </Alert>
      )}

      {/* Conversation List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading.fetchConversations ? (
          renderSkeleton()
        ) : filteredConversations.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No conversations found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || activeFilterCount > 0
                ? 'Try adjusting your search or filters'
                : 'Start a new conversation to get started'}
            </Typography>
            
            {/* Debug info */}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Debug: {conversations.length} total conversations, {filteredConversations.length} filtered
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Loading: {loading.fetchConversations ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Error: {errors.fetchConversations || 'None'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredConversations.map((conversation) => (
              <ListItem key={conversation._id} sx={{ p: 0 }}>
                <ConversationItem
                  conversation={conversation}
                  selected={conversation._id === selectedConversationId}
                  onClick={() => handleConversationSelect(conversation)}
                  onAction={handleConversationAction}
                  compact={compact}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Pagination Info */}
      {!compact && conversationPagination.total > 0 && (
        <Box
          sx={{
            p: 1,
            borderTop: 1,
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Showing {filteredConversations.length} of{' '}
            {conversationPagination.total} conversations
          </Typography>
        </Box>
      )}

      {/* New Conversation FAB */}
      {showNewButton && (
        <Fab
          color="primary"
          size="medium"
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
          }}
          onClick={() => setNewConversationOpen(true)}
        >
          <Add />
        </Fab>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        PaperProps={{ sx: { minWidth: 200 } }}
      >
        <MenuItem>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={selectedFilters.type || ''}
              label="Type"
              onChange={(e) =>
                handleFilterChange('type', e.target.value || undefined)
              }
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="direct">Direct</MenuItem>
              <MenuItem value="group">Group</MenuItem>
              <MenuItem value="patient_query">Patient Query</MenuItem>
            </Select>
          </FormControl>
        </MenuItem>

        <MenuItem>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={selectedFilters.status || ''}
              label="Status"
              onChange={(e) =>
                handleFilterChange('status', e.target.value || undefined)
              }
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </Select>
          </FormControl>
        </MenuItem>

        <MenuItem>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              value={selectedFilters.priority || ''}
              label="Priority"
              onChange={(e) =>
                handleFilterChange('priority', e.target.value || undefined)
              }
            >
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </Select>
          </FormControl>
        </MenuItem>

        <MenuItem onClick={handleClearFilters}>Clear All Filters</MenuItem>
      </Menu>

      {/* Sort Menu */}
      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={() => setSortMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleSortChange('lastMessageAt', 'desc')}>
          Latest Activity
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('createdAt', 'desc')}>
          Newest First
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('createdAt', 'asc')}>
          Oldest First
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('title', 'asc')}>
          Title A-Z
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('title', 'desc')}>
          Title Z-A
        </MenuItem>
      </Menu>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
        patientId={patientId}
      />
    </Paper>
  );
};

export default ConversationList;
