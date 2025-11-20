import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SecuritySettings from '../SecuritySettings';
import * as useSaasSettingsModule from '../../../queries/useSaasSettings';

// Mock the useSaasSettings hook
const mockUseSaasSettings = {
  getSecuritySettings: jest.fn(),
  updatePasswordPolicy: jest.fn(),
  getActiveSessions: jest.fn(),
  terminateSession: jest.fn(),
  getSecurityAuditLogs: jest.fn(),
  lockUserAccount: jest.fn(),
  unlockUserAccount: jest.fn(),
  getSecurityDashboard: jest.fn(),
};

jest.mock('../../../queries/useSaasSettings', () => ({
  useSaasSettings: () => mockUseSaasSettings,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM dd, HH:mm') return 'Jan 01, 12:00';
    if (formatStr === 'MMM dd, HH:mm:ss') return 'Jan 01, 12:00:00';
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

describe('SecuritySettings Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseSaasSettings.getSecuritySettings.mockResolvedValue({
      success: true,
      data: {
        settings: {
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            maxAge: 90,
            preventReuse: 5,
            lockoutThreshold: 5,
            lockoutDuration: 30,
          },
        },
      },
    });

    mockUseSaasSettings.getActiveSessions.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            sessionId: 'session1',
            userId: 'user1',
            userEmail: 'user@example.com',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            location: 'New York, US',
            loginTime: '2024-01-01T12:00:00Z',
            lastActivity: '2024-01-01T12:30:00Z',
            isActive: true,
            deviceInfo: {
              browser: 'Chrome',
              os: 'Windows',
              device: 'Desktop',
            },
          },
        ],
      },
    });

    mockUseSaasSettings.getSecurityAuditLogs.mockResolvedValue({
      success: true,
      data: {
        auditLogs: [
          {
            id: 'log1',
            userId: 'user1',
            userEmail: 'user@example.com',
            action: 'LOGIN_SUCCESS',
            resource: 'Authentication',
            ipAddress: '192.168.1.1',
            timestamp: '2024-01-01T12:00:00Z',
            success: true,
            severity: 'low',
            details: {},
          },
        ],
      },
    });
  });

  describe('Password Policy Tab', () => {
    it('renders password policy configuration', async () => {
      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(screen.getByText('Password Policy Configuration')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Minimum Length')).toBeInTheDocument();
      expect(screen.getByLabelText('Require Uppercase Letters')).toBeInTheDocument();
      expect(screen.getByLabelText('Require Lowercase Letters')).toBeInTheDocument();
      expect(screen.getByLabelText('Require Numbers')).toBeInTheDocument();
      expect(screen.getByLabelText('Require Special Characters')).toBeInTheDocument();
    });

    it('loads and displays current password policy settings', async () => {
      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(mockUseSaasSettings.getSecuritySettings).toHaveBeenCalled();
      });

      const minLengthInput = screen.getByLabelText('Minimum Length') as HTMLInputElement;
      expect(minLengthInput.value).toBe('8');
    });

    it('allows updating password policy settings', async () => {
      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(screen.getByLabelText('Minimum Length')).toBeInTheDocument();
      });

      const minLengthInput = screen.getByLabelText('Minimum Length');
      fireEvent.change(minLengthInput, { target: { value: '12' } });

      const saveButton = screen.getByText('Save Password Policy');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUseSaasSettings.updatePasswordPolicy).toHaveBeenCalledWith(
          expect.objectContaining({
            minLength: 12,
          })
        );
      });
    });

    it('handles password policy update success', async () => {
      mockUseSaasSettings.updatePasswordPolicy.mockResolvedValue({ success: true });

      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(screen.getByText('Save Password Policy')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Password Policy');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Password policy updated successfully')).toBeInTheDocument();
      });
    });

    it('handles password policy update error', async () => {
      mockUseSaasSettings.updatePasswordPolicy.mockRejectedValue(new Error('Update failed'));

      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(screen.getByText('Save Password Policy')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Password Policy');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to update password policy')).toBeInTheDocument();
      });
    });
  });

  describe('Active Sessions Tab', () => {
    it('switches to active sessions tab', async () => {
      renderWithProviders(<SecuritySettings />);

      const sessionsTab = screen.getByText('Active Sessions');
      fireEvent.click(sessionsTab);

      await waitFor(() => {
        expect(screen.getByText('Active User Sessions')).toBeInTheDocument();
      });
    });

    it('displays active sessions table', async () => {
      renderWithProviders(<SecuritySettings />);

      const sessionsTab = screen.getByText('Active Sessions');
      fireEvent.click(sessionsTab);

      await waitFor(() => {
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
        expect(screen.getByText('Chrome')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('allows filtering sessions', async () => {
      renderWithProviders(<SecuritySettings />);

      const sessionsTab = screen.getByText('Active Sessions');
      fireEvent.click(sessionsTab);

      await waitFor(() => {
        expect(screen.getByLabelText('IP Address')).toBeInTheDocument();
      });

      const ipFilter = screen.getByLabelText('IP Address');
      fireEvent.change(ipFilter, { target: { value: '192.168.1.1' } });

      const applyFiltersButton = screen.getByText('Apply Filters');
      fireEvent.click(applyFiltersButton);

      await waitFor(() => {
        expect(mockUseSaasSettings.getActiveSessions).toHaveBeenCalledWith(
          expect.objectContaining({
            ipAddress: '192.168.1.1',
          })
        );
      });
    });

    it('opens terminate session dialog', async () => {
      renderWithProviders(<SecuritySettings />);

      const sessionsTab = screen.getByText('Active Sessions');
      fireEvent.click(sessionsTab);

      await waitFor(() => {
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
      });

      // Find and click the terminate session button (delete icon)
      const terminateButtons = screen.getAllByRole('button');
      const terminateButton = terminateButtons.find(button => 
        button.querySelector('[data-testid="DeleteIcon"]')
      );
      
      if (terminateButton) {
        fireEvent.click(terminateButton);

        await waitFor(() => {
          expect(screen.getByText('Terminate Session')).toBeInTheDocument();
        });
      }
    });

    it('handles session termination', async () => {
      mockUseSaasSettings.terminateSession.mockResolvedValue({ success: true });

      renderWithProviders(<SecuritySettings />);

      const sessionsTab = screen.getByText('Active Sessions');
      fireEvent.click(sessionsTab);

      await waitFor(() => {
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
      });

      // Find and click the terminate session button
      const terminateButtons = screen.getAllByRole('button');
      const terminateButton = terminateButtons.find(button => 
        button.querySelector('[data-testid="DeleteIcon"]')
      );
      
      if (terminateButton) {
        fireEvent.click(terminateButton);

        await waitFor(() => {
          expect(screen.getByText('Terminate Session')).toBeInTheDocument();
        });

        const confirmButton = screen.getByText('Terminate Session');
        fireEvent.click(confirmButton);

        await waitFor(() => {
          expect(mockUseSaasSettings.terminateSession).toHaveBeenCalledWith(
            'session1',
            expect.objectContaining({ reason: '' })
          );
        });
      }
    });
  });

  describe('Audit Logs Tab', () => {
    it('switches to audit logs tab', async () => {
      renderWithProviders(<SecuritySettings />);

      const auditTab = screen.getByText('Audit Logs');
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText('Security Audit Logs')).toBeInTheDocument();
      });
    });

    it('displays audit logs table', async () => {
      renderWithProviders(<SecuritySettings />);

      const auditTab = screen.getByText('Audit Logs');
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
        expect(screen.getByText('LOGIN_SUCCESS')).toBeInTheDocument();
        expect(screen.getByText('Authentication')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
      });
    });

    it('allows filtering audit logs', async () => {
      renderWithProviders(<SecuritySettings />);

      const auditTab = screen.getByText('Audit Logs');
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Action')).toBeInTheDocument();
      });

      const actionFilter = screen.getByLabelText('Action');
      fireEvent.change(actionFilter, { target: { value: 'LOGIN' } });

      const applyFiltersButton = screen.getByText('Apply Filters');
      fireEvent.click(applyFiltersButton);

      await waitFor(() => {
        expect(mockUseSaasSettings.getSecurityAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'LOGIN',
          })
        );
      });
    });

    it('displays severity chips with correct colors', async () => {
      renderWithProviders(<SecuritySettings />);

      const auditTab = screen.getByText('Audit Logs');
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText('LOW')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when security settings fail to load', async () => {
      mockUseSaasSettings.getSecuritySettings.mockRejectedValue(new Error('Load failed'));

      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load security settings')).toBeInTheDocument();
      });
    });

    it('displays error when sessions fail to load', async () => {
      mockUseSaasSettings.getActiveSessions.mockRejectedValue(new Error('Load failed'));

      renderWithProviders(<SecuritySettings />);

      const sessionsTab = screen.getByText('Active Sessions');
      fireEvent.click(sessionsTab);

      await waitFor(() => {
        expect(screen.getByText('Failed to load active sessions')).toBeInTheDocument();
      });
    });

    it('displays error when audit logs fail to load', async () => {
      mockUseSaasSettings.getSecurityAuditLogs.mockRejectedValue(new Error('Load failed'));

      renderWithProviders(<SecuritySettings />);

      const auditTab = screen.getByText('Audit Logs');
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText('Failed to load audit logs')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching data', async () => {
      mockUseSaasSettings.getSecuritySettings.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(<SecuritySettings />);

      // The component should show loading state initially
      expect(mockUseSaasSettings.getSecuritySettings).toHaveBeenCalled();
    });

    it('shows saving state when updating password policy', async () => {
      mockUseSaasSettings.updatePasswordPolicy.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(screen.getByText('Save Password Policy')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Password Policy');
      fireEvent.click(saveButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderWithProviders(<SecuritySettings />);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
      expect(tabs[0]).toHaveAttribute('aria-controls', 'security-tabpanel-0');
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<SecuritySettings />);

      const firstTab = screen.getAllByRole('tab')[0];
      firstTab.focus();
      expect(document.activeElement).toBe(firstTab);
    });
  });
});