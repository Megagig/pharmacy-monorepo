import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useDebounce } from '../../hooks/useDebounce';
import publicApiClient from '../../services/publicApiClient';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/common/ThemeToggle';
import WorkspaceSelectionCard, { WorkspaceCardData } from '../../components/patient-portal/WorkspaceSelectionCard';

interface Workspace extends WorkspaceCardData { }

const WorkspaceSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedLGA, setSelectedLGA] = useState<string>('');
  const [states, setStates] = useState<string[]>([]);
  const [lgas, setLGAs] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const menuItems = [
    { label: 'Home', path: '/patient-access' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
    { label: 'Blog', path: '/blog' },
  ];

  // Fetch states on mount
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await publicApiClient.get('/public/workspaces/states');
        if (response.data.success) {
          setStates(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch states:', err);
      }
    };
    fetchStates();
  }, []);

  // Fetch LGAs when state changes
  useEffect(() => {
    const fetchLGAs = async () => {
      if (!selectedState) {
        setLGAs([]);
        return;
      }

      try {
        const response = await publicApiClient.get(`/public/workspaces/lgas/${selectedState}`);
        if (response.data.success) {
          setLGAs(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch LGAs:', err);
        setLGAs([]);
      }
    };
    fetchLGAs();
  }, [selectedState]);

  // Search workspaces
  useEffect(() => {
    const searchWorkspaces = async () => {
      // Only search if we have a query or filters
      if (!debouncedSearchQuery && !selectedState && !selectedLGA) {
        setWorkspaces([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params: any = {};
        if (debouncedSearchQuery && debouncedSearchQuery.trim().length >= 2) {
          params.query = debouncedSearchQuery;
        }
        if (selectedState) {
          params.state = selectedState;
        }
        if (selectedLGA) {
          params.lga = selectedLGA;
        }

        const response = await publicApiClient.get('/public/workspaces/search', {
          params,
        });

        if (response.data.success) {
          setWorkspaces(response.data.data.workspaces || []);
        } else {
          setError(response.data.message || 'Failed to search workspaces');
        }
      } catch (err: any) {
        console.error('Workspace search error:', err);
        setError(
          err.response?.data?.message ||
          'Failed to search workspaces. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    searchWorkspaces();
  }, [debouncedSearchQuery, selectedState, selectedLGA]);

  const handleWorkspaceRegister = (workspace: Workspace) => {
    // Store the selected workspace in sessionStorage
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    // Navigate to registration page
    navigate(`/patient-auth/${workspace.workspaceId}/register`, {
      state: { workspaceInfo: workspace },
    });
  };

  const handleWorkspaceLogin = (workspace: Workspace) => {
    // Store the selected workspace in sessionStorage
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    // Navigate to login page
    navigate(`/patient-auth/${workspace.workspaceId}/login`, {
      state: { workspaceInfo: workspace },
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedState('');
    setSelectedLGA('');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Navigation */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ py: 1 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'primary.main',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1.5,
              }}
            >
              <LocalPharmacyIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: 'text.primary' }}
            >
              PharmaCare
            </Typography>
          </Box>

          {/* Desktop Navigation */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Button component={Link} to="/patient-access" color="inherit">
              Home
            </Button>
            <Button component={Link} to="/about" color="inherit">
              About
            </Button>
            <Button component={Link} to="/contact" color="inherit">
              Contact
            </Button>
            <Button component={Link} to="/blog" color="inherit">
              Blog
            </Button>
            <ThemeToggle size="sm" variant="button" />
          </Box>

          {/* Mobile Navigation */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ThemeToggle size="sm" variant="button" />
            <IconButton
              edge="end"
              color="inherit"
              aria-label="menu"
              onClick={toggleMobileMenu}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Drawer Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1,
                }}
              >
                <LocalPharmacyIcon sx={{ color: 'white', fontSize: 20 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                PharmaCare
              </Typography>
            </Box>
            <IconButton onClick={closeMobileMenu}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Menu Items */}
          <List>
            {menuItems.map((item, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  onClick={closeMobileMenu}
                  sx={{
                    py: 1.5,
                    borderRadius: 1,
                    mb: 0.5,
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  }}
                >
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        {/* Back Button */}
        <Button
          component={Link}
          to="/patient-access"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 4 }}
        >
          Back to Home
        </Button>

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontWeight: 700, mb: 2 }}
          >
            Find Your Pharmacy
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ maxWidth: '700px', mx: 'auto', mb: 4 }}
          >
            Search for your pharmacy or healthcare workspace to create an account
            or sign in to your patient portal
          </Typography>

          {/* Search Input */}
          <TextField
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pharmacy name, location, or type (e.g., 'Lagos', 'HealthCare Pharmacy', 'Hospital')..."
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              maxWidth: '700px',
              mx: 'auto',
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                bgcolor: 'background.paper',
              },
            }}
          />

          {/* Filters */}
          <Box
            sx={{
              maxWidth: '700px',
              mx: 'auto',
              mt: 3,
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <FormControl sx={{ minWidth: 200, flex: 1 }}>
              <InputLabel>State</InputLabel>
              <Select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedLGA(''); // Reset LGA when state changes
                }}
                label="State"
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">
                  <em>All States</em>
                </MenuItem>
                {states.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 200, flex: 1 }} disabled={!selectedState}>
              <InputLabel>LGA</InputLabel>
              <Select
                value={selectedLGA}
                onChange={(e) => setSelectedLGA(e.target.value)}
                label="LGA"
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">
                  <em>All LGAs</em>
                </MenuItem>
                {lgas.map((lga) => (
                  <MenuItem key={lga} value={lga}>
                    {lga}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {(searchQuery || selectedState || selectedLGA) && (
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                onClick={handleClearFilters}
                sx={{ borderRadius: 2, minWidth: 120 }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </Box>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {/* Search Prompt */}
        {!loading && !error && !searchQuery && !selectedState && !selectedLGA && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LocalPharmacyIcon
              sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary">
              Start searching for your pharmacy
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Use the search box or filters above to find pharmacies near you
            </Typography>
          </Box>
        )}

        {/* No Results */}
        {!loading &&
          !error &&
          (searchQuery.trim().length >= 2 || selectedState || selectedLGA) &&
          workspaces.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <SearchIcon
                sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary">
                No pharmacies found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Try adjusting your search criteria or filters
              </Typography>
            </Box>
          )}

        {/* Results */}
        {!loading && !error && workspaces.length > 0 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Found {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedState && `in ${selectedState}`}
                {selectedLGA && `, ${selectedLGA}`}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {workspaces.map((workspace) => (
                <Grid item xs={12} md={6} key={workspace.id}>
                  <WorkspaceSelectionCard
                    workspace={workspace}
                    onRegister={handleWorkspaceRegister}
                    onLogin={handleWorkspaceLogin}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Container>

      {/* Footer */}
      <Footer />
    </Box>
  );
};

export default WorkspaceSearchPage;
