/**
 * InviteGenerator Component
 * Modal dialog for generating workspace invite links
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useGenerateInvite } from '../../queries/useWorkspaceTeam';
import type { WorkplaceRole, GenerateInviteRequest } from '../../types/workspace';

export interface InviteGeneratorProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when invite is successfully generated */
  onSuccess?: (inviteUrl: string) => void;
}

// Available workplace roles
const WORKPLACE_ROLES: WorkplaceRole[] = [
  'Staff',
  'Pharmacist',
  'Cashier',
  'Technician',
  'Assistant',
];

// Role descriptions for better UX
const ROLE_DESCRIPTIONS: Record<WorkplaceRole, string> = {
  Owner: 'Full access to all workspace features and settings',
  Staff: 'General staff member with standard access',
  Pharmacist: 'Licensed pharmacist with clinical privileges',
  Cashier: 'Point of sale and billing access',
  Technician: 'Pharmacy technician with inventory access',
  Assistant: 'Limited access for pharmacy assistants',
};

interface FormData {
  email: string;
  workplaceRole: WorkplaceRole | '';
  expiresInDays: number;
  maxUses: number;
  requiresApproval: boolean;
  personalMessage: string;
}

interface FormErrors {
  email?: string;
  workplaceRole?: string;
  expiresInDays?: string;
  maxUses?: string;
  personalMessage?: string;
}

/**
 * InviteGenerator component
 * Provides a modal dialog for generating workspace invite links
 */
const InviteGenerator: React.FC<InviteGeneratorProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    workplaceRole: '',
    expiresInDays: 7,
    maxUses: 1,
    requiresApproval: false,
    personalMessage: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const generateInviteMutation = useGenerateInvite();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        email: '',
        workplaceRole: '',
        expiresInDays: 7,
        maxUses: 1,
        requiresApproval: false,
        personalMessage: '',
      });
      setErrors({});
      setGeneratedInviteUrl('');
      setCopied(false);
    }
  }, [open]);

  /**
   * Validate email format
   */
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Role validation
    if (!formData.workplaceRole) {
      newErrors.workplaceRole = 'Please select a role';
    }

    // Expiration validation
    if (formData.expiresInDays < 1 || formData.expiresInDays > 30) {
      newErrors.expiresInDays = 'Expiration must be between 1 and 30 days';
    }

    // Max uses validation
    if (formData.maxUses < 1 || formData.maxUses > 100) {
      newErrors.maxUses = 'Max uses must be between 1 and 100';
    }

    // Personal message validation (optional but has limits)
    if (formData.personalMessage && formData.personalMessage.length > 500) {
      newErrors.personalMessage = 'Personal message must not exceed 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const requestData: GenerateInviteRequest = {
        email: formData.email.trim(),
        workplaceRole: formData.workplaceRole as WorkplaceRole,
        expiresInDays: formData.expiresInDays,
        maxUses: formData.maxUses,
        requiresApproval: formData.requiresApproval,
        personalMessage: formData.personalMessage.trim() || undefined,
      };

      const response = await generateInviteMutation.mutateAsync(requestData);

      // Set the generated invite URL
      setGeneratedInviteUrl(response.invite.inviteUrl);

      // Call success callback
      if (onSuccess) {
        onSuccess(response.invite.inviteUrl);
      }
    } catch (error) {
      console.error('Failed to generate invite:', error);
      setErrors({
        email: error instanceof Error ? error.message : 'Failed to generate invite. Please try again.',
      });
    }
  };

  /**
   * Handle copy invite link to clipboard
   */
  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    if (!generateInviteMutation.isPending) {
      onClose();
    }
  };

  /**
   * Handle input change
   */
  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const isLoading = generateInviteMutation.isPending;
  const isInviteGenerated = !!generatedInviteUrl;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="invite-generator-dialog-title"
    >
      <DialogTitle id="invite-generator-dialog-title">
        {isInviteGenerated ? 'Invite Link Generated' : 'Generate Invite Link'}
      </DialogTitle>

      <DialogContent>
        {!isInviteGenerated ? (
          <>
            {/* Email Input */}
            <TextField
              fullWidth
              required
              label="Email Address"
              placeholder="Enter invitee's email address"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isLoading}
              error={!!errors.email}
              helperText={errors.email || 'Email address of the person you want to invite'}
              sx={{ mb: 3 }}
              inputProps={{
                'aria-label': 'Email address',
                'aria-required': 'true',
              }}
              autoFocus
            />

            {/* Role Selection */}
            <FormControl fullWidth required sx={{ mb: 3 }} error={!!errors.workplaceRole}>
              <InputLabel id="role-select-label">Role</InputLabel>
              <Select
                labelId="role-select-label"
                id="role-select"
                value={formData.workplaceRole}
                label="Role"
                onChange={(e) => handleInputChange('workplaceRole', e.target.value)}
                disabled={isLoading}
                aria-describedby="role-description"
              >
                {WORKPLACE_ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
              {errors.workplaceRole && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.workplaceRole}
                </Typography>
              )}
            </FormControl>

            {/* Role Description */}
            {formData.workplaceRole && (
              <Alert severity="info" sx={{ mb: 3 }} id="role-description">
                <Typography variant="body2">
                  {ROLE_DESCRIPTIONS[formData.workplaceRole as WorkplaceRole]}
                </Typography>
              </Alert>
            )}

            {/* Expiration Date Picker */}
            <TextField
              fullWidth
              required
              type="number"
              label="Expires In (Days)"
              value={formData.expiresInDays}
              onChange={(e) => handleInputChange('expiresInDays', parseInt(e.target.value) || 1)}
              disabled={isLoading}
              error={!!errors.expiresInDays}
              helperText={errors.expiresInDays || 'Number of days until the invite expires (1-30)'}
              inputProps={{
                min: 1,
                max: 30,
                'aria-label': 'Expiration days',
                'aria-required': 'true',
              }}
              sx={{ mb: 3 }}
            />

            {/* Max Uses Input */}
            <TextField
              fullWidth
              required
              type="number"
              label="Maximum Uses"
              value={formData.maxUses}
              onChange={(e) => handleInputChange('maxUses', parseInt(e.target.value) || 1)}
              disabled={isLoading}
              error={!!errors.maxUses}
              helperText={errors.maxUses || 'Maximum number of times this invite can be used (default: 1)'}
              inputProps={{
                min: 1,
                max: 100,
                'aria-label': 'Maximum uses',
                'aria-required': 'true',
              }}
              sx={{ mb: 3 }}
            />

            {/* Requires Approval Checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.requiresApproval}
                  onChange={(e) => handleInputChange('requiresApproval', e.target.checked)}
                  disabled={isLoading}
                  inputProps={{
                    'aria-label': 'Requires approval',
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Requires Approval</Typography>
                  <Typography variant="caption" color="text.secondary">
                    New members will need to be approved before gaining access
                  </Typography>
                </Box>
              }
              sx={{ mb: 3 }}
            />

            {/* Personal Message Field */}
            <TextField
              fullWidth
              label="Personal Message (Optional)"
              placeholder="Add a personal message to the invite email..."
              multiline
              rows={3}
              value={formData.personalMessage}
              onChange={(e) => handleInputChange('personalMessage', e.target.value)}
              disabled={isLoading}
              error={!!errors.personalMessage}
              helperText={
                errors.personalMessage ||
                `${formData.personalMessage.length}/500 characters`
              }
              inputProps={{
                maxLength: 500,
                'aria-label': 'Personal message',
              }}
            />
          </>
        ) : (
          <>
            {/* Success Message */}
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Invite link generated successfully!
              </Typography>
              <Typography variant="body2">
                The invite link has been created and an email has been sent to{' '}
                <strong>{formData.email}</strong>.
              </Typography>
            </Alert>

            {/* Generated Invite Link */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Invite Link:
              </Typography>
              <TextField
                fullWidth
                value={generatedInviteUrl}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                        <IconButton
                          onClick={handleCopyInviteLink}
                          edge="end"
                          color={copied ? 'success' : 'default'}
                          aria-label="Copy invite link"
                        >
                          {copied ? <CheckCircleIcon /> : <ContentCopyIcon />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '0.875rem',
                  },
                }}
              />
            </Box>

            {/* Invite Details */}
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Invite Details:
              </Typography>
              <Typography variant="body2">
                <strong>Role:</strong> {formData.workplaceRole}
              </Typography>
              <Typography variant="body2">
                <strong>Expires:</strong> {formData.expiresInDays} day{formData.expiresInDays !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="body2">
                <strong>Max Uses:</strong> {formData.maxUses}
              </Typography>
              <Typography variant="body2">
                <strong>Requires Approval:</strong> {formData.requiresApproval ? 'Yes' : 'No'}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!isInviteGenerated ? (
          <>
            <Button onClick={handleClose} disabled={isLoading} color="inherit">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
            >
              {isLoading ? 'Generating...' : 'Generate Invite'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InviteGenerator;
