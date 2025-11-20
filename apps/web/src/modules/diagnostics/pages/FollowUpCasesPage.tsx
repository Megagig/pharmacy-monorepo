import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Alert,
  Skeleton,
  Switch,
  FormControlLabel,
  Pagination,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { useFollowUpCases, useMarkCaseAsCompleted } from '../../../queries/useDiagnosticHistory';
import CaseReviewDialog from '../../../components/diagnostics/CaseReviewDialog';

const FollowUpCasesPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);

  const {
    data: followUpData,
    isLoading,
    error,
    refetch,
  } = useFollowUpCases({
    page,
    limit: 10,
    overdue: showOverdueOnly,
  });

  const markCompletedMutation = useMarkCaseAsCompleted();

  const followUpCases = followUpData?.cases || [];
  const pagination = followUpData?.pagination;

  const handleViewCase = (case_: any) => {
    setSelectedCase(case_);
    setReviewDialogOpen(true);
  };

  const handleMarkCompleted = async (caseId: string, data: any) => {
    await markCompletedMutation.mutateAsync({ caseId, data });
  };

  const getFollowUpStatus = (scheduledDate: string) => {
    const date = new Date(scheduledDate);
    const isOverdue = isPast(date);
    const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return {
      isOverdue,
      daysUntil,
      label: isOverdue
        ? `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''}`
        : daysUntil === 0
          ? 'Due today'
          : `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      color: isOverdue ? 'error' : daysUntil <= 1 ? 'warning' : 'info'
    };
  };

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error">
          Failed to load follow-up cases. Please try refreshing the page.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate('/pharmacy/diagnostics')}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 'bold', flex: 1 }}>
            Follow-up Cases
          </Typography>
          <Button
            variant="outlined"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Manage cases requiring follow-up attention
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showOverdueOnly}
                onChange={(e) => {
                  setShowOverdueOnly(e.target.checked);
                  setPage(1);
                }}
              />
            }
            label="Show overdue only"
          />
        </Box>
      </Box>

      {/* Follow-up Cases List */}
      <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              {showOverdueOnly ? 'Overdue Follow-ups' : 'All Follow-up Cases'}
              {pagination && (
                <Chip
                  label={`${pagination.totalCases} total`}
                  size="small"
                  sx={{ ml: 2 }}
                />
              )}
            </Typography>

            {isLoading ? (
              <Box>
                {[...Array(5)].map((_, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width="40%" />
                      </Box>
                      <Skeleton variant="rectangular" width={100} height={24} sx={{ borderRadius: 1 }} />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : followUpCases.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <ScheduleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  {showOverdueOnly ? 'No overdue follow-ups' : 'No follow-up cases found'}
                </Typography>
              </Box>
            ) : (
              <List>
                {followUpCases.map((case_) => {
                  const followUpStatus = getFollowUpStatus(case_.followUp.scheduledDate);

                  return (
                    <ListItem
                      key={case_._id}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                      onClick={() => handleViewCase(case_)}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: followUpStatus.isOverdue ? 'error.main' : 'warning.main' }}>
                          {followUpStatus.isOverdue ? <WarningIcon /> : <PersonIcon />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                              {case_.patientId?.firstName} {case_.patientId?.lastName}
                            </Typography>
                            <Chip
                              label={followUpStatus.label}
                              color={followUpStatus.color as any}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" component="span">
                              Case ID: {case_.caseId}
                            </Typography>
                            <br />
                            <Typography variant="body2" component="span">
                              Reason: {case_.followUp.reason}
                            </Typography>
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              Scheduled: {format(new Date(case_.followUp.scheduledDate), 'MMM dd, yyyy')}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {case_.patientId?.age}y, {case_.patientId?.gender}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CheckCircleIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCase(case_);
                          }}
                          sx={{ mt: 1 }}
                        >
                          Review
                        </Button>
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            )}

            {/* Pagination */}
            {pagination && pagination.total > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={pagination.total}
                  page={pagination.current}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Case Review Dialog */}
      <CaseReviewDialog
        open={reviewDialogOpen}
        onClose={() => {
          setReviewDialogOpen(false);
          setSelectedCase(null);
        }}
        case={selectedCase}
        onMarkFollowUp={async () => { }} // Not applicable for follow-up cases
        onMarkCompleted={handleMarkCompleted}
        onGenerateReferral={async () => { }} // Not applicable for follow-up cases
        loading={markCompletedMutation.isPending}
      />
    </Container>
  );
};

export default FollowUpCasesPage;