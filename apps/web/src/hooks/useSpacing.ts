import { useTheme } from '@mui/material/styles';
import { useResponsive } from './useResponsive';

export const useSpacing = () => {
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  const getSpacing = (mobile: number, tablet: number, desktop: number) => {
    if (isMobile) return theme.spacing(mobile);
    if (isTablet) return theme.spacing(tablet);
    return theme.spacing(desktop);
  };

  const getResponsiveSpacing = (base: number, multiplier = 0.5) => {
    if (isMobile) return theme.spacing(base * multiplier);
    if (isTablet) return theme.spacing(base * 0.75);
    return theme.spacing(base);
  };

  // Return a function that can be called directly, with additional methods
  const spacingFunction = (mobile: number, tablet: number, desktop: number) => {
    return getSpacing(mobile, tablet, desktop);
  };

  // Add the methods to the function
  spacingFunction.getSpacing = getSpacing;
  spacingFunction.getResponsiveSpacing = getResponsiveSpacing;
  spacingFunction.spacing = theme.spacing;

  return spacingFunction;
};