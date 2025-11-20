import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { toast } from 'react-hot-toast';
import { apiHelpers } from '../../utils/apiHelpers';

interface PatientInterpretation {
  explanation: string;
  keyFindings: string[];
  recommendations: string[];
  generatedBy: 'ai' | 'pharmacist' | 'hybrid';
  approvedBy?: string;
  approvedAt?: string;
  visibleToPatient: boolean;
  lastModified: string;
}

interface PatientInterpretationEditorProps {
  labIntegrationId: string;
  patientName: string;
  onUpdate?: () => void;
}

const PatientInterpretationEditor: React.FC<PatientInterpretationEditorProps> = ({
  labIntegrationId,
  patientName,
  onUpdate
}) => {
  const [interpretation, setInterpretation] = useState<PatientInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    explanation: '',
    keyFindings: [''],
    recommendations: [''],
    visibleToPatient: false
  });

  // Fetch existing interpretation
  const fetchInterpretation = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiHelpers.get(`/lab-integration/${labIntegrationId}/patient-interpretation`);

      if (response.success && response.data.hasInterpretation) {
        const interp = response.data.patientInterpretation;
        setInterpretation(interp);
        setFormData({
          explanation: interp.explanation || '',
          keyFindings: interp.keyFindings?.length > 0 ? interp.keyFindings : [''],
          recommendations: interp.recommendations?.length > 0 ? interp.recommendations : [''],
          visibleToPatient: interp.visibleToPatient || false
        });
      } else {
        setInterpretation(null);
        setFormData({
          explanation: '',
          keyFindings: [''],
          recommendations: [''],
          visibleToPatient: false
        });
      }
    } catch (err: any) {
      console.error('Error fetching patient interpretation:', err);
      setError('Failed to load patient interpretation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterpretation();
  }, [labIntegrationId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Filter out empty strings
      const cleanedData = {
        explanation: formData.explanation.trim(),
        keyFindings: formData.keyFindings.filter(f => f.trim() !== ''),
        recommendations: formData.recommendations.filter(r => r.trim() !== ''),
        visibleToPatient: formData.visibleToPatient
      };

      if (!cleanedData.explanation) {
        setError('Patient explanation is required');
        return;
      }

      const response = await apiHelpers.put(
        `/lab-integration/${labIntegrationId}/patient-interpretation`,
        cleanedData
      );

      if (response.success) {
        toast.success('Patient interpretation saved successfully');
        setEditing(false);
        await fetchInterpretation();
        onUpdate?.();
      } else {
        setError(response.message || 'Failed to save interpretation');
      }
    } catch (err: any) {
      console.error('Error saving patient interpretation:', err);
      setError(err.response?.data?.message || 'Failed to save interpretation');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (interpretation) {
      setFormData({
        explanation: interpretation.explanation || '',
        keyFindings: interpretation.keyFindings?.length > 0 ? interpretation.keyFindings : [''],
        recommendations: interpretation.recommendations?.length > 0 ? interpretation.recommendations : [''],
        visibleToPatient: interpretation.visibleToPatient || false
      });
    }
    setEditing(false);
    setError(null);
  };

  const addKeyFinding = () => {
    setFormData(prev => ({
      ...prev,
      keyFindings: [...prev.keyFindings, '']
    }));
  };

  const removeKeyFinding = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keyFindings: prev.keyFindings.filter((_, i) => i !== index)
    }));
  };

  const updateKeyFinding = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      keyFindings: prev.keyFindings.map((finding, i) => i === index ? value : finding)
    }));
  };

  const addRecommendation = () => {
    setFormData(prev => ({
      ...prev,
      recommendations: [...prev.recommendations, '']
    }));
  };

  const removeRecommendation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter((_, i) => i !== index)
    }));
  };

  const updateRecommendation = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      recommendations: prev.recommendations.map((rec, i) => i === index ? value : rec)
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Patient-Friendly Interpretation
          </Typography>
          <Box sx={{ mt: 2 }}>
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ mb: 2 }}>
                <div style={{ height: 20, backgroundColor: '#f0f0f0', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 60, backgroundColor: '#f0f0f0', borderRadius: 4 }} />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon />
            Patient-Friendly Interpretation
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {interpretation && (
              <Chip
                icon={interpretation.generatedBy === 'ai' ? <AutoAwesomeIcon /> : <EditIcon />}
                label={interpretation.generatedBy === 'ai' ? 'AI Generated' : 
                       interpretation.generatedBy === 'hybrid' ? 'AI + Pharmacist' : 'Pharmacist Created'}
                size="small"
                color={interpretation.generatedBy === 'ai' ? 'primary' : 'secondary'}
              />
            )}
            {interpretation && (
              <Chip
                icon={interpretation.visibleToPatient ? <VisibilityIcon /> : <VisibilityOffIcon />}
                label={interpretation.visibleToPatient ? 'Visible to Patient' : 'Draft'}
                size="small"
                color={interpretation.visibleToPatient ? 'success' : 'warning'}
              />
            )}
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Create patient-friendly explanations for {patientName} to help them understand their lab results
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!editing && interpretation ? (
          // Display Mode
          <Box>
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Explanation for Patient:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {interpretation.explanation}
              </Typography>

              {interpretation.keyFindings && interpretation.keyFindings.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Key Findings:
                  </Typography>
                  <List dense>
                    {interpretation.keyFindings.map((finding, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${finding}`} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {interpretation.recommendations && interpretation.recommendations.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Recommendations:
                  </Typography>
                  <List dense>
                    {interpretation.recommendations.map((rec, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${rec}`} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Paper>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.visibleToPatient}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, visibleToPatient: e.target.checked }));
                      // Auto-save visibility toggle
                      handleSave();
                    }}
                    disabled={saving}
                  />
                }
                label="Visible to Patient"
              />
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setEditing(true)}
              >
                Edit Interpretation
              </Button>
            </Box>
          </Box>
        ) : (
          // Edit Mode
          <Box>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Patient Explanation"
              placeholder="Explain the lab results in simple, patient-friendly language..."
              value={formData.explanation}
              onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
              sx={{ mb: 3 }}
              helperText="Use simple language that patients can easily understand"
            />

            <Typography variant="subtitle2" gutterBottom>
              Key Findings (Simple bullet points):
            </Typography>
            {formData.keyFindings.map((finding, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Key finding..."
                  value={finding}
                  onChange={(e) => updateKeyFinding(index, e.target.value)}
                />
                {formData.keyFindings.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removeKeyFinding(index)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addKeyFinding}
              sx={{ mb: 3 }}
            >
              Add Key Finding
            </Button>

            <Typography variant="subtitle2" gutterBottom>
              Patient Recommendations:
            </Typography>
            {formData.recommendations.map((rec, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Patient recommendation..."
                  value={rec}
                  onChange={(e) => updateRecommendation(index, e.target.value)}
                />
                {formData.recommendations.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removeRecommendation(index)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addRecommendation}
              sx={{ mb: 3 }}
            >
              Add Recommendation
            </Button>

            <Divider sx={{ my: 2 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.visibleToPatient}
                  onChange={(e) => setFormData(prev => ({ ...prev, visibleToPatient: e.target.checked }))}
                />
              }
              label="Make visible to patient"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Interpretation'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}

        {!interpretation && !editing && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No patient interpretation has been created yet.
            </Typography>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => setEditing(true)}
            >
              Create Patient Interpretation
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientInterpretationEditor;