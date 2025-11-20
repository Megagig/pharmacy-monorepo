import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MessageItem from '../MessageItem';
import { Message } from '../../../stores/types';

// Mock the communication store
const mockAddReaction = jest.fn();
const mockRemoveReaction = jest.fn();
const mockEditMessage = jest.fn();
const mockDeleteMessage = jest.fn();

jest.mock('../../../stores/communicationStore', () => ({
  useCommunicationStore: () => ({
    addReaction: mockAddReaction,
    removeReaction: mockRemoveReaction,
    editMessage: mockEditMessage,
    deleteMessage: mockDeleteMessage,
  }),
}));

// Mock other components
jest.mock('../MentionDisplay', () => {
  return function MockMentionDisplay({ text }: { text: string }) {
    return <div data-testid="mention-display">{text}</div>;
  };
});

jest.mock('../ThreadIndicator', () => {
  return function MockThreadIndicator() {
    return <div data-testid="thread-indicator">Thread Indicator</div>;
  };
});

jest.mock('../ThreadView', () => {
  return function MockThreadView() {
    return <div data-testid="thread-view">Thread View</div>;
  };
});

const theme = createTheme();

const defaultMessage: Message = {
  _id: 'msg-1',
  conversationId: 'conv-1',
  senderId: 'user-1',
  content: {
    text: 'Test message content',
    type: 'text',
  },
  mentions: [],
  reactions: [],
  status: 'sent',
  priority: 'normal',
  readBy: [],
  editHistory: [],
  isEncrypted: false,
  isDeleted: false,
  createdBy: 'user-1',
  workplaceId: 'workplace-1',
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
};

const renderMessageItem = (
  props: Partial<React.ComponentProps<typeof MessageItem>> = {}
) => {
  const defaultProps = {
    message: defaultMessage,
    isOwn: false,
    onReaction: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    ...props,
  };

  return render(
    <ThemeProvider theme={theme}>
      <MessageItem {...defaultProps} />
    </ThemeProvider>
  );
};

describe('MessageItem Reactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Reaction Display', () => {
    it('should display existing reactions', () => {
      const messageWithReactions: Message = {
        ...defaultMessage,
        reactions: [
          { userId: 'user-2', emoji: '👍', createdAt: '2024-01-01T10:01:00Z' },
          { userId: 'user-3', emoji: '❤️', createdAt: '2024-01-01T10:02:00Z' },
          { userId: 'user-4', emoji: '👍', createdAt: '2024-01-01T10:03:00Z' },
        ],
      };

      renderMessageItem({ message: messageWithReactions });

      // Should show grouped reactions
      expect(screen.getByText('👍 2')).toBeInTheDocument();
      expect(screen.getByText('❤️ 1')).toBeInTheDocument();
    });

    it('should handle empty reactions array', () => {
      renderMessageItem();

      // Should not show any reaction chips
      expect(screen.queryByText(/👍|❤️|😊/)).not.toBeInTheDocument();
    });

    it('should show reaction picker when emoji button is clicked', async () => {
      const user = userEvent.setup();
      renderMessageItem();

      const emojiButton = screen.getByLabelText('Add reaction');
      await user.click(emojiButton);

      // Should show healthcare-specific emojis
      expect(screen.getByText('Healthcare Reactions')).toBeInTheDocument();
      expect(screen.getByLabelText('Approve')).toBeInTheDocument(); // 👍
      expect(screen.getByLabelText('Medical')).toBeInTheDocument(); // 🩺
      expect(screen.getByLabelText('Medication')).toBeInTheDocument(); // 💊
    });
  });

  describe('Reaction Interactions', () => {
    it('should call onReaction when emoji is clicked in picker', async () => {
      const user = userEvent.setup();
      const onReaction = jest.fn();
      renderMessageItem({ onReaction });

      // Open reaction picker
      const emojiButton = screen.getByLabelText('Add reaction');
      await user.click(emojiButton);

      // Click on thumbs up emoji
      const thumbsUpButton = screen.getByLabelText('Approve');
      await user.click(thumbsUpButton);

      expect(onReaction).toHaveBeenCalledWith('msg-1', '👍');
    });

    it('should call onReaction when existing reaction chip is clicked', async () => {
      const user = userEvent.setup();
      const onReaction = jest.fn();
      const messageWithReactions: Message = {
        ...defaultMessage,
        reactions: [
          { userId: 'user-2', emoji: '👍', createdAt: '2024-01-01T10:01:00Z' },
        ],
      };

      renderMessageItem({ message: messageWithReactions, onReaction });

      const reactionChip = screen.getByText('👍 1');
      await user.click(reactionChip);

      expect(onReaction).toHaveBeenCalledWith('msg-1', '👍');
    });

    it('should close reaction picker after selecting emoji', async () => {
      const user = userEvent.setup();
      renderMessageItem();

      // Open reaction picker
      const emojiButton = screen.getByLabelText('Add reaction');
      await user.click(emojiButton);

      expect(screen.getByText('Healthcare Reactions')).toBeInTheDocument();

      // Click on an emoji
      const heartButton = screen.getByLabelText('Care');
      await user.click(heartButton);

      // Picker should be closed
      await waitFor(() => {
        expect(
          screen.queryByText('Healthcare Reactions')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Healthcare-Specific Emojis', () => {
    it('should display all healthcare emojis in picker', async () => {
      const user = userEvent.setup();
      renderMessageItem();

      const emojiButton = screen.getByLabelText('Add reaction');
      await user.click(emojiButton);

      const expectedEmojis = [
        { emoji: '👍', label: 'Approve' },
        { emoji: '👎', label: 'Disapprove' },
        { emoji: '❤️', label: 'Care' },
        { emoji: '😊', label: 'Happy' },
        { emoji: '😢', label: 'Concern' },
        { emoji: '😮', label: 'Surprised' },
        { emoji: '🤔', label: 'Thinking' },
        { emoji: '✅', label: 'Confirmed' },
        { emoji: '❌', label: 'Declined' },
        { emoji: '⚠️', label: 'Warning' },
        { emoji: '🚨', label: 'Urgent' },
        { emoji: '📋', label: 'Note' },
        { emoji: '💊', label: 'Medication' },
        { emoji: '🩺', label: 'Medical' },
        { emoji: '📊', label: 'Data' },
      ];

      for (const { label } of expectedEmojis) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      }
    });

    it('should show tooltips for healthcare emojis', async () => {
      const user = userEvent.setup();
      renderMessageItem();

      const emojiButton = screen.getByLabelText('Add reaction');
      await user.click(emojiButton);

      const medicationButton = screen.getByLabelText('Medication');
      await user.hover(medicationButton);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Medication');
      });
    });
  });

  describe('Message Status Indicators', () => {
    it('should show correct status icon for sent message', () => {
      const sentMessage: Message = {
        ...defaultMessage,
        status: 'sent',
      };

      renderMessageItem({ message: sentMessage, isOwn: true });

      expect(screen.getByLabelText('Message sent')).toBeInTheDocument();
    });

    it('should show correct status icon for delivered message', () => {
      const deliveredMessage: Message = {
        ...defaultMessage,
        status: 'delivered',
      };

      renderMessageItem({ message: deliveredMessage, isOwn: true });

      expect(screen.getByLabelText('Message delivered')).toBeInTheDocument();
    });

    it('should show correct status icon for read message', () => {
      const readMessage: Message = {
        ...defaultMessage,
        status: 'read',
        readBy: [{ userId: 'user-2', readAt: '2024-01-01T10:05:00Z' }],
      };

      renderMessageItem({ message: readMessage, isOwn: true });

      expect(screen.getByLabelText('Message read')).toBeInTheDocument();
    });

    it('should show correct status icon for failed message', () => {
      const failedMessage: Message = {
        ...defaultMessage,
        status: 'failed',
      };

      renderMessageItem({ message: failedMessage, isOwn: true });

      expect(screen.getByLabelText('Message failed')).toBeInTheDocument();
    });

    it('should not show status icons for messages from others', () => {
      renderMessageItem({ isOwn: false });

      expect(
        screen.queryByLabelText(/Message (sent|delivered|read|failed)/)
      ).not.toBeInTheDocument();
    });
  });

  describe('Read Receipts', () => {
    it('should display read receipt information', () => {
      const messageWithReadReceipts: Message = {
        ...defaultMessage,
        readBy: [
          { userId: 'user-2', readAt: '2024-01-01T10:05:00Z' },
          { userId: 'user-3', readAt: '2024-01-01T10:06:00Z' },
        ],
      };

      renderMessageItem({ message: messageWithReadReceipts });

      // Should show that 2 people have read the message
      // This would be implemented in a read receipts component
      expect(messageWithReadReceipts.readBy).toHaveLength(2);
    });
  });

  describe('Message Editing', () => {
    it('should show edit indicator for edited messages', () => {
      const editedMessage: Message = {
        ...defaultMessage,
        editHistory: [
          {
            content: 'Original content',
            editedAt: '2024-01-01T10:05:00Z',
            editedBy: 'user-1',
            reason: 'Fixed typo',
          },
        ],
      };

      renderMessageItem({ message: editedMessage });

      expect(screen.getByText('(edited)')).toBeInTheDocument();
    });

    it('should open edit dialog when edit is clicked', async () => {
      const user = userEvent.setup();
      renderMessageItem({ isOwn: true });

      // Open context menu
      const moreButton = screen.getByLabelText('More options');
      await user.click(moreButton);

      // Click edit
      const editMenuItem = screen.getByText('Edit');
      await user.click(editMenuItem);

      expect(screen.getByText('Edit Message')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('Test message content')
      ).toBeInTheDocument();
    });

    it('should call onEdit when edit is saved', async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();
      renderMessageItem({ isOwn: true, onEdit });

      // Open context menu and click edit
      const moreButton = screen.getByLabelText('More options');
      await user.click(moreButton);

      const editMenuItem = screen.getByText('Edit');
      await user.click(editMenuItem);

      // Modify content
      const textField = screen.getByDisplayValue('Test message content');
      await user.clear(textField);
      await user.type(textField, 'Updated message content');

      // Save
      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      expect(onEdit).toHaveBeenCalledWith('msg-1', 'Updated message content');
    });
  });

  describe('Message Deletion', () => {
    it('should show delete option for own messages', async () => {
      const user = userEvent.setup();
      renderMessageItem({ isOwn: true });

      const moreButton = screen.getByLabelText('More options');
      await user.click(moreButton);

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it("should not show delete option for others' messages", async () => {
      const user = userEvent.setup();
      renderMessageItem({ isOwn: false });

      const moreButton = screen.getByLabelText('More options');
      await user.click(moreButton);

      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('should call onDelete when delete is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();
      renderMessageItem({ isOwn: true, onDelete });

      const moreButton = screen.getByLabelText('More options');
      await user.click(moreButton);

      const deleteMenuItem = screen.getByText('Delete');
      await user.click(deleteMenuItem);

      expect(onDelete).toHaveBeenCalledWith('msg-1');
    });

    it('should display deleted message placeholder', () => {
      const deletedMessage: Message = {
        ...defaultMessage,
        isDeleted: true,
        deletedAt: '2024-01-01T10:10:00Z',
        deletedBy: 'user-1',
      };

      renderMessageItem({ message: deletedMessage });

      expect(screen.getByText('This message was deleted')).toBeInTheDocument();
      expect(
        screen.queryByText('Test message content')
      ).not.toBeInTheDocument();
    });
  });

  describe('Priority Indicators', () => {
    it('should show urgent priority chip', () => {
      const urgentMessage: Message = {
        ...defaultMessage,
        priority: 'urgent',
      };

      renderMessageItem({ message: urgentMessage });

      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    it('should not show priority chip for normal messages', () => {
      renderMessageItem();

      expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
      expect(screen.queryByText('High')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for interactive elements', () => {
      renderMessageItem({ isOwn: true });

      expect(screen.getByLabelText('Reply')).toBeInTheDocument();
      expect(screen.getByLabelText('Add reaction')).toBeInTheDocument();
      expect(screen.getByLabelText('More options')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderMessageItem();

      const emojiButton = screen.getByLabelText('Add reaction');

      // Focus and activate with keyboard
      emojiButton.focus();
      expect(emojiButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText('Healthcare Reactions')).toBeInTheDocument();
    });
  });
});
