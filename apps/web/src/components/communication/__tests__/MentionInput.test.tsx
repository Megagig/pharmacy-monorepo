import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import MentionInput from '../MentionInput';

// Mock fetch
global.fetch = vi.fn();

const mockUsers = [
  {
    _id: '1',
    firstName: 'Dr. Sarah',
    lastName: 'Johnson',
    role: 'doctor',
    email: 'sarah.johnson@hospital.com',
    displayName: 'Dr. Sarah Johnson',
    subtitle: 'doctor • sarah.johnson@hospital.com',
  },
  {
    _id: '2',
    firstName: 'PharmD Mike',
    lastName: 'Chen',
    role: 'pharmacist',
    email: 'mike.chen@pharmacy.com',
    displayName: 'PharmD Mike Chen',
    subtitle: 'pharmacist • mike.chen@pharmacy.com',
  },
];

describe('MentionInput', () => {
  const mockOnChange = vi.fn();
  const mockOnKeyPress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockUsers }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders input field correctly', () => {
    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        placeholder="Type a message..."
      />
    );

    expect(
      screen.getByPlaceholderText('Type a message...')
    ).toBeInTheDocument();
  });

  it('calls onChange when text is typed', async () => {
    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello world');

    expect(mockOnChange).toHaveBeenCalledWith('Hello world', []);
  });

  it('shows suggestions when @ is typed', async () => {
    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello @');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/mentions/conversations/conv-123/suggestions'
        ),
        expect.any(Object)
      );
    });
  });

  it('filters suggestions based on query', async () => {
    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello @sarah');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('query=sarah'),
        expect.any(Object)
      );
    });
  });

  it('selects suggestion when clicked', async () => {
    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello @sarah');

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Dr. Sarah Johnson'));

    expect(mockOnChange).toHaveBeenCalledWith('Hello @[Dr. Sarah Johnson](1)', [
      '1',
    ]);
  });

  it('navigates suggestions with arrow keys', async () => {
    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello @');

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    });

    // Navigate down
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Navigate up
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    // Select with Enter
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnChange).toHaveBeenCalledWith('Hello @[Dr. Sarah Johnson](1)', [
      '1',
    ]);
  });

  it('closes suggestions on Escape', async () => {
    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello @sarah');

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Dr. Sarah Johnson')).not.toBeInTheDocument();
    });
  });

  it('parses existing mentions correctly', () => {
    const existingText =
      'Hello @[Dr. Sarah Johnson](1) and @[PharmD Mike Chen](2)';

    render(
      <MentionInput
        value={existingText}
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    // The component should parse mentions from the initial value
    expect(mockOnChange).toHaveBeenCalledWith(existingText, ['1', '2']);
  });

  it('handles API errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API Error'));

    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello @sarah');

    await waitFor(() => {
      expect(screen.queryByText('Dr. Sarah Johnson')).not.toBeInTheDocument();
    });
  });

  it('shows loading state while fetching suggestions', async () => {
    // Mock a delayed response
    (fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ data: mockUsers }),
              }),
            100
          )
        )
    );

    const user = userEvent.setup();

    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello @sarah');

    expect(screen.getByText('Searching users...')).toBeInTheDocument();
  });

  it('passes through key events when not showing suggestions', () => {
    render(
      <MentionInput
        value="Hello world"
        onChange={mockOnChange}
        onKeyPress={mockOnKeyPress}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.keyPress(input, { key: 'Enter' });

    expect(mockOnKeyPress).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter' })
    );
  });

  it('disables input when disabled prop is true', () => {
    render(
      <MentionInput
        value=""
        onChange={mockOnChange}
        disabled={true}
        conversationId="conv-123"
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
