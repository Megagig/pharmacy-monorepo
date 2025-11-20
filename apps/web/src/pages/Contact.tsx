import React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Box,
  Container,
  Typography,
  Button,
  AppBar,
  Toolbar,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SendIcon from '@mui/icons-material/Send';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Footer from '../components/Footer';
import ThemeToggle from '../components/common/ThemeToggle';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const Contact: React.FC = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>();

  const onSubmit = async (data: ContactForm) => {
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Log form data for debugging (remove in production)

    toast.success("Message sent successfully! We'll get back to you soon.");
    reset();
  };

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
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
              : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          py: { xs: 8, md: 12 },
          transition: 'background 0.3s ease',
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
              Get in Touch
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
              Have questions about PharmacyCopilot? We're here to help. Reach out to
              our team and we'll get back to you as soon as possible.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Contact Section */}
      <Container maxWidth="xl" sx={{ py: { xs: 8, md: 12 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 8,
          }}
        >
          {/* Contact Information */}
          <Box sx={{ flex: 1, maxWidth: { lg: '500px' } }}>
            <Typography
              variant="h4"
              component="h2"
              sx={{ fontWeight: 600, mb: 4 }}
            >
              Contact Information
            </Typography>

            {/* Contact Cards Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  lg: '1fr',
                },
                gap: 3,
                mb: 4,
              }}
            >
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: 'primary.light',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <EmailIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      Email
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      support@PharmacyCopilot.ng
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      sales@PharmacyCopilot.ng
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: 'success.light',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PhoneIcon sx={{ color: 'success.main', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      Phone
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      +234 (0) 123 456 7890
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      +234 (0) 987 654 3210
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: 'warning.light',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LocationOnIcon
                      sx={{ color: 'warning.main', fontSize: 28 }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      Address
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      123 Healthcare Avenue
                      <br />
                      Victoria Island, Lagos
                      <br />
                      Nigeria
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: 'info.light',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ScheduleIcon sx={{ color: 'info.main', fontSize: 24 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Business Hours
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Mon - Fri
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      9:00 AM - 6:00 PM
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Saturday
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      10:00 AM - 4:00 PM
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Sunday
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Closed
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* Contact Form */}
          <Box sx={{ flex: 1, maxWidth: { lg: '600px' } }}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                borderRadius: 3,
                background: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid',
                borderColor: 'grey.200',
                height: 'fit-content',
              }}
            >
              <Typography
                variant="h4"
                component="h2"
                sx={{ fontWeight: 600, mb: 4, color: 'primary.main' }}
              >
                Send us a Message
              </Typography>
              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 3,
                    mb: 3,
                  }}
                >
                  <TextField
                    {...register('name', { required: 'Name is required' })}
                    fullWidth
                    label="Full Name"
                    placeholder="Your full name"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                    }}
                  />

                  <TextField
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: 'Please enter a valid email address',
                      },
                    })}
                    fullWidth
                    label="Email Address"
                    type="email"
                    placeholder="your.email@example.com"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                    }}
                  />
                </Box>

                <TextField
                  {...register('subject', { required: 'Subject is required' })}
                  fullWidth
                  label="Subject"
                  placeholder="What's this about?"
                  error={!!errors.subject}
                  helperText={errors.subject?.message}
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />

                <TextField
                  {...register('message', {
                    required: 'Message is required',
                    minLength: {
                      value: 10,
                      message: 'Message must be at least 10 characters',
                    },
                  })}
                  fullWidth
                  label="Message"
                  multiline
                  rows={6}
                  placeholder="Tell us more about your inquiry..."
                  error={!!errors.message}
                  helperText={errors.message?.message}
                  sx={{
                    mb: 4,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={isSubmitting}
                  startIcon={<SendIcon />}
                  sx={{
                    py: 1.5,
                    borderRadius: 3,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    background: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
                        : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                    '&:hover': {
                      background: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)'
                          : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Container>

      {/* FAQ Section */}
      <Box sx={{ bgcolor: 'grey.50', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 600, mb: 2 }}
            >
              Frequently Asked Questions
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Quick answers to common questions about PharmacyCopilot
            </Typography>
          </Box>
          <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
            <Accordion
              sx={{
                mb: 2,
                borderRadius: 2,
                '&:before': { display: 'none' },
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  How do I get started with PharmacyCopilot?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" color="text.secondary">
                  Simply sign up for a free trial account, verify your email,
                  and you'll have immediate access to all features for 30 days.
                  No credit card required to start your trial.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              sx={{
                mb: 2,
                borderRadius: 2,
                '&:before': { display: 'none' },
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Is my patient data secure?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" color="text.secondary">
                  Yes, we use industry-standard encryption and security measures
                  to protect all patient data and comply with healthcare privacy
                  regulations including HIPAA compliance.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              sx={{
                mb: 2,
                borderRadius: 2,
                '&:before': { display: 'none' },
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Can I cancel my subscription anytime?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" color="text.secondary">
                  Absolutely. You can cancel your subscription at any time from
                  your account settings. No long-term contracts or cancellation
                  fees. Your access continues until the end of your billing
                  period.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              sx={{
                mb: 2,
                borderRadius: 2,
                '&:before': { display: 'none' },
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Do you offer training and support?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" color="text.secondary">
                  Yes, we provide comprehensive onboarding, training materials,
                  video tutorials, and ongoing customer support to help you get
                  the most out of PharmacyCopilot. Enterprise plans include dedicated
                  support.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default Contact;
