import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stepper,
    Step,
    StepLabel,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Typography,
    Box,
    Alert,
    CircularProgress,
} from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import saasTenantService, { TenantProvisionRequest } from '../../services/saasTenantService';

interface ProvisionTenantModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    subscriptionPlans: Array<{ _id: string; name: string; tier: string }>;
}

const validationSchemas = [
    // Step 1: Basic Info
    Yup.object({
        name: Yup.string().required('Tenant name is required').min(3, 'Name must be at least 3 characters'),
        type: Yup.string().required('Tenant type is required').oneOf(['pharmacy', 'clinic', 'hospital', 'enterprise']),
        primaryContactName: Yup.string().required('Contact name is required'),
        primaryContactEmail: Yup.string().email('Invalid email').required('Contact email is required'),
        primaryContactPhone: Yup.string(),
    }),
    // Step 2: Subscription
    Yup.object({
        subscriptionPlanId: Yup.string().required('Please select a subscription plan'),
    }),
    // Step 3: Settings
    Yup.object({
        timezone: Yup.string(),
        currency: Yup.string(),
        language: Yup.string(),
        maxUsers: Yup.number().min(1).max(10000),
        maxPatients: Yup.number().min(1).max(100000),
        storageLimit: Yup.number().min(1).max(1000000),
    }),
];

const ProvisionTenantModal: React.FC<ProvisionTenantModalProps> = ({
    open,
    onClose,
    onSuccess,
    subscriptionPlans,
}) => {
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const steps = ['Basic Information', 'Subscription Plan', 'Settings & Limits'];

    const formik = useFormik({
        initialValues: {
            name: '',
            type: 'pharmacy' as 'pharmacy' | 'clinic' | 'hospital' | 'enterprise',
            primaryContactName: '',
            primaryContactEmail: '',
            primaryContactPhone: '',
            subscriptionPlanId: '',
            timezone: 'UTC',
            currency: 'USD',
            language: 'en',
            maxUsers: 50,
            maxPatients: 1000,
            storageLimit: 5000,
        },
        validationSchema: validationSchemas[activeStep],
        validateOnChange: true,
        onSubmit: async (values) => {
            if (activeStep < steps.length - 1) {
                setActiveStep(activeStep + 1);
            } else {
                await handleProvision(values);
            }
        },
    });

    const handleProvision = async (values: any) => {
        setLoading(true);
        setError(null);

        try {
            const [firstName, ...lastNameParts] = values.primaryContactName.split(' ');
            const lastName = lastNameParts.join(' ') || firstName;

            const provisionData: TenantProvisionRequest = {
                name: values.name,
                type: values.type,
                primaryContact: {
                    name: values.primaryContactName,
                    email: values.primaryContactEmail,
                    phone: values.primaryContactPhone || undefined,
                },
                subscriptionPlanId: values.subscriptionPlanId,
                settings: {
                    timezone: values.timezone,
                    currency: values.currency,
                    language: values.language,
                },
                limits: {
                    maxUsers: values.maxUsers,
                    maxPatients: values.maxPatients,
                    storageLimit: values.storageLimit,
                },
            };

            await saasTenantService.provisionTenant(provisionData);

            formik.resetForm();
            setActiveStep(0);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to provision tenant');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setActiveStep(activeStep - 1);
    };

    const handleClose = () => {
        if (!loading) {
            formik.resetForm();
            setActiveStep(0);
            setError(null);
            onClose();
        }
    };

    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                name="name"
                                label="Tenant Name"
                                value={formik.values.name}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.name && Boolean(formik.errors.name)}
                                helperText={formik.touched.name && formik.errors.name}
                                required
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel>Tenant Type</InputLabel>
                                <Select
                                    name="type"
                                    value={formik.values.type}
                                    onChange={formik.handleChange}
                                    label="Tenant Type"
                                >
                                    <MenuItem value="pharmacy">Pharmacy</MenuItem>
                                    <MenuItem value="clinic">Clinic</MenuItem>
                                    <MenuItem value="hospital">Hospital</MenuItem>
                                    <MenuItem value="enterprise">Enterprise</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                Primary Contact
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                name="primaryContactName"
                                label="Contact Name"
                                value={formik.values.primaryContactName}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.primaryContactName && Boolean(formik.errors.primaryContactName)}
                                helperText={formik.touched.primaryContactName && formik.errors.primaryContactName}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                name="primaryContactEmail"
                                label="Contact Email"
                                type="email"
                                value={formik.values.primaryContactEmail}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.primaryContactEmail && Boolean(formik.errors.primaryContactEmail)}
                                helperText={formik.touched.primaryContactEmail && formik.errors.primaryContactEmail}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                name="primaryContactPhone"
                                label="Contact Phone"
                                value={formik.values.primaryContactPhone}
                                onChange={formik.handleChange}
                            />
                        </Grid>
                    </Grid>
                );

            case 1:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Select a subscription plan for this tenant. You can change this later.
                            </Alert>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel>Subscription Plan</InputLabel>
                                <Select
                                    name="subscriptionPlanId"
                                    value={formik.values.subscriptionPlanId}
                                    onChange={formik.handleChange}
                                    label="Subscription Plan"
                                >
                                    {subscriptionPlans.map((plan) => (
                                        <MenuItem key={plan._id} value={plan._id}>
                                            {plan.name} ({plan.tier})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                );

            case 2:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom>
                                Regional Settings
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Timezone</InputLabel>
                                <Select
                                    name="timezone"
                                    value={formik.values.timezone}
                                    onChange={formik.handleChange}
                                    label="Timezone"
                                >
                                    <MenuItem value="UTC">UTC</MenuItem>
                                    <MenuItem value="America/New_York">Eastern Time</MenuItem>
                                    <MenuItem value="America/Chicago">Central Time</MenuItem>
                                    <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                                    <MenuItem value="Europe/London">London</MenuItem>
                                    <MenuItem value="Africa/Lagos">Lagos</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Currency</InputLabel>
                                <Select
                                    name="currency"
                                    value={formik.values.currency}
                                    onChange={formik.handleChange}
                                    label="Currency"
                                >
                                    <MenuItem value="USD">USD ($)</MenuItem>
                                    <MenuItem value="EUR">EUR (€)</MenuItem>
                                    <MenuItem value="GBP">GBP (£)</MenuItem>
                                    <MenuItem value="NGN">NGN (₦)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Language</InputLabel>
                                <Select
                                    name="language"
                                    value={formik.values.language}
                                    onChange={formik.handleChange}
                                    label="Language"
                                >
                                    <MenuItem value="en">English</MenuItem>
                                    <MenuItem value="es">Spanish</MenuItem>
                                    <MenuItem value="fr">French</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                Usage Limits
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                name="maxUsers"
                                label="Max Users"
                                type="number"
                                value={formik.values.maxUsers}
                                onChange={formik.handleChange}
                                InputProps={{ inputProps: { min: 1, max: 10000 } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                name="maxPatients"
                                label="Max Patients"
                                type="number"
                                value={formik.values.maxPatients}
                                onChange={formik.handleChange}
                                InputProps={{ inputProps: { min: 1, max: 100000 } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                name="storageLimit"
                                label="Storage Limit (MB)"
                                type="number"
                                value={formik.values.storageLimit}
                                onChange={formik.handleChange}
                                InputProps={{ inputProps: { min: 1, max: 1000000 } }}
                            />
                        </Grid>
                    </Grid>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>Provision New Tenant</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={formik.handleSubmit}>
                        {renderStepContent(activeStep)}
                    </form>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Box sx={{ flex: '1 1 auto' }} />
                {activeStep > 0 && (
                    <Button onClick={handleBack} disabled={loading}>
                        Back
                    </Button>
                )}
                <Button
                    variant="contained"
                    onClick={() => formik.handleSubmit()}
                    disabled={loading || !formik.isValid}
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                >
                    {activeStep === steps.length - 1 ? 'Provision Tenant' : 'Next'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ProvisionTenantModal;
