import React from 'react';
import {
    Box,
    Typography,
    Divider,
} from '@mui/material';
import ProfileTab from '../settings/ProfileTab';
import PreferencesTab from '../settings/PreferencesTab';
import SecurityTab from '../settings/SecurityTab';

const PersonalTab: React.FC = () => {
    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Personal Information
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <ProfileTab />

            <Divider sx={{ my: 4 }} />

            <Typography variant="h6" gutterBottom>
                Preferences
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <PreferencesTab />

            <Divider sx={{ my: 4 }} />

            <Typography variant="h6" gutterBottom>
                Security & Privacy
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <SecurityTab />
        </Box>
    );
};

export default PersonalTab;
