import React, { useState } from 'react';
import { Box, Button, TextField, Alert, CircularProgress } from '@mui/material';
import { useCreateIntervention } from '../queries/useClinicalInterventions';

const TestInterventionForm: React.FC = () => {
  const [formData, setFormData] = useState({
    patientId: '68cd7e0774e838f4e850c4c6', // Use existing patient ID
    category: 'drug_therapy_problem',
    priority: 'medium',
    issueDescription: 'Test intervention from minimal form',
    strategies: [],
    estimatedDuration: 7,
    relatedDTPIds: []
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const createMutation = useCreateIntervention();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await createMutation.mutateAsync(formData);

      setResult(response);
    } catch (err: any) {
      console.error('🔍 Test form error:', err);
      setError(err.message || 'Failed to create intervention');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p={3}>
      <h2>Test Intervention Form</h2>
      
      <form onSubmit={handleSubmit}>
        <Box display="flex" flexDirection="column" gap={2} maxWidth={400}>
          <TextField
            label="Patient ID"
            value={formData.patientId}
            onChange={(e) => setFormData(prev => ({ ...prev, patientId: e.target.value }))}
            required
          />
          
          <TextField
            label="Issue Description"
            value={formData.issueDescription}
            onChange={(e) => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))}
            multiline
            rows={3}
            required
          />
          
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || createMutation.isPending}
          >
            {isSubmitting || createMutation.isPending ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Creating...
              </>
            ) : (
              'Create Test Intervention'
            )}
          </Button>
        </Box>
      </form>
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      
      {result && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Success! Created intervention: {result.data?.interventionNumber}
        </Alert>
      )}
      
      {result && (
        <Box mt={2}>
          <h3>Response:</h3>
          <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
};

export default TestInterventionForm;