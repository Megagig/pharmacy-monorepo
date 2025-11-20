import React from 'react';
import {
    Paper,
    Slide,
    Box,
    Typography,
    IconButton,
    Button,
    Divider,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

export interface BulkActionBarProps {
    selectedCount: number;
    actions: Array<{
        label: string;
        icon?: React.ReactNode;
        onClick: () => void;
        color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
        confirmMessage?: string;
        disabled?: boolean;
    }>;
    onClearSelection: () => void;
    position?: 'bottom' | 'top';
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
    selectedCount,
    actions,
    onClearSelection,
    position = 'bottom',
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    if (selectedCount === 0) {
        return null;
    }

    return (
        <Slide direction={position === 'bottom' ? 'up' : 'down'} in={selectedCount > 0}>
            <Paper
                elevation={8}
                sx={{
                    position: 'fixed',
                    [position]: 0,
                    left: 0,
                    right: 0,
                    zIndex: theme.zIndex.appBar,
                    borderRadius: position === 'bottom' ? '16px 16px 0 0' : '0 0 16px 16px',
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: { xs: 2, sm: 3 },
                        py: 2,
                        gap: 2,
                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}
                >
                    {/* Selection count */}
                    <Box display="flex" alignItems="center" gap={1}>
                        <CheckIcon />
                        <Typography variant="body1" fontWeight={600}>
                            {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
                        </Typography>
                    </Box>

                    {/* Actions */}
                    <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        flexWrap="wrap"
                        flex={1}
                        justifyContent={isMobile ? 'flex-start' : 'flex-end'}
                    >
                        {actions.map((action, index) => (
                            <Button
                                key={index}
                                variant="contained"
                                color={action.color || 'inherit'}
                                size={isMobile ? 'small' : 'medium'}
                                startIcon={action.icon}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                sx={{
                                    backgroundColor:
                                        action.color === 'error'
                                            ? theme.palette.error.main
                                            : action.color === 'warning'
                                                ? theme.palette.warning.main
                                                : action.color === 'success'
                                                    ? theme.palette.success.main
                                                    : 'rgba(255, 255, 255, 0.2)',
                                    color: theme.palette.primary.contrastText,
                                    '&:hover': {
                                        backgroundColor:
                                            action.color === 'error'
                                                ? theme.palette.error.dark
                                                : action.color === 'warning'
                                                    ? theme.palette.warning.dark
                                                    : action.color === 'success'
                                                        ? theme.palette.success.dark
                                                        : 'rgba(255, 255, 255, 0.3)',
                                    },
                                }}
                            >
                                {action.label}
                            </Button>
                        ))}

                        <Divider
                            orientation="vertical"
                            flexItem
                            sx={{ backgroundColor: 'rgba(255, 255, 255, 0.3)', mx: 1 }}
                        />

                        {/* Clear selection */}
                        <IconButton
                            onClick={onClearSelection}
                            size={isMobile ? 'small' : 'medium'}
                            sx={{
                                color: theme.palette.primary.contrastText,
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>
            </Paper>
        </Slide>
    );
};

export default BulkActionBar;
