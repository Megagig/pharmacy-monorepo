import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Badge,
  Button,
  Chip,
  Alert,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Assignment as ReviewIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import { interactionService } from '../services/interactionService';
import InteractionDetailCard from '../components/interactions/InteractionDetailCard';
import ReviewActionPanel from '../components/interactions/ReviewActionPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface InteractionData {
  _id: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  interactions: Array<{
    severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
    description: string;
    drug1: { name: string; rxcui?: string };
    drug2: { name: string; rxcui?: string };
    clinicalSignificance?: string;
    managementRecommendation?: string;
    source: string;
  }>;
  hasCriticalInteraction: boolean;
  hasContraindication: boolean;
  status: string;
  createdAt: string;
  reviewedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  reviewedAt?: string;
  pharmacistNotes?: string;
  reviewDecision?: {
    action: string;
    reason: string;
    modificationSuggestions?: string;
    monitoringParameters?: string;
  };
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`interaction-tabpanel-${index}`}
    aria-labelledby={`interaction-tab-${index}`}
  >
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const InteractionReviewPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { interactionId } = useParams<{ interactionId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [tabValue, setTabValue] = useState(0);
  const [pendingInteractions, setPendingInteractions] = useState<InteractionData[]>([]);
  const [criticalInteractions, setCriticalInteractions] = useState<InteractionData[]>([]);
  const [selectedInteraction, setSelectedInteraction] = useState<InteractionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    total: 0,
    contraindicated: 0,
    critical: 0,
    pendingReviews: 0,
  });

  // Initialize tab based on URL params or default
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'critical') setTabValue(1);
    else if (tab === 'analytics') setTabValue(2);
    else setTabValue(0);
  }, [searchParams]);

  // Load specific interaction if ID provided
  useEffect(() => {
    if (interactionId) {
      loadSpecificInteraction(interactionId);
    }
  }, [interactionId]);

  // Load interactions data
  useEffect(() => {
    loadInteractionsData();
  }, []);

  const loadInteractionsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pendingResponse, criticalResponse] = await Promise.all([
        interactionService.getPendingReviews(50),
        interactionService.getCriticalInteractions(),
      ]);

      if (pendingResponse.success) {
        const { summary: summaryData, interactions } = pendingResponse.data;
        setPendingInteractions(interactions);
        setSummary(summaryData);
      }

      if (criticalResponse.success) {
        setCriticalInteractions(criticalResponse.data.interactions);
      }

    } catch (err: unknown) {
      console.error('Error loading interactions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load interactions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificInteraction = async (id: string) => {
    try {
      const response = await interactionService.getInteraction(id);
      if (response.success) {
        setSelectedInteraction(response.data);
      }
    } catch (err: unknown) {
      console.error('Error loading specific interaction:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load interaction: ${errorMessage}`);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    const tabNames = ['pending', 'critical', 'analytics'];
    setSearchParams({ tab: tabNames[newValue] });
  };

  const handleInteractionSelect = (interaction: InteractionData) => {
    setSelectedInteraction(interaction);
    navigate(`/interactions/${interaction._id}`);
  };

  const handleReviewComplete = async (interactionId: string, reviewData: {
    action: string;
    reason: string;
    modificationSuggestions?: string;
    monitoringParameters?: string;
    pharmacistNotes?: string;
  }) => {
    try {
      await interactionService.reviewInteraction(interactionId, reviewData);
      
      // Refresh data
      await loadInteractionsData();
      
      // Clear selected interaction if it was the one reviewed
      if (selectedInteraction?._id === interactionId) {
        setSelectedInteraction(null);
        navigate('/interactions/pending-reviews');
      }
      
    } catch (err: unknown) {
      console.error('Error completing review:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to complete review: ${errorMessage}`);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'contraindicated': return theme.palette.error.main;
      case 'major': return theme.palette.warning.main;
      case 'moderate': return theme.palette.info.main;
      case 'minor': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getSeverityIcon = (severity: string) => {
    const props = { fontSize: 'small' as const };
    switch (severity) {
      case 'contraindicated': return <ErrorIcon {...props} />;
      case 'major': return <WarningIcon {...props} />;
      case 'moderate': return <InfoIcon {...props} />;
      case 'minor': return <CheckCircleIcon {...props} />;
      default: return <InfoIcon {...props} />;
    }
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

  const renderInteractionsList = (interactions: InteractionData[], title: string) => {
    if (loading) {
      return (
        <Box>
          {[...Array(3)].map((_, index) => (
            <Card key={index} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Box ml={2} flex={1}>
                    <Skeleton width="60%" height={24} />
                    <Skeleton width="40%" height={20} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      );
    }

    if (interactions.length === 0) {
      return (
        <Card>
          <CardContent>
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              py={6}
              sx={{ color: 'text.secondary' }}
            >
              <CheckCircleIcon sx={{ fontSize: 64, mb: 2, color: 'success.main' }} />
              <Typography variant="h6" gutterBottom>
                No {title.toLowerCase()} found
              </Typography>
              <Typography variant="body2">
                All interactions have been reviewed or there are no active interactions.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      );
    }

    return (
      <Box>
        <AnimatePresence>
          {interactions.map((interaction, index) => {
            const severity = getHighestSeverity(interaction.interactions);
            const severityColor = getSeverityColor(severity);
            
            return (
              <motion.div
                key={interaction._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  sx={{ 
                    mb: 2, 
                    cursor: 'pointer',
                    border: `2px solid ${alpha(severityColor, 0.3)}`,
                    '&:hover': {
                      backgroundColor: alpha(severityColor, 0.1),
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                  onClick={() => handleInteractionSelect(interaction)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center" flex={1}>
                        <Box 
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            backgroundColor: alpha(severityColor, 0.2),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: severityColor,
                            mr: 2,
                          }}
                        >
                          {getSeverityIcon(severity)}
                        </Box>
                        
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="h6" component="h3">
                              {interaction.patientId.firstName} {interaction.patientId.lastName}
                            </Typography>
                            
                            {interaction.hasContraindication && (
                              <Chip 
                                label="CONTRAINDICATED" 
                                color="error" 
                                size="small"
                                sx={{ fontSize: '0.7rem', height: 22 }}
                              />
                            )}
                            
                            {interaction.hasCriticalInteraction && !interaction.hasContraindication && (
                              <Chip 
                                label="CRITICAL" 
                                color="warning" 
                                size="small"
                                sx={{ fontSize: '0.7rem', height: 22 }}
                              />
                            )}
                          </Box>
                          
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {interaction.interactions.length} interaction{interaction.interactions.length !== 1 ? 's' : ''} detected
                          </Typography>
                          
                          {interaction.interactions.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {interaction.interactions[0].drug1.name} ↔ {interaction.interactions[0].drug2.name}
                              {interaction.interactions.length > 1 && ` +${interaction.interactions.length - 1} more`}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      
                      <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                        <Chip 
                          label={interaction.status.toUpperCase()} 
                          color={interaction.status === 'pending' ? 'warning' : 'default'}
                          size="small"
                        />
                        
                        <Typography variant="caption" color="text.secondary">
                          {new Date(interaction.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </Box>
    );
  };

  const renderSummaryCards = () => (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2,
                }}
              >
                <ReviewIcon color="primary" />
              </Box>
              <Box>
                <Typography variant="h4" component="div" fontWeight="bold">
                  {summary.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Reviews
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.error.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2,
                }}
              >
                <ErrorIcon color="error" />
              </Box>
              <Box>
                <Typography variant="h4" component="div" fontWeight="bold">
                  {summary.contraindicated}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Contraindicated
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.warning.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2,
                }}
              >
                <WarningIcon color="warning" />
              </Box>
              <Box>
                <Typography variant="h4" component="div" fontWeight="bold">
                  {summary.critical}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Critical
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.info.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2,
                }}
              >
                <ScheduleIcon color="info" />
              </Box>
              <Box>
                <Typography variant="h4" component="div" fontWeight="bold">
                  {summary.pendingReviews}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={loadInteractionsData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <Helmet>
        <title>Drug Interaction Review - PharmaCare</title>
        <meta name="description" content="Review and manage drug interactions" />
      </Helmet>

      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                Drug Interaction Review
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Review and manage drug interactions requiring pharmacist attention
              </Typography>
            </Box>
            
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadInteractionsData}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
              >
                Filter
              </Button>
            </Box>
          </Box>

          {/* Summary Cards */}
          {renderSummaryCards()}

          {/* Main Content Area */}
          <Grid container spacing={3}>
            {/* Left Panel - Interactions List */}
            <Grid item xs={12} lg={selectedInteraction ? 8 : 12}>
              <Card>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs 
                    value={tabValue} 
                    onChange={handleTabChange}
                    sx={{ px: 2 }}
                  >
                    <Tab
                      label={
                        <Badge badgeContent={summary.pendingReviews} color="error" max={99}>
                          Pending Reviews
                        </Badge>
                      }
                    />
                    <Tab
                      label={
                        <Badge badgeContent={summary.contraindicated + summary.critical} color="warning" max={99}>
                          Critical Interactions
                        </Badge>
                      }
                    />
                    <Tab label="Analytics" />
                  </Tabs>
                </Box>

                <CardContent sx={{ p: 0 }}>
                  <TabPanel value={tabValue} index={0}>
                    {renderInteractionsList(pendingInteractions, 'Pending Reviews')}
                  </TabPanel>
                  
                  <TabPanel value={tabValue} index={1}>
                    {renderInteractionsList(criticalInteractions, 'Critical Interactions')}
                  </TabPanel>
                  
                  <TabPanel value={tabValue} index={2}>
                    <Box p={3}>
                      <Typography variant="h6" gutterBottom>
                        Interaction Analytics
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Analytics dashboard coming soon...
                      </Typography>
                    </Box>
                  </TabPanel>
                </CardContent>
              </Card>
            </Grid>

            {/* Right Panel - Interaction Details & Review */}
            {selectedInteraction && (
              <Grid item xs={12} lg={4}>
                <Box sx={{ position: 'sticky', top: 24 }}>
                  <InteractionDetailCard 
                    interaction={selectedInteraction}
                    onClose={() => {
                      setSelectedInteraction(null);
                      navigate('/interactions/pending-reviews');
                    }}
                  />
                  
                  {selectedInteraction.status === 'pending' && (
                    <Box mt={2}>
                      <ReviewActionPanel
                        interaction={selectedInteraction}
                        onReviewComplete={(reviewData) => 
                          handleReviewComplete(selectedInteraction._id, reviewData)
                        }
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            )}
          </Grid>
        </Box>
      </Container>

      {loading && <LoadingSpinner />}
    </>
  );
};

export default InteractionReviewPage;