import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useResponsive } from '../../hooks/useResponsive';

/**
 * Responsive container that adapts spacing and layout based on screen size
 */
export const ResponsiveContainer: React.FC<{
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}> = ({ children, maxWidth = 'lg' }) => {
  const { getSpacing, isMobile } = useResponsive();

  return (
    <Box
      sx={{
        maxWidth: maxWidth || undefined,
        mx: 'auto',
        px: getSpacing(1, 2, 3),
        py: getSpacing(1, 2, 3),
        ...(isMobile && {
          px: 1,
          py: 1,
        }),
      }}
    >
      {children}
    </Box>
  );
};

/**
 * Responsive card layout for mobile-first design
 */
interface ResponsiveCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  chips?: Array<{
    label: string;
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  }>;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  title,
  subtitle,
  actions,
  chips = [],
  children,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const { isMobile } = useResponsive();

  if (collapsible && isMobile) {
    return (
      <Accordion defaultExpanded={defaultExpanded}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            {chips.map((chip, index) => (
              <Chip
                key={index}
                label={chip.label}
                size="small"
                color={chip.color}
                variant="outlined"
              />
            ))}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {subtitle}
            </Typography>
          )}
          {children}
          {actions && (
            <Box
              sx={{
                mt: 2,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1,
              }}
            >
              {actions}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {chips.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {chips.map((chip, index) => (
                  <Chip
                    key={index}
                    label={chip.label}
                    size="small"
                    color={chip.color}
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </Box>
          {actions && !isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box>
          )}
        </Box>
        {children}
      </CardContent>
      {actions && isMobile && (
        <CardActions sx={{ justifyContent: 'flex-end' }}>{actions}</CardActions>
      )}
    </Card>
  );
};

/**
 * Responsive list item component
 */
interface ResponsiveListItemProps {
  primary: string;
  secondary?: string;
  avatar?: React.ReactNode;
  actions?: React.ReactNode;
  chips?: Array<{
    label: string;
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  }>;
  onClick?: () => void;
}

export const ResponsiveListItem: React.FC<ResponsiveListItemProps> = ({
  primary,
  secondary,
  avatar,
  actions,
  chips = [],
  onClick,
}) => {
  const { isMobile } = useResponsive();

  if (isMobile) {
    return (
      <Card
        sx={{ mb: 1 }}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {avatar && <Box sx={{ flexShrink: 0 }}>{avatar}</Box>}
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" component="div">
                {primary}
              </Typography>
              {secondary && (
                <Typography variant="body2" color="text.secondary">
                  {secondary}
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
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </Box>
            {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <ListItem
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {avatar}
      <ListItemText
        primary={primary}
        secondary={
          <>
            {secondary}
            {chips.length > 0 && (
              <Box
                sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
              >
                {chips.map((chip, index) => (
                  <Chip
                    key={index}
                    label={chip.label}
                    size="small"
                    color={chip.color}
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </>
        }
      />
      <ListItemSecondaryAction>{actions}</ListItemSecondaryAction>
    </ListItem>
  );
};

/**
 * Responsive header component
 */
interface ResponsiveHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backButton?: React.ReactNode;
}

export const ResponsiveHeader: React.FC<ResponsiveHeaderProps> = ({
  title,
  subtitle,
  actions,
  backButton,
}) => {
  const { isMobile, getSpacing } = useResponsive();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        mb: getSpacing(2, 3, 4),
        gap: getSpacing(1, 2, 0),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {backButton}
        <Box>
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            component="h1"
            sx={{ fontWeight: 600 }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {actions && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            ...(isMobile && {
              justifyContent: 'stretch',
              '& > *': { flex: 1 },
            }),
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
};

/**
 * Responsive section divider
 */
export const ResponsiveDivider: React.FC<{
  label?: string;
  spacing?: number;
}> = ({ label, spacing }) => {
  const { getSpacing } = useResponsive();
  const actualSpacing = spacing ?? getSpacing(2, 3, 4);

  return (
    <Divider
      sx={{
        my: actualSpacing,
        ...(label && {
          '&::before, &::after': {
            borderColor: 'divider',
          },
        }),
      }}
    >
      {label && (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
    </Divider>
  );
};

/**
 * Responsive grid container
 */
export const ResponsiveGrid: React.FC<{
  children: React.ReactNode;
  spacing?: number;
  columns?: { xs?: number; sm?: number; md?: number; lg?: number };
}> = ({ children, spacing = 2, columns = { xs: 1, sm: 2, md: 3, lg: 4 } }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: spacing,
        gridTemplateColumns: {
          xs: `repeat(${columns.xs || 1}, 1fr)`,
          sm: `repeat(${columns.sm || 2}, 1fr)`,
          md: `repeat(${columns.md || 3}, 1fr)`,
          lg: `repeat(${columns.lg || 4}, 1fr)`,
        },
      }}
    >
      {children}
    </Box>
  );
};

export default {
  ResponsiveContainer,
  ResponsiveCard,
  ResponsiveListItem,
  ResponsiveHeader,
  ResponsiveDivider,
  ResponsiveGrid,
};
