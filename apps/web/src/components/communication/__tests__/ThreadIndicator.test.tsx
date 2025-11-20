import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ThreadIndicator from '../ThreadIndicator';

describe('ThreadIndicator', () => {
  const defaultProps = {
    threadId: 'thread-123',
    replyCount: 3,
    participants: ['user-1', 'user-2', 'user-3'],
    lastReplyAt: '2024-01-01T10:30:00Z',
    unreadCount: 1,
  };

  it('should not render when replyCount is 0', () => {
    const { container } = render(
      <ThreadIndicator {...defaultProps} replyCount={0} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render compact variant correctly', () => {
    render(<ThreadIndicator {...defaultProps} variant="compact" />);

    expect(screen.getByText('3 replies')).toBeInTheDocument();
    expect(screen.getByText(/minutes ago/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Unread badge
  });

  it('should render detailed variant correctly', () => {
    render(<ThreadIndicator {...defaultProps} variant="detailed" />);

    expect(screen.getByText('Thread Discussion')).toBeInTheDocument();
    expect(screen.getByText('3 replies')).toBeInTheDocument();
    expect(screen.getByText('3 participants')).toBeInTheDocument();
    expect(screen.getByText('1 new')).toBeInTheDocument(); // Unread chip
  });

  it('should handle singular reply count', () => {
    render(
      <ThreadIndicator {...defaultProps} replyCount={1} variant="compact" />
    );

    expect(screen.getByText('1 reply')).toBeInTheDocument();
  });

  it('should handle singular participant count', () => {
    render(
      <ThreadIndicator
        {...defaultProps}
        participants={['user-1']}
        variant="detailed"
      />
    );

    expect(screen.getByText('1 participant')).toBeInTheDocument();
  });

  it('should call onViewThread when clicked', () => {
    const mockOnViewThread = vi.fn();

    render(
      <ThreadIndicator
        {...defaultProps}
        onViewThread={mockOnViewThread}
        variant="compact"
      />
    );

    const threadIndicator = screen.getByText('3 replies').closest('div');
    fireEvent.click(threadIndicator!);

    expect(mockOnViewThread).toHaveBeenCalled();
  });

  it('should call onToggle when toggle button is clicked', () => {
    const mockOnToggle = vi.fn();

    render(
      <ThreadIndicator
        {...defaultProps}
        onToggle={mockOnToggle}
        expanded={false}
        variant="compact"
      />
    );

    const toggleButton = screen.getByRole('button', { name: /expand thread/i });
    fireEvent.click(toggleButton);

    expect(mockOnToggle).toHaveBeenCalled();
  });

  it('should show collapse tooltip when expanded', () => {
    render(
      <ThreadIndicator
        {...defaultProps}
        onToggle={vi.fn()}
        expanded={true}
        variant="compact"
      />
    );

    const toggleButton = screen.getByRole('button', {
      name: /collapse thread/i,
    });
    expect(toggleButton).toBeInTheDocument();
  });

  it('should not show unread count when it is 0', () => {
    render(
      <ThreadIndicator {...defaultProps} unreadCount={0} variant="compact" />
    );

    // Should not have any badge with number
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should not show last reply time when not provided', () => {
    render(
      <ThreadIndicator
        {...defaultProps}
        lastReplyAt={undefined}
        variant="compact"
      />
    );

    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });

  it('should prevent event propagation when toggle button is clicked', () => {
    const mockOnViewThread = vi.fn();
    const mockOnToggle = vi.fn();

    render(
      <ThreadIndicator
        {...defaultProps}
        onViewThread={mockOnViewThread}
        onToggle={mockOnToggle}
        variant="compact"
      />
    );

    const toggleButton = screen.getByRole('button', { name: /expand thread/i });
    fireEvent.click(toggleButton);

    expect(mockOnToggle).toHaveBeenCalled();
    expect(mockOnViewThread).not.toHaveBeenCalled();
  });

  it('should format time correctly for recent replies', () => {
    const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago

    render(
      <ThreadIndicator
        {...defaultProps}
        lastReplyAt={recentTime}
        variant="compact"
      />
    );

    expect(screen.getByText(/2 minutes ago/)).toBeInTheDocument();
  });

  it('should not be clickable when onViewThread is not provided', () => {
    const { container } = render(
      <ThreadIndicator {...defaultProps} variant="detailed" />
    );

    const threadIndicator = container.firstChild as HTMLElement;
    expect(threadIndicator).not.toHaveStyle('cursor: pointer');
  });

  it('should show hover effect when clickable', () => {
    render(
      <ThreadIndicator
        {...defaultProps}
        onViewThread={vi.fn()}
        variant="compact"
      />
    );

    const threadIndicator = screen.getByText('3 replies').closest('div');
    expect(threadIndicator).toHaveStyle('cursor: pointer');
  });
});
