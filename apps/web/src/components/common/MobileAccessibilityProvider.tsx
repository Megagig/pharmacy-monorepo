import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

interface AccessibilitySettings {
  // Visual accessibility
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  
  // Motor accessibility
  touchTargetSize: 'small' | 'medium' | 'large';
  gestureTimeout: number;
  
  // Cognitive accessibility
  simplifiedUI: boolean;
  confirmActions: boolean;
  
  // Screen reader
  screenReaderEnabled: boolean;
  announceChanges: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  isTouchDevice: boolean;
  isLargeScreen: boolean;
  preferredInputMethod: 'touch' | 'mouse' | 'keyboard';
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface MobileAccessibilityProviderProps {
  children: ReactNode;
}

export const MobileAccessibilityProvider: React.FC<MobileAccessibilityProviderProps> = ({
  children,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  
  // Detect system preferences
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const prefersHighContrast = useMediaQuery('(prefers-contrast: high)');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Detect device capabilities
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [preferredInputMethod, setPreferredInputMethod] = useState<'touch' | 'mouse' | 'keyboard'>('mouse');
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  // Accessibility settings state
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: prefersHighContrast,
    largeText: false,
    reducedMotion: prefersReducedMotion,
    touchTargetSize: isMobile ? 'large' : 'medium',
    gestureTimeout: 500,
    simplifiedUI: false,
    confirmActions: false,
    screenReaderEnabled: false,
    announceChanges: true,
  });

  // Detect touch device
  useEffect(() => {
    const checkTouchDevice = () => {
      const hasTouch = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - Legacy property
        navigator.msMaxTouchPoints > 0
      );
      setIsTouchDevice(hasTouch);
      
      if (hasTouch) {
        setPreferredInputMethod('touch');
      }
    };

    checkTouchDevice();
    
    // Listen for input method changes
    const handleMouseMove = () => setPreferredInputMethod('mouse');
    const handleTouchStart = () => setPreferredInputMethod('touch');
    const handleKeyDown = () => setPreferredInputMethod('keyboard');

    document.addEventListener('mousemove', handleMouseMove, { once: true });
    document.addEventListener('touchstart', handleTouchStart, { once: true });
    document.addEventListener('keydown', handleKeyDown, { once: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Detect screen reader
  useEffect(() => {
    const checkScreenReader = () => {
      // Check for common screen reader indicators
      const hasScreenReader = (
        // @ts-expect-error - Screen reader detection
        window.speechSynthesis ||
        // @ts-expect-error - Screen reader detection
        window.navigator.userAgent.includes('NVDA') ||
        // @ts-expect-error - Screen reader detection
        window.navigator.userAgent.includes('JAWS') ||
        // @ts-expect-error - Screen reader detection
        window.navigator.userAgent.includes('VoiceOver')
      );
      
      setScreenReaderEnabled(hasScreenReader);
      setSettings(prev => ({ ...prev, screenReaderEnabled: hasScreenReader }));
    };

    checkScreenReader();
  }, []);

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('accessibility-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Failed to load accessibility settings:', error);
    }
  }, []);

  // Update settings function
  const updateSettings = (updates: Partial<AccessibilitySettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      
      // Save to localStorage
      try {
        localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
      } catch (error) {
        console.warn('Failed to save accessibility settings:', error);
      }
      
      return newSettings;
    });
  };

  // Screen reader announcement function
  const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.announceChanges) return;

    // Create or update live region
    let liveRegion = document.getElementById('accessibility-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'accessibility-live-region';
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }

    // Update the live region
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 1000);
  };

  // Apply accessibility styles
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast
    if (settings.highContrast) {
      root.style.setProperty('--accessibility-contrast', 'high');
      document.body.classList.add('high-contrast');
    } else {
      root.style.removeProperty('--accessibility-contrast');
      document.body.classList.remove('high-contrast');
    }

    // Large text
    if (settings.largeText) {
      root.style.setProperty('--accessibility-font-scale', '1.2');
      document.body.classList.add('large-text');
    } else {
      root.style.removeProperty('--accessibility-font-scale');
      document.body.classList.remove('large-text');
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.style.setProperty('--accessibility-motion', 'none');
      document.body.classList.add('reduced-motion');
    } else {
      root.style.removeProperty('--accessibility-motion');
      document.body.classList.remove('reduced-motion');
    }

    // Touch target size
    const touchTargetSizes = {
      small: '32px',
      medium: '44px',
      large: '56px',
    };
    root.style.setProperty('--accessibility-touch-target', touchTargetSizes[settings.touchTargetSize]);

    // Simplified UI
    if (settings.simplifiedUI) {
      document.body.classList.add('simplified-ui');
    } else {
      document.body.classList.remove('simplified-ui');
    }

    return () => {
      // Cleanup on unmount
      document.body.classList.remove('high-contrast', 'large-text', 'reduced-motion', 'simplified-ui');
    };
  }, [settings]);

  // Keyboard navigation enhancement
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip to main content (Alt + M)
      if (event.altKey && event.key === 'm') {
        event.preventDefault();
        const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
        if (mainContent) {
          (mainContent as HTMLElement).focus();
          announceToScreenReader('Skipped to main content');
        }
      }

      // Skip to navigation (Alt + N)
      if (event.altKey && event.key === 'n') {
        event.preventDefault();
        const navigation = document.querySelector('nav') || document.querySelector('[role="navigation"]');
        if (navigation) {
          (navigation as HTMLElement).focus();
          announceToScreenReader('Skipped to navigation');
        }
      }

      // Escape key to close modals/dialogs
      if (event.key === 'Escape') {
        const openDialog = document.querySelector('[role="dialog"][aria-hidden="false"]');
        if (openDialog) {
          const closeButton = openDialog.querySelector('[aria-label*="close"], [aria-label*="Close"]');
          if (closeButton) {
            (closeButton as HTMLElement).click();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [announceToScreenReader]);

  // Focus management for mobile
  useEffect(() => {
    if (!isTouchDevice) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      
      // Ensure focused elements are visible on mobile
      if (target && target.scrollIntoView) {
        setTimeout(() => {
          target.scrollIntoView({
            behavior: settings.reducedMotion ? 'auto' : 'smooth',
            block: 'center',
          });
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [isTouchDevice, settings.reducedMotion]);

  const contextValue: AccessibilityContextType = {
    settings,
    updateSettings,
    announceToScreenReader,
    isTouchDevice,
    isLargeScreen,
    preferredInputMethod,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
      
      {/* Skip links for keyboard navigation */}
      <div className="skip-links" style={{
        position: 'absolute',
        top: '-40px',
        left: '6px',
        zIndex: 9999,
      }}>
        <a
          href="#main-content"
          style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
          onFocus={(e) => {
            e.target.style.position = 'static';
            e.target.style.left = 'auto';
            e.target.style.top = 'auto';
            e.target.style.width = 'auto';
            e.target.style.height = 'auto';
            e.target.style.overflow = 'visible';
            e.target.style.padding = '8px';
            e.target.style.backgroundColor = theme.palette.primary.main;
            e.target.style.color = theme.palette.primary.contrastText;
            e.target.style.textDecoration = 'none';
            e.target.style.borderRadius = '4px';
          }}
          onBlur={(e) => {
            e.target.style.position = 'absolute';
            e.target.style.left = '-10000px';
            e.target.style.top = 'auto';
            e.target.style.width = '1px';
            e.target.style.height = '1px';
            e.target.style.overflow = 'hidden';
          }}
        >
          Skip to main content
        </a>
      </div>

      {/* Accessibility styles */}
      <style jsx global>{`
        /* High contrast mode */
        .high-contrast {
          --accessibility-border-width: 2px;
          --accessibility-focus-width: 3px;
        }

        .high-contrast * {
          border-width: var(--accessibility-border-width, 1px) !important;
        }

        .high-contrast *:focus {
          outline-width: var(--accessibility-focus-width, 2px) !important;
          outline-style: solid !important;
          outline-color: currentColor !important;
        }

        /* Large text mode */
        .large-text {
          font-size: calc(1rem * var(--accessibility-font-scale, 1)) !important;
        }

        .large-text * {
          font-size: inherit !important;
        }

        /* Reduced motion */
        .reduced-motion *,
        .reduced-motion *::before,
        .reduced-motion *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }

        /* Touch target sizing */
        .MuiButton-root,
        .MuiIconButton-root,
        .MuiChip-root,
        .MuiTab-root,
        .MuiMenuItem-root,
        .MuiListItemButton-root {
          min-height: var(--accessibility-touch-target, 44px) !important;
          min-width: var(--accessibility-touch-target, 44px) !important;
        }

        /* Simplified UI mode */
        .simplified-ui .MuiCard-root {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
        }

        .simplified-ui .MuiButton-root {
          border-radius: 8px !important;
        }

        .simplified-ui .MuiChip-root {
          border-radius: 16px !important;
        }

        /* Focus indicators */
        *:focus {
          outline: 2px solid ${theme.palette.primary.main} !important;
          outline-offset: 2px !important;
        }

        /* Screen reader only content */
        .sr-only {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          padding: 0 !important;
          margin: -1px !important;
          overflow: hidden !important;
          clip: rect(0, 0, 0, 0) !important;
          white-space: nowrap !important;
          border: 0 !important;
        }

        /* Mobile accessibility enhancements */
        @media (max-width: 768px) {
          /* Larger touch targets on mobile */
          .MuiButton-root,
          .MuiIconButton-root {
            min-height: 48px !important;
            min-width: 48px !important;
          }

          /* Better spacing for touch */
          .MuiList-root .MuiListItem-root {
            padding: 12px 16px !important;
          }

          /* Improved form controls */
          .MuiTextField-root .MuiInputBase-root {
            min-height: 56px !important;
          }
        }

        /* Dark mode accessibility */
        @media (prefers-color-scheme: dark) {
          .high-contrast {
            --accessibility-bg: #000000;
            --accessibility-text: #ffffff;
            --accessibility-border: #ffffff;
          }
        }

        /* Print accessibility */
        @media print {
          .skip-links,
          .MuiFab-root,
          .MuiSpeedDial-root {
            display: none !important;
          }

          * {
            color: black !important;
            background: white !important;
          }
        }
      `}</style>
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within MobileAccessibilityProvider');
  }
  return context;
};

// Helper hook for screen reader announcements
export const useScreenReaderAnnouncements = () => {
  const { announceToScreenReader, settings } = useAccessibility();

  const announceNavigation = (pageName: string) => {
    announceToScreenReader(`Navigated to ${pageName}`);
  };

  const announceAction = (action: string, result?: string) => {
    const message = result ? `${action}. ${result}` : action;
    announceToScreenReader(message, 'assertive');
  };

  const announceError = (error: string) => {
    announceToScreenReader(`Error: ${error}`, 'assertive');
  };

  const announceSuccess = (message: string) => {
    announceToScreenReader(`Success: ${message}`, 'assertive');
  };

  return {
    announceNavigation,
    announceAction,
    announceError,
    announceSuccess,
    announceToScreenReader,
    isEnabled: settings.announceChanges,
  };
};