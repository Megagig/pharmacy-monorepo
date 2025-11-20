import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Help,
  ExpandMore,
  Close,
  Info,
  Warning,
  CheckCircle,
} from '@mui/icons-material';

interface MTRHelpSystemProps {
  currentStep?: number;
}

const MTRHelpSystem: React.FC<MTRHelpSystemProps> = ({ currentStep = 0 }) => {
  const [open, setOpen] = useState(false);

  const helpContent = [
    {
      step: 'Patient Selection',
      icon: <Info color="primary" />,
      description: 'Select the patient for whom you want to conduct the MTR',
      tips: [
        'Ensure you have the correct patient selected',
        'Verify patient demographics and contact information',
        'Check for any existing MTRs for this patient',
      ],
      warnings: [
        'Double-check patient identity before proceeding',
        'Ensure patient consent for the MTR process',
      ],
    },
    {
      step: 'Medication History',
      icon: <Warning color="warning" />,
      description: 'Document all current medications, including prescription, OTC, and supplements',
      tips: [
        'Include all medications the patient is currently taking',
        'Ask about herbal supplements and vitamins',
        'Verify dosages and frequencies with the patient',
        'Note any recent medication changes',
      ],
      warnings: [
        'Incomplete medication history can lead to missed drug therapy problems',
        'Always verify medication names and strengths',
      ],
    },
    {
      step: 'Therapy Assessment',
      icon: <CheckCircle color="success" />,
      description: 'Identify and document drug therapy problems',
      tips: [
        'Look for drug interactions, duplications, and contraindications',
        'Assess appropriateness of therapy for patient conditions',
        'Check for adherence issues',
        'Evaluate dosing appropriateness',
      ],
      warnings: [
        'Consider patient-specific factors (age, kidney function, etc.)',
        'Use clinical judgment when assessing severity',
      ],
    },
    {
      step: 'Plan Development',
      icon: <Info color="primary" />,
      description: 'Create a comprehensive therapy plan with recommendations',
      tips: [
        'Prioritize problems by clinical significance',
        'Provide specific, actionable recommendations',
        'Include monitoring parameters where appropriate',
        'Set realistic therapy goals',
      ],
      warnings: [
        'Ensure recommendations are evidence-based',
        'Consider patient preferences and lifestyle',
      ],
    },
    {
      step: 'Interventions',
      icon: <Warning color="warning" />,
      description: 'Document interventions performed during the MTR',
      tips: [
        'Record all communications with patients and providers',
        'Document patient education provided',
        'Note any immediate actions taken',
        'Include follow-up requirements',
      ],
      warnings: [
        'Ensure all interventions are properly documented',
        'Follow up on critical interventions promptly',
      ],
    },
    {
      step: 'Follow-Up',
      icon: <CheckCircle color="success" />,
      description: 'Schedule and plan follow-up activities',
      tips: [
        'Schedule appropriate follow-up timeframes',
        'Define clear objectives for follow-up',
        'Assign responsibility for follow-up tasks',
        'Set reminders for follow-up activities',
      ],
      warnings: [
        'Ensure critical follow-ups are not missed',
        'Document follow-up plans clearly',
      ],
    },
  ];

  const currentStepHelp = helpContent[currentStep] || helpContent[0];

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': {
            bgcolor: 'primary.dark',
          },
        }}
      >
        <Help />
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">MTR Help & Guidance</Typography>
            <IconButton onClick={() => setOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {/* Current Step Help */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              {currentStepHelp.icon}
              <Typography variant="h6" sx={{ ml: 1 }}>
                Current Step: {currentStepHelp.step}
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {currentStepHelp.description}
            </Typography>
            
            {currentStepHelp.tips.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Tips:
                </Typography>
                <List dense>
                  {currentStepHelp.tips.map((tip, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={tip}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            
            {currentStepHelp.warnings.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'warning.main' }}>
                  Important Considerations:
                </Typography>
                <List dense>
                  {currentStepHelp.warnings.map((warning, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={warning}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          color: 'warning.main'
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>

          {/* All Steps Overview */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            MTR Process Overview
          </Typography>
          
          {helpContent.map((content, index) => (
            <Accordion key={index} disabled={false}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {content.icon}
                  <Typography variant="subtitle1">
                    Step {index + 1}: {content.step}
                  </Typography>
                  {index === currentStep && (
                    <Chip label="Current" size="small" color="primary" />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {content.description}
                </Typography>
                
                {content.tips.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Best Practices:
                    </Typography>
                    <List dense>
                      {content.tips.map((tip, tipIndex) => (
                        <ListItem key={tipIndex} sx={{ py: 0.25 }}>
                          <ListItemText
                            primary={tip}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
                
                {content.warnings.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'warning.main' }}>
                      Important Notes:
                    </Typography>
                    <List dense>
                      {content.warnings.map((warning, warningIndex) => (
                        <ListItem key={warningIndex} sx={{ py: 0.25 }}>
                          <ListItemText
                            primary={warning}
                            primaryTypographyProps={{ 
                              variant: 'body2',
                              color: 'warning.main'
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MTRHelpSystem;