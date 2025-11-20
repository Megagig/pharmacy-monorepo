import React from 'react';
import { useDrugMonograph } from '../queries/drugQueries';
import { useDrugStore } from '../stores/drugStore';
import { Box, CircularProgress, Typography, Paper, Divider } from '@mui/material';
import LoadingSkeleton from './LoadingSkeleton';

interface DrugDetailsProps {
  drugId: string;
}

const DrugDetails: React.FC<DrugDetailsProps> = ({ drugId }) => {
  const { data: monograph, isLoading, error } = useDrugMonograph(drugId);
  const { selectedDrug } = useDrugStore();

  if (isLoading) {
    return <LoadingSkeleton type="details" />;
  }

  if (error) {
    return (
      <Box my={4}>
        <Typography color="error">
          Error loading drug details: {(error as any).message}
        </Typography>
      </Box>
    );
  }

  if (!monograph) {
    return (
      <Box my={4}>
        <Typography>No details available for this drug</Typography>
      </Box>
    );
  }

  // Extract key information from monograph
  const title = monograph.SPL?.title || selectedDrug?.name || 'Drug Information';
  const publishedDate = monograph.SPL?.published_date;

  return (
    <Paper elevation={2} className="p-4">
      <Typography variant="h5" className="mb-2">
        {title}
      </Typography>
      
      {publishedDate && (
        <Typography variant="body2" className="mb-4 text-gray-600">
          Published: {new Date(publishedDate).toLocaleDateString()}
        </Typography>
      )}
      
      <Divider className="my-4" />
      
      {monograph.SPL?.content && monograph.SPL.content.length > 0 ? (
        <Box>
          {monograph.SPL.content.map((section: any, index: number) => (
            <Box key={index} className="mb-4">
              {section.title && (
                <Typography variant="h6" className="mb-2">
                  {section.title}
                </Typography>
              )}
              
              {section.paragraph && (
                <Typography variant="body1" className="mb-2">
                  {section.paragraph}
                </Typography>
              )}
              
              {section.list && (
                <ul className="list-disc pl-6">
                  {section.list.map((item: string, itemIndex: number) => (
                    <li key={itemIndex} className="mb-1">
                      <Typography variant="body2">{item}</Typography>
                    </li>
                  ))}
                </ul>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Typography>No detailed information available</Typography>
      )}
    </Paper>
  );
};

export default DrugDetails;