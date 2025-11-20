import { Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Divider,
  IconButton,
  Stack,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'grey.200',
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 4,
          }}
        >
          {/* Brand Section */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33%' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ color: 'white', fontWeight: 'bold' }}
                >
                  PC
                </Typography>
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 'bold', color: 'primary.main' }}
              >
                PharmacyCopilot
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Empowering pharmacists and healthcare professionals with advanced
              patient management, medication tracking, and clinical
              documentation tools.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Made with
              </Typography>
              <FavoriteIcon
                sx={{ fontSize: 16, mx: 0.5, color: 'error.main' }}
              />
              <Typography variant="caption" color="text.secondary">
                for pharmacists
              </Typography>
            </Box>
          </Box>

          {/* Links Sections */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 67%' } }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 4,
              }}
            >
              {/* Product Links */}
              <Box sx={{ minWidth: 150 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    letterSpacing: '0.08333em',
                    display: 'block',
                    mb: 2,
                  }}
                >
                  Product
                </Typography>
                <Stack spacing={1}>
                  <Button
                    component={Link}
                    to="/dashboard"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Dashboard
                  </Button>
                  <Button
                    component={Link}
                    to="/patients"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Patient Management
                  </Button>
                  <Button
                    component={Link}
                    to="/medications"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Medications
                  </Button>
                  <Button
                    component={Link}
                    to="/clinical-notes"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Clinical Notes
                  </Button>
                </Stack>
              </Box>

              {/* Company Links */}
              <Box sx={{ minWidth: 150 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    letterSpacing: '0.08333em',
                    display: 'block',
                    mb: 2,
                  }}
                >
                  Company
                </Typography>
                <Stack spacing={1}>
                  <Button
                    component={Link}
                    to="/about"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    About Us
                  </Button>
                  <Button
                    component={Link}
                    to="/pricing"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Pricing
                  </Button>
                  <Button
                    component={Link}
                    to="/contact"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Contact
                  </Button>
                </Stack>
              </Box>

              {/* Resources Links */}
              <Box sx={{ minWidth: 150 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    letterSpacing: '0.08333em',
                    display: 'block',
                    mb: 2,
                  }}
                >
                  Resources
                </Typography>
                <Stack spacing={1}>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Documentation
                  </Button>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    API Reference
                  </Button>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Help Center
                  </Button>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Community
                  </Button>
                </Stack>
              </Box>

              {/* Legal Links */}
              <Box sx={{ minWidth: 150 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    letterSpacing: '0.08333em',
                    display: 'block',
                    mb: 2,
                  }}
                >
                  Legal
                </Typography>
                <Stack spacing={1}>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Privacy Policy
                  </Button>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Terms of Service
                  </Button>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    HIPAA Compliance
                  </Button>
                  <Button
                    href="#"
                    variant="text"
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 400,
                      fontSize: '0.875rem',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    Security
                  </Button>
                </Stack>
              </Box>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Bottom Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} PharmacyCopilot. All rights reserved.
          </Typography>

          {/* Social Media Links */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              Follow us:
            </Typography>
            <IconButton
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  backgroundColor: 'primary.light',
                },
              }}
            >
              <TwitterIcon fontSize="small" />
            </IconButton>
            <IconButton
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  backgroundColor: 'primary.light',
                },
              }}
            >
              <LinkedInIcon fontSize="small" />
            </IconButton>
            <IconButton
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  backgroundColor: 'primary.light',
                },
              }}
            >
              <GitHubIcon fontSize="small" />
            </IconButton>
            <IconButton
              href="mailto:support@PharmacyCopilot.com"
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  backgroundColor: 'primary.light',
                },
              }}
            >
              <EmailIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
