import React, { useState } from 'react';
import { Box, Paper, Tabs, Tab, Typography, useTheme } from '@mui/material';
import {
  Search as SearchIcon,
  Message as MessageIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import MessageSearch from './MessageSearch';
import ConversationSearch from './ConversationSearch';

interface SearchInterfaceProps {
  height?: string;
  defaultTab?: 'messages' | 'conversations';
  onMessageSelect?: (result: any) => void;
  onConversationSelect?: (conversation: any) => void;
  showSavedSearches?: boolean;
  showSuggestions?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({
  children,
  value,
  index,
  ...other
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`search-tabpanel-${index}`}
      aria-labelledby={`search-tab-${index}`}
      {...other}
      style={{ height: '100%' }}
    >
      {value === index && <Box sx={{ height: '100%' }}>{children}</Box>}
    </div>
  );
};

const SearchInterface: React.FC<SearchInterfaceProps> = ({
  height = '600px',
  defaultTab = 'messages',
  onMessageSelect,
  onConversationSelect,
  showSavedSearches = true,
  showSuggestions = true,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(defaultTab === 'messages' ? 0 : 1);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleMessageResultSelect = (result: any) => {
    onMessageSelect?.(result);
    // Also navigate to the conversation if callback is provided
    if (onConversationSelect) {
      onConversationSelect(result.conversation._id);
    }
  };

  return (
    <Paper
      elevation={1}
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header with Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ p: 2, pb: 0 }}>
          <Typography
            variant="h5"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
              fontWeight: 'medium',
            }}
          >
            <SearchIcon />
            Communication Search
          </Typography>
        </Box>

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="search tabs"
          sx={{ px: 2 }}
        >
          <Tab
            icon={<MessageIcon />}
            label="Messages"
            id="search-tab-0"
            aria-controls="search-tabpanel-0"
            sx={{
              minHeight: 48,
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 'medium',
            }}
          />
          <Tab
            icon={<ChatIcon />}
            label="Conversations"
            id="search-tab-1"
            aria-controls="search-tabpanel-1"
            sx={{
              minHeight: 48,
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 'medium',
            }}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TabPanel value={activeTab} index={0}>
          <MessageSearch
            height="100%"
            onResultSelect={handleMessageResultSelect}
            onConversationSelect={onConversationSelect}
            showSavedSearches={showSavedSearches}
            showSuggestions={showSuggestions}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <ConversationSearch
            height="100%"
            onConversationSelect={onConversationSelect}
            showSavedSearches={showSavedSearches}
          />
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default SearchInterface;
