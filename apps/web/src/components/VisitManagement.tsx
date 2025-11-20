import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageIcon from '@mui/icons-material/Image';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

import { RBACGuard } from '../hooks/useRBAC';
import NoteIcon from '@mui/icons-material/Note';

import {
  usePatientVisits,
  useCreateVisit,
  useUpdateVisit,
} from '../queries/usePatientResources';
import type {
  Visit,
  SOAPNotes,
  VisitAttachment,
  CreateVisitData,
  UpdateVisitData,
} from '../types/patientManagement';

interface VisitManagementProps {
  patientId: string;
}

interface VisitFormData {
  date: Date;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

const VisitManagement: React.FC<VisitManagementProps> = ({ patientId }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [attachments, setAttachments] = useState<VisitAttachment[]>([]);

  // React Query hooks
  const {
    data: visitsResponse,
    isLoading,
    isError,
    error,
  } = usePatientVisits(patientId);
  const createVisitMutation = useCreateVisit();
  const updateVisitMutation = useUpdateVisit();

  const visits = visitsResponse?.data?.results || [];

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormData>({
    defaultValues: {
      date: new Date(),
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    },
  });

  const filteredVisits = visits.filter(
    (visit: Visit) =>
      visit.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(visit.soap).some(
        (note) => note && note.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const handleOpenDialog = (visit?: Visit) => {
    if (visit) {
      setSelectedVisit(visit);
      reset({
        date: new Date(visit.date),
        subjective: visit.soap.subjective || '',
        objective: visit.soap.objective || '',
        assessment: visit.soap.assessment || '',
        plan: visit.soap.plan || '',
      });
      setAttachments(visit.attachments || []);
    } else {
      setSelectedVisit(null);
      reset({
        date: new Date(),
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
      });
      setAttachments([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedVisit(null);
    setAttachments([]);
    reset();
  };

  const handleSaveVisit = async (formData: VisitFormData) => {
    try {
      const soap: SOAPNotes = {
        subjective: formData.subjective?.trim() || undefined,
        objective: formData.objective?.trim() || undefined,
        assessment: formData.assessment?.trim() || undefined,
        plan: formData.plan?.trim() || undefined,
      };

      const visitData: CreateVisitData | UpdateVisitData = {
        date: formData.date.toISOString(),
        soap,
        attachments,
      };

      if (selectedVisit) {
        await updateVisitMutation.mutateAsync({
          visitId: selectedVisit._id,
          visitData: visitData as UpdateVisitData,
        });
      } else {
        await createVisitMutation.mutateAsync({
          patientId,
          visitData: visitData as CreateVisitData,
        });
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving visit:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const fileAttachment: VisitAttachment = {
          kind: getFileKind(file.type),
          url: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
        };
        setAttachments((prev) => [...prev, fileAttachment]);
      });
    }
  };

  const getFileKind = (mimeType: string): VisitAttachment['kind'] => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'other';
  };

  const getFileIcon = (kind: VisitAttachment['kind']) => {
    switch (kind) {
      case 'image':
        return <ImageIcon />;
      case 'audio':
        return <AudioFileIcon />;
      case 'lab':
        return <DescriptionIcon />;
      default:
        return <AttachFileIcon />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Failed to load visits</Typography>
        <Typography variant="body2">
          {error instanceof Error
            ? error.message
            : 'Unable to retrieve visit information.'}
        </Typography>
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarTodayIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Visit Management
            </Typography>
            {visits.length > 0 && (
              <Chip
                label={`${visits.length} visit${visits.length > 1 ? 's' : ''}`}
                size="small"
                sx={{ ml: 2 }}
              />
            )}
          </Box>
          <RBACGuard action="canCreate">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              New Visit
            </Button>
          </RBACGuard>
        </Box>

        {/* Search */}
        {visits.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <TextField
                fullWidth
                size="small"
                placeholder="Search visits by date or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.5 }} />,
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Visits List */}
        {filteredVisits.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <CalendarTodayIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                {searchTerm ? 'No matching visits found' : 'No visits recorded'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'Create visit records with SOAP notes to track patient encounters'}
              </Typography>
              {!searchTerm && (
                <RBACGuard action="canCreate">
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                  >
                    Create First Visit
                  </Button>
                </RBACGuard>
              )}
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {filteredVisits.map((visit: Visit) => (
              <Card key={visit._id}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {formatDate(visit.date)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                        {visit.appointmentId && (
                          <Chip
                            label="From Appointment"
                            size="small"
                            icon={<CalendarTodayIcon />}
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        {visit.attachments && visit.attachments.length > 0 && (
                          <Chip
                            label={`${visit.attachments.length} attachment${
                              visit.attachments.length > 1 ? 's' : ''
                            }`}
                            size="small"
                            icon={<AttachFileIcon />}
                            variant="outlined"
                          />
                        )}
                      </Box>
                      {visit.appointmentId && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: 'primary.50', borderRadius: 1 }}>
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                            Linked Appointment: {visit.appointmentId}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="View Visit">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(visit)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <RBACGuard action="canUpdate">
                        <Tooltip title="Edit Visit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(visit)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </RBACGuard>
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 2,
                    }}
                  >
                    {visit.soap.subjective && (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          color="primary"
                          sx={{ mb: 1 }}
                        >
                          Subjective
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {visit.soap.subjective}
                        </Typography>
                      </Box>
                    )}

                    {visit.soap.objective && (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          color="primary"
                          sx={{ mb: 1 }}
                        >
                          Objective
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {visit.soap.objective}
                        </Typography>
                      </Box>
                    )}

                    {visit.soap.assessment && (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          color="primary"
                          sx={{ mb: 1 }}
                        >
                          Assessment
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {visit.soap.assessment}
                        </Typography>
                      </Box>
                    )}

                    {visit.soap.plan && (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          color="primary"
                          sx={{ mb: 1 }}
                        >
                          Plan
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {visit.soap.plan}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {/* Add/Edit Visit Dialog */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
              <CalendarTodayIcon sx={{ mr: 1 }} />
              {selectedVisit ? 'Edit Visit' : 'New Patient Visit'}
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <form onSubmit={handleSubmit(handleSaveVisit)}>
              <Stack spacing={3}>
                {/* Visit Date */}
                <Controller
                  name="date"
                  control={control}
                  rules={{ required: 'Visit date is required' }}
                  render={({ field }) => (
                    <DateTimePicker
                      {...field}
                      label="Visit Date & Time"
                      maxDateTime={new Date()}
                      slotProps={{
                        textField: {
                          error: !!errors.date,
                          helperText: errors.date?.message,
                          fullWidth: true,
                        },
                      }}
                    />
                  )}
                />

                {/* SOAP Notes Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs
                    value={tabValue}
                    onChange={(_, newValue) => setTabValue(newValue)}
                  >
                    <Tab label="Subjective" icon={<NoteIcon />} />
                    <Tab label="Objective" icon={<VisibilityIcon />} />
                    <Tab label="Assessment" icon={<DescriptionIcon />} />
                    <Tab label="Plan" icon={<CalendarTodayIcon />} />
                    <Tab label="Attachments" icon={<AttachFileIcon />} />
                  </Tabs>
                </Box>

                {/* Subjective Tab */}
                {tabValue === 0 && (
                  <Controller
                    name="subjective"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Subjective"
                        placeholder="Patient's chief complaint, history of present illness, symptoms..."
                        multiline
                        rows={6}
                        fullWidth
                        helperText="What the patient tells you - symptoms, concerns, history"
                      />
                    )}
                  />
                )}

                {/* Objective Tab */}
                {tabValue === 1 && (
                  <Controller
                    name="objective"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Objective"
                        placeholder="Physical examination findings, vital signs, test results..."
                        multiline
                        rows={6}
                        fullWidth
                        helperText="What you observe - physical exam, vital signs, lab results"
                      />
                    )}
                  />
                )}

                {/* Assessment Tab */}
                {tabValue === 2 && (
                  <Controller
                    name="assessment"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Assessment"
                        placeholder="Clinical impression, diagnosis, differential diagnosis..."
                        multiline
                        rows={6}
                        fullWidth
                        helperText="Your clinical judgment - diagnosis, impression, analysis"
                      />
                    )}
                  />
                )}

                {/* Plan Tab */}
                {tabValue === 3 && (
                  <Controller
                    name="plan"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Plan"
                        placeholder="Treatment plan, medications, follow-up instructions..."
                        multiline
                        rows={6}
                        fullWidth
                        helperText="Treatment plan - medications, procedures, follow-up care"
                      />
                    )}
                  />
                )}

                {/* Attachments Tab */}
                {tabValue === 4 && (
                  <Box>
                    <Box sx={{ mb: 3 }}>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<AttachFileIcon />}
                        fullWidth
                        sx={{ mb: 2 }}
                      >
                        Upload Files
                        <input
                          type="file"
                          hidden
                          multiple
                          accept="image/*,audio/*,.pdf,.doc,.docx"
                          onChange={handleFileUpload}
                        />
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        Supported: Images, Audio files, PDF, Word documents
                      </Typography>
                    </Box>

                    {attachments.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 2 }}>
                          Attachments ({attachments.length})
                        </Typography>
                        <List>
                          {attachments.map((attachment, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                {getFileIcon(attachment.kind)}
                              </ListItemIcon>
                              <ListItemText
                                primary={attachment.fileName}
                                secondary={`${
                                  attachment.mimeType
                                } • ${formatFileSize(
                                  attachment.fileSize || 0
                                )}`}
                              />
                              <IconButton
                                edge="end"
                                onClick={() => removeAttachment(index)}
                                color="error"
                              >
                                <CloseIcon />
                              </IconButton>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Box>
                )}
              </Stack>
            </form>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(handleSaveVisit)}
              variant="contained"
              disabled={isSubmitting}
              sx={{ minWidth: 120 }}
            >
              {isSubmitting
                ? 'Saving...'
                : selectedVisit
                ? 'Update Visit'
                : 'Save Visit'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default VisitManagement;
