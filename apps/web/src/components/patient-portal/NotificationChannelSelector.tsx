import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  Notifications as NotificationsIcon,
  WhatsApp as WhatsAppIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

export interface NotificationChannels {
  email: boolean;
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
}

interface NotificationChannelSelectorProps {
  channels: NotificationChannels;
  onChange: (channels: NotificationChannels) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  showLabels?: boolean;
  compact?: boolean;
}

const CHANNEL_CONFIG = [
  {
    key: 'email' as keyof NotificationChannels,
    label: 'Email',
    icon: <EmailIcon fontSize="small" />,
    description: 'Receive notifications via email',
    color: '#1976d2',
  },
  {
    key: 'sms' as keyof NotificationChannels,
    label: 'SMS',
    icon: <SmsIcon fontSize="small" />,
    description: 'Receive notifications via text message',
    color: '#388e3c',
  },
  {
    key: 'push' as keyof NotificationChannels,
    label: 'Push',
    icon: <NotificationsIcon fontSize="small" />,
    description: 'Receive push notifications in the app',
    color: '#f57c00',
  },
  {
    key: 'whatsapp' as keyof NotificationChannels,
    label: 'WhatsApp',
    icon: <WhatsAppIcon fontSize="small" />,
    description: 'Receive notifications via WhatsApp',
    color: '#25d366',
  },
];

const NotificationChannelSelector: React.FC<NotificationChannelSelectorProps> = ({
  channels,
  onChange,
  disabled = false,
  title,
  description,
  showLabels = true,
  compact = false,
}) => {
  const handleChannelChange = (channel: keyof NotificationChannels, enabled: boolean) => {
    onChange({
      ...channels,
      [channel]: enabled,
    });
  };

  const enabledChannels = Object.entries(channels).filter(([_, enabled]) => enabled);
  const enabledCount = enabledChannels.length;

  if (compact) {
    return (
      <Box>
        {title && (
          <Typography variant="subtitle2" gutterBottom>
            {title}
          </Typography>
        )}
        
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {CHANNEL_CONFIG.map((config) => (
            <Tooltip key={config.key} title={config.description}>
              <Chip
                icon={config.icon}
                label={config.label}
                variant={channels[config.key] ? 'filled' : 'outlined'}
                color={channels[config.key] ? 'primary' : 'default'}
                onClick={() => handleChannelChange(config.key, !channels[config.key])}
                disabled={disabled}
                sx={{
                  cursor: disabled ? 'default' : 'pointer',
                  '&:hover': {
                    backgroundColor: disabled ? 'inherit' : 'action.hover',
                  },
                }}
              />
            </Tooltip>
          ))}
        </Stack>

        {enabledCount === 0 && (
          <Typography variant="caption" color="warning.main" display="block" mt={1}>
            No notification channels selected
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="subtitle1">
            {title}
          </Typography>
          {description && (
            <Tooltip title={description}>
              <InfoIcon fontSize="small" color="action" />
            </Tooltip>
          )}
        </Box>
      )}

      {description && !title && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>
      )}

      <FormGroup>
        {CHANNEL_CONFIG.map((config) => (
          <FormControlLabel
            key={config.key}
            control={
              <Switch
                checked={channels[config.key]}
                onChange={(e) => handleChannelChange(config.key, e.target.checked)}
                disabled={disabled}
                size="small"
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  width={24}
                  height={24}
                  borderRadius="50%"
                  bgcolor={channels[config.key] ? `${config.color}20` : 'transparent'}
                  color={channels[config.key] ? config.color : 'text.secondary'}
                >
                  {config.icon}
                </Box>
                {showLabels && (
                  <Typography variant="body2">
                    {config.label}
                  </Typography>
                )}
              </Box>
            }
            sx={{
              ml: 0,
              '& .MuiFormControlLabel-label': {
                ml: 1,
              },
            }}
          />
        ))}
      </FormGroup>

      {/* Summary */}
      <Box mt={1}>
        {enabledCount > 0 ? (
          <Typography variant="caption" color="text.secondary">
            {enabledCount} channel{enabledCount !== 1 ? 's' : ''} enabled
          </Typography>
        ) : (
          <Typography variant="caption" color="warning.main">
            No notification channels selected
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default NotificationChannelSelector;