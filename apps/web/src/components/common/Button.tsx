import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material';

interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  ...props
}) => {
  const getVariant = () => {
    switch (variant) {
      case 'primary':
        return 'contained';
      case 'secondary':
        return 'contained';
      case 'outline':
        return 'outlined';
      case 'ghost':
        return 'text';
      case 'danger':
        return 'contained';
      default:
        return 'contained';
    }
  };

  const getColor = () => {
    switch (variant) {
      case 'primary':
        return 'primary';
      case 'secondary':
        return 'secondary';
      case 'outline':
        return 'primary';
      case 'ghost':
        return 'primary';
      case 'danger':
        return 'error';
      default:
        return 'primary';
    }
  };

  const getSize = () => {
    switch (size) {
      case 'sm':
        return 'small';
      case 'md':
        return 'medium';
      case 'lg':
        return 'large';
      default:
        return 'medium';
    }
  };

  return (
    <MuiButton
      variant={getVariant()}
      color={getColor()}
      size={getSize()}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} /> : undefined}
      {...props}
    >
      {children}
    </MuiButton>
  );
};

export default Button;