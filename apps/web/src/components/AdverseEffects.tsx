import React from 'react';
import { useAdverseEffects } from '../queries/drugQueries';
import { Box, CircularProgress, Typography, Paper, List, ListItem, ListItemText, Chip, Alert } from '@mui/material';
import LoadingSkeleton from './LoadingSkeleton';

interface AdverseEffectsProps {
  drugId: string;
  drugName?: string;
}

const AdverseEffects: React.FC<AdverseEffectsProps> = ({ drugId, drugName }) => {
  const { data: adverseEffects, isLoading, error } = useAdverseEffects(drugId, 20);

  if (isLoading) {
    return <LoadingSkeleton type="list" />;
  }

  if (error) {
    return (
      <Box my={4}>
        <Alert severity="error">
          Error loading adverse effects: {(error as any).message}
        </Alert>
      </Box>
    );
  }

  if (!adverseEffects || !adverseEffects.results) {
    return (
      <Box my={4}>
        <Typography>No adverse effects data available</Typography>
      </Box>
    );
  }

  // Extract unique reactions
  const reactions: { [key: string]: { count: number; seriousness: string[] } } = {};
  
  adverseEffects.results.forEach(report => {
    if (report.patient && report.patient.reaction) {
      report.patient.reaction.forEach(reaction => {
        const reactionName = reaction.reactionmeddrapt;
        if (!reactions[reactionName]) {
          reactions[reactionName] = { 
            count: 0, 
            seriousness: [] 
          };
        }
        
        reactions[reactionName].count += 1;
        
        // Track seriousness levels
        const seriousness: string[] = [];
        if (report.seriousnessdeath === '1') seriousness.push('Death');
        if (report.seriousnesslifethreatening === '1') seriousness.push('Life Threatening');
        if (report.seriousnesshospitalization === '1') seriousness.push('Hospitalization');
        
        reactions[reactionName].seriousness = [
          ...new Set([...reactions[reactionName].seriousness, ...seriousness])
        ];
      });
    }
  });

  // Convert to array and sort by frequency
  const sortedReactions = Object.entries(reactions)
    .map(([reaction, data]) => ({
      reaction,
      count: data.count,
      seriousness: data.seriousness
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Paper elevation={2} className="p-4">
      <Typography variant="h6" className="mb-4">
        Adverse Effects {drugName ? `for ${drugName}` : ''}
      </Typography>
      
      {sortedReactions.length === 0 ? (
        <Alert severity="info">
          No adverse effects reported
        </Alert>
      ) : (
        <List>
          {sortedReactions.map(({ reaction, count, seriousness }, index) => (
            <ListItem key={index} className="border-b last:border-b-0">
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center">
                    <Typography variant="body1" className="font-medium">
                      {reaction}
                    </Typography>
                    <Chip 
                      label={count} 
                      size="small" 
                      className="ml-2"
                      color={seriousness.length > 0 ? 'error' : 'default'}
                    />
                  </Box>
                }
                secondary={
                  seriousness.length > 0 ? (
                    <Typography variant="body2" color="error">
                      Seriousness: {seriousness.join(', ')}
                    </Typography>
                  ) : null
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default AdverseEffects;