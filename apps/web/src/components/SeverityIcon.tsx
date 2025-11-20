import React from 'react';
import { Error as ErrorIcon, Warning as WarningIcon, Info as InfoIcon } from '@mui/icons-material';

interface SeverityIconProps {
  severity: string;
}

export const SeverityIcon: React.FC<SeverityIconProps> = ({ severity }) => {
  switch (severity.toUpperCase()) {
    case 'HIGH':
      return <ErrorIcon color="error" />;
    case 'MODERATE':
      return <WarningIcon color="warning" />;
    case 'LOW':
      return <InfoIcon color="info" />;
    default:
      return <InfoIcon />;
  }
};