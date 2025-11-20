import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PharmacyIcon from '@mui/icons-material/LocalPharmacy';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { useWorkspaceSearch, Workspace } from '../../hooks/useWorkspaceSearch';

interface WorkspaceSearchProps {
  onWorkspaceSelect?: (workspace: Workspace) => void;
  showSelectButton?: boolean;
  maxResults?: number;
}

const WorkspaceSearch: React.FC<WorkspaceSearchProps> = ({
  onWorkspaceSelect,
  showSelectButton = true,
  maxResults = 10,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Use workspace search hook
  const { loading, error, searchWorkspaces, getAvailableStates } = useWorkspaceSearch();

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string, state: string) => {
      if (!query.trim() && !state) {
        setWorkspaces([]);
        setHasSearched(false);
        return;
      }

      const result = await searchWorkspaces({
        search: query.trim() || undefined,
        state: state || undefined,
        limit: maxResults,
      });

      if (result) {
        setWorkspaces(result.workspaces);
      } else {
        setWorkspaces([]);
      }
      setHasSearched(true);
    }, 500),
    [searchWorkspaces, maxResults]
  );

  // Load available states on component mount
  useEffect(() => {
    const loadStates = async () => {
      const availableStates = await getAvailableStates();
      setStates(availableStates);
    };

    loadStates();
  }, [getAvailableStates]);

  // Trigger search when query or state changes
  useEffect(() => {
    debouncedSearch(searchQuery, selectedState);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, selectedState, debouncedSearch]);

  const handleWorkspaceSelect = (workspace: Workspace) => {
    if (onWorkspaceSelect) {
      onWorkspaceSelect(workspace);
    } else {
      // Default behavior: navigate to registration
      navigate(`/patient-auth/${workspace._id}/register`, {
        state: { workspaceInfo: workspace }
      });
    }
  };

  const getWorkspaceTypeColor = (type: string) => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' } = {
      Community: 'primary',
      Hospital: 'error',
      Academia: 'info',
      Industry: 'warning',
      'Regulatory Body': 'secondary',
      Other: 'success',
    };
    return colors[type] || 'primary';
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Search Controls */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          <Box sx={{ flex: { xs: '1', md: '0 0 58%' } }}>
            <TextField
              fullWidth
              placeholder="Search by pharmacy name, location, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  backgroundColor: theme.palette.background.paper,
                  height: '56px', // Match Select height
                },
              }}
            />
          </Box>
          <Box sx={{ flex: { xs: '1', md: '0 0 40%' } }}>
            <FormControl fullWidth>
              <InputLabel>Filter by State</InputLabel>
              <Select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                label="Filter by State"
                startAdornment={
                  <InputAdornment position="start">
                    <LocationIcon color="action" sx={{ ml: 1 }} />
                  </InputAdornment>
                }
                sx={{
                  borderRadius: 3,
                  backgroundColor: theme.palette.background.paper,
                  height: '56px',
                  '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    py: 1.75,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '1.5px',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.primary.main,
                  },
                }}
              >
                <MenuItem value="">All States</MenuItem>
                {states.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* No Results */}
      {hasSearched && !loading && workspaces.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <PharmacyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No pharmacies found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search terms or location filter
          </Typography>
        </Box>
      )}

      {/* Search Results */}
      {workspaces.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3, color: 'text.primary' }}>
            Found {workspaces.length} pharmacy{workspaces.length !== 1 ? 'ies' : ''}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {workspaces.map((workspace) => (
              <Box key={workspace._id}>
                <Card
                  sx={{
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[8],
                    },
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      {/* Logo */}
                      <Avatar
                        src={workspace.logoUrl}
                        sx={{
                          width: 64,
                          height: 64,
                          bgcolor: 'primary.light',
                          fontSize: '1.5rem',
                          fontWeight: 600,
                        }}
                      >
                        {workspace.name.charAt(0)}
                      </Avatar>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {workspace.name}
                            </Typography>
                            <Chip
                              label={workspace.type}
                              color={getWorkspaceTypeColor(workspace.type)}
                              size="small"
                              sx={{ mb: 1 }}
                            />
                          </Box>
                          {showSelectButton && (
                            <Button
                              variant="contained"
                              endIcon={<ArrowForwardIcon />}
                              onClick={() => handleWorkspaceSelect(workspace)}
                              sx={{ borderRadius: 2 }}
                            >
                              Select This Pharmacy
                            </Button>
                          )}
                        </Box>

                        {/* Location */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {workspace.address}
                            {workspace.lga && `, ${workspace.lga}`}
                            {workspace.state && `, ${workspace.state}`}
                          </Typography>
                        </Box>

                        {/* Contact Info */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                          {workspace.phone && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {workspace.phone}
                              </Typography>
                            </Box>
                          )}
                          {workspace.email && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {workspace.email}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Operating Hours */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {workspace.operatingHours}
                          </Typography>
                        </Box>

                        {/* Services */}
                        {workspace.services && workspace.services.length > 0 && (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                              Services:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {workspace.services.slice(0, 3).map((service, index) => (
                                <Chip
                                  key={index}
                                  label={service}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              ))}
                              {workspace.services.length > 3 && (
                                <Chip
                                  label={`+${workspace.services.length - 3} more`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              )}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Initial State */}
      {!hasSearched && !loading && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Find Your Pharmacy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Search by name, location, or type to find your preferred pharmacy
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default WorkspaceSearch;