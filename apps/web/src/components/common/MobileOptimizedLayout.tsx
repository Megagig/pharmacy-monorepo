/**
 * Mobile-optimized layout component for MTR components
 * Provides consistent mobile UX patterns
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Button,
  SwipeableDrawer,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Fab,
  Zoom,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useResponsive } from '../../hooks/useResponsive';
import { useSwipeGesture, useLongPress } from '../../hooks/useGestures';

interface MobileCardProps {
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
  chips?: Array<{
    label: string;
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
    variant?: 'filled' | 'outlined';
  }>;
  actions?: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: 'primary' | 'secondary' | 'error' | 'warning';
  }>;
  children?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  title,
  subtitle,
  avatar,
  chips = [],
  actions = [],
  children,
  collapsible = false,
  defaultExpanded = false,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  selected = false,
  disabled = false,
}) => {
  const { isMobile } = useResponsive();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showActions, setShowActions] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Swipe gesture
  const swipeRef = useSwipeGesture(
    (result) => {
      if (result.direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      } else if (result.direction === 'right' && onSwipeRight) {
        onSwipeRight();
      }
      setSwipeOffset(0);
    },
    { threshold: 80, preventScroll: false }
  );

  // Long press gesture
  const longPressRef = useLongPress(
    () => {
      if (onLongPress) {
        onLongPress();
      } else if (actions.length > 0) {
        setShowActions(true);
      }
    },
    { delay: 500 }
  );

  // Combine refs
  const combinedRef = (element: HTMLElement | null) => {
    if (swipeRef.current !== element) {
      swipeRef.current = element;
    }
    if (longPressRef.current !== element) {
      longPressRef.current = element;
    }
  };

  if (!isMobile) {
    // Desktop fallback - simple card
    return (
      <Card sx={{ mb: 1, ...(selected && { bgcolor: 'action.selected' }) }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {avatar && <Box sx={{ flexShrink: 0 }}>{avatar}</Box>}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" component="div">
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
              {chips.length > 0 && (
                <Box
                  sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
                >
                  {chips.map((chip, index) => (
                    <Chip
                      key={index}
                      label={chip.label}
                      size="small"
                      color={chip.color}
                      variant={chip.variant || 'outlined'}
                    />
                  ))}
                </Box>
              )}
              {children && <Box sx={{ mt: 2 }}>{children}</Box>}
            </Box>
            {actions.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {actions.map((action, index) => (
                  <IconButton
                    key={index}
                    size="small"
                    onClick={action.onClick}
                    color={action.color}
                  >
                    {action.icon}
                  </IconButton>
                ))}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        ref={combinedRef}
        sx={{
          mb: 1,
          borderRadius: 2,
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.2s ease' : 'none',
          ...(selected && {
            bgcolor: 'action.selected',
            border: 1,
            borderColor: 'primary.main',
          }),
          ...(disabled && { opacity: 0.6 }),
          '&:active': {
            transform: 'scale(0.98)',
          },
        }}
      >
        <CardContent sx={{ pb: children || actions.length > 0 ? 1 : 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {avatar && <Box sx={{ flexShrink: 0, mt: 0.5 }}>{avatar}</Box>}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
              >
                <Typography
                  variant="subtitle1"
                  component="div"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {title}
                </Typography>

                {(collapsible || actions.length > 0) && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (collapsible) {
                        setExpanded(!expanded);
                      } else {
                        setShowActions(true);
                      }
                    }}
                  >
                    {collapsible ? (
                      expanded ? (
                        <ExpandLessIcon />
                      ) : (
                        <ExpandMoreIcon />
                      )
                    ) : (
                      <MoreVertIcon />
                    )}
                  </IconButton>
                )}
              </Box>

              {subtitle && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {subtitle}
                </Typography>
              )}

              {chips.length > 0 && (
                <Box
                  sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}
                >
                  {chips.map((chip, index) => (
                    <Chip
                      key={index}
                      label={chip.label}
                      size="small"
                      color={chip.color}
                      variant={chip.variant || 'outlined'}
                    />
                  ))}
                </Box>
              )}

              {children && (
                <Collapse in={!collapsible || expanded}>
                  <Box sx={{ mt: 1 }}>{children}</Box>
                </Collapse>
              )}
            </Box>
          </Box>
        </CardContent>

        {actions.length > 0 && !collapsible && (
          <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
            {actions.slice(0, 2).map((action, index) => (
              <Button
                key={index}
                size="small"
                startIcon={action.icon}
                onClick={action.onClick}
                color={action.color}
              >
                {action.label}
              </Button>
            ))}
            {actions.length > 2 && (
              <IconButton size="small" onClick={() => setShowActions(true)}>
                <MoreVertIcon />
              </IconButton>
            )}
          </CardActions>
        )}
      </Card>

      {/* Actions drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={showActions}
        onClose={() => setShowActions(false)}
        onOpen={() => setShowActions(true)}
        disableSwipeToOpen
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
            Actions
          </Typography>
          <List>
            {actions.map((action, index) => (
              <ListItemButton
                key={index}
                onClick={() => {
                  action.onClick();
                  setShowActions(false);
                }}
                sx={{ borderRadius: 1, mb: 1 }}
              >
                <ListItemIcon>{action.icon}</ListItemIcon>
                <ListItemText primary={action.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </SwipeableDrawer>
    </>
  );
};

interface MobileListProps {
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    avatar?: React.ReactNode;
    chips?: Array<{
      label: string;
      color?:
        | 'primary'
        | 'secondary'
        | 'success'
        | 'error'
        | 'warning'
        | 'info';
    }>;
    actions?: Array<{
      label: string;
      icon: React.ReactNode;
      onClick: () => void;
      color?: 'primary' | 'secondary' | 'error' | 'warning';
    }>;
    children?: React.ReactNode;
    selected?: boolean;
    disabled?: boolean;
  }>;
  onItemClick?: (id: string) => void;
  onItemSwipeLeft?: (id: string) => void;
  onItemSwipeRight?: (id: string) => void;
  onItemLongPress?: (id: string) => void;
  emptyState?: React.ReactNode;
  loading?: boolean;
}

export const MobileList: React.FC<MobileListProps> = ({
  items,

  onItemSwipeLeft,
  onItemSwipeRight,
  onItemLongPress,
  emptyState,
  loading = false,
}) => {
  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (items.length === 0 && emptyState) {
    return <Box>{emptyState}</Box>;
  }

  return (
    <Box>
      {items.map((item) => (
        <MobileCard
          key={item.id}
          title={item.title}
          subtitle={item.subtitle}
          avatar={item.avatar}
          chips={item.chips}
          actions={item.actions}
          selected={item.selected}
          disabled={item.disabled}
          onSwipeLeft={() => onItemSwipeLeft?.(item.id)}
          onSwipeRight={() => onItemSwipeRight?.(item.id)}
          onLongPress={() => onItemLongPress?.(item.id)}
        >
          {item.children}
        </MobileCard>
      ))}
    </Box>
  );
};

interface MobileFabProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  size?: 'small' | 'medium' | 'large';
  extended?: boolean;
}

export const MobileFab: React.FC<MobileFabProps> = ({
  icon,
  label,
  onClick,
  color = 'primary',
  position = 'bottom-right',
  size = 'large',
  extended = false,
}) => {
  const { isMobile } = useResponsive();

  if (!isMobile) return null;

  const getPosition = () => {
    const base = { position: 'fixed' as const, zIndex: 1000 };
    switch (position) {
      case 'bottom-right':
        return { ...base, bottom: 16, right: 16 };
      case 'bottom-left':
        return { ...base, bottom: 16, left: 16 };
      case 'bottom-center':
        return {
          ...base,
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      default:
        return { ...base, bottom: 16, right: 16 };
    }
  };

  return (
    <Zoom in={true}>
      <Fab
        color={color}
        size={size}
        onClick={onClick}
        variant={extended && label ? 'extended' : 'circular'}
        sx={getPosition()}
      >
        {icon}
        {extended && label && <Box sx={{ ml: 1 }}>{label}</Box>}
      </Fab>
    </Zoom>
  );
};

export default {
  MobileCard,
  MobileList,
  MobileFab,
};
