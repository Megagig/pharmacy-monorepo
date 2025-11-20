import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';

interface EditReferralDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
  loading?: boolean;
  initialContent?: string;
  caseId?: string;
}

const EditReferralDialog: React.FC<EditReferralDialogProps> = ({
  open,
  onClose,
  onSave,
  loading = false,
  initialContent = '',
  caseId,
}) => {
  const [content, setContent] = useState(initialContent);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    setHasChanges(false);
  }, [initialContent, open]);

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value;
    setContent(newContent);
    setHasChanges(newContent !== initialContent);
  };

  const handleSave = async () => {

    if (!hasChanges) {

      onClose();
      return;
    }

    try {
      setIsSaving(true);

      await onSave(content);

      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('EditReferralDialog: Failed to save referral:', error);
      // Don't close the dialog on error so user can see the error and retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      if (hasChanges) {
        const confirmClose = window.confirm(
          'You have unsaved changes. Are you sure you want to close without saving?'
        );
        if (!confirmClose) return;
      }
      setContent(initialContent);
      setHasChanges(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Edit Referral Document
          </Typography>
          <Button onClick={handleClose} color="inherit" disabled={loading}>
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {caseId && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Editing referral document for case: <strong>{caseId}</strong>
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Edit the referral document content below. Make sure to include all necessary medical information
            and maintain professional formatting.
          </Typography>
        </Box>

        <TextField
          fullWidth
          multiline
          rows={20}
          value={content}
          onChange={handleContentChange}
          disabled={loading}
          placeholder="Enter referral document content..."
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: 1.5,
            },
          }}
        />

        {hasChanges && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            You have unsaved changes. Don't forget to save before closing.
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Document length: {content.length} characters
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={(loading || isSaving) ? <CircularProgress size={20} /> : <SaveIcon />}
          disabled={loading || isSaving || !hasChanges}
        >
          {(loading || isSaving) ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditReferralDialog;