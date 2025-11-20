import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NotificationChannelSelector, { NotificationChannels } from '../NotificationChannelSelector';

describe('NotificationChannelSelector', () => {
  const mockChannels: NotificationChannels = {
    email: true,
    sms: false,
    push: true,
    whatsapp: false,
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders channel selector with default props', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('Push')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('renders with title and description', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
        title="Test Notifications"
        description="Configure your notification preferences"
      />
    );

    expect(screen.getByText('Test Notifications')).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
        compact={true}
        title="Compact View"
      />
    );

    expect(screen.getByText('Compact View')).toBeInTheDocument();
    
    // In compact mode, channels should be rendered as chips
    const emailChip = screen.getByText('Email');
    expect(emailChip.closest('.MuiChip-root')).toBeInTheDocument();
  });

  it('shows correct switch states', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
      />
    );

    const switches = screen.getAllByRole('switch');
    
    // Email should be checked (true)
    expect(switches[0]).toBeChecked();
    
    // SMS should not be checked (false)
    expect(switches[1]).not.toBeChecked();
    
    // Push should be checked (true)
    expect(switches[2]).toBeChecked();
    
    // WhatsApp should not be checked (false)
    expect(switches[3]).not.toBeChecked();
  });

  it('handles channel toggle', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
      />
    );

    const smsSwitch = screen.getAllByRole('switch')[1]; // SMS switch
    fireEvent.click(smsSwitch);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockChannels,
      sms: true,
    });
  });

  it('handles multiple channel toggles', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
      />
    );

    // Toggle WhatsApp
    const whatsappSwitch = screen.getAllByRole('switch')[3];
    fireEvent.click(whatsappSwitch);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockChannels,
      whatsapp: true,
    });

    // Reset mock
    mockOnChange.mockClear();

    // Toggle Email off
    const emailSwitch = screen.getAllByRole('switch')[0];
    fireEvent.click(emailSwitch);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockChannels,
      email: false,
    });
  });

  it('shows enabled channel count', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
      />
    );

    // mockChannels has email=true and push=true, so 2 channels enabled
    expect(screen.getByText('2 channels enabled')).toBeInTheDocument();
  });

  it('shows warning when no channels are enabled', () => {
    const noChannels: NotificationChannels = {
      email: false,
      sms: false,
      push: false,
      whatsapp: false,
    };

    render(
      <NotificationChannelSelector
        channels={noChannels}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('No notification channels selected')).toBeInTheDocument();
  });

  it('disables all controls when disabled prop is true', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
        disabled={true}
      />
    );

    const switches = screen.getAllByRole('switch');
    switches.forEach(switchElement => {
      expect(switchElement).toBeDisabled();
    });
  });

  it('handles compact mode chip clicks', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
        compact={true}
      />
    );

    const smsChip = screen.getByText('SMS');
    fireEvent.click(smsChip);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockChannels,
      sms: true,
    });
  });

  it('shows tooltips in compact mode', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
        compact={true}
      />
    );

    const emailChip = screen.getByText('Email');
    fireEvent.mouseOver(emailChip);

    // Tooltip should be present (though may not be visible in test)
    expect(emailChip.closest('[title]')).toBeTruthy();
  });

  it('hides labels when showLabels is false', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
        showLabels={false}
      />
    );

    // Labels should not be visible, but icons should be
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(4);
    
    // Text labels should not be in the document when showLabels is false
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
  });

  it('shows correct visual states for enabled/disabled channels', () => {
    render(
      <NotificationChannelSelector
        channels={mockChannels}
        onChange={mockOnChange}
        compact={true}
      />
    );

    const emailChip = screen.getByText('Email');
    const smsChip = screen.getByText('SMS');

    // Email is enabled, should have filled variant
    expect(emailChip.closest('.MuiChip-filled')).toBeInTheDocument();
    
    // SMS is disabled, should have outlined variant
    expect(smsChip.closest('.MuiChip-outlined')).toBeInTheDocument();
  });
});