import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  AttachFile as AttachFileIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { usePatientNotes } from '../queries/clinicalNoteQueries';
import { useEnhancedClinicalNoteStore } from '../stores/enhancedClinicalNoteStore';
import {
  ClinicalNote,
  NOTE_TYPES,
  NOTE_PRIORITIES,
} from '../types/clinicalNote';

interface PatientClinicalNotesProps {
  patientId: string;
  maxNotes?: number;
  showCreateButton?: boolean;
  onCreateNote?: () => void;
  onViewNote?: (noteId: string) => void;
  onEditNote?: (noteId: string) => void;
}

const PatientClinicalNotes: React.FC<PatientClinicalNotesProps> = ({
  patientId,
  maxNotes = 5,
  showCreateButton = true,
  onCreateNote,
  onViewNote,
  onEditNote,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Store actions
  const { setCreateModalOpen } = useEnhancedClinicalNoteStore();

  // Fetch patient notes
  const { data, isLoading, error, refetch } = usePatientNotes(patientId, {
    limit: expanded ? 50 : maxNotes,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const notes = data?.notes || [];
  const totalNotes = data?.total || 0;

  // Handle note expansion
  const toggleNoteExpansion = (noteId: string) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  // Format functions
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatPharmacistName = (pharmacist: ClinicalNote['pharmacist']) => {
    return `${pharmacist.firstName} ${pharmacist.lastName}`;
  };

  const getTypeInfo = (type: ClinicalNote['type']) => {
    return NOTE_TYPES.find((t) => t.value === type);
  };

  const getPriorityInfo = (priority: ClinicalNote['priority']) => {
    return NOTE_PRIORITIES.find((p) => p.value === priority);
  };

  // Handle actions
  const handleCreateNote = () => {
    if (onCreateNote) {
      onCreateNote();
    } else {
      // Default behavior: open create note form with patient context
      const createUrl = `/notes/new?patientId=${patientId}`;
      window.location.href = createUrl;
    }
  };

  const handleViewNote = (noteId: string) => {
    if (onViewNote) {
      onViewNote(noteId);
    } else {
      // Default behavior: navigate to note detail
      window.location.href = `/notes/${noteId}`;
    }
  };

  const handleEditNote = (noteId: string) => {
    if (onEditNote) {
      onEditNote(noteId);
    } else {
      // Default behavior: navigate to note edit
      window.location.href = `/notes/${noteId}/edit`;
    }
  };

  // Render note summary
  const renderNoteSummary = (note: ClinicalNote) => {
    const isExpanded = expandedNotes.has(note._id);
    const typeInfo = getTypeInfo(note.type);
    const priorityInfo = getPriorityInfo(note.priority);

    return (
      <ListItem
        key={note._id}
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          mb: 1,
          '&:hover': {
            backgroundColor: '#f5f5f5',
          },
        }}
      >
        {/* Note Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            cursor: 'pointer',
          }}
          onClick={() => toggleNoteExpansion(note._id)}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {note.title}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              <Chip
                label={typeInfo?.label || note.type}
                size="small"
                variant="outlined"
                color="primary"
              />
              <Chip
                label={priorityInfo?.label || note.priority}
                size="small"
                sx={{
                  backgroundColor: priorityInfo?.color || '#757575',
                  color: 'white',
                  fontWeight: 500,
                }}
              />
              {note.isConfidential && (
                <Chip
                  icon={<SecurityIcon />}
                  label="Confidential"
                  size="small"
                  color="warning"
                />
              )}
              {note.followUpRequired && (
                <Tooltip
                  title={`Follow-up: ${
                    note.followUpDate
                      ? formatDate(note.followUpDate)
                      : 'Not scheduled'
                  }`}
                >
                  <ScheduleIcon color="warning" fontSize="small" />
                </Tooltip>
              )}
              {note.attachments?.length > 0 && (
                <Tooltip title={`${note.attachments.length} attachment(s)`}>
                  <AttachFileIcon color="action" fontSize="small" />
                </Tooltip>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {formatDate(note.createdAt)} •{' '}
              {formatPharmacistName(note.pharmacist)}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewNote(note._id);
              }}
            >
              <ViewIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEditNote(note._id);
              }}
            >
              <EditIcon />
            </IconButton>
            <IconButton size="small">
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Note Content (Expandable) */}
        <Collapse in={isExpanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            {note.content.subjective && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="primary">
                  Subjective:
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {note.content.subjective}
                </Typography>
              </Box>
            )}
            {note.content.objective && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="primary">
                  Objective:
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {note.content.objective}
                </Typography>
              </Box>
            )}
            {note.content.assessment && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="primary">
                  Assessment:
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {note.content.assessment}
                </Typography>
              </Box>
            )}
            {note.content.plan && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="primary">
                  Plan:
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {note.content.plan}
                </Typography>
              </Box>
            )}
            {note.recommendations?.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="primary">
                  Recommendations:
                </Typography>
                <List dense sx={{ mt: 0.5 }}>
                  {note.recommendations.map((rec, index) => (
                    <ListItem key={index} sx={{ py: 0, px: 1 }}>
                      <ListItemText
                        primary={rec}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {note.tags?.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {note.tags.map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      variant="outlined"
                      color="secondary"
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        </Collapse>
      </ListItem>
    );
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DescriptionIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Clinical Notes</Typography>
            {totalNotes > 0 && (
              <Chip
                label={totalNotes}
                size="small"
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        }
        action={
          <Box>
            {showCreateButton && (
              <Button
                startIcon={<AddIcon />}
                onClick={handleCreateNote}
                variant="contained"
                size="small"
              >
                New Note
              </Button>
            )}
          </Box>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Retry
              </Button>
            }
          >
            {error.response?.status === 404
              ? 'Patient not found or access denied'
              : error.response?.status === 401
              ? 'Authentication required. Please log in again.'
              : `Failed to load clinical notes: ${error.message}`}
          </Alert>
        ) : notes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <DescriptionIcon
              sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              No clinical notes found for this patient
            </Typography>
            {showCreateButton && (
              <Button
                startIcon={<AddIcon />}
                onClick={handleCreateNote}
                variant="outlined"
              >
                Create First Note
              </Button>
            )}
          </Box>
        ) : (
          <>
            <List sx={{ p: 0 }}>{notes.map(renderNoteSummary)}</List>

            {/* Show More/Less Button */}
            {totalNotes > maxNotes && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    onClick={() => setExpanded(!expanded)}
                    startIcon={
                      expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                    }
                    variant="text"
                  >
                    {expanded ? 'Show Less' : `Show All ${totalNotes} Notes`}
                  </Button>
                </Box>
              </>
            )}

            {/* View All Notes Link */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() =>
                  window.open(`/notes?patientId=${patientId}`, '_blank')
                }
                fullWidth
              >
                View All Notes in Dashboard
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientClinicalNotes;
