import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
} from '@mui/material';

// Completely isolated component without any external hooks
const DiagnosticDashboardIsolated: React.FC = () => {
  // Only local state
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<string>('all');

  // Simple handlers
  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchTerm(value);
    },
    []
  );

  const handleSetPending = useCallback(() => {
    setStatus('pending');
  }, []);

  const handleSetCompleted = useCallback(() => {
    setStatus('completed');
  }, []);

  const handleSetAll = useCallback(() => {
    setStatus('all');
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Isolated Dashboard Test
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearch}
              size="small"
              sx={{ mr: 2 }}
            />
            <Button onClick={handleSetPending} sx={{ mr: 1 }}>
              Pending
            </Button>
            <Button onClick={handleSetCompleted} sx={{ mr: 1 }}>
              Completed
            </Button>
            <Button onClick={handleSetAll}>All</Button>
          </Box>

          <Box>
            <Typography>Search Term: "{searchTerm}"</Typography>
            <Typography>Status: {status}</Typography>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6">
        If you can see this without infinite loop errors, the issue is with the
        hooks or store.
      </Typography>
    </Container>
  );
};

export default DiagnosticDashboardIsolated;
