import React from 'react';
import { useDrugInteractions } from '../queries/drugQueries';
import { Box, CircularProgress, Typography, Paper, Chip, Alert } from '@mui/material';
import LoadingSkeleton from './LoadingSkeleton';
import { SeverityIcon } from './SeverityIcon';

interface DrugInteractionsProps {
  rxcui?: string;
  rxcuis?: string[];
  drugName?: string;
}

const DrugInteractions: React.FC<DrugInteractionsProps> = ({ rxcui, rxcuis, drugName }) => {
  const { data: interactions, isLoading, error } = useDrugInteractions(rxcui, rxcuis);

  if (isLoading) {
    return <LoadingSkeleton type="list" />;
  }

  if (error) {
    return (
      <Box my={4}>
        <Alert severity="error">
          Error loading drug interactions: {(error as any).message}
        </Alert>
      </Box>
    );
  }

  if (!interactions || !interactions.interactionTypeGroup) {
    return (
      <Box my={4}>
        <Typography>No interaction data available</Typography>
      </Box>
    );
  }

  // Flatten interaction data for easier display
  const interactionPairs: any[] = [];
  interactions.interactionTypeGroup.forEach(group => {
    group.interactionType.forEach(type => {
      type.interactionPair.forEach(pair => {
        interactionPairs.push({
          drug1: type.minConceptItem.name,
          drug2: pair.interactionConcept[1]?.minConceptItem?.name || 'Unknown',
          severity: pair.severity,
          description: pair.description
        });
      });
    });
  });

  return (
    <Paper elevation={2} className="p-4">
      <Typography variant="h6" className="mb-4">
        Drug Interactions {drugName ? `for ${drugName}` : ''}
      </Typography>
      
      {interactionPairs.length === 0 ? (
        <Alert severity="success">
          No significant drug interactions found
        </Alert>
      ) : (
        <Box>
          {interactionPairs.map((interaction, index) => (
            <Paper key={index} className="p-3 mb-3 border-l-4 border-blue-500">
              <Box display="flex" justifyContent="space-between" alignItems="center" className="mb-2">
                <Typography variant="subtitle1">
                  {interaction.drug1} + {interaction.drug2}
                </Typography>
                <Chip
                  label={interaction.severity}
                  color={interaction.severity === 'HIGH' ? 'error' : interaction.severity === 'MODERATE' ? 'warning' : 'info'}
                  icon={<SeverityIcon severity={interaction.severity} />}
                />
              </Box>
              <Typography variant="body2">
                {interaction.description}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default DrugInteractions;