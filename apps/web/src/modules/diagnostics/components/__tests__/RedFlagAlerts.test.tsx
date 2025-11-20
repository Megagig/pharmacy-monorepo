import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import { expect, describe, it, beforeEach } from 'vitest';
import RedFlagAlerts from '../RedFlagAlerts';
import type { DiagnosticResult } from '../../types';

const theme = createTheme();

const mockRedFlags: DiagnosticResult['redFlags'] = [
  {
    flag: 'Severe hypertension',
    severity: 'high',
    action: 'Monitor blood pressure closely and consider immediate treatment',
  },
  {
    flag: 'Diabetic ketoacidosis risk',
    severity: 'critical',
    action: 'Check ketones immediately and refer if positive',
  },
  {
    flag: 'Mild dehydration',
    severity: 'low',
    action: 'Encourage fluid intake and monitor',
  },
  {
    flag: 'Medication interaction potential',
    severity: 'medium',
    action: 'Review current medications and adjust as needed',
  },
];

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('RedFlagAlerts', () => {
  const mockOnActionClick = vi.fn();

  const defaultProps = {
    redFlags: mockRedFlags,
    onActionClick: mockOnActionClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the red flags header with correct count', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('Clinical Red Flags (4)')).toBeInTheDocument();
    });

    it('displays summary chips correctly', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('1 Critical')).toBeInTheDocument();
      expect(screen.getByText('1 High Risk')).toBeInTheDocument();
      expect(screen.getByText('4 Total Flags')).toBeInTheDocument();
    });

    it('shows immediate attention alert for critical/high flags', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(
        screen.getByText('Immediate Attention Required')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/1 critical finding\(s\) detected/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/1 high-risk condition\(s\) identified/)
      ).toBeInTheDocument();
    });

    it('displays all red flags with correct information', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('Severe hypertension')).toBeInTheDocument();
      expect(
        screen.getByText('Diabetic ketoacidosis risk')
      ).toBeInTheDocument();
      expect(screen.getByText('Mild dehydration')).toBeInTheDocument();
      expect(
        screen.getByText('Medication interaction potential')
      ).toBeInTheDocument();
    });

    it('sorts flags by severity (critical first)', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      const flagElements = screen
        .getAllByText(/.*/)
        .filter(
          (el) =>
            el.textContent?.includes('Diabetic ketoacidosis risk') ||
            el.textContent?.includes('Severe hypertension') ||
            el.textContent?.includes('Medication interaction potential') ||
            el.textContent?.includes('Mild dehydration')
        );

      // Critical should come first
      expect(flagElements[0]).toHaveTextContent('Diabetic ketoacidosis risk');
    });
  });

  describe('Severity Configuration', () => {
    it('displays critical severity correctly', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('displays high severity correctly', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });

    it('displays medium severity correctly', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    });

    it('displays low severity correctly', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });
  });

  describe('Flag Expansion', () => {
    it('allows expanding flag details', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      // Find and click expand button for first flag
      const expandButtons = screen.getAllByRole('button', {
        name: /expand details/i,
      });
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Recommended Action')).toBeInTheDocument();
        expect(
          screen.getByText('Check ketones immediately and refer if positive')
        ).toBeInTheDocument();
      });
    });

    it('allows collapsing expanded flag details', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      // Expand first
      const expandButtons = screen.getAllByRole('button', {
        name: /expand details/i,
      });
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Recommended Action')).toBeInTheDocument();
      });

      // Then collapse
      const collapseButton = screen.getByRole('button', {
        name: /collapse details/i,
      });
      await user.click(collapseButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Recommended Action')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Flag Visibility', () => {
    it('allows hiding individual flags', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      // Find and click hide button for first flag
      const hideButtons = screen.getAllByRole('button', { name: /hide flag/i });
      await user.click(hideButtons[0]);

      await waitFor(() => {
        expect(
          screen.queryByText('Diabetic ketoacidosis risk')
        ).not.toBeInTheDocument();
        expect(screen.getByText('1 flag(s) hidden')).toBeInTheDocument();
      });
    });

    it('allows showing all hidden flags', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      // Hide a flag first
      const hideButtons = screen.getAllByRole('button', { name: /hide flag/i });
      await user.click(hideButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('1 flag(s) hidden')).toBeInTheDocument();
      });

      // Show all flags
      const showAllButton = screen.getByRole('button', {
        name: /show all flags/i,
      });
      await user.click(showAllButton);

      await waitFor(() => {
        expect(
          screen.getByText('Diabetic ketoacidosis risk')
        ).toBeInTheDocument();
        expect(screen.queryByText('1 flag(s) hidden')).not.toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('shows action buttons when showActions is true', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} showActions={true} />);

      // Expand a critical flag to see action buttons
      const expandButtons = screen.getAllByRole('button', {
        name: /expand details/i,
      });
      await user.click(expandButtons[0]); // Critical flag

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /emergency referral/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /call physician/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /document/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /schedule follow-up/i })
        ).toBeInTheDocument();
      });
    });

    it('hides action buttons when showActions is false', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} showActions={false} />);

      // Expand a flag
      const expandButtons = screen.getAllByRole('button', {
        name: /expand details/i,
      });
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Recommended Action')).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /emergency referral/i })
        ).not.toBeInTheDocument();
      });
    });

    it('calls onActionClick when action buttons are clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      // Expand a critical flag
      const expandButtons = screen.getAllByRole('button', {
        name: /expand details/i,
      });
      await user.click(expandButtons[0]);

      await waitFor(() => {
        const emergencyButton = screen.getByRole('button', {
          name: /emergency referral/i,
        });
        expect(emergencyButton).toBeInTheDocument();
      });

      const emergencyButton = screen.getByRole('button', {
        name: /emergency referral/i,
      });
      await user.click(emergencyButton);

      expect(mockOnActionClick).toHaveBeenCalledWith(
        mockRedFlags[1], // Critical flag (sorted first)
        'emergency_referral'
      );
    });

    it('shows appropriate action buttons based on severity', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      // Expand critical flag
      const expandButtons = screen.getAllByRole('button', {
        name: /expand details/i,
      });
      await user.click(expandButtons[0]); // Critical flag

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /emergency referral/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /call physician/i })
        ).toBeInTheDocument();
      });

      // Collapse and expand a low severity flag
      const collapseButton = screen.getByRole('button', {
        name: /collapse details/i,
      });
      await user.click(collapseButton);

      // Find low severity flag and expand it
      const lowSeverityFlag = screen
        .getByText('Mild dehydration')
        .closest('[data-testid], .MuiPaper-root');
      const expandButton = lowSeverityFlag?.querySelector(
        'button[aria-label*="expand"]'
      );
      if (expandButton) {
        await user.click(expandButton);
      }

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /emergency referral/i })
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /document/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /schedule follow-up/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Emergency Protocols', () => {
    it('shows emergency contact information for critical/high flags', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('Emergency Protocols')).toBeInTheDocument();
      expect(screen.getByText('Emergency Services: 911')).toBeInTheDocument();
      expect(
        screen.getByText('Nearest Emergency Department')
      ).toBeInTheDocument();
      expect(screen.getByText('On-call Physician')).toBeInTheDocument();
    });

    it('does not show emergency protocols for only low/medium flags', () => {
      const lowMediumFlags = mockRedFlags.filter(
        (flag) => flag.severity === 'low' || flag.severity === 'medium'
      );

      renderWithTheme(<RedFlagAlerts redFlags={lowMediumFlags} />);

      expect(screen.queryByText('Emergency Protocols')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('renders nothing when no red flags provided', () => {
      const { container } = renderWithTheme(<RedFlagAlerts redFlags={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('handles flags without optional fields', () => {
      const minimalFlags = [
        {
          flag: 'Simple flag',
          severity: 'medium' as const,
          action: 'Simple action',
        },
      ];

      renderWithTheme(<RedFlagAlerts redFlags={minimalFlags} />);

      expect(screen.getByText('Simple flag')).toBeInTheDocument();
      expect(screen.getByText('Simple action')).toBeInTheDocument();
    });

    it('handles unknown severity levels gracefully', () => {
      const flagsWithUnknownSeverity = [
        {
          flag: 'Unknown severity flag',
          severity: 'unknown' as any,
          action: 'Some action',
        },
      ];

      renderWithTheme(<RedFlagAlerts redFlags={flagsWithUnknownSeverity} />);

      expect(screen.getByText('Unknown severity flag')).toBeInTheDocument();
      // Should default to medium severity styling
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      const expandButtons = screen.getAllByRole('button', {
        name: /expand details/i,
      });
      expect(expandButtons.length).toBeGreaterThan(0);

      const hideButtons = screen.getAllByRole('button', { name: /hide flag/i });
      expect(hideButtons.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      // Tab to first expand button
      await user.tab();
      const firstExpandButton = screen.getAllByRole('button', {
        name: /expand details/i,
      })[0];
      expect(firstExpandButton).toHaveFocus();

      // Press Enter to expand
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Recommended Action')).toBeInTheDocument();
      });
    });

    it('provides meaningful text for screen readers', () => {
      renderWithTheme(<RedFlagAlerts {...defaultProps} />);

      expect(screen.getByText('Clinical Red Flags (4)')).toBeInTheDocument();
      expect(
        screen.getByText('Immediate Attention Required')
      ).toBeInTheDocument();

      // Each flag should have descriptive text
      expect(screen.getByText('Severe hypertension')).toBeInTheDocument();
      expect(
        screen.getByText('Diabetic ketoacidosis risk')
      ).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('applies correct styling based on severity', () => {
      const { container } = renderWithTheme(
        <RedFlagAlerts {...defaultProps} />
      );

      // Critical flags should have error styling
      const criticalFlag = screen
        .getByText('Diabetic ketoacidosis risk')
        .closest('.MuiPaper-root');
      expect(criticalFlag).toBeInTheDocument();

      // Should have error border color
      const styles = window.getComputedStyle(criticalFlag!);
      expect(styles.borderColor).toBeTruthy();
    });

    it('shows elevated styling for critical flags', () => {
      const { container } = renderWithTheme(
        <RedFlagAlerts {...defaultProps} />
      );

      const criticalFlag = screen
        .getByText('Diabetic ketoacidosis risk')
        .closest('.MuiPaper-root');
      expect(criticalFlag).toBeInTheDocument();

      // Critical flags should have higher elevation
      expect(criticalFlag).toHaveClass('MuiPaper-elevation3');
    });
  });
});
