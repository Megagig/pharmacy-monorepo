import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import MessageItem from '../MessageItem';
import { Message } from '../../../stores/types';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('MessageItem', () => {
  const mockMessage: Message = {
    _id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: {
      text: 'Hello world',
      type: 'text',
    },
    mentions: [],
    reactions: [],
    status: 'read',
    priority: 'normal',
    readBy: [],
    editHistory: [],
    isDeleted: false,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  };

  const mockHandlers = {
    onReply: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onReaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders message content correctly', () => {
    renderWithTheme(<MessageItem message={mockMessage} {...mockHandlers} />);

    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('User Name')).toBeInTheDocument();
  });

  it('shows avatar when showAvatar is true', () => {
    renderWithTheme(
      <MessageItem message={mockMessage} showAvatar={true} {...mockHandlers} />
    );

    expect(screen.getByText('U')).toBeInTheDocument(); // Avatar initials
  });

  it('hides avatar when showAvatar is false', () => {
    renderWithTheme(
      <MessageItem message={mockMessage} showAvatar={false} {...mockHandlers} />
    );

    expect(screen.queryByText('U')).not.toBeInTheDocument();
  });

  it('shows timestamp when showTimestamp is true', () => {
    renderWithTheme(
      <MessageItem
        message={mockMessage}
        showTimestamp={true}
        {...mockHandlers}
      />
    );

    // Should show timestamp
    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
  });

  it('shows urgent priority chip', () => {
    const urgentMessage = {
      ...mockMessage,
      priority: 'urgent' as const,
    };

    renderWithTheme(<MessageItem message={urgentMessage} {...mockHandlers} />);

    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('shows edited indicator', () => {
    const editedMessage = {
      ...mockMessage,
      editHistory: [
        {
          content: 'Original content',
          editedAt: '2024-01-01T11:00:00Z',
          editedBy: 'user-1',
        },
      ],
    };

    renderWithTheme(<MessageItem message={editedMessage} {...mockHandlers} />);

    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  it('shows message status icon for own messages', () => {
    renderWithTheme(
      <MessageItem message={mockMessage} isOwn={true} {...mockHandlers} />
    );

    // Should show read status icon
    expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
  });

  it('shows different status icons', () => {
    const sentMessage = { ...mockMessage, status: 'sent' as const };
    const { rerender } = renderWithTheme(
      <MessageItem message={sentMessage} isOwn={true} {...mockHandlers} />
    );

    expect(screen.getByTestId('CheckIcon')).toBeInTheDocument();

    const failedMessage = { ...mockMessage, status: 'failed' as const };
    rerender(
      <ThemeProvider theme={theme}>
        <MessageItem message={failedMessage} isOwn={true} {...mockHandlers} />
      </ThemeProvider>
    );

    expect(screen.getByTestId('ErrorIcon')).toBeInTheDocument();
  });

  it('renders file attachments', () => {
    const messageWithAttachment = {
      ...mockMessage,
      content: {
        ...mockMessage.content,
        attachments: [
          {
            fileId: 'file-1',
            fileName: 'document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            secureUrl: 'https://example.com/file.pdf',
          },
        ],
      },
    };

    renderWithTheme(
      <MessageItem message={messageWithAttachment} {...mockHandlers} />
    );

    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByTestId('DescriptionIcon')).toBeInTheDocument();
  });

  it('renders image attachments with image icon', () => {
    const messageWithImage = {
      ...mockMessage,
      content: {
        ...mockMessage.content,
        attachments: [
          {
            fileId: 'file-1',
            fileName: 'image.jpg',
            fileSize: 2048,
            mimeType: 'image/jpeg',
            secureUrl: 'https://example.com/image.jpg',
          },
        ],
      },
    };

    renderWithTheme(
      <MessageItem message={messageWithImage} {...mockHandlers} />
    );

    expect(screen.getByTestId('ImageIcon')).toBeInTheDocument();
  });

  it('shows reactions', () => {
    const messageWithReactions = {
      ...mockMessage,
      reactions: [
        {
          userId: 'user-1',
          emoji: '👍',
          createdAt: '2024-01-01T10:30:00Z',
        },
        {
          userId: 'user-2',
          emoji: '👍',
          createdAt: '2024-01-01T10:31:00Z',
        },
        {
          userId: 'user-3',
          emoji: '❤️',
          createdAt: '2024-01-01T10:32:00Z',
        },
      ],
    };

    renderWithTheme(
      <MessageItem message={messageWithReactions} {...mockHandlers} />
    );

    expect(screen.getByText('👍 2')).toBeInTheDocument();
    expect(screen.getByText('❤️ 1')).toBeInTheDocument();
  });

  it('handles reply action', async () => {
    const user = userEvent.setup();

    renderWithTheme(<MessageItem message={mockMessage} {...mockHandlers} />);

    // Hover to show actions
    const messageContainer = screen
      .getByText('Hello world')
      .closest('.MuiBox-root');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
    }

    const replyButton = screen.getByRole('button', { name: /reply/i });
    await user.click(replyButton);

    expect(mockHandlers.onReply).toHaveBeenCalledWith(mockMessage);
  });

  it('handles edit action for own messages', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <MessageItem message={mockMessage} isOwn={true} {...mockHandlers} />
    );

    // Open menu
    const menuButton = screen.getByTestId('MoreVertIcon').closest('button');
    if (menuButton) {
      await user.click(menuButton);
    }

    const editMenuItem = screen.getByText('Edit');
    await user.click(editMenuItem);

    // Edit dialog should open
    expect(screen.getByText('Edit Message')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument();
  });

  it('handles delete action for own messages', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <MessageItem message={mockMessage} isOwn={true} {...mockHandlers} />
    );

    // Open menu
    const menuButton = screen.getByTestId('MoreVertIcon').closest('button');
    if (menuButton) {
      await user.click(menuButton);
    }

    const deleteMenuItem = screen.getByText('Delete');
    await user.click(deleteMenuItem);

    expect(mockHandlers.onDelete).toHaveBeenCalledWith('msg-1');
  });

  it('saves edited message', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <MessageItem message={mockMessage} isOwn={true} {...mockHandlers} />
    );

    // Open edit dialog
    const menuButton = screen.getByTestId('MoreVertIcon').closest('button');
    if (menuButton) {
      await user.click(menuButton);
    }

    const editMenuItem = screen.getByText('Edit');
    await user.click(editMenuItem);

    // Edit the content
    const textField = screen.getByDisplayValue('Hello world');
    await user.clear(textField);
    await user.type(textField, 'Edited message');

    // Save changes
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith('msg-1', 'Edited message');
  });

  it('handles reaction clicks', async () => {
    const user = userEvent.setup();

    renderWithTheme(<MessageItem message={mockMessage} {...mockHandlers} />);

    // Click emoji button to show reaction picker
    const emojiButton = screen.getByText('😊').closest('button');
    if (emojiButton) {
      await user.click(emojiButton);
    }

    // Click a reaction
    const thumbsUpButton = screen.getByText('👍');
    await user.click(thumbsUpButton);

    expect(mockHandlers.onReaction).toHaveBeenCalledWith('msg-1', '👍');
  });

  it('renders deleted message state', () => {
    const deletedMessage = {
      ...mockMessage,
      isDeleted: true,
      deletedAt: '2024-01-01T11:00:00Z',
    };

    renderWithTheme(<MessageItem message={deletedMessage} {...mockHandlers} />);

    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
    expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
  });

  it('handles file download', async () => {
    const user = userEvent.setup();
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', { value: mockOpen });

    const messageWithAttachment = {
      ...mockMessage,
      content: {
        ...mockMessage.content,
        attachments: [
          {
            fileId: 'file-1',
            fileName: 'document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            secureUrl: 'https://example.com/file.pdf',
          },
        ],
      },
    };

    renderWithTheme(
      <MessageItem message={messageWithAttachment} {...mockHandlers} />
    );

    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    expect(mockOpen).toHaveBeenCalledWith(
      'https://example.com/file.pdf',
      '_blank'
    );
  });

  it('applies compact styling', () => {
    const { container } = renderWithTheme(
      <MessageItem message={mockMessage} compact={true} {...mockHandlers} />
    );

    // Compact mode should have reduced padding
    const messageBox = container.querySelector('.MuiBox-root');
    expect(messageBox).toHaveStyle({ paddingTop: '4px', paddingBottom: '4px' });
  });
});
