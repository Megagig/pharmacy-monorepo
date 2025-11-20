import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Stack,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  LocalPharmacy as LocalPharmacyIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { SafetyCheck } from '../../services/labIntegrationService';

interface SafetyChecksDisplayProps {
  safetyChecks: SafetyCheck[];
}

const SafetyChecksDisplay: React.FC<SafetyChecksDisplayProps> = ({ safetyChecks }) => {
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
      critical: 'error',
      major: 'error',
      moderate: 'warning',
      minor: 'info',
    };
    return colors[severity] || 'default';
  };

  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, React.ReactElement> = {
      critical: <ErrorIcon color="error" />,
      major: <ErrorIcon color="error" />,
      moderate: <WarningIcon color="warning" />,
      minor: <InfoIcon color="info" />,
    };
    return icons[severity] || <InfoIcon />;
  };

  const getCheckTypeLabel = (checkType: string) => {
    const labels: Record<string, string> = {
      allergy: 'Allergy Check',
      drug_interaction: 'Drug Interaction',
      contraindication: 'Contraindication',
      renal_dosing: 'Renal Dosing Adjustment',
      hepatic_dosing: 'Hepatic Dosing Adjustment',
      duplicate_therapy: 'Duplicate Therapy',
    };
    return labels[checkType] || checkType;
  };

  // Group checks by severity
  const criticalChecks = safetyChecks.filter((c) => c.severity === 'critical');
  const majorChecks = safetyChecks.filter((c) => c.severity === 'major');
  const moderateChecks = safetyChecks.filter((c) => c.severity === 'moderate');
  const minorChecks = safetyChecks.filter((c) => c.severity === 'minor');

  if (safetyChecks.length === 0) {
    return (
      <Alert severity="success" icon={<CheckCircleIcon />}>
        <Typography variant="subtitle2" gutterBottom>
          All Safety Checks Passed
        </Typography>
        <Typography variant="body2">
          No safety concerns were identified. All therapy recommendations appear to be safe for this patient.
        </Typography>
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Summary Alert */}
      {criticalChecks.length > 0 && (
        <Alert severity="error" icon={<ErrorIcon />}>
          <Typography variant="subtitle2" gutterBottom>
            Critical Safety Concerns Detected
          </Typography>
          <Typography variant="body2">
            {criticalChecks.length} critical safety issue(s) found. Immediate attention required before implementing therapy changes.
          </Typography>
        </Alert>
      )}

      {/* Critical Checks */}
      {criticalChecks.length > 0 && (
        <Card variant="outlined" sx={{ borderColor: 'error.main', borderWidth: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
              <ErrorIcon />
              Critical Safety Issues ({criticalChecks.length})
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={2}>
              {criticalChecks.map((check, index) => (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: 'error.lighter',
                    border: '1px solid',
                    borderColor: 'error.main',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Chip
                      label={getCheckTypeLabel(check.checkType)}
                      color="error"
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(check.checkedAt), 'MMM dd, HH:mm')}
                    </Typography>
                  </Box>
                  <Typography variant="body1" fontWeight="medium" sx={{ mb: 1 }}>
                    {check.description}
                  </Typography>
                  {check.affectedMedications.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Affected Medications:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {check.affectedMedications.map((med, idx) => (
                          <Chip
                            key={idx}
                            label={med}
                            size="small"
                            icon={<LocalPharmacyIcon />}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  <Alert severity="error" sx={{ mt: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      Recommendation: {check.recommendation}
                    </Typography>
                  </Alert>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Major Checks */}
      {majorChecks.length > 0 && (
        <Card variant="outlined" sx={{ borderColor: 'error.light' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
              <ErrorIcon />
              Major Safety Issues ({majorChecks.length})
            </Typography>
            <Divider sx={{ my: 2 }} />
            <List>
              {majorChecks.map((check, index) => (
                <ListItem key={index} alignItems="flex-start" sx={{ bgcolor: 'background.default', mb: 1, borderRadius: 1 }}>
                  <ListItemIcon>
                    {getSeverityIcon(check.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                        <Chip label={getCheckTypeLabel(check.checkType)} size="small" color="error" />
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(check.checkedAt), 'MMM dd, HH:mm')}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {check.description}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Recommendation:</strong> {check.recommendation}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Moderate Checks */}
      {moderateChecks.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
              <WarningIcon />
              Moderate Safety Concerns ({moderateChecks.length})
            </Typography>
            <Divider sx={{ my: 2 }} />
            <List>
              {moderateChecks.map((check, index) => (
                <ListItem key={index} alignItems="flex-start" sx={{ bgcolor: 'background.default', mb: 1, borderRadius: 1 }}>
                  <ListItemIcon>
                    {getSeverityIcon(check.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                        <Chip label={getCheckTypeLabel(check.checkType)} size="small" color="warning" />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {check.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {check.recommendation}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Minor Checks */}
      {minorChecks.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'info.main' }}>
              <InfoIcon />
              Minor Safety Notes ({minorChecks.length})
            </Typography>
            <Divider sx={{ my: 2 }} />
            <List dense>
              {minorChecks.map((check, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {getSeverityIcon(check.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={getCheckTypeLabel(check.checkType)}
                    secondary={check.description}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default SafetyChecksDisplay;

