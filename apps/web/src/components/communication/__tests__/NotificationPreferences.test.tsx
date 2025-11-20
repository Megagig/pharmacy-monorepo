import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import NotificationPreferencesDialog from '../NotificationPreferences';

// Mock audio
global.Audio = vi.fn().mockImplementation(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  volume: 0.5,
}));

// Mock Notification API
Object.defineProperty(global, 'Notification', {
  value: vi.fn(),
  configurable: true,
});

Object.defineProperty(global.Notification, 'permission', {
  value: 'default',
  configurable: true,
});

Object.defineProperty(global.Notification, 'requestPermission', {
  value: vi.fn().mockResolvedValue('granted'),
  configurable: true,
});

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('NotificationPreferencesDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders dialog with title', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    it('renders all preference sections', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      expect(screen.getByText('General Settings')).toBeInTheDocument();
      expect(screen.getByText('Delivery Channels')).toBeInTheDocument();
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
      expect(screen.getByText('Timing & Frequency')).toBeInTheDocument();
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
    });

    it('renders with initial preferences', () => {
      const initialPreferences = {
        enabled: false,
        soundEnabled: false,
        emailNotifications: true,
      };

      renderWithTheme(
        <NotificationPreferencesDialog
          {...defaultProps}
          initialPreferences={initialPreferences}
        />
      );

      expect(
        screen.getByRole('checkbox', { name: /enable notifications/i })
      ).not.toBeChecked();
      expect(
        screen.getByRole('checkbox', { name: /sound notifications/i })
      ).not.toBeChecked();
      expect(
        screen.getByRole('checkbox', { name: /email notifications/i })
      ).toBeChecked();
    });

    it('does not render when closed', () => {
      renderWithTheme(
        <NotificationPreferencesDialog {...defaultProps} open={false} />
      );

      expect(
        screen.queryByText('Notification Preferences')
      ).not.toBeInTheDocument();
    });
  });

  describe('General Settings', () => {
    it('toggles notification enabled state', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const enableSwitch = screen.getByRole('checkbox', {
        name: /enable notifications/i,
      });
      expect(enableSwitch).toBeChecked();

      await user.click(enableSwitch);
      expect(enableSwitch).not.toBeChecked();
    });

    it('toggles sound notifications', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      expect(soundSwitch).toBeChecked();

      await user.click(soundSwitch);
      expect(soundSwitch).not.toBeChecked();
    });

    it('shows sound volume slider when sound is enabled', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      expect(screen.getByText('Sound Volume')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('hides sound volume slider when sound is disabled', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      await user.click(soundSwitch);

      expect(screen.queryByText('Sound Volume')).not.toBeInTheDocument();
    });

    it('plays test sound when test button is clicked', async () => {
      const user = userEvent.setup();
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        volume: 0.5,
      };
      (global.Audio as any).mockImplementation(() => mockAudio);

      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const testButton = screen.getByText('Test');
      await user.click(testButton);

      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('disables sound controls when notifications are disabled', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const enableSwitch = screen.getByRole('checkbox', {
        name: /enable notifications/i,
      });
      await user.click(enableSwitch);

      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      expect(soundSwitch).toBeDisabled();
    });
  });

  describe('Delivery Channels', () => {
    it('toggles in-app notifications', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const inAppSwitch = screen.getByRole('checkbox', {
        name: /in-app notifications/i,
      });
      expect(inAppSwitch).toBeChecked();

      await user.click(inAppSwitch);
      expect(inAppSwitch).not.toBeChecked();
    });

    it('toggles desktop notifications', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const desktopSwitch = screen.getByRole('checkbox', {
        name: /desktop notifications/i,
      });
      expect(desktopSwitch).toBeChecked();

      await user.click(desktopSwitch);
      expect(desktopSwitch).not.toBeChecked();
    });

    it('shows enable button for desktop notifications when permission is default', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    it('shows blocked chip when desktop notifications are denied', () => {
      Object.defineProperty(global.Notification, 'permission', {
        value: 'denied',
        configurable: true,
      });

      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });

    it('requests desktop notification permission when enable is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const enableButton = screen.getByText('Enable');
      await user.click(enableButton);

      expect(global.Notification.requestPermission).toHaveBeenCalled();
    });
  });

  describe('Notification Types', () => {
    const notificationTypes = [
      'New messages',
      '@Mentions',
      'Therapy updates',
      'Clinical alerts',
      'Urgent messages',
      'Patient queries',
      'System notifications',
    ];

    notificationTypes.forEach((type) => {
      it(`toggles ${type} notifications`, async () => {
        const user = userEvent.setup();
        renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

        const typeSwitch = screen.getByRole('checkbox', {
          name: new RegExp(type, 'i'),
        });
        const initialState = typeSwitch.checked;

        await user.click(typeSwitch);
        expect(typeSwitch.checked).toBe(!initialState);
      });
    });
  });

  describe('Timing and Frequency', () => {
    it('toggles quiet hours', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const quietHoursSwitch = screen.getByRole('checkbox', {
        name: /quiet hours/i,
      });
      expect(quietHoursSwitch).not.toBeChecked();

      await user.click(quietHoursSwitch);
      expect(quietHoursSwitch).toBeChecked();
    });

    it('shows quiet hours time selectors when enabled', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const quietHoursSwitch = screen.getByRole('checkbox', {
        name: /quiet hours/i,
      });
      await user.click(quietHoursSwitch);

      expect(screen.getByLabelText('Start')).toBeInTheDocument();
      expect(screen.getByLabelText('End')).toBeInTheDocument();
    });

    it('toggles urgent bypass quiet hours', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      // First enable quiet hours
      const quietHoursSwitch = screen.getByRole('checkbox', {
        name: /quiet hours/i,
      });
      await user.click(quietHoursSwitch);

      const bypassSwitch = screen.getByRole('checkbox', {
        name: /urgent notifications bypass quiet hours/i,
      });
      expect(bypassSwitch).toBeChecked();

      await user.click(bypassSwitch);
      expect(bypassSwitch).not.toBeChecked();
    });

    it('disables bypass option when quiet hours are disabled', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const bypassSwitch = screen.getByRole('checkbox', {
        name: /urgent notifications bypass quiet hours/i,
      });
      expect(bypassSwitch).toBeDisabled();
    });
  });

  describe('Advanced Settings', () => {
    it('adjusts maximum notifications per hour slider', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const slider = screen.getByRole('slider', {
        name: /maximum notifications per hour/i,
      });

      // Simulate slider change
      fireEvent.change(slider, { target: { value: 50 } });

      expect(
        screen.getByText('Maximum notifications per hour: 50')
      ).toBeInTheDocument();
    });

    it('adjusts auto-mark as read slider', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const slider = screen.getByRole('slider', {
        name: /auto-mark as read after/i,
      });

      // Simulate slider change
      fireEvent.change(slider, { target: { value: 30 } });

      expect(
        screen.getByText('Auto-mark as read after: 30 minutes')
      ).toBeInTheDocument();
    });

    it('shows disabled when auto-mark is set to 0', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      expect(
        screen.getByText('Auto-mark as read after: Disabled')
      ).toBeInTheDocument();
    });

    it('toggles group similar notifications', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const groupSwitch = screen.getByRole('checkbox', {
        name: /group similar notifications/i,
      });
      expect(groupSwitch).toBeChecked();

      await user.click(groupSwitch);
      expect(groupSwitch).not.toBeChecked();
    });

    it('toggles show message preview', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const previewSwitch = screen.getByRole('checkbox', {
        name: /show message preview/i,
      });
      expect(previewSwitch).toBeChecked();

      await user.click(previewSwitch);
      expect(previewSwitch).not.toBeChecked();
    });
  });

  describe('Actions', () => {
    it('calls onClose when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithTheme(
        <NotificationPreferencesDialog {...defaultProps} onClose={onClose} />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when X button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithTheme(
        <NotificationPreferencesDialog {...defaultProps} onClose={onClose} />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onSave with preferences when save is clicked', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      renderWithTheme(
        <NotificationPreferencesDialog {...defaultProps} onSave={onSave} />
      );

      // Make a change to enable save button
      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      await user.click(soundSwitch);

      const saveButton = screen.getByText('Save Preferences');
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          soundEnabled: false,
        })
      );
    });

    it('disables save button when no changes are made', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const saveButton = screen.getByText('Save Preferences');
      expect(saveButton).toBeDisabled();
    });

    it('enables save button when changes are made', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      await user.click(soundSwitch);

      const saveButton = screen.getByText('Save Preferences');
      expect(saveButton).not.toBeDisabled();
    });

    it('resets to defaults when reset button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      // Make some changes
      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      await user.click(soundSwitch);

      const resetButton = screen.getByRole('button', {
        name: /reset to defaults/i,
      });
      await user.click(resetButton);

      // Should be back to default state
      expect(soundSwitch).toBeChecked();
    });

    it('shows unsaved changes alert when changes are made', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      await user.click(soundSwitch);

      expect(
        screen.getByText(
          'You have unsaved changes. Click "Save" to apply them.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for all controls', () => {
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /close/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /reset to defaults/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      // Tab through controls
      await user.tab();
      expect(
        screen.getByRole('button', { name: /reset to defaults/i })
      ).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
    });

    it('traps focus within dialog', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      // Focus should be trapped within the dialog
      const firstFocusable = screen.getByRole('button', {
        name: /reset to defaults/i,
      });
      const lastFocusable = screen.getByText('Save Preferences');

      // Tab from last element should go to first
      lastFocusable.focus();
      await user.tab();
      expect(firstFocusable).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('handles audio play failure gracefully', async () => {
      const user = userEvent.setup();
      const mockAudio = {
        play: vi.fn().mockRejectedValue(new Error('Audio play failed')),
        volume: 0.5,
      };
      (global.Audio as unknown).mockImplementation(() => mockAudio);

      // Should not throw error
      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const testButton = screen.getByText('Test');
      await user.click(testButton);

      // Should still work despite audio failure
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('handles notification permission request failure', async () => {
      const user = userEvent.setup();
      (global.Notification.requestPermission as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      renderWithTheme(<NotificationPreferencesDialog {...defaultProps} />);

      const enableButton = screen.getByText('Enable');
      await user.click(enableButton);

      // Should not crash
      expect(global.Notification.requestPermission).toHaveBeenCalled();
    });
  });
});
