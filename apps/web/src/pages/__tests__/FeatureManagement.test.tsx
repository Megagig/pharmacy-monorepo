import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import type { FeatureFlag } from '../../services/featureFlagService';
import FeatureManagement from '../FeatureManagement';
import featureFlagService from '../../services/featureFlagService';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the featureFlagService
vi.mock('../../services/featureFlagService', () => ({
  default: {
    getFeatureFlags: vi.fn(),
    createFeatureFlag: vi.fn(),
    updateFeatureFlag: vi.fn(),
    deleteFeatureFlag: vi.fn(),
    getFeaturesByTier: vi.fn(),
    updateTierFeatures: vi.fn(),
  },
  FeatureFlag: {},
}));

// Mock window.confirm
const originalConfirm = window.confirm;

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

// Mock feature data
const mockFeatures: FeatureFlag[] = [
  {
    _id: 'feature-1',
    name: 'Clinical Decision Support',
    key: 'clinical_decision_support',
    description: 'Enable clinical decision support features',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'owner'],
    customRules: {},
    metadata: {
      category: 'clinical',
      priority: 'high',
      tags: ['clinical', 'decision-support'],
    },
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    _id: 'feature-2',
    name: 'Advanced Reports',
    key: 'advanced_reports',
    description: 'Access to advanced reporting features',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['owner', 'super_admin'],
    customRules: {},
    metadata: {
      category: 'reporting',
      priority: 'medium',
      tags: ['reports', 'analytics'],
    },
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

describe('FeatureManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlagService.getFeatureFlags).mockResolvedValue(mockFeatures);
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  describe('Component Rendering', () => {
    it('should render with tabs', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Feature Management')).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: /features/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      vi.mocked(featureFlagService.getFeatureFlags).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      expect(screen.getByText('Loading features...')).toBeInTheDocument();
    });

    it('should display error state when fetch fails', async () => {
      const errorMessage = 'Failed to fetch features';
      vi.mocked(featureFlagService).getFeatureFlags.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Features')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      expect(vi.mocked(toast).error).toHaveBeenCalledWith(errorMessage);
    });

    it('should display "Add Feature" button in header', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });
    });

    it('should display feature list when features are loaded', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
        expect(screen.getByText('Advanced Reports')).toBeInTheDocument();
      });
    });

    it('should display empty state when no features exist', async () => {
      vi.mocked(featureFlagService).getFeatureFlags.mockResolvedValue([]);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no features found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Feature Button', () => {
    it('should show form when "Add Feature" button is clicked', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add feature/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Create Feature')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call createFeatureFlag service method on form submission', async () => {
      const newFeature: FeatureFlag = {
        _id: 'feature-3',
        name: 'New Feature',
        key: 'new_feature',
        description: 'A new test feature',
        isActive: true,
        allowedTiers: ['pro'],
        allowedRoles: ['pharmacist'],
        customRules: {},
        metadata: {
          category: 'test',
          priority: 'low',
          tags: [],
        },
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      };

      vi.mocked(featureFlagService).createFeatureFlag.mockResolvedValue(newFeature);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      // Open form
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill form
      const keyInput = screen.getByLabelText(/feature key/i);
      const nameInput = screen.getByLabelText(/display name/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(keyInput, { target: { value: 'new_feature' } });
      fireEvent.change(nameInput, { target: { value: 'New Feature' } });
      fireEvent.change(descriptionInput, { target: { value: 'A new test feature' } });

      // Select tier
      const proCheckbox = screen.getByRole('checkbox', { name: /pro/i });
      fireEvent.click(proCheckbox);

      // Select role
      const pharmacistCheckbox = screen.getByRole('checkbox', { name: /pharmacist/i });
      fireEvent.click(pharmacistCheckbox);

      // Submit form
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(vi.mocked(featureFlagService).createFeatureFlag).toHaveBeenCalledWith({
          key: 'new_feature',
          name: 'New Feature',
          description: 'A new test feature',
          allowedTiers: ['pro'],
          allowedRoles: ['pharmacist'],
          isActive: true,
        });
      });

      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Feature created successfully');
      expect(vi.mocked(featureFlagService).getFeatureFlags).toHaveBeenCalledTimes(2); // Initial + after create
    });

    it('should show error toast when form submission fails', async () => {
      const errorMessage = 'Feature key already exists';
      vi.mocked(featureFlagService).createFeatureFlag.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      // Open form
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill required fields
      fireEvent.change(screen.getByLabelText(/feature key/i), { target: { value: 'test' } });
      fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test' } });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(vi.mocked(toast).error).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should validate required fields before submission', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      // Open form
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Try to submit without filling required fields
      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(vi.mocked(toast).error).toHaveBeenCalledWith('Feature key and name are required');
      });

      expect(vi.mocked(featureFlagService).createFeatureFlag).not.toHaveBeenCalled();
    });
  });

  describe('Edit Feature', () => {
    it('should populate form with feature data when edit button is clicked', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Find and click edit button for first feature
      const featureCards = screen.getAllByRole('button', { name: /edit/i });
      fireEvent.click(featureCards[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit Feature')).toBeInTheDocument();
      });

      // Verify form is populated with feature data
      expect(screen.getByLabelText(/feature key/i)).toHaveValue('clinical_decision_support');
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Clinical Decision Support');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Enable clinical decision support features');

      // Verify tiers are checked
      const proCheckbox = screen.getByRole('checkbox', { name: /^pro$/i });
      expect(proCheckbox).toBeChecked();

      // Verify roles are checked
      const pharmacistCheckbox = screen.getByRole('checkbox', { name: /^pharmacist$/i });
      expect(pharmacistCheckbox).toBeChecked();
    });

    it('should call updateFeatureFlag when editing a feature', async () => {
      const updatedFeature = { ...mockFeatures[0], name: 'Updated Feature Name' };
      vi.mocked(featureFlagService).updateFeatureFlag.mockResolvedValue(updatedFeature);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Click edit button
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Update name
      const nameInput = screen.getByLabelText(/display name/i);
      fireEvent.change(nameInput, { target: { value: 'Updated Feature Name' } });

      // Submit form
      const updateButton = screen.getByRole('button', { name: /update/i });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(vi.mocked(featureFlagService).updateFeatureFlag).toHaveBeenCalledWith(
          'feature-1',
          expect.objectContaining({
            name: 'Updated Feature Name',
          })
        );
      });

      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Feature updated successfully');
    });
  });

  describe('Delete Feature', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete "Clinical Decision Support"?'
      );
    });

    it('should call deleteFeatureFlag service when confirmed', async () => {
      vi.mocked(featureFlagService).deleteFeatureFlag.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(featureFlagService).deleteFeatureFlag).toHaveBeenCalledWith('feature-1');
      });

      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Feature deleted successfully');
      expect(vi.mocked(featureFlagService).getFeatureFlags).toHaveBeenCalledTimes(2); // Initial + after delete
    });

    it('should not delete when confirmation is cancelled', async () => {
      window.confirm = vi.fn(() => false);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalled();
      expect(vi.mocked(featureFlagService).deleteFeatureFlag).not.toHaveBeenCalled();
    });

    it('should show error toast when deletion fails', async () => {
      const errorMessage = 'Failed to delete feature';
      vi.mocked(featureFlagService).deleteFeatureFlag.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(toast).error).toHaveBeenCalledWith(errorMessage);
      });
    });
  });

  describe('Tier Management Tab', () => {
    it('should switch to Tier Management tab when clicked', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      const tierTab = screen.getByRole('tab', { name: /tier management/i });
      fireEvent.click(tierTab);

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });
    });

    it('should display matrix with features and tiers', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      fireEvent.click(screen.getByRole('tab', { name: /tier management/i }));

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Verify feature names are displayed
      expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      expect(screen.getByText('Advanced Reports')).toBeInTheDocument();

      // Verify tier headers are displayed
      expect(screen.getByText(/free trial/i)).toBeInTheDocument();
      expect(screen.getByText(/basic/i)).toBeInTheDocument();
      expect(screen.getByText(/^pro$/i)).toBeInTheDocument();
      expect(screen.getByText(/enterprise/i)).toBeInTheDocument();
    });

    it('should show empty state when no features exist in matrix', async () => {
      vi.mocked(featureFlagService).getFeatureFlags.mockResolvedValue([]);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      fireEvent.click(screen.getByRole('tab', { name: /tier management/i }));

      await waitFor(() => {
        expect(screen.getByText(/no features available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Matrix Toggle Switches', () => {
    it('should call updateTierFeatures when toggle is switched on', async () => {
      vi.mocked(featureFlagService).updateTierFeatures.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      fireEvent.click(screen.getByRole('tab', { name: /tier management/i }));

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Find all switches in the matrix using input type checkbox
      const container = screen.getByText('Feature-Tier Matrix').closest('.MuiCardContent-root');
      const switches = container?.querySelectorAll('input[type="checkbox"]') || [];
      
      // Find a switch that is currently off (not in allowedTiers)
      // Clinical Decision Support is in ['pro', 'enterprise'], so 'basic' should be off
      const basicSwitches = Array.from(switches).filter((sw) => !(sw as HTMLInputElement).checked);
      
      if (basicSwitches.length > 0) {
        fireEvent.click(basicSwitches[0]);

        await waitFor(() => {
          expect(vi.mocked(featureFlagService).updateTierFeatures).toHaveBeenCalled();
        });

        expect(vi.mocked(toast).success).toHaveBeenCalledWith(
          expect.stringContaining('enabled')
        );
      }
    });

    it('should call updateTierFeatures when toggle is switched off', async () => {
      vi.mocked(featureFlagService).updateTierFeatures.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      fireEvent.click(screen.getByRole('tab', { name: /tier management/i }));

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Find all switches in the matrix using input type checkbox
      const container = screen.getByText('Feature-Tier Matrix').closest('.MuiCardContent-root');
      const switches = container?.querySelectorAll('input[type="checkbox"]') || [];
      
      // Find a switch that is currently on (in allowedTiers)
      const enabledSwitches = Array.from(switches).filter((sw) => (sw as HTMLInputElement).checked);
      
      if (enabledSwitches.length > 0) {
        fireEvent.click(enabledSwitches[0]);

        await waitFor(() => {
          expect(vi.mocked(featureFlagService).updateTierFeatures).toHaveBeenCalled();
        });

        expect(vi.mocked(toast).success).toHaveBeenCalledWith(
          expect.stringContaining('disabled')
        );
      }
    });

    it('should show error toast when matrix toggle fails', async () => {
      const errorMessage = 'Failed to update tier feature';
      vi.mocked(featureFlagService).updateTierFeatures.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      fireEvent.click(screen.getByRole('tab', { name: /tier management/i }));

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Find and click a switch using input type checkbox
      const container = screen.getByText('Feature-Tier Matrix').closest('.MuiCardContent-root');
      const switches = container?.querySelectorAll('input[type="checkbox"]') || [];
      if (switches.length > 0) {
        fireEvent.click(switches[0]);

        await waitFor(() => {
          expect(vi.mocked(toast).error).toHaveBeenCalledWith(errorMessage);
        });
      }
    });

    it('should refresh feature list after successful matrix toggle', async () => {
      vi.mocked(featureFlagService).updateTierFeatures.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      // Initial fetch
      expect(vi.mocked(featureFlagService).getFeatureFlags).toHaveBeenCalledTimes(1);

      // Switch to Tier Management tab
      fireEvent.click(screen.getByRole('tab', { name: /tier management/i }));

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Find and click a switch using input type checkbox
      const container = screen.getByText('Feature-Tier Matrix').closest('.MuiCardContent-root');
      const switches = container?.querySelectorAll('input[type="checkbox"]') || [];
      if (switches.length > 0) {
        fireEvent.click(switches[0]);

        await waitFor(() => {
          // Should be called again after toggle
          expect(vi.mocked(featureFlagService).getFeatureFlags).toHaveBeenCalledTimes(2);
        });
      }
    });
  });

  describe('Toast Notifications', () => {
    it('should show success toast on successful feature creation', async () => {
      const newFeature: FeatureFlag = {
        _id: 'feature-3',
        name: 'Test Feature',
        key: 'test_feature',
        description: 'Test',
        isActive: true,
        allowedTiers: ['pro'],
        allowedRoles: ['pharmacist'],
        customRules: {},
        metadata: {
          category: 'test',
          priority: 'low',
          tags: [],
        },
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      };

      vi.mocked(featureFlagService).createFeatureFlag.mockResolvedValue(newFeature);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      // Open form and fill
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/feature key/i), { target: { value: 'test_feature' } });
      fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test Feature' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(vi.mocked(toast).success).toHaveBeenCalledWith('Feature created successfully');
      });
    });

    it('should show error toast on failed feature creation', async () => {
      const errorMessage = 'Duplicate feature key';
      vi.mocked(featureFlagService).createFeatureFlag.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      // Open form and fill
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/feature key/i), { target: { value: 'test' } });
      fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(vi.mocked(toast).error).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should show success toast on successful feature update', async () => {
      const updatedFeature = { ...mockFeatures[0], name: 'Updated Name' };
      vi.mocked(featureFlagService).updateFeatureFlag.mockResolvedValue(updatedFeature);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Click edit
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Update and submit
      fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Updated Name' } });
      fireEvent.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(vi.mocked(toast).success).toHaveBeenCalledWith('Feature updated successfully');
      });
    });

    it('should show success toast on successful feature deletion', async () => {
      vi.mocked(featureFlagService).deleteFeatureFlag.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
      });

      // Click delete
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(toast).success).toHaveBeenCalledWith('Feature deleted successfully');
      });
    });

    it('should show success toast on successful tier toggle', async () => {
      vi.mocked(featureFlagService).updateTierFeatures.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tier management/i })).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      fireEvent.click(screen.getByRole('tab', { name: /tier management/i }));

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Toggle a switch using input type checkbox
      const container = screen.getByText('Feature-Tier Matrix').closest('.MuiCardContent-root');
      const switches = container?.querySelectorAll('input[type="checkbox"]') || [];
      if (switches.length > 0) {
        fireEvent.click(switches[0]);

        await waitFor(() => {
          expect(vi.mocked(toast).success).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Form Reset', () => {
    it('should reset form when cancel button is clicked', async () => {
      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      // Open form
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill form
      fireEvent.change(screen.getByLabelText(/feature key/i), { target: { value: 'test' } });
      fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test' } });

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Reopen form and verify it's empty
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/feature key/i)).toHaveValue('');
      expect(screen.getByLabelText(/display name/i)).toHaveValue('');
    });

    it('should reset form after successful creation', async () => {
      const newFeature: FeatureFlag = {
        _id: 'feature-3',
        name: 'Test',
        key: 'test',
        description: '',
        isActive: true,
        allowedTiers: [],
        allowedRoles: [],
        customRules: {},
        metadata: {
          category: 'test',
          priority: 'low',
          tags: [],
        },
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      };

      vi.mocked(featureFlagService).createFeatureFlag.mockResolvedValue(newFeature);

      render(
        <TestWrapper>
          <FeatureManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
      });

      // Open form and fill
      fireEvent.click(screen.getByRole('button', { name: /add feature/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/feature key/i), { target: { value: 'test' } });
      fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
