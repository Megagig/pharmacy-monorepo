import React from 'react';
import { Typography, Chip, Tooltip, Box, Link } from '@mui/material';
import { Person, LocalPharmacy, MedicalServices } from '@mui/icons-material';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  role: 'pharmacist' | 'doctor' | 'patient';
  email?: string;
  avatar?: string;
}

interface MentionDisplayProps {
  text: string;
  mentions?: string[];
  users?: User[];
  onMentionClick?: (userId: string) => void;
  variant?: 'body1' | 'body2' | 'caption';
  color?: string;
  sx?: any;
}

const MentionDisplay: React.FC<MentionDisplayProps> = ({
  text,
  mentions = [],
  users = [],
  onMentionClick,
  variant = 'body2',
  color,
  sx,
}) => {
  // Create a map of user IDs to user data for quick lookup
  const userMap = users.reduce((acc, user) => {
    acc[user._id] = user;
    return acc;
  }, {} as Record<string, User>);

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'doctor':
        return 'primary.main';
      case 'pharmacist':
        return 'secondary.main';
      case 'patient':
        return 'info.main';
      default:
        return 'text.primary';
    }
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'doctor':
        return <MedicalServices sx={{ fontSize: 14 }} />;
      case 'pharmacist':
        return <LocalPharmacy sx={{ fontSize: 14 }} />;
      case 'patient':
        return <Person sx={{ fontSize: 14 }} />;
      default:
        return <Person sx={{ fontSize: 14 }} />;
    }
  };

  // Parse text and render with mentions highlighted
  const renderTextWithMentions = () => {
    if (!text) return null;

    // Regex to match mention format: @[Display Name](userId)
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, displayName, userId] = match;
      const user = userMap[userId];

      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add mention component
      if (user) {
        parts.push(
          <Tooltip
            key={`mention-${match.index}`}
            title={
              <Box>
                <Typography variant="caption" fontWeight="bold">
                  {user.firstName} {user.lastName}
                </Typography>
                <br />
                <Typography variant="caption">
                  {user.role} • {user.email}
                </Typography>
              </Box>
            }
            arrow
          >
            <Chip
              label={displayName}
              size="small"
              icon={getRoleIcon(user.role)}
              onClick={
                onMentionClick ? () => onMentionClick(userId) : undefined
              }
              sx={{
                mx: 0.25,
                height: 20,
                fontSize: '0.75rem',
                bgcolor: getRoleColor(user.role),
                color: 'white',
                cursor: onMentionClick ? 'pointer' : 'default',
                '& .MuiChip-icon': {
                  color: 'white',
                },
                '&:hover': onMentionClick
                  ? {
                      opacity: 0.8,
                    }
                  : {},
              }}
            />
          </Tooltip>
        );
      } else {
        // Fallback for unknown users
        parts.push(
          <Chip
            key={`mention-unknown-${match.index}`}
            label={displayName}
            size="small"
            variant="outlined"
            sx={{
              mx: 0.25,
              height: 20,
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          />
        );
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>
      );
    }

    return parts.length > 0 ? parts : text;
  };

  // Handle URL links in text (basic implementation)
  const renderWithLinks = (content: any) => {
    if (typeof content === 'string') {
      // Simple URL regex
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = content.split(urlRegex);

      return parts.map((part, index) => {
        if (urlRegex.test(part)) {
          return (
            <Link
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ wordBreak: 'break-all' }}
            >
              {part}
            </Link>
          );
        }
        return part;
      });
    }
    return content;
  };

  const content = renderTextWithMentions();
  const finalContent = Array.isArray(content)
    ? content.map((part, index) => (
        <span key={index}>{renderWithLinks(part)}</span>
      ))
    : renderWithLinks(content);

  return (
    <Typography
      variant={variant}
      color={color}
      sx={{
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        ...sx,
      }}
    >
      {finalContent}
    </Typography>
  );
};

export default MentionDisplay;
