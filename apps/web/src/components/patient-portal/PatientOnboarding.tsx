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
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  LocalPharmacy as PharmacyIcon,
  Schedule as ScheduleIcon,
  Chat as ChatIcon,
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
  Favorite as FavoriteIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

interface PatientOnboardingProps {
  open: boolean;
  onClose: () => void;
  workspaceName?: string;
  patientName?: string;
}

const PatientOnboarding: React.FC<PatientOnboardingProps> = ({
  open,
  onClose,
  workspaceName = 'Your Pharmacy',
  patientName = 'Patient',
}) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      label: 'Welcome to Your Patient Portal',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Hello {patientName}! 👋
          </Typography>
          <Typography variant="body1" paragraph>
            Welcome to the {workspaceName} patient portal. We're excited to help you manage your health journey digitally.
          </Typography>
          <Card sx={{ mt: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <CardContent>
              <Typography variant="body2">
                <strong>Your account is now active!</strong> You can access all portal features immediately.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      ),
    },
    {
      label: 'Explore Your Features',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            What You Can Do
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <PharmacyIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Medication Management"
                secondary="View prescriptions, request refills, and track adherence"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ScheduleIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Appointment Booking"
                secondary="Schedule consultations with your pharmacist"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ChatIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Secure Messaging"
                secondary="Communicate directly with your healthcare team"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <AssessmentIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Health Records"
                secondary="Access lab results, vitals, and medical history"
              />
            </ListItem>
          </List>
        </Box>
      ),
    },
    {
      label: 'Privacy & Security',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Your Data is Protected
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <SecurityIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="HIPAA Compliant"
                secondary="All communications are encrypted and secure"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <FavoriteIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Confidential Care"
                secondary="Your health information is never shared without permission"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Verified Access"
                secondary="Only authorized healthcare providers can access your data"
              />
            </ListItem>
          </List>
        </Box>
      ),
    },
    {
      label: 'Get Started',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Ready to Begin?
          </Typography>
          <Typography variant="body1" paragraph>
            Your patient portal is ready to use! Here are some quick actions to get you started:
          </Typography>
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Recommended First Steps:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. Complete your profile information" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. Review your current medications" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. Schedule your next appointment" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="4. Explore the health education resources" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
      ),
    },
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleFinish = () => {
    // Mark onboarding as completed
    localStorage.setItem('patientOnboardingCompleted', 'true');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: '500px',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PharmacyIcon color="primary" />
          <Typography variant="h6" component="div">
            Welcome to {workspaceName}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ mt: 2, mb: 2 }}>
                  {step.content}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    variant="outlined"
                    size="small"
                  >
                    Back
                  </Button>
                  {index === steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleFinish}
                      endIcon={<CheckCircleIcon />}
                    >
                      Get Started
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<ArrowForwardIcon />}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} color="inherit">
          Skip Tour
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Step {activeStep + 1} of {steps.length}
        </Typography>
      </DialogActions>
    </Dialog>
  );
};

export default PatientOnboarding;