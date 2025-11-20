import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Breadcrumbs,
    Link,
    Tabs,
    Tab,
    Paper,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import {
    Person as PersonIcon,
    Dashboard as DashboardIcon,
    CreditCard as CreditCardIcon,
    Business as BusinessIcon,
    Settings as SettingsIcon,
    Flag as FlagIcon,
    Home as HomeIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import OverviewTab from '../components/profile/OverviewTab';
import SubscriptionTab from '../components/profile/SubscriptionTab';
import WorkspaceTab from '../components/profile/WorkspaceTab';
import PersonalTab from '../components/profile/PersonalTab';
import FeaturesTab from '../components/profile/FeaturesTab';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`profile-tabpanel-${index}`}
            aria-labelledby={`profile-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
};

const Profile: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <DashboardIcon /> },
        { id: 'subscription', label: 'Subscription', icon: <CreditCardIcon /> },
        { id: 'workspace', label: 'Workspace', icon: <BusinessIcon /> },
        { id: 'personal', label: 'Personal Settings', icon: <SettingsIcon /> },
        { id: 'features', label: 'Features & Access', icon: <FlagIcon /> },
    ];

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Breadcrumbs */}
            <Breadcrumbs sx={{ mb: 3 }}>
                <Link
                    component={RouterLink}
                    to="/dashboard"
                    underline="hover"
                    color="inherit"
                    sx={{ display: 'flex', alignItems: 'center' }}
                >
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                    Dashboard
                </Link>
                <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
                    <PersonIcon sx={{ mr: 0.5 }} fontSize="small" />
                    Profile
                </Typography>
            </Breadcrumbs>

            {/* Page Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                    Profile Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Manage your account, workspace, subscription, and settings
                </Typography>
            </Box>

            {/* Tabs */}
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant={isMobile ? 'scrollable' : 'fullWidth'}
                        scrollButtons={isMobile ? 'auto' : false}
                        aria-label="profile tabs"
                        sx={{
                            '& .MuiTab-root': {
                                minHeight: 72,
                                textTransform: 'none',
                                fontSize: '0.95rem',
                                fontWeight: 500,
                            },
                        }}
                    >
                        {tabs.map((tab, index) => (
                            <Tab
                                key={tab.id}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {tab.icon}
                                        {!isMobile && tab.label}
                                    </Box>
                                }
                                id={`profile-tab-${index}`}
                                aria-controls={`profile-tabpanel-${index}`}
                            />
                        ))}
                    </Tabs>
                </Box>

                {/* Tab Panels */}
                <Box sx={{ p: { xs: 2, md: 4 } }}>
                    <TabPanel value={activeTab} index={0}>
                        <OverviewTab />
                    </TabPanel>
                    <TabPanel value={activeTab} index={1}>
                        <SubscriptionTab />
                    </TabPanel>
                    <TabPanel value={activeTab} index={2}>
                        <WorkspaceTab />
                    </TabPanel>
                    <TabPanel value={activeTab} index={3}>
                        <PersonalTab />
                    </TabPanel>
                    <TabPanel value={activeTab} index={4}>
                        <FeaturesTab />
                    </TabPanel>
                </Box>
            </Paper>
        </Container>
    );
};

export default Profile;
