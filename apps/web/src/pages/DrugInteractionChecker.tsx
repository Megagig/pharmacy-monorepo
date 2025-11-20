import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  TextField,
  Autocomplete,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

interface Drug {
  rxcui: string;
  name: string;
}

interface Interaction {
  drug1: { name: string; rxcui: string };
  drug2: { name: string; rxcui: string };
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  description: string;
  source: string;
}

interface InteractionResult {
  hasInteractions: boolean;
  interactions: Interaction[];
  checkedDrugs: Drug[];
}

const DrugInteractionChecker: React.FC = () => {
  const [selectedDrugs, setSelectedDrugs] = useState<Drug[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Drug[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [interactionResults, setInteractionResults] = useState<InteractionResult | null>(null);

  // Search drugs mutation
  const searchDrugsMutation = useMutation({
    mutationFn: async (term: string) => {
      const response = await apiClient.get('/drugs/search', {
        params: { name: term },
      });
      return response.data;
    },
    onSuccess: (response) => {
      console.log('Drug search response:', response);
      // Handle both direct data and wrapped response
      const data = response.data || response;
      
      // Transform the response to Drug format
      const drugs: Drug[] = data.drugGroup?.conceptGroup
        ?.flatMap((group: any) => 
          group.conceptProperties?.map((prop: any) => ({
            rxcui: prop.rxcui,
            name: prop.name,
          })) || []
        ) || [];
      console.log('Transformed drugs:', drugs);
      setSearchResults(drugs);
      setSearchLoading(false);
    },
    onError: (error) => {
      console.error('Drug search error:', error);
      setSearchLoading(false);
      setSearchResults([]);
    },
  });

  // Check interactions mutation
  const checkInteractionsMutation = useMutation({
    mutationFn: async (drugs: Drug[]) => {
      const rxcuis = drugs.map(d => d.rxcui);
      console.log('Checking interactions for RxCUIs:', rxcuis);
      const response = await apiClient.post('/drugs/interactions', {
        rxcuis,
      });
      return response.data;
    },
    onSuccess: (response) => {
      console.log('Interaction check response:', response);
      // Handle both direct data and wrapped response
      const data = response.data || response;
      
      // Transform the response
      const interactions: Interaction[] = [];
      
      if (data.fullInteractionTypeGroup) {
        data.fullInteractionTypeGroup.forEach((group: any) => {
          group.fullInteractionType?.forEach((interaction: any) => {
            if (interaction.minConcept && interaction.minConcept.length >= 2) {
              interactions.push({
                drug1: {
                  name: interaction.minConcept[0].name,
                  rxcui: interaction.minConcept[0].rxcui,
                },
                drug2: {
                  name: interaction.minConcept[1].name,
                  rxcui: interaction.minConcept[1].rxcui,
                },
                severity: determineSeverity(interaction.interactionPair?.[0]?.description || ''),
                description: interaction.interactionPair?.[0]?.description || 'Interaction detected',
                source: group.sourceName || 'RxNorm',
              });
            }
          });
        });
      }

      console.log('Processed interactions:', interactions);
      setInteractionResults({
        hasInteractions: interactions.length > 0,
        interactions,
        checkedDrugs: selectedDrugs,
      });
    },
    onError: (error: any) => {
      console.error('Interaction check error:', error);
      console.error('Error response:', error.response?.data);
    },
  });

  const determineSeverity = (description: string): 'contraindicated' | 'major' | 'moderate' | 'minor' => {
    const lower = description.toLowerCase();
    if (lower.includes('contraindicated') || lower.includes('avoid') || lower.includes('do not')) {
      return 'contraindicated';
    }
    if (lower.includes('major') || lower.includes('serious') || lower.includes('severe')) {
      return 'major';
    }
    if (lower.includes('moderate') || lower.includes('monitor') || lower.includes('caution')) {
      return 'moderate';
    }
    return 'minor';
  };

  const handleSearchChange = (value: string) => {
    console.log('Search term changed:', value);
    setSearchTerm(value);
    if (value.length >= 3) {
      console.log('Triggering search for:', value);
      setSearchLoading(true);
      searchDrugsMutation.mutate(value);
    } else {
      setSearchResults([]);
    }
  };

  const handleAddDrug = (drug: Drug) => {
    console.log('Adding drug:', drug);
    if (!selectedDrugs.find(d => d.rxcui === drug.rxcui)) {
      setSelectedDrugs([...selectedDrugs, drug]);
      setSearchTerm('');
      setSearchResults([]);
      console.log('Drug added. Total drugs:', selectedDrugs.length + 1);
    } else {
      console.log('Drug already selected');
    }
  };

  const handleRemoveDrug = (rxcui: string) => {
    setSelectedDrugs(selectedDrugs.filter(d => d.rxcui !== rxcui));
    setInteractionResults(null);
  };

  const handleCheckInteractions = () => {
    if (selectedDrugs.length >= 2) {
      checkInteractionsMutation.mutate(selectedDrugs);
    }
  };

  const handleClearAll = () => {
    setSelectedDrugs([]);
    setInteractionResults(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'contraindicated':
        return 'error';
      case 'major':
        return 'warning';
      case 'moderate':
        return 'info';
      case 'minor':
        return 'success';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'contraindicated':
      case 'major':
        return <WarningIcon />;
      case 'moderate':
        return <InfoIcon />;
      case 'minor':
        return <CheckCircleIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Drug Interaction Checker
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Check for potential interactions between medications. Add at least 2 medications to check for interactions.
        </Typography>
      </Box>

      {/* Drug Search and Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Medications
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Autocomplete
            fullWidth
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
            inputValue={searchTerm}
            onInputChange={(_, value) => handleSearchChange(value)}
            onChange={(_, value) => {
              if (value && typeof value !== 'string') {
                handleAddDrug(value);
              }
            }}
            loading={searchLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for medication"
                placeholder="Type at least 3 characters..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searchLoading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.rxcui}>
                <Box>
                  <Typography variant="body1">{option.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    RxCUI: {option.rxcui}
                  </Typography>
                </Box>
              </li>
            )}
          />
        </Box>

        {/* Selected Drugs */}
        {selectedDrugs.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="medium">
                Selected Medications ({selectedDrugs.length})
              </Typography>
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={handleClearAll}
                color="error"
              >
                Clear All
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {selectedDrugs.map((drug) => (
                <Chip
                  key={drug.rxcui}
                  label={drug.name}
                  onDelete={() => handleRemoveDrug(drug.rxcui)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              onClick={handleCheckInteractions}
              disabled={selectedDrugs.length < 2 || checkInteractionsMutation.isPending}
              fullWidth
            >
              {checkInteractionsMutation.isPending ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Checking Interactions...
                </>
              ) : (
                'Check for Interactions'
              )}
            </Button>
          </Box>
        )}

        {selectedDrugs.length === 0 && searchTerm.length >= 3 && !searchLoading && searchResults.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No medications found. Try a different search term or check your spelling.
          </Alert>
        )}

        {selectedDrugs.length === 1 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Add at least one more medication to check for interactions.
          </Alert>
        )}
      </Paper>

      {/* Interaction Results */}
      {interactionResults && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Interaction Results
          </Typography>

          {!interactionResults.hasInteractions ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              <Typography variant="subtitle1" fontWeight="medium">
                No Known Interactions Found
              </Typography>
              <Typography variant="body2">
                Based on available data, no significant interactions were detected between the selected medications.
                However, always consult with a healthcare professional before taking multiple medications.
              </Typography>
            </Alert>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="medium">
                  {interactionResults.interactions.length} Interaction(s) Detected
                </Typography>
                <Typography variant="body2">
                  Review the interactions below and consult with a pharmacist or healthcare provider.
                </Typography>
              </Alert>

              <Grid container spacing={2}>
                {interactionResults.interactions.map((interaction, index) => (
                  <Grid item xs={12} key={index}>
                    <Card 
                      variant="outlined"
                      sx={{ 
                        borderLeft: 4,
                        borderLeftColor: `${getSeverityColor(interaction.severity)}.main`,
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                          <Box sx={{ color: `${getSeverityColor(interaction.severity)}.main` }}>
                            {getSeverityIcon(interaction.severity)}
                          </Box>
                          
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Chip
                                label={interaction.severity.toUpperCase()}
                                color={getSeverityColor(interaction.severity) as any}
                                size="small"
                              />
                              <Typography variant="caption" color="text.secondary">
                                Source: {interaction.source}
                              </Typography>
                            </Box>

                            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                              {interaction.drug1.name} ↔ {interaction.drug2.name}
                            </Typography>

                            <Typography variant="body2" color="text.secondary" paragraph>
                              {interaction.description}
                            </Typography>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="subtitle2" gutterBottom>
                              What to do:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {interaction.severity === 'contraindicated' && 
                                '⚠️ Do not use these medications together. Contact your healthcare provider immediately for alternative options.'}
                              {interaction.severity === 'major' && 
                                '⚠️ This is a serious interaction. Consult your pharmacist or doctor before taking these medications together.'}
                              {interaction.severity === 'moderate' && 
                                'ℹ️ Monitor for side effects. Your healthcare provider may need to adjust dosages or timing.'}
                              {interaction.severity === 'minor' && 
                                '✓ This interaction is generally manageable. Inform your healthcare provider and monitor for any unusual symptoms.'}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </Paper>
      )}

      {/* Error Handling */}
      {searchDrugsMutation.isError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Failed to search for medications
          </Typography>
          <Typography variant="body2">
            {searchDrugsMutation.error instanceof Error 
              ? searchDrugsMutation.error.message 
              : 'Please check your connection and try again. If the problem persists, contact support.'}
          </Typography>
        </Alert>
      )}
      
      {checkInteractionsMutation.isError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Failed to check interactions
          </Typography>
          <Typography variant="body2">
            {checkInteractionsMutation.error instanceof Error 
              ? checkInteractionsMutation.error.message 
              : 'Please try again or contact support if the problem persists.'}
          </Typography>
        </Alert>
      )}

      {/* Information Section */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'info.lighter' }}>
        <Typography variant="h6" gutterBottom>
          Important Information
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="info" />
            </ListItemIcon>
            <ListItemText 
              primary="This tool checks for known drug interactions using the RxNorm database"
              secondary="Results are based on available medical literature and may not include all possible interactions"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText 
              primary="Always consult a healthcare professional"
              secondary="This tool is for informational purposes only and should not replace professional medical advice"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Consider all medications and supplements"
              secondary="Include over-the-counter medications, vitamins, and herbal supplements when checking for interactions"
            />
          </ListItem>
        </List>
      </Paper>
    </Container>
  );
};

export default DrugInteractionChecker;
