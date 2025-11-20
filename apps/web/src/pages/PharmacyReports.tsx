import React from 'react';
import ModulePage from '../components/ModulePage';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import type { ModuleInfo } from '../types/moduleTypes';

const PharmacyReports: React.FC = () => {
  const moduleInfo: ModuleInfo = {
    title: 'Reports & Analytics',
    purpose:
      'Visualize patient outcomes, pharmacist impact, and therapy trends through comprehensive reporting and analytics.',
    workflow: {
      description:
        'Advanced analytics platform providing insights into clinical outcomes, operational efficiency, and quality metrics.',
      steps: [
        'Select desired report type and parameters',
        'Filter data by date range and patient criteria',
        'Generate comprehensive analytics dashboard',
        'Export reports for external use',
        'Schedule automated report delivery',
      ],
    },
    keyFeatures: [
      'Patient outcome analytics',
      'Pharmacist intervention tracking',
      'Therapy effectiveness metrics',
      'Quality improvement dashboards',
      'Regulatory compliance reports',
      'Cost-effectiveness analysis',
      'Trend identification and forecasting',
      'Customizable report templates',
    ],
    status: 'placeholder',
    estimatedRelease: 'Q3 2025',
  };

  return (
    <ModulePage
      moduleInfo={moduleInfo}
      icon={AnalyticsIcon}
      gradient="linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)"
    />
  );
};

export default PharmacyReports;
