import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import QueryCard from '../QueryCard';
import { Conversation } from '../../../stores/types';

// Mock date-fns
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    formatDistanceToNow: vi.fn(() => '2 hours ago'),
    format: vi.fn(() => '2024-01-15'),
  };
});

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Mock data
const mockQuery: Conversation = {
  _id: 'query-1',
  title: 'Medication Side Effects Question',
  type: 'patient_query',
  participants: [
    {
      userId: 'patient-1',
      role: 'patient',
      joinedAt: '2024-01-15T10:00:00Z',
      permissions: [],
    },
    {
      userId: 'pharmacist-1',
      role: 'pharmacist',
      joinedAt: '2024-01-15T10:00:00Z',
      permissions: [],
    },
    {
      userId: 'doctor-1',
      role: 'doctor',
      joinedAt: '2024-01-15T10:30:00Z',
      permissions: [],
    },
  ],
  patientId: 'patient-1',
  caseId: 'case-123',
  status: 'active',
  priority: 'high',
  tags: ['medication', 'side-effects', 'urgent-review'],
  lastMessageAt: '2024-01-15T12:00:00Z',
  createdBy: 'patient-1',
  workplaceId: 'workplace-1',
  metadata: {
    isEncrypted: true,
    clinicalContext: {
      diagnosis: 'Hypertension',
      medications: ['med-1', 'med-2'],
      conditions: ['condition-1'],
    },
  },
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T12:00:00Z',
};

const mockResolvedQuery: Conversation = {
  ...mockQuery,
  _id: 'query-2',
  title: 'Prescription Refill Request',
  status: 'resolved',
  priority: 'normal',
  tags: ['prescription', 'refill'],
};

const mockUrgentQuery: Conversation = {
  ...mockQuery,
  _id: 'query-3',
  title: 'Drug Interaction Alert',
  priority: 'urgent',
  tags: ['drug-interaction', 'critical'],
};

const mockArchivedQuery: Conversation = {
  ...mockQuery,
  _id: 'query-4',
  title: 'Old Query',
  status: 'archived',
  priority: 'low',
  tags: ['archived'],
};

describe('QueryCard', () => {
  const mockOnSelect = vi.fn();
  const mockOnClick = vi.fn();
  const mockOnAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders query card with basic information', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Medication Side Effects Question')
    ).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(
      screen.getByText('Involving: pharmacist, doctor')
    ).toBeInTheDocument();
  });

  it('displays priority indicators correctly', () => {
    const { rerender } = render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    // High priority
    expect(screen.getByText('High')).toBeInTheDocument();

    // Urgent priority
    rerender(
      <TestWrapper>
        <QueryCard query={mockUrgentQuery} />
      </TestWrapper>
    );
    expect(screen.getByText('Urgent')).toBeInTheDocument();

    // Normal priority
    rerender(
      <TestWrapper>
        <QueryCard query={mockResolvedQuery} />
      </TestWrapper>
    );
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('displays status indicators correctly', () => {
    const { rerender } = render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    // Active status
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Resolved status
    rerender(
      <TestWrapper>
        <QueryCard query={mockResolvedQuery} />
      </TestWrapper>
    );
    expect(screen.getByText('Resolved')).toBeInTheDocument();

    // Archived status
    rerender(
      <TestWrapper>
        <QueryCard query={mockArchivedQuery} />
      </TestWrapper>
    );
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('shows patient and case information', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(screen.getByText(/Patient ID: .*ent-1/)).toBeInTheDocument();
    expect(screen.getByText('Case: case-123')).toBeInTheDocument();
  });

  it('displays tags correctly', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(screen.getByText('medication')).toBeInTheDocument();
    expect(screen.getByText('side-effects')).toBeInTheDocument();
    expect(screen.getByText('urgent-review')).toBeInTheDocument();
  });

  it('shows clinical context information', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(screen.getByText('Diagnosis: Hypertension')).toBeInTheDocument();
    expect(screen.getByText('Medications: 2 items')).toBeInTheDocument();
  });

  it('displays assigned providers', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(screen.getByText('Assigned to:')).toBeInTheDocument();

    // Should show avatars for pharmacist and doctor (not patient)
    const avatars = screen.getAllByRole('img');
    expect(avatars).toHaveLength(2); // pharmacist and doctor avatars
  });

  it('shows progress bar for active queries', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(screen.getByText('Query Progress')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not show progress bar for resolved queries', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockResolvedQuery} />
      </TestWrapper>
    );

    expect(screen.queryByText('Query Progress')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('handles selection checkbox', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard query={mockQuery} onSelect={mockOnSelect} />
      </TestWrapper>
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(mockOnSelect).toHaveBeenCalledWith(true);
  });

  it('shows selected state', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} selected={true} onSelect={mockOnSelect} />
      </TestWrapper>
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('handles card click', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard query={mockQuery} onClick={mockOnClick} />
      </TestWrapper>
    );

    const card = screen.getByRole('button', {
      name: /medication side effects question/i,
    });
    await user.click(card);

    expect(mockOnClick).toHaveBeenCalled();
  });

  it('shows quick action buttons for active queries', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(screen.getByText('Reply')).toBeInTheDocument();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText('Resolve')).toBeInTheDocument();
  });

  it('does not show assign/resolve buttons for resolved queries', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockResolvedQuery} />
      </TestWrapper>
    );

    expect(screen.getByText('Reply')).toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolve')).not.toBeInTheDocument();
  });

  it('handles quick action button clicks', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard query={mockQuery} onAction={mockOnAction} />
      </TestWrapper>
    );

    const replyButton = screen.getByText('Reply');
    await user.click(replyButton);
    expect(mockOnAction).toHaveBeenCalledWith('reply', 'query-1');

    const assignButton = screen.getByText('Assign');
    await user.click(assignButton);
    expect(mockOnAction).toHaveBeenCalledWith('assign', 'query-1');

    const resolveButton = screen.getByText('Resolve');
    await user.click(resolveButton);
    expect(mockOnAction).toHaveBeenCalledWith('resolve', 'query-1');
  });

  it('opens and handles action menu', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard query={mockQuery} onAction={mockOnAction} />
      </TestWrapper>
    );

    // Click menu button
    const menuButton = screen.getByLabelText('More');
    await user.click(menuButton);

    // Check menu items
    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Reply')).toBeInTheDocument();
    expect(screen.getByText('Edit Query')).toBeInTheDocument();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText('Escalate')).toBeInTheDocument();
    expect(screen.getByText('Mark as Resolved')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Forward')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    // Click an action
    const viewAction = screen.getByText('View Details');
    await user.click(viewAction);
    expect(mockOnAction).toHaveBeenCalledWith('view', 'query-1');
  });

  it('shows different menu options for archived queries', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard query={mockArchivedQuery} onAction={mockOnAction} />
      </TestWrapper>
    );

    const menuButton = screen.getByLabelText('More');
    await user.click(menuButton);

    expect(screen.getByText('Unarchive')).toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark as Resolved')).not.toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} compact={true} />
      </TestWrapper>
    );

    // Should not show description, clinical context, progress bar, or quick actions
    expect(
      screen.queryByText('Involving: pharmacist, doctor')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Diagnosis: Hypertension')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Query Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Reply')).not.toBeInTheDocument();
  });

  it('hides patient info when showPatientInfo is false', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} showPatientInfo={false} />
      </TestWrapper>
    );

    expect(screen.queryByText(/Patient ID:/)).not.toBeInTheDocument();
  });

  it('generates fallback title when no title provided', () => {
    const queryWithoutTitle = { ...mockQuery, title: undefined };

    render(
      <TestWrapper>
        <QueryCard query={queryWithoutTitle} />
      </TestWrapper>
    );

    expect(screen.getByText('Query about Hypertension')).toBeInTheDocument();
  });

  it('generates generic title when no clinical context', () => {
    const queryWithoutContext = {
      ...mockQuery,
      title: undefined,
      metadata: { isEncrypted: true },
    };

    render(
      <TestWrapper>
        <QueryCard query={queryWithoutContext} />
      </TestWrapper>
    );

    expect(screen.getByText('Patient Query')).toBeInTheDocument();
  });

  it('displays query ID in footer', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} />
      </TestWrapper>
    );

    expect(screen.getByText(/ID: .*ery-1/)).toBeInTheDocument();
  });

  it('shows limited tags in compact mode', () => {
    render(
      <TestWrapper>
        <QueryCard query={mockQuery} compact={true} />
      </TestWrapper>
    );

    expect(screen.getByText('medication')).toBeInTheDocument();
    expect(screen.getByText('side-effects')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('prevents event propagation on checkbox click', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard
          query={mockQuery}
          onClick={mockOnClick}
          onSelect={mockOnSelect}
        />
      </TestWrapper>
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockOnSelect).toHaveBeenCalledWith(true);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('prevents event propagation on menu button click', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard
          query={mockQuery}
          onClick={mockOnClick}
          onAction={mockOnAction}
        />
      </TestWrapper>
    );

    const menuButton = screen.getByLabelText('More');
    await user.click(menuButton);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('prevents event propagation on quick action clicks', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <QueryCard
          query={mockQuery}
          onClick={mockOnClick}
          onAction={mockOnAction}
        />
      </TestWrapper>
    );

    const replyButton = screen.getByText('Reply');
    await user.click(replyButton);

    expect(mockOnAction).toHaveBeenCalledWith('reply', 'query-1');
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('handles time formatting errors gracefully', () => {
    const queryWithInvalidDate = {
      ...mockQuery,
      createdAt: 'invalid-date',
      lastMessageAt: 'invalid-date',
    };

    render(
      <TestWrapper>
        <QueryCard query={queryWithInvalidDate} />
      </TestWrapper>
    );

    // Should still render without crashing
    expect(
      screen.getByText('Medication Side Effects Question')
    ).toBeInTheDocument();
  });
});
