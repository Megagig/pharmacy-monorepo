import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  User,
  Star,
  X,
  Save,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface EmergencyContact {
  _id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}

interface EmergencyContactFormData {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}

interface EmergencyContactsProps {
  contacts: EmergencyContact[];
  loading?: boolean;
  error?: string;
  onAddContact: (contactData: Omit<EmergencyContactFormData, '_id'>) => Promise<void>;
  onUpdateContact: (contactId: string, contactData: Partial<EmergencyContactFormData>) => Promise<void>;
  onDeleteContact: (contactId: string) => Promise<void>;
  readonly?: boolean;
}

const RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Grandchild',
  'Partner',
  'Friend',
  'Neighbor',
  'Colleague',
  'Doctor',
  'Caregiver',
  'Other',
];

export const EmergencyContacts: React.FC<EmergencyContactsProps> = ({
  contacts,
  loading = false,
  error,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  readonly = false,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [formData, setFormData] = useState<EmergencyContactFormData>({
    name: '',
    relationship: '',
    phone: '',
    email: '',
    isPrimary: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!dialogOpen) {
      setFormData({
        name: '',
        relationship: '',
        phone: '',
        email: '',
        isPrimary: false,
      });
      setFormErrors({});
      setEditingContact(null);
    }
  }, [dialogOpen]);

  // Populate form when editing
  useEffect(() => {
    if (editingContact) {
      setFormData({
        name: editingContact.name,
        relationship: editingContact.relationship,
        phone: editingContact.phone,
        email: editingContact.email || '',
        isPrimary: editingContact.isPrimary,
      });
    }
  }, [editingContact]);

  const handleInputChange = (field: keyof EmergencyContactFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown; checked?: boolean } }
  ) => {
    const target = event.target as HTMLInputElement;
    const value = field === 'isPrimary' ? target.checked : target.value;
    
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

    if (!formData.name.trim()) {
      errors.name = 'Contact name is required';
    }

    if (!formData.relationship.trim()) {
      errors.relationship = 'Relationship is required';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\+234[0-9]{10}$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid Nigerian phone number (+234XXXXXXXXXX)';
    }

    // Email validation (optional)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Check if trying to set as primary when another primary exists
    if (formData.isPrimary && !editingContact) {
      const existingPrimary = contacts.find(contact => contact.isPrimary);
      if (existingPrimary) {
        errors.isPrimary = 'Only one primary contact is allowed. Please uncheck the current primary contact first.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      if (editingContact) {
        await onUpdateContact(editingContact._id, formData);
      } else {
        await onAddContact(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save emergency contact:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleDelete = async (contactId: string) => {
    try {
      await onDeleteContact(contactId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete emergency contact:', error);
    }
  };

  const handleSetPrimary = async (contactId: string) => {
    try {
      // First, unset all other primary contacts
      const updatePromises = contacts
        .filter(contact => contact.isPrimary && contact._id !== contactId)
        .map(contact => onUpdateContact(contact._id, { isPrimary: false }));
      
      await Promise.all(updatePromises);
      
      // Then set the selected contact as primary
      await onUpdateContact(contactId, { isPrimary: true });
    } catch (error) {
      console.error('Failed to set primary contact:', error);
    }
  };

  const primaryContact = contacts.find(contact => contact.isPrimary);
  const secondaryContacts = contacts.filter(contact => !contact.isPrimary);

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
            Emergency Contacts
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
            People to contact in case of medical emergencies
          </Typography>
        </Box>
        {!readonly && (
          <Button
            variant="primary"
            onClick={() => setDialogOpen(true)}
            startIcon={<Plus className="h-4 w-4" />}
          >
            Add Contact
          </Button>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* No Primary Contact Warning */}
      {contacts.length > 0 && !primaryContact && (
        <Alert severity="warning" className="mb-4">
          <Box className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <Box>
              <Typography variant="subtitle2" className="font-medium">
                No Primary Contact Set
              </Typography>
              <Typography variant="body2">
                Please designate one of your contacts as the primary emergency contact.
              </Typography>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Emergency Contacts List */}
      {contacts.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <Typography variant="h6" className="text-gray-900 dark:text-white mb-2">
            No Emergency Contacts
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-4">
            Add emergency contacts so healthcare providers can reach someone important to you in case of an emergency.
          </Typography>
          {!readonly && (
            <Button
              variant="primary"
              onClick={() => setDialogOpen(true)}
              startIcon={<Plus className="h-4 w-4" />}
            >
              Add Your First Contact
            </Button>
          )}
        </Card>
      ) : (
        <Box className="space-y-6">
          {/* Primary Contact */}
          {primaryContact && (
            <Box>
              <Typography variant="subtitle1" className="text-gray-900 dark:text-white font-medium mb-3 flex items-center">
                <Star className="h-4 w-4 text-yellow-500 mr-2" />
                Primary Emergency Contact
              </Typography>
              <Card className="p-4 border-l-4 border-yellow-500">
                <Box className="flex items-start justify-between mb-3">
                  <Box className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-600" />
                    <Box>
                      <Typography variant="h6" className="text-gray-900 dark:text-white font-medium">
                        {primaryContact.name}
                      </Typography>
                      <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                        {primaryContact.relationship}
                      </Typography>
                    </Box>
                  </Box>
                  <Box className="flex items-center space-x-1">
                    <Chip
                      label="Primary"
                      size="small"
                      color="warning"
                      variant="outlined"
                      icon={<Star className="h-3 w-3" />}
                    />
                    {!readonly && (
                      <>
                        <Tooltip title="Edit contact">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(primaryContact)}
                          >
                            <Edit className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete contact">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmId(primaryContact._id)}
                            color="error"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                </Box>

                <Box className="space-y-2">
                  <Box className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                    <Phone className="h-4 w-4" />
                    <Typography variant="body2">{primaryContact.phone}</Typography>
                  </Box>
                  {primaryContact.email && (
                    <Box className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                      <Mail className="h-4 w-4" />
                      <Typography variant="body2">{primaryContact.email}</Typography>
                    </Box>
                  )}
                </Box>
              </Card>
            </Box>
          )}

          {/* Secondary Contacts */}
          {secondaryContacts.length > 0 && (
            <Box>
              <Typography variant="subtitle1" className="text-gray-900 dark:text-white font-medium mb-3">
                Additional Emergency Contacts ({secondaryContacts.length})
              </Typography>
              <Grid container spacing={3}>
                {secondaryContacts.map((contact) => (
                  <Grid item xs={12} md={6} key={contact._id}>
                    <Card className="p-4 h-full">
                      <Box className="flex items-start justify-between mb-3">
                        <Box className="flex items-center space-x-3">
                          <User className="h-5 w-5 text-gray-600" />
                          <Box>
                            <Typography variant="h6" className="text-gray-900 dark:text-white font-medium">
                              {contact.name}
                            </Typography>
                            <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                              {contact.relationship}
                            </Typography>
                          </Box>
                        </Box>
                        <Box className="flex items-center space-x-1">
                          {!readonly && (
                            <>
                              <Tooltip title="Set as primary">
                                <IconButton
                                  size="small"
                                  onClick={() => handleSetPrimary(contact._id)}
                                  color="warning"
                                >
                                  <Star className="h-4 w-4" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit contact">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(contact)}
                                >
                                  <Edit className="h-4 w-4" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete contact">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteConfirmId(contact._id)}
                                  color="error"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </Box>

                      <Box className="space-y-2">
                        <Box className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                          <Phone className="h-4 w-4" />
                          <Typography variant="body2">{contact.phone}</Typography>
                        </Box>
                        {contact.email && (
                          <Box className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                            <Mail className="h-4 w-4" />
                            <Typography variant="body2">{contact.email}</Typography>
                          </Box>
                        )}
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* Add/Edit Contact Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box className="flex items-center justify-between">
            <Typography variant="h6">
              {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
            </Typography>
            <IconButton onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box className="space-y-4 pt-2">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={handleInputChange('name')}
              error={formErrors.name}
              required
              helperText="Full name of the emergency contact"
            />

            <Input
              label="Relationship"
              select
              value={formData.relationship}
              onChange={handleInputChange('relationship')}
              error={formErrors.relationship}
              required
              SelectProps={{ native: true }}
              helperText="Your relationship to this person"
            >
              <option value="">Select Relationship</option>
              {RELATIONSHIP_OPTIONS.map((relationship) => (
                <option key={relationship} value={relationship}>
                  {relationship}
                </option>
              ))}
            </Input>

            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              error={formErrors.phone}
              required
              helperText="Format: +234XXXXXXXXXX"
              placeholder="+234-801-234-5678"
            />

            <Input
              label="Email Address"
              type="email"
              value={formData.email || ''}
              onChange={handleInputChange('email')}
              error={formErrors.email}
              helperText="Optional email address"
            />

            <Box className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={formData.isPrimary}
                onChange={handleInputChange('isPrimary')}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isPrimary" className="text-sm text-gray-700 dark:text-gray-300">
                Set as primary emergency contact
              </label>
            </Box>
            {formErrors.isPrimary && (
              <Typography variant="caption" color="error">
                {formErrors.isPrimary}
              </Typography>
            )}

            <Alert severity="info">
              <Typography variant="body2">
                <strong>Emergency Contact Guidelines:</strong>
                <br />
                • Choose someone who is usually available and can be reached quickly
                <br />
                • Inform them that they are listed as your emergency contact
                <br />
                • Keep their contact information up to date
                <br />
                • Consider having at least 2-3 emergency contacts
              </Typography>
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            startIcon={<Save className="h-4 w-4" />}
          >
            {editingContact ? 'Update Contact' : 'Add Contact'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="sm"
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this emergency contact? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outline"
            onClick={() => setDeleteConfirmId(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmergencyContacts;