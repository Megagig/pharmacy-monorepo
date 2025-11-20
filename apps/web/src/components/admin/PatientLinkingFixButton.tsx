import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  CircularProgress,
  Box
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import apiClient from '../../services/api/client';

interface FixResult {
  processed: number;
  successful: number;
  failed: number;
  errors?: string[];
}

const PatientLinkingFixButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FixResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFix = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Use centralized API client so baseURL/env is respected and cookies are included
      const resp = await apiClient.get('/quick-fix/link-patients');
      const data = resp.data;

      if (!data || !data.success) {
        throw new Error(data?.message || 'Failed to fix patient linking');
      }

      setResult(data.data);
    } catch (err: any) {
      console.error('Patient linking error:', err);
      setError(err.message || 'An error occurred while fixing patient linking');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setError(null);
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={<LinkIcon />}
        onClick={() => setOpen(true)}
        sx={{ mb: 2 }}
      >
        Fix Patient Linking
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Fix Patient Linking Issues
        </DialogTitle>
        <DialogContent>
          {!loading && !result && !error && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                This will automatically create Patient records for all PatientUsers who don't have linked medical records.
              </Alert>
              <Typography variant="body2" color="textSecondary">
                This process will:
              </Typography>
              <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                <li>Find all active PatientUsers without linked Patient records</li>
                <li>Create new Patient records with proper MRN generation</li>
                <li>Link the PatientUser accounts to their new Patient records</li>
                <li>Enable access to health records, vitals tracking, and other features</li>
              </Box>
            </Box>
          )}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
              <CircularProgress size={24} />
              <Typography>Processing patient linking...</Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          {result && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Patient linking process completed!
              </Alert>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="primary">
                    {result.processed}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Processed
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="success.main">
                    {result.successful}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Successful
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="error.main">
                    {result.failed}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Failed
                  </Typography>
                </Box>
              </Box>

              {result.errors && result.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Errors (showing first 10):
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                    {result.errors.map((error, index) => (
                      <Typography key={index} variant="body2" color="error" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {error}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              <Alert severity="info" sx={{ mt: 2 }}>
                Patients can now refresh their portal page to access health records features.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!loading && !result && !error && (
            <Button
              variant="contained"
              onClick={handleFix}
              startIcon={<LinkIcon />}
            >
              Fix All Patient Links
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PatientLinkingFixButton;