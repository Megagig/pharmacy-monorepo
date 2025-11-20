import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Tab,
  Tabs,
  Alert,
  Paper,
  Chip,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Info as InfoIcon,
  AutoAwesome as AutoAwesomeIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Verified as VerifiedIcon,
  TrendingUp as TrendingUpIcon,
  HealthAndSafety as HealthIcon,
} from '@mui/icons-material';
import DiagnosticModule from '../components/DiagnosticModule';
import type { ModuleInfo } from '../types/moduleTypes';

const ClinicalDecisionSupport: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();
  
  const moduleInfo: ModuleInfo = {
    title: 'Clinical Decision Support',
    purpose:
      'AI-powered diagnostic assistance and clinical recommendations for evidence-based patient care.',
    workflow: {
      description:
        'Intelligent clinical decision support system that provides AI-powered diagnostic analysis and evidence-based recommendations to enhance patient safety.',
      steps: [
        'Input patient symptoms and clinical data',
        'Review AI-generated diagnostic analysis',
        'Evaluate differential diagnoses and recommendations',
        'Accept, modify, or override AI suggestions',
        'Document clinical rationale and decisions',
      ],
    },
    keyFeatures: [
      'AI-powered diagnostic analysis',
      'Differential diagnosis ranking',
      'Drug interaction checking',
      'Red flag identification',
      'Therapeutic recommendations',
      'Evidence-based suggestions',
      'Patient consent management',
      'Clinical decision documentation',
    ],
    status: 'active',
    estimatedRelease: 'Available Now',
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const features = [
    {
      icon: <AutoAwesomeIcon sx={{ fontSize: 28 }} />,
      title: 'AI-Powered Analysis',
      description: 'Advanced machine learning algorithms provide intelligent diagnostic insights',
      color: '#6366f1',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 28 }} />,
      title: 'HIPAA Compliant',
      description: 'Secure, encrypted processing with full patient privacy protection',
      color: '#10b981',
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 28 }} />,
      title: 'Real-time Results',
      description: 'Get comprehensive analysis in seconds, not minutes',
      color: '#f59e0b',
    },
    {
      icon: <VerifiedIcon sx={{ fontSize: 28 }} />,
      title: 'Evidence-Based',
      description: 'Recommendations backed by latest clinical research and guidelines',
      color: '#8b5cf6',
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Modern Hero Header */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            background: `linear-gradient(135deg, 
              ${alpha(theme.palette.primary.main, 0.1)} 0%, 
              ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            mb: 4,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background Pattern */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '40%',
              height: '100%',
              background: `radial-gradient(circle at 70% 30%, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 50%)`,
              zIndex: 0,
            }}
          />
          
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
              <Box
                sx={{
                  width: { xs: 60, md: 80 },
                  height: { xs: 60, md: 80 },
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
                }}
              >
                <PsychologyIcon sx={{ fontSize: { xs: 32, md: 40 }, color: 'white' }} />
              </Box>
              <Box>
                <Typography 
                  variant="h3" 
                  component="h1" 
                  sx={{ 
                    fontWeight: 700,
                    fontSize: { xs: '2rem', md: '3rem' },
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1,
                  }}
                >
                  Clinical Decision Support
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: 'text.secondary',
                    fontWeight: 400,
                    maxWidth: 600,
                  }}
                >
                  AI-powered diagnostic assistance and clinical recommendations for evidence-based patient care
                </Typography>
              </Box>
            </Box>

            {/* Feature Cards */}
            <Grid container spacing={2} sx={{ mt: 2 }}>
              {features.map((feature, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      p: 2,
                      height: '100%',
                      border: `1px solid ${alpha(feature.color, 0.2)}`,
                      borderRadius: 2,
                      background: alpha(feature.color, 0.02),
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 8px 25px ${alpha(feature.color, 0.15)}`,
                        border: `1px solid ${alpha(feature.color, 0.3)}`,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <Box sx={{ color: feature.color }}>
                        {feature.icon}
                      </Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {feature.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      {feature.description}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>

        {/* Modern Tab Navigation */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            mb: 3,
            overflow: 'hidden',
          }}
        >
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                minHeight: 72,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                px: 4,
                py: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                },
                '&.Mui-selected': {
                  color: theme.palette.primary.main,
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          >
            <Tab 
              icon={<PsychologyIcon />} 
              label="AI Diagnostic Tool" 
              iconPosition="start"
              sx={{ gap: 1.5 }}
            />
            <Tab 
              icon={<InfoIcon />} 
              label="How to Use" 
              iconPosition="start"
              sx={{ gap: 1.5 }}
            />
          </Tabs>
        </Paper>

        {/* Content */}
        {activeTab === 0 && <DiagnosticModule />}
        {activeTab === 1 && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <InfoIcon sx={{ color: 'info.main', fontSize: 24 }} />
                </Box>
                <Typography variant="h4" fontWeight={600} color="text.primary">
                  How to Use Clinical Decision Support
                </Typography>
              </Box>
              
              <Grid container spacing={4}>
                <Grid item xs={12} lg={8}>
                  <Typography variant="h5" gutterBottom color="primary" fontWeight={600} sx={{ mb: 3 }}>
                    Step-by-Step Usage Guide
                  </Typography>
                  
                  <Box sx={{ '& > div': { mb: 3 } }}>
                    {[
                      {
                        step: 1,
                        title: 'Select Patient',
                        description: 'Choose the patient from the dropdown menu. This ensures the AI analysis is contextualized with the patient\'s medical history.',
                        icon: <HealthIcon />,
                      },
                      {
                        step: 2,
                        title: 'Input Symptoms',
                        description: 'Add both subjective symptoms (patient-reported) and objective findings (clinical observations). Use the "Add Subjective" and "Add Objective" buttons to categorize symptoms appropriately.',
                        icon: <TrendingUpIcon />,
                      },
                      {
                        step: 3,
                        title: 'Clinical Details',
                        description: 'Specify the duration (e.g., "3 days", "2 weeks"), severity (mild/moderate/severe), and onset type (acute/chronic/subacute) of symptoms.',
                        icon: <InfoIcon />,
                      },
                      {
                        step: 4,
                        title: 'Vital Signs',
                        description: 'Enter current vital signs including blood pressure, heart rate, temperature, and oxygen saturation. This data helps the AI assess severity and urgency.',
                        icon: <SpeedIcon />,
                      },
                      {
                        step: 5,
                        title: 'Generate Analysis',
                        description: 'Click "Generate AI Analysis" to receive comprehensive diagnostic insights. The system will prompt for patient consent before proceeding.',
                        icon: <AutoAwesomeIcon />,
                      },
                      {
                        step: 6,
                        title: 'Review Results',
                        description: 'Examine the AI-generated differential diagnoses, red flags, recommended tests, and therapeutic options. Use these as clinical decision support - not replacement for professional judgment.',
                        icon: <VerifiedIcon />,
                      },
                    ].map((item) => (
                      <Card
                        key={item.step}
                        elevation={0}
                        sx={{
                          p: 3,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 3 }}>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Typography variant="h6" fontWeight={700} color="primary">
                              {item.step}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" fontWeight={600} gutterBottom>
                              {item.title}
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                              {item.description}
                            </Typography>
                          </Box>
                        </Box>
                      </Card>
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Box sx={{ position: 'sticky', top: 24 }}>
                    <Alert 
                      severity="info" 
                      sx={{ 
                        mb: 3,
                        borderRadius: 2,
                        '& .MuiAlert-message': { width: '100%' },
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Important Notes:
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.5 } }}>
                        <li>This tool provides clinical decision support and should not replace professional medical judgment</li>
                        <li>Always verify AI recommendations with current clinical guidelines</li>
                        <li>Patient consent is required before generating AI analysis</li>
                        <li>Red flags require immediate attention and possible escalation</li>
                      </Box>
                    </Alert>
                    
                    <Card
                      elevation={0}
                      sx={{
                        p: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.02),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="h6" fontWeight={600} color="primary" gutterBottom>
                        Best Practices
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 1 } }}>
                        <li>Be thorough in symptom documentation for better AI accuracy</li>
                        <li>Include all relevant vital signs and clinical observations</li>
                        <li>Review drug interactions in therapeutic recommendations</li>
                        <li>Document your clinical reasoning alongside AI suggestions</li>
                        <li>Use confidence scores to guide decision-making</li>
                      </Box>
                    </Card>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default ClinicalDecisionSupport;
