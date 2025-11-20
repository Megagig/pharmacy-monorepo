import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Tooltip,
  ButtonGroup,
  Button,
} from '@mui/material';
import {
  Accessibility as AccessibilityIcon,
  TextIncrease as TextIncreaseIcon,
  TextDecrease as TextDecreaseIcon,
  Contrast as ContrastIcon,
  MotionPhotosOff as MotionOffIcon,
} from '@mui/icons-material';
import { useAccessibility } from './AccessibilityProvider';

/**
 * Accessibility Toolbar component
 * Provides quick access to accessibility settings and preferences
 */
const AccessibilityToolbar: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const {
    highContrastMode,
    toggleHighContrast,
    fontSize,
    setFontSize,
    reduceMotion,
    setReduceMotion,
    announceMessage,
  } = useAccessibility();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFontSizeChange = (newSize: 'small' | 'medium' | 'large') => {
    setFontSize(newSize);
    announceMessage(`Font size changed to ${newSize}`, 'assertive');
    handleMenuClose();
  };

  const handleHighContrastToggle = () => {
    toggleHighContrast();
    handleMenuClose();
  };

  const handleReduceMotionToggle = () => {
    setReduceMotion(!reduceMotion);
    announceMessage(
      reduceMotion ? 'Motion enabled' : 'Motion reduced',
      'assertive'
    );
    handleMenuClose();
  };

  return (
    <>
      <Tooltip title="Accessibility Options">
        <IconButton
          onClick={handleMenuOpen}
          aria-label="Open accessibility options"
          aria-expanded={Boolean(anchorEl)}
          aria-haspopup="true"
          sx={{
            color: 'text.primary',
            '&:focus': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          <AccessibilityIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            width: 280,
            maxWidth: '90vw',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="h6" gutterBottom>
            Accessibility Options
          </Typography>
        </Box>

        <Divider />

        {/* Font Size Controls */}
        <MenuItem disableRipple sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <Typography variant="subtitle2" gutterBottom>
            Font Size
          </Typography>
          <ButtonGroup
            variant="outlined"
            size="small"
            aria-label="font size selection"
            fullWidth
          >
            <Button
              onClick={() => handleFontSizeChange('small')}
              variant={fontSize === 'small' ? 'contained' : 'outlined'}
              aria-pressed={fontSize === 'small'}
            >
              Small
            </Button>
            <Button
              onClick={() => handleFontSizeChange('medium')}
              variant={fontSize === 'medium' ? 'contained' : 'outlined'}
              aria-pressed={fontSize === 'medium'}
            >
              Medium
            </Button>
            <Button
              onClick={() => handleFontSizeChange('large')}
              variant={fontSize === 'large' ? 'contained' : 'outlined'}
              aria-pressed={fontSize === 'large'}
            >
              Large
            </Button>
          </ButtonGroup>
        </MenuItem>

        <Divider />

        {/* High Contrast Toggle */}
        <MenuItem onClick={handleHighContrastToggle}>
          <FormControlLabel
            control={
              <Switch
                checked={highContrastMode}
                onChange={handleHighContrastToggle}
                inputProps={{
                  'aria-label': 'Toggle high contrast mode',
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ContrastIcon fontSize="small" />
                <Typography>High Contrast</Typography>
              </Box>
            }
            sx={{ margin: 0, width: '100%' }}
          />
        </MenuItem>

        <Divider />

        {/* Reduce Motion Toggle */}
        <MenuItem onClick={handleReduceMotionToggle}>
          <FormControlLabel
            control={
              <Switch
                checked={reduceMotion}
                onChange={handleReduceMotionToggle}
                inputProps={{
                  'aria-label': 'Toggle reduced motion',
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MotionOffIcon fontSize="small" />
                <Typography>Reduce Motion</Typography>
              </Box>
            }
            sx={{ margin: 0, width: '100%' }}
          />
        </MenuItem>

        <Divider />

        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            These settings are saved locally and will persist across sessions.
          </Typography>
        </Box>
      </Menu>
    </>
  );
};

export default AccessibilityToolbar;