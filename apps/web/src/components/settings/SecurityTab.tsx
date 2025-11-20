import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Divider,
    MenuItem,
    CircularProgress,
    Alert,
    FormControlLabel,
    Switch,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
    IconButton,
    Slider,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SecurityIcon from '@mui/icons-material/Security';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import {
    useSecuritySettings,
    useUpdateSecuritySettings,
    useChangePassword,
    useEnable2FA,
    useVerify2FA,
    useDisable2FA,
} from '../../queries/userSettingsQueries';

const SecurityTab: React.FC = () => {
    const { data: security, isLoading, error } = useSecuritySettings();
    const updateSecurityMutation = useUpdateSecuritySettings();
    const changePasswordMutation = useChangePassword();
    const enable2FAMutation = useEnable2FA();
    const verify2FAMutation = useVerify2FA();
    const disable2FAMutation = useDisable2FA();

    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
    const [disable2FADialogOpen, setDisable2FADialogOpen] = useState(false);

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        showCurrentPassword: false,
        showNewPassword: false,
        showConfirmPassword: false,
    });

    const [twoFAData, setTwoFAData] = useState<{
        secret: string;
        qrCode: string;
        token: string;
    }>({
        secret: '',
        qrCode: '',
        token: '',
    });

    const [disable2FAPassword, setDisable2FAPassword] = useState('');

    const [securityForm, setSecurityForm] = useState({
        sessionTimeout: 30,
        loginNotifications: true,
        profileVisibility: 'organization' as 'public' | 'organization' | 'private',
        dataSharing: false,
    });

    React.useEffect(() => {
        if (security) {
            setSecurityForm({
                sessionTimeout: security.sessionTimeout || 30,
                loginNotifications: security.loginNotifications !== false,
                profileVisibility: security.profileVisibility || 'organization',
                dataSharing: security.dataSharing || false,
            });
        }
    }, [security]);

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
    };

    const handlePasswordSubmit = () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        changePasswordMutation.mutate(
            {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            },
            {
                onSuccess: () => {
                    setPasswordDialogOpen(false);
                    setPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                        showCurrentPassword: false,
                        showNewPassword: false,
                        showConfirmPassword: false,
                    });
                },
            }
        );
    };

    const handleEnable2FA = () => {
        enable2FAMutation.mutate(undefined, {
            onSuccess: (data) => {
                setTwoFAData({
                    secret: data.secret,
                    qrCode: data.qrCode,
                    token: '',
                });
                setTwoFADialogOpen(true);
            },
        });
    };

    const handleVerify2FA = () => {
        verify2FAMutation.mutate(twoFAData.token, {
            onSuccess: () => {
                setTwoFADialogOpen(false);
                setTwoFAData({ secret: '', qrCode: '', token: '' });
            },
        });
    };

    const handleDisable2FA = () => {
        disable2FAMutation.mutate(disable2FAPassword, {
            onSuccess: () => {
                setDisable2FADialogOpen(false);
                setDisable2FAPassword('');
            },
        });
    };

    const handleSecurityUpdate = () => {
        updateSecurityMutation.mutate(securityForm);
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">Failed to load security settings. Please try again later.</Alert>;
    }

    return (
        <Box>
            <Stack spacing={3}>
                {/* Password Management */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <LockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Password Management
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Keep your account secure by using a strong password
                        </Typography>

                        <Button
                            variant="outlined"
                            startIcon={<LockIcon />}
                            onClick={() => setPasswordDialogOpen(true)}
                        >
                            Change Password
                        </Button>
                    </CardContent>
                </Card>

                {/* Two-Factor Authentication */}
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    <VpnKeyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                    Two-Factor Authentication
                                </Typography>
                                <Typography variant="body2" color="textSecondary" paragraph>
                                    Add an extra layer of security to your account
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color={security?.twoFactorEnabled ? 'success.main' : 'text.secondary'}
                                    fontWeight="bold"
                                >
                                    Status: {security?.twoFactorEnabled ? 'Enabled ✓' : 'Disabled'}
                                </Typography>
                            </Box>
                            <Box>
                                {security?.twoFactorEnabled ? (
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        onClick={() => setDisable2FADialogOpen(true)}
                                    >
                                        Disable 2FA
                                    </Button>
                                ) : (
                                    <Button variant="contained" onClick={handleEnable2FA}>
                                        Enable 2FA
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Session & Privacy Settings */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Security & Privacy Settings
                        </Typography>

                        <Stack spacing={3} sx={{ mt: 3 }}>
                            {/* Session Timeout */}
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Session Timeout
                                </Typography>
                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                    Automatically log out after {securityForm.sessionTimeout} minutes of inactivity
                                </Typography>
                                <Slider
                                    value={securityForm.sessionTimeout}
                                    onChange={(_e, value) =>
                                        setSecurityForm((prev) => ({ ...prev, sessionTimeout: value as number }))
                                    }
                                    min={5}
                                    max={1440}
                                    step={5}
                                    marks={[
                                        { value: 5, label: '5m' },
                                        { value: 30, label: '30m' },
                                        { value: 60, label: '1h' },
                                        { value: 120, label: '2h' },
                                        { value: 1440, label: '24h' },
                                    ]}
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(value) => `${value} min`}
                                />
                            </Box>

                            <Divider />

                            {/* Login Notifications */}
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={securityForm.loginNotifications}
                                        onChange={(e) =>
                                            setSecurityForm((prev) => ({
                                                ...prev,
                                                loginNotifications: e.target.checked,
                                            }))
                                        }
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="subtitle2">Login Notifications</Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Receive email notifications when someone logs into your account
                                        </Typography>
                                    </Box>
                                }
                            />

                            <Divider />

                            {/* Profile Visibility */}
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Profile Visibility
                                </Typography>
                                <TextField
                                    fullWidth
                                    select
                                    value={securityForm.profileVisibility}
                                    onChange={(e) =>
                                        setSecurityForm((prev) => ({
                                            ...prev,
                                            profileVisibility: e.target.value as any,
                                        }))
                                    }
                                >
                                    <MenuItem value="public">Public - Anyone can see your profile</MenuItem>
                                    <MenuItem value="organization">
                                        Organization - Only members of your organization
                                    </MenuItem>
                                    <MenuItem value="private">Private - Only you can see your profile</MenuItem>
                                </TextField>
                            </Box>

                            <Divider />

                            {/* Data Sharing */}
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={securityForm.dataSharing}
                                        onChange={(e) =>
                                            setSecurityForm((prev) => ({
                                                ...prev,
                                                dataSharing: e.target.checked,
                                            }))
                                        }
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="subtitle2">Anonymous Data Sharing</Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Help us improve by sharing anonymous usage data
                                        </Typography>
                                    </Box>
                                }
                            />
                        </Stack>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                onClick={handleSecurityUpdate}
                                disabled={updateSecurityMutation.isPending}
                            >
                                {updateSecurityMutation.isPending ? 'Saving...' : 'Save Security Settings'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Stack>

            {/* Change Password Dialog */}
            <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Change Password</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Current Password"
                            name="currentPassword"
                            type={passwordForm.showCurrentPassword ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={handlePasswordChange}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() =>
                                                setPasswordForm((prev) => ({
                                                    ...prev,
                                                    showCurrentPassword: !prev.showCurrentPassword,
                                                }))
                                            }
                                            edge="end"
                                        >
                                            {passwordForm.showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <TextField
                            fullWidth
                            label="New Password"
                            name="newPassword"
                            type={passwordForm.showNewPassword ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={handlePasswordChange}
                            helperText="Must be at least 6 characters long"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() =>
                                                setPasswordForm((prev) => ({
                                                    ...prev,
                                                    showNewPassword: !prev.showNewPassword,
                                                }))
                                            }
                                            edge="end"
                                        >
                                            {passwordForm.showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <TextField
                            fullWidth
                            label="Confirm New Password"
                            name="confirmPassword"
                            type={passwordForm.showConfirmPassword ? 'text' : 'password'}
                            value={passwordForm.confirmPassword}
                            onChange={handlePasswordChange}
                            error={
                                passwordForm.confirmPassword !== '' &&
                                passwordForm.newPassword !== passwordForm.confirmPassword
                            }
                            helperText={
                                passwordForm.confirmPassword !== '' &&
                                    passwordForm.newPassword !== passwordForm.confirmPassword
                                    ? 'Passwords do not match'
                                    : ''
                            }
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() =>
                                                setPasswordForm((prev) => ({
                                                    ...prev,
                                                    showConfirmPassword: !prev.showConfirmPassword,
                                                }))
                                            }
                                            edge="end"
                                        >
                                            {passwordForm.showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handlePasswordSubmit}
                        disabled={
                            changePasswordMutation.isPending ||
                            !passwordForm.currentPassword ||
                            !passwordForm.newPassword ||
                            passwordForm.newPassword !== passwordForm.confirmPassword
                        }
                    >
                        {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Enable 2FA Dialog */}
            <Dialog open={twoFADialogOpen} onClose={() => setTwoFADialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2">
                            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                        </Typography>
                        {twoFAData.qrCode && (
                            <Box sx={{ textAlign: 'center' }}>
                                <img src={twoFAData.qrCode} alt="2FA QR Code" style={{ maxWidth: '100%' }} />
                            </Box>
                        )}
                        <Typography variant="body2">Or enter this secret key manually:</Typography>
                        <TextField fullWidth value={twoFAData.secret} InputProps={{ readOnly: true }} />
                        <Typography variant="body2">
                            Enter the 6-digit code from your authenticator app:
                        </Typography>
                        <TextField
                            fullWidth
                            label="Verification Code"
                            value={twoFAData.token}
                            onChange={(e) => setTwoFAData((prev) => ({ ...prev, token: e.target.value }))}
                            inputProps={{ maxLength: 6 }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTwoFADialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleVerify2FA}
                        disabled={verify2FAMutation.isPending || twoFAData.token.length !== 6}
                    >
                        {verify2FAMutation.isPending ? 'Verifying...' : 'Verify & Enable'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Disable 2FA Dialog */}
            <Dialog open={disable2FADialogOpen} onClose={() => setDisable2FADialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Alert severity="warning">
                            Disabling 2FA will make your account less secure. Are you sure you want to continue?
                        </Alert>
                        <TextField
                            fullWidth
                            label="Enter Your Password"
                            type="password"
                            value={disable2FAPassword}
                            onChange={(e) => setDisable2FAPassword(e.target.value)}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDisable2FADialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDisable2FA}
                        disabled={disable2FAMutation.isPending || !disable2FAPassword}
                    >
                        {disable2FAMutation.isPending ? 'Disabling...' : 'Disable 2FA'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SecurityTab;
