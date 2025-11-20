import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import {
  Search,
  Person,
  LocalPharmacy,
  MedicalServices,
  Clear,
  FilterList,
  Download,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { debounce } from 'lodash';
import { mentionNotificationService } from '../../services/mentionNotificationService';
import MentionDisplay from './MentionDisplay';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  role: 'pharmacist' | 'doctor' | 'patient';
  email?: string;
  avatar?: string;
}

interface MentionSearchResult {
  _id: string;
  conversationId: string;
  senderId: string;
  sender: User;
  content: {
    text: string;
    type: string;
  };
  mentions: string[];
  mentionedUsers: User[];
  createdAt: string;
  priority: 'normal' | 'urgent';
}

interface MentionSearchProps {
  conversationId?: string;
  onMessageClick?: (messageId: string, conversationId: string) => void;
  onUserClick?: (userId: string) => void;
  maxHeight?: string | number;
}

const MentionSearch: React.FC<MentionSearchProps> = ({
  conversationId,
  onMessageClick,
  onUserClick,
  maxHeight = '400px',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [results, setResults] = useState<MentionSearchResult[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalMentions: number;
    mentionsByUser: Record<string, number>;
  } | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string, userId: string) => {
      if (!conversationId) return;

      setLoading(true);
      setError(null);

      try {
        const searchResults =
          await mentionNotificationService.searchMessagesByMentions(
            conversationId,
            userId === 'all' ? undefined : userId,
            50
          );

        // Filter by search query if provided
        const filteredResults = query
          ? searchResults.filter(
              (result) =>
                result.content.text
                  .toLowerCase()
                  .includes(query.toLowerCase()) ||
                result.mentionedUsers.some((user) =>
                  `${user.firstName} ${user.lastName}`
                    .toLowerCase()
                    .includes(query.toLowerCase())
                )
            )
          : searchResults;

        setResults(filteredResults);
      } catch (error) {
        console.error('Error searching mentions:', error);
        setError('Failed to search mentions. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 300),
    [conversationId]
  );

  // Load mentioned users and stats
  useEffect(() => {
    if (!conversationId) return;

    const loadData = async () => {
      try {
        const [mentionedUsers, mentionStats] = await Promise.all([
          mentionNotificationService.getMentionedUsers(conversationId),
          mentionNotificationService.getMentionStats(conversationId),
        ]);

        setUsers(mentionedUsers);
        setStats(mentionStats);
      } catch (error) {
        console.error('Error loading mention data:', error);
      }
    };

    loadData();
  }, [conversationId]);

  // Trigger search when query or user filter changes
  useEffect(() => {
    debouncedSearch(searchQuery, selectedUser);
  }, [searchQuery, selectedUser, debouncedSearch]);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle user filter change
  const handleUserFilterChange = (event: any) => {
    setSelectedUser(event.target.value);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedUser('all');
  };

  // Export search results
  const handleExport = () => {
    const data = results.map((result) => ({
      messageId: result._id,
      sender: `${result.sender.firstName} ${result.sender.lastName}`,
      content: result.content.text,
      mentions: result.mentionedUsers.map(
        (u) => `${u.firstName} ${u.lastName}`
      ),
      timestamp: result.createdAt,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mentions-${conversationId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'doctor':
        return <MedicalServices />;
      case 'pharmacist':
        return <LocalPharmacy />;
      case 'patient':
        return <Person />;
      default:
        return <Person />;
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'doctor':
        return 'primary.main';
      case 'pharmacist':
        return 'secondary.main';
      case 'patient':
        return 'info.main';
      default:
        return 'grey.500';
    }
  };

  if (!conversationId) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Select a conversation to search mentions
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: maxHeight, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6">Mention Search</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Export results">
              <IconButton size="small" onClick={handleExport}>
                <Download />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear search">
              <IconButton size="small" onClick={handleClearSearch}>
                <Clear />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats */}
        {stats && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Total mentions: {stats.totalMentions}
            </Typography>
          </Box>
        )}

        {/* Search Controls */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search mentions..."
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>User</InputLabel>
            <Select
              value={selectedUser}
              label="User"
              onChange={handleUserFilterChange}
            >
              <MenuItem value="all">All Users</MenuItem>
              {users.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Results */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : results.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              p: 2,
            }}
          >
            <Search sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No mentions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery || selectedUser !== 'all'
                ? 'Try adjusting your search criteria'
                : 'No mentions in this conversation yet'}
            </Typography>
          </Box>
        ) : (
          <List>
            {results.map((result, index) => (
              <React.Fragment key={result._id}>
                <ListItem
                  button
                  onClick={() =>
                    onMessageClick?.(result._id, result.conversationId)
                  }
                  sx={{ alignItems: 'flex-start', py: 2 }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: getRoleColor(result.sender.role),
                      }}
                    >
                      {result.sender.avatar ? (
                        <img
                          src={result.sender.avatar}
                          alt={`${result.sender.firstName} ${result.sender.lastName}`}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        getRoleIcon(result.sender.role)
                      )}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">
                          {result.sender.firstName} {result.sender.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(result.createdAt), {
                            addSuffix: true,
                          })}
                        </Typography>
                        {result.priority === 'urgent' && (
                          <Chip
                            label="Urgent"
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.75rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <MentionDisplay
                          text={result.content.text}
                          mentions={result.mentions}
                          users={result.mentionedUsers}
                          variant="body2"
                          onMentionClick={onUserClick}
                          sx={{ mb: 1 }}
                        />
                        <Box
                          sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
                        >
                          {result.mentionedUsers.map((user) => (
                            <Chip
                              key={user._id}
                              label={`@${user.firstName} ${user.lastName}`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.7rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUserClick?.(user._id);
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < results.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default MentionSearch;
