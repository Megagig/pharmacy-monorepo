import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Card,
  CardContent,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/common/ThemeToggle';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'rememberMe' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {

      const response = await login({
        email: formData.email,
        password: formData.password,
      });

      if (response.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: unknown) {
      console.error('Login error:', error);

      let errorMessage = 'Invalid email or password';

      if (error instanceof Error) {
        if (
          error.message.includes('429') ||
          error.message.includes('Too Many Requests')
        ) {
          errorMessage =
            'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (
          error.message.includes('Request failed with status code 429')
        ) {
          errorMessage =
            'Rate limit exceeded. Please wait a few minutes and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        position: 'relative',
        transition: 'background 0.3s ease',
      }}
    >
      {/* Floating Theme Toggle */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <ThemeToggle size="sm" variant="button" />
      </Box>

      <Container maxWidth="sm">
        <Card
          sx={{ borderRadius: 4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
        >
          <CardContent sx={{ p: 6 }}>
            {/* Back to Homepage Link */}
            <Box sx={{ mb: 3 }}>
              <Button
                component={Link}
                to="/"
                variant="text"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    color: 'primary.main',
                    backgroundColor: 'transparent',
                  },
                }}
              >
                ← Back to Homepage
              </Button>
            </Box>

            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: 'primary.main',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Typography
                  variant="h4"
                  sx={{ color: 'white', fontWeight: 'bold' }}
                >
                  P
                </Typography>
              </Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}
              >
                Welcome Back
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sign in to your PharmacyCopilot account
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {/* Login Form */}
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                name="email"
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />

              <TextField
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 4,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      color="primary"
                    />
                  }
                  label="Remember me"
                />
                <Link
                  to="/forgot-password"
                  style={{
                    textDecoration: 'none',
                    color: '#2563eb',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </Link>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 3,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 600,
                  mb: 3,
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </Button>

              <Divider sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  or
                </Typography>
              </Divider>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    style={{
                      textDecoration: 'none',
                      color: '#2563eb',
                      fontWeight: 600,
                    }}
                  >
                    Sign up
                  </Link>
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  By signing in, you agree to our{' '}
                  <Link
                    to="/terms"
                    style={{
                      textDecoration: 'none',
                      color: '#2563eb',
                    }}
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/privacy"
                    style={{
                      textDecoration: 'none',
                      color: '#2563eb',
                    }}
                  >
                    Privacy Policy
                  </Link>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;
