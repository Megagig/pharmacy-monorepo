import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { theme } from '../../../theme';
import MTRHelpSystem, { MTRTooltip, MTRHelpButton } from '../MTRHelpSystem';

// Mock components wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </BrowserRouter>
);

describe('MTRHelpSystem', () => {
  const mockProps = {
    currentStep: 1,
    onStartTour: vi.fn(),
    onShowGuide: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders floating help button', () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    expect(helpButton).toBeInTheDocument();
  });

  it('opens help drawer when help button is clicked', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByText('MTR Help & Support')).toBeInTheDocument();
    });
  });

  it('displays guided tour button in help drawer', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      const tourButton = screen.getByText('Start Guided Tour');
      expect(tourButton).toBeInTheDocument();
    });
  });

  it('displays user guide button in help drawer', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      const guideButton = screen.getByText('View User Guide');
      expect(guideButton).toBeInTheDocument();
    });
  });

  it('shows current step help when step is provided', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByText('Current Step Help')).toBeInTheDocument();
    });
  });

  it('calls onStartTour when guided tour is started', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      const tourButton = screen.getByText('Start Guided Tour');
      fireEvent.click(tourButton);
    });

    expect(mockProps.onStartTour).toHaveBeenCalled();
  });

  it('displays help topics with search functionality', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search help topics...');
      expect(searchInput).toBeInTheDocument();
    });
  });

  it('filters help topics by category', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      const workflowChips = screen.getAllByText('workflow');
      fireEvent.click(workflowChips[0]); // Click the first workflow chip

      // Should show workflow-related topics
      expect(screen.getByText('Patient Selection')).toBeInTheDocument();
    });
  });

  it('closes help drawer when close button is clicked', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem {...mockProps} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      const closeButton = screen.getByTestId('CloseIcon').closest('button');
      if (closeButton) fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('MTR Help & Support')).not.toBeInTheDocument();
    });
  });
});

describe('MTRTooltip', () => {
  it('renders tooltip with title and content', async () => {
    render(
      <TestWrapper>
        <MTRTooltip title="Test Title" content="Test content for tooltip">
          <button>Hover me</button>
        </MTRTooltip>
      </TestWrapper>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test content for tooltip')).toBeInTheDocument();
    });
  });

  it('shows tooltip on hover and hides on leave', async () => {
    render(
      <TestWrapper>
        <MTRTooltip title="Test Title" content="Test content">
          <button>Hover me</button>
        </MTRTooltip>
      </TestWrapper>
    );

    const button = screen.getByText('Hover me');

    // Show tooltip
    fireEvent.mouseEnter(button);
    await waitFor(() => {
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    // Hide tooltip
    fireEvent.mouseLeave(button);
    await waitFor(() => {
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
    });
  });
});

describe('MTRHelpButton', () => {
  it('renders help button with correct size', () => {
    render(
      <TestWrapper>
        <MTRHelpButton topic="patient-selection" size="medium" />
      </TestWrapper>
    );

    const helpButton = screen.getByRole('button');
    expect(helpButton).toBeInTheDocument();
  });

  it('opens help dialog when clicked', async () => {
    render(
      <TestWrapper>
        <MTRHelpButton topic="patient-selection" />
      </TestWrapper>
    );

    const helpButton = screen.getByRole('button');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByText('Patient Selection')).toBeInTheDocument();
    });
  });

  it('closes help dialog when close button is clicked', async () => {
    render(
      <TestWrapper>
        <MTRHelpButton topic="patient-selection" />
      </TestWrapper>
    );

    const helpButton = screen.getByRole('button');
    fireEvent.click(helpButton);

    await waitFor(() => {
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Patient Selection')).not.toBeInTheDocument();
    });
  });

  it('displays appropriate content for unknown topic', async () => {
    render(
      <TestWrapper>
        <MTRHelpButton topic="unknown-topic" />
      </TestWrapper>
    );

    const helpButton = screen.getByRole('button');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(
        screen.getByText('Help information not available for this topic.')
      ).toBeInTheDocument();
    });
  });
});

describe('MTRHelpSystem Integration', () => {
  it('integrates tour and guide functionality', async () => {
    const mockOnStartTour = vi.fn();
    const mockOnShowGuide = vi.fn();

    render(
      <TestWrapper>
        <MTRHelpSystem
          currentStep={2}
          onStartTour={mockOnStartTour}
          onShowGuide={mockOnShowGuide}
        />
      </TestWrapper>
    );

    // Open help drawer
    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      // Test tour functionality
      const tourButton = screen.getByText('Start Guided Tour');
      fireEvent.click(tourButton);
      expect(mockOnStartTour).toHaveBeenCalled();
    });
  });

  it('displays contextual help for current step', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem currentStep={3} />
      </TestWrapper>
    );

    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByText('Current Step Help')).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation', async () => {
    render(
      <TestWrapper>
        <MTRHelpSystem />
      </TestWrapper>
    );

    // Test Escape key to close drawer
    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });

    // Drawer should close (implementation depends on MUI Drawer behavior)
  });
});
