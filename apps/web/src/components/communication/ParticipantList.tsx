import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Divider,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add,
  MoreVert,
  PersonAdd,
  PersonRemove,
  AdminPanelSettings,
  LocalPharmacy,
  MedicalServices,
  Person,
  Circle,
} from '@mui/icons-material';
import { Conversation } from '../../stores/types';

interface ParticipantListProps {
  conversation: Conversation;
  onAddParticipant?: (userId: string, role: string) => void;
  onRemoveParticipant?: (userId: string) => void;
  onChangeRole?: (userId: string, newRole: string) => void;
  canManageParticipants?: boolean;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
}

const ParticipantList: React.FC<ParticipantListProps> = ({
  conversation,
  onAddParticipant,
  onRemoveParticipant,
  onChangeRole,
  canManageParticipants = true,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('pharmacist');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(
    null
  );

  // Mock user options for autocomplete
  const [userOptions] = useState<UserOption[]>([
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      role: 'pharmacist',
    },
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      role: 'doctor',
    },
    {
      id: '3',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@example.com',
      role: 'patient',
    },
  ]);

  const menuOpen = Boolean(menuAnchor);

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'pharmacist':
        return <LocalPharmacy fontSize="small" />;
      case 'doctor':
        return <MedicalServices fontSize="small" />;
      case 'patient':
        return <Person fontSize="small" />;
      case 'admin':
        return <AdminPanelSettings fontSize="small" />;
      default:
        return <Person fontSize="small" />;
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'pharmacist':
        return 'primary';
      case 'doctor':
        return 'secondary';
      case 'patient':
        return 'default';
      case 'admin':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get online status (mock)
  const getOnlineStatus = (userId: string) => {
    // TODO: Implement real online status
    return Math.random() > 0.5;
  };

  // Handle add participant
  const handleAddParticipant = () => {
    if (selectedUser && selectedRole) {
      onAddParticipant?.(selectedUser.id, selectedRole);
      setAddDialogOpen(false);
      setSelectedUser(null);
      setSelectedRole('pharmacist');
    }
  };

  // Handle participant menu
  const handleParticipantMenu = (
    event: React.MouseEvent<HTMLElement>,
    userId: string
  ) => {
    setMenuAnchor(event.currentTarget);
    setSelectedParticipant(userId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedParticipant(null);
  };

  const handleRemoveParticipant = () => {
    if (selectedParticipant) {
      onRemoveParticipant?.(selectedParticipant);
    }
    handleMenuClose();
  };

  const handleChangeRole = (newRole: string) => {
    if (selectedParticipant) {
      onChangeRole?.(selectedParticipant, newRole);
    }
    handleMenuClose();
  };

  // Filter out users who are already participants
  const availableUsers = userOptions.filter(
    (user) => !conversation.participants.some((p) => p.userId === user.id)
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6">
            Participants ({conversation.participants.length})
          </Typography>
          {canManageParticipants && (
            <Tooltip title="Add participant">
              <IconButton
                size="small"
                onClick={() => setAddDialogOpen(true)}
                color="primary"
              >
                <PersonAdd />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Conversation Info */}
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {conversation.type === 'patient_query' && 'Patient Query'}
            {conversation.type === 'group' && 'Group Chat'}
            {conversation.type === 'direct' && 'Direct Message'}
          </Typography>

          {conversation.priority !== 'normal' && (
            <Chip
              label={conversation.priority}
              size="small"
              color={conversation.priority === 'urgent' ? 'error' : 'warning'}
              sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
            />
          )}
        </Box>
      </Box>

      {/* Participants List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List dense>
          {conversation.participants.map((participant) => {
            const isOnline = getOnlineStatus(participant.userId);

            return (
              <ListItem key={participant.userId}>
                <ListItemAvatar>
                  <Box sx={{ position: 'relative' }}>
                    <Avatar sx={{ width: 40, height: 40 }}>
                      {/* TODO: Get user initials or avatar */}U
                    </Avatar>
                    {/* Online Status Indicator */}
                    <Circle
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        color: isOnline ? 'success.main' : 'grey.400',
                        bgcolor: 'background.paper',
                        borderRadius: '50%',
                        border: 2,
                        borderColor: 'background.paper',
                      }}
                    />
                  </Box>
                </ListItemAvatar>

                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {/* TODO: Get user name */}
                        User Name
                      </Typography>
                      <Chip
                        icon={getRoleIcon(participant.role)}
                        label={participant.role}
                        size="small"
                        color={getRoleColor(participant.role) as any}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.75rem' }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {/* TODO: Get user email */}
                        user@example.com
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        Joined{' '}
                        {new Date(participant.joinedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />

                {canManageParticipants && (
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={(e) =>
                        handleParticipantMenu(e, participant.userId)
                      }
                    >
                      <MoreVert fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Add Participant Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Participant</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Autocomplete
              options={availableUsers}
              getOptionLabel={(option) =>
                `${option.firstName} ${option.lastName} (${option.email})`
              }
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select User"
                  placeholder="Search by name or email"
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                    {option.firstName[0]}
                    {option.lastName[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">
                      {option.firstName} {option.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Box>
                </Box>
              )}
            />

            <TextField
              select
              label="Role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
            >
              <MenuItem value="pharmacist">Pharmacist</MenuItem>
              <MenuItem value="doctor">Doctor</MenuItem>
              <MenuItem value="patient">Patient</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddParticipant}
            variant="contained"
            disabled={!selectedUser}
          >
            Add Participant
          </Button>
        </DialogActions>
      </Dialog>

      {/* Participant Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleChangeRole('pharmacist')}>
          <LocalPharmacy fontSize="small" sx={{ mr: 1 }} />
          Make Pharmacist
        </MenuItem>
        <MenuItem onClick={() => handleChangeRole('doctor')}>
          <MedicalServices fontSize="small" sx={{ mr: 1 }} />
          Make Doctor
        </MenuItem>
        <MenuItem onClick={() => handleChangeRole('patient')}>
          <Person fontSize="small" sx={{ mr: 1 }} />
          Make Patient
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleRemoveParticipant}
          sx={{ color: 'error.main' }}
        >
          <PersonRemove fontSize="small" sx={{ mr: 1 }} />
          Remove Participant
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ParticipantList;
