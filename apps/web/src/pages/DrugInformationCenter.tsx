import React, { useState, useEffect } from 'react';
import ModulePage from '../components/ModulePage';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import InfoIcon from '@mui/icons-material/Info';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Alert,
  useTheme,
} from '@mui/material';
import DrugSearch from '../components/DrugSearch';
import DrugDetails from '../components/DrugDetails';
import DrugInteractions from '../components/DrugInteractions';
import DrugIndications from '../components/DrugIndications';
import AdverseEffects from '../components/AdverseEffects';
import Formulary from '../components/Formulary';
import TherapyPlanManager from '../components/TherapyPlan';
import { useDrugStore } from '../stores/drugStore';
import type { ModuleInfo } from '../types/moduleTypes';

const DrugInformationCenter: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const { selectedDrug, searchError, setSearchError } = useDrugStore();

  // Clear any search errors when component mounts
  useEffect(() => {
    setSearchError(null);
    return () => {
      // Clean up any resources when component unmounts
      setSearchError(null);
    };
  }, [setSearchError]);

  const moduleInfo: ModuleInfo = {
    title: 'Drug Information Center',
    purpose:
      'Access comprehensive drug monographs, clinical guidelines, and formulary information for informed decision-making.',
    workflow: {
      description:
        'Comprehensive drug information resource providing evidence-based data to support clinical decision-making and patient counseling.',
      steps: [
        'Search for specific drug information',
        'View detailed drug monographs',
        'Check clinical guidelines and protocols',
        'Review formulary status and alternatives',
        'Add relevant information to therapy plans',
      ],
    },
    keyFeatures: [
      'Comprehensive drug database',
      'Clinical monographs and references',
      'Formulary management system',
      'Drug interaction database',
      'Dosing guidelines and calculators',
      'Patient counseling information',
      'Adverse effect profiles',
      'Therapeutic equivalence data',
    ],
    status: 'active',
    estimatedRelease: 'Available now',
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleDrugSelect = () => {
    setActiveTab(1); // Switch to details tab when a drug is selected
  };

  return (
    <ModulePage
      moduleInfo={moduleInfo}
      icon={
        MenuBookIcon as React.ComponentType<{
          sx?: React.CSSProperties;
          fontSize?: string;
        }>
      }
      gradient="linear-gradient(135deg, #0047AB 0%, #87CEEB 100%)"
      hideModuleInfo={true}
    >
      <Box className="drug-information-center" sx={{ width: '100%' }}>
        <Paper
          elevation={3}
          sx={{
            p: 3,
            borderRadius: '12px',
            background:
              theme.palette.mode === 'dark'
                ? 'linear-gradient(to bottom, #1e293b, #0f172a)'
                : 'linear-gradient(to bottom, #f9f9f9, #ffffff)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              mb: 3,
              fontWeight: 600,
              color: theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
              borderBottom: '2px solid',
              borderBottomColor:
                theme.palette.mode === 'dark' ? '#374151' : '#e0e0e0',
              paddingBottom: 2,
            }}
          >
            Drug Information Center
          </Typography>

          <Box sx={{ mb: 4 }}>
            <DrugSearch onDrugSelect={handleDrugSelect} />
          </Box>

          {searchError && (
            <Alert
              severity="error"
              sx={{
                mb: 4,
                borderRadius: '8px',
              }}
            >
              {searchError}
            </Alert>
          )}

          {selectedDrug ? (
            <>
              <Box
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  mt: 3,
                  backgroundColor:
                    theme.palette.mode === 'dark' ? '#374151' : '#f5f9ff',
                  borderRadius: '8px 8px 0 0',
                  px: 1,
                }}
              >
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    '& .MuiTab-root': {
                      fontWeight: 500,
                      py: 2,
                      minHeight: '48px',
                    },
                    '& .Mui-selected': {
                      color:
                        theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
                      fontWeight: 600,
                    },
                    '& .MuiTabs-indicator': {
                      backgroundColor:
                        theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
                      height: 3,
                    },
                  }}
                >
                  <Tab label="Overview" />
                  <Tab label="Monograph" />
                  <Tab label="Indications" />
                  <Tab label="Interactions" />
                  <Tab label="Adverse Effects" />
                  <Tab label="Formulary" />
                  <Tab label="Therapy Plan" />
                </Tabs>
              </Box>

              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#fff',
                  borderRadius: '0 0 8px 8px',
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.05)',
                }}
              >
                {activeTab === 0 && (
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: '8px',
                      bgcolor:
                        theme.palette.mode === 'dark' ? '#0f172a' : '#f9fbff',
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        mb: 3,
                        fontWeight: 600,
                        color:
                          theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
                      }}
                    >
                      {selectedDrug.name}
                    </Typography>

                    <Box
                      sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}
                    >
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor:
                            theme.palette.mode === 'dark'
                              ? '#374151'
                              : '#f0f7ff',
                          borderRadius: '8px',
                          flex: '1 1 45%',
                          minWidth: '250px',
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          color="text.secondary"
                          gutterBottom
                        >
                          Drug Identifier (RxCUI)
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {selectedDrug.rxCui}
                        </Typography>
                      </Paper>
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor:
                            theme.palette.mode === 'dark'
                              ? '#374151'
                              : '#f0f7ff',
                          borderRadius: '8px',
                          flex: '1 1 45%',
                          minWidth: '250px',
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          color="text.secondary"
                          gutterBottom
                        >
                          Available Information
                        </Typography>
                        <Typography variant="body1">
                          Monograph, Interactions, Side Effects, Alternatives
                        </Typography>
                      </Paper>
                    </Box>

                    <Alert
                      severity="info"
                      icon={<InfoIcon />}
                      sx={{ borderRadius: '8px', fontSize: '1rem' }}
                    >
                      Select the tabs above to view detailed drug information
                      and clinical data
                    </Alert>
                  </Box>
                )}

                {activeTab === 1 && <DrugDetails drugId={selectedDrug.rxCui} />}
                {activeTab === 2 && (
                  <DrugIndications
                    drugId={selectedDrug.rxCui}
                    drugName={selectedDrug.name}
                  />
                )}
                {activeTab === 3 && (
                  <DrugInteractions
                    rxcui={selectedDrug.rxCui}
                    drugName={selectedDrug.name}
                  />
                )}
                {activeTab === 4 && (
                  <AdverseEffects
                    drugId={selectedDrug.rxCui}
                    drugName={selectedDrug.name}
                  />
                )}
                {activeTab === 5 && (
                  <Formulary
                    drugId={selectedDrug.rxCui}
                    drugName={selectedDrug.name}
                  />
                )}
                {activeTab === 6 && <TherapyPlanManager />}
              </Box>
            </>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '300px',
                bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f9fbff',
                borderRadius: '8px',
                p: 4,
              }}
            >
              <MenuBookIcon
                sx={{
                  fontSize: '4rem',
                  color: theme.palette.mode === 'dark' ? '#87CEEB' : '#0047AB',
                  opacity: 0.6,
                  mb: 2,
                }}
              />
              <Typography
                variant="h6"
                align="center"
                color="text.secondary"
                sx={{ maxWidth: '500px', mb: 2 }}
              >
                Search for a drug above to view detailed clinical information,
                interactions, and formulary data
              </Typography>
              <Typography
                variant="body2"
                align="center"
                color="text.secondary"
                sx={{ maxWidth: '600px' }}
              >
                Access comprehensive monographs, check drug interactions, review
                adverse effects, find therapeutic alternatives, and create
                therapy plans all in one place.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </ModulePage>
  );
};

export default DrugInformationCenter;
