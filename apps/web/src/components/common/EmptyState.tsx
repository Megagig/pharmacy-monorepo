import React from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Stack,
    SxProps,
    Theme,
} from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import AddIcon from '@mui/icons-material/Add';

export type EmptyStateType =
    | 'no-data'
    | 'no-lab-results'
    | 'no-vitals'
    | 'no-visits'
    | 'no-search-results'
    | 'error'
    | 'custom';

interface EmptyStateProps {
    type?: EmptyStateType;
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
        icon?: React.ReactNode;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    sx?: SxProps<Theme>;
}

const getDefaultContent = (type: EmptyStateType) => {
    switch (type) {
        case 'no-lab-results':
            return {
                icon: <ScienceIcon sx={{ fontSize: 80 }} />,
                title: 'No Lab Results Available',
                description:
                    'Lab results will appear here when your pharmacist uploads them. Check back later or contact your pharmacy if you expect results.',
            };
        case 'no-vitals':
            return {
                icon: <FavoriteIcon sx={{ fontSize: 80 }} />,
                title: 'No Vitals Recorded Yet',
                description:
                    'Start tracking your health by logging your vital signs. Regular monitoring helps you and your healthcare provider make informed decisions.',
            };
        case 'no-visits':
            return {
                icon: <EventNoteIcon sx={{ fontSize: 80 }} />,
                title: 'No Visit History',
                description:
                    'Your consultation history will appear here after appointments. Schedule a visit with your pharmacist to get started.',
            };
        case 'no-search-results':
            return {
                icon: <SearchOffIcon sx={{ fontSize: 80 }} />,
                title: 'No Results Found',
                description:
                    'We couldn\'t find any matches for your search. Try adjusting your filters or search terms.',
            };
        case 'error':
            return {
                icon: <CloudOffIcon sx={{ fontSize: 80 }} />,
                title: 'Unable to Load Data',
                description:
                    'We encountered an error while loading this information. Please try again or contact support if the problem persists.',
            };
        default:
            return {
                icon: <InboxIcon sx={{ fontSize: 80 }} />,
                title: 'No Data Available',
                description: 'There is no data to display at this time.',
            };
    }
};

/**
 * EmptyState Component
 * Displays a user-friendly message when there's no data to show
 * Supports different types with customizable icons, titles, descriptions, and actions
 */
const EmptyState: React.FC<EmptyStateProps> = ({
    type = 'no-data',
    title,
    description,
    icon,
    action,
    secondaryAction,
    sx,
}) => {
    const defaultContent = getDefaultContent(type);

    const displayIcon = icon || defaultContent.icon;
    const displayTitle = title || defaultContent.title;
    const displayDescription = description || defaultContent.description;

    return (
        <Paper
            elevation={0}
            sx={{
                py: 8,
                px: 4,
                textAlign: 'center',
                bgcolor: 'background.default',
                borderRadius: 2,
                ...sx,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 3,
                    color: 'text.disabled',
                }}
            >
                {displayIcon}
            </Box>

            <Typography
                variant="h5"
                component="h3"
                gutterBottom
                fontWeight="medium"
                color="text.primary"
            >
                {displayTitle}
            </Typography>

            <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 500, mx: 'auto', mb: 4 }}
            >
                {displayDescription}
            </Typography>

            {(action || secondaryAction) && (
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    justifyContent="center"
                >
                    {action && (
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={action.icon}
                            onClick={action.onClick}
                            sx={{ minWidth: 150 }}
                        >
                            {action.label}
                        </Button>
                    )}

                    {secondaryAction && (
                        <Button
                            variant="outlined"
                            color="primary"
                            size="large"
                            onClick={secondaryAction.onClick}
                            sx={{ minWidth: 150 }}
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </Stack>
            )}
        </Paper>
    );
};

export default EmptyState;

/**
 * Pre-configured Empty State Components for common use cases
 */

export const NoLabResultsEmptyState: React.FC<{
    onRefresh?: () => void;
}> = ({ onRefresh }) => (
    <EmptyState
        type="no-lab-results"
        action={
            onRefresh
                ? {
                    label: 'Refresh',
                    onClick: onRefresh,
                }
                : undefined
        }
    />
);

export const NoVitalsEmptyState: React.FC<{
    onLogVitals?: () => void;
}> = ({ onLogVitals }) => (
    <EmptyState
        type="no-vitals"
        action={
            onLogVitals
                ? {
                    label: 'Log Vitals',
                    onClick: onLogVitals,
                    icon: <AddIcon />,
                }
                : undefined
        }
    />
);

export const NoVisitsEmptyState: React.FC<{
    onSchedule?: () => void;
}> = ({ onSchedule }) => (
    <EmptyState
        type="no-visits"
        action={
            onSchedule
                ? {
                    label: 'Schedule Visit',
                    onClick: onSchedule,
                }
                : undefined
        }
    />
);

export const NoSearchResultsEmptyState: React.FC<{
    onClearFilters?: () => void;
}> = ({ onClearFilters }) => (
    <EmptyState
        type="no-search-results"
        action={
            onClearFilters
                ? {
                    label: 'Clear Filters',
                    onClick: onClearFilters,
                }
                : undefined
        }
    />
);

export const ErrorEmptyState: React.FC<{
    onRetry?: () => void;
}> = ({ onRetry }) => (
    <EmptyState
        type="error"
        action={
            onRetry
                ? {
                    label: 'Try Again',
                    onClick: onRetry,
                }
                : undefined
        }
    />
);
