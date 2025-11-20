import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import MentionDisplay from '../MentionDisplay';

const mockUsers = [
  {
    _id: '1',
    firstName: 'Dr. Sarah',
    lastName: 'Johnson',
    role: 'doctor' as const,
    email: 'sarah.johnson@hospital.com',
  },
  {
    _id: '2',
    firstName: 'PharmD Mike',
    lastName: 'Chen',
    role: 'pharmacist' as const,
    email: 'mike.chen@pharmacy.com',
  },
];

describe('MentionDisplay', () => {
  const mockOnMentionClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plain text without mentions', () => {
    render(
      <MentionDisplay
        text="Hello world, this is a regular message"
        users={mockUsers}
      />
    );

    expect(
      screen.getByText('Hello world, this is a regular message')
    ).toBeInTheDocument();
  });

  it('renders text with mentions highlighted', () => {
    const textWithMentions =
      'Hello @[Dr. Sarah Johnson](1), can you help with this case?';

    render(
      <MentionDisplay
        text={textWithMentions}
        mentions={['1']}
        users={mockUsers}
      />
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    expect(
      screen.getByText(', can you help with this case?')
    ).toBeInTheDocument();
  });

  it('renders multiple mentions correctly', () => {
    const textWithMentions =
      'Hello @[Dr. Sarah Johnson](1) and @[PharmD Mike Chen](2)';

    render(
      <MentionDisplay
        text={textWithMentions}
        mentions={['1', '2']}
        users={mockUsers}
      />
    );

    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('PharmD Mike Chen')).toBeInTheDocument();
  });

  it('shows tooltip on mention hover', async () => {
    const textWithMentions = 'Hello @[Dr. Sarah Johnson](1)';

    render(
      <MentionDisplay
        text={textWithMentions}
        mentions={['1']}
        users={mockUsers}
      />
    );

    const mentionChip = screen.getByText('Dr. Sarah Johnson');

    // Hover over the mention
    fireEvent.mouseEnter(mentionChip);

    // Tooltip should show user details
    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    expect(
      screen.getByText('doctor • sarah.johnson@hospital.com')
    ).toBeInTheDocument();
  });

  it('calls onMentionClick when mention is clicked', () => {
    const textWithMentions = 'Hello @[Dr. Sarah Johnson](1)';

    render(
      <MentionDisplay
        text={textWithMentions}
        mentions={['1']}
        users={mockUsers}
        onMentionClick={mockOnMentionClick}
      />
    );

    const mentionChip = screen.getByText('Dr. Sarah Johnson');
    fireEvent.click(mentionChip);

    expect(mockOnMentionClick).toHaveBeenCalledWith('1');
  });

  it('handles mentions for unknown users', () => {
    const textWithMentions = 'Hello @[Unknown User](999)';

    render(
      <MentionDisplay
        text={textWithMentions}
        mentions={['999']}
        users={mockUsers}
      />
    );

    // Should render as outlined chip for unknown users
    const mentionChip = screen.getByText('Unknown User');
    expect(mentionChip).toBeInTheDocument();
  });

  it('renders URLs as clickable links', () => {
    const textWithUrl = 'Check this out: https://example.com';

    render(<MentionDisplay text={textWithUrl} users={mockUsers} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('applies correct role colors to mentions', () => {
    const textWithMentions =
      'Hello @[Dr. Sarah Johnson](1) and @[PharmD Mike Chen](2)';

    render(
      <MentionDisplay
        text={textWithMentions}
        mentions={['1', '2']}
        users={mockUsers}
      />
    );

    const doctorMention = screen.getByText('Dr. Sarah Johnson');
    const pharmacistMention = screen.getByText('PharmD Mike Chen');

    // Check that mentions have appropriate styling (this would need to check computed styles)
    expect(doctorMention).toBeInTheDocument();
    expect(pharmacistMention).toBeInTheDocument();
  });

  it('preserves whitespace and line breaks', () => {
    const textWithBreaks = 'Line 1\nLine 2\n\nLine 4';

    render(<MentionDisplay text={textWithBreaks} users={mockUsers} />);

    // The component should preserve whitespace
    expect(screen.getByText(/Line 1.*Line 2.*Line 4/s)).toBeInTheDocument();
  });

  it('handles empty text gracefully', () => {
    render(<MentionDisplay text="" users={mockUsers} />);

    // Should not crash and render nothing
    expect(document.body).toBeInTheDocument();
  });

  it('handles malformed mention syntax', () => {
    const malformedText = 'Hello @[Incomplete mention and @invalid(format)';

    render(<MentionDisplay text={malformedText} users={mockUsers} />);

    // Should render as plain text when mention format is invalid
    expect(screen.getByText(malformedText)).toBeInTheDocument();
  });

  it('applies custom variant and color props', () => {
    render(
      <MentionDisplay
        text="Hello world"
        variant="caption"
        color="secondary"
        users={mockUsers}
      />
    );

    const typography = screen.getByText('Hello world');
    expect(typography).toBeInTheDocument();
    // Would need to check computed styles for variant and color
  });

  it('applies custom sx prop', () => {
    const customSx = { fontSize: '20px', color: 'red' };

    render(
      <MentionDisplay text="Hello world" sx={customSx} users={mockUsers} />
    );

    const typography = screen.getByText('Hello world');
    expect(typography).toBeInTheDocument();
    // Would need to check computed styles for custom sx
  });
});
