import React from 'react';
import { Grid } from '@mui/material';

// This is a utility to fix Grid component issues in Material UI v7
// It ensures the Grid item component has a proper "component" property

// Use a type assertion to bypass MUI v7 typing issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GridProps = any;

interface FixedGridItemProps {
  children?: React.ReactNode;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  spacing?: number;
  sx?: Record<string, unknown> | { [key: string]: unknown };
}

export const FixedGridItem: React.FC<FixedGridItemProps> = ({
  children,
  ...props
}) => {
  // Cast the Grid component to any to bypass type checking
  const TypedGrid = Grid as React.ComponentType<GridProps>;

  return (
    <TypedGrid component="div" item {...props}>
      {children}
    </TypedGrid>
  );
};

interface FixedGridContainerProps {
  children?: React.ReactNode;
  spacing?: number;
  sx?: Record<string, unknown> | { [key: string]: unknown };
}

export const FixedGridContainer: React.FC<FixedGridContainerProps> = ({
  children,
  ...props
}) => {
  // Cast the Grid component to any to bypass type checking
  const TypedGrid = Grid as React.ComponentType<GridProps>;

  return (
    <TypedGrid component="div" container {...props}>
      {children}
    </TypedGrid>
  );
};
