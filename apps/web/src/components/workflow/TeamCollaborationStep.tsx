import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Grid,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Autocomplete,
  Badge,
} from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CancelIcon from '@mui/icons-material/Cancel';
import HistoryIcon from '@mui/icons-material/History';
import TemplateIcon from '@mui/icons-material/Template';

import { useWorkplaceUsers } from '../../queries/useUsers';
import type { TeamAssignment } from '../../stores/clinicalInterventionStore';

// ===============================
// TYPES AND INTERFACES
// ===============================

interface TeamCollaborationData {
  assignments: Omit<TeamAssignment, '_id' | 'assignedAt'>[];
}

interface TeamCollaborationStepProps {
  onNext: (data: TeamCollaborationData) => void;
  onBack?: () => void;
  onCancel?: () => void;
  initialData?: {
    assignments?: Omit<TeamAssignment, '_id' | 'assignedAt'>[];
  };
  isLoading?: boolean;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phoneNumber?: string;
  avatar?: string;
}

interface CommunicationTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  role: string;
}

// ===============================
// CONSTANTS
// ===============================

const TEAM_ROLES = {
  pharmacist: {
    label: 'Pharmacist',
    description: 'Clinical pharmacist or pharmacy staff',
    icon: '💊',
    color: '#2196f3',
    defaultTasks: [
      'Review medication regimen',
      'Provide patient counseling',
      'Monitor for drug interactions',
      'Assess medication adherence',
    ],
  },
  physician: {
    label: 'Physician',
    description: 'Prescribing physician or medical doctor',
    icon: '🩺',
    color: '#4caf50',
    defaultTasks: [
      'Review clinical recommendations',
      'Approve medication changes',
      'Assess patient condition',
      'Provide medical oversight',
    ],
  },
  nurse: {
    label: 'Nurse',
    description: 'Registered nurse or nursing staff',
    icon: '👩‍⚕️',
    color: '#ff9800',
    defaultTasks: [
      'Monitor patient response',
      'Administer medications',
      'Provide patient education',
      'Report adverse effects',
    ],
  },
  patient: {
    label: 'Patient',
    description: 'The patient receiving care',
    icon: '🧑‍🦱',
    color: '#9c27b0',
    defaultTasks: [
      'Follow medication regimen',
      'Report symptoms or concerns',
      'Attend follow-up appointments',
      'Maintain medication diary',
    ],
  },
  caregiver: {
    label: 'Caregiver',
    description: 'Family member or caregiver',
    icon: '👥',
    color: '#795548',
    defaultTasks: [
      'Assist with medication administration',
      'Monitor patient condition',
      'Provide support and encouragement',
      'Communicate with healthcare team',
    ],
  },
} as const;

const ASSIGNMENT_STATUS = {
  pending: {
    label: 'Pending',
    description: 'Assignment created but not yet started',
    icon: <PendingIcon />,
    color: '#ff9800',
  },
  in_progress: {
    label: 'In Progress',
    description: 'Assignment is currently being worked on',
    icon: <PlayArrowIcon />,
    color: '#2196f3',
  },
  completed: {
    label: 'Completed',
    description: 'Assignment has been completed',
    icon: <CheckCircleIcon />,
    color: '#4caf50',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Assignment has been cancelled',
    icon: <CancelIcon />,
    color: '#f44336',
  },
} as const;

const COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'physician_consultation',
    name: 'Physician Consultation Request',
    role: 'physician',
    subject: 'Clinical Intervention Consultation Required',
    content: `Dear Dr. [Name],

I am writing to request your consultation regarding a clinical intervention for [Patient Name].

Clinical Issue: [Issue Description]
Recommended Strategy: [Strategy Details]
Clinical Rationale: [Rationale]

Your input would be valuable in optimizing this patient's care. Please let me know your thoughts or if you would like to discuss this case further.

Best regards,
[Your Name]
Clinical Pharmacist`,
  },
  {
    id: 'patient_counseling',
    name: 'Patient Counseling Session',
    role: 'patient',
    subject: 'Important Information About Your Medications',
    content: `Dear [Patient Name],

We have identified an opportunity to optimize your medication therapy to improve your health outcomes.

What we found: [Issue Description]
What we recommend: [Strategy Details]
Why this helps: [Expected Outcome]

Please schedule an appointment with us to discuss these recommendations in detail. We want to ensure you understand and are comfortable with any changes to your medications.

If you have any questions or concerns, please don't hesitate to contact us.

Best regards,
[Your Name]
Clinical Pharmacist`,
  },
  {
    id: 'nurse_monitoring',
    name: 'Nursing Monitoring Request',
    role: 'nurse',
    subject: 'Enhanced Patient Monitoring Required',
    content: `Dear [Nurse Name],

We have initiated a clinical intervention for [Patient Name] that requires enhanced monitoring.

Intervention Details: [Strategy Details]
Monitoring Parameters: [Specific Parameters]
Frequency: [Monitoring Schedule]
Alert Criteria: [When to Contact Pharmacist/Physician]

Please document all observations and contact me immediately if you notice any concerning changes.

Thank you for your collaboration in ensuring optimal patient care.

Best regards,
[Your Name]
Clinical Pharmacist`,
  },
];

// ===============================
// MAIN COMPONENT
// ===============================

const TeamCollaborationStep: React.FC<TeamCollaborationStepProps> = ({
  onNext,
  onBack,
  onCancel,
  initialData,
  isLoading = false,
}) => {
  // State
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<CommunicationTemplate | null>(null);
  const [showAssignmentHistory, setShowAssignmentHistory] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Queries
  const { data: workplaceUsersData, isLoading: loadingUsers } =
    useWorkplaceUsers();

  // Available users for assignment
  const availableUsers = useMemo(() => {
    return workplaceUsersData?.data?.users || [];
  }, [workplaceUsersData]);

  // Form setup
  const defaultValues: TeamCollaborationData = useMemo(
    () => ({
      assignments: initialData?.assignments || [],
    }),
    [initialData?.assignments]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<TeamCollaborationData>({
    defaultValues,
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'assignments',
  });

  const watchedAssignments = watch('assignments');

  // ===============================
  // HANDLERS
  // ===============================

  const handleAddAssignment = () => {
    append({
      userId: '',
      role: 'pharmacist',
      task: '',
      status: 'pending',
      notes: '',
    });
  };

  const handleRemoveAssignment = (index: number) => {
    remove(index);
  };

  const handleRoleChange = (index: number, role: string) => {
    setValue(`assignments.${index}.role`, role as TeamAssignment['role']);

    // Set default task based on role
    const roleConfig = TEAM_ROLES[role as keyof typeof TEAM_ROLES];
    if (roleConfig && roleConfig.defaultTasks.length > 0) {
      setValue(`assignments.${index}.task`, roleConfig.defaultTasks[0]);
    }
  };

  const handleGenerateTemplate = (
    assignment: TeamAssignment,
    templateId: string
  ) => {
    const template = COMMUNICATION_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setShowTemplateDialog(true);
    }
  };

  const onSubmit = (data: TeamCollaborationData) => {
    onNext(data);
  };

  // ===============================
  // RENDER HELPERS
  // ===============================

  const renderTeamOverview = () => {
    const roleCount = watchedAssignments.reduce((acc, assignment) => {
      acc[assignment.role] = (acc[assignment.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <GroupIcon color="primary" />
            Team Overview
          </Typography>

          <Grid container spacing={2}>
            {Object.entries(TEAM_ROLES).map(([roleKey, roleConfig]) => (
              <Grid item xs={6} sm={4} md={2} key={roleKey}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: roleCount[roleKey]
                      ? `${roleConfig.color}10`
                      : 'grey.50',
                    border: '1px solid',
                    borderColor: roleCount[roleKey]
                      ? roleConfig.color
                      : 'divider',
                  }}
                >
                  <Typography variant="h4" component="div">
                    {roleConfig.icon}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {roleConfig.label}
                  </Typography>
                  <Badge
                    badgeContent={roleCount[roleKey] || 0}
                    color="primary"
                    sx={{ mt: 1 }}
                  >
                    <AssignmentIcon color="action" />
                  </Badge>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Box
            sx={{
              mt: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Total assignments: {watchedAssignments.length}
            </Typography>
            <Box>
              <Button
                size="small"
                startIcon={<HistoryIcon />}
                onClick={() => setShowAssignmentHistory(true)}
                sx={{ mr: 1 }}
              >
                View History
              </Button>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddAssignment}
                variant="outlined"
              >
                Add Assignment
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderAssignmentForm = (index: number) => {
    const assignment = watchedAssignments[index];
    if (!assignment) return null;

    const roleConfig = TEAM_ROLES[assignment.role];
    const statusConfig = ASSIGNMENT_STATUS[assignment.status];

    return (
      <Card
        key={index}
        sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}
      >
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" component="span">
                {roleConfig.icon}
              </Typography>
              <Typography variant="subtitle1" fontWeight="medium">
                Assignment {index + 1}
              </Typography>
              <Chip
                size="small"
                label={statusConfig.label}
                color={statusConfig.color as any}
                icon={statusConfig.icon}
              />
            </Box>
            <IconButton
              size="small"
              onClick={() => handleRemoveAssignment(index)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Controller
                name={`assignments.${index}.role`}
                control={control}
                rules={{ required: 'Role is required' }}
                render={({ field }) => (
                  <FormControl
                    fullWidth
                    error={!!errors.assignments?.[index]?.role}
                  >
                    <InputLabel>Team Role</InputLabel>
                    <Select
                      {...field}
                      label="Team Role"
                      onChange={(e) => {
                        field.onChange(e);
                        handleRoleChange(index, e.target.value);
                      }}
                    >
                      {Object.entries(TEAM_ROLES).map(([value, config]) => (
                        <MenuItem key={value} value={value}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2">
                              {config.icon}
                            </Typography>
                            <Box>
                              <Typography variant="body1">
                                {config.label}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {config.description}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.assignments?.[index]?.role && (
                      <FormHelperText>
                        {errors.assignments[index]?.role?.message}
                      </FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name={`assignments.${index}.userId`}
                control={control}
                rules={{ required: 'Team member selection is required' }}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    options={availableUsers}
                    getOptionLabel={(option) =>
                      typeof option === 'string'
                        ? option
                        : `${option.firstName} ${option.lastName} (${option.role})`
                    }
                    loading={loadingUsers}
                    onChange={(_, value) => field.onChange(value?._id || '')}
                    value={
                      availableUsers.find((user) => user._id === field.value) ||
                      null
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Team Member"
                        placeholder="Search by name or role..."
                        error={!!errors.assignments?.[index]?.userId}
                        helperText={
                          errors.assignments?.[index]?.userId?.message
                        }
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingUsers && (
                                <CircularProgress color="inherit" size={20} />
                              )}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <ListItemAvatar>
                          <Avatar src={option.avatar}>
                            {option.firstName[0]}
                            {option.lastName[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <Box>
                          <Typography variant="body1">
                            {option.firstName} {option.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.role} • {option.email}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    noOptionsText="No team members found"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name={`assignments.${index}.task`}
                control={control}
                rules={{
                  required: 'Task description is required',
                  minLength: {
                    value: 10,
                    message: 'Task must be at least 10 characters',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label="Task Description"
                    placeholder="Describe the specific task or responsibility..."
                    error={!!errors.assignments?.[index]?.task}
                    helperText={errors.assignments?.[index]?.task?.message}
                  />
                )}
              />

              {roleConfig.defaultTasks.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Suggested tasks for {roleConfig.label}:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {roleConfig.defaultTasks.map((task, taskIndex) => (
                      <Chip
                        key={taskIndex}
                        label={task}
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setValue(`assignments.${index}.task`, task)
                        }
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name={`assignments.${index}.status`}
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select {...field} label="Status">
                      {Object.entries(ASSIGNMENT_STATUS).map(
                        ([value, config]) => (
                          <MenuItem key={value} value={value}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              {config.icon}
                              <Box>
                                <Typography variant="body1">
                                  {config.label}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {config.description}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        )
                      )}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  height: '100%',
                  alignItems: 'flex-end',
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TemplateIcon />}
                  onClick={() => {
                    const template = COMMUNICATION_TEMPLATES.find(
                      (t) => t.role === assignment.role
                    );
                    if (template) {
                      handleGenerateTemplate(assignment, template.id);
                    }
                  }}
                  disabled={!assignment.role}
                >
                  Generate Template
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EmailIcon />}
                  disabled={!assignment.userId}
                >
                  Send Email
                </Button>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name={`assignments.${index}.notes`}
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label="Additional Notes (Optional)"
                    placeholder="Any additional instructions or context..."
                  />
                )}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderAssignmentsList = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Team Assignments
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Assign specific tasks to team members for collaborative intervention
          implementation
        </Typography>

        {fields.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
            <GroupIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No team assignments yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add team members to collaborate on this intervention
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddAssignment}
            >
              Add First Assignment
            </Button>
          </Paper>
        ) : (
          <Box>{fields.map((field, index) => renderAssignmentForm(index))}</Box>
        )}
      </CardContent>
    </Card>
  );

  const renderTemplateDialog = () => (
    <Dialog
      open={showTemplateDialog}
      onClose={() => setShowTemplateDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Communication Template</DialogTitle>
      <DialogContent>
        {selectedTemplate && (
          <Box>
            <Typography variant="h6" gutterBottom>
              {selectedTemplate.name}
            </Typography>
            <TextField
              fullWidth
              label="Subject"
              value={selectedTemplate.subject}
              margin="normal"
              InputProps={{ readOnly: true }}
            />
            <TextField
              fullWidth
              multiline
              rows={10}
              label="Message Content"
              value={selectedTemplate.content}
              margin="normal"
              InputProps={{ readOnly: true }}
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              This template can be customized with specific patient and
              intervention details. Placeholders like [Patient Name] and [Issue
              Description] should be replaced with actual values.
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowTemplateDialog(false)}>Close</Button>
        <Button variant="contained">Copy Template</Button>
      </DialogActions>
    </Dialog>
  );

  const renderAssignmentHistory = () => (
    <Dialog
      open={showAssignmentHistory}
      onClose={() => setShowAssignmentHistory(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Assignment History</DialogTitle>
      <DialogContent>
        <Timeline>
          <TimelineItem>
            <TimelineSeparator>
              <TimelineDot color="primary">
                <AssignmentIcon />
              </TimelineDot>
              <TimelineConnector />
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="h6" component="span">
                Assignment Created
              </Typography>
              <Typography>Initial team assignments configured</Typography>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem>
            <TimelineSeparator>
              <TimelineDot color="secondary">
                <EmailIcon />
              </TimelineDot>
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="h6" component="span">
                Notifications Sent
              </Typography>
              <Typography>
                Team members notified of their assignments
              </Typography>
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowAssignmentHistory(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 3: Team Collaboration
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Assign tasks to healthcare team members for collaborative intervention
        implementation
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)}>
        {renderTeamOverview()}
        {renderAssignmentsList()}
        {renderTemplateDialog()}
        {renderAssignmentHistory()}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Box>
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={isLoading}
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            <Button variant="outlined" onClick={onBack} disabled={isLoading}>
              Back
            </Button>
          </Box>
          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Processing...' : 'Next: Outcome Tracking'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default TeamCollaborationStep;
