import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Alert,
  InputAdornment,
  IconButton,
  Link,
  Divider,
  useTheme,
  Container,
  CircularProgress,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Email from '@mui/icons-material/Email';
import Phone from '@mui/icons-material/Phone';
import Person from '@mui/icons-material/Person';
import Lock from '@mui/icons-material/Lock';
import LocalHospital from '@mui/icons-material/LocalHospital';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { usePatientAuth } from '../hooks/usePatientAuth';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`patient-auth-tabpanel-${index}`}
      aria-labelledby={`patient-auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * Patient Authentication Page
 * Handles both login and registration for patient portal access
 */
const PatientAuth: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const patientAuth = usePatientAuth();

  // Get workspace info from navigation state
  const workspaceInfo = location.state?.workspaceInfo;

  // Determine initial tab based on route path
  const pathname = location.pathname;
  const isRegisterRoute = pathname.includes('/register');

  const [tabValue, setTabValue] = useState(isRegisterRoute ? 1 : 0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspace, setWorkspace] = useState<any>(workspaceInfo || null);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  // Registration form state
  const [registerForm, setRegisterForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: '',
  });

  // Fetch workspace info if not provided
  useEffect(() => {
    const fetchWorkspaceInfo = async () => {
      if (!workspaceId) return;

      // Check if workspace info is in state or sessionStorage
      if (workspace) return;

      const storedWorkspace = sessionStorage.getItem('selectedWorkspace');
      if (storedWorkspace) {
        setWorkspace(JSON.parse(storedWorkspace));
        return;
      }

      // Fetch from API
      setLoadingWorkspace(true);
      try {
        const { default: publicApiClient } = await import('../services/publicApiClient');
        const response = await publicApiClient.get(`/public/workspaces/${workspaceId}/info`);
        if (response.data.success) {
          setWorkspace(response.data.data);
          sessionStorage.setItem('selectedWorkspace', JSON.stringify(response.data.data));
        }
      } catch (err: any) {
        console.error('Failed to fetch workspace info:', err);
        setError('Failed to load workspace information. Please try again.');
      } finally {
        setLoadingWorkspace(false);
      }
    };

    fetchWorkspaceInfo();
  }, [workspaceId, workspace]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError('');

    // Update URL when switching tabs
    if (newValue === 0) {
      navigate(`/patient-auth/${workspaceId}/login`, { state: { workspaceInfo: workspace }, replace: true });
    } else {
      navigate(`/patient-auth/${workspaceId}/register`, { state: { workspaceInfo: workspace }, replace: true });
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {

      // Use PatientAuthContext login method which handles cookies and state management
      await patientAuth.login({
        email: loginForm.email,
        password: loginForm.password,
        workspaceId: workspaceId || '',
      });

      // Redirect to patient portal on success
      navigate(`/patient-portal/${workspaceId}`);
    } catch (err: any) {
      console.error('❌ Patient login failed:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (registerForm.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      // Use PatientAuthContext register method
      const response = await patientAuth.register({
        firstName: registerForm.firstName,
        lastName: registerForm.lastName,
        email: registerForm.email,
        phone: registerForm.phone,
        dateOfBirth: registerForm.dateOfBirth,
        password: registerForm.password,
        workspaceId: workspaceId || '',
      });

      // Show success message and redirect to login
      setError('');
      alert(response.message || 'Registration successful! Please log in with your credentials.'); // In production, use a proper notification system
      setTabValue(0); // Switch to login tab

      // Clear registration form
      setRegisterForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        password: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      let errorMessage = err.response?.data?.message || err.message || 'Registration failed. Please try again.';

      // If there are validation errors, show them
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const validationErrors = err.response.data.errors
          .map((error: any) => error.msg)
          .join('. ');
        errorMessage = validationErrors || errorMessage;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      {/* Loading State */}
      {loadingWorkspace && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      )}

      {!loadingWorkspace && (
        <>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            {workspace && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  {workspace.name}
                </Typography>
                <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500, mb: 1 }}>
                  {workspace.type}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {workspace.address}
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <LocalHospital
                sx={{
                  fontSize: 40,
                  color: theme.palette.primary.main,
                  mr: 1,
                }}
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Patient Portal
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary">
              {workspace
                ? `Access your account at ${workspace.name}`
                : 'Access your healthcare information and manage appointments'
              }
            </Typography>
          </Box>

          {/* Main Card */}
          <Card
            sx={{
              borderRadius: 4,
              boxShadow: theme.shadows[8],
              background: theme.palette.background.paper,
            }}
          >
            {/* Navigation Tabs */}
            <Box
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              }}
            >
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="patient auth tabs"
                centered
                sx={{
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    minHeight: 64,
                  },
                }}
              >
                <Tab label="Sign In" />
                <Tab label="Create Account" />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <CardContent sx={{ p: 0 }}>
              {/* Error Alert */}
              {error && (
                <Box sx={{ p: 3, pb: 0 }}>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                </Box>
              )}

              {/* Sign In Tab */}
              <TabPanel value={tabValue} index={0}>
                <Box sx={{ p: 4 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                    Welcome Back
                  </Typography>
                  <form onSubmit={handleLoginSubmit}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      value={loginForm.email}
                      onChange={(e) =>
                        setLoginForm({ ...loginForm, email: e.target.value })
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 3 }}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(e) =>
                        setLoginForm({ ...loginForm, password: e.target.value })
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 3 }}
                      required
                    />
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={loading}
                      sx={{ mb: 2, py: 1.5 }}
                    >
                      {loading ? 'Signing In...' : 'Sign In'}
                    </Button>
                    <Box sx={{ textAlign: 'center' }}>
                      <Link href="#" variant="body2">
                        Forgot your password?
                      </Link>
                    </Box>
                  </form>
                </Box>
              </TabPanel>

              {/* Create Account Tab */}
              <TabPanel value={tabValue} index={1}>
                <Box sx={{ p: 4 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                    Create Your Account
                  </Typography>
                  <form onSubmit={handleRegisterSubmit}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                      <TextField
                        fullWidth
                        label="First Name"
                        value={registerForm.firstName}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, firstName: e.target.value })
                        }
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person />
                            </InputAdornment>
                          ),
                        }}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Last Name"
                        value={registerForm.lastName}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, lastName: e.target.value })
                        }
                        required
                      />
                    </Box>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      value={registerForm.email}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, email: e.target.value })
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 3 }}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Phone Number"
                      type="tel"
                      value={registerForm.phone}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, phone: e.target.value })
                      }
                      placeholder="+2349060394022"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Phone />
                          </InputAdornment>
                        ),
                      }}
                      helperText="Use international format with country code (e.g., +2349060394022)"
                      sx={{ mb: 3 }}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Date of Birth"
                      type="date"
                      value={registerForm.dateOfBirth}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })
                      }
                      InputLabelProps={{
                        shrink: true,
                      }}
                      sx={{ mb: 3 }}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={registerForm.password}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, password: e.target.value })
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      helperText="Must be at least 8 characters with one uppercase, one lowercase, and one number"
                      sx={{ mb: 3 }}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Confirm Password"
                      type={showPassword ? 'text' : 'password'}
                      value={registerForm.confirmPassword}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, confirmPassword: e.target.value })
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 3 }}
                      required
                    />
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={loading}
                      sx={{ mb: 2, py: 1.5 }}
                    >
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </form>
                </Box>
              </TabPanel>
            </CardContent>
          </Card>

          {/* Footer */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Need help? Contact your pharmacy directly or call our support line.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              By using this portal, you agree to our Terms of Service and Privacy Policy.
            </Typography>
          </Box>
        </>
      )}
    </Container>
  );
};

export default PatientAuth;