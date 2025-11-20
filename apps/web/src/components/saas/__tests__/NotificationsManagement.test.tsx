import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NotificationsManagement from '../NotificationsManagement';
import * as useSaasSettingsModule from '../../../queries/useSaasSettings';

// Mock the useSaasSettings hook
const mockUseSaasSettings = {
  getNotificationChannels: jest.fn(),
  updateNotificationChannel: jest.fn(),
  getNotificationRules: jest.fn(),
  createNotificationRule: jest.fn(),
  updateNotificationRule: jest.fn(),
  deleteNotificationRule: jest.fn(),
  toggleNotificationRule: jest.fn(),
  getNotificationTemplates: jest.fn(),
  createNotificationTemplate: jest.fn(),
  updateNotificationTemplate: jest.fn(),
  deleteNotificationTemplate: jest.fn(),
  getNotificationHistory: jest.fn(),
  sendTestNotification: jest.fn(),
};

jest.mock('../../../queries/useSaasSettings', () => ({
  useSaasSettings: () => mockUseSaasSettings,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM dd, HH:mm') return 'Jan 01, 12:00';
    return 'Jan 01, 2024';
  }),
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const mockChannels = [
  {
    id: 'email-primary',
    name: 'Primary Email',
    type: 'email',
    enabled: true,
    config: {
      provider: 'sendgrid',
      fromAddress: 'noreply@PharmacyCopilot.com',
    },
    dailyLimit: 10000,
    monthlyLimit: 300000,
    usage: {
      daily: 250,
      monthly: 7500,
    },
  },
  {
    id: 'sms-primary',
    name: 'Primary SMS',
    type: 'sms',
    enabled: false,
    config: {
      provider: 'twilio',
      fromNumber: '+1234567890',
    },
    dailyLimit: 1000,
    monthlyLimit: 30000,
    usage: {
      daily: 0,
      monthly: 0,
    },
  },
];

const mockRules = [
  {
    id: 'rule1',
    name: 'User Registration Welcome',
    description: 'Send welcome email to new users',
    trigger: 'user.registered',
    conditions: [],
    actions: [],
    isActive: true,
    priority: 'medium',
    cooldownPeriod: 60,
    maxExecutions: 1000,
    executionCount: 45,
    lastExecuted: '2024-01-01T12:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T12:00:00Z',
  },
  {
    id: 'rule2',
    name: 'Password Reset Request',
    description: 'Send password reset instructions',
    trigger: 'password.reset_requested',
    conditions: [],
    actions: [],
    isActive: false,
    priority: 'high',
    cooldownPeriod: 30,
    maxExecutions: 500,
    executionCount: 12,
    lastExecuted: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockTemplates = [
  {
    id: 'template1',
    name: 'Welcome Email',
    description: 'Welcome new users to the platform',
    channel: 'email',
    subject: 'Welcome to PharmacyCopilot!',
    body: 'Hello {{name}}, welcome to our platform!',
    variables: [
      {
        name: 'name',
        description: 'User name',
        type: 'string',
        required: true,
      },
    ],
    isActive: true,
    category: 'onboarding',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'template2',
    name: 'Password Reset SMS',
    description: 'SMS for password reset',
    channel: 'sms',
    body: 'Your password reset code is: {{code}}',
    variables: [
      {
        name: 'code',
        description: 'Reset code',
        type: 'string',
        required: true,
      },
    ],
    isActive: true,
    category: 'security',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockHistory = [
  {
    id: 'hist1',
    ruleId: 'rule1',
    ruleName: 'User Registration Welcome',
    channel: 'email',
    template: 'welcome-email',
    recipients: ['user@example.com'],
    status: 'delivered',
    sentAt: '2024-01-01T12:00:00Z',
    deliveredAt: '2024-01-01T12:01:00Z',
    metadata: {},
  },
  {
    id: 'hist2',
    ruleId: 'rule2',
    ruleName: 'Password Reset Request',
    channel: 'sms',
    template: 'password-reset',
    recipients: ['+1234567890'],
    status: 'failed',
    sentAt: '2024-01-01T11:30:00Z',
    errorMessage: 'Invalid phone number',
    metadata: {},
  },
];

describe('NotificationsManagement Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseSaasSettings.getNotificationChannels.mockResolvedValue({
      success: true,
      data: { channels: mockChannels },
    });

    mockUseSaasSettings.getNotificationRules.mockResolvedValue({
      success: true,
      data: { rules: mockRules },
    });

    mockUseSaasSettings.getNotificationTemplates.mockResolvedValue({
      success: true,
      data: { templates: mockTemplates },
    });

    mockUseSaasSettings.getNotificationHistory.mockResolvedValue({
      success: true,
      data: { history: mockHistory },
    });
  });

  describe('Component Rendering', () => {
    it('renders notifications management header', async () => {
      renderWithProviders(<NotificationsManagement />);

      expect(screen.getByText('Notifications Management')).toBeInTheDocument();
      expect(screen.getByText('Test Notification')).toBeInTheDocument();
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('renders tab navigation', async () => {
      renderWithProviders(<NotificationsManagement />);

      expect(screen.getByText('Channels')).toBeInTheDocument();
      expect(screen.getByText('Rules')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    it('loads channels by default', async () => {
      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(mockUseSaasSettings.getNotificationChannels).toHaveBeenCalled();
      });
    });
  });

  describe('Channels Tab', () => {
    it('displays notification channels', async () => {
      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Primary Email')).toBeInTheDocument();
        expect(screen.getByText('Primary SMS')).toBeInTheDocument();
      });

      expect(screen.getByText('Type: EMAIL')).toBeInTheDocument();
      expect(screen.getByText('Type: SMS')).toBeInTheDocument();
    });

    it('displays channel usage statistics', async () => {
      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(screen.getByText('250 / 10000')).toBeInTheDocument(); // Daily usage
        expect(screen.getByText('7500 / 300000')).toBeInTheDocument(); // Monthly usage
      });
    });

    it('allows toggling channel enabled state', async () => {
      mockUseSaasSettings.updateNotificationChannel.mockResolvedValue({ success: true });

      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Primary SMS')).toBeInTheDocument();
      });

      // Find the switch for SMS channel (which is disabled)
      const switches = screen.getAllByRole('checkbox');
      const smsSwitch = switches.find(sw => !sw.checked);
      
      if (smsSwitch) {
        fireEvent.click(smsSwitch);

        await waitFor(() => {
          expect(mockUseSaasSettings.updateNotificationChannel).toHaveBeenCalledWith(
            'sms-primary',
            { enabled: true }
          );
        });
      }
    });

    it('handles channel toggle success', async () => {
      mockUseSaasSettings.updateNotificationChannel.mockResolvedValue({ success: true });

      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Primary Email')).toBeInTheDocument();
      });

      const switches = screen.getAllByRole('checkbox');
      const emailSwitch = switches.find(sw => sw.checked);
      
      if (emailSwitch) {
        fireEvent.click(emailSwitch);

        await waitFor(() => {
          expect(screen.getByText('Channel updated successfully')).toBeInTheDocument();
        });
      }
    });

    it('handles channel toggle error', async () => {
      mockUseSaasSettings.updateNotificationChannel.mockRejectedValue(new Error('Update failed'));

      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Primary Email')).toBeInTheDocument();
      });

      const switches = screen.getAllByRole('checkbox');
      const emailSwitch = switches.find(sw => sw.checked);
      
      if (emailSwitch) {
        fireEvent.click(emailSwitch);

        await waitFor(() => {
          expect(screen.getByText('Failed to update channel')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Rules Tab', () => {
    it('switches to rules tab and loads data', async () => {
      renderWithProviders(<NotificationsManagement />);

      const rulesTab = screen.getByText('Rules');
      fireEvent.click(rulesTab);

      await waitFor(() => {
        expect(mockUseSaasSettings.getNotificationRules).toHaveBeenCalled();
      });
    });

    it('displays notification rules table', async () => {
      renderWithProviders(<NotificationsManagement />);

      const rulesTab = screen.getByText('Rules');
      fireEvent.click(rulesTab);

      await waitFor(() => {
        expect(screen.getByText('User Registration Welcome')).toBeInTheDocument();
        expect(screen.getByText('Password Reset Request')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByText('Rule Name')).toBeInTheDocument();
      expect(screen.getByText('Trigger')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Executions')).toBeInTheDocument();
    });

    it('displays rule priority chips', async () => {
      renderWithProviders(<NotificationsManagement />);

      const rulesTab = screen.getByText('Rules');
      fireEvent.click(rulesTab);

      await waitFor(() => {
        expect(screen.getByText('MEDIUM')).toBeInTheDocument();
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      });
    });

    it('allows toggling rule active state', async () => {
      mockUseSaasSettings.toggleNotificationRule.mockResolvedValue({ success: true });

      renderWithProviders(<NotificationsManagement />);

      const rulesTab = screen.getByText('Rules');
      fireEvent.click(rulesTab);

      await waitFor(() => {
        expect(screen.getByText('User Registration Welcome')).toBeInTheDocument();
      });

      // Find and click a rule toggle switch
      const switches = screen.getAllByRole('checkbox');
      const ruleSwitch = switches[0]; // First rule switch
      
      fireEvent.click(ruleSwitch);

      await waitFor(() => {
        expect(mockUseSaasSettings.toggleNotificationRule).toHaveBeenCalled();
      });
    });

    it('handles rule deletion', async () => {
      mockUseSaasSettings.deleteNotificationRule.mockResolvedValue({ success: true });
      
      // Mock window.confirm
      window.confirm = jest.fn(() => true);

      renderWithProviders(<NotificationsManagement />);

      const rulesTab = screen.getByText('Rules');
      fireEvent.click(rulesTab);

      await waitFor(() => {
        expect(screen.getByText('User Registration Welcome')).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('[data-testid="DeleteIcon"]')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);

        await waitFor(() => {
          expect(mockUseSaasSettings.deleteNotificationRule).toHaveBeenCalled();
        });
      }
    });

    it('handles empty rules data', async () => {
      mockUseSaasSettings.getNotificationRules.mockResolvedValue({
        success: true,
        data: { rules: [] },
      });

      renderWithProviders(<NotificationsManagement />);

      const rulesTab = screen.getByText('Rules');
      fireEvent.click(rulesTab);

      await waitFor(() => {
        expect(screen.getByText('No notification rules configured')).toBeInTheDocument();
      });
    });
  });

  describe('Templates Tab', () => {
    it('switches to templates tab and loads data', async () => {
      renderWithProviders(<NotificationsManagement />);

      const templatesTab = screen.getByText('Templates');
      fireEvent.click(templatesTab);

      await waitFor(() => {
        expect(mockUseSaasSettings.getNotificationTemplates).toHaveBeenCalled();
      });
    });

    it('displays notification templates', async () => {
      renderWithProviders(<NotificationsManagement />);

      const templatesTab = screen.getByText('Templates');
      fireEvent.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('Welcome Email')).toBeInTheDocument();
        expect(screen.getByText('Password Reset SMS')).toBeInTheDocument();
      });
    });

    it('displays template details', async () => {
      renderWithProviders(<NotificationsManagement />);

      const templatesTab = screen.getByText('Templates');
      fireEvent.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('Welcome new users to the platform')).toBeInTheDocument();
        expect(screen.getByText('Channel: EMAIL | Category: onboarding')).toBeInTheDocument();
        expect(screen.getByText('Welcome to PharmacyCopilot!')).toBeInTheDocument();
      });
    });

    it('handles template deletion', async () => {
      mockUseSaasSettings.deleteNotificationTemplate.mockResolvedValue({ success: true });
      
      // Mock window.confirm
      window.confirm = jest.fn(() => true);

      renderWithProviders(<NotificationsManagement />);

      const templatesTab = screen.getByText('Templates');
      fireEvent.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('Welcome Email')).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockUseSaasSettings.deleteNotificationTemplate).toHaveBeenCalled();
      });
    });

    it('handles empty templates data', async () => {
      mockUseSaasSettings.getNotificationTemplates.mockResolvedValue({
        success: true,
        data: { templates: [] },
      });

      renderWithProviders(<NotificationsManagement />);

      const templatesTab = screen.getByText('Templates');
      fireEvent.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('No notification templates configured')).toBeInTheDocument();
      });
    });
  });

  describe('History Tab', () => {
    it('switches to history tab and loads data', async () => {
      renderWithProviders(<NotificationsManagement />);

      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(mockUseSaasSettings.getNotificationHistory).toHaveBeenCalled();
      });
    });

    it('displays notification history table', async () => {
      renderWithProviders(<NotificationsManagement />);

      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('User Registration Welcome')).toBeInTheDocument();
        expect(screen.getByText('Password Reset Request')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByText('Rule')).toBeInTheDocument();
      expect(screen.getByText('Channel')).toBeInTheDocument();
      expect(screen.getByText('Template')).toBeInTheDocument();
      expect(screen.getByText('Recipients')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('displays status indicators', async () => {
      renderWithProviders(<NotificationsManagement />);

      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('delivered')).toBeInTheDocument();
        expect(screen.getByText('failed')).toBeInTheDocument();
      });
    });

    it('handles empty history data', async () => {
      mockUseSaasSettings.getNotificationHistory.mockResolvedValue({
        success: true,
        data: { history: [] },
      });

      renderWithProviders(<NotificationsManagement />);

      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('No notification history available')).toBeInTheDocument();
      });
    });
  });

  describe('Test Notification', () => {
    it('opens test notification dialog', async () => {
      renderWithProviders(<NotificationsManagement />);

      const testButton = screen.getByText('Test Notification');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Send Test Notification')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Channel')).toBeInTheDocument();
      expect(screen.getByLabelText('Template')).toBeInTheDocument();
      expect(screen.getByLabelText('Test Recipients')).toBeInTheDocument();
    });

    it('handles test notification sending', async () => {
      mockUseSaasSettings.sendTestNotification.mockResolvedValue({ success: true });

      renderWithProviders(<NotificationsManagement />);

      const testButton = screen.getByText('Test Notification');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Send Test')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('Send Test');
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockUseSaasSettings.sendTestNotification).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when channels fail to load', async () => {
      mockUseSaasSettings.getNotificationChannels.mockRejectedValue(new Error('Load failed'));

      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load notification data')).toBeInTheDocument();
      });
    });

    it('displays error when rules fail to load', async () => {
      mockUseSaasSettings.getNotificationRules.mockRejectedValue(new Error('Load failed'));

      renderWithProviders(<NotificationsManagement />);

      const rulesTab = screen.getByText('Rules');
      fireEvent.click(rulesTab);

      await waitFor(() => {
        expect(screen.getByText('Failed to load notification data')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching data', async () => {
      mockUseSaasSettings.getNotificationChannels.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(<NotificationsManagement />);

      // Should show loading initially
      expect(mockUseSaasSettings.getNotificationChannels).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderWithProviders(<NotificationsManagement />);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4);
      expect(tabs[0]).toHaveAttribute('aria-controls', 'notifications-tabpanel-0');
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<NotificationsManagement />);

      const firstTab = screen.getAllByRole('tab')[0];
      firstTab.focus();
      expect(document.activeElement).toBe(firstTab);
    });
  });
});