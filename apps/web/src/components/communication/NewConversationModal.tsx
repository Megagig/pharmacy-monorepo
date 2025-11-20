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
  Chip,
  Box,
  Typography,
  Autocomplete,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Paper,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Remove from '@mui/icons-material/Remove';
import Person from '@mui/icons-material/Person';
import Group from '@mui/icons-material/Group';
import QuestionAnswer from '@mui/icons-material/QuestionAnswer';
import LocalHospital from '@mui/icons-material/LocalHospital';
import Medication from '@mui/icons-material/Medication';
import { useCommunicationStore } from '../../stores/communicationStore';
import { usePatients } from '../../queries/usePatients';
import { CreateConversationData, Conversation } from '../../stores/types';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  patientId?: string;
  onConversationCreated?: (conversation: Conversation) => void;
  // When provided, use this as the initial conversation type (e.g., 'patient_query')
  defaultType?: 'direct' | 'group' | 'patient_query';
}

interface ParticipantOption {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'pharmacist' | 'doctor' | 'patient';
  avatar?: string;
}

interface SelectedParticipant {
  userId: string;
  role: 'pharmacist' | 'doctor' | 'patient';
  permissions?: string[];
}

const NewConversationModal: React.FC<NewConversationModalProps> = ({
  open,
  onClose,
  patientId,
  onConversationCreated,
  defaultType,
}) => {
  // Component rendered (debug log removed)

  const { user } = useAuth();
  const { createConversation, createPatientQuery, loading, errors } = useCommunicationStore();
  const { data: patientsResponse } = usePatients() || { data: null };

  // Extract patients array from the response, handling different possible structures
  const patients = React.useMemo(() => {
    if (!patientsResponse) return [] as any[];

    // Standard PaginatedResponse: { data: { results: [...] } }
    const results = (patientsResponse as any)?.data?.results;
    if (Array.isArray(results)) return results;

    // Fallbacks for other structures occasionally seen in the app
    const dataArray = (patientsResponse as any)?.data;
    if (Array.isArray(dataArray)) return dataArray;

    const patientsArray = (patientsResponse as any)?.data?.patients;
    if (Array.isArray(patientsArray)) return patientsArray;

    const asUnknown = patientsResponse as unknown;
    if (Array.isArray(asUnknown)) return asUnknown as any[];

    return [] as any[];
  }, [patientsResponse]);

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [conversationType, setConversationType] = useState<
    'direct' | 'group' | 'patient_query'
  >(defaultType ?? (patientId ? 'patient_query' : 'direct'));
  const [conversationTitle, setConversationTitle] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string>(
    patientId || ''
  );
  const [selectedParticipants, setSelectedParticipants] = useState<
    SelectedParticipant[]
  >([]);
  const [priority, setPriority] = useState<
    'low' | 'normal' | 'high' | 'urgent'
  >('normal');
  const [tags, setTags] = useState<string[]>([]);
  const [caseId, setCaseId] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [availableParticipants, setAvailableParticipants] = useState<
    ParticipantOption[]
  >([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Component state (debug log removed)

  // Fetch available participants from API
  useEffect(() => {
    const fetchParticipants = async () => {
      setLoadingParticipants(true);
      try {
        const url = `/communication/participants/search?limit=100`;
        const response = await apiClient.get(url);

        if (response.data.success && Array.isArray(response.data.data)) {
          setAvailableParticipants(response.data.data);
        } else if (response.data.data) {
          setAvailableParticipants(Array.isArray(response.data.data) ? response.data.data : []);
        } else {
          setAvailableParticipants([]);
        }
      } catch (error: any) {
        console.error('Failed to fetch participants:', error);
        setAvailableParticipants([]);
      } finally {
        setLoadingParticipants(false);
      }
    };

    if (open) {
      fetchParticipants();
    }
  }, [open]); // Re-run when modal opens

  // Convert patients to participant options
  const patientOptions: ParticipantOption[] = patients.map((patient: any) => ({
    userId: patient._id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email || '',
    role: 'patient' as const,
  }));

  // Combine available participants with patients (avoiding duplicates)
  const allParticipants = React.useMemo(() => {
    const participantMap = new Map<string, ParticipantOption>();

    // Add available participants from API
    availableParticipants.forEach((p) => {
      participantMap.set(p.userId, p);
    });

    // Add patients (will override if already exists)
    patientOptions.forEach((p) => {
      participantMap.set(p.userId, p);
    });

    const result = Array.from(participantMap.values());
    return result;
  }, [availableParticipants, patientOptions]);

  // Steps for the wizard
  const steps = ['Type & Details', 'Participants', 'Settings'];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      // Initialize the type using explicit defaultType when provided, else infer from patientId
      setConversationType(defaultType ?? (patientId ? 'patient_query' : 'direct'));
      setConversationTitle('');
      setSelectedPatient(patientId || '');
      setSelectedParticipants([]);
      setPriority('normal');
      setTags([]);
      setCaseId('');
      setInitialMessage('');
      setParticipantSearch('');
      // Don't reset availableParticipants here to preserve fetched data
    } else {
      // Reset when closing
      setAvailableParticipants([]);
    }
  }, [open, patientId, defaultType]);

  // Handle participant selection
  const handleAddParticipant = (participant: ParticipantOption) => {
    const isAlreadySelected = selectedParticipants.some(
      (p) => p.userId === participant.userId
    );
    if (!isAlreadySelected) {
      setSelectedParticipants((prev) => [
        ...prev,
        {
          userId: participant.userId,
          role: participant.role,
          permissions: getDefaultPermissions(participant.role),
        },
      ]);
    }
  };

  // Handle participant removal
  const handleRemoveParticipant = (userId: string) => {
    setSelectedParticipants((prev) => prev.filter((p) => p.userId !== userId));
  };

  // Get default permissions for role
  const getDefaultPermissions = (role: string): string[] => {
    switch (role) {
      case 'pharmacist':
        return ['read', 'write', 'manage_medications'];
      case 'doctor':
        return ['read', 'write', 'manage_diagnosis'];
      case 'patient':
        return ['read', 'write'];
      default:
        return ['read'];
    }
  };

  // Get participant display name
  const getParticipantName = (userId: string): string => {
    const participant = allParticipants.find((p) => p.userId === userId);
    return participant
      ? `${participant.firstName} ${participant.lastName}`
      : 'Unknown';
  };

  // Get participant role
  const getParticipantRole = (userId: string): string => {
    const participant = allParticipants.find((p) => p.userId === userId);
    return participant?.role || 'unknown';
  };

  // Validate current step
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return (
          conversationType !== undefined &&
          (conversationType !== 'patient_query' || (selectedPatient !== '' && initialMessage.trim().length > 0))
        );
      case 1:
        return selectedParticipants.length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  // Handle previous step
  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      let newConversation: Conversation | null = null;

      if (conversationType === 'patient_query' && selectedPatient) {
        // Creating patient query via dedicated endpoint
        newConversation = await createPatientQuery({
          patientId: selectedPatient,
          title: conversationTitle || undefined,
          message: initialMessage.trim(),
          priority,
          tags: tags.length > 0 ? tags : undefined,
        });
      } else {
        // Ensure current user is included in participants
        const participants = selectedParticipants.map((p) => ({
          userId: p.userId,
          role: p.role,
        }));
        
        // Add current user if not already in the list
        if (user && !participants.some(p => p.userId === user.id)) {
          participants.push({
            userId: user.id,
            role: user.role || 'pharmacist',
          });
        }

        const conversationData: CreateConversationData = {
          type: conversationType,
          title: conversationTitle || undefined,
          participants,
          patientId: selectedPatient || undefined,
          caseId: caseId || undefined,
          priority,
          tags: tags.length > 0 ? tags : undefined,
        };

        // Submitting conversation data
        newConversation = await createConversation(conversationData);
      }

      // Conversation created successfully

      if (newConversation) {
        onConversationCreated?.(newConversation);
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to create conversation:', error);
    }
  };

  // Filter participants based on search
  const filteredParticipants = React.useMemo(() => {
    if (!participantSearch || participantSearch.trim() === '') {
      return allParticipants;
    }

    const searchLower = participantSearch.toLowerCase().trim();
    const filtered = allParticipants.filter((participant) => {
      const fullName =
        `${participant.firstName} ${participant.lastName}`.toLowerCase();
      const email = (participant.email || '').toLowerCase();
      const role = (participant.role || '').toLowerCase();

      const matches = fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        role.includes(searchLower);

      return matches;
    });

    return filtered;
  }, [allParticipants, participantSearch]);

  // Render step content
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Conversation Type */}
            <FormControl fullWidth>
              <InputLabel>Conversation Type</InputLabel>
              <Select
                value={conversationType}
                label="Conversation Type"
                onChange={(e) => setConversationType(e.target.value as any)}
              >
                <MenuItem value="direct">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person />
                    <Box>
                      <Typography>Direct Message</Typography>
                      <Typography variant="caption" color="text.secondary">
                        One-on-one conversation
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="group">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Group />
                    <Box>
                      <Typography>Group Chat</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Multi-participant conversation
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="patient_query">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <QuestionAnswer />
                    <Box>
                      <Typography>Patient Query</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Patient-initiated conversation
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {/* Conversation Title */}
            <TextField
              fullWidth
              label="Conversation Title (Optional)"
              value={conversationTitle}
              onChange={(e) => setConversationTitle(e.target.value)}
              placeholder="Enter a descriptive title..."
            />

            {/* Patient Selection (for patient queries) */}
            {conversationType === 'patient_query' && (
              <Autocomplete
                options={patientOptions}
                getOptionLabel={(option) =>
                  `${option.firstName} ${option.lastName}`
                }
                value={
                  patientOptions.find((p) => p.userId === selectedPatient) ||
                  null
                }
                onChange={(_, newValue) =>
                  setSelectedPatient(newValue?.userId || '')
                }
                renderInput={(params) => (
                  <TextField {...params} label="Select Patient" required />
                )}
                renderOption={(props, option) => {
                  // MUI passes a key inside props; extract it and apply directly to avoid spread-key warning
                  const { key, ...rest } = props as any;
                  return (
                    <Box component="li" key={key} {...rest}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        <Person />
                      </Avatar>
                      <Box>
                        <Typography>
                          {option.firstName} {option.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }}
              />
            )}

            {/* Case ID */}
            <TextField
              fullWidth
              label="Case ID (Optional)"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="Link to clinical case..."
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Participant Search */}
            <TextField
              fullWidth
              label="Search participants"
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              placeholder="Search by name, email, or role..."
            />

            {/* Available Participants */}
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              {loadingParticipants ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading participants...
                  </Typography>
                </Box>
              ) : filteredParticipants.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No participants found
                  </Typography>
                </Box>
              ) : (
                <List>
                  {filteredParticipants.map((participant) => {
                    const isSelected = selectedParticipants.some(
                      (p) => p.userId === participant.userId
                    );

                    return (
                      <ListItem key={participant.userId}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {participant.role === 'doctor' ? (
                              <LocalHospital />
                            ) : participant.role === 'pharmacist' ? (
                              <Medication />
                            ) : (
                              <Person />
                            )}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${participant.firstName} ${participant.lastName}`}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {participant.email}
                              </Typography>
                              <Chip
                                label={participant.role}
                                size="small"
                                sx={{ mt: 0.5 }}
                              />
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() =>
                              isSelected
                                ? handleRemoveParticipant(participant.userId)
                                : handleAddParticipant(participant)
                            }
                            color={isSelected ? 'error' : 'primary'}
                          >
                            {isSelected ? <Remove /> : <Add />}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Paper>

            {/* Selected Participants */}
            {selectedParticipants.length > 0 && (
              <>
                <Divider />
                <Typography variant="subtitle2">
                  Selected Participants ({selectedParticipants.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {selectedParticipants.map((participant) => (
                    <Chip
                      key={participant.userId}
                      label={`${getParticipantName(participant.userId)} (${participant.role
                        })`}
                      onDelete={() =>
                        handleRemoveParticipant(participant.userId)
                      }
                      avatar={
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {getParticipantRole(participant.userId) ===
                            'doctor' ? (
                            <LocalHospital />
                          ) : getParticipantRole(participant.userId) ===
                            'pharmacist' ? (
                            <Medication />
                          ) : (
                            <Person />
                          )}
                        </Avatar>
                      }
                    />
                  ))}
                </Box>
              </>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Priority */}
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) =>
                  setPriority(
                    e.target.value as 'low' | 'normal' | 'high' | 'urgent'
                  )
                }
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>

            {/* Tags */}
            <Autocomplete
              multiple
              freeSolo
              options={[
                'medication-review',
                'therapy-consultation',
                'follow-up',
                'urgent-care',
              ]}
              value={tags}
              onChange={(_, newValue) => setTags(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags (Optional)"
                  placeholder="Add tags..."
                />
              )}
            />

            {/* Summary */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Conversation Summary
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Type:</strong> {conversationType.replace('_', ' ')}
              </Typography>
              {conversationTitle && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Title:</strong> {conversationTitle}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Participants:</strong> {selectedParticipants.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Priority:</strong> {priority}
              </Typography>
              {tags.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Tags:</strong> {tags.join(', ')}
                </Typography>
              )}
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 600 },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Group />
          New Conversation
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error Display */}
        {(errors.createConversation || (errors as any).createPatientQuery) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.createConversation || (errors as any).createPatientQuery}
          </Alert>
        )}

        {/* Step Content */}
        {renderStepContent(activeStep)}

        {conversationType === 'patient_query' && (
          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              label="Initial Message"
              required
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Describe the patient's issue or question..."
              multiline
              minRows={3}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>

        {activeStep > 0 && <Button onClick={handleBack}>Back</Button>}

        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!isStepValid(activeStep)}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!isStepValid(activeStep) || !!loading.createConversation || !!loading.createPatientQuery}
          >
            {loading.createPatientQuery || loading.createConversation ? 'Creating...' : 'Create Conversation'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NewConversationModal;
