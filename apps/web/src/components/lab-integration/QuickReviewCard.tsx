import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Avatar,
  Stack,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import ScienceIcon from '@mui/icons-material/Science';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { LabIntegration } from '../../services/labIntegrationService';

interface QuickReviewCardProps {
  labIntegration: LabIntegration;
  compact?: boolean;
}

const QuickReviewCard: React.FC<QuickReviewCardProps> = ({
  labIntegration,
  compact = false,
}) => {
  const navigate = useNavigate();

  const handleReview = () => {
    navigate(`/pharmacy/lab-integration/${labIntegration._id}?tab=1`);
  };

  const handleViewDetails = () => {
    navigate(`/pharmacy/lab-integration/${labIntegration._id}`);
  };

  const getUrgencyColor = () => {
    switch (labIntegration.urgency) {
      case 'stat': return 'error';
      case 'urgent': return 'warning';
      default: return 'default';
    }
  };

  const hasCriticalRecommendations = labIntegration.therapyRecommendations?.some(
    (rec) => rec.priority === 'critical'
  );

  if (compact) {
    return (
      <Card variant="outlined" sx={{ mb: 1 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}>
              <AssignmentIcon fontSize="small" />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight="medium" noWrap>
                Patient ID: {labIntegration.patientId}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {format(new Date(labIntegration.createdAt), 'MMM dd, HH:mm')}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5}>
              {hasCriticalRecommendations && (
                <Chip label="Critical" size="small" color="error" />
              )}
              <Chip 
                label={labIntegration.urgency || 'routine'} 
                size="small" 
                color={getUrgencyColor() as any}
              />
            </Stack>
            <Button
              size="small"
              variant="contained"
              onClick={handleReview}
              startIcon={<AssignmentIcon />}
            >
              Review
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: 'warning.main', width: 48, height: 48 }}>
            <AssignmentIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              Lab Integration Case
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Case ID: {labIntegration._id.slice(0, 8).toUpperCase()}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="body2">
                Patient ID: {labIntegration.patientId}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="body2">
                Created: {format(new Date(labIntegration.createdAt), 'MMM dd, yyyy HH:mm')}
              </Typography>
            </Box>
            
            {/* Status Chips */}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label="Pending Review"
                color="warning"
                icon={<ScheduleIcon />}
              />
              <Chip
                label={`${labIntegration.therapyRecommendations?.length || 0} Recommendations`}
                variant="outlined"
                icon={<ScienceIcon />}
              />
              {hasCriticalRecommendations && (
                <Chip
                  label="Critical Priority"
                  color="error"
                  icon={<WarningIcon />}
                />
              )}
              <Chip
                label={labIntegration.urgency?.toUpperCase() || 'ROUTINE'}
                color={getUrgencyColor() as any}
                variant="outlined"
              />
            </Stack>
          </Box>
        </Box>

        {/* AI Interpretation Summary */}
        {labIntegration.aiInterpretation && (
          <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              AI Interpretation Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {labIntegration.aiInterpretation.summary && labIntegration.aiInterpretation.summary.length > 150
                ? `${labIntegration.aiInterpretation.summary.substring(0, 150)}...`
                : labIntegration.aiInterpretation.summary || 'AI interpretation in progress...'
              }
            </Typography>
          </Box>
        )}
      </CardContent>
      
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button
          variant="outlined"
          onClick={handleViewDetails}
          startIcon={<ScienceIcon />}
        >
          View Details
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleReview}
          startIcon={<AssignmentIcon />}
        >
          Start Review
        </Button>
      </CardActions>
    </Card>
  );
};

export default QuickReviewCard;