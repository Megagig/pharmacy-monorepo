import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useDrugIndications } from '../queries/drugQueries';
import LoadingSkeleton from './LoadingSkeleton';

interface DrugIndicationsProps {
  drugId: string;
  drugName: string;
}

const DrugIndications: React.FC<DrugIndicationsProps> = ({
  drugId,
  drugName,
}) => {
  const {
    data: indicationsData,
    isLoading,
    error,
  } = useDrugIndications(drugId);

  const renderIndications = () => {
    if (!indicationsData?.results || indicationsData.results.length === 0) {
      return (
        <>
          <Alert severity="info" sx={{ mt: 2 }}>
            No indications information found for this drug.
          </Alert>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            We searched through multiple drug databases but couldn't find
            official indication information for {drugName}. This could happen
            if:
          </Typography>
          <ul style={{ color: '#666', marginTop: '8px' }}>
            <li>The drug name has an alternate spelling or format</li>
            <li>The drug may be known by another name in the FDA database</li>
            <li>
              There may be a temporary connection issue with the FDA database
            </li>
          </ul>
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            Always consult with a healthcare professional before starting or
            changing medication. Indications may vary based on formulation,
            dosage, and individual patient factors.
          </Typography>
        </>
      );
    }

    // Process and display indications
    return indicationsData.results
      .map((result: any, index: number) => {
        if (
          !result.indications_and_usage ||
          result.indications_and_usage.length === 0
        ) {
          return null;
        }

        return (
          <Paper key={index} sx={{ p: 3, mb: 3, borderRadius: '8px' }}>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{ mb: 2, color: '#0047AB' }}
            >
              {result.openfda?.brand_name?.[0] ||
                result.openfda?.generic_name?.[0] ||
                drugName}
            </Typography>

            <List sx={{ bgcolor: '#f9fbff', borderRadius: '8px', p: 2 }}>
              {result.indications_and_usage.map(
                (indication: string, idx: number) => (
                  <React.Fragment key={idx}>
                    <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CheckCircleIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={indication}
                        sx={{
                          '& .MuiListItemText-primary': {
                            fontWeight: 400,
                            fontSize: '0.95rem',
                          },
                        }}
                      />
                    </ListItem>
                    {idx < result.indications_and_usage.length - 1 && (
                      <Divider component="li" sx={{ ml: 9 }} />
                    )}
                  </React.Fragment>
                )
              )}
            </List>

            {result.openfda?.manufacturer_name && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 2,
                  fontStyle: 'italic',
                  color: 'text.secondary',
                }}
              >
                Manufacturer: {result.openfda.manufacturer_name.join(', ')}
              </Typography>
            )}
          </Paper>
        );
      })
      .filter(Boolean);
  };

  if (isLoading) {
    return <LoadingSkeleton type="list" />;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }} icon={<ErrorIcon />}>
        {(error as Error).message || 'Error loading drug indications'}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <MedicationIcon sx={{ mr: 1, color: '#0047AB' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#0047AB' }}>
          Indications for {drugName}
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        FDA-approved uses and therapeutic indications for this medication:
      </Typography>

      {renderIndications()}

      <Alert severity="info" sx={{ mt: 3, borderRadius: '8px' }}>
        <Typography variant="body2">
          Always consult with a healthcare professional before starting or
          changing medication. Indications may vary based on formulation,
          dosage, and individual patient factors.
        </Typography>
      </Alert>
    </Box>
  );
};

export default DrugIndications;
