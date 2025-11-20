import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, Chip } from '@mui/material';
import { useTypingIndicator } from '../../hooks/useSocket';

interface TypingIndicatorProps {
  conversationId: string;
  participants?: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;
  variant?: 'compact' | 'full' | 'avatars';
  maxVisible?: number;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  conversationId,
  participants = [],
  variant = 'compact',
  maxVisible = 3,
}) => {
  const { typingUsers } = useTypingIndicator(conversationId);
  const [animationKey, setAnimationKey] = useState(0);

  // Trigger animation when typing users change
  useEffect(() => {
    if (typingUsers.length > 0) {
      setAnimationKey((prev) => prev + 1);
    }
  }, [typingUsers]);

  if (typingUsers.length === 0) {
    return null;
  }

  // Get participant info for typing users
  const typingParticipants = typingUsers
    .map((userId) => participants.find((p) => p.userId === userId))
    .filter(Boolean)
    .slice(0, maxVisible);

  const remainingCount = Math.max(0, typingUsers.length - maxVisible);

  const getTypingText = () => {
    if (typingParticipants.length === 0) {
      return `${typingUsers.length} user${
        typingUsers.length > 1 ? 's' : ''
      } typing...`;
    }

    const names = typingParticipants.map((p) => p!.firstName);

    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      const displayNames = names.slice(0, 2).join(', ');
      const additionalCount = names.length - 2 + remainingCount;
      return `${displayNames} and ${additionalCount} other${
        additionalCount > 1 ? 's' : ''
      } are typing...`;
    }
  };

  if (variant === 'avatars') {
    return (
      <Box
        key={animationKey}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 1,
          animation: 'fadeInUp 0.3s ease-out',
          '@keyframes fadeInUp': {
            from: {
              opacity: 0,
              transform: 'translateY(10px)',
            },
            to: {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {typingParticipants.map((participant, index) => (
            <Avatar
              key={participant!.userId}
              src={participant!.avatar}
              sx={{
                width: 24,
                height: 24,
                fontSize: '0.75rem',
                animation: `pulse 1.5s ease-in-out infinite ${index * 0.2}s`,
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1,
                  },
                  '50%': {
                    opacity: 0.5,
                  },
                },
              }}
            >
              {participant!.firstName[0]}
              {participant!.lastName[0]}
            </Avatar>
          ))}
          {remainingCount > 0 && (
            <Chip
              label={`+${remainingCount}`}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TypingDots />
        </Box>
      </Box>
    );
  }

  if (variant === 'full') {
    return (
      <Box
        key={animationKey}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
          animation: 'fadeInUp 0.3s ease-out',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {typingParticipants.slice(0, 3).map((participant, index) => (
            <Avatar
              key={participant!.userId}
              src={participant!.avatar}
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.875rem',
                animation: `pulse 1.5s ease-in-out infinite ${index * 0.2}s`,
              }}
            >
              {participant!.firstName[0]}
              {participant!.lastName[0]}
            </Avatar>
          ))}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {getTypingText()}
          </Typography>
        </Box>

        <TypingDots />
      </Box>
    );
  }

  // Compact variant (default)
  return (
    <Box
      key={animationKey}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 0.5,
        animation: 'fadeInUp 0.3s ease-out',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {getTypingText()}
      </Typography>
      <TypingDots size="small" />
    </Box>
  );
};

// Animated typing dots component
const TypingDots: React.FC<{ size?: 'small' | 'medium' }> = ({
  size = 'medium',
}) => {
  const dotSize = size === 'small' ? 4 : 6;
  const containerHeight = size === 'small' ? 12 : 16;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        height: containerHeight,
      }}
    >
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            bgcolor: 'text.secondary',
            animation: `typingDot 1.4s ease-in-out infinite ${index * 0.2}s`,
            '@keyframes typingDot': {
              '0%, 80%, 100%': {
                transform: 'scale(0.8)',
                opacity: 0.5,
              },
              '40%': {
                transform: 'scale(1)',
                opacity: 1,
              },
            },
          }}
        />
      ))}
    </Box>
  );
};

export default TypingIndicator;
