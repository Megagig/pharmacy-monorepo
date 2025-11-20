import React from 'react';
import ModulePage from './ModulePage';
import { Reviews as ReviewsIcon } from '@mui/icons-material';
import type { ModuleInfo } from '../types/moduleTypes';

// Example usage of the ModulePage component
const ModulePageExample: React.FC = () => {
  const exampleModuleInfo: ModuleInfo = {
    title: 'Medication Therapy Review',
    purpose:
      'Monitor prescriptions, assess appropriateness, and optimize therapy outcomes for better patient care.',
    workflow: {
      description:
        'A systematic approach to reviewing and optimizing patient medication regimens.',
      steps: [
        'View current medications and patient history',
        'Check for drug interactions and contraindications',
        'Assess therapy appropriateness and effectiveness',
        'Recommend changes or adjustments as needed',
        'Document outcomes and follow-up requirements',
      ],
    },
    keyFeatures: [
      'Comprehensive medication history review',
      'Drug interaction checking and alerts',
      'Therapy optimization recommendations',
      'Clinical decision support tools',
      'Outcome tracking and reporting',
      'Integration with patient records',
      'Pharmacist intervention documentation',
      'Follow-up scheduling and reminders',
    ],
    status: 'placeholder',
    estimatedRelease: 'Q2 2025',
  };

  return (
    <ModulePage
      moduleInfo={exampleModuleInfo}
      icon={ReviewsIcon}
      gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    />
  );
};

export default ModulePageExample;
