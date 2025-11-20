import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Avatar,
  Stack,
  Divider,
  Paper,
  IconButton,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PersonAdd as PersonAddIcon,
  Login as LoginIcon,
  LocalPharmacy as LocalPharmacyIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import publicApiClient from '../../services/publicApiClient';
import ThemeToggle from '../../components/common/ThemeToggle';

interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  lga: string;
  logoUrl?: string;
  description?: string;
  hours?: string;
}

const PatientWorkspaceDetailPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  // Load workspace from sessionStorage if available
  useEffect(() => {
    const stored = sessionStorage.getItem('selectedWorkspace');
    if (stored) {
      setWorkspace(JSON.parse(stored));
    }
  }, []);

  // Fetch workspace details if not in storage
  const { data, isLoading } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => {
      const response = await publicApiClient.get(`/public/workspaces/${workspaceId}`);
      return response.data.data;
    },
    enabled: !workspace && !!workspaceId,
  });

  // Update workspace when data is fetched
  useEffect(() => {
    if (data) {
      setWorkspace(data);
    }
  }, [data]);

  const handleRegister = () => {
    if (workspace) {
      // Navigate to patient registration with pre-selected workspace
      navigate(`/patient-portal/register?workspace=${workspace.workspaceId}&name=${encodeURIComponent(workspace.name)}`);
    }
  };

  const handleLogin = () => {
    if (workspace) {
      // Navigate to patient login with pre-selected workspace
      navigate(`/patient-portal/login?workspace=${workspace.workspaceId}&name=${encodeURIComponent(workspace.name)}`);
    }
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!workspace) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography>Workspace not found</Typography>
      </Box>
    );
  }

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

          <ThemeToggle size="sm" variant="button" />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
        {/* Back Button */}
        <Button
          component={Link}
          to="/patient-portal/search"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 4 }}
        >
          Back to Search
        </Button>

        {/* Workspace Details Card */}
        <Card
          elevation={3}
          sx={{
            mb: 4,
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
              <Avatar
                src={workspace.logoUrl}
                sx={{
                  width: 100,
                  height: 100,
                  bgcolor: 'primary.main',
                  fontSize: '2.5rem',
                }}
              >
                {workspace.name.charAt(0)}
              </Avatar>

              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                  {workspace.name}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  paragraph
                >
                  {workspace.type}
                </Typography>
                {workspace.description && (
                  <Typography variant="body2" color="text.secondary">
                    {workspace.description}
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Stack spacing={2}>
              {workspace.address && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <LocationIcon color="action" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Address
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {workspace.address}
                      {workspace.state && `, ${workspace.state}`}
                      {workspace.lga && ` (${workspace.lga})`}
                    </Typography>
                  </Box>
                </Box>
              )}

              {workspace.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PhoneIcon color="action" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Phone
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {workspace.phone}
                    </Typography>
                  </Box>
                </Box>
              )}

              {workspace.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <EmailIcon color="action" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Email
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {workspace.email}
                    </Typography>
                  </Box>
                </Box>
              )}

              {workspace.hours && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ScheduleIcon color="action" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Business Hours
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {workspace.hours}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Action Cards */}
        <Typography
          variant="h5"
          component="h2"
          align="center"
          sx={{ mb: 3, fontWeight: 600 }}
        >
          Get Started
        </Typography>

        <Grid container spacing={3}>
          {/* Register Card */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={2}
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <PersonAddIcon
                sx={{ fontSize: 64, color: 'primary.main', mb: 2 }}
              />
              <Typography variant="h5" gutterBottom>
                New Patient?
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3, flex: 1 }}
              >
                Create a new account to access your patient portal, book
                appointments, and manage your prescriptions.
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<PersonAddIcon />}
                onClick={handleRegister}
                sx={{ borderRadius: 2, py: 1.5 }}
              >
                Create Account
              </Button>
            </Paper>
          </Grid>

          {/* Login Card */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={2}
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <LoginIcon
                sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }}
              />
              <Typography variant="h5" gutterBottom>
                Returning Patient?
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3, flex: 1 }}
              >
                Sign in to your existing account to view your health records,
                manage appointments, and communicate with your healthcare
                provider.
              </Typography>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                startIcon={<LoginIcon />}
                onClick={handleLogin}
                sx={{ borderRadius: 2, py: 1.5 }}
              >
                Sign In
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default PatientWorkspaceDetailPage;
