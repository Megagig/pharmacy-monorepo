import React from 'react';
import { Box, Button } from '@mui/material';
import { useAccessibility } from './AccessibilityProvider';

/**
 * Skip Navigation component for keyboard accessibility
 * Provides quick navigation options for screen reader and keyboard users
 */
const SkipNavigation: React.FC = () => {
  const { skipToContent, focusElement } = useAccessibility();

  const skipLinks = [
    {
      label: 'Skip to main content',
      action: skipToContent,
    },
    {
      label: 'Skip to navigation',
      action: () => focusElement('patient-navigation'),
    },
    {
      label: 'Skip to search',
      action: () => focusElement('search-input'),
    },
  ];

  return (
    <Box
      component="nav"
      aria-label="Skip navigation"
      sx={{
        position: 'absolute',
        top: -1000,
        left: 0,
        zIndex: 9999,
        '&:focus-within': {
          top: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          p: 1,
          display: 'flex',
          gap: 1,
          justifyContent: 'center',
          boxShadow: 2,
        },
      }}
    >
      {skipLinks.map((link, index) => (
        <Button
          key={index}
          variant="outlined"
          size="small"
          onClick={link.action}
          sx={{
            minWidth: 'auto',
            whiteSpace: 'nowrap',
            '&:focus': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          {link.label}
        </Button>
      ))}
    </Box>
  );
};

export default SkipNavigation;