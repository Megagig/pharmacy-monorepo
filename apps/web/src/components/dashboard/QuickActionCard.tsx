import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Avatar,
  alpha,
  useTheme,
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  navigateTo: string;
  buttonText?: string;
  disabled?: boolean;
  badge?: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon,
  color,
  navigateTo,
  buttonText = 'Go',
  disabled = false,
  badge,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleClick = () => {
    if (!disabled) {
      navigate(navigateTo);
    }
  };

  return (
    <motion.div
      whileHover={!disabled ? { y: -6, scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Card
        sx={{
          height: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(
            color,
            0.05
          )} 100%)`,
          border: `1px solid ${alpha(color, 0.2)}`,
          position: 'relative',
          overflow: 'visible',
          opacity: disabled ? 0.6 : 1,
          '&:hover': !disabled
            ? {
                boxShadow: `0 12px 40px ${alpha(color, 0.3)}`,
                '& .action-button': {
                  transform: 'translateX(4px)',
                },
                '& .action-icon': {
                  transform: 'scale(1.1)',
                },
              }
            : {},
        }}
        onClick={handleClick}
      >
        <CardContent
          sx={{
            p: 3,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Background Pattern */}
          <Box
            sx={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${alpha(
                color,
                0.08
              )}, ${alpha(color, 0.03)})`,
              zIndex: 0,
            }}
          />

          {/* Badge */}
          {badge && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                bgcolor: color,
                color: 'white',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                zIndex: 2,
              }}
            >
              {badge}
            </Box>
          )}

          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header with Icon */}
            <Box display="flex" alignItems="center" mb={2}>
              <Avatar
                className="action-icon"
                sx={{
                  bgcolor: alpha(color, 0.15),
                  color: color,
                  width: 48,
                  height: 48,
                  mr: 2,
                  transition: 'transform 0.2s ease',
                }}
              >
                {typeof icon === 'string' ? (
                  <Box sx={{ fontSize: '1.5rem' }}>{icon}</Box>
                ) : (
                  icon
                )}
              </Avatar>
              <Typography
                variant="h6"
                component="div"
                sx={{
                  fontWeight: 'bold',
                  color: 'text.primary',
                }}
              >
                {title}
              </Typography>
            </Box>

            {/* Description */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 3,
                flexGrow: 1,
                lineHeight: 1.6,
              }}
            >
              {description}
            </Typography>

            {/* Action Button */}
            <Button
              className="action-button"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              disabled={disabled}
              sx={{
                backgroundColor: color,
                color: 'white',
                alignSelf: 'flex-start',
                borderRadius: 2,
                px: 3,
                py: 1,
                fontWeight: 'bold',
                textTransform: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: alpha(color, 0.8),
                  boxShadow: `0 4px 16px ${alpha(color, 0.4)}`,
                },
                '&:disabled': {
                  backgroundColor: alpha(color, 0.3),
                  color: alpha(theme.palette.common.white, 0.7),
                },
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              {buttonText}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default QuickActionCard;
