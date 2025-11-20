import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Paper,
  Rating,
  Avatar,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  CardMedia,
  Chip,
  Skeleton,
  Alert,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Footer from '../components/Footer';
import ThemeToggle from '../components/common/ThemeToggle';
import { useLatestPosts } from '../hooks/useHealthBlog';

const Landing = () => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState<{ [key: string]: boolean }>({});
  const observerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch latest health articles
  const { data: latestPostsData, isLoading: loadingPosts, error: postsError } = useLatestPosts({ limit: 6 });

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const menuItems = [
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Patient Portal', path: '/patient-access' },
    { label: 'Sign In', path: '/login' },
    { label: 'Get Started', path: '/register' },
  ];

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    Object.keys(observerRefs.current).forEach((key) => {
      const element = observerRefs.current[key];
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setIsVisible((prev) => ({ ...prev, [key]: true }));
              }
            });
          },
          { threshold: 0.1 }
        );
        observer.observe(element);
        observers.push(observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  const features = [
    {
      icon: PeopleIcon,
      title: 'Patient Management',
      description:
        'Comprehensive patient profiles with medical history, medications, and contact information.',
    },
    {
      icon: SecurityIcon,
      title: 'HIPAA Compliant',
      description:
        'Enterprise-grade security ensuring all patient data is protected and compliant.',
    },
    {
      icon: BarChartIcon,
      title: 'Clinical Analytics',
      description:
        'Advanced reporting and analytics to track patient outcomes and medication adherence.',
    },
    {
      icon: ScheduleIcon,
      title: 'Time Saving',
      description:
        'Streamline your workflow with automated documentation and smart reminders.',
    },
  ];

  const testimonials = [
    {
      name: 'Dr. Sarah Johnson',
      role: 'Clinical Pharmacist',
      content:
        'PharmacyCopilot has transformed how I manage my patients. The clinical notes feature is incredibly detailed and saves me hours each week.',
      rating: 5,
      avatar: 'S',
    },
    {
      name: 'Michael Chen',
      role: 'Pharmacy Manager',
      content:
        'The medication interaction checks and adherence tracking have significantly improved our patient care quality.',
      rating: 5,
      avatar: 'M',
    },
  ];

  const benefits = [
    'Comprehensive patient medication profiles',
    'SOAP note clinical documentation',
    'Drug interaction and allergy checking',
    'Medication adherence monitoring',
    'Automated follow-up reminders',
    'Advanced reporting and analytics',
  ];

  const stats = [
    { value: '2,500+', label: 'Active Pharmacists' },
    { value: '50,000+', label: 'Patients Managed' },
    { value: '98.5%', label: 'User Satisfaction' },
  ];

  const costSavings = [
    { value: '75%', label: 'Cost saved', color: 'primary' },
    { value: '48%', label: 'Schedule time saved', color: 'secondary' },
    { value: '25x', label: 'Operational efficiency', color: 'success' },
  ];

  const faqs = [
    {
      question: 'What is PharmacyCopilot?',
      answer:
        'PharmacyCopilot is a comprehensive pharmaceutical care management platform designed specifically for pharmacists. It helps manage patient profiles, clinical documentation, medication therapy reviews, and provides advanced analytics to improve patient outcomes.',
    },
    {
      question: 'Is PharmacyCopilot HIPAA compliant?',
      answer:
        'Yes, PharmacyCopilot is fully HIPAA compliant with enterprise-grade security measures. All patient data is encrypted both in transit and at rest, and we follow strict security protocols to ensure your data remains protected.',
    },
    {
      question: 'What are patient medical records made up of in PharmacyCopilot?',
      answer:
        'Patient records include comprehensive medication profiles, medical history, allergies, clinical notes (SOAP format), medication therapy reviews, adherence tracking, lab results, and communication logs with healthcare providers.',
    },
    {
      question: 'Can patient medical records be shared with other healthcare providers?',
      answer:
        'Yes, with proper patient consent and authorization, records can be securely shared with other healthcare providers through our secure communication hub. All sharing activities are logged and auditable for compliance.',
    },
    {
      question: 'Does PharmacyCopilot support clinic appointments?',
      answer:
        'Yes, PharmacyCopilot includes appointment scheduling features, automated reminders, and follow-up tracking to help you manage your clinical workflow efficiently.',
    },
    {
      question: 'How does the free trial work?',
      answer:
        'We offer a 14-day free trial with full access to all features. No credit card required to start. You can upgrade to a paid plan at any time during or after the trial period.',
    },
  ];

  const scrollToFeatures = () => {
    const element = document.getElementById('features-section');
    element?.scrollIntoView({ behavior: 'smooth' });
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
              PharmacyCopilot
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
            <Button
              component={Link}
              to="/patient-access"
              color="inherit"
              startIcon={<LocalPharmacyIcon />}
              sx={{
                fontWeight: 600,
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
                px: 2,
              }}
            >
              Patient Portal
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
                PharmaPilot
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

      {/* Hero Section */}
      <Box
        sx={{
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
              : 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
          py: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              gap: 6,
            }}
          >
            {/* Left Content */}
            <Box
              sx={{
                flex: 1,
                textAlign: { xs: 'center', md: 'left' },
              }}
            >
              {/* Stats Badge */}
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(6, 182, 212, 0.1)'
                      : 'rgba(6, 182, 212, 0.15)',
                  px: 3,
                  py: 1,
                  borderRadius: 10,
                  mb: 3,
                }}
              >
                <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography
                  variant="body2"
                  sx={{ color: 'primary.main', fontWeight: 600 }}
                >
                  Over 2,500 Pharmacists Thriving with Us!
                </Typography>
              </Box>

              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.2,
                }}
              >
                Access to healthier choices should always be a{' '}
                <Box component="span" sx={{ color: 'primary.main' }}>
                  priority.
                </Box>
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  mb: 4,
                  color: 'text.secondary',
                  lineHeight: 1.6,
                  maxWidth: '600px',
                  mx: { xs: 'auto', md: 0 },
                }}
              >
                For your physical health. For your mental health. For clinicians.
                For hospitals. For all of it in one place. For life.
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                  justifyContent: { xs: 'center', md: 'flex-start' },
                }}
              >
                <Button
                  component={Link}
                  to="/register"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ py: 1.5, px: 4, borderRadius: 3 }}
                >
                  Start Free Trial
                </Button>
                <Button
                  component={Link}
                  to="/patient-access"
                  variant="outlined"
                  size="large"
                  startIcon={<LocalPharmacyIcon />}
                  sx={{
                    py: 1.5,
                    px: 4,
                    borderRadius: 3,
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.dark',
                      backgroundColor: 'primary.main',
                      color: 'white',
                    }
                  }}
                >
                  Patient Portal
                </Button>
                <Button
                  onClick={scrollToFeatures}
                  variant="text"
                  size="large"
                  sx={{ py: 1.5, px: 4, borderRadius: 3 }}
                >
                  Learn More
                </Button>
              </Box>
            </Box>

            {/* Right Image */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Box
                component="img"
                src="/images/pharmacist-in-a-pharmacy.jpg"
                alt="Pharmacist providing care"
                sx={{
                  width: '100%',
                  maxWidth: 500,
                  height: 'auto',
                  borderRadius: 4,
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
                }}
              />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Stats Section */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box
          ref={(el) => (observerRefs.current['stats'] = el as HTMLDivElement | null)}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 4,
            opacity: isVisible['stats'] ? 1 : 0,
            transform: isVisible['stats']
              ? 'translateY(0)'
              : 'translateY(30px)',
            transition: 'all 0.6s ease-out',
          }}
        >
          {stats.map((stat, index) => (
            <Paper
              key={index}
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(6, 182, 212, 0.05)'
                    : 'rgba(6, 182, 212, 0.08)',
                border: '1px solid',
                borderColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(6, 182, 212, 0.2)'
                    : 'rgba(6, 182, 212, 0.3)',
              }}
            >
              <Typography
                variant="h3"
                sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}
              >
                {stat.value}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {stat.label}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Container>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }} id="features-section">
        <Box
          ref={(el) => (observerRefs.current['features-header'] = el as HTMLDivElement | null)}
          sx={{
            textAlign: 'center',
            mb: 8,
            opacity: isVisible['features-header'] ? 1 : 0,
            transform: isVisible['features-header']
              ? 'translateY(0)'
              : 'translateY(30px)',
            transition: 'all 0.6s ease-out',
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{ fontWeight: 600, mb: 2 }}
          >
            Transform Your Health Business with Digital Solutions!
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ maxWidth: '700px', mx: 'auto' }}
          >
            For your physical health. For your mental health. For clinicians. For
            hospitals. For all of it in one place. For life.
          </Typography>
        </Box>

        <Box
          ref={(el) => (observerRefs.current['features'] = el as HTMLDivElement | null)}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 4,
            opacity: isVisible['features'] ? 1 : 0,
            transform: isVisible['features']
              ? 'translateY(0)'
              : 'translateY(30px)',
            transition: 'all 0.6s ease-out 0.2s',
          }}
        >
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card
                key={index}
                sx={{
                  height: '100%',
                  textAlign: 'center',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 24px rgba(8, 145, 178, 0.15)',
                  },
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      bgcolor: 'primary.light',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 3,
                    }}
                  >
                    <IconComponent
                      sx={{ fontSize: 32, color: 'primary.main' }}
                    />
                  </Box>
                  <Typography
                    variant="h6"
                    component="h3"
                    sx={{ fontWeight: 600, mb: 2 }}
                  >
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Container>

      {/* Cost Savings Section */}
      <Box
        sx={{
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(6, 182, 212, 0.05)'
              : 'rgba(6, 182, 212, 0.08)',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Box
            ref={(el) => (observerRefs.current['savings-header'] = el as HTMLDivElement | null)}
            sx={{
              textAlign: 'center',
              mb: 6,
              opacity: isVisible['savings-header'] ? 1 : 0,
              transform: isVisible['savings-header']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.6s ease-out',
            }}
          >
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 600, mb: 2 }}
            >
              No more redundant tools. Save up to 70% of your costs
            </Typography>
          </Box>

          <Box
            ref={(el) => (observerRefs.current['savings'] = el as HTMLDivElement | null)}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 4,
              opacity: isVisible['savings'] ? 1 : 0,
              transform: isVisible['savings']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.6s ease-out 0.2s',
            }}
          >
            {costSavings.map((saving, index) => (
              <Paper
                key={index}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 700,
                    color: `${saving.color}.main`,
                    mb: 1,
                  }}
                >
                  {saving.value}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {saving.label}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <Button
              component={Link}
              to="/register"
              variant="contained"
              size="large"
              sx={{ py: 1.5, px: 4, borderRadius: 3 }}
            >
              See Trial
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 6,
            alignItems: 'center',
          }}
        >
          <Box
            ref={(el) => (observerRefs.current['benefits'] = el as HTMLDivElement | null)}
            sx={{
              flex: 1,
              opacity: isVisible['benefits'] ? 1 : 0,
              transform: isVisible['benefits']
                ? 'translateX(0)'
                : 'translateX(-30px)',
              transition: 'all 0.6s ease-out',
            }}
          >
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 600, mb: 4 }}
            >
              Streamline Your Clinical Workflow
            </Typography>
            <Box sx={{ mb: 4 }}>
              {benefits.map((benefit, index) => (
                <Box
                  key={index}
                  sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
                >
                  <CheckCircleIcon sx={{ color: 'success.main', mr: 2 }} />
                  <Typography variant="body1" color="text.primary">
                    {benefit}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Button
              component={Link}
              to="/register"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ py: 1.5, px: 4, borderRadius: 3 }}
            >
              Get Started Today
            </Button>
          </Box>

          <Box
            ref={(el) => (observerRefs.current['benefits-image'] = el as HTMLDivElement | null)}
            sx={{
              flex: 1,
              opacity: isVisible['benefits-image'] ? 1 : 0,
              transform: isVisible['benefits-image']
                ? 'translateX(0)'
                : 'translateX(30px)',
              transition: 'all 0.6s ease-out',
            }}
          >
            <Box
              component="img"
              src="/images/pharmaceutical-care.jpg"
              alt="Pharmaceutical care"
              sx={{
                width: '100%',
                height: 'auto',
                borderRadius: 4,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              }}
            />
          </Box>
        </Box>
      </Container>

      {/* Patient Portal Section */}
      <Box
        sx={{
          bgcolor: theme.palette.mode === 'dark'
            ? 'rgba(25, 118, 210, 0.05)'
            : 'rgba(25, 118, 210, 0.08)',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Box
            ref={(el) => (observerRefs.current['patient-portal-header'] = el as HTMLDivElement | null)}
            sx={{
              textAlign: 'center',
              mb: 8,
              opacity: isVisible['patient-portal-header'] ? 1 : 0,
              transform: isVisible['patient-portal-header']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.8s ease-out',
            }}
          >
            <Typography
              variant="h3"
              component="h2"
              sx={{
                fontWeight: 700,
                mb: 3,
                color: 'text.primary',
              }}
            >
              Patient Portal Access
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'text.secondary',
                maxWidth: '600px',
                mx: 'auto',
                lineHeight: 1.6,
              }}
            >
              Patients can easily access their pharmacy's portal to book appointments,
              manage prescriptions, and stay connected with their healthcare providers.
            </Typography>
          </Box>

          <Box
            ref={(el) => (observerRefs.current['patient-portal-content'] = el as HTMLDivElement | null)}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 6,
              alignItems: 'center',
              opacity: isVisible['patient-portal-content'] ? 1 : 0,
              transform: isVisible['patient-portal-content']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.8s ease-out 0.2s',
            }}
          >
            {/* Left Content */}
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>
                Simple Access for Patients
              </Typography>
              <Box sx={{ mb: 4 }}>
                {[
                  'Find their pharmacy by name or location',
                  'Create an account or sign in securely',
                  'Book appointments online 24/7',
                  'View appointment history and upcoming visits',
                  'Manage notification preferences',
                  'Access prescription information'
                ].map((feature, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CheckCircleIcon sx={{ color: 'primary.main', mr: 2 }} />
                    <Typography variant="body1">{feature}</Typography>
                  </Box>
                ))}
              </Box>
              <Button
                component={Link}
                to="/patient-access"
                variant="contained"
                size="large"
                startIcon={<LocalPharmacyIcon />}
                sx={{ py: 1.5, px: 4, borderRadius: 3 }}
              >
                Try Patient Portal
              </Button>
            </Box>

            {/* Right Image/Demo */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Paper
                sx={{
                  p: 4,
                  borderRadius: 4,
                  boxShadow: theme.shadows[8],
                  maxWidth: 400,
                  width: '100%',
                }}
              >
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <LocalPharmacyIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Patient Portal Demo
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Experience the patient journey
                  </Typography>
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    1. Search for your pharmacy
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    2. Create account or sign in
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    3. Book appointments easily
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    4. Manage your healthcare
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  to="/patient-access"
                  variant="outlined"
                  fullWidth
                  sx={{ borderRadius: 2 }}
                >
                  Start Demo
                </Button>
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Testimonials Section */}
      <Box
        sx={{
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(6, 182, 212, 0.05)'
              : 'rgba(6, 182, 212, 0.08)',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Box
            ref={(el) => (observerRefs.current['testimonials-header'] = el as HTMLDivElement | null)}
            sx={{
              textAlign: 'center',
              mb: 8,
              opacity: isVisible['testimonials-header'] ? 1 : 0,
              transform: isVisible['testimonials-header']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.6s ease-out',
            }}
          >
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 600, mb: 2 }}
            >
              What they say about our product's
            </Typography>
            <Typography variant="h6" color="text.secondary">
              See what pharmacists are saying about PharmacyCopilot
            </Typography>
          </Box>

          <Box
            ref={(el) => (observerRefs.current['testimonials'] = el as HTMLDivElement | null)}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 4,
              opacity: isVisible['testimonials'] ? 1 : 0,
              transform: isVisible['testimonials']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.6s ease-out 0.2s',
            }}
          >
            {testimonials.map((testimonial, index) => (
              <Card key={index} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                  <Rating value={testimonial.rating} readOnly sx={{ mb: 2 }} />
                  <Typography
                    variant="body1"
                    sx={{ mb: 3, fontStyle: 'italic' }}
                  >
                    "{testimonial.content}"
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      {testimonial.avatar}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {testimonial.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {testimonial.role}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>
      </Box>

      {/* FAQ Section */}
      <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 } }}>
        <Box
          ref={(el) => (observerRefs.current['faq-header'] = el as HTMLDivElement | null)}
          sx={{
            textAlign: 'center',
            mb: 6,
            opacity: isVisible['faq-header'] ? 1 : 0,
            transform: isVisible['faq-header']
              ? 'translateY(0)'
              : 'translateY(30px)',
            transition: 'all 0.6s ease-out',
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{ fontWeight: 600, mb: 2 }}
          >
            Got questions? We've got answers.
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Everything you need to know about PharmacyCopilot
          </Typography>
        </Box>

        <Box
          ref={(el) => (observerRefs.current['faq'] = el as HTMLDivElement | null)}
          sx={{
            opacity: isVisible['faq'] ? 1 : 0,
            transform: isVisible['faq'] ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.6s ease-out 0.2s',
          }}
        >
          {faqs.map((faq, index) => (
            <Accordion
              key={index}
              sx={{
                mb: 2,
                '&:before': { display: 'none' },
                boxShadow: 'none',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ py: 2 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" color="text.secondary">
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Container>

      {/* Latest Health Articles Section */}
      <Box
        sx={{
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(6, 182, 212, 0.05)'
              : 'rgba(6, 182, 212, 0.08)',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Box
            ref={(el) => (observerRefs.current['articles-header'] = el as HTMLDivElement | null)}
            sx={{
              textAlign: 'center',
              mb: 6,
              opacity: isVisible['articles-header'] ? 1 : 0,
              transform: isVisible['articles-header']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.6s ease-out',
            }}
          >
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 600, mb: 2 }}
            >
              Latest Health Articles
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Stay informed with our latest insights on health and wellness
            </Typography>
          </Box>

          <Box
            ref={(el) => (observerRefs.current['articles'] = el as HTMLDivElement | null)}
            sx={{
              opacity: isVisible['articles'] ? 1 : 0,
              transform: isVisible['articles']
                ? 'translateY(0)'
                : 'translateY(30px)',
              transition: 'all 0.6s ease-out 0.2s',
            }}
          >
            {/* Loading State */}
            {loadingPosts && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  flexWrap: 'wrap',
                  gap: 3,
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((index) => (
                  <Box
                    key={index}
                    sx={{
                      flex: {
                        xs: '1 1 100%',
                        sm: '1 1 calc(50% - 12px)',
                        md: '1 1 calc(33.333% - 16px)',
                      },
                    }}
                  >
                    <Card sx={{ height: '100%' }}>
                      <Skeleton variant="rectangular" height={200} />
                      <CardContent>
                        <Skeleton variant="text" height={32} />
                        <Skeleton variant="text" />
                        <Skeleton variant="text" />
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                          <Skeleton variant="rectangular" width={60} height={24} />
                          <Skeleton variant="rectangular" width={60} height={24} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
            )}

            {/* Error State */}
            {postsError && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Unable to load health articles at the moment. Please try again later.
              </Alert>
            )}

            {/* Success State - Display Articles */}
            {!loadingPosts && !postsError && latestPostsData?.data?.posts && latestPostsData.data.posts.length > 0 && (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    flexWrap: 'wrap',
                    gap: 3,
                  }}
                >
                  {latestPostsData.data.posts.map((post: any) => (
                    <Box
                      key={post._id}
                      sx={{
                        flex: {
                          xs: '1 1 100%',
                          sm: '1 1 calc(50% - 12px)',
                          md: '1 1 calc(33.333% - 16px)',
                        },
                      }}
                    >
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                          '&:hover': {
                            transform: 'translateY(-8px)',
                            boxShadow: '0 12px 24px rgba(8, 145, 178, 0.15)',
                          },
                        }}
                      >
                        {/* Featured Image */}
                        {post.featuredImage?.url && (
                          <CardMedia
                            component="img"
                            height="200"
                            image={post.featuredImage.url}
                            alt={post.featuredImage.alt || post.title}
                            sx={{ objectFit: 'cover' }}
                          />
                        )}

                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                          {/* Category Chip */}
                          <Box sx={{ mb: 2 }}>
                            <Chip
                              label={post.category.replace('_', ' ').toUpperCase()}
                              size="small"
                              color="primary"
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>

                          {/* Title */}
                          <Typography
                            variant="h6"
                            component="h3"
                            sx={{
                              fontWeight: 600,
                              mb: 1,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {post.title}
                          </Typography>

                          {/* Excerpt */}
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 2,
                              flexGrow: 1,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {post.excerpt}
                          </Typography>

                          {/* Meta Information */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 2,
                              flexWrap: 'wrap',
                              gap: 1,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {post.readTime} min read
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <VisibilityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {post.viewCount || 0} views
                              </Typography>
                            </Box>
                          </Box>

                          {/* Read More Button */}
                          <Button
                            component={Link}
                            to={`/blog/${post.slug}`}
                            variant="outlined"
                            fullWidth
                            sx={{
                              mt: 'auto',
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                            }}
                          >
                            Read More
                          </Button>
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Box>

                {/* View All Button */}
                <Box sx={{ textAlign: 'center', mt: 6 }}>
                  <Button
                    component={Link}
                    to="/blog"
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ py: 1.5, px: 4, borderRadius: 3 }}
                  >
                    View All Articles
                  </Button>
                </Box>
              </>
            )}

            {/* No Articles State */}
            {!loadingPosts && !postsError && (!latestPostsData?.data?.posts || latestPostsData.data.posts.length === 0) && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No articles available yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Check back soon for health and wellness insights
                </Typography>
              </Box>
            )}
          </Box>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ bgcolor: 'primary.main', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Box
            ref={(el) => (observerRefs.current['cta'] = el as HTMLDivElement | null)}
            sx={{
              textAlign: 'center',
              color: 'white',
              opacity: isVisible['cta'] ? 1 : 0,
              transform: isVisible['cta'] ? 'scale(1)' : 'scale(0.95)',
              transition: 'all 0.6s ease-out',
            }}
          >
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 600, mb: 2 }}
            >
              Ready to Transform Your Practice?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Join thousands of pharmacists already using PharmacyCopilot to improve
              patient outcomes
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                justifyContent: 'center',
              }}
            >
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
                endIcon={<ArrowForwardIcon />}
              >
                Start Free Trial
              </Button>
              <Button
                component={Link}
                to="/contact"
                variant="outlined"
                size="large"
                sx={{
                  py: 1.5,
                  px: 4,
                  borderRadius: 3,
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'grey.300',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Contact Sales
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default Landing;
