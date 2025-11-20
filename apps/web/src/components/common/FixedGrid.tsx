import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';

interface FixedGridProps {
  children: React.ReactNode;
  container?: boolean;
  item?: boolean;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  spacing?: number;
  alignItems?: string;
  sx?: SxProps<Theme>;
}

export const FixedGrid: React.FC<FixedGridProps> = ({
  children,
  container,
  item,
  xs,
  sm,
  md,
  lg,
  xl,
  spacing,
  alignItems,
  sx,
  ...props
}) => {
  if (container) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: alignItems || 'stretch',
          gap: spacing ? `${spacing * 8}px` : 0,
          ...sx,
        }}
        {...props}
      >
        {children}
      </Box>
    );
  }

  if (item) {
    const flexBasis = xs ? `${(xs / 12) * 100}%` : 'auto';
    const smFlexBasis = sm ? `${(sm / 12) * 100}%` : flexBasis;
    const mdFlexBasis = md ? `${(md / 12) * 100}%` : smFlexBasis;
    const lgFlexBasis = lg ? `${(lg / 12) * 100}%` : mdFlexBasis;
    const xlFlexBasis = xl ? `${(xl / 12) * 100}%` : lgFlexBasis;

    return (
      <Box
        sx={{
          flexBasis: flexBasis,
          maxWidth: flexBasis,
          '@media (min-width: 600px)': sm
            ? {
                flexBasis: smFlexBasis,
                maxWidth: smFlexBasis,
              }
            : {},
          '@media (min-width: 900px)': md
            ? {
                flexBasis: mdFlexBasis,
                maxWidth: mdFlexBasis,
              }
            : {},
          '@media (min-width: 1200px)': lg
            ? {
                flexBasis: lgFlexBasis,
                maxWidth: lgFlexBasis,
              }
            : {},
          '@media (min-width: 1536px)': xl
            ? {
                flexBasis: xlFlexBasis,
                maxWidth: xlFlexBasis,
              }
            : {},
          ...sx,
        }}
        {...props}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box sx={sx} {...props}>
      {children}
    </Box>
  );
};

export default FixedGrid;
