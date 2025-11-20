import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  ContactSupport as ContactSupportIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

interface PatientProfileIncompleteProps {
  userEmail?: string;
  workspaceName?: string;
  onContactSupport?: () => void;
  onRefresh?: () => void;
}

const PatientProfileIncomplete: React.FC<PatientProfileIncompleteProps> = ({
  userEmail,
  workspaceName,
  onContactSupport,
  onRefresh
}) => {
  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      // Default action - could open a modal or redirect to support
      window.open('mailto:support@pharmacare.com?subject=Patient Profile Setup Required', '_blank');
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Alert 
        severity="info" 
        sx={{ mb: 3 }}
        icon={<InfoIcon />}
      >
        <Typography variant="h6" gutterBottom>
          Profile Setup Required
        </Typography>
        <Typography variant="body2">
          Your account is not yet linked to a patient record. Please contact your healthcare provider to complete your profile setup.
        </Typography>
      </Alert>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <PersonAddIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h5" gutterBottom>
                Complete Your Patient Profile
              </Typography>
              <Typography variant="body1" color="text.secondary">
                To access your health records, vitals tracking, and other features, your account needs to be linked to a patient record.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            What happens next?
          </Typography>

          <List>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Account Created"
                secondary="Your patient portal account has been successfully created"
              />
              <Chip label="Complete" color="success" size="small" />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <ScheduleIcon color="warning" />
              </ListItemIcon>
              <ListItemText
                primary="Profile Linking"
                secondary="Your healthcare provider will link your account to your medical records"
              />
              <Chip label="Pending" color="warning" size="small" />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <PersonAddIcon color="action" />
              </ListItemIcon>
              <ListItemText
                primary="Full Access"
                secondary="Once linked, you'll have access to all patient portal features"
              />
              <Chip label="Waiting" color="default" size="small" />
            </ListItem>
          </List>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              Need Help?
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              If you've been waiting for more than 24 hours or need immediate assistance, please contact your healthcare provider.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<ContactSupportIcon />}
                onClick={handleContactSupport}
              >
                Contact Support
              </Button>
              
              {onRefresh && (
                <Button
                  variant="outlined"
                  onClick={onRefresh}
                >
                  Check Status
                </Button>
              )}
            </Box>

            {userEmail && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Your Account:</strong> {userEmail}
                  {workspaceName && (
                    <>
                      <br />
                      <strong>Healthcare Provider:</strong> {workspaceName}
                    </>
                  )}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          This process typically takes 1-2 business days. You'll receive an email notification once your profile is ready.
        </Typography>
      </Box>
    </Box>
  );
};

export default PatientProfileIncomplete;