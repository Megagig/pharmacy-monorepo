import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Stack,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
  Breadcrumbs,
  Link,
  CircularProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  useTheme,
  useMediaQuery,
  Container,
} from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Security from '@mui/icons-material/Security';
import Schedule from '@mui/icons-material/Schedule';
import AttachFile from '@mui/icons-material/AttachFile';
import Person from '@mui/icons-material/Person';
import CalendarToday from '@mui/icons-material/CalendarToday';
import Visibility from '@mui/icons-material/Visibility';
import Download from '@mui/icons-material/Download';
import History from '@mui/icons-material/History';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import MedicalServices from '@mui/icons-material/MedicalServices';
import Assignment from '@mui/icons-material/Assignment';
import Assessment from '@mui/icons-material/Assessment';
import PlaylistAddCheck from '@mui/icons-material/PlaylistAddCheck';

const EditIcon = Edit;
const DeleteIcon = Delete;
const ArrowBackIcon = ArrowBack;
const SecurityIcon = Security;
const ScheduleIcon = Schedule;
const AttachFileIcon = AttachFile;
const PersonIcon = Person;
const CalendarIcon = CalendarToday;
const VisibilityIcon = Visibility;
const DownloadIcon = Download;
const HistoryIcon = History;
const ExpandMoreIcon = ExpandMore;
const ExpandLessIcon = ExpandLess;
const MedicalIcon = MedicalServices;
const AssignmentIcon = Assignment;
const AssessmentIcon = Assessment;
const PlanIcon = PlaylistAddCheck;
import { format, parseISO } from 'date-fns';
import { useClinicalNote } from '../queries/clinicalNoteQueries';
import { useEnhancedClinicalNoteStore } from '../stores/enhancedClinicalNoteStore';
import { useAuth } from '../hooks/useAuth';
import {
  ClinicalNote,
  NOTE_TYPES,
  NOTE_PRIORITIES,
  Attachment,
  LabResult,
  VitalSigns,
} from '../types/clinicalNote';
import ClinicalNoteForm from './ClinicalNoteForm';
import LoadingSpinner from './LoadingSpinner';

interface ClinicalNoteDetailProps {
  noteId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
  embedded?: boolean;
}

const ClinicalNoteDetail: React.FC<ClinicalNoteDetailProps> = ({
  noteId: propNoteId,
  onEdit,
  onDelete,
  readonly = false,
  embedded = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { id: paramNoteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Use prop noteId or param noteId
  const noteId = propNoteId || paramNoteId;

  // Local state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    content: true,
    vitals: false,
    labs: false,
    attachments: false,
    recommendations: false,
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Store actions
  const { deleteNote, downloadAttachment, deleteAttachment, loading } =
    useEnhancedClinicalNoteStore();

  // Fetch note data
  const { data, isLoading, error, refetch } = useClinicalNote(noteId || '');
  const note = data?.note;

  // Handle navigation
  const handleBack = () => {
    if (embedded) return;
    navigate('/notes');
  };

  // Handle edit
  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      setIsEditModalOpen(true);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!note) return;

    try {
      const success = await deleteNote(note._id);
      if (success) {
        setSnackbar({
          open: true,
          message: 'Note deleted successfully',
          severity: 'success',
        });

        if (onDelete) {
          onDelete();
        } else if (!embedded) {
          navigate('/notes');
        }
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete note',
        severity: 'error',
      });
    }
    setIsDeleteDialogOpen(false);
  };

  // Handle attachment download
  const handleDownloadAttachment = async (attachment: Attachment) => {
    if (!note) return;

    try {
      await downloadAttachment(note._id, attachment._id);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to download attachment',
        severity: 'error',
      });
    }
  };

  // Handle attachment delete
  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (!note) return;

    try {
      const success = await deleteAttachment(note._id, attachment._id);
      if (success) {
        setSnackbar({
          open: true,
          message: 'Attachment deleted successfully',
          severity: 'success',
        });
        refetch(); // Refresh note data
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete attachment',
        severity: 'error',
      });
    }
  };

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Format functions
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatPatientName = (patient: ClinicalNote['patient']) => {
    if (!patient) return 'Unknown Patient';
    return `${patient.firstName} ${patient.lastName}`;
  };

  const formatPharmacistName = (pharmacist: ClinicalNote['pharmacist']) => {
    if (!pharmacist) return 'Unknown Pharmacist';
    return `${pharmacist.firstName} ${pharmacist.lastName}`;
  };

  // Get type and priority info
  const getTypeInfo = (type: ClinicalNote['type']) => {
    return NOTE_TYPES.find((t) => t.value === type);
  };

  const getPriorityInfo = (priority: ClinicalNote['priority']) => {
    return NOTE_PRIORITIES.find((p) => p.value === priority);
  };

  // Helper function for priority colors (theme-aware)
  const getPriorityColor = (priority: ClinicalNote['priority']) => {
    const isDark = theme.palette.mode === 'dark';

    switch (priority) {
      case 'high':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
          text: isDark ? '#fca5a5' : '#dc2626',
          border: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fecaca',
        };
      case 'medium':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
          text: isDark ? '#fbbf24' : '#d97706',
          border: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fed7aa',
        };
      case 'low':
        return {
          bg: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
          text: isDark ? '#4ade80' : '#16a34a',
          border: isDark ? 'rgba(34, 197, 94, 0.2)' : '#bbf7d0',
        };
      default:
        return {
          bg: isDark ? 'rgba(100, 116, 139, 0.1)' : '#f8fafc',
          text: isDark ? '#94a3b8' : '#64748b',
          border: isDark ? 'rgba(100, 116, 139, 0.2)' : '#e2e8f0',
        };
    }
  };

  // Helper function to get user initials
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Helper function for theme-aware backgrounds
  const getThemeBackground = (lightColor: string, darkOpacity = 0.3) => {
    return theme.palette.mode === 'dark'
      ? `rgba(51, 65, 85, ${darkOpacity})`
      : lightColor;
  };

  // Helper function for theme-aware gradients
  const getThemeGradient = (section: string, isExpanded: boolean) => {
    if (!isExpanded) return 'transparent';

    if (theme.palette.mode === 'dark') {
      switch (section) {
        case 'content':
          return 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)';
        case 'vitals':
          return 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)';
        case 'labs':
          return 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)';
        case 'recommendations':
          return 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)';
        case 'attachments':
          return 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)';
        default:
          return 'linear-gradient(135deg, rgba(100, 116, 139, 0.1) 0%, rgba(100, 116, 139, 0.05) 100%)';
      }
    } else {
      switch (section) {
        case 'content':
          return 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
        case 'vitals':
          return 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
        case 'labs':
          return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
        case 'recommendations':
          return 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)';
        case 'attachments':
          return 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)';
        default:
          return 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)';
      }
    }
  };

  // Check permissions
  const canEdit =
    !readonly &&
    note &&
    user &&
    (note.pharmacist?._id === user.id ||
      user.role === 'admin' ||
      user.role === 'super_admin');

  const canDelete =
    !readonly &&
    note &&
    user &&
    (note.pharmacist?._id === user.id ||
      user.role === 'admin' ||
      user.role === 'super_admin');

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <LoadingSpinner />
      </Box>
    );
  }

  // Error state
  if (error || !note) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            {error ? 'Failed to load clinical note' : 'Clinical note not found'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {error
              ? 'Please try again later'
              : 'The requested note may have been deleted or you may not have permission to view it'}
          </Typography>
          {!embedded && (
            <Button variant="contained" onClick={handleBack}>
              Back to Notes
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const typeInfo = getTypeInfo(note.type);
  const priorityInfo = getPriorityInfo(note.priority);

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: embedded ? 0 : 3,
        px: embedded ? 0 : { xs: 2, sm: 3 },
      }}
    >
      {/* Modern Header */}
      {!embedded && (
        <Box sx={{ mb: 4 }}>
          {/* Enhanced Breadcrumbs */}
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{
              mb: 3,
              '& .MuiBreadcrumbs-separator': {
                mx: 1.5,
                color: 'text.secondary',
              },
            }}
          >
            <Link
              component="button"
              variant="body2"
              onClick={handleBack}
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Clinical Notes
            </Link>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              {note.title}
            </Typography>
          </Breadcrumbs>

          {/* Modern Header Card */}
          <Card
            elevation={1}
            sx={{
              p: 3,
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%)'
                : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={isMobile ? 'column' : 'row'}
              justifyContent="space-between"
              alignItems={isMobile ? 'stretch' : 'flex-start'}
              spacing={3}
            >
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    mb: 2,
                    fontSize: { xs: '1.75rem', md: '2rem' },
                    color: 'text.primary',
                  }}
                >
                  {note.title}
                </Typography>

                {/* Enhanced Badge Stack */}
                <Stack
                  direction="row"
                  spacing={1.5}
                  flexWrap="wrap"
                  sx={{ gap: 1 }}
                >
                  <Chip
                    label={typeInfo?.label || note.type}
                    size="medium"
                    sx={{
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(37, 99, 235, 0.2)'
                        : 'primary.50',
                      color: theme.palette.mode === 'dark'
                        ? 'primary.200'
                        : 'primary.700',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: theme.palette.mode === 'dark'
                        ? 'rgba(37, 99, 235, 0.3)'
                        : 'primary.200',
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(37, 99, 235, 0.3)'
                          : 'primary.100',
                      },
                    }}
                  />
                  <Chip
                    label={priorityInfo?.label || note.priority}
                    size="medium"
                    sx={{
                      backgroundColor: getPriorityColor(note.priority).bg,
                      color: getPriorityColor(note.priority).text,
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: getPriorityColor(note.priority).border,
                    }}
                  />
                  {note.isConfidential && (
                    <Chip
                      icon={<SecurityIcon sx={{ fontSize: '16px !important' }} />}
                      label="Confidential"
                      size="medium"
                      sx={{
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'warning.50',
                        color: theme.palette.mode === 'dark'
                          ? 'warning.200'
                          : 'warning.700',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark'
                          ? 'rgba(245, 158, 11, 0.3)'
                          : 'warning.200',
                      }}
                    />
                  )}
                  {note.followUpRequired && (
                    <Chip
                      icon={<ScheduleIcon sx={{ fontSize: '16px !important' }} />}
                      label="Follow-up Required"
                      size="medium"
                      sx={{
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'info.50',
                        color: theme.palette.mode === 'dark'
                          ? 'info.200'
                          : 'info.700',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark'
                          ? 'rgba(59, 130, 246, 0.3)'
                          : 'info.200',
                      }}
                    />
                  )}
                </Stack>
              </Box>

              {/* Enhanced Action Buttons */}
              <Stack
                direction={isMobile ? 'row' : 'row'}
                spacing={1.5}
                sx={{
                  flexShrink: 0,
                  justifyContent: isMobile ? 'flex-end' : 'flex-start',
                }}
              >
                {!embedded && (
                  <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBack}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      borderColor: 'grey.300',
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: 'grey.400',
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.1)'
                          : 'grey.50',
                      },
                    }}
                  >
                    Back
                  </Button>
                )}
                {canEdit && (
                  <Button
                    startIcon={<EditIcon />}
                    onClick={handleEdit}
                    variant="contained"
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                        transform: 'translateY(-1px)',
                      },
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => setIsDeleteDialogOpen(true)}
                    variant="outlined"
                    color="error"
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'error.50',
                        transform: 'translateY(-1px)',
                      },
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    Delete
                  </Button>
                )}
              </Stack>
            </Stack>
          </Card>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Enhanced Patient and Clinician Information */}
          <Card
            elevation={1}
            sx={{
              mb: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'text.primary',
                }}
              >
                <PersonIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                Patient & Clinician Information
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ width: { xs: '100%', sm: '50%' } }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      bgcolor: getThemeBackground('grey.50', 0.3),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      height: '100%',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          width: 48,
                          height: 48,
                          bgcolor: 'primary.main',
                          mr: 2,
                          fontSize: '1.1rem',
                          fontWeight: 600,
                        }}
                      >
                        {note.patient ? getInitials(note.patient.firstName, note.patient.lastName) : 'N/A'}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          color="primary.main"
                          sx={{ mb: 0.5, fontWeight: 600, fontSize: '0.875rem' }}
                        >
                          Patient
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            fontSize: '1.1rem',
                            color: 'text.primary',
                          }}
                        >
                          {formatPatientName(note.patient)}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      MRN: {note.patient?.mrn || 'N/A'}
                    </Typography>
                  </Paper>
                </Box>

                <Box sx={{ width: { xs: '100%', sm: '50%' } }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      bgcolor: getThemeBackground('grey.50', 0.3),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      height: '100%',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          width: 48,
                          height: 48,
                          bgcolor: 'secondary.main',
                          mr: 2,
                          fontSize: '1.1rem',
                          fontWeight: 600,
                        }}
                      >
                        {note.pharmacist ? getInitials(note.pharmacist.firstName, note.pharmacist.lastName) : 'N/A'}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          color="secondary.main"
                          sx={{ mb: 0.5, fontWeight: 600, fontSize: '0.875rem' }}
                        >
                          Pharmacist
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            fontSize: '1.1rem',
                            color: 'text.primary',
                          }}
                        >
                          {formatPharmacistName(note.pharmacist)}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Role: {note.pharmacist?.role || 'N/A'}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Enhanced SOAP Note Content */}
          <Card
            elevation={1}
            sx={{
              mb: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <CardContent sx={{ p: 0 }}>
              {/* Modern Collapsible Header */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 3,
                  pb: expandedSections.content ? 2 : 3,
                  background: getThemeGradient('content', expandedSections.content),
                  borderRadius: expandedSections.content ? '12px 12px 0 0' : '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: expandedSections.content
                      ? 'transparent'
                      : getThemeBackground('grey.50', 0.1),
                  },
                }}
                onClick={() => toggleSection('content')}
              >
                <Typography
                  variant="h6"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: expandedSections.content ? 'primary.main' : 'text.primary',
                  }}
                >
                  <AssignmentIcon sx={{ mr: 1.5, fontSize: 24 }} />
                  SOAP Note Content
                </Typography>
                <IconButton
                  size="small"
                  sx={{
                    backgroundColor: expandedSections.content
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(37, 99, 235, 0.2)'
                        : 'primary.100'
                      : theme.palette.mode === 'dark'
                        ? 'rgba(100, 116, 139, 0.2)'
                        : 'grey.100',
                    color: expandedSections.content ? 'primary.main' : 'text.secondary',
                    '&:hover': {
                      backgroundColor: expandedSections.content
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(37, 99, 235, 0.3)'
                          : 'primary.200'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.3)'
                          : 'grey.200',
                    },
                  }}
                >
                  {expandedSections.content ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.content}>
                <Box sx={{ px: 3, pb: 3 }}>
                  <Stack spacing={3}>
                    {note.content.subjective && (
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            color: 'primary.main',
                            mb: 2,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <MedicalIcon sx={{ mr: 1.5, fontSize: 20 }} />
                          Subjective
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 3,
                            bgcolor: getThemeBackground('grey.50', 0.3),
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                              fontSize: '0.95rem',
                            }}
                          >
                            {note.content.subjective}
                          </Typography>
                        </Paper>
                      </Box>
                    )}

                    {note.content.objective && (
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            color: 'primary.main',
                            mb: 2,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <VisibilityIcon sx={{ mr: 1.5, fontSize: 20 }} />
                          Objective
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 3,
                            bgcolor: getThemeBackground('grey.50', 0.3),
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                              fontSize: '0.95rem',
                            }}
                          >
                            {note.content.objective}
                          </Typography>
                        </Paper>
                      </Box>
                    )}

                    {note.content.assessment && (
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            color: 'primary.main',
                            mb: 2,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <AssessmentIcon sx={{ mr: 1.5, fontSize: 20 }} />
                          Assessment
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 3,
                            bgcolor: getThemeBackground('grey.50', 0.3),
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                              fontSize: '0.95rem',
                            }}
                          >
                            {note.content.assessment}
                          </Typography>
                        </Paper>
                      </Box>
                    )}

                    {note.content.plan && (
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            color: 'primary.main',
                            mb: 2,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <PlanIcon sx={{ mr: 1.5, fontSize: 20 }} />
                          Plan
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 3,
                            bgcolor: getThemeBackground('grey.50', 0.3),
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                              fontSize: '0.95rem',
                            }}
                          >
                            {note.content.plan}
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </Collapse>
            </CardContent>
          </Card>

          {/* Enhanced Vital Signs */}
          {note.vitalSigns && (
            <Card
              elevation={1}
              sx={{
                mb: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 3,
                    pb: expandedSections.vitals ? 2 : 3,
                    background: getThemeGradient('vitals', expandedSections.vitals),
                    borderRadius: expandedSections.vitals ? '12px 12px 0 0' : '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: expandedSections.vitals
                        ? 'transparent'
                        : getThemeBackground('grey.50', 0.1),
                    },
                  }}
                  onClick={() => toggleSection('vitals')}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: expandedSections.vitals ? 'success.main' : 'text.primary',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <MedicalIcon sx={{ mr: 1.5, fontSize: 24 }} />
                    Vital Signs
                  </Typography>
                  <IconButton
                    size="small"
                    sx={{
                      backgroundColor: expandedSections.vitals
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'success.100'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.2)'
                          : 'grey.100',
                      color: expandedSections.vitals ? 'success.main' : 'text.secondary',
                      '&:hover': {
                        backgroundColor: expandedSections.vitals
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(34, 197, 94, 0.3)'
                            : 'success.200'
                          : theme.palette.mode === 'dark'
                            ? 'rgba(100, 116, 139, 0.3)'
                            : 'grey.200',
                      },
                    }}
                  >
                    {expandedSections.vitals ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Box>

                <Collapse in={expandedSections.vitals}>
                  <Box sx={{ px: 3, pb: 3 }}>
                    <VitalSignsDisplay vitalSigns={note.vitalSigns} />
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Lab Results */}
          {note.laborResults && note.laborResults.length > 0 && (
            <Card
              elevation={1}
              sx={{
                mb: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 3,
                    pb: expandedSections.labs ? 2 : 3,
                    background: getThemeGradient('labs', expandedSections.labs),
                    borderRadius: expandedSections.labs ? '12px 12px 0 0' : '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: expandedSections.labs
                        ? 'transparent'
                        : getThemeBackground('grey.50', 0.1),
                    },
                  }}
                  onClick={() => toggleSection('labs')}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: expandedSections.labs ? 'warning.main' : 'text.primary',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <AssessmentIcon sx={{ mr: 1.5, fontSize: 24 }} />
                    Laboratory Results
                  </Typography>
                  <IconButton
                    size="small"
                    sx={{
                      backgroundColor: expandedSections.labs
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'warning.100'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.2)'
                          : 'grey.100',
                      color: expandedSections.labs ? 'warning.main' : 'text.secondary',
                      '&:hover': {
                        backgroundColor: expandedSections.labs
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(245, 158, 11, 0.3)'
                            : 'warning.200'
                          : theme.palette.mode === 'dark'
                            ? 'rgba(100, 116, 139, 0.3)'
                            : 'grey.200',
                      },
                    }}
                  >
                    {expandedSections.labs ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Box>

                <Collapse in={expandedSections.labs}>
                  <Box sx={{ px: 3, pb: 3 }}>
                    <LabResultsDisplay labResults={note.laborResults} />
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Recommendations */}
          {note.recommendations && note.recommendations.length > 0 && (
            <Card
              elevation={1}
              sx={{
                mb: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 3,
                    pb: expandedSections.recommendations ? 2 : 3,
                    background: getThemeGradient('recommendations', expandedSections.recommendations),
                    borderRadius: expandedSections.recommendations ? '12px 12px 0 0' : '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: expandedSections.recommendations
                        ? 'transparent'
                        : getThemeBackground('grey.50', 0.1),
                    },
                  }}
                  onClick={() => toggleSection('recommendations')}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: expandedSections.recommendations ? 'secondary.main' : 'text.primary',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <PlanIcon sx={{ mr: 1.5, fontSize: 24 }} />
                    Recommendations
                  </Typography>
                  <IconButton
                    size="small"
                    sx={{
                      backgroundColor: expandedSections.recommendations
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'secondary.100'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.2)'
                          : 'grey.100',
                      color: expandedSections.recommendations ? 'secondary.main' : 'text.secondary',
                      '&:hover': {
                        backgroundColor: expandedSections.recommendations
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(16, 185, 129, 0.3)'
                            : 'secondary.200'
                          : theme.palette.mode === 'dark'
                            ? 'rgba(100, 116, 139, 0.3)'
                            : 'grey.200',
                      },
                    }}
                  >
                    {expandedSections.recommendations ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Box>

                <Collapse in={expandedSections.recommendations}>
                  <Box sx={{ px: 3, pb: 3 }}>
                    <List sx={{ p: 0 }}>
                      {note.recommendations.map((recommendation, index) => (
                        <ListItem
                          key={index}
                          sx={{
                            px: 0,
                            py: 1.5,
                            borderBottom: index < note.recommendations.length - 1 ? '1px solid' : 'none',
                            borderColor: 'grey.200',
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                backgroundColor: 'secondary.100',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 600,
                                  color: 'secondary.main',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {index + 1}
                              </Typography>
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={recommendation}
                            primaryTypographyProps={{
                              variant: 'body1',
                              sx: {
                                lineHeight: 1.6,
                                fontSize: '0.95rem',
                              },
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Enhanced Sidebar */}
        <Box sx={{ width: { xs: '100%', md: '33.333%' }, flexShrink: 0 }}>
          {/* Enhanced Note Metadata */}
          <Card
            elevation={1}
            sx={{
              mb: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  mb: 3,
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'text.primary',
                }}
              >
                Note Information
              </Typography>

              <Stack spacing={3}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      backgroundColor: 'primary.50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      flexShrink: 0,
                    }}
                  >
                    <CalendarIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontWeight: 500, mb: 0.5 }}
                    >
                      Created
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, fontSize: '0.95rem' }}
                    >
                      {formatDate(note.createdAt)}
                    </Typography>
                  </Box>
                </Box>

                {note.updatedAt !== note.createdAt && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: 'info.50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                        flexShrink: 0,
                      }}
                    >
                      <CalendarIcon sx={{ fontSize: 20, color: 'info.main' }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: 500, mb: 0.5 }}
                      >
                        Last Updated
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 600, fontSize: '0.95rem' }}
                      >
                        {formatDate(note.updatedAt)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {note.followUpRequired && note.followUpDate && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: 'warning.50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                        flexShrink: 0,
                      }}
                    >
                      <ScheduleIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: 500, mb: 0.5 }}
                      >
                        Follow-up Date
                      </Typography>
                      <Typography
                        variant="body1"
                        color="warning.main"
                        sx={{ fontWeight: 600, fontSize: '0.95rem' }}
                      >
                        {formatDate(note.followUpDate)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {note.tags && note.tags.length > 0 && (
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2, fontWeight: 500 }}
                    >
                      Tags
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                      {note.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          sx={{
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(100, 116, 139, 0.3)'
                              : 'grey.100',
                            color: 'text.primary',
                            fontWeight: 500,
                            borderRadius: 2,
                            '&:hover': {
                              backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(100, 116, 139, 0.4)'
                                : 'grey.200',
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Enhanced Attachments */}
          {note.attachments && note.attachments.length > 0 && (
            <Card
              elevation={1}
              sx={{
                mb: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 3,
                    pb: expandedSections.attachments ? 2 : 3,
                    background: getThemeGradient('attachments', expandedSections.attachments),
                    borderRadius: expandedSections.attachments ? '12px 12px 0 0' : '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: expandedSections.attachments
                        ? 'transparent'
                        : getThemeBackground('grey.50', 0.1),
                    },
                  }}
                  onClick={() => toggleSection('attachments')}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: expandedSections.attachments ? 'info.main' : 'text.primary',
                    }}
                  >
                    <AttachFileIcon sx={{ mr: 1.5, fontSize: 24 }} />
                    Attachments ({note.attachments.length})
                  </Typography>
                  <IconButton
                    size="small"
                    sx={{
                      backgroundColor: expandedSections.attachments
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'info.100'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.2)'
                          : 'grey.100',
                      color: expandedSections.attachments ? 'info.main' : 'text.secondary',
                      '&:hover': {
                        backgroundColor: expandedSections.attachments
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(59, 130, 246, 0.3)'
                            : 'info.200'
                          : theme.palette.mode === 'dark'
                            ? 'rgba(100, 116, 139, 0.3)'
                            : 'grey.200',
                      },
                    }}
                  >
                    {expandedSections.attachments ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Box>

                <Collapse in={expandedSections.attachments}>
                  <Box sx={{ px: 3, pb: 3 }}>
                    <AttachmentsDisplay
                      attachments={note.attachments}
                      onDownload={handleDownloadAttachment}
                      onDelete={canEdit ? handleDeleteAttachment : undefined}
                    />
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Audit Trail */}
          <Card
            elevation={1}
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <CardContent sx={{ p: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 3,
                  pb: showAuditTrail ? 2 : 3,
                  background: getThemeGradient('audit', showAuditTrail),
                  borderRadius: showAuditTrail ? '12px 12px 0 0' : '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: showAuditTrail
                      ? 'transparent'
                      : getThemeBackground('grey.50', 0.1),
                  },
                }}
                onClick={() => setShowAuditTrail(!showAuditTrail)}
              >
                <Typography
                  variant="h6"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: showAuditTrail ? 'text.primary' : 'text.primary',
                  }}
                >
                  <HistoryIcon sx={{ mr: 1.5, fontSize: 24 }} />
                  Audit Trail
                </Typography>
                <IconButton
                  size="small"
                  sx={{
                    backgroundColor: showAuditTrail
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(100, 116, 139, 0.3)'
                        : 'grey.200'
                      : theme.palette.mode === 'dark'
                        ? 'rgba(100, 116, 139, 0.2)'
                        : 'grey.100',
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: showAuditTrail
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.4)'
                          : 'grey.300'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(100, 116, 139, 0.3)'
                          : 'grey.200',
                    },
                  }}
                >
                  {showAuditTrail ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              <Collapse in={showAuditTrail}>
                <Box sx={{ px: 3, pb: 3 }}>
                  <AuditTrailDisplay note={note} />
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Edit Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Edit Clinical Note</DialogTitle>
        <DialogContent>
          <ClinicalNoteForm
            noteId={note._id}
            onSave={() => {
              setIsEditModalOpen(false);
              refetch();
              setSnackbar({
                open: true,
                message: 'Note updated successfully',
                severity: 'success',
              });
            }}
            onCancel={() => setIsEditModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Clinical Note</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this clinical note? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading.deleteNote}
          >
            {loading.deleteNote ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container >
  );
};

// Helper Components

interface VitalSignsDisplayProps {
  vitalSigns: VitalSigns;
}

const VitalSignsDisplay: React.FC<VitalSignsDisplayProps> = ({
  vitalSigns,
}) => {
  const theme = useTheme();

  const getVitalCardStyles = () => ({
    p: 3,
    textAlign: 'center',
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(51, 65, 85, 0.3)'
      : 'grey.50',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(51, 65, 85, 0.4)'
        : 'grey.100',
      transform: 'translateY(-2px)',
      boxShadow: theme.palette.mode === 'dark'
        ? '0 4px 12px rgba(0, 0, 0, 0.3)'
        : '0 4px 12px rgba(0, 0, 0, 0.1)',
    },
  });

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {vitalSigns.bloodPressure && (
        <Box sx={{ width: { xs: '50%', sm: '33.333%' } }}>
          <Paper
            elevation={0}
            sx={getVitalCardStyles()}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500, mb: 1 }}
            >
              Blood Pressure
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}
            >
              {vitalSigns.bloodPressure.systolic}/
              {vitalSigns.bloodPressure.diastolic}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              mmHg
            </Typography>
          </Paper>
        </Box>
      )}

      {vitalSigns.heartRate && (
        <Box sx={{ width: { xs: '50%', sm: '33.333%' } }}>
          <Paper
            elevation={0}
            sx={getVitalCardStyles()}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500, mb: 1 }}
            >
              Heart Rate
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}
            >
              {vitalSigns.heartRate}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              bpm
            </Typography>
          </Paper>
        </Box>
      )}

      {vitalSigns.temperature && (
        <Box sx={{ width: { xs: '50%', sm: '33.333%' } }}>
          <Paper
            elevation={0}
            sx={getVitalCardStyles()}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500, mb: 1 }}
            >
              Temperature
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}
            >
              {vitalSigns.temperature}°C
            </Typography>
          </Paper>
        </Box>
      )}

      {vitalSigns.weight && (
        <Box sx={{ width: { xs: '50%', sm: '33.333%' } }}>
          <Paper
            elevation={0}
            sx={getVitalCardStyles()}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500, mb: 1 }}
            >
              Weight
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}
            >
              {vitalSigns.weight} kg
            </Typography>
          </Paper>
        </Box>
      )}

      {vitalSigns.height && (
        <Box sx={{ width: { xs: '50%', sm: '33.333%' } }}>
          <Paper
            elevation={0}
            sx={getVitalCardStyles()}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500, mb: 1 }}
            >
              Height
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}
            >
              {vitalSigns.height} cm
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

interface LabResultsDisplayProps {
  labResults: LabResult[];
}

const LabResultsDisplay: React.FC<LabResultsDisplayProps> = ({
  labResults,
}) => {
  const getStatusColor = (status: LabResult['status']) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'abnormal':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <List>
      {labResults.map((result, index) => (
        <ListItem key={index} divider={index < labResults.length - 1}>
          <ListItemText
            primary={
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="body1" fontWeight={500}>
                  {result.test}
                </Typography>
                <Chip
                  label={result.status}
                  size="small"
                  color={getStatusColor(result.status) as any}
                />
              </Box>
            }
            secondary={
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Result: <strong>{result.result}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Normal Range: {result.normalRange}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Date: {format(parseISO(result.date), 'MMM dd, yyyy')}
                </Typography>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

interface AttachmentsDisplayProps {
  attachments: Attachment[];
  onDownload: (attachment: Attachment) => void;
  onDelete?: (attachment: Attachment) => void;
}

const AttachmentsDisplay: React.FC<AttachmentsDisplayProps> = ({
  attachments,
  onDownload,
  onDelete,
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <List>
      {attachments.map((attachment, index) => (
        <ListItem
          key={attachment._id}
          divider={index < attachments.length - 1}
          secondaryAction={
            <Stack direction="row" spacing={1}>
              <Tooltip title="Download">
                <IconButton
                  edge="end"
                  onClick={() => onDownload(attachment)}
                  size="small"
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              {onDelete && (
                <Tooltip title="Delete">
                  <IconButton
                    edge="end"
                    onClick={() => onDelete(attachment)}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          }
        >
          <ListItemIcon>
            <AttachFileIcon />
          </ListItemIcon>
          <ListItemText
            primary={attachment.originalName}
            secondary={
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(attachment.size)} • {attachment.mimeType}
                </Typography>
                <br />
                <Typography variant="caption" color="text.secondary">
                  Uploaded:{' '}
                  {format(
                    parseISO(attachment.uploadedAt),
                    'MMM dd, yyyy HH:mm'
                  )}
                </Typography>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

interface AuditTrailDisplayProps {
  note: ClinicalNote;
}

const AuditTrailDisplay: React.FC<AuditTrailDisplayProps> = ({ note }) => {
  const auditEvents = [
    {
      action: 'Created',
      timestamp: note.createdAt,
      user: note.createdBy,
      details: 'Clinical note created',
    },
  ];

  if (note.updatedAt !== note.createdAt) {
    auditEvents.push({
      action: 'Modified',
      timestamp: note.updatedAt,
      user: note.lastModifiedBy,
      details: 'Clinical note updated',
    });
  }

  if (note.deletedAt) {
    auditEvents.push({
      action: 'Deleted',
      timestamp: note.deletedAt,
      user: note.deletedBy || 'Unknown',
      details: 'Clinical note deleted',
    });
  }

  return (
    <List>
      {auditEvents.map((event, index) => (
        <ListItem key={index} divider={index < auditEvents.length - 1}>
          <ListItemIcon>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
              <HistoryIcon fontSize="small" />
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography variant="body2" fontWeight={500}>
                {event.action}
              </Typography>
            }
            secondary={
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {format(parseISO(event.timestamp), 'MMM dd, yyyy HH:mm')}
                </Typography>
                <br />
                <Typography variant="caption" color="text.secondary">
                  {event.details}
                </Typography>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

export default ClinicalNoteDetail;
