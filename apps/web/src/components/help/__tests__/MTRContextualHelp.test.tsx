import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';
import {
  QuickReference,
  KeyboardShortcuts,
  StatusIndicators,
  StepHelp,
  getHelpContentForStep,
  getKeyboardShortcuts,
  getProblemSeverityInfo,
} from '../MTRContextualHelp';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('QuickReference', () => {
  it('renders quick reference for valid step', () => {
    render(
      <TestWrapper>
        <QuickReference step={1} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Patient Selection - Quick Tips')
    ).toBeInTheDocument();
    expect(screen.getByText('Best Practices:')).toBeInTheDocument();
  });

  it('renders content for step 2', () => {
    render(
      <TestWrapper>
        <QuickReference step={2} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Medication History - Quick Tips')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Collect comprehensive medication information/)
    ).toBeInTheDocument();
  });

  it('renders content for step 3', () => {
    render(
      <TestWrapper>
        <QuickReference step={3} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Therapy Assessment - Quick Tips')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/systematically assess the medication regimen/)
    ).toBeInTheDocument();
  });

  it('renders content for step 4', () => {
    render(
      <TestWrapper>
        <QuickReference step={4} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Plan Development - Quick Tips')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/evidence-based recommendations/)
    ).toBeInTheDocument();
  });

  it('renders content for step 5', () => {
    render(
      <TestWrapper>
        <QuickReference step={5} />
      </TestWrapper>
    );

    expect(screen.getByText('Interventions - Quick Tips')).toBeInTheDocument();
    expect(
      screen.getByText(/Document all pharmacist actions/)
    ).toBeInTheDocument();
  });

  it('renders content for step 6', () => {
    render(
      <TestWrapper>
        <QuickReference step={6} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Follow-Up & Monitoring - Quick Tips')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/appropriate follow-up activities/)
    ).toBeInTheDocument();
  });

  it('returns null for invalid step', () => {
    const { container } = render(
      <TestWrapper>
        <QuickReference step={99} />
      </TestWrapper>
    );

    expect(container.firstChild).toBeNull();
  });

  it('displays all tips for a step', () => {
    render(
      <TestWrapper>
        <QuickReference step={1} />
      </TestWrapper>
    );

    // Check that multiple tips are displayed
    expect(
      screen.getByText(/Use search filters to find high-priority patients/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Check for existing active MTR sessions/)
    ).toBeInTheDocument();
  });
});

describe('KeyboardShortcuts', () => {
  it('renders keyboard shortcuts section', () => {
    render(
      <TestWrapper>
        <KeyboardShortcuts />
      </TestWrapper>
    );

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('displays all keyboard shortcuts', () => {
    render(
      <TestWrapper>
        <KeyboardShortcuts />
      </TestWrapper>
    );

    expect(screen.getByText('Ctrl + S')).toBeInTheDocument();
    expect(screen.getByText('Save current progress')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + N')).toBeInTheDocument();
    expect(screen.getByText('Start new MTR session')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + F')).toBeInTheDocument();
    expect(screen.getByText('Search patients/medications')).toBeInTheDocument();
  });

  it('displays navigation shortcuts', () => {
    render(
      <TestWrapper>
        <KeyboardShortcuts />
      </TestWrapper>
    );

    expect(screen.getByText('Tab')).toBeInTheDocument();
    expect(screen.getByText('Navigate between fields')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
    expect(
      screen.getByText('Close dialogs/cancel actions')
    ).toBeInTheDocument();
  });
});

describe('StatusIndicators', () => {
  it('renders status indicators section', () => {
    render(
      <TestWrapper>
        <StatusIndicators />
      </TestWrapper>
    );

    expect(screen.getByText('Status Indicators')).toBeInTheDocument();
  });

  it('displays MTR session status indicators', () => {
    render(
      <TestWrapper>
        <StatusIndicators />
      </TestWrapper>
    );

    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(
      screen.getByText('MTR session is active and incomplete')
    ).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(
      screen.getByText('MTR session has been finished')
    ).toBeInTheDocument();
  });

  it('displays problem severity indicators', () => {
    render(
      <TestWrapper>
        <StatusIndicators />
      </TestWrapper>
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(
      screen.getByText('Immediate intervention required')
    ).toBeInTheDocument();
    expect(screen.getByText('Major')).toBeInTheDocument();
    expect(
      screen.getByText('Significant clinical concern')
    ).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
  });

  it('uses correct chip colors for status indicators', () => {
    render(
      <TestWrapper>
        <StatusIndicators />
      </TestWrapper>
    );

    // Check that status indicators are rendered
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Major')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
  });
});

describe('StepHelp constant', () => {
  it('contains help information for all 6 steps', () => {
    expect(Object.keys(StepHelp)).toHaveLength(6);
    expect(StepHelp[1]).toBeDefined();
    expect(StepHelp[2]).toBeDefined();
    expect(StepHelp[3]).toBeDefined();
    expect(StepHelp[4]).toBeDefined();
    expect(StepHelp[5]).toBeDefined();
    expect(StepHelp[6]).toBeDefined();
  });

  it('has required properties for each step', () => {
    Object.values(StepHelp).forEach((step) => {
      expect(step).toHaveProperty('title');
      expect(step).toHaveProperty('content');
      expect(step).toHaveProperty('tips');
      expect(Array.isArray(step.tips)).toBe(true);
    });
  });

  it('contains appropriate content for patient selection step', () => {
    const step1 = StepHelp[1];
    expect(step1.title).toBe('Patient Selection');
    expect(step1.content).toContain(
      'appropriate patient for medication therapy review'
    );
    expect(step1.tips).toContain(
      'Use search filters to find high-priority patients'
    );
  });

  it('contains appropriate content for medication history step', () => {
    const step2 = StepHelp[2];
    expect(step2.title).toBe('Medication History');
    expect(step2.content).toContain('comprehensive medication information');
    expect(step2.tips).toContain('Include ALL medications the patient takes');
  });
});

describe('Utility Functions', () => {
  describe('getHelpContentForStep', () => {
    it('returns correct content for valid steps', () => {
      expect(getHelpContentForStep(1)).toContain(
        'Select an appropriate patient'
      );
      expect(getHelpContentForStep(2)).toContain(
        'Collect comprehensive medication information'
      );
      expect(getHelpContentForStep(3)).toContain('Review automated alerts');
      expect(getHelpContentForStep(4)).toContain(
        'Create evidence-based recommendations'
      );
      expect(getHelpContentForStep(5)).toContain(
        'Document all pharmacist actions'
      );
      expect(getHelpContentForStep(6)).toContain(
        'Schedule appropriate follow-up'
      );
    });

    it('returns default content for invalid steps', () => {
      expect(getHelpContentForStep(0)).toBe(
        'Complete this step to continue with your MTR.'
      );
      expect(getHelpContentForStep(99)).toBe(
        'Complete this step to continue with your MTR.'
      );
      expect(getHelpContentForStep(-1)).toBe(
        'Complete this step to continue with your MTR.'
      );
    });
  });

  describe('getKeyboardShortcuts', () => {
    it('returns object with keyboard shortcuts', () => {
      const shortcuts = getKeyboardShortcuts();
      expect(typeof shortcuts).toBe('object');
      expect(shortcuts['Ctrl + S']).toBe('Save current progress');
      expect(shortcuts['Ctrl + N']).toBe('Start new MTR session');
      expect(shortcuts['Ctrl + F']).toBe('Search patients or medications');
    });

    it('includes all expected shortcuts', () => {
      const shortcuts = getKeyboardShortcuts();
      const expectedShortcuts = [
        'Ctrl + S',
        'Ctrl + N',
        'Ctrl + F',
        'Tab',
        'Enter',
        'Esc',
        'Ctrl + ?',
      ];

      expectedShortcuts.forEach((shortcut) => {
        expect(shortcuts).toHaveProperty(shortcut);
      });
    });
  });

  describe('getProblemSeverityInfo', () => {
    it('returns severity information object', () => {
      const severityInfo = getProblemSeverityInfo();
      expect(typeof severityInfo).toBe('object');
      expect(severityInfo).toHaveProperty('critical');
      expect(severityInfo).toHaveProperty('major');
      expect(severityInfo).toHaveProperty('moderate');
      expect(severityInfo).toHaveProperty('minor');
    });

    it('contains required properties for each severity level', () => {
      const severityInfo = getProblemSeverityInfo();

      Object.values(severityInfo).forEach((level) => {
        expect(level).toHaveProperty('color');
        expect(level).toHaveProperty('description');
        expect(level).toHaveProperty('examples');
        expect(level).toHaveProperty('action');
        expect(Array.isArray(level.examples)).toBe(true);
      });
    });

    it('has correct severity level information', () => {
      const severityInfo = getProblemSeverityInfo();

      expect(severityInfo.critical.color).toBe('error');
      expect(severityInfo.critical.description).toContain(
        'Immediate intervention required'
      );

      expect(severityInfo.major.color).toBe('warning');
      expect(severityInfo.major.description).toContain(
        'Significant clinical risk'
      );

      expect(severityInfo.moderate.color).toBe('info');
      expect(severityInfo.moderate.description).toContain('Monitor closely');

      expect(severityInfo.minor.color).toBe('default');
      expect(severityInfo.minor.description).toContain('Document and monitor');
    });
  });
});
