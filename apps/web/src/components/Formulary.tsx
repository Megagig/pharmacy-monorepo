import React from 'react';
import { useFormularyInfo } from '../queries/drugQueries';
import { Box, CircularProgress, Typography, Paper, List, ListItem, ListItemText, Chip, Alert } from '@mui/material';
import LoadingSkeleton from './LoadingSkeleton';

interface FormularyProps {
  drugId: string;
  drugName?: string;
}

const Formulary: React.FC<FormularyProps> = ({ drugId, drugName }) => {
  const { data: formularyInfo, isLoading, error } = useFormularyInfo(drugId);

  if (isLoading) {
    return <LoadingSkeleton type="list" />;
  }

  if (error) {
    return (
      <Box my={4}>
        <Alert severity="error">
          Error loading formulary information: {(error as any).message}
        </Alert>
      </Box>
    );
  }

  if (!formularyInfo || !formularyInfo.relatedGroup) {
    return (
      <Box my={4}>
        <Typography>No formulary information available</Typography>
      </Box>
    );
  }

  // Extract therapeutic equivalents
  const equivalents: any[] = [];
  if (formularyInfo.relatedGroup.conceptGroup) {
    formularyInfo.relatedGroup.conceptGroup.forEach(group => {
      if (group.tty === 'SCD' && group.conceptProperties) {
        equivalents.push(...group.conceptProperties);
      }
    });
  }

  return (
    <Paper elevation={2} className="p-4">
      <Typography variant="h6" className="mb-4">
        Formulary & Therapeutic Equivalents {drugName ? `for ${drugName}` : ''}
      </Typography>
      
      {equivalents.length === 0 ? (
        <Alert severity="info">
          No therapeutic equivalents found
        </Alert>
      ) : (
        <Box>
          <Typography variant="subtitle1" className="mb-2">
            Therapeutic Equivalents:
          </Typography>
          <List>
            {equivalents.map((drug, index) => (
              <ListItem key={index} className="border-b last:border-b-0">
                <ListItemText
                  primary={drug.name}
                  secondary={drug.synonym ? `Also known as: ${drug.synonym}` : ''}
                />
                <Chip label={drug.tty} size="small" />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
};

export default Formulary;