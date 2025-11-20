import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Grid,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Switch,
    Chip,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Checkbox,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAdminPricingPlans, useAdminPricingFeatures, useCreatePlan, useUpdatePlan, useDeletePlan, useCreateFeature, useUpdateFeature, useDeleteFeature } from '../../queries/usePricing';
import { PricingPlan, PricingFeature } from '../../queries/usePricing';
import toast from 'react-hot-toast'; const PricingManagement: React.FC = () => {
    const { data: plansData, isLoading: plansLoading } = useAdminPricingPlans();
    const { data: featuresData, isLoading: featuresLoading } = useAdminPricingFeatures();

    const createPlanMutation = useCreatePlan();
    const updatePlanMutation = useUpdatePlan();
    const deletePlanMutation = useDeletePlan();
    const createFeatureMutation = useCreateFeature();
    const updateFeatureMutation = useUpdateFeature();
    const deleteFeatureMutation = useDeleteFeature();

    // State for dialogs
    const [planDialogOpen, setPlanDialogOpen] = useState(false);
    const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
    const [editingFeature, setEditingFeature] = useState<PricingFeature | null>(null);

    // Form state
    const [planForm, setPlanForm] = useState({
        name: '',
        slug: '',
        price: 0,
        currency: 'NGN',
        billingPeriod: 'monthly' as 'monthly' | 'yearly' | 'one-time',
        tier: 'basic' as 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise',
        description: '',
        features: [] as string[],
        isPopular: false,
        isActive: true,
        isContactSales: false,
        whatsappNumber: '',
        trialDays: 0,
        metadata: {
            buttonText: 'Get Started',
            badge: '',
            icon: 'rocket',
        },
    });

    const [featureForm, setFeatureForm] = useState({
        featureId: '',
        name: '',
        description: '',
        category: 'general',
        isActive: true,
    });

    // Handle open plan dialog
    const handleOpenPlanDialog = (plan?: PricingPlan) => {
        if (plan) {
            setEditingPlan(plan);
            setPlanForm({
                name: plan.name,
                slug: plan.slug,
                price: plan.price,
                currency: plan.currency,
                billingPeriod: plan.billingPeriod,
                tier: plan.tier,
                description: plan.description,
                features: plan.features,
                isPopular: plan.isPopular,
                isActive: plan.isActive,
                isContactSales: plan.isContactSales,
                whatsappNumber: plan.whatsappNumber || '',
                trialDays: plan.trialDays || 0,
                metadata: {
                    buttonText: plan.metadata?.buttonText || 'Get Started',
                    badge: plan.metadata?.badge || '',
                    icon: plan.metadata?.icon || 'rocket'
                },
            });
        } else {
            setEditingPlan(null);
            setPlanForm({
                name: '',
                slug: '',
                price: 0,
                currency: 'NGN',
                billingPeriod: 'monthly',
                tier: 'basic',
                description: '',
                features: [],
                isPopular: false,
                isActive: true,
                isContactSales: false,
                whatsappNumber: '',
                trialDays: 0,
                metadata: { buttonText: 'Get Started', badge: '', icon: 'rocket' },
            });
        }
        setPlanDialogOpen(true);
    };

    // Handle open feature dialog
    const handleOpenFeatureDialog = (feature?: PricingFeature) => {
        if (feature) {
            setEditingFeature(feature);
            setFeatureForm({
                featureId: feature.featureId,
                name: feature.name,
                description: feature.description || '',
                category: feature.category || 'general',
                isActive: feature.isActive,
            });
        } else {
            setEditingFeature(null);
            setFeatureForm({
                featureId: '',
                name: '',
                description: '',
                category: 'general',
                isActive: true,
            });
        }
        setFeatureDialogOpen(true);
    };

    // Handle save plan
    const handleSavePlan = async () => {
        try {
            if (editingPlan) {
                await updatePlanMutation.mutateAsync({
                    id: editingPlan._id,
                    data: planForm,
                });
                toast.success('Plan updated successfully');
            } else {
                await createPlanMutation.mutateAsync(planForm);
                toast.success('Plan created successfully');
            }
            setPlanDialogOpen(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to save plan');
        }
    };

    // Handle save feature
    const handleSaveFeature = async () => {
        try {
            if (editingFeature) {
                await updateFeatureMutation.mutateAsync({
                    id: editingFeature._id,
                    data: featureForm,
                });
                toast.success('Feature updated successfully');
            } else {
                await createFeatureMutation.mutateAsync(featureForm);
                toast.success('Feature created successfully');
            }
            setFeatureDialogOpen(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to save feature');
        }
    };

    // Handle delete plan
    const handleDeletePlan = async (planId: string) => {
        if (window.confirm('Are you sure you want to delete this plan?')) {
            try {
                await deletePlanMutation.mutateAsync(planId);
                toast.success('Plan deleted successfully');
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'Failed to delete plan');
            }
        }
    };

    // Handle delete feature
    const handleDeleteFeature = async (featureId: string) => {
        if (window.confirm('Are you sure you want to delete this feature?')) {
            try {
                await deleteFeatureMutation.mutateAsync(featureId);
                toast.success('Feature deleted successfully');
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'Failed to delete feature');
            }
        }
    };

    // Handle toggle feature in plan
    const handleToggleFeature = (featureId: string) => {
        const newFeatures = planForm.features.includes(featureId)
            ? planForm.features.filter((f) => f !== featureId)
            : [...planForm.features, featureId];
        setPlanForm({ ...planForm, features: newFeatures });
    };

    if (plansLoading || featuresLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
                Pricing Management
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                Manage pricing plans and features. Changes here affect the public pricing page.
            </Alert>

            {/* Plans Section */}
            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            Pricing Plans
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenPlanDialog()}
                        >
                            Add Plan
                        </Button>
                    </Box>

                    <Grid container spacing={3}>
                        {plansData?.plans.map((plan) => (
                            // @ts-expect-error MUI Grid item prop type issue
                            <Grid item xs={12} md={6} lg={4} key={plan._id}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        height: '100%',
                                        border: plan.isPopular ? 2 : 1,
                                        borderColor: plan.isPopular ? 'primary.main' : 'divider',
                                    }}
                                >
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {plan.name}
                                            </Typography>
                                            <Box>
                                                <IconButton size="small" onClick={() => handleOpenPlanDialog(plan)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton size="small" color="error" onClick={() => handleDeletePlan(plan._id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: 2 }}>
                                            {plan.isPopular && (
                                                <Chip label="Popular" color="primary" size="small" sx={{ mr: 1 }} />
                                            )}
                                            {!plan.isActive && (
                                                <Chip label="Inactive" size="small" sx={{ mr: 1 }} />
                                            )}
                                            {plan.isContactSales && (
                                                <Chip label="Contact Sales" color="secondary" size="small" />
                                            )}
                                        </Box>

                                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                                            {plan.isContactSales ? 'Custom' : `₦${plan.price.toLocaleString()}`}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            {plan.description}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {plan.features.length} features • Order: {plan.order}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>

            {/* Features Section */}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            Features Library
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenFeatureDialog()}
                        >
                            Add Feature
                        </Button>
                    </Box>

                    <List>
                        {featuresData?.features.map((feature, index) => (
                            <React.Fragment key={feature._id}>
                                {index > 0 && <Divider />}
                                <ListItem>
                                    <ListItemText
                                        primary={feature.name}
                                        secondary={
                                            <Box>
                                                <Typography variant="caption" component="span">
                                                    ID: {feature.featureId} • Category: {feature.category}
                                                </Typography>
                                                {feature.description && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                        {feature.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {!feature.isActive && (
                                                <Chip label="Inactive" size="small" />
                                            )}
                                            <IconButton size="small" onClick={() => handleOpenFeatureDialog(feature)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDeleteFeature(feature._id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                </CardContent>
            </Card>

            {/* Plan Dialog */}
            <Dialog
                open={planDialogOpen}
                onClose={() => setPlanDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {editingPlan ? 'Edit Plan' : 'Create New Plan'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Plan Name"
                            value={planForm.name}
                            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label="Slug"
                            value={planForm.slug}
                            onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                            fullWidth
                            helperText="URL-friendly identifier (e.g., basic, pro)"
                        />
                        <Grid container spacing={2}>
                            {/* @ts-expect-error MUI Grid item prop type issue */}
                            <Grid item xs={6}>
                                <TextField
                                    label="Price"
                                    type="number"
                                    value={planForm.price}
                                    onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                                    fullWidth
                                />
                            </Grid>
                            {/* @ts-expect-error MUI Grid item prop type issue */}
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Currency</InputLabel>
                                    <Select
                                        value={planForm.currency}
                                        label="Currency"
                                        onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                                    >
                                        <MenuItem value="NGN">NGN</MenuItem>
                                        <MenuItem value="USD">USD</MenuItem>
                                        <MenuItem value="EUR">EUR</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Grid container spacing={2}>
                            {/* @ts-expect-error MUI Grid item prop type issue */}
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Billing Period</InputLabel>
                                    <Select
                                        value={planForm.billingPeriod}
                                        label="Billing Period"
                                        onChange={(e) => setPlanForm({ ...planForm, billingPeriod: e.target.value as any })}
                                    >
                                        <MenuItem value="monthly">Monthly</MenuItem>
                                        <MenuItem value="yearly">Yearly</MenuItem>
                                        <MenuItem value="one-time">One-time</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            {/* @ts-expect-error MUI Grid item prop type issue */}
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Tier</InputLabel>
                                    <Select
                                        value={planForm.tier}
                                        label="Tier"
                                        onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value as any })}
                                    >
                                        <MenuItem value="free_trial">Free Trial</MenuItem>
                                        <MenuItem value="basic">Basic</MenuItem>
                                        <MenuItem value="pro">Pro</MenuItem>
                                        <MenuItem value="pharmily">Pharmily</MenuItem>
                                        <MenuItem value="network">Network</MenuItem>
                                        <MenuItem value="enterprise">Enterprise</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <TextField
                            label="Description"
                            value={planForm.description}
                            onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={2}
                        />
                        <TextField
                            label="Button Text"
                            value={planForm.metadata.buttonText}
                            onChange={(e) => setPlanForm({
                                ...planForm,
                                metadata: { ...planForm.metadata, buttonText: e.target.value },
                            })}
                            fullWidth
                        />
                        <TextField
                            label="Badge Text"
                            value={planForm.metadata.badge}
                            onChange={(e) => setPlanForm({
                                ...planForm,
                                metadata: { ...planForm.metadata, badge: e.target.value },
                            })}
                            fullWidth
                            helperText="Optional badge text (e.g., 'Most Popular')"
                        />
                        <TextField
                            label="Trial Days"
                            type="number"
                            value={planForm.trialDays}
                            onChange={(e) => setPlanForm({ ...planForm, trialDays: Number(e.target.value) })}
                            fullWidth
                            helperText="Number of free trial days (0 for no trial)"
                        />
                        <TextField
                            label="WhatsApp Number"
                            value={planForm.whatsappNumber}
                            onChange={(e) => setPlanForm({ ...planForm, whatsappNumber: e.target.value })}
                            fullWidth
                            helperText="For contact sales plans (with country code, e.g., 2348012345678)"
                        />
                        <Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={planForm.isPopular}
                                        onChange={(e) => setPlanForm({ ...planForm, isPopular: e.target.checked })}
                                    />
                                }
                                label="Mark as Popular"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={planForm.isActive}
                                        onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                                    />
                                }
                                label="Active"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={planForm.isContactSales}
                                        onChange={(e) => setPlanForm({ ...planForm, isContactSales: e.target.checked })}
                                    />
                                }
                                label="Contact Sales (hides price)"
                            />
                        </Box>

                        {/* Features Selection */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                Select Features for this Plan
                            </Typography>
                            <Box sx={{ maxHeight: '300px', overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                                {featuresData?.features.map((feature) => (
                                    <FormControlLabel
                                        key={feature._id}
                                        control={
                                            <Checkbox
                                                checked={planForm.features.includes(feature.featureId)}
                                                onChange={() => handleToggleFeature(feature.featureId)}
                                            />
                                        }
                                        label={feature.name}
                                        sx={{ display: 'block' }}
                                    />
                                ))}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {planForm.features.length} features selected
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSavePlan}
                        disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                    >
                        {createPlanMutation.isPending || updatePlanMutation.isPending ? 'Saving...' : 'Save Plan'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Feature Dialog */}
            <Dialog
                open={featureDialogOpen}
                onClose={() => setFeatureDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {editingFeature ? 'Edit Feature' : 'Create New Feature'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Feature Name"
                            value={featureForm.name}
                            onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label="Feature ID"
                            value={featureForm.featureId}
                            onChange={(e) => setFeatureForm({ ...featureForm, featureId: e.target.value })}
                            fullWidth
                            helperText="Unique identifier (e.g., unlimited_patients)"
                            disabled={!!editingFeature}
                        />
                        <TextField
                            label="Description"
                            value={featureForm.description}
                            onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={2}
                        />
                        <TextField
                            label="Category"
                            value={featureForm.category}
                            onChange={(e) => setFeatureForm({ ...featureForm, category: e.target.value })}
                            fullWidth
                            helperText="e.g., core, clinical, reporting, admin"
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={featureForm.isActive}
                                    onChange={(e) => setFeatureForm({ ...featureForm, isActive: e.target.checked })}
                                />
                            }
                            label="Active"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFeatureDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveFeature}
                        disabled={createFeatureMutation.isPending || updateFeatureMutation.isPending}
                    >
                        {createFeatureMutation.isPending || updateFeatureMutation.isPending ? 'Saving...' : 'Save Feature'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PricingManagement;
