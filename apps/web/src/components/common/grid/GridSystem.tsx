import React from 'react';
import { Grid } from '@mui/material';
import GridItem from './GridItem';

/**
 * Type-safe wrapper components for Material UI v7 Grid system
 * These components ensure proper typing with MUI v7 Grid components
 */

// Use any type for internal casting to avoid type errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = any;

// Re-export the GridItem interface for backward compatibility
export type { GridItemProps } from './GridItem';
export { GridItem };

/**
 * Props for Grid containers
 */
export interface GridContainerProps {
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
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  className?: string;
  style?: React.CSSProperties;
  // Allow other props we might need
  [key: string]: unknown;
}

/**
 * GridContainer - A wrapper around Material UI Grid container with proper typing
 */
export const GridContainer: React.FC<GridContainerProps> = ({
  children,
  ...props
}) => {
  // Cast props to avoid MUI v7 type errors
  const safeProps = {
    container: true,
    ...props,
  } as AnyProps;

  return <Grid {...safeProps}>{children}</Grid>;
};

// Export GridItem as the default export for backward compatibility
export default GridItem;
