import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  Grid,
  Divider,
  FormHelperText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useFormValidation } from '../../hooks/useFormValidation';
import {
  diagnosticRequestSchema,
  validateDiagnosticRequest,
} from '../../utils/diagnosticValidation';

interface EnhancedDiagnosticFormProps {
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  patients: any[];
  isLoading?: boolean;
}

const EnhancedDiagnosticForm: React.FC<EnhancedDiagnosticFormProps> = ({
  onSubmit,
  initialData,
  patients,
  isLoading = false,
}) => {
  // Form state
  const [formData, setFormData] = useState({
    patientId: initialData?.patientId || '',
    symptoms: {
      subjective: initialData?.symptoms?.subjective || [''],
      objective: initialData?.symptoms?.objective || [''],
      duration: initialData?.symptoms?.duration || '',
      severity: initialData?.symptoms?.severity || '',
      onset: initialData?.symptoms?.onset || '',
    },
    vitalSigns: {
      bloodPressure: initialData?.vitalSigns?.bloodPressure || '',
      heartRate: initialData?.vitalSigns?.heartRate || '',
      temperature: initialData?.vitalSigns?.temperature || '',
      respiratoryRate: initialData?.vitalSigns?.respiratoryRate || '',
      oxygenSaturation: initialData?.vitalSigns?.oxygenSaturation || '',
      bloodGlucose: initialData?.vitalSigns?.bloodGlucose || '',
    },
    currentMedications: initialData?.currentMedications || [],
    labResults: initialData?.labResults || [],
    patientConsent: {
      provided: initialData?.patientConsent?.provided || false,
      method: initialData?.patientConsent?.method || 'electronic',
    },
  });

  // Validation hook
  const validation = useFormValidation({
    validationSchema: diagnosticRequestSchema,
    requiredFields: ['patientId', 'symptoms.subjective', 'symptoms.duration', 'symptoms.severity', 'symptoms.onset', 'patientConsent.provided'],
    validateOnChange: true,
    validateOnBlur: true,
  });

  // Update form data and validate
  const updateFormData = (path: string, value: any) => {
    const newFormData = { ...formData };
    const pathArray = path.split('.');
    let current = newFormData;
    
    for (let i = 0; i < pathArray.length - 1; i++) {
      current = current[pathArray[i]];
    }
    current[pathArray[pathArray.length - 1]] = value;
    
    setFormData(newFormData);
    validation.setFieldTouched(path);
    validation.validateField(path, value);
  };

  return null; // Placeholder for now
};

export default EnhancedDiagnosticForm;  
// Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    validation.setSubmitting(true);
    
    // Validate entire form
    const isValid = await validation.validateForm(formData);
    
    if (!isValid) {
      validation.setSubmitting(false);
      return;
    }
    
    try {
      await onSubmit(formData);
    } catch (error: any) {
      // Handle backend validation errors
      if (error.response?.data?.errors) {
        validation.setBackendErrors(error.response.data.errors);
      }
    } finally {
      validation.setSubmitting(false);
    }
  };

  // Add symptom
  const addSymptom = (type: 'subjective' | 'objective') => {
    const newSymptoms = [...formData.symptoms[type], ''];
    updateFormData(`symptoms.${type}`, newSymptoms);
  };

  // Remove symptom
  const removeSymptom = (type: 'subjective' | 'objective', index: number) => {
    const newSymptoms = formData.symptoms[type].filter((_, i) => i !== index);
    updateFormData(`symptoms.${type}`, newSymptoms);
  };

  // Update symptom
  const updateSymptom = (type: 'subjective' | 'objective', index: number, value: string) => {
    const newSymptoms = [...formData.symptoms[type]];
    newSymptoms[index] = value;
    updateFormData(`symptoms.${type}`, newSymptoms);
  };

  // Add medication
  const addMedication = () => {
    const newMedications = [...formData.currentMedications, { name: '', dosage: '', frequency: '' }];
    updateFormData('currentMedications', newMedications);
  };

  // Remove medication
  const removeMedication = (index: number) => {
    const newMedications = formData.currentMedications.filter((_, i) => i !== index);
    updateFormData('currentMedications', newMedications);
  };

  // Update medication
  const updateMedication = (index: number, field: string, value: string) => {
    const newMedications = [...formData.currentMedications];
    newMedications[index] = { ...newMedications[index], [field]: value };
    updateFormData('currentMedications', newMedications);
  };

  // Add lab result
  const addLabResult = () => {
    const newLabResults = [...formData.labResults, { testName: '', value: '', referenceRange: '', abnormal: false }];
    updateFormData('labResults', newLabResults);
  };

  // Remove lab result
  const removeLabResult = (index: number) => {
    const newLabResults = formData.labResults.filter((_, i) => i !== index);
    updateFormData('labResults', newLabResults);
  };

  // Update lab result
  const updateLabResult = (index: number, field: string, value: any) => {
    const newLabResults = [...formData.labResults];
    newLabResults[index] = { ...newLabResults[index], [field]: value };
    updateFormData('labResults', newLabResults);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {/* Progress indicator */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Form Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {validation.progress}%
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={validation.progress} 
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {/* Patient Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Patient Information
          </Typography>
          <FormControl 
            fullWidth 
            error={validation.hasFieldError('patientId')}
            required
          >
            <InputLabel>Select Patient</InputLabel>
            <Select
              value={formData.patientId}
              label="Select Patient"
              onChange={(e) => updateFormData('patientId', e.target.value)}
              onBlur={() => validation.setFieldTouched('patientId')}
            >
              {patients.map((patient) => (
                <MenuItem key={patient._id} value={patient._id}>
                  {patient.firstName} {patient.lastName} - {patient.age}y, {patient.gender}
                </MenuItem>
              ))}
            </Select>
            {validation.hasFieldError('patientId') && (
              <FormHelperText>{validation.getFieldError('patientId')}</FormHelperText>
            )}
          </FormControl>
        </CardContent>
      </Card>

      {/* Symptoms */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Symptoms & Clinical Presentation
          </Typography>
          
          {/* Subjective Symptoms */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Subjective Symptoms <span style={{ color: 'red' }}>*</span>
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => addSymptom('subjective')}
              >
                Add Symptom
              </Button>
            </Box>
            {formData.symptoms.subjective.map((symptom, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  placeholder="Enter symptom (e.g., headache, nausea)"
                  value={symptom}
                  onChange={(e) => updateSymptom('subjective', index, e.target.value)}
                  onBlur={() => validation.setFieldTouched(`symptoms.subjective.${index}`)}
                  error={validation.hasFieldError(`symptoms.subjective.${index}`)}
                  helperText={validation.getFieldError(`symptoms.subjective.${index}`)}
                />
                {formData.symptoms.subjective.length > 1 && (
                  <IconButton
                    color="error"
                    onClick={() => removeSymptom('subjective', index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}
            {validation.hasFieldError('symptoms.subjective') && (
              <FormHelperText error>
                {validation.getFieldError('symptoms.subjective')}
              </FormHelperText>
            )}
          </Box>

          {/* Objective Signs */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">Objective Signs</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => addSymptom('objective')}
              >
                Add Sign
              </Button>
            </Box>
            {formData.symptoms.objective.map((sign, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  placeholder="Enter clinical sign (e.g., fever, rash)"
                  value={sign}
                  onChange={(e) => updateSymptom('objective', index, e.target.value)}
                  onBlur={() => validation.setFieldTouched(`symptoms.objective.${index}`)}
                  error={validation.hasFieldError(`symptoms.objective.${index}`)}
                  helperText={validation.getFieldError(`symptoms.objective.${index}`)}
                />
                <IconButton
                  color="error"
                  onClick={() => removeSymptom('objective', index)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>

          {/* Duration, Severity, Onset */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Duration"
                placeholder="e.g., 3 days, 2 weeks"
                value={formData.symptoms.duration}
                onChange={(e) => updateFormData('symptoms.duration', e.target.value)}
                onBlur={() => validation.setFieldTouched('symptoms.duration')}
                error={validation.hasFieldError('symptoms.duration')}
                helperText={validation.getFieldError('symptoms.duration')}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl 
                fullWidth 
                error={validation.hasFieldError('symptoms.severity')}
                required
              >
                <InputLabel>Severity</InputLabel>
                <Select
                  value={formData.symptoms.severity}
                  label="Severity"
                  onChange={(e) => updateFormData('symptoms.severity', e.target.value)}
                  onBlur={() => validation.setFieldTouched('symptoms.severity')}
                >
                  <MenuItem value="mild">Mild</MenuItem>
                  <MenuItem value="moderate">Moderate</MenuItem>
                  <MenuItem value="severe">Severe</MenuItem>
                </Select>
                {validation.hasFieldError('symptoms.severity') && (
                  <FormHelperText>{validation.getFieldError('symptoms.severity')}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl 
                fullWidth 
                error={validation.hasFieldError('symptoms.onset')}
                required
              >
                <InputLabel>Onset</InputLabel>
                <Select
                  value={formData.symptoms.onset}
                  label="Onset"
                  onChange={(e) => updateFormData('symptoms.onset', e.target.value)}
                  onBlur={() => validation.setFieldTouched('symptoms.onset')}
                >
                  <MenuItem value="acute">Acute</MenuItem>
                  <MenuItem value="chronic">Chronic</MenuItem>
                  <MenuItem value="subacute">Subacute</MenuItem>
                </Select>
                {validation.hasFieldError('symptoms.onset') && (
                  <FormHelperText>{validation.getFieldError('symptoms.onset')}</FormHelperText>
                )}
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Vital Signs */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Vital Signs (Optional)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Blood Pressure"
                placeholder="120/80"
                value={formData.vitalSigns.bloodPressure}
                onChange={(e) => updateFormData('vitalSigns.bloodPressure', e.target.value)}
                onBlur={() => validation.setFieldTouched('vitalSigns.bloodPressure')}
                error={validation.hasFieldError('vitalSigns.bloodPressure')}
                helperText={validation.getFieldError('vitalSigns.bloodPressure') || 'Format: 120/80'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Heart Rate"
                placeholder="72"
                type="number"
                value={formData.vitalSigns.heartRate}
                onChange={(e) => updateFormData('vitalSigns.heartRate', Number(e.target.value))}
                onBlur={() => validation.setFieldTouched('vitalSigns.heartRate')}
                error={validation.hasFieldError('vitalSigns.heartRate')}
                helperText={validation.getFieldError('vitalSigns.heartRate') || 'beats per minute'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Temperature"
                placeholder="37.0"
                type="number"
                inputProps={{ step: 0.1 }}
                value={formData.vitalSigns.temperature}
                onChange={(e) => updateFormData('vitalSigns.temperature', Number(e.target.value))}
                onBlur={() => validation.setFieldTouched('vitalSigns.temperature')}
                error={validation.hasFieldError('vitalSigns.temperature')}
                helperText={validation.getFieldError('vitalSigns.temperature') || '°C'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Respiratory Rate"
                placeholder="16"
                type="number"
                value={formData.vitalSigns.respiratoryRate}
                onChange={(e) => updateFormData('vitalSigns.respiratoryRate', Number(e.target.value))}
                onBlur={() => validation.setFieldTouched('vitalSigns.respiratoryRate')}
                error={validation.hasFieldError('vitalSigns.respiratoryRate')}
                helperText={validation.getFieldError('vitalSigns.respiratoryRate') || 'breaths per minute'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Oxygen Saturation"
                placeholder="98"
                type="number"
                value={formData.vitalSigns.oxygenSaturation}
                onChange={(e) => updateFormData('vitalSigns.oxygenSaturation', Number(e.target.value))}
                onBlur={() => validation.setFieldTouched('vitalSigns.oxygenSaturation')}
                error={validation.hasFieldError('vitalSigns.oxygenSaturation')}
                helperText={validation.getFieldError('vitalSigns.oxygenSaturation') || '%'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Blood Glucose"
                placeholder="90"
                type="number"
                value={formData.vitalSigns.bloodGlucose}
                onChange={(e) => updateFormData('vitalSigns.bloodGlucose', Number(e.target.value))}
                onBlur={() => validation.setFieldTouched('vitalSigns.bloodGlucose')}
                error={validation.hasFieldError('vitalSigns.bloodGlucose')}
                helperText={validation.getFieldError('vitalSigns.bloodGlucose') || 'mg/dL'}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Current Medications */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Current Medications (Optional)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 2 }}>
            <Button
              startIcon={<AddIcon />}
              onClick={addMedication}
              variant="outlined"
              size="small"
            >
              Add Medication
            </Button>
          </Box>
          {formData.currentMedications.map((medication, index) => (
            <Card key={index} variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">Medication {index + 1}</Typography>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => removeMedication(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Medication Name"
                      value={medication.name}
                      onChange={(e) => updateMedication(index, 'name', e.target.value)}
                      error={validation.hasFieldError(`currentMedications.${index}.name`)}
                      helperText={validation.getFieldError(`currentMedications.${index}.name`)}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Dosage"
                      placeholder="e.g., 500mg"
                      value={medication.dosage}
                      onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                      error={validation.hasFieldError(`currentMedications.${index}.dosage`)}
                      helperText={validation.getFieldError(`currentMedications.${index}.dosage`)}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Frequency"
                      placeholder="e.g., twice daily"
                      value={medication.frequency}
                      onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                      error={validation.hasFieldError(`currentMedications.${index}.frequency`)}
                      helperText={validation.getFieldError(`currentMedications.${index}.frequency`)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Lab Results */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Laboratory Results (Optional)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 2 }}>
            <Button
              startIcon={<AddIcon />}
              onClick={addLabResult}
              variant="outlined"
              size="small"
            >
              Add Lab Result
            </Button>
          </Box>
          {formData.labResults.map((labResult, index) => (
            <Card key={index} variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">Lab Result {index + 1}</Typography>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => removeLabResult(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Test Name"
                      value={labResult.testName}
                      onChange={(e) => updateLabResult(index, 'testName', e.target.value)}
                      error={validation.hasFieldError(`labResults.${index}.testName`)}
                      helperText={validation.getFieldError(`labResults.${index}.testName`)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Value"
                      value={labResult.value}
                      onChange={(e) => updateLabResult(index, 'value', e.target.value)}
                      error={validation.hasFieldError(`labResults.${index}.value`)}
                      helperText={validation.getFieldError(`labResults.${index}.value`)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Reference Range"
                      value={labResult.referenceRange}
                      onChange={(e) => updateLabResult(index, 'referenceRange', e.target.value)}
                      error={validation.hasFieldError(`labResults.${index}.referenceRange`)}
                      helperText={validation.getFieldError(`labResults.${index}.referenceRange`)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={labResult.abnormal}
                          onChange={(e) => updateLabResult(index, 'abnormal', e.target.checked)}
                        />
                      }
                      label="Abnormal"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Patient Consent */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Patient Consent <span style={{ color: 'red' }}>*</span>
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.patientConsent.provided}
                onChange={(e) => updateFormData('patientConsent.provided', e.target.checked)}
                color={validation.hasFieldError('patientConsent.provided') ? 'error' : 'primary'}
              />
            }
            label="Patient has provided informed consent for AI diagnostic analysis"
          />
          {validation.hasFieldError('patientConsent.provided') && (
            <FormHelperText error sx={{ ml: 4 }}>
              {validation.getFieldError('patientConsent.provided')}
            </FormHelperText>
          )}
          
          <FormControl sx={{ mt: 2, minWidth: 200 }}>
            <InputLabel>Consent Method</InputLabel>
            <Select
              value={formData.patientConsent.method}
              label="Consent Method"
              onChange={(e) => updateFormData('patientConsent.method', e.target.value)}
            >
              <MenuItem value="electronic">Electronic</MenuItem>
              <MenuItem value="verbal">Verbal</MenuItem>
              <MenuItem value="written">Written</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      {validation.errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Please fix the following errors:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validation.errors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Submit Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {validation.canSubmit ? (
            <CheckCircleIcon color="success" />
          ) : (
            <WarningIcon color="warning" />
          )}
          <Typography variant="body2" color="text.secondary">
            {validation.canSubmit ? 'Ready to submit' : 'Please complete required fields'}
          </Typography>
        </Box>
        
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!validation.canSubmit || validation.isSubmitting || isLoading}
          sx={{ minWidth: 200 }}
        >
          {validation.isSubmitting || isLoading ? 'Generating Analysis...' : 'Generate AI Analysis'}
        </Button>
      </Box>
    </Box>
  );
};