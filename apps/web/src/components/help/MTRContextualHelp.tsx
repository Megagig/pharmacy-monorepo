import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { MTRTooltip } from './MTRHelpSystem';

// Contextual help content for different MTR components
export const MTRContextualHelp = {
  // Patient Selection Help
  PatientSearch: () => (
    <MTRTooltip
      title="Patient Search"
      content="Search by patient name, ID, or phone number. Use filters to find patients who would benefit most from MTR (multiple medications, chronic conditions, recent changes)."
      placement="bottom"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  PatientFilters: () => (
    <MTRTooltip
      title="Patient Filters"
      content="Filter patients by medication count (5+ drugs), last MTR date, active conditions, or high-risk indicators to prioritize candidates for review."
      placement="right"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  // Medication History Help
  MedicationCategories: () => (
    <MTRTooltip
      title="Medication Categories"
      content="Include ALL medications: Prescriptions, Over-the-counter drugs, Herbal supplements, Vitamins, and any other substances the patient takes regularly."
      placement="top"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  MedicationAutocomplete: () => (
    <MTRTooltip
      title="Medication Search"
      content="Start typing drug name (brand or generic). The system will suggest matches from the drug database. Select the correct medication and strength."
      placement="bottom"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  DuplicateDetection: () => (
    <MTRTooltip
      title="Duplicate Detection"
      content="The system automatically identifies potential duplicate therapies or therapeutic equivalents. Review these carefully to avoid redundant treatments."
      placement="left"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  // Therapy Assessment Help
  InteractionAlerts: () => (
    <MTRTooltip
      title="Drug Interaction Alerts"
      content="Automated screening identifies potential interactions. Review severity levels: Critical (immediate action), Major (significant risk), Moderate (monitor closely), Minor (awareness needed)."
      placement="top"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  SeverityLevels: () => (
    <MTRTooltip
      title="Problem Severity"
      content="Critical: Immediate intervention required. Major: Significant clinical risk. Moderate: Monitor and consider intervention. Minor: Document and monitor."
      placement="right"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  ClinicalSignificance: () => (
    <MTRTooltip
      title="Clinical Significance"
      content="Assess the real-world impact on this specific patient. Consider age, kidney/liver function, other conditions, and individual risk factors."
      placement="bottom"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  // Plan Development Help
  RecommendationTypes: () => (
    <MTRTooltip
      title="Recommendation Types"
      content="Discontinue: Stop medication. Adjust: Change dose/frequency. Switch: Change to different therapy. Add: Start new medication. Monitor: Increase surveillance."
      placement="left"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  EvidenceBase: () => (
    <MTRTooltip
      title="Evidence-Based Recommendations"
      content="Base recommendations on current clinical guidelines, peer-reviewed literature, and patient-specific factors. Include rationale and supporting evidence."
      placement="top"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  MonitoringParameters: () => (
    <MTRTooltip
      title="Monitoring Parameters"
      content="Specify what to monitor (lab values, symptoms, side effects), frequency of monitoring, and target goals or acceptable ranges."
      placement="right"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  // Interventions Help
  InterventionTypes: () => (
    <MTRTooltip
      title="Intervention Types"
      content="Patient Counseling: Direct education. Provider Communication: Recommendations to prescribers. Monitoring: Lab/clinical follow-up. Care Coordination: Team communication."
      placement="bottom"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  CommunicationMethods: () => (
    <MTRTooltip
      title="Communication Methods"
      content="Document how you communicated: In-person, Phone call, Written note, Email, Fax. This is important for audit trails and follow-up."
      placement="left"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  OutcomeTracking: () => (
    <MTRTooltip
      title="Outcome Tracking"
      content="Record whether recommendations were Accepted, Rejected, Modified, or are still Pending. Include details about implementation and any barriers encountered."
      placement="top"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  // Follow-up Help
  FollowUpTypes: () => (
    <MTRTooltip
      title="Follow-up Types"
      content="Phone Call: Check progress/adherence. Appointment: In-person assessment. Lab Review: Monitor therapy effectiveness. Adherence Check: Assess compliance."
      placement="right"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  FollowUpTiming: () => (
    <MTRTooltip
      title="Follow-up Timing"
      content="Critical interventions: 24-48 hours. Major interventions: 1-2 weeks. Moderate: 2-4 weeks. Minor: 1-3 months. Adjust based on patient needs."
      placement="bottom"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),

  ReminderSettings: () => (
    <MTRTooltip
      title="Reminder Settings"
      content="Set automatic reminders for follow-up activities. Choose notification method (email, SMS, system alert) and timing (1 day before, day of, etc.)."
      placement="left"
    >
      <Box component="span">?</Box>
    </MTRTooltip>
  ),
};

// Help content for specific workflow steps
export const StepHelp = {
  1: {
    title: 'Patient Selection',
    content:
      'Select an appropriate patient for medication therapy review. Look for patients with multiple medications, chronic conditions, or recent medication changes.',
    tips: [
      'Use search filters to find high-priority patients',
      'Check for existing active MTR sessions',
      'Consider patient complexity and risk factors',
      'Verify patient demographics and contact information',
    ],
  },
  2: {
    title: 'Medication History',
    content:
      'Collect comprehensive medication information including all prescriptions, OTC medications, herbal supplements, and vitamins.',
    tips: [
      'Include ALL medications the patient takes',
      'Verify dosages and directions carefully',
      'Ask about PRN (as-needed) medications',
      'Check for recently discontinued medications',
      'Use autocomplete to ensure accurate drug names',
    ],
  },
  3: {
    title: 'Therapy Assessment',
    content:
      'Review automated alerts and systematically assess the medication regimen for drug-related problems.',
    tips: [
      'Review all interaction alerts carefully',
      'Consider patient-specific risk factors',
      'Assess clinical significance of each problem',
      "Don't ignore minor issues that could compound",
      'Document rationale for clinical decisions',
    ],
  },
  4: {
    title: 'Plan Development',
    content:
      'Create evidence-based recommendations to address identified drug-related problems and optimize therapy outcomes.',
    tips: [
      'Prioritize critical and major problems first',
      'Base recommendations on current guidelines',
      'Include specific monitoring parameters',
      'Set realistic and measurable goals',
      'Consider patient preferences and barriers',
    ],
  },
  5: {
    title: 'Interventions',
    content:
      'Document all pharmacist actions, communications, and track outcomes of your recommendations.',
    tips: [
      'Record all communications promptly',
      'Use professional language in provider communications',
      'Track acceptance and implementation of recommendations',
      'Document any barriers or challenges encountered',
      'Schedule appropriate follow-up activities',
    ],
  },
  6: {
    title: 'Follow-Up & Monitoring',
    content:
      'Schedule appropriate follow-up activities to ensure continuity of care and monitor therapy outcomes.',
    tips: [
      'Set follow-up intervals based on intervention urgency',
      'Use multiple reminder methods for critical follow-ups',
      'Monitor both effectiveness and safety parameters',
      'Document all follow-up activities and outcomes',
      'Plan next MTR session if appropriate',
    ],
  },
};

// Quick reference component
interface QuickReferenceProps {
  step: number;
}

export const QuickReference: React.FC<QuickReferenceProps> = ({ step }) => {
  const stepInfo = StepHelp[step as keyof typeof StepHelp];

  if (!stepInfo) return null;

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="h6" gutterBottom color="primary">
        {stepInfo.title} - Quick Tips
      </Typography>
      <Typography variant="body2" paragraph>
        {stepInfo.content}
      </Typography>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Best Practices:
        </Typography>
        {stepInfo.tips.map((tip, index) => (
          <Box
            key={index}
            sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}
          >
            <Typography variant="body2" sx={{ mr: 1 }}>
              •
            </Typography>
            <Typography variant="body2">{tip}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Keyboard shortcuts help
export const KeyboardShortcuts = () => (
  <Box sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      Keyboard Shortcuts
    </Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 1 }}>
      <Typography variant="body2">
        <strong>Ctrl + S</strong>
      </Typography>
      <Typography variant="body2">Save current progress</Typography>

      <Typography variant="body2">
        <strong>Ctrl + N</strong>
      </Typography>
      <Typography variant="body2">Start new MTR session</Typography>

      <Typography variant="body2">
        <strong>Ctrl + F</strong>
      </Typography>
      <Typography variant="body2">Search patients/medications</Typography>

      <Typography variant="body2">
        <strong>Tab</strong>
      </Typography>
      <Typography variant="body2">Navigate between fields</Typography>

      <Typography variant="body2">
        <strong>Enter</strong>
      </Typography>
      <Typography variant="body2">Submit forms/confirm actions</Typography>

      <Typography variant="body2">
        <strong>Esc</strong>
      </Typography>
      <Typography variant="body2">Close dialogs/cancel actions</Typography>

      <Typography variant="body2">
        <strong>Ctrl + ?</strong>
      </Typography>
      <Typography variant="body2">Show help system</Typography>
    </Box>
  </Box>
);

// Status indicators help
export const StatusIndicators = () => (
  <Box sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      Status Indicators
    </Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label="In Progress" color="warning" size="small" />
        <Typography variant="body2">
          MTR session is active and incomplete
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label="Completed" color="success" size="small" />
        <Typography variant="body2">MTR session has been finished</Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label="On Hold" color="default" size="small" />
        <Typography variant="body2">
          MTR session is paused pending information
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label="Critical" color="error" size="small" />
        <Typography variant="body2">Immediate intervention required</Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label="Major" color="warning" size="small" />
        <Typography variant="body2">Significant clinical concern</Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label="Moderate" color="info" size="small" />
        <Typography variant="body2">
          Monitor and consider intervention
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip label="Minor" color="default" size="small" />
        <Typography variant="body2">Document and monitor</Typography>
      </Box>
    </Box>
  </Box>
);

// Utility functions for help system
export const getHelpContentForStep = (step: number): string => {
  const stepContent = {
    1: 'Select an appropriate patient for medication therapy review.',
    2: 'Collect comprehensive medication information including all prescriptions, OTC medications, and supplements.',
    3: 'Review automated alerts and identify drug-related problems systematically.',
    4: 'Create evidence-based recommendations to address identified problems.',
    5: 'Document all pharmacist actions and track intervention outcomes.',
    6: 'Schedule appropriate follow-up activities and monitoring.',
  };

  return (
    stepContent[step as keyof typeof stepContent] ||
    'Complete this step to continue with your MTR.'
  );
};

export const getKeyboardShortcuts = () => ({
  'Ctrl + S': 'Save current progress',
  'Ctrl + N': 'Start new MTR session',
  'Ctrl + F': 'Search patients or medications',
  Tab: 'Navigate between form fields',
  Enter: 'Submit forms or confirm actions',
  Esc: 'Close dialogs or cancel actions',
  'Ctrl + ?': 'Show help system',
});

export const getProblemSeverityInfo = () => ({
  critical: {
    color: 'error',
    description: 'Immediate intervention required',
    examples: ['Life-threatening interactions', 'Contraindicated combinations'],
    action: 'Contact prescriber immediately',
  },
  major: {
    color: 'warning',
    description: 'Significant clinical risk',
    examples: ['Major drug interactions', 'Inappropriate dosing'],
    action: 'Recommend intervention within 24-48 hours',
  },
  moderate: {
    color: 'info',
    description: 'Monitor closely and consider intervention',
    examples: ['Moderate interactions', 'Suboptimal therapy'],
    action: 'Monitor and intervene as appropriate',
  },
  minor: {
    color: 'default',
    description: 'Document and monitor',
    examples: ['Minor interactions', 'Counseling opportunities'],
    action: 'Document findings and monitor trends',
  },
});

export default MTRContextualHelp;
