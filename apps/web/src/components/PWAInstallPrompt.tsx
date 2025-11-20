import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  IconButton,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  GetApp as InstallIcon,
  Close as CloseIcon,
  Smartphone as SmartphoneIcon,
  Computer as ComputerIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { pwaManager, pwaUtils } from '../utils/pwaUtils';

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
  showOnMobileOnly?: boolean;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onInstall,
  onDismiss,
  showOnMobileOnly = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [pwaState, setPwaState] = useState(pwaManager.getState());
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Subscribe to PWA state changes
    const unsubscribe = pwaManager.subscribe(setPwaState);

    // Check if we should show the prompt
    const shouldShow =
      pwaState.isInstallable &&
      !pwaState.isInstalled &&
      !isDismissed &&
      (!showOnMobileOnly || isMobile);

    setShowPrompt(shouldShow);

    return unsubscribe;
  }, [
    pwaState.isInstallable,
    pwaState.isInstalled,
    isDismissed,
    showOnMobileOnly,
    isMobile,
  ]);

  // Don't render if dismissed or conditions not met
  if (!showPrompt) {
    return null;
  }

  const handleInstall = async () => {
    try {
      const success = await pwaManager.install();
      if (success) {
        onInstall?.();
        pwaUtils.trackPWAEvent('install_accepted');
      } else {
        pwaUtils.trackPWAEvent('install_dismissed');
      }
    } catch (error) {
      console.error('Installation failed:', error);
      pwaUtils.trackPWAEvent('install_failed', { error: error.message });
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowPrompt(false);
    onDismiss?.();
    pwaUtils.trackPWAEvent('install_prompt_dismissed');
  };

  const getDeviceIcon = () => {
    const deviceType = pwaUtils.getDeviceType();
    switch (deviceType) {
      case 'mobile':
      case 'tablet':
        return <SmartphoneIcon />;
      default:
        return <ComputerIcon />;
    }
  };

  const getInstallText = () => {
    const deviceType = pwaUtils.getDeviceType();
    switch (deviceType) {
      case 'mobile':
        return 'Install app for quick access';
      case 'tablet':
        return 'Add to home screen for better experience';
      default:
        return 'Install Clinical Interventions app';
    }
  };

  const getBenefits = () => {
    const deviceType = pwaUtils.getDeviceType();
    const commonBenefits = [
      'Work offline',
      'Faster loading',
      'Push notifications',
    ];

    if (deviceType === 'mobile' || deviceType === 'tablet') {
      return [
        ...commonBenefits,
        'Home screen access',
        'Full screen experience',
      ];
    }

    return [...commonBenefits, 'Desktop shortcut', 'Native app feel'];
  };

  return (
    <Slide direction="up" in={showPrompt} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: isMobile ? 16 : 24,
          left: isMobile ? 16 : 24,
          right: isMobile ? 16 : 'auto',
          zIndex: 1300,
          maxWidth: isMobile ? 'none' : 400,
        }}
      >
        <Card
          elevation={8}
          sx={{
            borderRadius: 3,
            overflow: 'visible',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
          }}
        >
          <CardContent
            sx={{ p: isMobile ? 2 : 3, pb: `${isMobile ? 2 : 3}px !important` }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  mr: 2,
                  flexShrink: 0,
                }}
              >
                {getDeviceIcon()}
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant={isMobile ? 'subtitle1' : 'h6'}
                  fontWeight="bold"
                  gutterBottom
                >
                  {getInstallText()}
                </Typography>

                <Typography
                  variant={isMobile ? 'body2' : 'body1'}
                  sx={{ opacity: 0.9, mb: 2 }}
                >
                  Get the full Clinical Interventions experience
                </Typography>

                {/* Benefits list */}
                <Box sx={{ mb: 2 }}>
                  {getBenefits()
                    .slice(0, isMobile ? 2 : 3)
                    .map((benefit, index) => (
                      <Typography
                        key={index}
                        variant="caption"
                        sx={{
                          display: 'block',
                          opacity: 0.8,
                          '&:before': {
                            content: '"✓ "',
                            fontWeight: 'bold',
                          },
                        }}
                      >
                        {benefit}
                      </Typography>
                    ))}
                </Box>
              </Box>

              <IconButton
                size="small"
                onClick={handleDismiss}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Action buttons */}
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <Button
                variant="contained"
                startIcon={<InstallIcon />}
                onClick={handleInstall}
                sx={{
                  bgcolor: 'white',
                  color: theme.palette.primary.main,
                  fontWeight: 'bold',
                  flex: isMobile ? undefined : 1,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                  },
                }}
                fullWidth={isMobile}
              >
                Install Now
              </Button>

              <Button
                variant="text"
                onClick={handleDismiss}
                sx={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
                size={isMobile ? 'small' : 'medium'}
              >
                Maybe Later
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Slide>
  );
};

// Update notification component
export const PWAUpdatePrompt: React.FC<{
  onUpdate?: () => void;
  onDismiss?: () => void;
}> = ({ onUpdate, onDismiss }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [pwaState, setPwaState] = useState(pwaManager.getState());
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const unsubscribe = pwaManager.subscribe(setPwaState);
    setShowPrompt(pwaState.isUpdateAvailable);
    return unsubscribe;
  }, [pwaState.isUpdateAvailable]);

  const handleUpdate = async () => {
    try {
      await pwaManager.updateApp();
      onUpdate?.();
      pwaUtils.trackPWAEvent('update_accepted');
    } catch (error) {
      console.error('Update failed:', error);
      pwaUtils.trackPWAEvent('update_failed', { error: error.message });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    onDismiss?.();
    pwaUtils.trackPWAEvent('update_dismissed');
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <Slide direction="down" in={showPrompt} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: isMobile ? 16 : 24,
          left: isMobile ? 16 : 24,
          right: isMobile ? 16 : 'auto',
          zIndex: 1300,
          maxWidth: isMobile ? 'none' : 400,
        }}
      >
        <Card
          elevation={8}
          sx={{
            borderRadius: 3,
            background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
            color: 'white',
          }}
        >
          <CardContent
            sx={{ p: isMobile ? 2 : 3, pb: `${isMobile ? 2 : 3}px !important` }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  mr: 2,
                  flexShrink: 0,
                }}
              >
                <UpdateIcon />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant={isMobile ? 'subtitle1' : 'h6'}
                  fontWeight="bold"
                  gutterBottom
                >
                  Update Available
                </Typography>

                <Typography
                  variant={isMobile ? 'body2' : 'body1'}
                  sx={{ opacity: 0.9, mb: 2 }}
                >
                  A new version with improvements and bug fixes is ready
                </Typography>
              </Box>

              <IconButton
                size="small"
                onClick={handleDismiss}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <Button
                variant="contained"
                startIcon={<UpdateIcon />}
                onClick={handleUpdate}
                sx={{
                  bgcolor: 'white',
                  color: theme.palette.success.main,
                  fontWeight: 'bold',
                  flex: isMobile ? undefined : 1,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                  },
                }}
                fullWidth={isMobile}
              >
                Update Now
              </Button>

              <Button
                variant="text"
                onClick={handleDismiss}
                sx={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
                size={isMobile ? 'small' : 'medium'}
              >
                Later
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Slide>
  );
};

export default PWAInstallPrompt;
