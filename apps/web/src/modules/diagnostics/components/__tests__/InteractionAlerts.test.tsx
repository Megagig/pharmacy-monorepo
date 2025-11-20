import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import { expect, describe, it, beforeEach } from 'vitest';
import InteractionAlerts from '../InteractionAlerts';
import type {
  DiagnosticResult,
  DrugInteraction,
  AllergyAlert,
  Contraindication,
} from '../../types';

const theme = createTheme();

const mockMedications: DiagnosticResult['medicationSuggestions'] = [
  {
    drugName: 'Warfarin',
    dosage: '5mg',
    frequency: 'once daily',
    duration: 'ongoing',
    reasoning: 'Anticoagulation therapy',
    safetyNotes: ['Monitor INR regularly'],
    rxcui: '11289',
  },
  {
    drugName: 'Aspirin',
    dosage: '81mg',
    frequency: 'once daily',
    duration: 'ongoing',
    reasoning: 'Cardioprotective therapy',
    safetyNotes: ['Take with food'],
    rxcui: '1191',
  },
];

const mockInteractions: DrugInteraction[] = [
  {
    drug1: 'Warfarin',
    drug2: 'Aspirin',
    severity: 'major',
    description: 'Increased risk of bleeding when used together',
    clinicalEffect: 'Enhanced anticoagulant effect',
    mechanism: 'Additive antiplatelet effects',
    management: 'Monitor INR closely and watch for signs of bleeding',
  },
];

const mockAllergies: AllergyAlert[] = [
  {
    drug: 'Aspirin',
    allergy: 'Salicylate allergy',
    severity: 'severe',
    reaction: 'Bronchospasm and urticaria',
  },
];

const mockContraindications: Contraindication[] = [
  {
    drug: 'Warfarin',
    condition: 'Active bleeding',
    reason: 'Anticoagulants are contraindicated in active bleeding',
    severity: 'contraindicated',
  },
];

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('InteractionAlerts', () => {
  const mockOnCheckInteractions = vi.fn();

  const defaultProps = {
    medications: mockMedications,
    onCheckInteractions: mockOnCheckInteractions,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnCheckInteractions.mockResolvedValue({
      interactions: mockInteractions,
      allergies: mockAllergies,
      contraindications: mockContraindications,
    });
  });

  describe('Rendering', () => {
    it('renders the drug safety analysis header', () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      expect(screen.getByText('Drug Safety Analysis')).toBeInTheDocument();
    });

    it('displays medication count correctly', () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      expect(screen.getByText('2 Medications')).toBeInTheDocument();
    });

    it('shows refresh button', () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      const refreshButton = screen.getByRole('button', {
        name: /refresh interaction check/i,
      });
      expect(refreshButton).toBeInTheDocument();
    });

    it('renders nothing when no medications provided', () => {
      const { container } = renderWithTheme(
        <InteractionAlerts medications={[]} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Interaction Checking', () => {
    it('calls onCheckInteractions on mount when medications are provided', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(mockOnCheckInteractions).toHaveBeenCalledWith([
          'Warfarin',
          'Aspirin',
        ]);
      });
    });

    it('calls onCheckInteractions when refresh button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      // Wait for initial call
      await waitFor(() => {
        expect(mockOnCheckInteractions).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByRole('button', {
        name: /refresh interaction check/i,
      });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockOnCheckInteractions).toHaveBeenCalledTimes(2);
      });
    });

    it('shows loading state during interaction check', async () => {
      mockOnCheckInteractions.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('handles interaction check errors', async () => {
      mockOnCheckInteractions.mockRejectedValue(new Error('API Error'));

      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Interaction Check Failed')
        ).toBeInTheDocument();
        expect(screen.getByText('API Error')).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      const user = userEvent.setup();
      mockOnCheckInteractions.mockRejectedValueOnce(new Error('API Error'));

      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Interaction Check Failed')
        ).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockOnCheckInteractions).toHaveBeenCalledTimes(2);
    });
  });

  describe('Alert Summary', () => {
    it('displays alert counts correctly', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('3 Alert(s)')).toBeInTheDocument(); // 1 interaction + 1 allergy + 1 contraindication
        expect(screen.getByText('3 Critical')).toBeInTheDocument(); // major + severe + contraindicated
      });
    });

    it('shows critical alert warning', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Critical Drug Safety Alerts')
        ).toBeInTheDocument();
        expect(
          screen.getByText('3 critical safety issue(s) detected')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Drug-Drug Interactions', () => {
    it('displays interaction section when interactions exist', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Drug-Drug Interactions (1)')
        ).toBeInTheDocument();
      });
    });

    it('shows interaction details correctly', async () => {
      const user = userEvent.setup();
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Drug-Drug Interactions (1)')
        ).toBeInTheDocument();
      });

      // Expand interactions section (should be expanded by default)
      expect(screen.getByText('Warfarin + Aspirin')).toBeInTheDocument();
      expect(screen.getByText('Major')).toBeInTheDocument();
      expect(
        screen.getByText('Enhanced anticoagulant effect')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Increased risk of bleeding when used together')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Additive antiplatelet effects')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Monitor INR closely and watch for signs of bleeding')
      ).toBeInTheDocument();
    });

    it('shows major interactions chip in header', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Major Interactions')).toBeInTheDocument();
      });
    });
  });

  describe('Allergy Alerts', () => {
    it('displays allergy section when allergies exist', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Allergy Alerts (1)')).toBeInTheDocument();
      });
    });

    it('shows allergy details correctly', async () => {
      const user = userEvent.setup();
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        const allergySection = screen.getByText('Allergy Alerts (1)');
        await user.click(allergySection);
      });

      await waitFor(() => {
        expect(screen.getByText('Aspirin')).toBeInTheDocument();
        expect(screen.getByText('Severe Allergy')).toBeInTheDocument();
        expect(screen.getByText('Salicylate allergy')).toBeInTheDocument();
        expect(
          screen.getByText('Bronchospasm and urticaria')
        ).toBeInTheDocument();
      });
    });

    it('shows severe allergies chip in header', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Severe Allergies')).toBeInTheDocument();
      });
    });
  });

  describe('Contraindications', () => {
    it('displays contraindications section when contraindications exist', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Contraindications (1)')).toBeInTheDocument();
      });
    });

    it('shows contraindication details correctly', async () => {
      const user = userEvent.setup();
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        const contraindicationSection = screen.getByText(
          'Contraindications (1)'
        );
        await user.click(contraindicationSection);
      });

      await waitFor(() => {
        expect(screen.getByText('Warfarin')).toBeInTheDocument();
        expect(screen.getByText('Contraindicated')).toBeInTheDocument();
        expect(screen.getByText('Active bleeding')).toBeInTheDocument();
        expect(
          screen.getByText(
            'Anticoagulants are contraindicated in active bleeding'
          )
        ).toBeInTheDocument();
      });
    });

    it('shows absolute contraindications chip in header', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Absolute Contraindications')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Section Expansion', () => {
    it('allows expanding and collapsing sections', async () => {
      const user = userEvent.setup();
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Allergy Alerts (1)')).toBeInTheDocument();
      });

      // Allergy section should be collapsed by default
      expect(screen.queryByText('Salicylate allergy')).not.toBeInTheDocument();

      // Expand allergy section
      const allergySection = screen.getByText('Allergy Alerts (1)');
      await user.click(allergySection);

      await waitFor(() => {
        expect(screen.getByText('Salicylate allergy')).toBeInTheDocument();
      });

      // Collapse again
      await user.click(allergySection);

      await waitFor(() => {
        expect(
          screen.queryByText('Salicylate allergy')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('No Alerts State', () => {
    it('shows success message when no alerts are found', async () => {
      mockOnCheckInteractions.mockResolvedValue({
        interactions: [],
        allergies: [],
        contraindications: [],
      });

      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No Safety Alerts')).toBeInTheDocument();
        expect(
          screen.getByText(
            'No drug interactions, allergies, or contraindications detected'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Safety Disclaimer', () => {
    it('shows safety disclaimer', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            /This analysis is based on available drug interaction databases/
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional fields in interactions', async () => {
      const minimalInteraction: DrugInteraction = {
        drug1: 'Drug A',
        drug2: 'Drug B',
        severity: 'minor',
        description: 'Minor interaction',
        clinicalEffect: 'Minimal effect',
      };

      mockOnCheckInteractions.mockResolvedValue({
        interactions: [minimalInteraction],
        allergies: [],
        contraindications: [],
      });

      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Drug A + Drug B')).toBeInTheDocument();
        expect(screen.getByText('Minor interaction')).toBeInTheDocument();
        expect(screen.queryByText('Mechanism:')).not.toBeInTheDocument();
        expect(screen.queryByText('Management:')).not.toBeInTheDocument();
      });
    });

    it('handles empty medication list gracefully', () => {
      const { container } = renderWithTheme(
        <InteractionAlerts medications={[]} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('handles missing onCheckInteractions callback', () => {
      renderWithTheme(<InteractionAlerts medications={mockMedications} />);

      // Should render without errors
      expect(screen.getByText('Drug Safety Analysis')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      const refreshButton = screen.getByRole('button', {
        name: /refresh interaction check/i,
      });
      expect(refreshButton).toBeInTheDocument();

      await waitFor(() => {
        const expandButtons = screen.getAllByRole('button');
        expect(expandButtons.length).toBeGreaterThan(0);
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      // Tab to refresh button
      await user.tab();
      const refreshButton = screen.getByRole('button', {
        name: /refresh interaction check/i,
      });
      expect(refreshButton).toHaveFocus();
    });

    it('provides meaningful section headers', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Drug-Drug Interactions (1)')
        ).toBeInTheDocument();
        expect(screen.getByText('Allergy Alerts (1)')).toBeInTheDocument();
        expect(screen.getByText('Contraindications (1)')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading indicator during interaction check', async () => {
      mockOnCheckInteractions.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('disables refresh button during loading', async () => {
      renderWithTheme(<InteractionAlerts {...defaultProps} loading={true} />);

      const refreshButton = screen.getByRole('button', {
        name: /refresh interaction check/i,
      });
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Severity Handling', () => {
    it('handles different interaction severities correctly', async () => {
      const multiSeverityInteractions: DrugInteraction[] = [
        {
          drug1: 'Drug A',
          drug2: 'Drug B',
          severity: 'major',
          description: 'Major interaction',
          clinicalEffect: 'Significant effect',
        },
        {
          drug1: 'Drug C',
          drug2: 'Drug D',
          severity: 'moderate',
          description: 'Moderate interaction',
          clinicalEffect: 'Moderate effect',
        },
        {
          drug1: 'Drug E',
          drug2: 'Drug F',
          severity: 'minor',
          description: 'Minor interaction',
          clinicalEffect: 'Minor effect',
        },
      ];

      mockOnCheckInteractions.mockResolvedValue({
        interactions: multiSeverityInteractions,
        allergies: [],
        contraindications: [],
      });

      renderWithTheme(<InteractionAlerts {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Major')).toBeInTheDocument();
        expect(screen.getByText('Moderate')).toBeInTheDocument();
        expect(screen.getByText('Minor')).toBeInTheDocument();
      });
    });
  });
});
