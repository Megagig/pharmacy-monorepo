import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Shield,
  Calendar,
  DollarSign,
  FileText,
  Edit,
  Save,
  X,
  Check,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface InsuranceInfo {
  provider?: string;
  policyNumber?: string;
  expiryDate?: string;
  coverageDetails?: string;
  copayAmount?: number;
}

interface InsuranceInfoProps {
  insuranceInfo: InsuranceInfo;
  loading?: boolean;
  error?: string;
  onUpdateInsurance: (insuranceData: InsuranceInfo) => Promise<void>;
  readonly?: boolean;
}

const COMMON_INSURANCE_PROVIDERS = [
  'AIICO Insurance',
  'AXA Mansard Insurance',
  'Cornerstone Insurance',
  'Consolidated Hallmark Insurance',
  'Continental Reinsurance',
  'Custodian and Allied Insurance',
  'FBN Insurance',
  'Goldlink Insurance',
  'Great Nigeria Insurance',
  'Guinea Insurance',
  'Hygeia HMO',
  'Industrial and General Insurance',
  'International Energy Insurance',
  'Lasaco Assurance',
  'Law Union and Rock Insurance',
  'Leadway Assurance',
  'Liberty Mutual Insurance',
  'Linkage Assurance',
  'Mutual Benefits Assurance',
  'NAICOM',
  'NEM Insurance',
  'Niger Insurance',
  'NSIA Insurance',
  'Oceanic Life Insurance',
  'Old Mutual Nigeria',
  'Prestige Assurance',
  'Regency Alliance Insurance',
  'Royal Exchange Assurance',
  'Sovereign Trust Insurance',
  'Standard Alliance Insurance',
  'Stanbic IBTC Insurance',
  'Sterling Assurance',
  'Sunu Assurances Nigeria',
  'Tangerine Life Insurance',
  'Total Health Trust (THT)',
  'Unified Payment Services (UPS)',
  'Unity Kapital Assurance',
  'Veritas Kapital Assurance',
  'Wapic Insurance',
  'Other',
];

export const InsuranceInfo: React.FC<InsuranceInfoProps> = ({
  insuranceInfo,
  loading = false,
  error,
  onUpdateInsurance,
  readonly = false,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<InsuranceInfo>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize form data when insurance info loads
  useEffect(() => {
    setFormData({
      provider: insuranceInfo.provider || '',
      policyNumber: insuranceInfo.policyNumber || '',
      expiryDate: insuranceInfo.expiryDate || '',
      coverageDetails: insuranceInfo.coverageDetails || '',
      copayAmount: insuranceInfo.copayAmount || undefined,
    });
  }, [insuranceInfo]);

  const handleInputChange = (field: keyof InsuranceInfo) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value,
    }));

    // Clear validation error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Policy number validation (if provider is specified)
    if (formData.provider && !formData.policyNumber?.trim()) {
      errors.policyNumber = 'Policy number is required when insurance provider is specified';
    }

    // Expiry date validation
    if (formData.expiryDate) {
      const expiryDate = new Date(formData.expiryDate);
      const today = new Date();
      
      if (expiryDate <= today) {
        errors.expiryDate = 'Insurance policy appears to be expired';
      }
    }

    // Copay amount validation
    if (formData.copayAmount !== undefined && formData.copayAmount < 0) {
      errors.copayAmount = 'Copay amount cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await onUpdateInsurance(formData);
      setEditMode(false);
    } catch (error) {
      console.error('Failed to update insurance information:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original insurance info
    setFormData({
      provider: insuranceInfo.provider || '',
      policyNumber: insuranceInfo.policyNumber || '',
      expiryDate: insuranceInfo.expiryDate || '',
      coverageDetails: insuranceInfo.coverageDetails || '',
      copayAmount: insuranceInfo.copayAmount || undefined,
    });
    setFormErrors({});
    setEditMode(false);
  };

  const isExpiringSoon = (expiryDate: string): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    return expiry <= thirtyDaysFromNow && expiry > today;
  };

  const isExpired = (expiryDate: string): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry <= today;
  };

  const hasInsuranceInfo = insuranceInfo.provider || insuranceInfo.policyNumber;

  if (loading) {
    return (
      <Box className="flex justify-center items-center py-8">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box className="flex items-center justify-between mb-6">
        <Box>
          <Typography variant="h6" className="text-gray-900 dark:text-white font-semibold">
            Insurance Information
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
            Manage your health insurance details for billing and claims
          </Typography>
        </Box>
        {!readonly && (
          <Box className="flex items-center space-x-2">
            {editMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={submitting}
                  startIcon={<X className="h-4 w-4" />}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={submitting}
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
                {hasInsuranceInfo ? 'Edit Insurance' : 'Add Insurance'}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Expiry Warnings */}
      {hasInsuranceInfo && insuranceInfo.expiryDate && (
        <>
          {isExpired(insuranceInfo.expiryDate) && (
            <Alert severity="error" className="mb-4">
              <Box className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <Box>
                  <Typography variant="subtitle2" className="font-medium">
                    Insurance Policy Expired
                  </Typography>
                  <Typography variant="body2">
                    Your insurance policy expired on {new Date(insuranceInfo.expiryDate).toLocaleDateString()}. 
                    Please update your insurance information or contact your provider.
                  </Typography>
                </Box>
              </Box>
            </Alert>
          )}
          {!isExpired(insuranceInfo.expiryDate) && isExpiringSoon(insuranceInfo.expiryDate) && (
            <Alert severity="warning" className="mb-4">
              <Box className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <Box>
                  <Typography variant="subtitle2" className="font-medium">
                    Insurance Policy Expiring Soon
                  </Typography>
                  <Typography variant="body2">
                    Your insurance policy expires on {new Date(insuranceInfo.expiryDate).toLocaleDateString()}. 
                    Please renew your policy to avoid coverage gaps.
                  </Typography>
                </Box>
              </Box>
            </Alert>
          )}
        </>
      )}

      {/* Insurance Information Card */}
      {!hasInsuranceInfo && !editMode ? (
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <Typography variant="h6" className="text-gray-900 dark:text-white mb-2">
            No Insurance Information
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-4">
            Add your health insurance information to help with billing and claims processing.
          </Typography>
          {!readonly && (
            <Button
              variant="primary"
              onClick={() => setEditMode(true)}
              startIcon={<Plus className="h-4 w-4" />}
            >
              Add Insurance Information
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-6">
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Input
                label="Insurance Provider"
                value={formData.provider || ''}
                onChange={handleInputChange('provider')}
                disabled={!editMode}
                error={formErrors.provider}
                helperText="Name of your insurance company"
                list="insurance-providers"
              />
              <datalist id="insurance-providers">
                {COMMON_INSURANCE_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider} />
                ))}
              </datalist>
            </Grid>

            <Grid item xs={12} md={6}>
              <Input
                label="Policy Number"
                value={formData.policyNumber || ''}
                onChange={handleInputChange('policyNumber')}
                disabled={!editMode}
                error={formErrors.policyNumber}
                helperText="Your insurance policy number"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Input
                label="Expiry Date"
                type="date"
                value={formData.expiryDate || ''}
                onChange={handleInputChange('expiryDate')}
                disabled={!editMode}
                error={formErrors.expiryDate}
                helperText="When does your policy expire?"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Input
                label="Copay Amount (₦)"
                type="number"
                value={formData.copayAmount || ''}
                onChange={handleInputChange('copayAmount')}
                disabled={!editMode}
                error={formErrors.copayAmount}
                helperText="Amount you pay for each visit"
                inputProps={{ min: 0, step: 100 }}
              />
            </Grid>

            <Grid item xs={12}>
              <Input
                label="Coverage Details"
                value={formData.coverageDetails || ''}
                onChange={handleInputChange('coverageDetails')}
                disabled={!editMode}
                multiline
                rows={3}
                helperText="Details about what your insurance covers (optional)"
              />
            </Grid>
          </Grid>

          {!editMode && hasInsuranceInfo && (
            <>
              <Divider className="my-6" />
              
              {/* Insurance Summary */}
              <Box className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <Typography variant="subtitle2" className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                  Insurance Summary
                </Typography>
                
                <Grid container spacing={2}>
                  {insuranceInfo.provider && (
                    <Grid item xs={12} sm={6}>
                      <Box className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <Box>
                          <Typography variant="caption" className="text-blue-700 dark:text-blue-200">
                            Provider
                          </Typography>
                          <Typography variant="body2" className="text-blue-900 dark:text-blue-100 font-medium">
                            {insuranceInfo.provider}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}
                  
                  {insuranceInfo.policyNumber && (
                    <Grid item xs={12} sm={6}>
                      <Box className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <Box>
                          <Typography variant="caption" className="text-blue-700 dark:text-blue-200">
                            Policy Number
                          </Typography>
                          <Typography variant="body2" className="text-blue-900 dark:text-blue-100 font-medium">
                            {insuranceInfo.policyNumber}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}
                  
                  {insuranceInfo.expiryDate && (
                    <Grid item xs={12} sm={6}>
                      <Box className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <Box>
                          <Typography variant="caption" className="text-blue-700 dark:text-blue-200">
                            Expires
                          </Typography>
                          <Typography variant="body2" className="text-blue-900 dark:text-blue-100 font-medium">
                            {new Date(insuranceInfo.expiryDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}
                  
                  {insuranceInfo.copayAmount && (
                    <Grid item xs={12} sm={6}>
                      <Box className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        <Box>
                          <Typography variant="caption" className="text-blue-700 dark:text-blue-200">
                            Copay
                          </Typography>
                          <Typography variant="body2" className="text-blue-900 dark:text-blue-100 font-medium">
                            ₦{insuranceInfo.copayAmount.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </>
          )}
        </Card>
      )}

      {/* Information Alert */}
      <Alert severity="info" className="mt-4">
        <Typography variant="body2">
          <strong>Insurance Information Privacy:</strong>
          <br />
          Your insurance information is securely stored and only used for billing and claims processing. 
          This information helps ensure accurate billing and may reduce your out-of-pocket costs for covered services.
        </Typography>
      </Alert>
    </Box>
  );
};

export default InsuranceInfo;