import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  InputAdornment,
  useTheme,
  Grid,
  Paper,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocalHospital as PharmacyIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  AccessTime as HoursIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import publicApiClient from '../services/publicApiClient';

interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  description: string;
  state?: string;
  lga?: string;
  logoUrl?: string;
}

/**
 * Public Patient Portal Landing Page
 * Allows patients to find and access their pharmacy's patient portal
 */
const PublicPatientPortal: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a pharmacy, clinic, or hospital name or location to search');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      const response = await publicApiClient.get('/public/workspaces/search', {
        params: {
          query: searchQuery,
        },
      });

      const data = response.data;

      if (data.success) {
        setSearchResults(data.data.workspaces);

        if (data.data.workspaces.length === 0) {
          setError('No pharmacy, clinic, or hospital found matching your search. Please try a different search term.');
        }
      } else {
        setError(data.message || 'Search failed');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred while searching. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAccessPortal = (workspace: Workspace) => {
    // Navigate to workspace-specific patient authentication
    navigate(`/patient-auth/${workspace.workspaceId}`, {
      state: { workspaceInfo: workspace }
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <PharmacyIcon
              sx={{
                fontSize: 60,
                color: 'white',
                mr: 2,
              }}
            />
            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              Patient Portal
            </Typography>
          </Box>
          <Typography
            variant="h5"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              mb: 2,
              fontWeight: 300,
            }}
          >
            Access your pharmacy's patient portal
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255,255,255,0.8)',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Book appointments, manage prescriptions, and stay connected with your healthcare provider
          </Typography>
        </Box>

        {/* Search Section */}
        <Card
          sx={{
            mb: 4,
            borderRadius: 4,
            boxShadow: theme.shadows[8],
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, textAlign: 'center' }}>
              Find Your Pharmacy
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Search by name or location (e.g., 'Lagos', 'HealthCare Pharmacy', 'Hospital')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
              <Button
                variant="contained"
                size="large"
                onClick={handleSearch}
                disabled={loading}
                sx={{
                  px: 4,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Found {searchResults.length} workspace{searchResults.length !== 1 ? 's' : ''}
                </Typography>

                <Grid container spacing={3}>
                  {searchResults.map((workspace) => (
                    <Grid item xs={12} md={6} key={workspace.id}>
                      <Paper
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          border: `1px solid ${theme.palette.divider}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: theme.shadows[4],
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                          <PharmacyIcon
                            sx={{
                              fontSize: 40,
                              color: theme.palette.primary.main,
                              mr: 2,
                              mt: 0.5,
                            }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                              {workspace.name}
                            </Typography>
                            <Typography variant="body2" color="primary.main" sx={{ mb: 1, fontWeight: 500 }}>
                              {workspace.type}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {workspace.description}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ mb: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <LocationIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {workspace.address}{workspace.state && `, ${workspace.state}`}
                            </Typography>
                          </Box>
                          {workspace.phone && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <PhoneIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {workspace.phone}
                              </Typography>
                            </Box>
                          )}
                          {workspace.email && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <EmailIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {workspace.email}
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <HoursIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {workspace.hours}
                            </Typography>
                          </Box>
                        </Box>

                        <Button
                          fullWidth
                          variant="contained"
                          size="large"
                          onClick={() => handleAccessPortal(workspace)}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                          }}
                        >
                          Access Patient Portal
                        </Button>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Information Section */}
        <Card
          sx={{
            borderRadius: 4,
            boxShadow: theme.shadows[8],
            background: 'rgba(255,255,255,0.95)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, textAlign: 'center' }}>
              What You Can Do in the Patient Portal
            </Typography>

            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <PharmacyIcon sx={{ fontSize: 40, color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    Book Appointments
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Schedule consultations, medication reviews, and follow-up appointments online
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <EmailIcon sx={{ fontSize: 40, color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    Manage Prescriptions
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View your medication history, request refills, and receive reminders
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <HoursIcon sx={{ fontSize: 40, color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    Stay Connected
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Receive appointment reminders, health tips, and important updates
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Footer */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Powered by PharmacyCopilot - Enhancing Patient Care Through Technology
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default PublicPatientPortal;