import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NotificationPreferencesForm from '../NotificationPreferencesForm';
import * as notificationPreferencesQueries from '../../../queries/usePatientNotificationPreferences';

// Mock the queries
vi.mock('../../../queries/usePatientNotificationPreferences');

const mockUsePatientNotificationPreferences = vi.mocked(notificationPreferencesQueries.usePatientNotificationPreferences);
const mockUseUpdatePatientNotificationPreferences = vi.mocked(notificationPreferencesQueries.useUpdatePatientNotificationPreferences);
const mockUsePatientOptOutStatus = vi.mocked(notificationPreferencesQueries.usePatientOptOutStatus);
const mockUseUpdatePatientOptOutStatus = vi.mocked(notificationPreferencesQueries.useUpdatePatientOptOutStatus);

const mockPreferences = {
  email: true,
  sms: false,
  push: true,
  whatsapp: false,
  language: 'en' as const,
  timezone: 'Africa/Lagos',
  optOut: false,
  channels: {
    appointmentReminders: {
      email: true,
      sms: false,
      push: true,
      whatsapp: false,
    },
    medicationRefills: {
      email: true,
      sms: false,
      push: true,
      whatsapp: false,
    },
    adherenceChecks: {
      email: true,
      sms: false,
      push: true,
      whatsapp: false,
    },
    clinicalFollowups: {
      email: true,
      sms: false,
      push: true,
      whatsapp: false,
    },
    generalNotifications: {
      email: true,
      sms: false,
      push: true,
      whatsapp: false,
    },
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

const mockOptOutStatus = {
  optedOut: false,
  preferences: {
    email: true,
    sms: false,
    push: true,
    whatsapp: false,
  },
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        {children}
      </SnackbarProvider>
    </QueryClientProvider>
  );
};

describe('NotificationPreferencesForm', () => {
  const mockUpdatePreferences = vi.fn();
  const mockUpdateOptOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsePatientNotificationPreferences.mockReturnValue({
      data: mockPreferences,
      isLoading: false,
      error: null,
    } as any);

    mockUsePatientOptOutStatus.mockReturnValue({
      data: mockOptOutStatus,
      isLoading: false,
    } as any);

    mockUseUpdatePatientNotificationPreferences.mockReturnValue({
      mutateAsync: mockUpdatePreferences,
      isPending: false,
    } as any);

    mockUseUpdatePatientOptOutStatus.mockReturnValue({
      mutateAsync: mockUpdateOptOut,
      isPending: false,
    } as any);
  });

  it('renders notification preferences form', () => {
    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" />
      </TestWrapper>
    );

    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText('Global Settings')).toBeInTheDocument();
    expect(screen.getByText('Notification Types')).toBeInTheDocument();
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    mockUsePatientNotificationPreferences.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error state', () => {
    mockUsePatientNotificationPreferences.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to load notification preferences. Please try again.')).toBeInTheDocument();
  });

  it('shows opt-out toggle when showOptOut is true', () => {
    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" showOptOut={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Opt out of all notifications')).toBeInTheDocument();
  });

  it('hides opt-out toggle when showOptOut is false', () => {
    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" showOptOut={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('Opt out of all notifications')).not.toBeInTheDocument();
  });

  it('handles language change', async () => {
    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" />
      </TestWrapper>
    );

    const languageSelect = screen.getByLabelText('Language');
    fireEvent.mouseDown(languageSelect);
    
    const yorubaOption = screen.getByText('Yoruba');
    fireEvent.click(yorubaOption);

    // Should show unsaved changes message
    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes. Click "Save Preferences" to apply them.')).toBeInTheDocument();
    });

    // Save button should be enabled
    const saveButton = screen.getByText('Save Preferences');
    expect(saveButton).not.toBeDisabled();
  });

  it('handles channel preference changes', async () => {
    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" />
      </TestWrapper>
    );

    // Expand appointment reminders section
    const appointmentRemindersSection = screen.getByText('Appointment Reminders');
    fireEvent.click(appointmentRemindersSection);

    // Find and toggle SMS switch for appointment reminders
    const smsSwitch = screen.getAllByRole('checkbox').find(checkbox => 
      checkbox.closest('.MuiFormControlLabel-root')?.textContent?.includes('SMS')
    );
    
    if (smsSwitch) {
      fireEvent.click(smsSwitch);
    }

    // Should show unsaved changes message
    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes. Click "Save Preferences" to apply them.')).toBeInTheDocument();
    });
  });

  it('handles quiet hours toggle', async () => {
    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" />
      </TestWrapper>
    );

    const quietHoursSwitch = screen.getByLabelText('Enable quiet hours');
    fireEvent.click(quietHoursSwitch);

    // Should show time inputs
    await waitFor(() => {
      expect(screen.getByLabelText('Start Time')).toBeInTheDocument();
      expect(screen.getByLabelText('End Time')).toBeInTheDocument();
    });

    // Should show unsaved changes message
    expect(screen.getByText('You have unsaved changes. Click "Save Preferences" to apply them.')).toBeInTheDocument();
  });

  it('saves preferences when save button is clicked', async () => {
    mockUpdatePreferences.mockResolvedValue({
      data: {
        preferences: mockPreferences,
        message: 'Preferences updated successfully',
      },
    });

    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" />
      </TestWrapper>
    );

    // Make a change to enable save button
    const languageSelect = screen.getByLabelText('Language');
    fireEvent.mouseDown(languageSelect);
    const yorubaOption = screen.getByText('Yoruba');
    fireEvent.click(yorubaOption);

    // Click save button
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        patientId: 'patient-123',
        preferences: expect.objectContaining({
          language: 'yo',
        }),
      });
    });
  });

  it('handles opt-out toggle', async () => {
    mockUpdateOptOut.mockResolvedValue({
      data: {
        optedOut: true,
        message: 'Patient opted out of all notifications',
      },
    });

    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" showOptOut={true} />
      </TestWrapper>
    );

    const optOutSwitch = screen.getByLabelText('Opt out of all notifications');
    fireEvent.click(optOutSwitch);

    await waitFor(() => {
      expect(mockUpdateOptOut).toHaveBeenCalledWith({
        patientId: 'patient-123',
        optOut: true,
      });
    });
  });

  it('disables form when patient is opted out', () => {
    mockUsePatientOptOutStatus.mockReturnValue({
      data: { ...mockOptOutStatus, optedOut: true },
      isLoading: false,
    } as any);

    render(
      <TestWrapper>
        <NotificationPreferencesForm patientId="patient-123" showOptOut={true} />
      </TestWrapper>
    );

    // Language select should be disabled
    const languageSelect = screen.getByLabelText('Language');
    expect(languageSelect).toBeDisabled();

    // Save button should be disabled
    const saveButton = screen.getByText('Save Preferences');
    expect(saveButton).toBeDisabled();
  });

  it('calls onSave callback when preferences are saved', async () => {
    const mockOnSave = vi.fn();
    
    mockUpdatePreferences.mockResolvedValue({
      data: {
        preferences: mockPreferences,
        message: 'Preferences updated successfully',
      },
    });

    render(
      <TestWrapper>
        <NotificationPreferencesForm 
          patientId="patient-123" 
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    // Make a change and save
    const languageSelect = screen.getByLabelText('Language');
    fireEvent.mouseDown(languageSelect);
    const yorubaOption = screen.getByText('Yoruba');
    fireEvent.click(yorubaOption);

    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(mockPreferences);
    });
  });
});