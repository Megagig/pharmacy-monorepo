import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MTRNotificationPreferences from '../MTRNotificationPreferences';
import { mtrNotificationService } from '../../services/mtrNotificationService';

// Mock the notification service
vi.mock('../../services/mtrNotificationService');

const mockMtrNotificationService =
  mtrNotificationService as typeof mtrNotificationService;

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
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('MTRNotificationPreferences', () => {
  const mockPreferences = {
    email: true,
    sms: false,
    push: true,
    followUpReminders: true,
    criticalAlerts: true,
    dailyDigest: false,
    weeklyReport: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMtrNotificationService.getNotificationPreferences = vi
      .fn()
      .mockResolvedValue(mockPreferences);
    mockMtrNotificationService.updateNotificationPreferences = vi
      .fn()
      .mockResolvedValue(undefined);
    mockMtrNotificationService.sendTestNotification = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  it('renders notification preferences form', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Communication Channels')).toBeInTheDocument();
    expect(screen.getByText('Notification Types')).toBeInTheDocument();
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('SMS Notifications')).toBeInTheDocument();
    expect(screen.getByText('Follow-up Reminders')).toBeInTheDocument();
    expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
  });

  it('loads and displays current preferences', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        mockMtrNotificationService.getNotificationPreferences
      ).toHaveBeenCalled();
    });

    // Check that switches reflect the current preferences
    const emailSwitch = screen.getByRole('checkbox', {
      name: /email notifications/i,
    });
    const smsSwitch = screen.getByRole('checkbox', {
      name: /sms notifications/i,
    });
    const followUpSwitch = screen.getByRole('checkbox', {
      name: /follow-up reminders/i,
    });

    expect(emailSwitch).toBeChecked(); // email: true
    expect(smsSwitch).not.toBeChecked(); // sms: false
    expect(followUpSwitch).toBeChecked(); // followUpReminders: true
  });

  it('enables save button when preferences are changed', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', {
      name: /save preferences/i,
    });
    expect(saveButton).toBeDisabled();

    // Change a preference
    const smsSwitch = screen.getByRole('checkbox', {
      name: /sms notifications/i,
    });
    fireEvent.click(smsSwitch);

    expect(saveButton).toBeEnabled();
  });

  it('saves preferences when save button is clicked', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    // Change a preference
    const smsSwitch = screen.getByRole('checkbox', {
      name: /sms notifications/i,
    });
    fireEvent.click(smsSwitch);

    // Click save
    const saveButton = screen.getByRole('button', {
      name: /save preferences/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        mockMtrNotificationService.updateNotificationPreferences
      ).toHaveBeenCalledWith({
        ...mockPreferences,
        sms: true, // Changed from false to true
      });
    });
  });

  it('resets preferences when reset button is clicked', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    // Change a preference
    const smsSwitch = screen.getByRole('checkbox', {
      name: /sms notifications/i,
    });
    fireEvent.click(smsSwitch);

    // Verify the change
    expect(smsSwitch).toBeChecked();

    // Click reset
    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    // Verify the preference is reset
    expect(smsSwitch).not.toBeChecked();
  });

  it('sends test email notification', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    // Find and click the test email button
    const testButtons = screen.getAllByRole('button', { name: /test/i });
    const emailTestButton = testButtons[0]; // First test button should be for email

    fireEvent.click(emailTestButton);

    await waitFor(() => {
      expect(
        mockMtrNotificationService.sendTestNotification
      ).toHaveBeenCalledWith('email');
    });

    // Check for success message
    await waitFor(() => {
      expect(
        screen.getByText(/test email notification sent/i)
      ).toBeInTheDocument();
    });
  });

  it('displays error message when save fails', async () => {
    mockMtrNotificationService.updateNotificationPreferences = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    // Change a preference
    const smsSwitch = screen.getByRole('checkbox', {
      name: /sms notifications/i,
    });
    fireEvent.click(smsSwitch);

    // Click save
    const saveButton = screen.getByRole('button', {
      name: /save preferences/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(/failed to update notification preferences/i)
      ).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching preferences', () => {
    // Mock a pending promise
    mockMtrNotificationService.getNotificationPreferences = vi
      .fn()
      .mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

    renderWithProviders(<MTRNotificationPreferences />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays important notes about notification behavior', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/critical alerts will always be sent via email/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sms notifications require a valid phone number/i)
    ).toBeInTheDocument();
  });

  it('shows coming soon chip for push notifications', async () => {
    renderWithProviders(<MTRNotificationPreferences />);

    await waitFor(() => {
      expect(
        screen.getByText('MTR Notification Preferences')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });
});
