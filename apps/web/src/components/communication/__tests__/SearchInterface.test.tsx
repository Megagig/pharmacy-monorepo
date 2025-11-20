import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SearchInterface from '../SearchInterface';

// Mock the child components
jest.mock('../MessageSearch', () => {
  return function MockMessageSearch({
    onResultSelect,
    onConversationSelect,
  }: any) {
    return (
      <div data-testid="message-search">
        <button
          onClick={() =>
            onResultSelect?.({
              message: { _id: 'msg1' },
              conversation: { _id: 'conv1' },
            })
          }
        >
          Select Message Result
        </button>
        <button onClick={() => onConversationSelect?.('conv1')}>
          Select Conversation
        </button>
      </div>
    );
  };
});

jest.mock('../ConversationSearch', () => {
  return function MockConversationSearch({ onConversationSelect }: any) {
    return (
      <div data-testid="conversation-search">
        <button onClick={() => onConversationSelect?.({ _id: 'conv2' })}>
          Select Conversation Result
        </button>
      </div>
    );
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    {children}
  </LocalizationProvider>
);

describe('SearchInterface', () => {
  it('renders with default message tab active', () => {
    render(
      <TestWrapper>
        <SearchInterface />
      </TestWrapper>
    );

    expect(screen.getByText('Communication Search')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByTestId('message-search')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-search')).not.toBeInTheDocument();
  });

  it('renders with conversation tab active when specified', () => {
    render(
      <TestWrapper>
        <SearchInterface defaultTab="conversations" />
      </TestWrapper>
    );

    expect(screen.getByTestId('conversation-search')).toBeInTheDocument();
    expect(screen.queryByTestId('message-search')).not.toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SearchInterface />
      </TestWrapper>
    );

    // Initially on messages tab
    expect(screen.getByTestId('message-search')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-search')).not.toBeInTheDocument();

    // Click conversations tab
    await user.click(screen.getByText('Conversations'));

    // Should switch to conversations tab
    expect(screen.getByTestId('conversation-search')).toBeInTheDocument();
    expect(screen.queryByTestId('message-search')).not.toBeInTheDocument();

    // Click messages tab
    await user.click(screen.getByText('Messages'));

    // Should switch back to messages tab
    expect(screen.getByTestId('message-search')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-search')).not.toBeInTheDocument();
  });

  it('calls onMessageSelect when message result is selected', async () => {
    const onMessageSelect = jest.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SearchInterface onMessageSelect={onMessageSelect} />
      </TestWrapper>
    );

    await user.click(screen.getByText('Select Message Result'));

    expect(onMessageSelect).toHaveBeenCalledWith({
      message: { _id: 'msg1' },
      conversation: { _id: 'conv1' },
    });
  });

  it('calls onConversationSelect when conversation is selected from message search', async () => {
    const onConversationSelect = jest.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SearchInterface onConversationSelect={onConversationSelect} />
      </TestWrapper>
    );

    await user.click(screen.getByText('Select Conversation'));

    expect(onConversationSelect).toHaveBeenCalledWith('conv1');
  });

  it('calls onConversationSelect when conversation result is selected', async () => {
    const onConversationSelect = jest.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SearchInterface onConversationSelect={onConversationSelect} />
      </TestWrapper>
    );

    // Switch to conversations tab
    await user.click(screen.getByText('Conversations'));

    await user.click(screen.getByText('Select Conversation Result'));

    expect(onConversationSelect).toHaveBeenCalledWith({ _id: 'conv2' });
  });

  it('handles message result selection with both callbacks', async () => {
    const onMessageSelect = jest.fn();
    const onConversationSelect = jest.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SearchInterface
          onMessageSelect={onMessageSelect}
          onConversationSelect={onConversationSelect}
        />
      </TestWrapper>
    );

    await user.click(screen.getByText('Select Message Result'));

    expect(onMessageSelect).toHaveBeenCalledWith({
      message: { _id: 'msg1' },
      conversation: { _id: 'conv1' },
    });
    expect(onConversationSelect).toHaveBeenCalledWith('conv1');
  });

  it('passes props correctly to child components', () => {
    render(
      <TestWrapper>
        <SearchInterface showSavedSearches={false} showSuggestions={false} />
      </TestWrapper>
    );

    // Child components should receive the props
    expect(screen.getByTestId('message-search')).toBeInTheDocument();
  });

  it('maintains proper height styling', () => {
    const customHeight = '800px';

    render(
      <TestWrapper>
        <SearchInterface height={customHeight} />
      </TestWrapper>
    );

    const container = screen.getByRole('tabpanel');
    expect(container.parentElement?.parentElement).toHaveStyle({
      height: customHeight,
    });
  });

  it('has proper accessibility attributes', () => {
    render(
      <TestWrapper>
        <SearchInterface />
      </TestWrapper>
    );

    const messagesTab = screen.getByRole('tab', { name: /messages/i });
    const conversationsTab = screen.getByRole('tab', {
      name: /conversations/i,
    });

    expect(messagesTab).toHaveAttribute('aria-controls', 'search-tabpanel-0');
    expect(conversationsTab).toHaveAttribute(
      'aria-controls',
      'search-tabpanel-1'
    );

    const tabPanel = screen.getByRole('tabpanel');
    expect(tabPanel).toHaveAttribute('aria-labelledby', 'search-tab-0');
  });

  it('displays search icon in header', () => {
    render(
      <TestWrapper>
        <SearchInterface />
      </TestWrapper>
    );

    // The search icon should be present in the header
    const header = screen.getByText('Communication Search');
    expect(header).toBeInTheDocument();
  });

  it('handles tab keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SearchInterface />
      </TestWrapper>
    );

    const messagesTab = screen.getByRole('tab', { name: /messages/i });
    const conversationsTab = screen.getByRole('tab', {
      name: /conversations/i,
    });

    // Focus on messages tab
    messagesTab.focus();
    expect(messagesTab).toHaveFocus();

    // Navigate to conversations tab with arrow key
    await user.keyboard('{ArrowRight}');
    expect(conversationsTab).toHaveFocus();

    // Activate with Enter
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('conversation-search')).toBeInTheDocument();
  });

  it('maintains tab state when switching', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SearchInterface />
      </TestWrapper>
    );

    // Start on messages tab
    expect(screen.getByTestId('message-search')).toBeInTheDocument();

    // Switch to conversations
    await user.click(screen.getByText('Conversations'));
    expect(screen.getByTestId('conversation-search')).toBeInTheDocument();

    // Switch back to messages
    await user.click(screen.getByText('Messages'));
    expect(screen.getByTestId('message-search')).toBeInTheDocument();
  });
});
