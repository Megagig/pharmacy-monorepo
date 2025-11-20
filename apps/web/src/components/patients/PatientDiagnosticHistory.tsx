import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  Skeleton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Note as NoteIcon,
  LocalHospital as LocalHospitalIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  usePatientDiagnosticHistory,
  useAddDiagnosticHistoryNote,
  useExportDiagnosticHistory,
} from '../../queries/useDiagnosticHistory';

interface PatientDiagnosticHistoryProps {
  patientId: string;
  showHeader?: boolean;
  maxItems?: number;
  showActions?: boolean;
}

const PatientDiagnosticHistory: React.FC<PatientDiagnosticHistoryProps> = ({
  patientId,
  showHeader = true,
  maxItems = 5,
  showActions = true,
}) => {
  const navigate = useNavigate();
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'clinical' | 'follow_up' | 'review' | 'general'>('general');

  const {
    data: historyData,
    isLoading,
    error,
    refetch,
  } = usePatientDiagnosticHistory(
    patientId,
    {
      page: 1,
      limit: maxItems,
      includeArchived: false,
    },
    {
      enabled: !!patientId,
    }
  );

  const addNoteMutation = useAddDiagnosticHistoryNote();
  const exportMutation = useExportDiagnosticHistory();

  const history = historyData?.history || [];
  const patient = historyData?.patient;

  const handleViewCase = (caseId: string) => {
    navigate(`/pharmacy/diagnostics/case/${caseId}/results`);
  };

  const handleNewCase = () => {
    navigate(`/pharmacy/diagnostics/case/new?patientId=${patientId}`);
  };

  const handleViewAll = () => {
    navigate(`/pharmacy/diagnostics/cases/all?patientId=${patientId}`);
  };

  const handleAddNote = (historyId: string) => {
    setSelectedHistoryId(historyId);
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedHistoryId || !noteContent.trim()) return;

    try {
      await addNoteMutation.mutateAsync({
        historyId: selectedHistoryId,
        content: noteContent.trim(),
        type: noteType,
      });
      setNoteDialogOpen(false);
      setNoteContent('');
      setSelectedHistoryId(null);
      refetch();
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleExport = async (historyId: string) => {
    try {
      await exportMutation.mutateAsync({
        historyId,
        purpose: 'patient_record',
      });
    } catch (error) {
      console.error('Failed to export history:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'success';
    if (confidence >= 70) return 'info';
    if (confidence >= 50) return 'warning';
    return 'error';
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Failed to load diagnostic history. Please try refreshing.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          {showHeader && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Diagnostic History
                </Typography>
                {patient && (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    for {patient.name}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={() => refetch()} disabled={isLoading}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                {showActions && (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleViewAll}
                      startIcon={<VisibilityIcon />}
                    >
                      View All
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleNewCase}
                      startIcon={<AddIcon />}
                    >
                      New Case
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          )}

          {isLoading ? (
            <Box>
              {[...Array(3)].map((_, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="40%" />
                    </Box>
                    <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                  </Box>
                  {index < 2 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))}
            </Box>
          ) : history.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No diagnostic history found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Start by creating a new diagnostic case for this patient
              </Typography>
              {showActions && (
                <Button
                  variant="contained"
                  onClick={handleNewCase}
                  startIcon={<AddIcon />}
                >
                  Create New Case
                </Button>
              )}
            </Box>
          ) : (
            <List>
              {history.map((item, index) => (
                <React.Fragment key={item._id}>
                  <ListItem
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => handleViewCase(item.caseId)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                            Case {item.caseId}
                          </Typography>
                          <Chip
                            label={`${Math.round(item.analysisSnapshot.confidenceScore)}% confidence`}
                            size="small"
                            color={getConfidenceColor(item.analysisSnapshot.confidenceScore) as any}
                          />
                          {item.referral?.generated && (
                            <Chip
                              icon={<LocalHospitalIcon />}
                              label="Referral"
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          )}
                          {item.followUp.required && !item.followUp.completed && (
                            <Chip
                              icon={<ScheduleIcon />}
                              label="Follow-up"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Pharmacist: {item.pharmacistId.firstName} {item.pharmacistId.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Top Diagnosis: {item.analysisSnapshot.differentialDiagnoses[0]?.condition || 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}
                          </Typography>
                          {item.notes.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <NoteIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {item.notes.length} note{item.notes.length !== 1 ? 's' : ''}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Tooltip title="Add Note">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNote(item._id);
                          }}
                        >
                          <NoteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Export">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExport(item._id);
                          }}
                          disabled={exportMutation.isPending}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItem>
                  {index < history.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}

          {history.length >= maxItems && showActions && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="text"
                onClick={handleViewAll}
                startIcon={<VisibilityIcon />}
              >
                View All Diagnostic History
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog
        open={noteDialogOpen}
        onClose={() => setNoteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Diagnostic Note</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Note Type</InputLabel>
              <Select
                value={noteType}
                label="Note Type"
                onChange={(e) => setNoteType(e.target.value as any)}
              >
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="clinical">Clinical</MenuItem>
                <MenuItem value="follow_up">Follow-up</MenuItem>
                <MenuItem value="review">Review</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Note Content"
              multiline
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter your note here..."
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveNote}
            variant="contained"
            disabled={!noteContent.trim() || addNoteMutation.isPending}
          >
            {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PatientDiagnosticHistory;