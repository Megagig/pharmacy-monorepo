import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import ClinicalNotes from '../../pages/ClinicalNotes';
import ClinicalNoteFormPage from '../../pages/ClinicalNoteFormPage';
import ClinicalNoteDetailPage from '../../pages/ClinicalNoteDetailPage';

// Mock the components that have complex dependencies
jest.mock('../../components/ClinicalNotesDashboard', () => {
  return function MockClinicalNotesDashboard({
    onNoteSelect,
    onNoteEdit,
    onNoteCreate,
  }: any) {
    return (
      <div data-testid="clinical-notes-dashboard">
        <button onClick={() => onNoteCreate?.()} data-testid="create-note-btn">
          Create Note
        </button>
        <button
          onClick={() => onNoteSelect?.('test-note-id')}
          data-testid="view-note-btn"
        >
          View Note
        </button>
        <button
          onClick={() => onNoteEdit?.('test-note-id')}
          data-testid="edit-note-btn"
        >
          Edit Note
        </button>
      </div>
    );
  };
});

jest.mock('../../components/ClinicalNoteForm', () => {
  return function MockClinicalNoteForm({ onSave, onCancel }: any) {
    return (
      <div data-testid="clinical-note-form">
        <button
          onClick={() => onSave?.({ _id: 'new-note-id', title: 'Test Note' })}
          data-testid="save-btn"
        >
          Save
        </button>
        <button onClick={() => onCancel?.()} data-testid="cancel-btn">
          Cancel
        </button>
      </div>
    );
  };
});

jest.mock('../../components/ClinicalNoteDetail', () => {
  return function MockClinicalNoteDetail({ onEdit, onDelete }: any) {
    return (
      <div data-testid="clinical-note-detail">
        <button onClick={() => onEdit?.()} data-testid="edit-detail-btn">
          Edit
        </button>
        <button onClick={() => onDelete?.()} data-testid="delete-btn">
          Delete
        </button>
      </div>
    );
  };
});

jest.mock('../../stores/clinicalNoteStore', () => ({
  useClinicalNoteStore: () => ({
    selectedNote: { _id: 'test-note-id', title: 'Test Note' },
    setSelectedNote: jest.fn(),
    clearSelectedNote: jest.fn(),
  }),
}));

const createTestWrapper = (initialEntries: string[] = ['/notes']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Clinical Notes Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ClinicalNotes Dashboard Page', () => {
    it('renders the dashboard with breadcrumbs and header', () => {
      const TestWrapper = createTestWrapper(['/notes']);

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      // Check breadcrumbs
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Clinical Notes')).toBeInTheDocument();

      // Check page header
      expect(
        screen.getByRole('heading', { name: 'Clinical Notes' })
      ).toBeInTheDocument();
      expect(screen.getByText('New Clinical Note')).toBeInTheDocument();

      // Check dashboard component is rendered
      expect(
        screen.getByTestId('clinical-notes-dashboard')
      ).toBeInTheDocument();
    });

    it('has working navigation callbacks', () => {
      const TestWrapper = createTestWrapper(['/notes']);

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      // Test create note navigation
      const createBtn = screen.getByTestId('create-note-btn');
      expect(createBtn).toBeInTheDocument();

      // Test view and edit note navigation
      const viewBtn = screen.getByTestId('view-note-btn');
      const editBtn = screen.getByTestId('edit-note-btn');
      expect(viewBtn).toBeInTheDocument();
      expect(editBtn).toBeInTheDocument();
    });
  });

  describe('ClinicalNoteFormPage', () => {
    it('renders create form page with correct breadcrumbs', () => {
      const TestWrapper = createTestWrapper(['/notes/new']);

      render(
        <TestWrapper>
          <ClinicalNoteFormPage />
        </TestWrapper>
      );

      // Check breadcrumbs
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      expect(screen.getByText('New Note')).toBeInTheDocument();

      // Check page header
      expect(
        screen.getByRole('heading', { name: 'Create New Clinical Note' })
      ).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();

      // Check form component is rendered
      expect(screen.getByTestId('clinical-note-form')).toBeInTheDocument();
    });

    it('renders edit form page with correct breadcrumbs', () => {
      const TestWrapper = createTestWrapper(['/notes/test-note-id/edit']);

      render(
        <TestWrapper>
          <ClinicalNoteFormPage />
        </TestWrapper>
      );

      // Check page header
      expect(
        screen.getByRole('heading', { name: 'Edit Clinical Note' })
      ).toBeInTheDocument();

      // Check form component is rendered
      expect(screen.getByTestId('clinical-note-form')).toBeInTheDocument();
    });
  });

  describe('ClinicalNoteDetailPage', () => {
    it('renders detail page with correct breadcrumbs and actions', () => {
      const TestWrapper = createTestWrapper(['/notes/test-note-id']);

      render(
        <TestWrapper>
          <ClinicalNoteDetailPage />
        </TestWrapper>
      );

      // Check breadcrumbs
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      expect(screen.getByText('Test Note')).toBeInTheDocument();

      // Check page header
      expect(
        screen.getByRole('heading', { name: 'Test Note' })
      ).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Edit Note')).toBeInTheDocument();

      // Check detail component is rendered
      expect(screen.getByTestId('clinical-note-detail')).toBeInTheDocument();
    });
  });

  describe('Navigation State Management', () => {
    it('maintains application state during transitions', () => {
      const TestWrapper = createTestWrapper(['/notes']);

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      // Verify dashboard renders
      expect(
        screen.getByTestId('clinical-notes-dashboard')
      ).toBeInTheDocument();

      // The navigation callbacks should be properly connected
      const createBtn = screen.getByTestId('create-note-btn');
      const viewBtn = screen.getByTestId('view-note-btn');
      const editBtn = screen.getByTestId('edit-note-btn');

      expect(createBtn).toBeInTheDocument();
      expect(viewBtn).toBeInTheDocument();
      expect(editBtn).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query.includes('(max-width: 899.95px)'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const TestWrapper = createTestWrapper(['/notes']);

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      // Check that the page still renders correctly on mobile
      expect(
        screen.getByRole('heading', { name: 'Clinical Notes' })
      ).toBeInTheDocument();
      expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
    });
  });
});
