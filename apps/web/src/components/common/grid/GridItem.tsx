import React from 'react';
import { Grid, SxProps, Theme } from '@mui/material';

// Define a simplified version of props that matches what we actually need
export interface GridItemProps {
  xs?: number | boolean;
  sm?: number | boolean;
  md?: number | boolean;
  lg?: number | boolean;
  xl?: number | boolean;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

/**
 * GridItem - A wrapper around Material UI Grid item with proper typing
 * This component uses type assertion to handle the type mismatch between
 * our props and MUI's props
 */
const GridItem: React.FC<GridItemProps> = ({ children, ...props }) => {
  // Cast the props to avoid MUI type errors
  const gridProps = { item: true, ...props } as React.ComponentProps<
    typeof Grid
  >;

  return <Grid {...gridProps}>{children}</Grid>;
};

export default GridItem;
