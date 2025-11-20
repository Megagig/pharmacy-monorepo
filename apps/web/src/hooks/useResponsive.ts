import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useState, useEffect } from 'react';

export interface ResponsiveBreakpoints {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallMobile: boolean;
  isLargeMobile: boolean;
  screenWidth: number;
  screenHeight: number;
  shouldUseCardLayout: boolean;
  getSpacing: (mobile: number, tablet?: number, desktop?: number) => number;
  getDialogMaxWidth: (mobile?: 'xs' | 'sm' | 'md' | 'lg' | 'xl', tablet?: 'xs' | 'sm' | 'md' | 'lg' | 'xl', desktop?: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  getColumns: (mobile: number, tablet?: number, desktop?: number, largeDesktop?: number, extraLarge?: number) => number;
}

export const useResponsive = (): ResponsiveBreakpoints => {
  const theme = useTheme();
  const [screenDimensions, setScreenDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  // MUI breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isLargeMobile = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper functions
  const shouldUseCardLayout = isMobile || isTablet;

  const getSpacing = (mobile: number, tablet: number = mobile, desktop: number = tablet): number => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    return desktop;
  };

  const getDialogMaxWidth = (
    mobile: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'xs',
    tablet: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm',
    desktop: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md'
  ): 'xs' | 'sm' | 'md' | 'lg' | 'xl' => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    return desktop;
  };

  const getColumns = (
    mobile: number,
    tablet: number = mobile,
    desktop: number = tablet,
    largeDesktop: number = desktop,
    extraLarge: number = largeDesktop
  ): number => {
    if (isSmallMobile) return mobile;
    if (isMobile) return tablet;
    if (isTablet) return desktop;
    if (screenDimensions.width >= 1920) return extraLarge;
    if (screenDimensions.width >= 1440) return largeDesktop;
    return desktop;
  };

  return {
    isMobile,
    isTablet,
    isDesktop,
    isSmallMobile,
    isLargeMobile,
    screenWidth: screenDimensions.width,
    screenHeight: screenDimensions.height,
    shouldUseCardLayout,
    getSpacing,
    getDialogMaxWidth,
    getColumns,
  };
};

export const useIsMobile = (): boolean => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
};

export const useIsTablet = (): boolean => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.between('md', 'lg'));
};

export const useIsDesktop = (): boolean => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('lg'));
};

// Touch device detection
export const useIsTouchDevice = (): boolean => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkTouchDevice = () => {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error
        navigator.msMaxTouchPoints > 0
      );
    };

    setIsTouchDevice(checkTouchDevice());
  }, []);

  return isTouchDevice;
};

// Orientation detection
export const useOrientation = () => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    handleOrientationChange(); // Set initial orientation
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return orientation;
};

// Safe area insets for mobile devices (notch support)
export const useSafeAreaInsets = () => {
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateSafeAreaInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      setSafeAreaInsets({
        top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0'),
      });
    };

    updateSafeAreaInsets();
    window.addEventListener('resize', updateSafeAreaInsets);
    window.addEventListener('orientationchange', updateSafeAreaInsets);

    return () => {
      window.removeEventListener('resize', updateSafeAreaInsets);
      window.removeEventListener('orientationchange', updateSafeAreaInsets);
    };
  }, []);

  return safeAreaInsets;
};