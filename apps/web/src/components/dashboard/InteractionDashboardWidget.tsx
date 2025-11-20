import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Avatar,
  List,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
  Button,
  Badge,
  Skeleton,
  Alert,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Medication as MedicationIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { interactionService } from '../../services/interactionService';

interface InteractionSummary {
  total: number;
  contraindicated: number;
  critical: number;
  byPatient: Record<string, number>;
}

interface PendingInteraction {
  _id: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  interactions: Array<{
    severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
    description: string;
    drug1: { name: string };
    drug2: { name: string };
  }>;
  hasCriticalInteraction: boolean;
  hasContraindication: boolean;
  createdAt: string;
  status: string;
}

interface InteractionWidgetProps {
  compact?: boolean;
  maxItems?: number;
}

const InteractionDashboardWidget: React.FC<InteractionWidgetProps> = ({
  compact = false,
  maxItems = 5,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [pendingInteractions, setPendingInteractions] = useState<PendingInteraction[]>([]);
  const [summary, setSummary] = useState<InteractionSummary>({
    total: 0,
    contraindicated: 0,
    critical: 0,
    byPatient: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchPendingInteractions();
    // Refresh every 5 minutes
    const interval = setInterval(fetchPendingInteractions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingInteractions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await interactionService.getPendingReviews();
      
      if (response.data.success) {
        const { summary: responseSummary, interactions } = response.data.data;
        setPendingInteractions(interactions.slice(0, maxItems));
        setSummary(responseSummary);
        setLastRefresh(new Date());
      } else {
        setError('Failed to load interaction data');
      }
    } catch (err: any) {
      console.error('Error fetching pending interactions:', err);
      setError(err.message || 'Failed to load interactions');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'contraindicated':
        return theme.palette.error.main;
      case 'major':
        return theme.palette.warning.main;
      case 'moderate':
        return theme.palette.info.main;
      case 'minor':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getSeverityIcon = (interaction: PendingInteraction) => {
    if (interaction.hasContraindication) {
      return <ErrorIcon fontSize="small" />;
    }
    if (interaction.hasCriticalInteraction) {
      return <WarningIcon fontSize="small" />;
    }
    return <InfoIcon fontSize="small" />;
  };

  const getHighestSeverity = (interactions: Array<{ severity: string }>) => {
    const severityOrder = ['contraindicated', 'major', 'moderate', 'minor'];
    for (const severity of severityOrder) {
      if (interactions.some(i => i.severity === severity)) {
        return severity;
      }
    }
    return 'minor';
  };

  const handleViewInteraction = (interactionId: string) => {
    navigate(`/interactions/${interactionId}`);
  };

  const handleViewAll = () => {
    navigate('/interactions/pending-reviews');
  };

  if (loading && pendingInteractions.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" component="h2">
              Drug Interactions
            </Typography>
            <Skeleton width={80} height={32} />
          </Box>
          {[...Array(3)].map((_, index) => (
            <Box key={index} display="flex" alignItems="center" mb={1}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box ml={2} flex={1}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={fetchPendingInteractions}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <Typography variant="h6" component="h2">
                Drug Interactions
              </Typography>
              {summary.total > 0 && (
                <Badge
                  badgeContent={summary.total}
                  color="primary"
                  sx={{ ml: 2 }}
                  max={99}
                />
              )}
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Tooltip title={`Last updated: ${lastRefresh.toLocaleTimeString()}`}>
                <IconButton size="small" onClick={fetchPendingInteractions} disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Summary Chips */}
          {!compact && (
            <Box display="flex" gap={1} mb={2} flexWrap="wrap">
              {summary.contraindicated > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${summary.contraindicated} Contraindicated`}
                  color="error"
                  size="small"
                />
              )}
              {summary.critical > 0 && (
                <Chip
                  icon={<WarningIcon />}
                  label={`${summary.critical} Critical`}
                  color="warning"
                  size="small"
                />
              )}
              {summary.total === 0 && (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="No pending reviews"
                  color="success"
                  size="small"
                />
              )}
            </Box>
          )}

          {/* Interactions List */}
          {pendingInteractions.length === 0 ? (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              py={4}
              sx={{ color: 'text.secondary' }}
            >
              <CheckCircleIcon sx={{ fontSize: 48, mb: 1, color: 'success.main' }} />
              <Typography variant="body2">
                No pending interaction reviews
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              <AnimatePresence>
                {pendingInteractions.map((interaction, index) => {
                  const highestSeverity = getHighestSeverity(interaction.interactions);
                  const severityColor = getSeverityColor(highestSeverity);
                  
                  return (
                    <motion.div
                      key={interaction._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <ListItemButton
                        onClick={() => handleViewInteraction(interaction._id)}
                        sx={{
                          borderRadius: 1,
                          mb: 1,
                          border: `1px solid ${alpha(severityColor, 0.3)}`,
                          '&:hover': {
                            backgroundColor: alpha(severityColor, 0.1),
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              backgroundColor: alpha(severityColor, 0.2),
                              color: severityColor,
                            }}
                          >
                            {getSeverityIcon(interaction)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle2">
                                {interaction.patientId.firstName} {interaction.patientId.lastName}
                              </Typography>
                              {interaction.hasContraindication && (
                                <Chip
                                  label="CONTRAINDICATED"
                                  color="error"
                                  size="small"
                                  sx={{ fontSize: '0.7rem', height: 20 }}
                                />
                              )}
                              {interaction.hasCriticalInteraction && !interaction.hasContraindication && (
                                <Chip
                                  label="CRITICAL"
                                  color="warning"
                                  size="small"
                                  sx={{ fontSize: '0.7rem', height: 20 }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {interaction.interactions.length} interaction
                                {interaction.interactions.length !== 1 ? 's' : ''} detected
                              </Typography>
                              {!compact && interaction.interactions.length > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  {interaction.interactions[0].drug1.name} ↔ {interaction.interactions[0].drug2.name}
                                  {interaction.interactions.length > 1 && ` +${interaction.interactions.length - 1} more`}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Box display="flex" alignItems="center" gap={1}>
                          <Tooltip title={`Created ${new Date(interaction.createdAt).toLocaleString()}`}>
                            <ScheduleIcon fontSize="small" color="disabled" />
                          </Tooltip>
                          <ViewIcon fontSize="small" color="action" />
                        </Box>
                      </ListItemButton>
                      {index < pendingInteractions.length - 1 && <Divider />}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </List>
          )}

          {/* View All Button */}
          {summary.total > maxItems && (
            <Box mt={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleViewAll}
                startIcon={<ViewIcon />}
              >
                View All ({summary.total}) Pending Reviews
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default InteractionDashboardWidget;