// @ts-nocheck - Grid item prop type definition issue in MUI v7
import React, { useState, useRef } from 'react';
import {
    Box,
    Card,
    CardContent,
    Grid,
    TextField,
    Button,
    Avatar,
    IconButton,
    Typography,
    Divider,
    CircularProgress,
    Alert,
    Stack,
    Chip,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import { useUserProfile, useUpdateUserProfile, useUploadAvatar } from '../../queries/userSettingsQueries';
import { getAvatarUrl } from '../../utils/avatarUtils';

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const ProfileTab: React.FC = () => {
    const { data: profile, isLoading, error } = useUserProfile();
    const updateProfileMutation = useUpdateUserProfile();
    const uploadAvatarMutation = useUploadAvatar();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        bio: '',
        location: '',
        address: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        organization: '',
        professionalTitle: '',
        specialization: '',
        licenseNumber: '',
        pharmacySchool: '',
        yearOfGraduation: '',
    });

    const [operatingHours, setOperatingHours] = useState<any>({});

    React.useEffect(() => {
        if (profile) {
            setFormData({
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                phone: profile.phone || '',
                bio: profile.bio || '',
                location: profile.location || '',
                address: profile.address || '',
                city: profile.city || '',
                state: profile.state || '',
                country: profile.country || '',
                zipCode: profile.zipCode || '',
                organization: profile.organization || '',
                professionalTitle: profile.professionalTitle || '',
                specialization: profile.specialization || '',
                licenseNumber: profile.licenseNumber || '',
                pharmacySchool: profile.pharmacySchool || '',
                yearOfGraduation: profile.yearOfGraduation?.toString() || '',
            });
            setOperatingHours(profile.operatingHours || {});
        }
    }, [profile]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleOperatingHoursChange = (day: string, field: string, value: any) => {
        setOperatingHours((prev: any) => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value,
            },
        }));
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }

            uploadAvatarMutation.mutate(file);
        }
    };

    const handleSave = () => {
        const updateData: any = {
            ...formData,
            yearOfGraduation: formData.yearOfGraduation ? parseInt(formData.yearOfGraduation) : undefined,
            operatingHours,
        };

        updateProfileMutation.mutate(updateData, {
            onSuccess: () => {
                setEditMode(false);
            },
        });
    };

    const handleCancel = () => {
        if (profile) {
            setFormData({
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                phone: profile.phone || '',
                bio: profile.bio || '',
                location: profile.location || '',
                address: profile.address || '',
                city: profile.city || '',
                state: profile.state || '',
                country: profile.country || '',
                zipCode: profile.zipCode || '',
                organization: profile.organization || '',
                professionalTitle: profile.professionalTitle || '',
                specialization: profile.specialization || '',
                licenseNumber: profile.licenseNumber || '',
                pharmacySchool: profile.pharmacySchool || '',
                yearOfGraduation: profile.yearOfGraduation?.toString() || '',
            });
            setOperatingHours(profile.operatingHours || {});
        }
        setEditMode(false);
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Failed to load profile. Please try again later.
            </Alert>
        );
    }

    return (
        <Box>
            <Grid container spacing={3}>
                {/* Profile Picture Card */}
                {/* @ts-expect-error MUI v7 Grid item prop type definition issue */}
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                                <Avatar
                                    key={profile?.avatar || 'no-avatar'}
                                    src={getAvatarUrl(profile?.avatar)}
                                    sx={{ width: 150, height: 150, fontSize: '3rem', mx: 'auto' }}
                                >
                                    {profile?.firstName?.[0]}
                                    {profile?.lastName?.[0]}
                                </Avatar>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarChange}
                                />
                                <IconButton
                                    sx={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        bgcolor: 'primary.main',
                                        color: 'white',
                                        '&:hover': { bgcolor: 'primary.dark' },
                                    }}
                                    onClick={handleAvatarClick}
                                    disabled={uploadAvatarMutation.isPending}
                                >
                                    {uploadAvatarMutation.isPending ? (
                                        <CircularProgress size={24} color="inherit" />
                                    ) : (
                                        <PhotoCameraIcon />
                                    )}
                                </IconButton>
                            </Box>
                            <Typography variant="h5" gutterBottom>
                                {profile?.firstName} {profile?.lastName}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                                {profile?.professionalTitle || profile?.role}
                            </Typography>
                            <Chip
                                label={profile?.organization || 'No Organization'}
                                variant="outlined"
                                size="small"
                                sx={{ mt: 1 }}
                            />
                            <Typography variant="caption" display="block" color="textSecondary" sx={{ mt: 2 }}>
                                {profile?.email}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Profile Information Card */}
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6">Profile Information</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {editMode ? (
                                        <>
                                            <Button
                                                startIcon={<CancelIcon />}
                                                onClick={handleCancel}
                                                disabled={updateProfileMutation.isPending}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="contained"
                                                startIcon={<SaveIcon />}
                                                onClick={handleSave}
                                                disabled={updateProfileMutation.isPending}
                                            >
                                                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button startIcon={<EditIcon />} onClick={() => setEditMode(true)}>
                                            Edit Profile
                                        </Button>
                                    )}
                                </Box>
                            </Box>

                            <Divider sx={{ mb: 3 }} />

                            {/* Personal Information */}
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Personal Information
                            </Typography>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="First Name"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Last Name"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        value={profile?.email}
                                        disabled
                                        helperText="Email cannot be changed"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Phone Number"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Bio"
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                        multiline
                                        rows={3}
                                        helperText={`${formData.bio.length}/500 characters`}
                                        inputProps={{ maxLength: 500 }}
                                    />
                                </Grid>
                            </Grid>

                            <Divider sx={{ my: 3 }} />

                            {/* Professional Details */}
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Professional Details
                            </Typography>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Professional Title"
                                        name="professionalTitle"
                                        value={formData.professionalTitle}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                        placeholder="e.g., Registered Pharmacist"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Specialization"
                                        name="specialization"
                                        value={formData.specialization}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                        placeholder="e.g., Clinical Pharmacy"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="License Number"
                                        name="licenseNumber"
                                        value={formData.licenseNumber}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Organization"
                                        name="organization"
                                        value={formData.organization}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Pharmacy School"
                                        name="pharmacySchool"
                                        value={formData.pharmacySchool}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Year of Graduation"
                                        name="yearOfGraduation"
                                        type="number"
                                        value={formData.yearOfGraduation}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                        inputProps={{ min: 1900, max: new Date().getFullYear() + 10 }}
                                    />
                                </Grid>
                            </Grid>

                            <Divider sx={{ my: 3 }} />

                            {/* Location & Address */}
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Location & Address
                            </Typography>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Address"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="City"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="State/Province"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Country"
                                        name="country"
                                        value={formData.country}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Zip/Postal Code"
                                        name="zipCode"
                                        value={formData.zipCode}
                                        onChange={handleInputChange}
                                        disabled={!editMode}
                                    />
                                </Grid>
                            </Grid>

                            <Divider sx={{ my: 3 }} />

                            {/* Operating Hours */}
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Operating Hours
                            </Typography>
                            <Stack spacing={2}>
                                {daysOfWeek.map((day) => (
                                    <Box key={day} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Typography sx={{ width: 100, textTransform: 'capitalize' }}>
                                            {day}
                                        </Typography>
                                        <TextField
                                            type="time"
                                            label="Open"
                                            value={operatingHours[day]?.open || '09:00'}
                                            onChange={(e) => handleOperatingHoursChange(day, 'open', e.target.value)}
                                            disabled={!editMode || operatingHours[day]?.closed}
                                            size="small"
                                            sx={{ width: 150 }}
                                        />
                                        <TextField
                                            type="time"
                                            label="Close"
                                            value={operatingHours[day]?.close || '17:00'}
                                            onChange={(e) => handleOperatingHoursChange(day, 'close', e.target.value)}
                                            disabled={!editMode || operatingHours[day]?.closed}
                                            size="small"
                                            sx={{ width: 150 }}
                                        />
                                        <Button
                                            variant={operatingHours[day]?.closed ? 'outlined' : 'text'}
                                            size="small"
                                            onClick={() =>
                                                handleOperatingHoursChange(day, 'closed', !operatingHours[day]?.closed)
                                            }
                                            disabled={!editMode}
                                        >
                                            {operatingHours[day]?.closed ? 'Closed' : 'Mark Closed'}
                                        </Button>
                                    </Box>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ProfileTab;
