import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

// Import hooks and components
import {
  useDiagnosticHistory,
  useDiagnosticAnalytics,
} from '../hooks/useDiagnostics';
import { useDiagnosticStore } from '../store/diagnosticStore';

const DiagnosticDashboardMinimal: React.FC = () => {
  // Local state
  const [searchTerm, setSearchTerm] = useState('');

  // Store state
  const { filters, setFilters } = useDiagnosticStore();

  // Memoize the history query parameters to prevent infinite loops
  const historyParams = useMemo(
    () => ({
      ...filters,
      limit: 10,
    }),
    [filters]
  );

  // API queries
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
  } = useDiagnosticHistory(historyParams);

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useDiagnosticAnalytics({
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
  });

  // Handlers
  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchTerm(value);

      // Simple immediate update without debouncing for testing
      setFilters({ search: value, page: 1 });
    },
    [setFilters]
  );

  const handleSetPending = useCallback(() => {
    setFilters({ status: 'pending' });
  }, [setFilters]);

  const handleSetCompleted = useCallback(() => {
    setFilters({ status: 'completed' });
  }, [setFilters]);

  if (historyError || analyticsError) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography color="error">
          Error loading data: {historyError?.message || analyticsError?.message}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Diagnostic Dashboard (Minimal)
      </Typography>

      <Box sx={{ mb: 4 }}>
        <TextField
          placeholder="Search cases..."
          value={searchTerm}
          onChange={handleSearch}
          size="small"
          sx={{ mr: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button onClick={handleSetPending} sx={{ mr: 1 }}>
          Pending
        </Button>
        <Button onClick={handleSetCompleted}>Completed</Button>
      </Box>

      <Box>
        <Typography variant="h6">Status:</Typography>
        <Typography>Loading: {historyLoading ? 'Yes' : 'No'}</Typography>
        <Typography>
          Analytics Loading: {analyticsLoading ? 'Yes' : 'No'}
        </Typography>
        <Typography>
          Cases: {historyData?.data?.results?.length || 0}
        </Typography>
        <Typography>Current Search: {filters.search}</Typography>
        <Typography>Current Status: {filters.status || 'All'}</Typography>
      </Box>
    </Container>
  );
};

export default DiagnosticDashboardMinimal;
