import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ConversationSettings from '../ConversationSettings';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { Conversation } from '../../../stores/types';

// Mock the communication store
jest.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = useCommunicationStore as jest.MockedFunction<
  typeof useCommunicationStore
>;

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn(),
});

const mockConversation: Conversation = {
  _id: 'conv-1',
  title: 'Patient Query - John Doe',
  type: 'patient_query',
  participants: [
    {
      userId: 'user-1',
      role: 'patient',
      joinedAt: '2024-01-01T00:00:00Z',
      permissions: ['read', 'write'],
    },
    {
      userId: 'user-2',
      role: 'pharmacist',
      joinedAt: '2024-01-01T00:00:00Z',
      permissions: ['read', 'write', 'manage_medications'],
    },
  ],
  patientId: 'patient-1',
  status: 'active',
  priority: 'normal',
  tags: ['medication-review'],
  lastMessageAt: '2024-01-01T12:00:00Z',
  createdBy: 'user-1',
  workplaceId: 'workplace-1',
  metadata: {
    isEncrypted: true,
    encryptionKeyId: 'key-1',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T12:00:00Z',
};

const mockStore = {
  updateConversation: jest.fn(),
  addParticipant: jest.fn(),
  removeParticipant: jest.fn(),
  archiveConversation: jest.fn(),
  deleteConversation: jest.fn(),
  loading: {},
  errors: {},
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

describe('ConversationSettings', () => {
  beforeEach(() => {
    mockUseCommunicationStore.mockReturnValue(mockStore as any);
    (window.confirm as jest.Mock).mockReturnValue(true);
    jest.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Conversation Settings')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    render(
      <TestWrapper>
        <ConversationSettings
          open={false}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    expect(screen.queryByText('Conversation Settings')).not.toBeInTheDocument();
  });

  it('displays all tabs', () => {
    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Participants')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('displays conversation details in general tab', () => {
    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Patient Query - John Doe')).toBeInTheDocument();
    expect(screen.getByText('patient_query')).toBeInTheDocument();
    expect(screen.getByDisplayValue('normal')).toBeInTheDocument();
  });

  it('allows editing conversation title', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const editButton = screen.getByLabelText('Edit');
    await user.click(editButton);

    const titleInput = screen.getByDisplayValue('Patient Query - John Doe');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');

    const saveButton = screen.getByLabelText('Save');
    await user.click(saveButton);

    expect(mockStore.updateConversation).toHaveBeenCalledWith('conv-1', {
      title: 'Updated Title',
    });
  });

  it('allows canceling title edit', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const editButton = screen.getByLabelText('Edit');
    await user.click(editButton);

    const titleInput = screen.getByDisplayValue('Patient Query - John Doe');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');

    const cancelButton = screen.getByLabelText('Cancel');
    await user.click(cancelButton);

    // Title should revert to original
    expect(screen.getByText('Patient Query - John Doe')).toBeInTheDocument();
  });

  it('allows changing priority', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const prioritySelect = screen.getByLabelText('Priority');
    await user.click(prioritySelect);

    const urgentOption = screen.getByText('Urgent');
    await user.click(urgentOption);

    // Should show save button for unsaved changes
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('saves settings changes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const prioritySelect = screen.getByLabelText('Priority');
    await user.click(prioritySelect);

    const urgentOption = screen.getByText('Urgent');
    await user.click(urgentOption);

    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    expect(mockStore.updateConversation).toHaveBeenCalledWith('conv-1', {
      priority: 'urgent',
      tags: ['medication-review'],
      caseId: undefined,
    });
  });

  it('displays participants in participants tab', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const participantsTab = screen.getByText('Participants');
    await user.click(participantsTab);

    await waitFor(() => {
      expect(screen.getByText('Current Participants (2)')).toBeInTheDocument();
      expect(screen.getByText('Role: patient')).toBeInTheDocument();
      expect(screen.getByText('Role: pharmacist')).toBeInTheDocument();
    });
  });

  it('allows adding participants', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const participantsTab = screen.getByText('Participants');
    await user.click(participantsTab);

    await waitFor(async () => {
      const addButtons = screen.getAllByLabelText('Add participant');
      await user.click(addButtons[0]);
    });

    expect(mockStore.addParticipant).toHaveBeenCalled();
  });

  it('allows removing participants with confirmation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const participantsTab = screen.getByText('Participants');
    await user.click(participantsTab);

    await waitFor(async () => {
      const removeButtons = screen.getAllByLabelText('Remove participant');
      await user.click(removeButtons[0]);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to remove this participant?'
    );
    expect(mockStore.removeParticipant).toHaveBeenCalled();
  });

  it('displays notification settings in notifications tab', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const notificationsTab = screen.getByText('Notifications');
    await user.click(notificationsTab);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
      expect(screen.getByText('In-app notifications')).toBeInTheDocument();
      expect(screen.getByText('Email notifications')).toBeInTheDocument();
      expect(screen.getByText('SMS notifications')).toBeInTheDocument();
    });
  });

  it('allows toggling notification settings', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const notificationsTab = screen.getByText('Notifications');
    await user.click(notificationsTab);

    await waitFor(async () => {
      const emailSwitch = screen.getByRole('checkbox', {
        name: /email notifications/i,
      });
      await user.click(emailSwitch);
      expect(emailSwitch).toBeChecked();
    });
  });

  it('displays encryption status in security tab', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const securityTab = screen.getByText('Security');
    await user.click(securityTab);

    await waitFor(() => {
      expect(screen.getByText('Encryption Status')).toBeInTheDocument();
      expect(screen.getByText('Encrypted')).toBeInTheDocument();
      expect(screen.getByText('Key ID: key-1')).toBeInTheDocument();
    });
  });

  it('displays dangerous actions in security tab', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const securityTab = screen.getByText('Security');
    await user.click(securityTab);

    await waitFor(() => {
      expect(screen.getByText('Dangerous Actions')).toBeInTheDocument();
      expect(screen.getByText('Archive Conversation')).toBeInTheDocument();
      expect(screen.getByText('Delete Conversation')).toBeInTheDocument();
    });
  });

  it('allows archiving conversation with confirmation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const securityTab = screen.getByText('Security');
    await user.click(securityTab);

    await waitFor(async () => {
      const archiveButton = screen.getByText('Archive Conversation');
      await user.click(archiveButton);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to archive this conversation?'
    );
    expect(mockStore.archiveConversation).toHaveBeenCalledWith('conv-1');
  });

  it('allows deleting conversation with confirmation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const securityTab = screen.getByText('Security');
    await user.click(securityTab);

    await waitFor(async () => {
      const deleteButton = screen.getByText('Delete Conversation');
      await user.click(deleteButton);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this conversation? This action cannot be undone.'
    );
    expect(mockStore.deleteConversation).toHaveBeenCalledWith('conv-1');
  });

  it('disables archive button for already archived conversations', async () => {
    const user = userEvent.setup();
    const archivedConversation = {
      ...mockConversation,
      status: 'archived' as const,
    };

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={archivedConversation}
        />
      </TestWrapper>
    );

    const securityTab = screen.getByText('Security');
    await user.click(securityTab);

    await waitFor(() => {
      const archiveButton = screen.getByText('Archive Conversation');
      expect(archiveButton).toBeDisabled();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={mockOnClose}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays error messages', () => {
    mockUseCommunicationStore.mockReturnValue({
      ...mockStore,
      errors: { updateConversation: 'Failed to update conversation' },
    } as any);

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    expect(
      screen.getByText('Failed to update conversation')
    ).toBeInTheDocument();
  });

  it('shows loading state when updating', () => {
    mockUseCommunicationStore.mockReturnValue({
      ...mockStore,
      loading: { updateConversation: true },
    } as any);

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    // Change priority to trigger save button
    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.mouseDown(prioritySelect);

    const urgentOption = screen.getByText('Urgent');
    fireEvent.click(urgentOption);

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('does not call remove participant when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    (window.confirm as jest.Mock).mockReturnValue(false);

    render(
      <TestWrapper>
        <ConversationSettings
          open={true}
          onClose={jest.fn()}
          conversation={mockConversation}
        />
      </TestWrapper>
    );

    const participantsTab = screen.getByText('Participants');
    await user.click(participantsTab);

    await waitFor(async () => {
      const removeButtons = screen.getAllByLabelText('Remove participant');
      await user.click(removeButtons[0]);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(mockStore.removeParticipant).not.toHaveBeenCalled();
  });
});
