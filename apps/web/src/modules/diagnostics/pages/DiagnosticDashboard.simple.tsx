import React, { useState, useCallback } from 'react';
import { Box, Container, Typography, Button, TextField } from '@mui/material';

// Import hooks and components
import { useDiagnosticStore } from '../store/diagnosticStore';

const DiagnosticDashboardSimple: React.FC = () => {
  // Local state
  const [searchTerm, setSearchTerm] = useState('');

  // Store state - ONLY get what we need
  const filters = useDiagnosticStore((state) => state.filters);
  const setFilters = useDiagnosticStore((state) => state.setFilters);

  // Simple handlers without any complex logic
  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchTerm(value);

      // Direct call without debouncing for testing
      setFilters({ search: value });
    },
    [setFilters]
  );

  const handleSetPending = useCallback(() => {
    setFilters({ status: 'pending' });
  }, [setFilters]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Simple Dashboard Test
      </Typography>

      <Box sx={{ mb: 4 }}>
        <TextField
          placeholder="Search..."
          value={searchTerm}
          onChange={handleSearch}
          size="small"
          sx={{ mr: 2 }}
        />
        <Button onClick={handleSetPending}>Set Pending</Button>
      </Box>

      <Box>
        <Typography>Current Search: "{filters.search}"</Typography>
        <Typography>Current Status: {filters.status || 'All'}</Typography>
        <Typography>Search Term State: "{searchTerm}"</Typography>
      </Box>
    </Container>
  );
};

export default DiagnosticDashboardSimple;
