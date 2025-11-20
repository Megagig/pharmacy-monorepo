import React from 'react';
import { Grid } from '@mui/material';

/**
 * Grid wrapper components that handle Material UI v7 Grid typing issues
 */

// Using any type to bypass MUI's type constraints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = any;

/**
 * Props for Grid items
 */
interface GridItemProps {
  children: React.ReactNode;
  xs?: number | boolean;
  sm?: number | boolean;
  md?: number | boolean;
  lg?: number | boolean;
  xl?: number | boolean;
  sx?: Record<string, unknown>;
  spacing?: number;
  style?: React.CSSProperties;
  className?: string;
  [key: string]: unknown;
}

/**
 * GridItem - A wrapper around Material UI Grid that adds proper typing for Grid items
 */
export const GridItem: React.FC<GridItemProps> = ({ children, ...props }) => {
  // Using type assertion to bypass MUI's type constraints
  const gridProps = {
    item: true,
    ...props,
  } as AnyProps;

  return <Grid {...gridProps}>{children}</Grid>;
};

/**
 * Props for Grid containers
 */
interface GridContainerProps {
  children: React.ReactNode;
  spacing?: number;
  sx?: Record<string, unknown>;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  style?: React.CSSProperties;
  className?: string;
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  [key: string]: unknown;
}

/**
 * GridContainer - A wrapper around Material UI Grid container that adds proper typing
 */
export const GridContainer: React.FC<GridContainerProps> = ({
  children,
  ...props
}) => {
  // Using type assertion to bypass MUI's type constraints
  const gridProps = {
    container: true,
    ...props,
  } as AnyProps;

  return <Grid {...gridProps}>{children}</Grid>;
};

export default GridItem;
