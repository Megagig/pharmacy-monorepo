import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import {
    Business as BusinessIcon,
    Settings as SettingsIcon,
    Assessment as AssessmentIcon,
    MonetizationOn as MonetizationOnIcon,
    Login as LoginIcon,
} from '@mui/icons-material';
import QuickActionCard from './QuickActionCard';
import { motion } from 'framer-motion';

const SuperAdminQuickActions: React.FC = () => {
    const theme = useTheme();

    const quickActions = [
        {
            title: 'Admin Panel',
            description: 'Access super admin control panel',
            icon: <BusinessIcon />,
            navigateTo: '/admin',
            color: theme.palette.primary.main,
            buttonText: 'Open',
        },
        {
            title: 'Feature Management',
            description: 'Manage system features and flags',
            icon: <SettingsIcon />,
            navigateTo: '/admin/feature-management',
            color: theme.palette.secondary.main,
            buttonText: 'Manage',
        },
        {
            title: 'System Reports',
            description: 'Access detailed analytics and reports',
            icon: <AssessmentIcon />,
            navigateTo: '/reports-analytics',
            color: theme.palette.info.main,
            buttonText: 'View Reports',
        },
        {
            title: 'Subscriptions',
            description: 'Manage billing and subscriptions',
            icon: <MonetizationOnIcon />,
            navigateTo: '/subscriptions',
            color: theme.palette.success.main,
            buttonText: 'Manage',
        },
        {
            title: 'System Settings',
            description: 'Configure system settings',
            icon: <LoginIcon />,
            navigateTo: '/settings',
            color: theme.palette.warning.main,
            buttonText: 'Configure',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Box mb={4}>
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 'bold',
                        mb: 3,
                        color: 'text.primary',
                    }}
                >
                    Quick Actions
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                            lg: 'repeat(5, 1fr)',
                        },
                        gap: 3,
                    }}
                >
                    {quickActions.map((action, index) => (
                        <motion.div
                            key={action.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                            <QuickActionCard
                                title={action.title}
                                description={action.description}
                                icon={action.icon}
                                color={action.color}
                                navigateTo={action.navigateTo}
                                buttonText={action.buttonText}
                            />
                        </motion.div>
                    ))}
                </Box>
            </Box>
        </motion.div>
    );
};

export default SuperAdminQuickActions;
