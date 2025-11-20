import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  AppBar,
  Toolbar,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
  ToggleButtonGroup,
  ToggleButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Footer from '../components/Footer';
import ThemeToggle from '../components/common/ThemeToggle';
import { usePricingPlans } from '../queries/usePricing';

const faqData = [
  {
    question: 'What is PharmacyCopilot?',
    answer: 'PharmacyCopilot is a cloud-based platform designed for pharmacists and pharmacy owners to manage, document, and optimize their daily pharmaceutical care activities. It simplifies patient record-keeping, prescription monitoring, inventory management, reporting, and compliance — all in one secure platform.',
  },
  {
    question: 'Who can use PharmacyCopilot?',
    answer: 'PharmacyCopilot is built for: Community and hospital pharmacists, Pharmacy managers and owners, Chain pharmacies and independent outlets, Clinical pharmacists providing direct patient care. Whether you\'re running a single outlet or managing multiple branches, PharmacyCopilot adapts to your workflow.',
  },
  {
    question: 'Is my data secure on PharmacyCopilot?',
    answer: 'Absolutely. PharmacyCopilot uses bank-grade encryption and secure cloud hosting to protect your data. We follow strict data privacy standards and are compliant with applicable healthcare data protection regulations. Your data is always yours — we never share it with third parties.',
  },
  {
    question: 'Can I try PharmacyCopilot before paying?',
    answer: 'Yes. We offer a free trial period that allows you to explore all core features without any commitment. You can upgrade or cancel anytime during or after the trial.',
  },
  {
    question: 'How does the pricing work?',
    answer: 'Our pricing is subscription-based, with flexible plans for individual pharmacists, pharmacy outlets, and enterprise networks. You pay monthly or annually, depending on your preference. Each plan includes access to specific modules (like Medication Therapy Review, Billing, or Reports) — with higher tiers unlocking advanced analytics and automation.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept major payment methods including: Debit/Credit cards, Bank transfers, Nomba (for local payments), Automated invoicing for enterprise clients.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes. You can cancel your subscription at any time directly from your dashboard. Once canceled, your account remains active until the end of your billing cycle. You can also export your data before cancellation.',
  },
  {
    question: 'What happens to my data if I cancel my subscription?',
    answer: 'Your data remains securely stored for a grace period after cancellation. You can reactivate your account or request a full export of your data at any time. After the grace period, data is permanently deleted to maintain privacy compliance.',
  },
  {
    question: 'Can multiple users access one pharmacy account?',
    answer: 'Yes. PharmacyCopilot supports multi-user access with role-based permissions. Pharmacy managers can add team members (pharmacists, technicians, cashiers) and assign access rights for better collaboration and accountability.',
  },
  {
    question: 'Does PharmacyCopilot support multiple pharmacy branches?',
    answer: 'Yes. Our multi-tenant system allows you to manage multiple outlets or branches under one organization account — each with separate inventory, users, and reports, but unified under your main dashboard.',
  },
  {
    question: 'Does PharmacyCopilot offer customer support?',
    answer: 'Yes. We provide: Email and live chat support, In-app help center with tutorials and documentation, Priority support for premium and enterprise plans. Our support team is made up of pharmacists and technical experts who understand your workflow.',
  },
  {
    question: 'Can PharmacyCopilot work offline?',
    answer: 'PharmacyCopilot is primarily cloud-based, but certain key features (like patient lookup and dispensing records) have limited offline capabilities. Data syncs automatically once you\'re back online.',
  },
  {
    question: 'Do you offer training or onboarding support?',
    answer: 'Yes. We provide guided onboarding, video tutorials, and one-on-one setup assistance for enterprise users. Our goal is to get your pharmacy fully operational on PharmacyCopilot within days — not weeks.',
  },
  {
    question: 'What makes PharmacyCopilot different from regular pharmacy software?',
    answer: 'PharmacyCopilot isn\'t just a management tool — it\'s a pharmaceutical care platform built by pharmacists, for pharmacists. It combines clinical documentation, analytics, and patient engagement with modern automation, giving you full control of your professional practice and business performance.',
  },
];

const Pricing = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | false>(false);
  const { data, isLoading, error } = usePricingPlans(billingPeriod);

  const handleBillingPeriodChange = (
    _event: React.MouseEvent<HTMLElement>,
    newPeriod: 'monthly' | 'yearly' | null
  ) => {
    if (newPeriod !== null) {
      setBillingPeriod(newPeriod);
    }
  };

  const handleGetStarted = (planSlug: string, planName: string) => {
    // Navigate to registration with selected plan
    navigate(`/register?plan=${planSlug}&planName=${encodeURIComponent(planName)}`);
  };

  const handleContactSales = (whatsappNumber?: string) => {
    if (whatsappNumber) {
      const message = encodeURIComponent(
        "Hello, I'm interested in the Enterprise plan. Please provide more information."
      );
      window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
    }
  };

  const handleFaqChange = (panel: number) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedFaq(isExpanded ? panel : false);
  };

  const getGradientForPlan = (tier: string) => {
    switch (tier) {
      case 'free_trial':
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      case 'basic':
        return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
      case 'pro':
        return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
      case 'pharmily':
        return 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
      case 'network':
        return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
      case 'enterprise':
        return 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)';
      default:
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          pointerEvents: 'none',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #667eea 0%, transparent 70%)',
            top: '-250px',
            right: '-250px',
            animation: 'float 20s ease-in-out infinite',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #f5576c 0%, transparent 70%)',
            bottom: '-200px',
            left: '-200px',
            animation: 'float 15s ease-in-out infinite reverse',
          },
          '@keyframes float': {
            '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
            '50%': { transform: 'translate(50px, 50px) scale(1.1)' },
          },
        }}
      />

      {/* Navigation */}
      <AppBar
        position="static"
        sx={{
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(20px)',
          boxShadow: `0 8px 32px 0 ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                background: getGradientForPlan('free_trial'),
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1.5,
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                P
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              PharmacyCopilot
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Button component={Link} to="/" color="inherit" sx={{ fontWeight: 600 }}>
              Home
            </Button>
            <Button component={Link} to="/about" color="inherit" sx={{ fontWeight: 600 }}>
              About
            </Button>
            <Button component={Link} to="/contact" color="inherit" sx={{ fontWeight: 600 }}>
              Contact
            </Button>
            <Button component={Link} to="/pricing" color="inherit" sx={{ fontWeight: 600 }}>
              Pricing
            </Button>
            <ThemeToggle size="sm" variant="button" />
            <Button component={Link} to="/login" color="inherit" sx={{ fontWeight: 600 }}>
              Sign In
            </Button>
            <Button
              component={Link}
              to="/register"
              variant="contained"
              sx={{
                borderRadius: 3,
                px: 3,
                background: getGradientForPlan('pro'),
                fontWeight: 600,
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                },
                transition: 'all 0.3s ease',
              }}
            >
              Get Started
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 }, position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            icon={<StarIcon />}
            label="PRICING PLANS"
            sx={{
              mb: 3,
              px: 2,
              py: 2.5,
              height: 'auto',
              background: alpha(theme.palette.primary.main, 0.1),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              fontWeight: 700,
              fontSize: '0.75rem',
              letterSpacing: 1,
            }}
          />
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 800,
              mb: 2,
              background: getGradientForPlan('pro'),
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: { xs: '2.5rem', md: '4rem' },
            }}
          >
            Choose Your Perfect Plan
          </Typography>
          <Typography
            variant="h5"
            sx={{
              mb: 4,
              color: 'text.secondary',
              maxWidth: '700px',
              mx: 'auto',
              fontWeight: 400,
              lineHeight: 1.6,
            }}
          >
            Simple, transparent pricing that scales with your pharmacy practice
          </Typography>
          <Chip
            icon={<RocketLaunchIcon />}
            label="14-DAY FREE TRIAL • NO CREDIT CARD REQUIRED"
            sx={{
              px: 3,
              py: 3,
              height: 'auto',
              background: `linear-gradient(135deg, ${alpha('#43e97b', 0.2)}, ${alpha('#38f9d7', 0.2)})`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha('#43e97b', 0.3)}`,
              fontWeight: 700,
              fontSize: '0.875rem',
              color: theme.palette.mode === 'dark' ? '#43e97b' : '#1e8449',
              boxShadow: `0 4px 12px ${alpha('#43e97b', 0.2)}`,
            }}
          />
        </Box>

        {/* Billing Period Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
          <Box
            sx={{
              background: alpha(theme.palette.background.paper, 0.7),
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 4,
              p: 0.5,
            }}
          >
            <ToggleButtonGroup
              value={billingPeriod}
              exclusive
              onChange={handleBillingPeriodChange}
              aria-label="billing period"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 4,
                  py: 1.5,
                  borderRadius: 3,
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  '&.Mui-selected': {
                    background: getGradientForPlan('pro'),
                    color: 'white',
                    '&:hover': {
                      background: getGradientForPlan('pro'),
                    },
                  },
                },
              }}
            >
              <ToggleButton value="monthly" aria-label="monthly billing">
                Monthly
              </ToggleButton>
              <ToggleButton value="yearly" aria-label="yearly billing">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Yearly
                  <Chip
                    label="Save 10%"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: billingPeriod === 'yearly'
                        ? alpha('#fff', 0.2)
                        : alpha('#43e97b', 0.2),
                      color: billingPeriod === 'yearly'
                        ? 'white'
                        : '#1e8449',
                    }}
                  />
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={60} thickness={4} />
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Alert
            severity="error"
            sx={{
              maxWidth: '600px',
              mx: 'auto',
              backdropFilter: 'blur(10px)',
              background: alpha(theme.palette.error.main, 0.1),
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
            }}
          >
            Unable to load pricing plans. Please try again later.
          </Alert>
        )}

        {/* Pricing Cards */}
        {!isLoading && !error && data && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 4,
            }}
          >
            {data.plans.map((plan) => (
              <Card
                key={plan._id}
                sx={{
                  position: 'relative',
                  height: '100%',
                  background: alpha(theme.palette.background.paper, plan.isPopular ? 0.95 : 0.7),
                  backdropFilter: 'blur(20px)',
                  border: plan.isPopular
                    ? `2px solid ${theme.palette.primary.main}`
                    : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  borderRadius: 4,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: plan.isPopular ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: plan.isPopular
                    ? `0 20px 60px ${alpha(theme.palette.primary.main, 0.3)}`
                    : `0 8px 32px ${alpha(theme.palette.common.black, 0.1)}`,
                  '&:hover': {
                    transform: plan.isPopular ? 'scale(1.08)' : 'scale(1.03)',
                    boxShadow: plan.isPopular
                      ? `0 25px 70px ${alpha(theme.palette.primary.main, 0.4)}`
                      : `0 12px 40px ${alpha(theme.palette.common.black, 0.15)}`,
                  },
                }}
              >
                {/* Popular Badge */}
                {plan.isPopular && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      px: 3,
                      py: 1,
                      background: getGradientForPlan(plan.tier),
                      borderRadius: 3,
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <StarIcon sx={{ fontSize: 16, color: 'white' }} />
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 700, letterSpacing: 1 }}>
                      {plan.metadata?.badge || 'MOST POPULAR'}
                    </Typography>
                  </Box>
                )}

                {/* Trial Badge */}
                {plan.trialDays && plan.tier === 'free_trial' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      px: 3,
                      py: 1,
                      background: getGradientForPlan(plan.tier),
                      borderRadius: 3,
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 700, letterSpacing: 1 }}>
                      {plan.trialDays} DAYS FREE
                    </Typography>
                  </Box>
                )}

                <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Plan Header */}
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        mx: 'auto',
                        mb: 2,
                        background: getGradientForPlan(plan.tier),
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
                      }}
                    >
                      {plan.tier === 'enterprise' ? (
                        <BusinessCenterIcon sx={{ fontSize: 40, color: 'white' }} />
                      ) : (
                        <RocketLaunchIcon sx={{ fontSize: 40, color: 'white' }} />
                      )}
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      {plan.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {plan.description}
                    </Typography>

                    {/* Price */}
                    {plan.isContactSales ? (
                      <Box>
                        <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main' }}>
                          Custom
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Contact us for pricing
                        </Typography>
                      </Box>
                    ) : plan.tier === 'free_trial' ? (
                      <Box>
                        <Typography variant="h2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                          Free
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          14-day trial
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        {plan.billingPeriod === 'yearly' ? (
                          <>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', mb: 0.5 }}>
                              <Typography variant="h6" color="text.secondary" sx={{ mr: 0.5 }}>
                                ₦
                              </Typography>
                              <Typography variant="h2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                {plan.price.toLocaleString()}
                              </Typography>
                              <Typography variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>
                                /year
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Billed annually
                            </Typography>
                            <Chip
                              label="10% OFF"
                              size="small"
                              sx={{
                                background: alpha('#43e97b', 0.2),
                                color: '#1e8449',
                                fontWeight: 700,
                                fontSize: '0.65rem',
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', mb: 1 }}>
                              <Typography variant="h6" color="text.secondary" sx={{ mr: 0.5 }}>
                                ₦
                              </Typography>
                              <Typography variant="h2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                {plan.price.toLocaleString()}
                              </Typography>
                              <Typography variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>
                                /mo
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              Billed monthly
                            </Typography>
                          </>
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* CTA Button */}
                  <Button
                    variant={plan.isPopular ? 'contained' : 'outlined'}
                    size="large"
                    fullWidth
                    onClick={() =>
                      plan.isContactSales
                        ? handleContactSales(plan.whatsappNumber)
                        : handleGetStarted(plan.slug, plan.name)
                    }
                    sx={{
                      mb: 3,
                      py: 1.5,
                      borderRadius: 3,
                      fontWeight: 700,
                      fontSize: '1rem',
                      textTransform: 'none',
                      ...(plan.isPopular && {
                        background: getGradientForPlan(plan.tier),
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                        '&:hover': {
                          boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                        },
                      }),
                    }}
                  >
                    {plan.metadata?.buttonText || 'Get Started'}
                  </Button>

                  {/* Features List */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary' }}>
                      WHAT'S INCLUDED:
                    </Typography>
                    <List disablePadding sx={{ maxHeight: '300px', overflow: 'auto' }}>
                      {plan.featuresDetails?.map((feature) => (
                        <ListItem key={feature._id} disablePadding sx={{ py: 0.75 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={feature.name}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: 500,
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* FAQ Section */}
        <Box sx={{ mt: 12 }}>
          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontWeight: 800,
              mb: 2,
              textAlign: 'center',
              background: getGradientForPlan('pro'),
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Frequently Asked Questions
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mb: 6,
              textAlign: 'center',
              color: 'text.secondary',
              maxWidth: '700px',
              mx: 'auto',
            }}
          >
            Everything you need to know about PharmacyCopilot
          </Typography>
          <Box sx={{ maxWidth: '900px', mx: 'auto' }}>
            {faqData.map((faq, index) => (
              <Accordion
                key={index}
                expanded={expandedFaq === index}
                onChange={handleFaqChange(index)}
                sx={{
                  mb: 2,
                  borderRadius: 3,
                  '&:before': { display: 'none' },
                  background: alpha(theme.palette.background.paper, 0.7),
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.08)}`,
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, 0.12)}`,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <ExpandMoreIcon
                      sx={{
                        color: 'primary.main',
                        fontSize: 28,
                      }}
                    />
                  }
                  sx={{
                    py: 2,
                    px: 3,
                    '& .MuiAccordionSummary-content': {
                      margin: '12px 0',
                    },
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '1rem', md: '1.15rem' },
                      color: 'text.primary',
                    }}
                  >
                    {faq.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, pb: 3, px: 3 }}>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.8,
                      fontSize: { xs: '0.95rem', md: '1rem' },
                    }}
                  >
                    {faq.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>

        {/* Trust Indicators */}
        <Box
          sx={{
            mt: 12,
            p: 4,
            borderRadius: 4,
            background: alpha(theme.palette.background.paper, 0.7),
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            textAlign: 'center',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
            Why Choose PharmacyCopilot?
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 4,
            }}
          >
            {[
              { icon: '🔒', title: 'Secure & Compliant', desc: 'Bank-level security with HIPAA compliance' },
              { icon: '🚀', title: 'Fast Setup', desc: 'Get started in minutes, not days' },
              { icon: '💬', title: '24/7 Support', desc: 'Always here to help you succeed' },
            ].map((item, index) => (
              <Box key={index}>
                <Typography variant="h2" sx={{ mb: 1 }}>
                  {item.icon}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>

      <Footer />
    </Box>
  );
};

export default Pricing;
