import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Chip,
  Avatar,
  AvatarGroup,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Checkbox,
  LinearProgress,
  Divider,
} from '@mui/material';
import MoreVert from '@mui/icons-material/MoreVert';
import Schedule from '@mui/icons-material/Schedule';
import Person from '@mui/icons-material/Person';
import Assignment from '@mui/icons-material/Assignment';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Archive from '@mui/icons-material/Archive';
import PriorityHigh from '@mui/icons-material/PriorityHigh';
import Warning from '@mui/icons-material/Warning';
import Info from '@mui/icons-material/Info';
import Flag from '@mui/icons-material/Flag';
import Reply from '@mui/icons-material/Reply';
import Forward from '@mui/icons-material/Forward';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import Visibility from '@mui/icons-material/Visibility';
import AccessTime from '@mui/icons-material/AccessTime';
import Message from '@mui/icons-material/Message';
import { formatDistanceToNow } from 'date-fns';
import { Conversation } from '../../stores/types';

interface QueryCardProps {
  query: Conversation;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
  onAction?: (action: string, queryId: string) => void;
  compact?: boolean;
  showPatientInfo?: boolean;
}

const QueryCard: React.FC<QueryCardProps> = ({
  query,
  selected = false,
  onSelect,
  onClick,
  onAction,
  compact = false,
  showPatientInfo = true,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // Get priority color and icon
  const getPriorityConfig = () => {
    switch (query.priority) {
      case 'urgent':
        return {
          color: 'error.main',
          bgcolor: 'error.light',
          icon: <PriorityHigh />,
          label: 'Urgent',
        };
      case 'high':
        return {
          color: 'warning.main',
          bgcolor: 'warning.light',
          icon: <Warning />,
          label: 'High',
        };
      case 'low':
        return {
          color: 'info.main',
          bgcolor: 'info.light',
          icon: <Info />,
          label: 'Low',
        };
      default:
        return {
          color: 'text.secondary',
          bgcolor: 'grey.100',
          icon: <Flag />,
          label: 'Normal',
        };
    }
  };

  // Get status color and icon
  const getStatusConfig = () => {
    switch (query.status) {
      case 'resolved':
        return {
          color: 'success.main',
          bgcolor: 'success.light',
          icon: <CheckCircle />,
          label: 'Resolved',
        };
      case 'archived':
        return {
          color: 'text.disabled',
          bgcolor: 'grey.200',
          icon: <Archive />,
          label: 'Archived',
        };
      default:
        return {
          color: 'primary.main',
          bgcolor: 'primary.light',
          icon: <Schedule />,
          label: 'Active',
        };
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  };

  // Get query title
  const getQueryTitle = () => {
    if (query.title) {
      return query.title;
    }

    // Generate title based on clinical context or participants
    if (query.metadata?.clinicalContext?.diagnosis) {
      return `Query about ${query.metadata.clinicalContext.diagnosis}`;
    }

    return 'Patient Query';
  };

  // Get query description
  const getQueryDescription = () => {
    const participants = query.participants
      .filter((p) => p.role !== 'patient')
      .map((p) => p.role)
      .join(', ');

    return `Involving: ${participants}`;
  };

  // Get assigned healthcare providers
  const getAssignedProviders = () => {
    return query.participants.filter((p) => p.role !== 'patient');
  };

  // Calculate query progress (mock calculation based on status and time)
  const getQueryProgress = () => {
    if (query.status === 'resolved') return 100;
    if (query.status === 'archived') return 0;

    // Mock progress based on time elapsed
    const createdAt = new Date(query.createdAt);
    const now = new Date();
    const hoursElapsed =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // Assume 24 hours is 100% for active queries
    return Math.min(Math.round((hoursElapsed / 24) * 100), 90);
  };

  // Handle menu actions
  const handleMenuAction = (action: string) => {
    setMenuAnchor(null);
    onAction?.(action, query._id);
  };

  // Handle menu click
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  // Handle card click
  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    onSelect?.(event.target.checked);
  };

  // Get available actions
  type ActionItem = { key: string; label: string; icon: React.ReactElement; danger?: boolean };

  const getAvailableActions = () => {
    const actions: ActionItem[] = [
      { key: 'view', label: 'View Details', icon: <Visibility /> },
      { key: 'reply', label: 'Reply', icon: <Reply /> },
      { key: 'edit', label: 'Edit Query', icon: <Edit /> },
    ];

    if (query.status === 'active') {
      actions.push(
        { key: 'assign', label: 'Assign', icon: <Assignment /> },
        { key: 'escalate', label: 'Escalate', icon: <PriorityHigh /> },
        { key: 'resolve', label: 'Mark as Resolved', icon: <CheckCircle /> },
        { key: 'archive', label: 'Archive', icon: <Archive /> }
      );
    }

    if (query.status === 'archived') {
      actions.push({ key: 'unarchive', label: 'Unarchive', icon: <Archive /> });
    }

    actions.push(
      { key: 'forward', label: 'Forward', icon: <Forward /> },
      { key: 'delete', label: 'Delete', icon: <Delete />, danger: true }
    );

    return actions;
  };

  const priorityConfig = getPriorityConfig();
  const statusConfig = getStatusConfig();
  const assignedProviders = getAssignedProviders();
  const queryProgress = getQueryProgress();
  const availableActions = getAvailableActions();

  // Normalize IDs to stable strings for keys and display
  const idToString = (id: any): string => {
    if (typeof id === 'string') return id;
    if (id && typeof id === 'object') {
      if (typeof (id as any)._id === 'string') return (id as any)._id;
      if (typeof (id as any)._id === 'object') return idToString((id as any)._id);
      if (typeof (id as any).$oid === 'string') return (id as any).$oid;
      if (typeof (id as any).toHexString === 'function') return (id as any).toHexString();
      const str = typeof (id as any).toString === 'function' ? (id as any).toString() : '';
      if (str && str !== '[object Object]') return str;
      try { return JSON.stringify(id); } catch { return String(id ?? ''); }
    }
    return String(id ?? '');
  };

  return (
    <>
      <Card
        component={onClick ? 'button' : 'div'}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: onClick ? 4 : 1,
            transform: onClick ? 'translateY(-2px)' : 'none',
          },
          border: selected ? 2 : 1,
          borderColor: selected ? 'primary.main' : 'divider',
          position: 'relative',
          textAlign: 'left',
          width: '100%',
          ...(onClick && {
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            },
          }),
        }}
        onClick={handleCardClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? getQueryTitle() : undefined}
      >
        {/* Priority indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 4,
            height: '100%',
            bgcolor: priorityConfig.color,
          }}
        />

        <CardContent sx={{ pb: compact ? 2 : 1 }}>
          {/* Header */}
          <Box
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}
          >
            {/* Selection checkbox */}
            {onSelect && (
              <Checkbox
                checked={selected}
                onChange={handleCheckboxChange}
                size="small"
                sx={{ mt: -0.5 }}
              />
            )}

            {/* Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Title and status */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <Typography
                  variant={compact ? 'body1' : 'h6'}
                  component="h3"
                  noWrap
                  sx={{ flex: 1, fontWeight: 600 }}
                >
                  {getQueryTitle()}
                </Typography>

                <Chip
                  icon={statusConfig.icon}
                  label={statusConfig.label}
                  size="small"
                  sx={{
                    bgcolor: statusConfig.bgcolor,
                    color: statusConfig.color,
                    '& .MuiChip-icon': { color: statusConfig.color },
                  }}
                />

                <Chip
                  icon={priorityConfig.icon}
                  label={priorityConfig.label}
                  size="small"
                  sx={{
                    bgcolor: priorityConfig.bgcolor,
                    color: priorityConfig.color,
                    '& .MuiChip-icon': { color: priorityConfig.color },
                  }}
                />
              </Box>

              {/* Description */}
              {!compact && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {getQueryDescription()}
                </Typography>
              )}

              {/* Metadata */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
              >
                {/* Helper: safely get ID suffix from potential string/object */}
                {/**
                 * Safely returns the last `len` characters of an ID which might be a string,
                 * a populated object with `_id`, or another object with toString.
                 */}
                {(() => {
                  const formatIdSuffix = (id: any, len: number = 6): string => {
                    const asString = typeof id === 'string'
                      ? id
                      : (id?.['_id'] ?? (typeof id?.toString === 'function' ? id.toString() : undefined));
                    return typeof asString === 'string' ? asString.slice(-len) : '—';
                  };
                  // Expose once in component scope by attaching to window-like closure if needed
                  (QueryCard as any)._formatIdSuffix = formatIdSuffix;
                  return null;
                })()}
                {/* Patient info */}
                {showPatientInfo && query.patientId && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      Patient ID: {(QueryCard as any)._formatIdSuffix(query.patientId, 6)}
                    </Typography>
                  </Box>
                )}

                {/* Case ID */}
                {query.caseId && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Assignment
                      sx={{ fontSize: 16, color: 'text.secondary' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Case: {query.caseId}
                    </Typography>
                  </Box>
                )}

                {/* Created time */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(query.createdAt)}
                  </Typography>
                </Box>

                {/* Last message time */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Message sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Last: {formatTime(query.lastMessageAt)}
                  </Typography>
                </Box>
              </Box>

              {/* Tags */}
              {query.tags && query.tags.length > 0 && (
                <Box
                  sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}
                >
                  {query.tags.slice(0, compact ? 2 : 4).map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.625rem' }}
                    />
                  ))}
                  {query.tags.length > (compact ? 2 : 4) && (
                    <Typography variant="caption" color="text.secondary">
                      +{query.tags.length - (compact ? 2 : 4)} more
                    </Typography>
                  )}
                </Box>
              )}

              {/* Clinical context */}
              {query.metadata?.clinicalContext && !compact && (
                <Box sx={{ mb: 2 }}>
                  {query.metadata.clinicalContext.diagnosis && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Diagnosis: {query.metadata.clinicalContext.diagnosis}
                    </Typography>
                  )}
                  {query.metadata.clinicalContext.medications &&
                    query.metadata.clinicalContext.medications.length > 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Medications:{' '}
                        {query.metadata.clinicalContext.medications.length}{' '}
                        items
                      </Typography>
                    )}
                </Box>
              )}

              {/* Progress bar for active queries */}
              {query.status === 'active' && !compact && (
                <Box sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Query Progress
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {queryProgress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={queryProgress}
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Box>
              )}

              {/* Assigned providers */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Assigned to:
                  </Typography>
                  <AvatarGroup
                    max={3}
                    sx={{
                      '& .MuiAvatar-root': {
                        width: 24,
                        height: 24,
                        fontSize: '0.75rem',
                      },
                    }}
                  >
                    {assignedProviders.map((provider) => (
                      <Tooltip key={idToString(provider.userId)} title={provider.role}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {provider.role.charAt(0).toUpperCase()}
                        </Avatar>
                      </Tooltip>
                    ))}
                  </AvatarGroup>
                </Box>

                {/* Menu button */}
                <IconButton
                  size="small"
                  onClick={handleMenuClick}
                  sx={{ ml: 1 }}
                  aria-label="More options"
                >
                  <MoreVert />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </CardContent>

        {/* Quick actions */}
        {!compact && (
          <>
            <Divider />
            <CardActions sx={{ px: 2, py: 1 }}>
              <Button
                size="small"
                startIcon={<Reply />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuAction('reply');
                }}
              >
                Reply
              </Button>

              {query.status === 'active' && (
                <>
                  <Button
                    size="small"
                    startIcon={<Assignment />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuAction('assign');
                    }}
                  >
                    Assign
                  </Button>

                  <Button
                    size="small"
                    startIcon={<CheckCircle />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuAction('resolve');
                    }}
                  >
                    Resolve
                  </Button>
                </>
              )}

              <Box sx={{ flex: 1 }} />

              <Typography variant="caption" color="text.secondary">
                ID: {idToString(query._id).slice(-6)}
              </Typography>
            </CardActions>
          </>
        )}
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {availableActions.map((action) => (
          <MenuItem
            key={action.key}
            onClick={() => handleMenuAction(action.key)}
            sx={{
              color: action.danger ? 'error.main' : 'inherit',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {action.icon}
              {action.label}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default QueryCard;
