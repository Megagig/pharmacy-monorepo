import React from 'react';
import { Paper, PaperProps } from '@mui/material';

interface CardProps extends PaperProps {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  ...props
}) => {
  return (
    <Paper
      elevation={1}
      {...props}
    >
      {children}
    </Paper>
  );
};

export default Card;