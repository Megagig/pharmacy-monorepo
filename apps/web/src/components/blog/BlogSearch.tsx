import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Autocomplete,
  Chip,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  TrendingUp as TrendingIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useHealthBlog } from '../../hooks/useHealthBlog';
import { useDebounce } from '../../hooks/useDebounce';

interface BlogSearchProps {
  placeholder?: string;
  showSuggestions?: boolean;
  showRecentSearches?: boolean;
  onSearch?: (query: string) => void;
  className?: string;
}

const BlogSearch: React.FC<BlogSearchProps> = ({
  placeholder = 'Search health articles...',
  showSuggestions = true,
  showRecentSearches = true,
  onSearch,
  className,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const debouncedQuery = useDebounce(query, 300);

  // Fetch search suggestions
  const { 
    data: searchResults, 
    isLoading: searchLoading 
  } = useHealthBlog.useSearchPosts(
    debouncedQuery, 
    { limit: 5 }, 
    debouncedQuery.length >= 2 && isOpen
  );

  // Fetch tags for suggestions
  const { data: tagsResponse } = useHealthBlog.useTags();
  const tags = tagsResponse?.data || [];

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('blog-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse recent searches:', error);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 5); // Keep only 5 recent searches
    
    setRecentSearches(updated);
    localStorage.setItem('blog-recent-searches', JSON.stringify(updated));
  }, [recentSearches]);

  // Handle search submission
  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    saveRecentSearch(searchQuery);
    
    const params = new URLSearchParams(searchParams);
    params.set('search', searchQuery);
    setSearchParams(params);
    
    setIsOpen(false);
    onSearch?.(searchQuery);
  }, [searchParams, setSearchParams, saveRecentSearch, onSearch]);

  // Handle input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    
    if (value.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Handle form submission
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSearch(query);
  };

  // Handle clear search
  const handleClear = () => {
    setQuery('');
    const params = new URLSearchParams(searchParams);
    params.delete('search');
    setSearchParams(params);
    setIsOpen(false);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  // Handle tag click
  const handleTagClick = (tag: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tag', tag);
    params.delete('search');
    setSearchParams(params);
    setQuery('');
    setIsOpen(false);
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('blog-recent-searches');
  };

  const searchPosts = searchResults?.data?.posts || [];
  const popularTags = tags.slice(0, 8); // Show top 8 tags

  return (
    <Box className={className} sx={{ position: 'relative' }}>
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleClear}
                  edge="end"
                  size="small"
                  aria-label="Clear search"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
            },
          }}
        />
      </form>

      {/* Search Suggestions Dropdown */}
      {isOpen && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1300,
            mt: 1,
            maxHeight: 400,
            overflow: 'auto',
            boxShadow: 3,
          }}
        >
          {/* Search Results */}
          {debouncedQuery.length >= 2 && (
            <>
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Search Results
                  {searchLoading && (
                    <CircularProgress size={16} sx={{ ml: 1 }} />
                  )}
                </Typography>
              </Box>
              
              {searchPosts.length > 0 ? (
                <List dense>
                  {searchPosts.map((post) => (
                    <ListItemButton
                      key={post._id}
                      onClick={() => navigate(`/blog/${post.slug}`)}
                      sx={{ py: 1 }}
                    >
                      <ListItemText
                        primary={post.title}
                        secondary={post.excerpt.substring(0, 100) + '...'}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: 500,
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          color: 'text.secondary',
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              ) : !searchLoading && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No articles found for "{debouncedQuery}"
                  </Typography>
                </Box>
              )}
              
              <Divider />
            </>
          )}

          {/* Recent Searches */}
          {showRecentSearches && recentSearches.length > 0 && debouncedQuery.length < 2 && (
            <>
              <Box sx={{ p: 2, pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Recent Searches
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={clearRecentSearches}
                    aria-label="Clear recent searches"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              
              <List dense>
                {recentSearches.map((search, index) => (
                  <ListItemButton
                    key={index}
                    onClick={() => handleSuggestionClick(search)}
                    sx={{ py: 0.5 }}
                  >
                    <HistoryIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                    <ListItemText
                      primary={search}
                      primaryTypographyProps={{
                        variant: 'body2',
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
              
              <Divider />
            </>
          )}

          {/* Popular Tags */}
          {showSuggestions && popularTags.length > 0 && debouncedQuery.length < 2 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                <TrendingIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                Popular Topics
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {popularTags.map((tag) => (
                  <Chip
                    key={tag.tag}
                    label={`${tag.tag} (${tag.count})`}
                    size="small"
                    variant="outlined"
                    onClick={() => handleTagClick(tag.tag)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* No content message */}
          {debouncedQuery.length < 2 && recentSearches.length === 0 && popularTags.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Start typing to search articles...
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1200,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </Box>
  );
};

export default BlogSearch;