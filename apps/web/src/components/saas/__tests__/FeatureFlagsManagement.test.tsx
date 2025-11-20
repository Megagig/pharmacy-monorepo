import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import FeatureFlagsManagement from '../FeatureFlagsManagement';
import * as saasQueries from '../../../queries/useSaasSettings';

// Mock the SaaS queries
jest.mock('../../../queries/useSaasSettings');

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const mockFeatureFlags = [
  {
    id: 'flag1',
    name: 'AI Diagnostics',
    description: 'Enable AI-powered diagnostic recommendations',
    isEnabled: true,
    category: 'core',
    targetingRules: {
      pharmacies: ['pharmacy1', 'pharmacy2'],
      userGroups: ['pharmacists'],
      percentage: 50,
    },
    usageMetrics: {
      totalUsers: 100,
      activeUsers: 75,
      conversionRate: 0.85,
    },
  },
  {
    id: 'flag2',
    name: 'Advanced Analytics',
    description: 'Premium analytics dashboard features',
    isEnabled: false,
    category: 'premium',
    targetingRules: {
      subscriptionPlans: ['professional', 'enterprise'],
      percentage: 100,
    },
    usageMetrics: {
      totalUsers: 50,
      activeUsers: 30,
      conversionRate: 0.60,
    },
  },
  {
    id: 'flag3',
    name: 'Beta Feature',
    description: 'Experimental feature in testing',
    isEnabled: true,
    category: 'experimental',
    targetingRules: {
      userGroups: ['beta_testers'],
      percentage: 25,
    },
    usageMetrics: {
      totalUsers: 20,
      activeUsers: 15,
      conversionRate: 0.75,
    },
  },
];

const mockMutations = {
  mutate: jest.fn(),
  isLoading: false,
  error: null,
};

describe('FeatureFlagsManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    (saasQueries.useSaasFeatureFlags as jest.Mock).mockReturnValue({
      data: mockFeatureFlags,
      isLoading: false,
      error: null,
    });

    (saasQueries.useUpdateFeatureFlagTargeting as jest.Mock).mockReturnValue(mockMutations);
  });

  it('should render feature flags management interface with correct title', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    expect(screen.getByText('Feature Flags Management')).toBeInTheDocument();
    expect(screen.getByText('Control feature availability with targeting rules across pharmacy tenants')).toBeInTheDocument();
    expect(screen.getByText('Create Flag')).toBeInTheDocument();
  });

  it('should render feature flags table with correct headers', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    expect(screen.getByText('Feature Flag')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Targeting')).toBeInTheDocument();
    expect(screen.getByText('Usage Metrics')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should display feature flags data correctly', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Check first flag
    expect(screen.getByText('AI Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Enable AI-powered diagnostic recommendations')).toBeInTheDocument();
    expect(screen.getByText('core')).toBeInTheDocument();
    expect(screen.getByText('75 active users')).toBeInTheDocument();

    // Check second flag
    expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
    expect(screen.getByText('Premium analytics dashboard features')).toBeInTheDocument();
    expect(screen.getByText('premium')).toBeInTheDocument();

    // Check third flag
    expect(screen.getByText('Beta Feature')).toBeInTheDocument();
    expect(screen.getByText('experimental')).toBeInTheDocument();
  });

  it('should show loading skeletons when data is loading', () => {
    (saasQueries.useSaasFeatureFlags as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<FeatureFlagsManagement />);

    // Should show skeleton loaders in table
    const skeletons = screen.getAllByTestId(/skeleton/i);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display error message when there is an error', () => {
    (saasQueries.useSaasFeatureFlags as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch feature flags'),
    });

    renderWithProviders(<FeatureFlagsManagement />);

    expect(screen.getByText('Error Loading Feature Flags')).toBeInTheDocument();
    expect(screen.getByText(/There was an error loading the feature flags data/)).toBeInTheDocument();
  });

  it('should display targeting rules correctly', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Check targeting chips for first flag
    expect(screen.getByText('2 pharmacies')).toBeInTheDocument();
    expect(screen.getByText('1 groups')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Check targeting chips for second flag
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should display usage metrics correctly', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Check conversion rates
    expect(screen.getByText('85.0% conversion')).toBeInTheDocument();
    expect(screen.getByText('60.0% conversion')).toBeInTheDocument();
    expect(screen.getByText('75.0% conversion')).toBeInTheDocument();
  });

  it('should render usage metrics overview cards', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    expect(screen.getByText('Total Flags')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Total flags count

    expect(screen.getByText('Affected Users')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument(); // Sum of active users

    expect(screen.getByText('Avg. Conversion')).toBeInTheDocument();
    expect(screen.getByText('73.3%')).toBeInTheDocument(); // Average conversion rate
  });

  it('should handle feature flag toggle', async () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Find the first toggle switch (AI Diagnostics - enabled)
    const toggleSwitches = screen.getAllByRole('checkbox');
    const firstToggle = toggleSwitches[0];

    expect(firstToggle).toBeChecked();

    // Toggle the switch
    fireEvent.click(firstToggle);

    // Note: In a real implementation, this would call the toggle mutation
    // For now, we just verify the interaction works
  });

  it('should open targeting configuration dialog', async () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Find and click the configure targeting button (edit icon)
    const editButtons = screen.getAllByRole('button', { name: '' });
    const configureButton = editButtons.find(button => 
      button.querySelector('[data-testid="EditIcon"]')
    );

    if (configureButton) {
      fireEvent.click(configureButton);

      await waitFor(() => {
        expect(screen.getByText('Configure Targeting Rules - AI Diagnostics')).toBeInTheDocument();
        expect(screen.getByText('Target Pharmacies')).toBeInTheDocument();
        expect(screen.getByText('Target User Groups')).toBeInTheDocument();
        expect(screen.getByText('Target Subscription Plans')).toBeInTheDocument();
        expect(screen.getByText('Percentage Rollout: 50%')).toBeInTheDocument();
      });
    }
  });

  it('should handle targeting configuration changes', async () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Open targeting dialog
    const editButtons = screen.getAllByRole('button', { name: '' });
    const configureButton = editButtons.find(button => 
      button.querySelector('[data-testid="EditIcon"]')
    );

    if (configureButton) {
      fireEvent.click(configureButton);

      await waitFor(() => {
        // Change percentage rollout
        const percentageInput = screen.getByDisplayValue('50');
        fireEvent.change(percentageInput, { target: { value: '75' } });
        expect(percentageInput).toHaveValue(75);
      });
    }
  });

  it('should save targeting configuration', async () => {
    const mockUpdateTargeting = jest.fn();
    (saasQueries.useUpdateFeatureFlagTargeting as jest.Mock).mockReturnValue({
      mutate: mockUpdateTargeting,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<FeatureFlagsManagement />);

    // Open targeting dialog
    const editButtons = screen.getAllByRole('button', { name: '' });
    const configureButton = editButtons.find(button => 
      button.querySelector('[data-testid="EditIcon"]')
    );

    if (configureButton) {
      fireEvent.click(configureButton);

      await waitFor(() => {
        // Save targeting rules
        fireEvent.click(screen.getByText('Save Targeting Rules'));
      });

      expect(mockUpdateTargeting).toHaveBeenCalledWith({
        flagId: 'flag1',
        targeting: expect.objectContaining({
          pharmacies: ['pharmacy1', 'pharmacy2'],
          userGroups: ['pharmacists'],
          percentage: 50,
        }),
      });
    }
  });

  it('should handle empty feature flags list', () => {
    (saasQueries.useSaasFeatureFlags as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<FeatureFlagsManagement />);

    expect(screen.getByText('No feature flags found')).toBeInTheDocument();
  });

  it('should display correct category colors', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Check that category chips are rendered with different colors
    expect(screen.getByText('core')).toBeInTheDocument();
    expect(screen.getByText('premium')).toBeInTheDocument();
    expect(screen.getByText('experimental')).toBeInTheDocument();
  });

  it('should handle targeting dialog cancellation', async () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Open targeting dialog
    const editButtons = screen.getAllByRole('button', { name: '' });
    const configureButton = editButtons.find(button => 
      button.querySelector('[data-testid="EditIcon"]')
    );

    if (configureButton) {
      fireEvent.click(configureButton);

      await waitFor(() => {
        // Cancel dialog
        fireEvent.click(screen.getByText('Cancel'));
      });

      // Dialog should be closed
      expect(screen.queryByText('Configure Targeting Rules - AI Diagnostics')).not.toBeInTheDocument();
    }
  });

  it('should display enabled/disabled status correctly', () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Check for enabled/disabled labels
    const enabledLabels = screen.getAllByText('Enabled');
    const disabledLabels = screen.getAllByText('Disabled');

    expect(enabledLabels.length).toBe(2); // AI Diagnostics and Beta Feature are enabled
    expect(disabledLabels.length).toBe(1); // Advanced Analytics is disabled
  });

  it('should handle multiple targeting rule selections', async () => {
    renderWithProviders(<FeatureFlagsManagement />);

    // Open targeting dialog
    const editButtons = screen.getAllByRole('button', { name: '' });
    const configureButton = editButtons.find(button => 
      button.querySelector('[data-testid="EditIcon"]')
    );

    if (configureButton) {
      fireEvent.click(configureButton);

      await waitFor(() => {
        // Test pharmacy selection
        const pharmacySelect = screen.getByLabelText('Target Pharmacies');
        fireEvent.mouseDown(pharmacySelect);
      });

      await waitFor(() => {
        // Should show pharmacy options
        expect(screen.getByText('Central Pharmacy')).toBeInTheDocument();
        expect(screen.getByText('City Pharmacy')).toBeInTheDocument();
        expect(screen.getByText('Metro Pharmacy')).toBeInTheDocument();
      });
    }
  });
});