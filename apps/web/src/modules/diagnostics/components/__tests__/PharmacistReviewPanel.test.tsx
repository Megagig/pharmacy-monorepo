import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import { expect, describe, it, beforeEach } from 'vitest';
import PharmacistReviewPanel from '../PharmacistReviewPanel';
import type { DiagnosticResult } from '../../types';

const theme = createTheme();

const mockDiagnosticResult: DiagnosticResult = {
  _id: 'result-123',
  requestId: 'request-123',
  diagnoses: [
    {
      condition: 'Hypertension',
      probability: 0.85,
      reasoning: 'Elevated blood pressure readings',
      severity: 'medium',
    },
  ],
  suggestedTests: [],
  medicationSuggestions: [],
  redFlags: [
    {
      flag: 'Severe hypertension',
      severity: 'high',
      action: 'Monitor blood pressure closely',
    },
  ],
  referralRecommendation: {
    recommended: true,
    urgency: 'within_24h',
    specialty: 'Cardiology',
    reason: 'Uncontrolled hypertension',
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
  disclaimer: 'This AI analysis is for clinical decision support only.',
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

const mockCurrentUser = {
  id: 'user-123',
  name: 'Dr. John Doe',
  role: 'Pharmacist',
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('PharmacistReviewPanel', () => {
  const mockOnApprove = vi.fn();
  const mockOnModify = vi.fn();
  const mockOnReject = vi.fn();

  const defaultProps = {
    result: mockDiagnosticResult,
    onApprove: mockOnApprove,
    onModify: mockOnModify,
    onReject: mockOnReject,
    currentUser: mockCurrentUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the pharmacist review panel', () => {
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      expect(screen.getByText('Pharmacist Review')).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    it('shows special attention warning for high-risk cases', () => {
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      expect(
        screen.getByText('Special Attention Required')
      ).toBeInTheDocument();
      expect(
        screen.getByText('• Critical or high-risk red flags detected')
      ).toBeInTheDocument();
      expect(
        screen.getByText('• AI recommends referral to Cardiology')
      ).toBeInTheDocument();
    });

    it('displays review checklist for unreviewed results', () => {
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      expect(screen.getByText('Review Checklist')).toBeInTheDocument();
      expect(screen.getByText('Diagnostic Assessment')).toBeInTheDocument();
      expect(screen.getByText('Medication Safety')).toBeInTheDocument();
      expect(screen.getByText('Red Flag Assessment')).toBeInTheDocument();
      expect(screen.getByText('Referral Appropriateness')).toBeInTheDocument();
    });

    it('shows current user information', () => {
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      expect(
        screen.getByText('Reviewing as: Dr. John Doe (Pharmacist)')
      ).toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      renderWithTheme(
        <PharmacistReviewPanel {...defaultProps} error="Review failed" />
      );

      expect(screen.getByText('Review failed')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows action buttons for unreviewed results', () => {
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

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

    it('hides action buttons for reviewed results', () => {
      renderWithTheme(
        <PharmacistReviewPanel
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

    it('disables buttons when loading', () => {
      renderWithTheme(
        <PharmacistReviewPanel {...defaultProps} loading={true} />
      );

      expect(
        screen.getByRole('button', { name: /processing/i })
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: /modify/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled();
    });
  });

  describe('Approve Dialog', () => {
    it('opens approve dialog when approve button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      expect(screen.getByText('Approve Diagnostic Result')).toBeInTheDocument();
      expect(
        screen.getByText(
          'By approving this diagnostic result, you confirm that:'
        )
      ).toBeInTheDocument();
    });

    it('shows high-risk warning in approve dialog for high-risk cases', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      expect(screen.getByText('High-Risk Case Detected')).toBeInTheDocument();
      expect(
        screen.getByText(
          /This case contains critical findings or referral recommendations/
        )
      ).toBeInTheDocument();
    });

    it('calls onApprove when approve is confirmed', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      const confirmButton = screen.getByRole('button', { name: 'Approve' });
      await user.click(confirmButton);

      expect(mockOnApprove).toHaveBeenCalledTimes(1);
    });

    it('closes dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(
        screen.queryByText('Approve Diagnostic Result')
      ).not.toBeInTheDocument();
    });
  });

  describe('Modify Dialog', () => {
    it('opens modify dialog when modify button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const modifyButton = screen.getByRole('button', { name: /modify/i });
      await user.click(modifyButton);

      expect(screen.getByText('Modify Diagnostic Result')).toBeInTheDocument();
      expect(screen.getByLabelText('Modifications')).toBeInTheDocument();
    });

    it('requires modification text to be entered', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const modifyButton = screen.getByRole('button', { name: /modify/i });
      await user.click(modifyButton);

      const submitButton = screen.getByRole('button', {
        name: /submit modifications/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when modification text is entered', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const modifyButton = screen.getByRole('button', { name: /modify/i });
      await user.click(modifyButton);

      const textField = screen.getByLabelText('Modifications');
      await user.type(textField, 'Adjusted dosage for patient weight');

      const submitButton = screen.getByRole('button', {
        name: /submit modifications/i,
      });
      expect(submitButton).toBeEnabled();
    });

    it('calls onModify with modification text', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const modifyButton = screen.getByRole('button', { name: /modify/i });
      await user.click(modifyButton);

      const textField = screen.getByLabelText('Modifications');
      await user.type(textField, 'Adjusted dosage for patient weight');

      const submitButton = screen.getByRole('button', {
        name: /submit modifications/i,
      });
      await user.click(submitButton);

      expect(mockOnModify).toHaveBeenCalledWith(
        'Adjusted dosage for patient weight'
      );
    });
  });

  describe('Reject Dialog', () => {
    it('opens reject dialog when reject button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      expect(screen.getByText('Reject Diagnostic Result')).toBeInTheDocument();
      expect(screen.getByLabelText('Rejection Reason')).toBeInTheDocument();
    });

    it('requires rejection reason to be entered', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      const submitButton = screen.getByRole('button', { name: 'Reject' });
      expect(submitButton).toBeDisabled();
    });

    it('calls onReject with rejection reason', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      const textField = screen.getByLabelText('Rejection Reason');
      await user.type(textField, 'Contraindications not properly considered');

      const submitButton = screen.getByRole('button', { name: 'Reject' });
      await user.click(submitButton);

      expect(mockOnReject).toHaveBeenCalledWith(
        'Contraindications not properly considered'
      );
    });
  });

  describe('Review History', () => {
    it('shows review history for reviewed results', () => {
      renderWithTheme(
        <PharmacistReviewPanel
          {...defaultProps}
          result={mockDiagnosticResultWithReview}
        />
      );

      expect(screen.getByText('Review History')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('displays review details correctly', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <PharmacistReviewPanel
          {...defaultProps}
          result={mockDiagnosticResultWithReview}
        />
      );

      // Expand review history
      const historySection = screen.getByText('Review History');
      await user.click(historySection);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('1/15/2024, 11:00:00 AM')).toBeInTheDocument();
      });
    });

    it('shows modifications when present', async () => {
      const user = userEvent.setup();
      const resultWithModifications = {
        ...mockDiagnosticResultWithReview,
        pharmacistReview: {
          ...mockDiagnosticResultWithReview.pharmacistReview!,
          status: 'modified' as const,
          modifications: 'Adjusted dosage for patient weight',
        },
      };

      renderWithTheme(
        <PharmacistReviewPanel
          {...defaultProps}
          result={resultWithModifications}
        />
      );

      // Expand review history
      const historySection = screen.getByText('Review History');
      await user.click(historySection);

      await waitFor(() => {
        expect(
          screen.getByText('Adjusted dosage for patient weight')
        ).toBeInTheDocument();
      });
    });

    it('shows rejection reason when present', async () => {
      const user = userEvent.setup();
      const resultWithRejection = {
        ...mockDiagnosticResultWithReview,
        pharmacistReview: {
          ...mockDiagnosticResultWithReview.pharmacistReview!,
          status: 'rejected' as const,
          rejectionReason: 'Contraindications not properly considered',
        },
      };

      renderWithTheme(
        <PharmacistReviewPanel {...defaultProps} result={resultWithRejection} />
      );

      // Expand review history
      const historySection = screen.getByText('Review History');
      await user.click(historySection);

      await waitFor(() => {
        expect(
          screen.getByText('Contraindications not properly considered')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles result without red flags', () => {
      const resultWithoutRedFlags = {
        ...mockDiagnosticResult,
        redFlags: [],
      };

      renderWithTheme(
        <PharmacistReviewPanel
          {...defaultProps}
          result={resultWithoutRedFlags}
        />
      );

      expect(
        screen.queryByText('Special Attention Required')
      ).not.toBeInTheDocument();
    });

    it('handles result without referral recommendation', () => {
      const resultWithoutReferral = {
        ...mockDiagnosticResult,
        referralRecommendation: undefined,
      };

      renderWithTheme(
        <PharmacistReviewPanel
          {...defaultProps}
          result={resultWithoutReferral}
        />
      );

      expect(
        screen.queryByText('• AI recommends referral')
      ).not.toBeInTheDocument();
    });

    it('handles missing current user', () => {
      renderWithTheme(
        <PharmacistReviewPanel {...defaultProps} currentUser={undefined} />
      );

      expect(screen.queryByText('Reviewing as:')).not.toBeInTheDocument();
    });

    it('handles missing callback functions', () => {
      renderWithTheme(<PharmacistReviewPanel result={mockDiagnosticResult} />);

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

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

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
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      // Tab to first button
      await user.tab();
      expect(screen.getByRole('button', { name: /reject/i })).toHaveFocus();

      // Tab to next button
      await user.tab();
      expect(screen.getByRole('button', { name: /modify/i })).toHaveFocus();

      // Tab to approve button
      await user.tab();
      expect(screen.getByRole('button', { name: /approve/i })).toHaveFocus();
    });

    it('provides meaningful dialog titles and labels', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PharmacistReviewPanel {...defaultProps} />);

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Approve Diagnostic Result')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state in buttons when loading', () => {
      renderWithTheme(
        <PharmacistReviewPanel {...defaultProps} loading={true} />
      );

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('disables dialog submit button when loading', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <PharmacistReviewPanel {...defaultProps} loading={true} />
      );

      const approveButton = screen.getByRole('button', { name: /processing/i });
      await user.click(approveButton);

      const submitButton = screen.getByRole('button', { name: /processing/i });
      expect(submitButton).toBeDisabled();
    });
  });
});
