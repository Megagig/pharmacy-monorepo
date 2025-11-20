import React from 'react';
import { Box, Typography, LinearProgress, Tooltip, Chip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Help as HelpIcon,
} from '@mui/icons-material';

interface ConfidenceIndicatorProps {
  confidence: number; // 0-1 scale
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showPercentage?: boolean;
  variant?: 'linear' | 'circular' | 'chip';
}

const getConfidenceLevel = (confidence: number) => {
  if (confidence >= 0.8) {
    return {
      level: 'high',
      label: 'High Confidence',
      color: 'success' as const,
      icon: CheckCircleIcon,
      description: 'AI analysis shows high confidence in this assessment',
    };
  } else if (confidence >= 0.6) {
    return {
      level: 'medium',
      label: 'Medium Confidence',
      color: 'warning' as const,
      icon: WarningIcon,
      description:
        'AI analysis shows moderate confidence - consider additional evaluation',
    };
  } else if (confidence >= 0.4) {
    return {
      level: 'low',
      label: 'Low Confidence',
      color: 'error' as const,
      icon: ErrorIcon,
      description:
        'AI analysis shows low confidence - manual review strongly recommended',
    };
  } else {
    return {
      level: 'very-low',
      label: 'Very Low Confidence',
      color: 'error' as const,
      icon: ErrorIcon,
      description:
        'AI analysis shows very low confidence - manual assessment required',
    };
  }
};

const getSizeConfig = (size: string) => {
  switch (size) {
    case 'small':
      return {
        height: 4,
        fontSize: '0.75rem',
        iconSize: 16,
        chipSize: 'small' as const,
      };
    case 'large':
      return {
        height: 8,
        fontSize: '1rem',
        iconSize: 24,
        chipSize: 'medium' as const,
      };
    default: // medium
      return {
        height: 6,
        fontSize: '0.875rem',
        iconSize: 20,
        chipSize: 'small' as const,
      };
  }
};

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  size = 'medium',
  showLabel = true,
  showPercentage = true,
  variant = 'linear',
}) => {
  const confidenceLevel = getConfidenceLevel(confidence);
  const sizeConfig = getSizeConfig(size);
  const percentage = Math.round(confidence * 100);
  const Icon = confidenceLevel.icon;

  const tooltipContent = (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {confidenceLevel.label} ({percentage}%)
      </Typography>
      <Typography variant="caption">{confidenceLevel.description}</Typography>
    </Box>
  );

  if (variant === 'chip') {
    return (
      <Tooltip title={tooltipContent} arrow>
        <Chip
          icon={<Icon sx={{ fontSize: sizeConfig.iconSize }} />}
          label={showPercentage ? `${percentage}%` : confidenceLevel.label}
          size={sizeConfig.chipSize}
          color={confidenceLevel.color}
          variant="outlined"
          sx={{
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          }}
        />
      </Tooltip>
    );
  }

  if (variant === 'circular') {
    return (
      <Tooltip title={tooltipContent} arrow>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size === 'small' ? 32 : size === 'large' ? 48 : 40,
              height: size === 'small' ? 32 : size === 'large' ? 48 : 40,
            }}
          >
            {/* Background circle */}
            <Box
              sx={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: `2px solid`,
                borderColor: 'grey.300',
              }}
            />
            {/* Progress circle */}
            <Box
              sx={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: `2px solid`,
                borderColor: `${confidenceLevel.color}.main`,
                borderTopColor: 'transparent',
                borderRightColor: 'transparent',
                transform: `rotate(${confidence * 360 - 90}deg)`,
                transition: 'transform 0.3s ease-in-out',
              }}
            />
            {/* Icon */}
            <Icon
              sx={{
                fontSize: sizeConfig.iconSize,
                color: `${confidenceLevel.color}.main`,
                zIndex: 1,
              }}
            />
          </Box>
          {(showLabel || showPercentage) && (
            <Box>
              {showLabel && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: sizeConfig.fontSize,
                    fontWeight: 600,
                    display: 'block',
                    color: `${confidenceLevel.color}.main`,
                  }}
                >
                  {confidenceLevel.label}
                </Typography>
              )}
              {showPercentage && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: sizeConfig.fontSize }}
                >
                  {percentage}%
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  }

  // Default linear variant
  return (
    <Tooltip title={tooltipContent} arrow>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: size === 'small' ? 80 : size === 'large' ? 150 : 120,
        }}
      >
        <Icon
          sx={{
            fontSize: sizeConfig.iconSize,
            color: `${confidenceLevel.color}.main`,
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 0.5,
            }}
          >
            {showLabel && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: sizeConfig.fontSize,
                  fontWeight: 600,
                  color: `${confidenceLevel.color}.main`,
                }}
              >
                {size === 'small'
                  ? confidenceLevel.level.toUpperCase()
                  : confidenceLevel.label}
              </Typography>
            )}
            {showPercentage && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: sizeConfig.fontSize }}
              >
                {percentage}%
              </Typography>
            )}
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={confidenceLevel.color}
            sx={{
              height: sizeConfig.height,
              borderRadius: sizeConfig.height / 2,
              backgroundColor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: sizeConfig.height / 2,
              },
            }}
          />
        </Box>
      </Box>
    </Tooltip>
  );
};

export default ConfidenceIndicator;
