import React from 'react';
import { Alert as MuiAlert, AlertProps as MuiAlertProps } from '@mui/material';

interface AlertProps extends Omit<MuiAlertProps, 'severity'> {
  variant?: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  children,
  ...props
}) => {
  return (
    <MuiAlert
      severity={variant}
      {...props}
    >
      {children}
    </MuiAlert>
  );
};

export default Alert;