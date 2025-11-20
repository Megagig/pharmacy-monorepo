import React from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  AppBar,
  Toolbar,
  Paper,
  Chip,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import FavoriteIcon from '@mui/icons-material/Favorite';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import ShieldIcon from '@mui/icons-material/Shield';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupIcon from '@mui/icons-material/Group';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Footer from '../components/Footer';
import ThemeToggle from '../components/common/ThemeToggle';

const About: React.FC = () => {
  const theme = useTheme();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Navigation */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
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
              <Typography
                variant="h6"
                sx={{ color: 'white', fontWeight: 'bold' }}
              >
                P
              </Typography>
            </Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, color: 'text.primary' }}
            >
              PharmacyCopilot
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Button component={Link} to="/" color="inherit">
              Home
            </Button>
            <Button component={Link} to="/about" color="inherit">
              About
            </Button>
            <Button component={Link} to="/contact" color="inherit">
              Contact
            </Button>
            <Button component={Link} to="/pricing" color="inherit">
              Pricing
            </Button>
            <ThemeToggle size="sm" variant="button" />
            <Button component={Link} to="/login" color="inherit">
              Sign In
            </Button>
            <Button
              component={Link}
              to="/register"
              variant="contained"
              sx={{ borderRadius: 3 }}
            >
              Get Started
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Box
        sx={{
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
              : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: '800px', mx: 'auto' }}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 700,
                mb: 3,
                color: 'text.primary',
                fontSize: { xs: '2.5rem', md: '3.5rem' },
              }}
            >
              About PharmacyCopilot
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mb: 4,
                color: 'text.secondary',
                maxWidth: '600px',
                mx: 'auto',
              }}
            >
              Empowering Nigerian pharmacists with modern tools to deliver
              exceptional patient care, streamline operations, and improve
              health outcomes across communities.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Mission & Vision Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 8,
            alignItems: 'center',
          }}
        >
          {/* Mission Content */}
          <Box sx={{ flex: 1 }}>
            <Chip
              label="Our Mission"
              sx={{
                mb: 3,
                bgcolor: 'primary.light',
                color: 'primary.main',
                fontWeight: 600,
                fontSize: '0.9rem',
                px: 2,
                py: 1,
                height: 'auto',
              }}
            />
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 700, mb: 4, color: 'text.primary' }}
            >
              Revolutionizing Pharmaceutical Care in Nigeria
            </Typography>
            <Typography
              variant="body1"
              sx={{ mb: 3, fontSize: '1.1rem', lineHeight: 1.7 }}
            >
              To revolutionize pharmaceutical care in Nigeria by providing
              pharmacists with cutting-edge technology that enhances patient
              safety, improves medication management, and supports
              evidence-based clinical decisions.
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontSize: '1.1rem', lineHeight: 1.7, mb: 4 }}
            >
              We believe that every patient deserves the highest quality
              pharmaceutical care, and every pharmacist deserves the tools to
              deliver it efficiently and effectively.
            </Typography>

            {/* Key Features */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 24 }} />
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Evidence-based clinical decision support
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 24 }} />
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Advanced medication management tools
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 24 }} />
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Patient safety and error prevention
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Statistics Cards */}
          <Box sx={{ flex: 1, maxWidth: { lg: '500px' } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 3,
              }}
            >
              <Paper
                elevation={3}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 3,
                  background:
                    'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(37, 99, 235, 0.3)',
                  },
                }}
              >
                <PeopleIcon sx={{ fontSize: 48, mb: 2, opacity: 0.9 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  1000+
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Pharmacists Served
                </Typography>
              </Paper>

              <Paper
                elevation={3}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 3,
                  background:
                    'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                  },
                }}
              >
                <FavoriteIcon sx={{ fontSize: 48, mb: 2, opacity: 0.9 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  50K+
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Patients Helped
                </Typography>
              </Paper>

              <Paper
                elevation={3}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 3,
                  background:
                    'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(239, 68, 68, 0.3)',
                  },
                }}
              >
                <TrendingUpIcon sx={{ fontSize: 48, mb: 2, opacity: 0.9 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  98%
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Satisfaction Rate
                </Typography>
              </Paper>

              <Paper
                elevation={3}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 3,
                  background:
                    'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(139, 92, 246, 0.3)',
                  },
                }}
              >
                <StarIcon sx={{ fontSize: 48, mb: 2, opacity: 0.9 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  4.9
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Average Rating
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Values Section */}
      <Box sx={{ bgcolor: 'grey.50', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip
              label="Our Core Values"
              sx={{
                mb: 3,
                bgcolor: 'success.light',
                color: 'success.main',
                fontWeight: 600,
                fontSize: '0.9rem',
                px: 2,
                py: 1,
                height: 'auto',
              }}
            />
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 700, mb: 2 }}
            >
              The Principles That Guide Us
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: '600px', mx: 'auto' }}
            >
              Every decision we make is rooted in these fundamental values that
              drive our commitment to excellence
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 4,
            }}
          >
            <Paper
              elevation={2}
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: 3,
                height: '100%',
                transition: 'all 0.3s ease',
                '&:hover': {
                  elevation: 6,
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'primary.light',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <ShieldIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                Patient Safety First
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.6 }}
              >
                Every feature we build prioritizes patient safety and medication
                accuracy, helping prevent errors and improve outcomes.
              </Typography>
            </Paper>

            <Paper
              elevation={2}
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: 3,
                height: '100%',
                transition: 'all 0.3s ease',
                '&:hover': {
                  elevation: 6,
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'success.light',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <EmojiEventsIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                Excellence in Care
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.6 }}
              >
                We empower pharmacists to deliver the highest standard of
                pharmaceutical care through evidence-based tools and insights.
              </Typography>
            </Paper>

            <Paper
              elevation={2}
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: 3,
                height: '100%',
                transition: 'all 0.3s ease',
                '&:hover': {
                  elevation: 6,
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'warning.light',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <GroupIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                Community Impact
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.6 }}
              >
                We're committed to improving healthcare access and quality
                across Nigerian communities, one pharmacy at a time.
              </Typography>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* Vision Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{ textAlign: 'center', maxWidth: '800px', mx: 'auto' }}>
          <Chip
            label="Our Vision"
            sx={{
              mb: 3,
              bgcolor: 'warning.light',
              color: 'warning.main',
              fontWeight: 600,
              fontSize: '0.9rem',
              px: 2,
              py: 1,
              height: 'auto',
            }}
          />
          <Typography
            variant="h3"
            component="h2"
            sx={{ fontWeight: 700, mb: 4 }}
          >
            Building the Future of Healthcare in Nigeria
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ mb: 6, lineHeight: 1.7 }}
          >
            We envision a Nigeria where every pharmacy is equipped with
            world-class technology, every pharmacist has access to the best
            tools and insights, and every patient receives the highest quality
            pharmaceutical care possible.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 3,
              justifyContent: 'center',
            }}
          >
            <Paper
              elevation={1}
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: 'info.light',
                color: 'info.main',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                minWidth: 200,
              }}
            >
              <VisibilityIcon sx={{ fontSize: 32 }} />
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Innovation
                </Typography>
                <Typography variant="body2">Cutting-edge solutions</Typography>
              </Box>
            </Paper>

            <Paper
              elevation={1}
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: 'success.light',
                color: 'success.main',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                minWidth: 200,
              }}
            >
              <FavoriteIcon sx={{ fontSize: 32 }} />
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Care
                </Typography>
                <Typography variant="body2">
                  Patient-centered approach
                </Typography>
              </Box>
            </Paper>

            <Paper
              elevation={1}
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: 'primary.light',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                minWidth: 200,
              }}
            >
              <TrendingUpIcon sx={{ fontSize: 32 }} />
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Growth
                </Typography>
                <Typography variant="body2">Continuous improvement</Typography>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Container>

      {/* CTA Section */}
      <Box sx={{ bgcolor: 'primary.main', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 600, mb: 2 }}
            >
              Ready to Transform Your Pharmacy?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Join thousands of pharmacists already using PharmacyCopilot to deliver
              better patient care.
            </Typography>
            <Button
              component={Link}
              to="/register"
              variant="contained"
              size="large"
              sx={{
                py: 1.5,
                px: 4,
                borderRadius: 3,
                bgcolor: 'white',
                color: 'primary.main',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              Start Your Free Trial
            </Button>
          </Box>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default About;
