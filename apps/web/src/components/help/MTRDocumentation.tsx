import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

interface MTRDocumentationProps {
  section?:
    | 'overview'
    | 'workflow'
    | 'best-practices'
    | 'troubleshooting'
    | 'reference';
}

export const MTRDocumentation: React.FC<MTRDocumentationProps> = ({
  section = 'overview',
}) => {
  const [expandedSection, setExpandedSection] = useState<string>(section);

  const handleSectionChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedSection(isExpanded ? panel : '');
    };

  const workflowSteps = [
    {
      number: 1,
      title: 'Patient Selection',
      description: 'Identify and select appropriate patients for MTR',
      icon: <PlayArrowIcon color="primary" />,
      keyPoints: [
        'Search patients by name, ID, or demographics',
        'Filter by medication count, conditions, or risk factors',
        'Check for existing active MTR sessions',
        'Verify patient information and contact details',
      ],
      timeEstimate: '5-10 minutes',
    },
    {
      number: 2,
      title: 'Medication History Collection',
      description: 'Gather comprehensive medication information',
      icon: <AssignmentIcon color="primary" />,
      keyPoints: [
        'Include ALL medications: Rx, OTC, herbal, supplements',
        'Verify dosages, frequencies, and directions',
        'Document start dates and indications',
        'Check for recently discontinued medications',
      ],
      timeEstimate: '10-15 minutes',
    },
    {
      number: 3,
      title: 'Therapy Assessment',
      description: 'Identify drug-related problems and assess therapy',
      icon: <AssessmentIcon color="primary" />,
      keyPoints: [
        'Review automated interaction and contraindication alerts',
        'Assess clinical significance of identified problems',
        'Evaluate therapy appropriateness and effectiveness',
        'Consider patient-specific risk factors',
      ],
      timeEstimate: '15-20 minutes',
    },
    {
      number: 4,
      title: 'Plan Development',
      description: 'Create evidence-based therapy recommendations',
      icon: <CheckCircleIcon color="primary" />,
      keyPoints: [
        'Prioritize problems by clinical significance',
        'Develop specific, actionable recommendations',
        'Include monitoring parameters and goals',
        'Base recommendations on current evidence',
      ],
      timeEstimate: '10-15 minutes',
    },
    {
      number: 5,
      title: 'Interventions & Documentation',
      description: 'Record actions and track outcomes',
      icon: <InfoIcon color="primary" />,
      keyPoints: [
        'Document all pharmacist communications',
        'Track recommendation acceptance and implementation',
        'Record patient counseling and education',
        'Note any barriers or challenges encountered',
      ],
      timeEstimate: '10-15 minutes',
    },
    {
      number: 6,
      title: 'Follow-Up & Monitoring',
      description: 'Schedule ongoing care and monitoring',
      icon: <ScheduleIcon color="primary" />,
      keyPoints: [
        'Set appropriate follow-up intervals',
        'Schedule monitoring activities and reminders',
        'Plan next MTR session if needed',
        'Ensure continuity of care',
      ],
      timeEstimate: '5-10 minutes',
    },
  ];

  const problemSeverityLevels = [
    {
      level: 'Critical',
      color: 'error' as const,
      description: 'Immediate intervention required',
      examples: [
        'Life-threatening interactions',
        'Contraindicated combinations',
        'Severe allergic reactions',
      ],
      action: 'Contact prescriber immediately, document urgently',
    },
    {
      level: 'Major',
      color: 'warning' as const,
      description: 'Significant clinical risk',
      examples: [
        'Major drug interactions',
        'Inappropriate dosing',
        'Therapeutic duplications',
      ],
      action: 'Recommend intervention within 24-48 hours',
    },
    {
      level: 'Moderate',
      color: 'info' as const,
      description: 'Monitor closely and consider intervention',
      examples: [
        'Moderate interactions',
        'Suboptimal therapy',
        'Adherence concerns',
      ],
      action: 'Monitor and intervene as appropriate',
    },
    {
      level: 'Minor',
      color: 'default' as const,
      description: 'Document and monitor',
      examples: [
        'Minor interactions',
        'Counseling opportunities',
        'Optimization potential',
      ],
      action: 'Document findings and monitor trends',
    },
  ];

  const bestPractices = [
    {
      category: 'Preparation',
      practices: [
        'Review patient records before starting MTR session',
        'Gather all necessary resources and references',
        'Set aside adequate uninterrupted time',
        'Ensure access to drug information databases',
      ],
    },
    {
      category: 'Documentation',
      practices: [
        'Use clear, professional language',
        'Include specific details and rationale',
        'Document all communications and outcomes',
        'Maintain complete audit trail',
      ],
    },
    {
      category: 'Clinical Assessment',
      practices: [
        'Consider patient-specific factors (age, kidney/liver function)',
        'Evaluate therapy duration and appropriateness',
        'Assess both effectiveness and safety',
        'Use evidence-based clinical guidelines',
      ],
    },
    {
      category: 'Communication',
      practices: [
        'Use patient-friendly language for counseling',
        'Provide written summaries when appropriate',
        'Follow up on all recommendations',
        'Maintain professional relationships with prescribers',
      ],
    },
  ];

  const troubleshootingGuide = [
    {
      issue: 'Patient not found in system',
      solutions: [
        'Verify spelling and try alternate search terms',
        'Check if patient is registered in the system',
        'Use partial name or phone number search',
        'Contact system administrator if patient should exist',
      ],
    },
    {
      issue: 'Medication not found in database',
      solutions: [
        'Try generic name instead of brand name',
        'Check spelling and dosage form',
        'Use partial drug name search',
        'Add as custom entry if necessary',
      ],
    },
    {
      issue: 'Too many interaction alerts',
      solutions: [
        'Focus on clinically significant interactions',
        'Adjust alert sensitivity settings',
        'Review patient-specific risk factors',
        'Consult clinical references for guidance',
      ],
    },
    {
      issue: 'System running slowly',
      solutions: [
        'Check internet connection stability',
        'Clear browser cache and cookies',
        'Close unnecessary browser tabs',
        'Contact IT support if issues persist',
      ],
    },
    {
      issue: 'Data not saving properly',
      solutions: [
        'Check network connection',
        'Try manual save (Ctrl+S)',
        'Refresh page and re-enter data',
        'Contact technical support',
      ],
    },
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom color="primary">
        MTR Documentation & Help
      </Typography>

      <Typography variant="body1" paragraph>
        Comprehensive guide to using the Medication Therapy Review (MTR) module
        effectively. This documentation covers the complete workflow, best
        practices, and troubleshooting guidance.
      </Typography>

      {/* Overview Section */}
      <Accordion
        expanded={expandedSection === 'overview'}
        onChange={handleSectionChange('overview')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">MTR Overview & Benefits</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    What is MTR?
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Medication Therapy Review is a systematic process where
                    pharmacists evaluate a patient's complete medication regimen
                    to identify drug-related problems and optimize therapy
                    outcomes.
                  </Typography>
                  <Typography variant="body2">
                    The MTR process follows a structured 6-step workflow to
                    ensure comprehensive assessment and documentation for
                    regulatory compliance.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Key Benefits
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Improved patient safety and outcomes" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Systematic problem identification" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Evidence-based recommendations" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Complete audit trail and compliance" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Workflow Section */}
      <Accordion
        expanded={expandedSection === 'workflow'}
        onChange={handleSectionChange('workflow')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">6-Step MTR Workflow</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Total Time Estimate:</strong> 60-90 minutes for a complete
              MTR session
            </Typography>
          </Alert>

          {workflowSteps.map((step) => (
            <Card key={step.number} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      mr: 2,
                    }}
                  >
                    {step.number}
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{step.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                  </Box>
                  <Chip label={step.timeEstimate} size="small" />
                </Box>

                <List dense>
                  {step.keyPoints.map((point, pointIndex) => (
                    <ListItem key={pointIndex}>
                      <ListItemIcon>
                        <CheckCircleIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={point} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Problem Severity Reference */}
      <Accordion
        expanded={expandedSection === 'reference'}
        onChange={handleSectionChange('reference')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Problem Severity Reference</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Severity Level</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Description</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Examples</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Recommended Action</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {problemSeverityLevels.map((level) => (
                  <TableRow key={level.level}>
                    <TableCell>
                      <Chip label={level.level} color={level.color} />
                    </TableCell>
                    <TableCell>{level.description}</TableCell>
                    <TableCell>
                      <List dense>
                        {level.examples.map((example, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <Typography variant="body2">• {example}</Typography>
                          </ListItem>
                        ))}
                      </List>
                    </TableCell>
                    <TableCell>{level.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Best Practices Section */}
      <Accordion
        expanded={expandedSection === 'best-practices'}
        onChange={handleSectionChange('best-practices')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Best Practices & Guidelines</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {bestPractices.map((category, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      {category.category}
                    </Typography>
                    <List dense>
                      {category.practices.map((practice, practiceIndex) => (
                        <ListItem key={practiceIndex}>
                          <ListItemIcon>
                            <CheckCircleIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={practice}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Troubleshooting Section */}
      <Accordion
        expanded={expandedSection === 'troubleshooting'}
        onChange={handleSectionChange('troubleshooting')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Troubleshooting Guide</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {troubleshootingGuide.map((item, index) => (
            <Card key={index} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <WarningIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">{item.issue}</Typography>
                </Box>
                <Typography variant="subtitle2" gutterBottom>
                  Solutions:
                </Typography>
                <List dense>
                  {item.solutions.map((solution, solutionIndex) => (
                    <ListItem key={solutionIndex}>
                      <ListItemIcon>
                        <CheckCircleIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={solution}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          ))}

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Need Additional Help?</strong>
              <br />
              • Contact your system administrator for technical issues
              <br />
              • Consult with senior pharmacists for clinical questions
              <br />• Access additional training materials or request refresher
              sessions
            </Typography>
          </Alert>
        </AccordionDetails>
      </Accordion>

      {/* Quick Reference Card */}
      <Card sx={{ mt: 3, bgcolor: 'primary.light' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary.contrastText">
            Quick Reference - Keyboard Shortcuts
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="primary.contrastText">
                <strong>Ctrl + S:</strong> Save progress
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="primary.contrastText">
                <strong>Ctrl + N:</strong> New MTR session
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="primary.contrastText">
                <strong>Ctrl + F:</strong> Search function
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="primary.contrastText">
                <strong>Ctrl + ?:</strong> Show help
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MTRDocumentation;
