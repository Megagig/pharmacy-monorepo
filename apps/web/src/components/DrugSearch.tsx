import React, { useState, useMemo, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useDrugSearch } from '../queries/drugQueries';
import { useDrugStore } from '../stores/drugStore';
import {
  Box,
  TextField,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
  Paper,
  InputAdornment,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LoadingSkeleton from './LoadingSkeleton';

interface DrugConcept {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string;
}

interface DrugSearchProps {
  onDrugSelect?: () => void;
}

const DrugSearch: React.FC<DrugSearchProps> = ({ onDrugSelect }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce<string>(searchTerm, 300);
  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useDrugSearch(debouncedSearchTerm, debouncedSearchTerm.length > 2);
  const { setSelectedDrug, setSearchError } = useDrugStore();

  // Report any errors to the global state and console log for debugging
  useEffect(() => {
    if (error) {
      console.error('Drug search error:', error);
      setSearchError((error as Error).message || 'Failed to search drugs');
    } else {
      setSearchError(null);
    }

    // Debug: Log search results



    if (searchResults && typeof searchResults === 'object') {

      // Check for success property
      if ('success' in searchResults) {

      }

      // Check for data property
      if ('data' in searchResults && searchResults.data) {


        // Check for drugGroup
        if (searchResults.data.drugGroup) {
          // Check for conceptGroup
          if (searchResults.data.drugGroup.conceptGroup) {
            // Concept group exists
          }
        }
      }
    }

  }, [error, searchResults, isLoading, debouncedSearchTerm, setSearchError]);

  // Extract drug concepts from search results
  const drugConcepts = useMemo(() => {
    if (!searchResults?.data?.drugGroup?.conceptGroup) return [];

    const concepts: DrugConcept[] = [];
    searchResults.data.drugGroup.conceptGroup.forEach((group) => {
      if (group.conceptProperties) {
        concepts.push(...group.conceptProperties);
      }
    });

    return concepts;
  }, [searchResults]);

  const handleDrugSelect = (drug: DrugConcept) => {
    setSelectedDrug({
      rxCui: drug.rxcui,
      name: drug.name,
    });

    if (onDrugSelect) {
      onDrugSelect();
    }
  };

  // Handle retry on error
  const handleRetry = () => {
    if (debouncedSearchTerm.length > 2) {
      refetch();
    }
  };

  // Show skeleton loader when searching
  if (isLoading && debouncedSearchTerm.length > 2) {
    return <LoadingSkeleton type="search" />;
  }

  return (
    <Box className="drug-search">
      {/* Debug info */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search for medications by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="primary" />
            </InputAdornment>
          ),
          endAdornment: isLoading && (
            <InputAdornment position="end">
              <CircularProgress size={20} color="primary" />
            </InputAdornment>
          ),
        }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            '&:hover fieldset': {
              borderColor:
                theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
            },
            '&.Mui-focused fieldset': {
              borderColor:
                theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
              borderWidth: 2,
            },
          },
        }}
      />

      {error && (
        <Box
          sx={{
            mb: 3,
            p: 1,
            borderRadius: '8px',
            bgcolor: theme.palette.mode === 'dark' ? '#4c1d1d' : '#fff0f0',
            border: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? '#dc2626' : '#ffcccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography color="error">
            Error: {(error as Error).message || 'Failed to search drugs'}
          </Typography>
          <Typography
            component="button"
            onClick={handleRetry}
            sx={{
              cursor: 'pointer',
              color: theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
              fontWeight: 500,
              fontSize: '0.875rem',
              textDecoration: 'underline',
              border: 'none',
              background: 'none',
              '&:hover': {
                color: theme.palette.mode === 'dark' ? '#5bb0d4' : '#002D69',
              },
            }}
          >
            Retry
          </Typography>
        </Box>
      )}

      {debouncedSearchTerm.length > 2 && drugConcepts.length > 0 && (
        <Paper
          elevation={2}
          sx={{
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #e0e0e0',
          }}
        >
          <List sx={{ maxHeight: '350px', overflow: 'auto' }}>
            {drugConcepts.map((drug) => (
              <ListItem
                key={drug.rxcui}
                onClick={() => handleDrugSelect(drug)}
                sx={{
                  borderBottom: '1px solid #f0f0f0',
                  '&:last-child': { border: 'none' },
                  '&:hover': {
                    bgcolor:
                      theme.palette.mode === 'dark' ? '#374151' : '#f5f9ff',
                    cursor: 'pointer',
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography component="span" fontWeight={500}>
                      {drug.name}
                    </Typography>
                  }
                  secondary={
                    drug.synonym ? `Also known as: ${drug.synonym}` : ''
                  }
                />
                {drug.tty && (
                  <Box
                    component="span"
                    sx={{
                      ml: 2,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color:
                        theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
                      bgcolor:
                        theme.palette.mode === 'dark' ? '#374151' : '#f0f7ff',
                      border: '1px solid',
                      borderColor:
                        theme.palette.mode === 'dark' ? '#4b5563' : '#d0e4ff',
                    }}
                  >
                    {drug.tty}
                  </Box>
                )}
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {debouncedSearchTerm.length > 2 &&
        drugConcepts.length === 0 &&
        !isLoading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f9fbff',
              borderRadius: '8px',
            }}
          >
            <SearchIcon
              sx={{
                fontSize: '2rem',
                color: theme.palette.mode === 'dark' ? '#6b7280' : '#9e9e9e',
                mb: 1,
              }}
            />
            <Typography color="text.secondary" align="center">
              No medications found matching "{debouncedSearchTerm}"
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mt: 1 }}
            >
              Try using a different spelling or search term
            </Typography>
          </Box>
        )}
    </Box>
  );
};

export default DrugSearch;
