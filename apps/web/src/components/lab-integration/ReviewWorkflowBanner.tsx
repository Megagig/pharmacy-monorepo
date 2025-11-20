import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Stack,
  Avatar,
  LinearProgress,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { format } from 'date-fns';
import type { LabIntegration } from '../../services/labIntegrationService';

interface ReviewWorkflowBannerProps {
  labIntegration: LabIntegration;
  onStartReview: () => void;
}

const ReviewWorkflowBanner: React.FC<ReviewWorkflowBannerProps> = ({
  labIntegration,
  onStartReview,
}) => {
  const getStatusInfo = () => {
    switch (labIntegration.status) {
      case 'pending_review':
        return {
          icon: <ScheduleIcon />,
          color: 'warning' as const,
          title: 'Review Required',
          description: 'AI interpretation complete. Pharmacist review needed.',
          action: 'Start Review',
          showProgress: false,
        };
      case 'pending_approval':
        return {
          icon: <AssignmentIcon />,
          color: 'info' as const,
          title: 'Approval Pending',
          description: 'Review submitted. Awaiting final approval.',
          action: 'View Review',
          showProgress: false,
        };
      case 'approved':
        return {
          icon: <CheckCircleIcon />,
          color: 'success' as const,
          title: 'Approved',
          description: 'Recommendations approved and ready for implementation.',
          action: 'View Details',
          showProgress: false,
        };
      case 'pending_interpretation':
        return {
          icon: <ScheduleIcon />,
          color: 'info' as const,
          title: 'AI Processing',
          description: 'AI interpretation in progress...',
          action: null,
          showProgress: true,
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo) return null;

  const hasRecommendations = labIntegration.therapyRecommendations?.length > 0;
  const hasCriticalRecommendations = labIntegration.therapyRecommendations?.some(
    (rec) => rec.priority === 'critical'
  );

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 3,
        border: 2,
        borderColor: `${statusInfo.color}.main`,
        bgcolor: `${statusInfo.color}.50`,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar 
            sx={{ 
              bgcolor: `${statusInfo.color}.main`,
              width: 48,
              height: 48,
            }}
          >
            {statusInfo.icon}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {statusInfo.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {statusInfo.description}
            </Typography>
            {statusInfo.showProgress && (
              <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />
            )}
          </Box>
          {statusInfo.action && (
            <Button
              variant="contained"
              color={statusInfo.color}
              onClick={onStartReview}
              startIcon={statusInfo.icon}
              size="large"
            >
              {statusInfo.action}
            </Button>
          )}
        </Box>

        {/* Additional Info */}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            label={`${labIntegration.therapyRecommendations?.length || 0} Recommendations`}
            size="small"
            variant="outlined"
          />
          {hasCriticalRecommendations && (
            <Chip
              label="Critical Priority"
              size="small"
              color="error"
              icon={<WarningIcon />}
            />
          )}
          {labIntegration.pharmacistReview && (
            <Chip
              label={`Reviewed by ${labIntegration.pharmacistReview.reviewedBy}`}
              size="small"
              color="success"
              icon={<CheckCircleIcon />}
            />
          )}
          {labIntegration.urgency === 'stat' && (
            <Chip
              label="STAT Case"
              size="small"
              color="error"
              icon={<LocalHospitalIcon />}
            />
          )}
        </Stack>

        {/* Review Summary */}
        {labIntegration.pharmacistReview && (
          <Alert 
            severity={
              labIntegration.pharmacistReview.decision === 'approved' ? 'success' :
              labIntegration.pharmacistReview.decision === 'rejected' ? 'error' : 'warning'
            }
            sx={{ mt: 2 }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Review Decision: {labIntegration.pharmacistReview.decision.toUpperCase()}
            </Typography>
            <Typography variant="body2">
              Reviewed on {format(new Date(labIntegration.pharmacistReview.reviewedAt), 'MMM dd, yyyy HH:mm')}
            </Typography>
            {labIntegration.pharmacistReview.comments && (
              <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                "{labIntegration.pharmacistReview.comments}"
              </Typography>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewWorkflowBanner;