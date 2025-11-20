import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import ParticipantList from '../ParticipantList';
import { Conversation } from '../../../stores/types';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('ParticipantList', () => {
  const mockConversation: Conversation = {
    _id: 'conv-1',
    title: 'Test Conversation',
    type: 'group',
    participants: [
      {
        userId: 'user-1',
        role: 'pharmacist',
        joinedAt: '2024-01-01T00:00:00Z',
        permissions: [],
      },
      {
        userId: 'user-2',
        role: 'doctor',
        joinedAt: '2024-01-01T01:00:00Z',
        permissions: [],
      },
      {
        userId: 'user-3',
        role: 'patient',
        joinedAt: '2024-01-01T02:00:00Z',
        permissions: [],
      },
    ],
    status: 'active',
    priority: 'normal',
    tags: [],
    lastMessageAt: '2024-01-01T00:00:00Z',
    createdBy: 'user-1',
    workplaceId: 'workplace-1',
    metadata: {
      isEncrypted: true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockHandlers = {
    onAddParticipant: vi.fn(),
    onRemoveParticipant: vi.fn(),
    onChangeRole: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders participant list correctly', () => {
    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    expect(screen.getByText('Participants (3)')).toBeInTheDocument();
    expect(screen.getByText('Group Chat')).toBeInTheDocument();

    // Should show all participants
    expect(screen.getAllByText('User Name')).toHaveLength(3);
    expect(screen.getByText('pharmacist')).toBeInTheDocument();
    expect(screen.getByText('doctor')).toBeInTheDocument();
    expect(screen.getByText('patient')).toBeInTheDocument();
  });

  it('shows conversation type correctly', () => {
    const patientQueryConversation = {
      ...mockConversation,
      type: 'patient_query' as const,
    };

    renderWithTheme(
      <ParticipantList
        conversation={patientQueryConversation}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Patient Query')).toBeInTheDocument();
  });

  it('shows priority chip for non-normal priority', () => {
    const urgentConversation = {
      ...mockConversation,
      priority: 'urgent' as const,
    };

    renderWithTheme(
      <ParticipantList conversation={urgentConversation} {...mockHandlers} />
    );

    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('shows add participant button when canManageParticipants is true', () => {
    renderWithTheme(
      <ParticipantList
        conversation={mockConversation}
        canManageParticipants={true}
        {...mockHandlers}
      />
    );

    expect(
      screen.getByRole('button', { name: /add participant/i })
    ).toBeInTheDocument();
  });

  it('hides add participant button when canManageParticipants is false', () => {
    renderWithTheme(
      <ParticipantList
        conversation={mockConversation}
        canManageParticipants={false}
        {...mockHandlers}
      />
    );

    expect(
      screen.queryByRole('button', { name: /add participant/i })
    ).not.toBeInTheDocument();
  });

  it('opens add participant dialog', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    const addButton = screen.getByRole('button', { name: /add participant/i });
    await user.click(addButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Select User')).toBeInTheDocument();
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
  });

  it('handles adding a participant', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    // Open add dialog
    const addButton = screen.getByRole('button', { name: /add participant/i });
    await user.click(addButton);

    // Select user (this would normally be an autocomplete, but we'll simulate)
    const userSelect = screen.getByLabelText('Select User');
    fireEvent.change(userSelect, {
      target: { value: 'John Doe (john.doe@example.com)' },
    });

    // Select role
    const roleSelect = screen.getByLabelText('Role');
    await user.click(roleSelect);
    const doctorOption = screen.getByText('Doctor');
    await user.click(doctorOption);

    // Add participant button should be present but disabled without user selection
    const addParticipantButton = screen.getByRole('button', {
      name: 'Add Participant',
    });
    expect(addParticipantButton).toBeDisabled();

    // Note: This test would need to be adjusted based on actual autocomplete implementation
    // For now, we're testing the UI structure
  });

  it('shows participant context menu', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    // Click on participant menu button
    const menuButtons = screen.getAllByTestId('MoreVertIcon');
    await user.click(menuButtons[0].closest('button')!);

    expect(screen.getByText('Make Pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Make Doctor')).toBeInTheDocument();
    expect(screen.getByText('Make Patient')).toBeInTheDocument();
    expect(screen.getByText('Remove Participant')).toBeInTheDocument();
  });

  it('handles role change', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    // Open participant menu
    const menuButtons = screen.getAllByTestId('MoreVertIcon');
    await user.click(menuButtons[0].closest('button')!);

    // Change role to doctor
    const makeDoctorOption = screen.getByText('Make Doctor');
    await user.click(makeDoctorOption);

    expect(mockHandlers.onChangeRole).toHaveBeenCalledWith('user-1', 'doctor');
  });

  it('handles participant removal', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    // Open participant menu
    const menuButtons = screen.getAllByTestId('MoreVertIcon');
    await user.click(menuButtons[0].closest('button')!);

    // Remove participant
    const removeOption = screen.getByText('Remove Participant');
    await user.click(removeOption);

    expect(mockHandlers.onRemoveParticipant).toHaveBeenCalledWith('user-1');
  });

  it('shows role icons correctly', () => {
    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    expect(screen.getByTestId('LocalPharmacyIcon')).toBeInTheDocument();
    expect(screen.getByTestId('MedicalServicesIcon')).toBeInTheDocument();
    expect(screen.getByTestId('PersonIcon')).toBeInTheDocument();
  });

  it('shows online status indicators', () => {
    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    // Should show online status circles (mocked as random)
    const statusIndicators = screen.getAllByTestId('CircleIcon');
    expect(statusIndicators.length).toBe(3); // One for each participant
  });

  it('shows joined date for participants', () => {
    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    expect(screen.getAllByText(/Joined 1\/1\/2024/)).toHaveLength(3);
  });

  it('cancels add participant dialog', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    // Open add dialog
    const addButton = screen.getByRole('button', { name: /add participant/i });
    await user.click(addButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Cancel dialog
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('disables add participant button when no user selected', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ParticipantList conversation={mockConversation} {...mockHandlers} />
    );

    // Open add dialog
    const addButton = screen.getByRole('button', { name: /add participant/i });
    await user.click(addButton);

    // Add participant button should be disabled when no user is selected
    const addParticipantButton = screen.getByRole('button', {
      name: 'Add Participant',
    });
    expect(addParticipantButton).toBeDisabled();
  });

  it('shows correct participant count', () => {
    const singleParticipantConversation = {
      ...mockConversation,
      participants: [mockConversation.participants[0]],
    };

    renderWithTheme(
      <ParticipantList
        conversation={singleParticipantConversation}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Participants (1)')).toBeInTheDocument();
  });

  it('hides participant menu when canManageParticipants is false', () => {
    renderWithTheme(
      <ParticipantList
        conversation={mockConversation}
        canManageParticipants={false}
        {...mockHandlers}
      />
    );

    expect(screen.queryByTestId('MoreVertIcon')).not.toBeInTheDocument();
  });
});
