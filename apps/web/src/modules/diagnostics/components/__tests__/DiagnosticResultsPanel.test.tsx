import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import { expect, describe, it, beforeEach } from 'vitest';
import DiagnosticResultsPanel from '../DiagnosticResultsPanel';
import type { DiagnosticResult } from '../../types';

const theme = createTheme();

const mockDiagnosticResult: DiagnosticResult = {
  _id: 'result-123',
  requestId: 'request-123',
  diagnoses: [
    {
      condition: 'Hypertension',
      probability: 0.85,
      reasoning:
        'Elevated blood pressure readings and symptoms consistent with hypertension',
      severity: 'medium',
      icdCode: 'I10',
      snomedCode: '38341003',
    },
    {
      condition: 'Type 2 Diabetes',
      probability: 0.65,
      reasoning: 'Elevated glucose levels and risk factors present',
      severity: 'high',
      icdCode: 'E11',
      snomedCode: '44054006',
    },
  ],
  suggestedTests: [
    {
      testName: 'HbA1c',
      priority: 'urgent',
      reasoning: 'To confirm diabetes diagnosis and assess glycemic control',
      loincCode: '4548-4',
    },
    {
      testName: 'Lipid Panel',
      priority: 'routine',
      reasoning: 'Cardiovascular risk assessment',
      loincCode: '24331-1',
    },
  ],
  medicationSuggestions: [
    {
      drugName: 'Metformin',
      dosage: '500mg',
      frequency: 'twice daily',
      duration: 'ongoing',
      reasoning: 'First-line treatment for type 2 diabetes',
      safetyNotes: ['Monitor kidney function', 'Take with food'],
      rxcui: '6809',
    },
    {
      drugName: 'Lisinopril',
      dosage: '10mg',
      frequency: 'once daily',
      duration: 'ongoing',
      reasoning: 'ACE inhibitor for hypertension management',
      safetyNotes: ['Monitor blood pressure', 'Watch for dry cough'],
      rxcui: '29046',
    },
  ],
  redFlags: [
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
  ],
  referralRecommendation: {
    recommended: true,
    urgency: 'within_24h',
    specialty: 'Endocrinology',
    reason: 'Complex diabetes management required',
  },
  aiMetadata: {
    modelId: 'deepseek-v3.1',
    modelVersion: '1.0',
    confidenceScore: 0.78,
    processingTime: 15000,
    tokenUsage: {
      promptTokens: 1200,
      completionTokens: 800,
      totalTokens: 2000,
    },
    requestId: 'ai-request-123',
  },
  disclaimer:
    'This AI analysis is for clinical decision support only and should not replace professional medical judgment.',
  createdAt: '2024-01-15T10:30:00Z',
};

const mockDiagnosticResultWithReview: DiagnosticResult = {
  ...mockDiagnosticResult,
  pharmacistReview: {
    status: 'approved',
    reviewedBy: 'Dr. Jane Smith',
    reviewedAt: '2024-01-15T11:00:00Z',
  },
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('DiagnosticResultsPanel', () => {
  const mockOnApprove = vi.fn();
  const mockOnModify = vi.fn();
  const mockOnReject = vi.fn();

  const defaultProps = {
    result: mockDiagnosticResult,
    onApprove: mockOnApprove,
    onModify: mockOnModify,
    onReject: mockOnReject,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the diagnostic results panel with all sections', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('AI Diagnostic Analysis')).toBeInTheDocument();
      expect(
        screen.getByText('Differential Diagnoses (2)')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Suggested Laboratory Tests (2)')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Medication Suggestions (2)')
      ).toBeInTheDocument();
      expect(screen.getByText('Clinical Red Flags (2)')).toBeInTheDocument();
    });

    it('displays AI metadata correctly', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('deepseek-v3.1')).toBeInTheDocument();
      expect(screen.getByText('15.0s')).toBeInTheDocument();
      expect(screen.getByText('2,000')).toBeInTheDocument();
      expect(screen.getByText('78.0%')).toBeInTheDocument();
    });

    it('shows confidence indicator', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      // Should show confidence indicator with 78% confidence
      expect(screen.getByText('78.0%')).toBeInTheDocument();
    });

    it('displays referral recommendation alert', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(
        screen.getByText('Referral Recommended: Endocrinology')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Complex diabetes management required')
      ).toBeInTheDocument();
    });

    it('shows AI disclaimer', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(
        screen.getByText(
          /This AI analysis is for clinical decision support only/
        )
      ).toBeInTheDocument();
    });
  });

  describe('Diagnoses Section', () => {
    it('displays all diagnoses with correct information', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('Hypertension')).toBeInTheDocument();
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.getByText('ICD: I10')).toBeInTheDocument();
      expect(screen.getByText('ICD: E11')).toBeInTheDocument();
      expect(screen.getByText('SNOMED: 38341003')).toBeInTheDocument();
      expect(screen.getByText('SNOMED: 44054006')).toBeInTheDocument();
    });

    it('shows diagnosis reasoning', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(
        screen.getByText(
          'Elevated blood pressure readings and symptoms consistent with hypertension'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText('Elevated glucose levels and risk factors present')
      ).toBeInTheDocument();
    });

    it('displays severity chips correctly', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });

    it('shows average confidence in header', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      // Average of 0.85 and 0.65 = 0.75 = 75%
      expect(screen.getByText('Avg Confidence: 75.0%')).toBeInTheDocument();
    });
  });

  describe('Suggested Tests Section', () => {
    it('displays all suggested tests', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('HbA1c')).toBeInTheDocument();
      expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      expect(screen.getByText('LOINC: 4548-4')).toBeInTheDocument();
      expect(screen.getByText('LOINC: 24331-1')).toBeInTheDocument();
    });

    it('shows test priorities correctly', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Routine')).toBeInTheDocument();
    });

    it('displays test reasoning', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(
        screen.getByText(
          'To confirm diabetes diagnosis and assess glycemic control'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText('Cardiovascular risk assessment')
      ).toBeInTheDocument();
    });
  });

  describe('Medication Suggestions Section', () => {
    it('displays all medication suggestions', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('RxCUI: 6809')).toBeInTheDocument();
      expect(screen.getByText('RxCUI: 29046')).toBeInTheDocument();
    });

    it('shows medication details correctly', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('500mg')).toBeInTheDocument();
      expect(screen.getByText('twice daily')).toBeInTheDocument();
      expect(screen.getByText('10mg')).toBeInTheDocument();
      expect(screen.getByText('once daily')).toBeInTheDocument();
    });

    it('displays safety notes', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(screen.getByText('Monitor kidney function')).toBeInTheDocument();
      expect(screen.getByText('Take with food')).toBeInTheDocument();
      expect(screen.getByText('Monitor blood pressure')).toBeInTheDocument();
      expect(screen.getByText('Watch for dry cough')).toBeInTheDocument();
    });

    it('shows medication reasoning', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(
        screen.getByText(/First-line treatment for type 2 diabetes/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/ACE inhibitor for hypertension management/)
      ).toBeInTheDocument();
    });
  });

  describe('Red Flags Section', () => {
    it('displays red flag alerts', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      // Red flags should be rendered by RedFlagAlerts component
      expect(screen.getByText('Clinical Red Flags (2)')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows action buttons when not reviewed', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /approve/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /modify/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /reject/i })
      ).toBeInTheDocument();
    });

    it('calls onApprove when approve button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      expect(mockOnApprove).toHaveBeenCalledTimes(1);
    });

    it('calls onModify when modify button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      const modifyButton = screen.getByRole('button', { name: /modify/i });
      await user.click(modifyButton);

      expect(mockOnModify).toHaveBeenCalledTimes(1);
    });

    it('calls onReject when reject button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      expect(mockOnReject).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when loading', () => {
      renderWithProviders(
        <DiagnosticResultsPanel {...defaultProps} loading={true} />
      );

      expect(
        screen.getByRole('button', { name: /processing/i })
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: /modify/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled();
    });

    it('hides action buttons when already reviewed', () => {
      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          result={mockDiagnosticResultWithReview}
        />
      );

      expect(
        screen.queryByRole('button', { name: /approve/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /modify/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /reject/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Review Status', () => {
    it('shows review status when result is reviewed', () => {
      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          result={mockDiagnosticResultWithReview}
        />
      );

      expect(screen.getByText('Pharmacist Review Status')).toBeInTheDocument();
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
      expect(screen.getByText('Reviewed on 1/15/2024')).toBeInTheDocument();
    });

    it('shows modifications when present', () => {
      const resultWithModifications = {
        ...mockDiagnosticResultWithReview,
        pharmacistReview: {
          ...mockDiagnosticResultWithReview.pharmacistReview!,
          status: 'modified' as const,
          modifications: 'Adjusted dosage for patient weight',
        },
      };

      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          result={resultWithModifications}
        />
      );

      expect(screen.getByText('MODIFIED')).toBeInTheDocument();
      expect(
        screen.getByText('Adjusted dosage for patient weight')
      ).toBeInTheDocument();
    });

    it('shows rejection reason when present', () => {
      const resultWithRejection = {
        ...mockDiagnosticResultWithReview,
        pharmacistReview: {
          ...mockDiagnosticResultWithReview.pharmacistReview!,
          status: 'rejected' as const,
          rejectionReason: 'Contraindications not properly considered',
        },
      };

      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          result={resultWithRejection}
        />
      );

      expect(screen.getByText('REJECTED')).toBeInTheDocument();
      expect(
        screen.getByText('Contraindications not properly considered')
      ).toBeInTheDocument();
    });
  });

  describe('Section Expansion', () => {
    it('allows expanding and collapsing sections', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      // Tests section should be collapsed by default
      const testsSection = screen.getByText('Suggested Laboratory Tests (2)');
      await user.click(testsSection);

      // Should expand and show test details
      await waitFor(() => {
        expect(screen.getByText('HbA1c')).toBeInTheDocument();
      });

      // Click again to collapse
      await user.click(testsSection);

      // Test details should be hidden (but section header still visible)
      expect(
        screen.getByText('Suggested Laboratory Tests (2)')
      ).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when provided', () => {
      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          error="Failed to load diagnostic results"
        />
      );

      expect(
        screen.getByText('Failed to load diagnostic results')
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /approve/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /modify/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /reject/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DiagnosticResultsPanel {...defaultProps} />);

      // Tab to the first button
      await user.tab();
      expect(screen.getByRole('button', { name: /reject/i })).toHaveFocus();

      // Tab to next button
      await user.tab();
      expect(screen.getByRole('button', { name: /modify/i })).toHaveFocus();

      // Tab to approve button
      await user.tab();
      expect(screen.getByRole('button', { name: /approve/i })).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty medication suggestions', () => {
      const resultWithoutMedications = {
        ...mockDiagnosticResult,
        medicationSuggestions: [],
      };

      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          result={resultWithoutMedications}
        />
      );

      expect(
        screen.queryByText('Medication Suggestions')
      ).not.toBeInTheDocument();
    });

    it('handles empty suggested tests', () => {
      const resultWithoutTests = {
        ...mockDiagnosticResult,
        suggestedTests: [],
      };

      renderWithProviders(
        <DiagnosticResultsPanel {...defaultProps} result={resultWithoutTests} />
      );

      expect(
        screen.queryByText('Suggested Laboratory Tests')
      ).not.toBeInTheDocument();
    });

    it('handles missing referral recommendation', () => {
      const resultWithoutReferral = {
        ...mockDiagnosticResult,
        referralRecommendation: undefined,
      };

      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          result={resultWithoutReferral}
        />
      );

      expect(
        screen.queryByText('Referral Recommended')
      ).not.toBeInTheDocument();
    });

    it('handles missing optional fields in diagnoses', () => {
      const resultWithMinimalDiagnoses = {
        ...mockDiagnosticResult,
        diagnoses: [
          {
            condition: 'Hypertension',
            probability: 0.85,
            reasoning: 'Basic reasoning',
            severity: 'medium' as const,
          },
        ],
      };

      renderWithProviders(
        <DiagnosticResultsPanel
          {...defaultProps}
          result={resultWithMinimalDiagnoses}
        />
      );

      expect(screen.getByText('Hypertension')).toBeInTheDocument();
      expect(screen.queryByText('ICD:')).not.toBeInTheDocument();
      expect(screen.queryByText('SNOMED:')).not.toBeInTheDocument();
    });
  });
});
