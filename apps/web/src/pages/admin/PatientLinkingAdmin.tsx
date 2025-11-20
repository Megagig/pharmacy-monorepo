import React from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Divider
} from '@mui/material';
import PatientLinkingFixButton from '../../components/admin/PatientLinkingFixButton';

const PatientLinkingAdmin: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Patient Linking Administration
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        This page helps you manage the linking between PatientUser accounts (authentication) and Patient records (medical data).
        When patients can't access their health records, it's usually because their account isn't linked to a patient record.
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Fix: Link All Unlinked Patients
          </Typography>
          
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            If patients are seeing "Profile Setup Required" even though they have active accounts, 
            use this tool to automatically create and link Patient records for all unlinked PatientUsers.
          </Typography>

          <PatientLinkingFixButton />

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            How Patient Linking Works
          </Typography>
          
          <Box component="ol" sx={{ pl: 2 }}>
            <li>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Patient Registration:</strong> User creates PatientUser account for portal access
              </Typography>
            </li>
            <li>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Admin Approval:</strong> Admin approves the PatientUser (status becomes 'active')
              </Typography>
            </li>
            <li>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Automatic Linking:</strong> System should automatically create Patient record and link it
              </Typography>
            </li>
            <li>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Full Access:</strong> Patient can now access health records, vitals, lab results, etc.
              </Typography>
            </li>
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Note:</strong> If the automatic linking fails (due to system issues or data problems), 
              patients will see "Profile Setup Required" even with active accounts. Use the fix button above to resolve this.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Container>
  );
};

export default PatientLinkingAdmin;