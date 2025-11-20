import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  MenuBook,
  Close,
  Warning,
  Info,
  Error,
  CheckCircle,
} from '@mui/icons-material';

interface QuickReferenceProps {
  open?: boolean;
  onClose?: () => void;
}

const QuickReference: React.FC<QuickReferenceProps> = ({ 
  open: controlledOpen, 
  onClose: controlledOnClose 
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onClose = isControlled ? controlledOnClose : () => setInternalOpen(false);

  const handleOpen = () => {
    if (!isControlled) {
      setInternalOpen(true);
    }
  };

  const drugTherapyProblems = [
    {
      category: 'Indication',
      types: [
        { type: 'Unnecessary', description: 'Patient taking medication without valid indication' },
        { type: 'Needs Additional', description: 'Patient has condition requiring therapy but not receiving it' },
      ],
    },
    {
      category: 'Effectiveness',
      types: [
        { type: 'Wrong Drug', description: 'Patient receiving wrong medication for condition' },
        { type: 'Dose Too Low', description: 'Patient receiving subtherapeutic dose' },
      ],
    },
    {
      category: 'Safety',
      types: [
        { type: 'Adverse Reaction', description: 'Patient experiencing adverse drug reaction' },
        { type: 'Dose Too High', description: 'Patient receiving supratherapeutic dose' },
        { type: 'Interaction', description: 'Drug-drug, drug-food, or drug-disease interaction' },
        { type: 'Contraindication', description: 'Medication contraindicated for patient' },
      ],
    },
    {
      category: 'Adherence',
      types: [
        { type: 'Inappropriate Adherence', description: 'Patient not taking medication as prescribed' },
      ],
    },
  ];

  const severityLevels = [
    {
      level: 'Critical',
      color: 'error',
      description: 'Life-threatening or requires immediate intervention',
      examples: ['Severe allergic reaction', 'Dangerous drug interaction', 'Critical overdose'],
    },
    {
      level: 'Major',
      color: 'warning',
      description: 'Significant clinical impact, requires prompt attention',
      examples: ['Therapeutic failure', 'Moderate adverse effects', 'Important drug interaction'],
    },
    {
      level: 'Moderate',
      color: 'info',
      description: 'Moderate clinical impact, should be addressed',
      examples: ['Minor therapeutic issues', 'Mild adverse effects', 'Adherence concerns'],
    },
    {
      level: 'Minor',
      color: 'success',
      description: 'Low clinical impact, may be addressed when convenient',
      examples: ['Optimization opportunities', 'Cost considerations', 'Minor adherence issues'],
    },
  ];

  const interventionTypes = [
    {
      type: 'Recommendation',
      description: 'Suggest changes to therapy',
      examples: ['Dose adjustment', 'Drug substitution', 'Discontinuation'],
    },
    {
      type: 'Counseling',
      description: 'Provide patient education',
      examples: ['Medication administration', 'Side effects', 'Adherence strategies'],
    },
    {
      type: 'Monitoring',
      description: 'Establish monitoring plan',
      examples: ['Lab monitoring', 'Symptom tracking', 'Follow-up schedule'],
    },
    {
      type: 'Communication',
      description: 'Communicate with healthcare providers',
      examples: ['Prescriber notification', 'Care coordination', 'Consultation'],
    },
  ];

  const commonAbbreviations = [
    { abbr: 'MTR', full: 'Medication Therapy Review' },
    { abbr: 'DTP', full: 'Drug Therapy Problem' },
    { abbr: 'ADR', full: 'Adverse Drug Reaction' },
    { abbr: 'DDI', full: 'Drug-Drug Interaction' },
    { abbr: 'OTC', full: 'Over-The-Counter' },
    { abbr: 'PRN', full: 'Pro Re Nata (as needed)' },
    { abbr: 'BID', full: 'Bis In Die (twice daily)' },
    { abbr: 'TID', full: 'Ter In Die (three times daily)' },
    { abbr: 'QID', full: 'Quater In Die (four times daily)' },
    { abbr: 'QD', full: 'Quaque Die (once daily)' },
  ];

  const TabPanel = ({ children, value, index }: any) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <>
      {!isControlled && (
        <IconButton
          onClick={handleOpen}
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 140,
            right: 16,
            bgcolor: 'secondary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'secondary.dark',
            },
          }}
        >
          <MenuBook />
        </IconButton>
      )}

      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">MTR Quick Reference</Typography>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="Drug Therapy Problems" />
            <Tab label="Severity Levels" />
            <Tab label="Interventions" />
            <Tab label="Abbreviations" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Drug Therapy Problem Categories
            </Typography>
            {drugTherapyProblems.map((category) => (
              <Box key={category.category} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  {category.category}
                </Typography>
                <List dense>
                  {category.types.map((type) => (
                    <ListItem key={type.type}>
                      <ListItemText
                        primary={type.type}
                        secondary={type.description}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Problem Severity Levels
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Examples</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {severityLevels.map((level) => (
                    <TableRow key={level.level}>
                      <TableCell>
                        <Chip
                          label={level.level}
                          color={level.color as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{level.description}</TableCell>
                      <TableCell>
                        <List dense>
                          {level.examples.map((example, index) => (
                            <ListItem key={index} sx={{ py: 0 }}>
                              <ListItemText
                                primary={example}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Intervention Types
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Examples</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {interventionTypes.map((intervention) => (
                    <TableRow key={intervention.type}>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {intervention.type}
                        </Typography>
                      </TableCell>
                      <TableCell>{intervention.description}</TableCell>
                      <TableCell>
                        <List dense>
                          {intervention.examples.map((example, index) => (
                            <ListItem key={index} sx={{ py: 0 }}>
                              <ListItemText
                                primary={example}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Common Medical Abbreviations
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Abbreviation</TableCell>
                    <TableCell>Full Form</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {commonAbbreviations.map((item) => (
                    <TableRow key={item.abbr}>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {item.abbr}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.full}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default QuickReference;