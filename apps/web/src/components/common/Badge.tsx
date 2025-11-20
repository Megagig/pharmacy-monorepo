import React from 'react';
import { Chip, ChipProps } from '@mui/material';

interface BadgeProps extends Omit<ChipProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  const getColor = () => {
    switch (variant) {
      case 'primary':
        return 'primary';
      case 'secondary':
        return 'secondary';
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
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
        return 'medium'; // MUI doesn't have large size
      default:
        return 'medium';
    }
  };

  return (
    <Chip
      color={getColor()}
      size={getSize()}
      label={children}
      {...props}
    />
  );
};

export default Badge;