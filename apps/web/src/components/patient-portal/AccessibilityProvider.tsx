import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

interface AccessibilityContextType {
  // Screen reader support
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void;
  
  // Keyboard navigation
  isKeyboardUser: boolean;
  
  // High contrast mode
  highContrastMode: boolean;
  toggleHighContrast: () => void;
  
  // Font size preferences
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  
  // Motion preferences
  reduceMotion: boolean;
  setReduceMotion: (reduce: boolean) => void;
  
  // Focus management
  focusElement: (elementId: string) => void;
  skipToContent: () => void;
}

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);
  const [announcer, setAnnouncer] = useState<HTMLElement | null>(null);

  // Initialize screen reader announcer
  useEffect(() => {
    const announcerElement = document.createElement('div');
    announcerElement.setAttribute('aria-live', 'polite');
    announcerElement.setAttribute('aria-atomic', 'true');
    announcerElement.setAttribute('aria-relevant', 'text');
    announcerElement.style.position = 'absolute';
    announcerElement.style.left = '-10000px';
    announcerElement.style.width = '1px';
    announcerElement.style.height = '1px';
    announcerElement.style.overflow = 'hidden';
    
    document.body.appendChild(announcerElement);
    setAnnouncer(announcerElement);

    return () => {
      if (document.body.contains(announcerElement)) {
        document.body.removeChild(announcerElement);
      }
    };
  }, []);

  // Detect keyboard usage
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Load saved preferences
  useEffect(() => {
    const savedPreferences = localStorage.getItem('patient-portal-accessibility');
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences);
        setHighContrastMode(preferences.highContrastMode || false);
        setFontSize(preferences.fontSize || 'medium');
        setReduceMotion(preferences.reduceMotion ?? prefersReducedMotion);
      } catch (error) {
        console.error('Failed to load accessibility preferences:', error);
      }
    }
  }, [prefersReducedMotion]);

  // Save preferences when they change
  useEffect(() => {
    const preferences = {
      highContrastMode,
      fontSize,
      reduceMotion,
    };
    localStorage.setItem('patient-portal-accessibility', JSON.stringify(preferences));
  }, [highContrastMode, fontSize, reduceMotion]);

  // Apply high contrast mode
  useEffect(() => {
    if (highContrastMode) {
      document.body.classList.add('high-contrast-mode');
    } else {
      document.body.classList.remove('high-contrast-mode');
    }
  }, [highContrastMode]);

  // Apply font size preferences
  useEffect(() => {
    document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    document.body.classList.add(`font-size-${fontSize}`);
  }, [fontSize]);

  // Apply motion preferences
  useEffect(() => {
    if (reduceMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
  }, [reduceMotion]);

  const announceMessage = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcer) {
      announcer.setAttribute('aria-live', priority);
      announcer.textContent = message;
      
      // Clear the message after a short delay to allow for re-announcements
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  };

  const toggleHighContrast = () => {
    setHighContrastMode(!highContrastMode);
    announceMessage(
      highContrastMode ? 'High contrast mode disabled' : 'High contrast mode enabled',
      'assertive'
    );
  };

  const focusElement = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      announceMessage(`Focused on ${element.getAttribute('aria-label') || elementId}`);
    }
  };

  const skipToContent = () => {
    const mainContent = document.querySelector('main') || document.getElementById('main-content');
    if (mainContent) {
      (mainContent as HTMLElement).focus();
      announceMessage('Skipped to main content');
    }
  };

  const value = {
    announceMessage,
    isKeyboardUser,
    highContrastMode,
    toggleHighContrast,
    fontSize,
    setFontSize,
    reduceMotion,
    setReduceMotion,
    focusElement,
    skipToContent,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export default AccessibilityProvider;