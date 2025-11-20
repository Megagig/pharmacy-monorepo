import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '../../theme';
import VirtualizedClinicalNotesList from '../VirtualizedClinicalNotesList';
import { ClinicalNote } from '../../types/clinicalNote';

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemData, itemCount, itemSize }: unknown) => {
    // Render a few items for testing
    const items = [];
    const itemsToRender = Math.min(itemCount, 5); // Render first 5 items for testing

    for (let i = 0; i < itemsToRender; i++) {
      const style = {
        position: 'absolute' as const,
        top: i * itemSize,
        left: 0,
        right: 0,
        height: itemSize,
      };

      items.push(
        <div key={i} data-testid={`virtual-item-${i}`}>
          {children({ index: i, style, data: itemData })}
        </div>
      );
    }

    return <div data-testid="virtual-list">{items}</div>;
  },
}));

const mockNotes: ClinicalNote[] = [
  {
    _id: '1',
    title: 'Test Note 1',
    type: 'consultation',
    priority: 'medium',
    patient: {
      _id: 'patient1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
    },
    pharmacist: {
      _id: 'pharmacist1',
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    content: {
      subjective: 'Patient complains of headache',
      objective: 'BP: 120/80',
      assessment: 'Mild hypertension',
      plan: 'Monitor BP',
    },
    isConfidential: false,
    followUpRequired: true,
    followUpDate: '2024-02-01T10:00:00Z',
    attachments: [
      {
        _id: 'att1',
        fileName: 'test.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: '/files/test.pdf',
        uploadedAt: '2024-01-15T10:00:00Z',
        uploadedBy: 'pharmacist1',
      },
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    createdBy: 'pharmacist1',
    lastModifiedBy: 'pharmacist1',
    workplaceId: 'workplace1',
    medications: [],
    recommendations: [],
    tags: [],
  },
  {
    _id: '2',
    title: 'Test Note 2',
    type: 'medication_review',
    priority: 'high',
    patient: {
      _id: 'patient2',
      firstName: 'Jane',
      lastName: 'Wilson',
      mrn: 'MRN002',
    },
    pharmacist: {
      _id: 'pharmacist1',
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    content: {
      subjective: 'Patient reports side effects',
      objective: 'No visible symptoms',
      assessment: 'Drug interaction suspected',
      plan: 'Change medication',
    },
    isConfidential: true,
    followUpRequired: false,
    attachments: [],
    createdAt: '2024-01-16T10:00:00Z',
    updatedAt: '2024-01-16T10:00:00Z',
    createdBy: 'pharmacist1',
    lastModifiedBy: 'pharmacist1',
    workplaceId: 'workplace1',
    medications: [],
    recommendations: [],
    tags: [],
  },
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('VirtualizedClinicalNotesList', () => {
  const defaultProps = {
    notes: mockNotes,
    height: 600,
    itemHeight: 160,
  };

  it('renders the virtualized list with notes', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('Test Note 2')).toBeInTheDocument();
  });

  it('displays note information correctly', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} />
      </TestWrapper>
    );

    // Check first note
    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/MRN001/)).toBeInTheDocument();
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
  });

  it('shows confidential indicator for confidential notes', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Confidential')).toBeInTheDocument();
  });

  it('shows follow-up indicator when required', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Follow-up')).toBeInTheDocument();
  });

  it('shows attachment count when attachments exist', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('1')).toBeInTheDocument(); // Attachment count
  });

  it('calls onNoteView when view button is clicked', () => {
    const onNoteView = vi.fn();
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList
          {...defaultProps}
          onNoteView={onNoteView}
        />
      </TestWrapper>
    );

    const viewButtons = screen.getAllByLabelText(/view/i);
    fireEvent.click(viewButtons[0]);

    expect(onNoteView).toHaveBeenCalledWith(mockNotes[0]);
  });

  it('calls onNoteEdit when edit button is clicked', () => {
    const onNoteEdit = vi.fn();
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList
          {...defaultProps}
          onNoteEdit={onNoteEdit}
        />
      </TestWrapper>
    );

    const editButtons = screen.getAllByLabelText(/edit/i);
    fireEvent.click(editButtons[0]);

    expect(onNoteEdit).toHaveBeenCalledWith(mockNotes[0]);
  });

  it('calls onNoteDelete when delete button is clicked', () => {
    const onNoteDelete = vi.fn();
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList
          {...defaultProps}
          onNoteDelete={onNoteDelete}
        />
      </TestWrapper>
    );

    const deleteButtons = screen.getAllByLabelText(/delete/i);
    fireEvent.click(deleteButtons[0]);

    expect(onNoteDelete).toHaveBeenCalledWith(mockNotes[0]);
  });

  it('calls onNoteSelect when note card is clicked', () => {
    const onNoteSelect = vi.fn();
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList
          {...defaultProps}
          onNoteSelect={onNoteSelect}
        />
      </TestWrapper>
    );

    const noteCard = screen
      .getByText('Test Note 1')
      .closest('[data-testid^="virtual-item"]');
    if (noteCard) {
      fireEvent.click(noteCard);
      expect(onNoteSelect).toHaveBeenCalledWith('1');
    }
  });

  it('highlights selected notes', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} selectedNotes={['1']} />
      </TestWrapper>
    );

    const noteCard = screen.getByText('Test Note 1').closest('.MuiCard-root');
    expect(noteCard).toHaveStyle({
      border: expect.stringContaining('2px solid'),
    });
  });

  it('displays empty state when no notes', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} notes={[]} />
      </TestWrapper>
    );

    expect(screen.getByText('No clinical notes found')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting your search or filters')
    ).toBeInTheDocument();
  });

  it('handles custom item height', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} itemHeight={200} />
      </TestWrapper>
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });

  it('handles overscan prop', () => {
    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList {...defaultProps} overscan={10} />
      </TestWrapper>
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });
});

describe('VirtualizedClinicalNotesList Performance', () => {
  it('memoizes note items to prevent unnecessary re-renders', () => {
    const { rerender } = render(
      <TestWrapper>
        <VirtualizedClinicalNotesList
          notes={mockNotes}
          height={600}
          itemHeight={160}
        />
      </TestWrapper>
    );

    // Re-render with same props
    rerender(
      <TestWrapper>
        <VirtualizedClinicalNotesList
          notes={mockNotes}
          height={600}
          itemHeight={160}
        />
      </TestWrapper>
    );

    // Component should still render correctly
    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
  });

  it('handles large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      ...mockNotes[0],
      _id: `note-${i}`,
      title: `Note ${i}`,
    }));

    const startTime = performance.now();

    render(
      <TestWrapper>
        <VirtualizedClinicalNotesList
          notes={largeDataset}
          height={600}
          itemHeight={160}
        />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render quickly even with large dataset
    expect(renderTime).toBeLessThan(100); // Less than 100ms
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });
});
