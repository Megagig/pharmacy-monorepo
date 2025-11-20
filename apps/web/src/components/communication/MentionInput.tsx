import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  TextField,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Person, LocalPharmacy, MedicalServices } from '@mui/icons-material';
import { debounce } from 'lodash';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  role: 'pharmacist' | 'doctor' | 'patient';
  email?: string;
  avatar?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  onKeyPress?: (event: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  maxRows?: number;
  conversationId?: string;
  patientId?: string;
  autoFocus?: boolean;
}

interface MentionSuggestion extends User {
  displayName: string;
  subtitle: string;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyPress,
  placeholder = 'Type a message...',
  disabled = false,
  multiline = true,
  maxRows = 4,
  conversationId,
  patientId,
  autoFocus = false,
}) => {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [mentions, setMentions] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch user suggestions from API
        const response = await fetch(
          `/api/mentions/conversations/${conversationId}/suggestions?query=${encodeURIComponent(
            query
          )}&limit=10`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch suggestions: ${response.statusText}`
          );
        }

        const data = await response.json();
        setSuggestions(data.data || []);
      } catch (error) {
        console.error('Error fetching user suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [conversationId, patientId]
  );

  // Parse mentions from text
  const parseMentions = useCallback((text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const foundMentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      foundMentions.push(match[2]); // Extract user ID
    }

    return foundMentions;
  }, []);

  // Handle input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    const cursorPosition = event.target.selectionStart || 0;

    // Check for @ symbol
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // Check if we're in a mention (no spaces after @)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowSuggestions(true);
        setSelectedIndex(0);
        debouncedSearch(textAfterAt);
      } else {
        setShowSuggestions(false);
        setMentionStart(-1);
        setMentionQuery('');
      }
    } else {
      setShowSuggestions(false);
      setMentionStart(-1);
      setMentionQuery('');
    }

    // Parse mentions and update state
    const newMentions = parseMentions(newValue);
    setMentions(newMentions);
    onChange(newValue, newMentions);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: MentionSuggestion) => {
    if (mentionStart === -1) return;

    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(
      mentionStart + mentionQuery.length + 1
    );
    const mentionText = `@[${suggestion.displayName}](${suggestion._id})`;
    const newValue = beforeMention + mentionText + afterMention;

    const newMentions = parseMentions(newValue);
    setMentions(newMentions);
    onChange(newValue, newMentions);

    setShowSuggestions(false);
    setMentionStart(-1);
    setMentionQuery('');

    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPosition = beforeMention.length + mentionText.length;
      inputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          if (suggestions[selectedIndex]) {
            event.preventDefault();
            selectSuggestion(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setShowSuggestions(false);
          break;
      }
    }

    // Pass through other key events
    if (onKeyPress && event.key === 'Enter' && !showSuggestions) {
      onKeyPress(event);
    }
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

  // Render text with highlighted mentions
  const renderTextWithMentions = (text: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add mention chip
      parts.push(
        <Chip
          key={match.index}
          label={match[1]}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ mx: 0.5, height: 20, fontSize: '0.75rem' }}
        />
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        ref={inputRef}
        fullWidth
        multiline={multiline}
        maxRows={maxRows}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        variant="outlined"
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />

      {/* Mention Suggestions */}
      {showSuggestions && (
        <Paper
          ref={suggestionsRef}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 200,
            overflow: 'auto',
            mt: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <CircularProgress size={20} />
              <Typography variant="caption" sx={{ ml: 1 }}>
                Searching users...
              </Typography>
            </Box>
          ) : suggestions.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No users found for "{mentionQuery}"
              </Typography>
            </Box>
          ) : (
            <List dense>
              {suggestions.map((suggestion, index) => (
                <ListItem
                  key={suggestion._id}
                  button
                  selected={index === selectedIndex}
                  onClick={() => selectSuggestion(suggestion)}
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: getRoleColor(suggestion.role),
                        width: 32,
                        height: 32,
                      }}
                    >
                      {suggestion.avatar ? (
                        <img
                          src={suggestion.avatar}
                          alt={suggestion.displayName}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        getRoleIcon(suggestion.role)
                      )}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight="medium">
                        {suggestion.displayName}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {suggestion.subtitle}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default MentionInput;
