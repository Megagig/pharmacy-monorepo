import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  IconButton,
  Fab,
  Drawer,
  Divider,
} from '@mui/material';
import {
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayArrowIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  Tour as TourIcon,
  MenuBook as GuideIcon,
} from '@mui/icons-material';

interface MTRHelpSystemProps {
  currentStep?: number;
  onStartTour?: () => void;
  onShowGuide?: () => void;
}

interface HelpTopic {
  id: string;
  title: string;
  content: string;
  category: 'workflow' | 'features' | 'troubleshooting' | 'best-practices';
  keywords: string[];
}

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
}

const helpTopics: HelpTopic[] = [
  {
    id: 'patient-selection',
    title: 'Patient Selection',
    content:
      'Learn how to search for and select patients for MTR. Use filters to find high-risk patients who would benefit most from medication therapy review.',
    category: 'workflow',
    keywords: ['patient', 'search', 'selection', 'filter'],
  },
  {
    id: 'medication-history',
    title: 'Medication History Collection',
    content:
      'Comprehensive guide to collecting medication information including prescriptions, OTC medications, herbal supplements, and vitamins.',
    category: 'workflow',
    keywords: ['medication', 'history', 'collection', 'otc', 'supplements'],
  },
  {
    id: 'drug-interactions',
    title: 'Drug Interaction Checking',
    content:
      'Understanding automated drug interaction alerts, severity levels, and how to assess clinical significance.',
    category: 'features',
    keywords: ['interactions', 'alerts', 'severity', 'clinical'],
  },
  {
    id: 'recommendations',
    title: 'Creating Recommendations',
    content:
      'Best practices for developing evidence-based therapy recommendations with clear rationale and monitoring plans.',
    category: 'best-practices',
    keywords: ['recommendations', 'therapy', 'evidence', 'monitoring'],
  },
  {
    id: 'documentation',
    title: 'Documentation Standards',
    content:
      'Guidelines for proper documentation of MTR activities, interventions, and outcomes for regulatory compliance.',
    category: 'best-practices',
    keywords: ['documentation', 'compliance', 'audit', 'standards'],
  },
  {
    id: 'system-errors',
    title: 'Troubleshooting System Issues',
    content:
      'Common system issues and solutions including connectivity problems, data saving issues, and performance optimization.',
    category: 'troubleshooting',
    keywords: ['errors', 'troubleshooting', 'system', 'performance'],
  },
];

const tourSteps: TourStep[] = [
  {
    target: '.mtr-dashboard',
    title: 'Welcome to MTR Dashboard',
    content:
      'This is your main workspace for conducting medication therapy reviews. The stepper shows your progress through the 6-step MTR process.',
    placement: 'bottom',
  },
  {
    target: '.patient-selection',
    title: 'Patient Selection',
    content:
      'Start by searching for and selecting a patient. Use the filters to find patients who would benefit from MTR.',
    placement: 'right',
    action: 'Click the search box to begin',
  },
  {
    target: '.medication-history',
    title: 'Medication History',
    content:
      'Collect comprehensive medication information including prescriptions, OTC drugs, and supplements.',
    placement: 'left',
  },
  {
    target: '.therapy-assessment',
    title: 'Therapy Assessment',
    content:
      'Review automated alerts and identify drug-related problems. Assess clinical significance and document findings.',
    placement: 'top',
  },
  {
    target: '.plan-development',
    title: 'Plan Development',
    content:
      'Create evidence-based recommendations to address identified problems. Set therapy goals and monitoring plans.',
    placement: 'bottom',
  },
  {
    target: '.interventions',
    title: 'Interventions',
    content:
      'Document your actions and communications. Track outcomes and acceptance of recommendations.',
    placement: 'right',
  },
  {
    target: '.follow-up',
    title: 'Follow-Up',
    content:
      'Schedule appropriate follow-up activities and monitoring to ensure continuity of care.',
    placement: 'left',
  },
];

export const MTRHelpSystem: React.FC<MTRHelpSystemProps> = ({
  currentStep = 0,
  onStartTour,
}) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTourStep, setActiveTourStep] = useState(0);

  const filteredTopics = helpTopics.filter((topic) => {
    const matchesSearch =
      topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic.keywords.some((keyword) =>
        keyword.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesCategory =
      selectedCategory === 'all' || topic.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleStartTour = () => {
    setTourOpen(true);
    setActiveTourStep(0);
    onStartTour?.();
  };

  const handleNextTourStep = () => {
    if (activeTourStep < tourSteps.length - 1) {
      setActiveTourStep(activeTourStep + 1);
    } else {
      setTourOpen(false);
    }
  };

  const handlePrevTourStep = () => {
    if (activeTourStep > 0) {
      setActiveTourStep(activeTourStep - 1);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'workflow':
        return 'primary';
      case 'features':
        return 'secondary';
      case 'best-practices':
        return 'success';
      case 'troubleshooting':
        return 'error';
      default:
        return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'workflow':
        return <PlayArrowIcon />;
      case 'features':
        return <InfoIcon />;
      case 'best-practices':
        return <CheckCircleIcon />;
      case 'troubleshooting':
        return <WarningIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <>
      {/* Floating Help Button */}
      <Fab
        color="primary"
        aria-label="help"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
        }}
        onClick={() => setHelpOpen(true)}
      >
        <HelpIcon />
      </Fab>

      {/* Help Drawer */}
      <Drawer
        anchor="right"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            padding: 2,
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6">MTR Help & Support</Typography>
          <IconButton onClick={() => setHelpOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<TourIcon />}
            onClick={handleStartTour}
            sx={{ mb: 1 }}
          >
            Start Guided Tour
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GuideIcon />}
            onClick={() => setGuideOpen(true)}
          >
            View User Guide
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Quick Help for Current Step */}
        {currentStep > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Current Step Help
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
              <Typography variant="body2" color="primary.contrastText">
                {tourSteps[currentStep - 1]?.content ||
                  'Complete this step to continue with your MTR.'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Search and Filter */}
        <Box sx={{ mb: 2 }}>
          <input
            type="text"
            placeholder="Search help topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              'all',
              'workflow',
              'features',
              'best-practices',
              'troubleshooting',
            ].map((category) => (
              <Chip
                key={category}
                label={category.replace('-', ' ')}
                variant={selectedCategory === category ? 'filled' : 'outlined'}
                size="small"
                onClick={() => setSelectedCategory(category)}
              />
            ))}
          </Box>
        </Box>

        {/* Help Topics */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {filteredTopics.map((topic) => (
            <Accordion key={topic.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getCategoryIcon(topic.category)}
                  <Typography variant="subtitle2">{topic.title}</Typography>
                  <Chip
                    label={topic.category.replace('-', ' ')}
                    size="small"
                    color={
                      getCategoryColor(topic.category) as
                        | 'default'
                        | 'primary'
                        | 'secondary'
                        | 'error'
                        | 'info'
                        | 'success'
                        | 'warning'
                    }
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2">{topic.content}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>

      {/* Guided Tour Dialog */}
      <Dialog
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          MTR Guided Tour - Step {activeTourStep + 1} of {tourSteps.length}
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeTourStep} orientation="vertical">
            {tourSteps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.title}</StepLabel>
                <StepContent>
                  <Typography>{step.content}</Typography>
                  {step.action && (
                    <Box sx={{ mt: 1 }}>
                      <Chip label={step.action} color="primary" size="small" />
                    </Box>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTourOpen(false)}>Skip Tour</Button>
          <Button onClick={handlePrevTourStep} disabled={activeTourStep === 0}>
            Previous
          </Button>
          <Button onClick={handleNextTourStep} variant="contained">
            {activeTourStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Guide Dialog */}
      <Dialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>MTR User Guide</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Quick Reference Guide
          </Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">MTR Workflow Overview</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="1. Patient Selection"
                    secondary="Search and select appropriate patients for MTR"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="2. Medication History"
                    secondary="Collect comprehensive medication information"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="3. Therapy Assessment"
                    secondary="Identify drug-related problems and assess therapy"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="4. Plan Development"
                    secondary="Create evidence-based recommendations"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="5. Interventions"
                    secondary="Document actions and track outcomes"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="6. Follow-Up"
                    secondary="Schedule monitoring and continuity of care"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Best Practices</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                • Always verify medication information with multiple sources
              </Typography>
              <Typography variant="body2" paragraph>
                • Focus on clinically significant drug-related problems
              </Typography>
              <Typography variant="body2" paragraph>
                • Provide clear, evidence-based recommendations
              </Typography>
              <Typography variant="body2" paragraph>
                • Document thoroughly for regulatory compliance
              </Typography>
              <Typography variant="body2" paragraph>
                • Follow up on all interventions appropriately
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Keyboard Shortcuts</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                • <strong>Ctrl + S:</strong> Save current progress
              </Typography>
              <Typography variant="body2" paragraph>
                • <strong>Ctrl + N:</strong> Start new MTR session
              </Typography>
              <Typography variant="body2" paragraph>
                • <strong>Ctrl + F:</strong> Search patients or medications
              </Typography>
              <Typography variant="body2" paragraph>
                • <strong>Tab:</strong> Navigate between form fields
              </Typography>
              <Typography variant="body2" paragraph>
                • <strong>Esc:</strong> Close dialogs or cancel actions
              </Typography>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuideOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => window.open('/docs/MTR_USER_GUIDE.md', '_blank')}
          >
            View Full Guide
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Tooltip component for contextual help
interface MTRTooltipProps {
  title: string;
  content: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const MTRTooltip: React.FC<MTRTooltipProps> = ({
  title,
  content,
  children,
  placement = 'top',
}) => {
  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2">{content}</Typography>
        </Box>
      }
      placement={placement}
      arrow
      enterDelay={500}
      leaveDelay={200}
    >
      {children}
    </Tooltip>
  );
};

// Help button component for specific sections
interface MTRHelpButtonProps {
  topic: string;
  size?: 'small' | 'medium' | 'large';
}

export const MTRHelpButton: React.FC<MTRHelpButtonProps> = ({
  topic,
  size = 'small',
}) => {
  const [open, setOpen] = useState(false);

  const helpContent = helpTopics.find((t) => t.id === topic);

  return (
    <>
      <IconButton size={size} onClick={() => setOpen(true)} sx={{ ml: 1 }}>
        <HelpIcon fontSize={size} />
      </IconButton>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{helpContent?.title || 'Help'}</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {helpContent?.content ||
              'Help information not available for this topic.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MTRHelpSystem;
