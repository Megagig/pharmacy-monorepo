import React, { useState } from 'react';
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  SymptomInput,
  VitalSignsInput,
  MedicationHistoryInput,
  AllergyInput,
} from '../components';
import type { DiagnosticRequestForm } from '../types';
import DiagnosticFeatureGuard from '../middlewares/diagnosticFeatureGuard';

const ComponentDemo: React.FC = () => {
  const [formData, setFormData] = useState<Partial<DiagnosticRequestForm>>({
    symptoms: {
      subjective: [],
      objective: [],
      duration: '',
      severity: 'mild',
      onset: 'acute',
    },
    vitals: undefined,
    currentMedications: [],
    allergies: [],
  });

  const handleSymptomsChange = (
    symptoms: DiagnosticRequestForm['symptoms']
  ) => {
    setFormData((prev) => ({ ...prev, symptoms }));
  };

  const handleVitalsChange = (vitals: DiagnosticRequestForm['vitals']) => {
    setFormData((prev) => ({ ...prev, vitals }));
  };

  const handleMedicationsChange = (
    currentMedications: DiagnosticRequestForm['currentMedications']
  ) => {
    setFormData((prev) => ({ ...prev, currentMedications }));
  };

  const handleAllergiesChange = (allergies: string[]) => {
    setFormData((prev) => ({ ...prev, allergies }));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
          Diagnostic Components Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Interactive demonstration of the symptom input and patient assessment
          components
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Symptom Input */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                1. Symptom Assessment Component
              </Typography>
              <SymptomInput
                value={formData.symptoms!}
                onChange={handleSymptomsChange}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Vital Signs Input */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                2. Vital Signs Component
              </Typography>
              <VitalSignsInput
                value={formData.vitals}
                onChange={handleVitalsChange}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Medication History Input */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                3. Medication History Component
              </Typography>
              <MedicationHistoryInput
                value={formData.currentMedications}
                onChange={handleMedicationsChange}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Allergy Input */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                4. Allergy Management Component
              </Typography>
              <AllergyInput
                value={formData.allergies}
                onChange={handleAllergiesChange}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Form Data Preview */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Current Form Data
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box
                component="pre"
                sx={{
                  backgroundColor: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(formData, null, 2)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

// Wrap with feature guard
const ComponentDemoWithGuard: React.FC = () => (
  <DiagnosticFeatureGuard>
    <ComponentDemo />
  </DiagnosticFeatureGuard>
);

export default ComponentDemoWithGuard;
