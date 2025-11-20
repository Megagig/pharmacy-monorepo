import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Tabs,
  Tab,
  Divider,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  AlertTriangle,
  Shield,
  FileText,
  Save,
  Edit,
  Check,
  X,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { usePatientAuth } from '../../hooks/usePatientAuth';
import { usePatientProfile } from '../../hooks/usePatientProfile';
import {
  Patient,
  NigerianState,
  BloodGroup,
  Genotype,
  Gender,
  MaritalStatus,
} from '../../types/patientManagement';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `profile-tab-${index}`,
    'aria-controls': `profile-tabpanel-${index}`,
  };
}

// Nigerian states for dropdown
const NIGERIAN_STATES: NigerianState[] = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPES: Genotype[] = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC'];
const GENDERS: Gender[] = ['male', 'female', 'other'];
const MARITAL_STATUSES: MaritalStatus[] = ['single', 'married', 'divorced', 'widowed'];

export const PatientProfile: React.FC = () => {
  const { user } = usePatientAuth();
  const {
    profile,
    loading,
    error,
    updateProfile,
    updateLoading,
    updateError,
    updateSuccess,
  } = usePatientProfile();

  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<Patient>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        otherNames: profile.otherNames || '',
        dob: profile.dob || '',
        gender: profile.gender || undefined,
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        state: profile.state || undefined,
        lga: profile.lga || '',
        maritalStatus: profile.maritalStatus || undefined,
        bloodGroup: profile.bloodGroup || undefined,
        genotype: profile.genotype || undefined,
        weightKg: profile.weightKg || undefined,
      });
    }
  }, [profile]);

  // Show success snackbar when update succeeds
  useEffect(() => {
    if (updateSuccess) {
      setSnackbarOpen(true);
      setEditMode(false);
    }
  }, [updateSuccess]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleInputChange = (field: keyof Patient) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value,
    }));

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Required fields validation
    if (!formData.firstName?.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName?.trim()) {
      errors.lastName = 'Last name is required';
    }

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Phone validation (Nigerian format)
    if (formData.phone && !/^\+234[0-9]{10}$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid Nigerian phone number (+234XXXXXXXXXX)';
    }

    // Date of birth validation
    if (formData.dob) {
      const dobDate = new Date(formData.dob);
      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      
      if (dobDate > today) {
        errors.dob = 'Date of birth cannot be in the future';
      } else if (age > 120) {
        errors.dob = 'Please enter a valid date of birth';
      }
    }

    // Weight validation
    if (formData.weightKg && (formData.weightKg < 1 || formData.weightKg > 500)) {
      errors.weightKg = 'Please enter a valid weight (1-500 kg)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await updateProfile(formData);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    // Reset form data to original profile data
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        otherNames: profile.otherNames || '',
        dob: profile.dob || '',
        gender: profile.gender || undefined,
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        state: profile.state || undefined,
        lga: profile.lga || '',
        maritalStatus: profile.maritalStatus || undefined,
        bloodGroup: profile.bloodGroup || undefined,
        genotype: profile.genotype || undefined,
        weightKg: profile.weightKg || undefined,
      });
    }
    setValidationErrors({});
    setEditMode(false);
  };

  const calculateAge = (dob: string): number | undefined => {
    if (!dob) return undefined;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  if (loading) {
    return (
      <Box className="flex justify-center items-center min-h-screen">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="max-w-4xl mx-auto px-4 py-8">
        <Alert severity="error">
          Failed to load profile: {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Box className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <Box className="mb-8">
          <Box className="flex items-center justify-between">
            <Box>
              <Typography variant="h4" className="text-gray-900 dark:text-white font-bold">
                My Profile
              </Typography>
              <Typography variant="body1" className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your personal information and medical details
              </Typography>
            </Box>
            <Box className="flex items-center space-x-2">
              {editMode ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateLoading}
                    startIcon={<X className="h-4 w-4" />}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={updateLoading}
                    startIcon={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setEditMode(true)}
                  startIcon={<Edit className="h-4 w-4" />}
                >
                  Edit Profile
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Error Alert */}
        {updateError && (
          <Alert severity="error" className="mb-6">
            {updateError}
          </Alert>
        )}

        {/* Profile Card */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="profile tabs">
              <Tab
                label="Demographics"
                icon={<User className="h-4 w-4" />}
                iconPosition="start"
                {...a11yProps(0)}
              />
              <Tab
                label="Contact Information"
                icon={<Phone className="h-4 w-4" />}
                iconPosition="start"
                {...a11yProps(1)}
              />
              <Tab
                label="Medical Information"
                icon={<Heart className="h-4 w-4" />}
                iconPosition="start"
                {...a11yProps(2)}
              />
            </Tabs>
          </Box>

          {/* Demographics Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Input
                  label="First Name"
                  value={formData.firstName || ''}
                  onChange={handleInputChange('firstName')}
                  disabled={!editMode}
                  required
                  error={validationErrors.firstName}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Input
                  label="Last Name"
                  value={formData.lastName || ''}
                  onChange={handleInputChange('lastName')}
                  disabled={!editMode}
                  required
                  error={validationErrors.lastName}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Input
                  label="Other Names"
                  value={formData.otherNames || ''}
                  onChange={handleInputChange('otherNames')}
                  disabled={!editMode}
                  helperText="Middle name or other names"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Input
                  label="Date of Birth"
                  type="date"
                  value={formData.dob || ''}
                  onChange={handleInputChange('dob')}
                  disabled={!editMode}
                  error={validationErrors.dob}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              {formData.dob && (
                <Grid item xs={12} md={6}>
                  <Input
                    label="Age"
                    value={`${calculateAge(formData.dob)} years`}
                    disabled
                    helperText="Calculated from date of birth"
                  />
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <Input
                  label="Gender"
                  select
                  value={formData.gender || ''}
                  onChange={handleInputChange('gender')}
                  disabled={!editMode}
                  SelectProps={{ native: true }}
                >
                  <option value="">Select Gender</option>
                  {GENDERS.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </option>
                  ))}
                </Input>
              </Grid>
              <Grid item xs={12} md={6}>
                <Input
                  label="Marital Status"
                  select
                  value={formData.maritalStatus || ''}
                  onChange={handleInputChange('maritalStatus')}
                  disabled={!editMode}
                  SelectProps={{ native: true }}
                >
                  <option value="">Select Marital Status</option>
                  {MARITAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </Input>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Contact Information Tab */}
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Input
                  label="Phone Number"
                  value={formData.phone || ''}
                  onChange={handleInputChange('phone')}
                  disabled={!editMode}
                  error={validationErrors.phone}
                  helperText="Format: +234XXXXXXXXXX"
                  placeholder="+234-801-234-5678"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Input
                  label="Email Address"
                  type="email"
                  value={formData.email || ''}
                  onChange={handleInputChange('email')}
                  disabled={!editMode}
                  error={validationErrors.email}
                />
              </Grid>
              <Grid item xs={12}>
                <Input
                  label="Address"
                  value={formData.address || ''}
                  onChange={handleInputChange('address')}
                  disabled={!editMode}
                  multiline
                  rows={3}
                  helperText="Full residential address"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Input
                  label="State"
                  select
                  value={formData.state || ''}
                  onChange={handleInputChange('state')}
                  disabled={!editMode}
                  SelectProps={{ native: true }}
                >
                  <option value="">Select State</option>
                  {NIGERIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Input>
              </Grid>
              <Grid item xs={12} md={6}>
                <Input
                  label="Local Government Area (LGA)"
                  value={formData.lga || ''}
                  onChange={handleInputChange('lga')}
                  disabled={!editMode}
                />
              </Grid>
            </Grid>
          </TabPanel>

          {/* Medical Information Tab */}
          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Input
                  label="Blood Group"
                  select
                  value={formData.bloodGroup || ''}
                  onChange={handleInputChange('bloodGroup')}
                  disabled={!editMode}
                  SelectProps={{ native: true }}
                >
                  <option value="">Select Blood Group</option>
                  {BLOOD_GROUPS.map((bloodGroup) => (
                    <option key={bloodGroup} value={bloodGroup}>
                      {bloodGroup}
                    </option>
                  ))}
                </Input>
              </Grid>
              <Grid item xs={12} md={4}>
                <Input
                  label="Genotype"
                  select
                  value={formData.genotype || ''}
                  onChange={handleInputChange('genotype')}
                  disabled={!editMode}
                  SelectProps={{ native: true }}
                >
                  <option value="">Select Genotype</option>
                  {GENOTYPES.map((genotype) => (
                    <option key={genotype} value={genotype}>
                      {genotype}
                    </option>
                  ))}
                </Input>
              </Grid>
              <Grid item xs={12} md={4}>
                <Input
                  label="Weight (kg)"
                  type="number"
                  value={formData.weightKg || ''}
                  onChange={handleInputChange('weightKg')}
                  disabled={!editMode}
                  error={validationErrors.weightKg}
                  inputProps={{ min: 1, max: 500, step: 0.1 }}
                />
              </Grid>
            </Grid>

            <Divider className="my-6" />

            <Box className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <Box className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <Box>
                  <Typography variant="subtitle2" className="font-medium text-blue-900 dark:text-blue-100">
                    Medical Information Privacy
                  </Typography>
                  <Typography variant="body2" className="text-blue-700 dark:text-blue-200 mt-1">
                    Your medical information is securely stored and only accessible to authorized healthcare providers in your pharmacy. 
                    This information helps ensure you receive the best possible care and medication management.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </TabPanel>
        </Card>

        {/* Success Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity="success"
            variant="filled"
            icon={<Check className="h-4 w-4" />}
          >
            Profile updated successfully!
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default PatientProfile;