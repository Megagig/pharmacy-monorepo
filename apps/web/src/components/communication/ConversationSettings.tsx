import React, { useState } from 'react';
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
  Tabs,
  Tab,
  Paper,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {
  Settings,
  Person,
  Group,
  Security,
  Notifications,
  Archive,
  Delete,
  Add,
  Remove,
  Edit,
  Save,
  Cancel,
  LocalHospital,
  Medication,
  AdminPanelSettings,
} from '@mui/icons-material';
import { useCommunicationStore } from '../../stores/communicationStore';
import { Conversation } from '../../stores/types';

interface ConversationSettingsProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({
  children,
  value,
  index,
  ...other
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`conversation-settings-tabpanel-${index}`}
      aria-labelledby={`conversation-settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const ConversationSettings: React.FC<ConversationSettingsProps> = ({
  open,
  onClose,
  conversation,
}) => {
  const {
    updateConversation,
    addParticipant,
    removeParticipant,
    archiveConversation,
    deleteConversation,
    loading,
    errors,
  } = useCommunicationStore();

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(conversation.title || '');
  const [priority, setPriority] = useState(conversation.priority);
  const [tags, setTags] = useState(conversation.tags || []);
  const [caseId, setCaseId] = useState(conversation.caseId || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Mock notification settings (in real app, this would come from user preferences)
  const [notificationSettings, setNotificationSettings] = useState({
    inApp: true,
    email: false,
    sms: false,
    mentions: true,
    allMessages: false,
  });

  // Mock available users for adding participants
  const mockUsers = [
    {
      userId: 'pharmacist-3',
      firstName: 'Dr. Lisa',
      lastName: 'Anderson',
      email: 'lisa.anderson@pharmacy.com',
      role: 'pharmacist' as const,
    },
    {
      userId: 'doctor-3',
      firstName: 'Dr. Robert',
      lastName: 'Taylor',
      email: 'robert.taylor@hospital.com',
      role: 'doctor' as const,
    },
  ];

  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle title edit
  const handleTitleEdit = () => {
    setEditingTitle(true);
  };

  const handleTitleSave = async () => {
    try {
      await updateConversation(conversation._id, { title });
      setEditingTitle(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  };

  const handleTitleCancel = () => {
    setTitle(conversation.title || '');
    setEditingTitle(false);
  };

  // Handle settings save
  const handleSaveSettings = async () => {
    try {
      await updateConversation(conversation._id, {
        priority,
        tags,
        caseId: caseId || undefined,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  // Handle participant actions
  const handleAddParticipant = async (userId: string, role: string) => {
    try {
      await addParticipant(conversation._id, userId, role);
    } catch (error) {
      console.error('Failed to add participant:', error);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (window.confirm('Are you sure you want to remove this participant?')) {
      try {
        await removeParticipant(conversation._id, userId);
      } catch (error) {
        console.error('Failed to remove participant:', error);
      }
    }
  };

  // Handle conversation actions
  const handleArchiveConversation = async () => {
    if (window.confirm('Are you sure you want to archive this conversation?')) {
      try {
        await archiveConversation(conversation._id);
        onClose();
      } catch (error) {
        console.error('Failed to archive conversation:', error);
      }
    }
  };

  const handleDeleteConversation = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete this conversation? This action cannot be undone.'
      )
    ) {
      try {
        await deleteConversation(conversation._id);
        onClose();
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    }
  };

  // Get participant role icon
  const getParticipantIcon = (role: string) => {
    switch (role) {
      case 'doctor':
        return <LocalHospital />;
      case 'pharmacist':
        return <Medication />;
      case 'patient':
        return <Person />;
      default:
        return <Person />;
    }
  };

  // Get participant permissions display
  const getPermissionsDisplay = (permissions: string[]) => {
    const permissionLabels: Record<string, string> = {
      read: 'Read',
      write: 'Write',
      manage_medications: 'Manage Medications',
      manage_diagnosis: 'Manage Diagnosis',
      admin: 'Admin',
    };

    return permissions.map((perm) => permissionLabels[perm] || perm).join(', ');
  };

  // Track changes
  React.useEffect(() => {
    const hasChanges =
      priority !== conversation.priority ||
      JSON.stringify(tags) !== JSON.stringify(conversation.tags || []) ||
      caseId !== (conversation.caseId || '');

    setHasUnsavedChanges(hasChanges);
  }, [priority, tags, caseId, conversation]);

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
          <Settings />
          Conversation Settings
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Error Display */}
        {(errors.updateConversation ||
          errors.addParticipant ||
          errors.removeParticipant) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.updateConversation ||
              errors.addParticipant ||
              errors.removeParticipant}
          </Alert>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="General" icon={<Settings />} />
          <Tab label="Participants" icon={<Group />} />
          <Tab label="Notifications" icon={<Notifications />} />
          <Tab label="Security" icon={<Security />} />
        </Tabs>

        {/* General Settings Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Conversation Title */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Conversation Title
              </Typography>
              {editingTitle ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter conversation title..."
                  />
                  <IconButton
                    size="small"
                    onClick={handleTitleSave}
                    color="primary"
                  >
                    <Save />
                  </IconButton>
                  <IconButton size="small" onClick={handleTitleCancel}>
                    <Cancel />
                  </IconButton>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ flex: 1 }}>
                    {conversation.title || 'No title set'}
                  </Typography>
                  <IconButton size="small" onClick={handleTitleEdit}>
                    <Edit />
                  </IconButton>
                </Box>
              )}
            </Box>

            {/* Conversation Type */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Type
              </Typography>
              <Chip
                label={conversation.type.replace('_', ' ')}
                icon={
                  conversation.type === 'group' ? (
                    <Group />
                  ) : conversation.type === 'patient_query' ? (
                    <Person />
                  ) : (
                    <Person />
                  )
                }
              />
            </Box>

            {/* Priority */}
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value as any)}
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
                <TextField {...params} label="Tags" placeholder="Add tags..." />
              )}
            />

            {/* Case ID */}
            <TextField
              fullWidth
              label="Case ID"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="Link to clinical case..."
            />

            {/* Status */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <Chip
                label={conversation.status}
                color={conversation.status === 'active' ? 'success' : 'default'}
              />
            </Box>

            {/* Save Button */}
            {hasUnsavedChanges && (
              <Button
                variant="contained"
                onClick={handleSaveSettings}
                disabled={loading.updateConversation}
                startIcon={<Save />}
              >
                {loading.updateConversation ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </Box>
        </TabPanel>

        {/* Participants Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Current Participants */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Current Participants ({conversation.participants.length})
              </Typography>
              <Paper variant="outlined">
                <List>
                  {conversation.participants.map((participant, index) => (
                    <React.Fragment key={participant.userId}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {getParticipantIcon(participant.role)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`User ${participant.userId}`} // In real app, fetch user name
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                Role: {participant.role}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Joined:{' '}
                                {new Date(
                                  participant.joinedAt
                                ).toLocaleDateString()}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Permissions:{' '}
                                {getPermissionsDisplay(participant.permissions)}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Remove participant">
                            <IconButton
                              edge="end"
                              onClick={() =>
                                handleRemoveParticipant(participant.userId)
                              }
                              color="error"
                              size="small"
                            >
                              <Remove />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < conversation.participants.length - 1 && (
                        <Divider />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            </Box>

            {/* Add Participants */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Add Participants
              </Typography>
              <Paper variant="outlined">
                <List>
                  {mockUsers.map((user) => (
                    <ListItem key={user.userId}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {getParticipantIcon(user.role)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${user.firstName} ${user.lastName}`}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {user.email}
                            </Typography>
                            <Chip
                              label={user.role}
                              size="small"
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Add participant">
                          <IconButton
                            edge="end"
                            onClick={() =>
                              handleAddParticipant(user.userId, user.role)
                            }
                            color="primary"
                            size="small"
                          >
                            <Add />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Box>
          </Box>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Notification Preferences
            </Typography>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.inApp}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          inApp: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="In-app notifications"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.email}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          email: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Email notifications"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.sms}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          sms: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="SMS notifications"
                />

                <Divider />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.mentions}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          mentions: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Notify when mentioned"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.allMessages}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          allMessages: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Notify for all messages"
                />
              </Box>
            </Paper>
          </Box>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Encryption Status */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Encryption Status
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Security
                    color={
                      conversation.metadata.isEncrypted ? 'success' : 'error'
                    }
                  />
                  <Typography>
                    {conversation.metadata.isEncrypted
                      ? 'Encrypted'
                      : 'Not Encrypted'}
                  </Typography>
                </Box>
                {conversation.metadata.encryptionKeyId && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Key ID: {conversation.metadata.encryptionKeyId}
                  </Typography>
                )}
              </Paper>
            </Box>

            {/* Dangerous Actions */}
            <Box>
              <Typography variant="subtitle2" gutterBottom color="error">
                Dangerous Actions
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<Archive />}
                    onClick={handleArchiveConversation}
                    disabled={conversation.status === 'archived'}
                  >
                    Archive Conversation
                  </Button>

                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={handleDeleteConversation}
                  >
                    Delete Conversation
                  </Button>
                </Box>
              </Paper>
            </Box>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConversationSettings;
