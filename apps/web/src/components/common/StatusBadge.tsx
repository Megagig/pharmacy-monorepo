import React from 'react';
import { Chip, ChipProps } from '@mui/material';

export interface StatusBadgeProps {
    status: string;
    variant?: 'filled' | 'outlined';
    size?: 'small' | 'medium';
    colorMap?: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default' | 'primary' | 'secondary'>;
}

// Default color mappings for common statuses
const defaultColorMap: Record<string, ChipProps['color']> = {
    // General statuses
    active: 'success',
    inactive: 'default',
    pending: 'warning',
    suspended: 'error',
    cancelled: 'error',
    deleted: 'error',

    // Subscription statuses
    trial: 'info',
    trialing: 'info',
    past_due: 'warning',

    // User statuses
    approved: 'success',
    rejected: 'error',
    verified: 'success',
    unverified: 'warning',

    // Payment statuses
    paid: 'success',
    unpaid: 'error',
    refunded: 'warning',

    // Task/Job statuses
    completed: 'success',
    failed: 'error',
    running: 'info',
    waiting: 'default',

    // Health statuses
    healthy: 'success',
    warning: 'warning',
    critical: 'error',

    // Boolean-like
    enabled: 'success',
    disabled: 'default',
    online: 'success',
    offline: 'error',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    variant = 'filled',
    size = 'small',
    colorMap,
}) => {
    // Merge custom color map with defaults
    const finalColorMap = { ...defaultColorMap, ...colorMap };

    // Get color for status (case-insensitive)
    const statusLower = status.toLowerCase();
    const color = finalColorMap[statusLower] || 'default';

    // Format label (capitalize first letter of each word)
    const label = status
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    return (
        <Chip
            label={label}
            color={color}
            variant={variant}
            size={size}
            sx={{
                fontWeight: 600,
                textTransform: 'capitalize',
            }}
        />
    );
};

export default StatusBadge;
