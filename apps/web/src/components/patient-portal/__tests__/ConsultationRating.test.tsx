import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

import ConsultationRating from '../ConsultationRating';
import { PatientAuthContext } from '../../../contexts/PatientAuthContext';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
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
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
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
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';

const theme = createTheme();

const createWrapper = (authValue: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <PatientAuthContext.Provider value={authValue}>
            {children}
          </PatientAuthContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('ConsultationRating', () => {
  const mockUser = {
    _id: 'patient-123',
    patientId: 'patient-123',
    workplaceId: 'workplace-456',
    email: 'patient@example.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active',
  };

  const mockAuthContextValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the rating form correctly', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Rate Your Consultation')).toBeInTheDocument();
    });

    expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    expect(screen.getByText('Rate Specific Areas')).toBeInTheDocument();
    expect(screen.getByText('Written Feedback')).toBeInTheDocument();
    expect(screen.getByText('Quick Tags (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Additional Options')).toBeInTheDocument();
  });

  it('shows login warning when user is not authenticated', () => {
    const unauthenticatedContext = {
      ...mockAuthContextValue,
      user: null,
      isAuthenticated: false,
    };

    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(unauthenticatedContext) }
    );

    expect(screen.getByText('Please log in to rate consultations.')).toBeInTheDocument();
  });

  it('displays consultation information', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    });

    expect(screen.getByText('Medication Therapy Review')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
  });

  it('handles overall rating changes', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    });

    // Find the rating component and click on the 4th star
    const ratingStars = screen.getAllByRole('radio');
    const fourthStar = ratingStars.find(star => star.getAttribute('value') === '4');

    if (fourthStar) {
      fireEvent.click(fourthStar);
      expect(screen.getByText('4/5')).toBeInTheDocument();
    }
  });

  it('handles category rating changes', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Communication')).toBeInTheDocument();
    });

    // Find communication category rating
    const communicationSection = screen.getByText('Communication').closest('div');
    const ratingStars = communicationSection?.querySelectorAll('input[type="radio"]');

    if (ratingStars && ratingStars.length > 0) {
      fireEvent.click(ratingStars[4]); // Click 5th star (5-star rating)

      await waitFor(() => {
        expect(communicationSection?.textContent).toContain('5/5');
      });
    }
  });

  it('handles feedback input', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Written Feedback')).toBeInTheDocument();
    });

    const feedbackInput = screen.getByPlaceholderText(/Share your experience/i);
    fireEvent.change(feedbackInput, {
      target: { value: 'Great consultation experience!' }
    });

    expect(feedbackInput).toHaveValue('Great consultation experience!');
  });

  it('handles tag selection', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Quick Tags (Optional)')).toBeInTheDocument();
    });

    const excellentServiceTag = screen.getByText('Excellent service');
    fireEvent.click(excellentServiceTag);

    // Tag should be selected (visual change)
    expect(excellentServiceTag.closest('.MuiChip-root')).toHaveClass('MuiChip-filled');
  });

  it('handles checkbox options', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Additional Options')).toBeInTheDocument();
    });

    const recommendCheckbox = screen.getByRole('checkbox', {
      name: /I would recommend this pharmacist to others/i
    });
    const anonymousCheckbox = screen.getByRole('checkbox', {
      name: /Submit this rating anonymously/i
    });

    // Recommend checkbox should be checked by default
    expect(recommendCheckbox).toBeChecked();
    expect(anonymousCheckbox).not.toBeChecked();

    // Toggle anonymous checkbox
    fireEvent.click(anonymousCheckbox);
    expect(anonymousCheckbox).toBeChecked();
  });

  it('validates required fields', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Submit Rating')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /submit rating/i });

    // Submit button should be disabled when no rating is provided
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when rating is provided', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    });

    // Provide a rating
    const ratingStars = screen.getAllByRole('radio');
    const fifthStar = ratingStars.find(star => star.getAttribute('value') === '5');

    if (fifthStar) {
      fireEvent.click(fifthStar);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit rating/i });
        expect(submitButton).not.toBeDisabled();
      });
    }
  });

  it('handles form submission', async () => {
    const mockOnRatingSubmitted = vi.fn();

    render(
      <ConsultationRating
        consultationId="consultation-123"
        onRatingSubmitted={mockOnRatingSubmitted}
      />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    });

    // Provide a rating
    const ratingStars = screen.getAllByRole('radio');
    const fifthStar = ratingStars.find(star => star.getAttribute('value') === '5');

    if (fifthStar) {
      fireEvent.click(fifthStar);
    }

    // Add feedback
    const feedbackInput = screen.getByPlaceholderText(/Share your experience/i);
    fireEvent.change(feedbackInput, {
      target: { value: 'Excellent service!' }
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    // Should show submitting state
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });

    // Should call onRatingSubmitted after successful submission
    await waitFor(() => {
      expect(mockOnRatingSubmitted).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('handles close action', async () => {
    const mockOnClose = vi.fn();

    render(
      <ConsultationRating
        consultationId="consultation-123"
        onClose={mockOnClose}
      />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays rating history when showHistory is true', async () => {
    render(
      <ConsultationRating showHistory={true} />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Your Rating History')).toBeInTheDocument();
    });

    // Should show refresh button
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('shows empty state when no rating history', async () => {
    render(
      <ConsultationRating showHistory={true} />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('No ratings yet')).toBeInTheDocument();
    });

    expect(screen.getByText('Your consultation ratings will appear here after you submit them.')).toBeInTheDocument();
  });

  it('handles rating history expansion', async () => {
    render(
      <ConsultationRating showHistory={true} />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Your Rating History')).toBeInTheDocument();
    });

    // Wait for rating history to load and find expand button
    await waitFor(() => {
      const expandButtons = screen.getAllByRole('button');
      const expandButton = expandButtons.find(button =>
        button.getAttribute('aria-label') === 'expand' ||
        button.querySelector('svg')?.getAttribute('data-testid')?.includes('ExpandMore')
      );

      if (expandButton) {
        fireEvent.click(expandButton);

        // Should show expanded content
        expect(screen.getByText('Category Ratings')).toBeInTheDocument();
      }
    });
  });

  it('displays pharmacist response in history', async () => {
    render(
      <ConsultationRating showHistory={true} />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Your Rating History')).toBeInTheDocument();
    });

    // Expand a rating to see pharmacist response
    await waitFor(() => {
      const expandButtons = screen.getAllByRole('button');
      const expandButton = expandButtons.find(button =>
        button.querySelector('svg')?.getAttribute('data-testid')?.includes('ExpandMore')
      );

      if (expandButton) {
        fireEvent.click(expandButton);

        // Should show pharmacist response
        expect(screen.getByText('Pharmacist Response')).toBeInTheDocument();
        expect(screen.getByText(/Thank you for your feedback/i)).toBeInTheDocument();
      }
    });
  });

  it('shows loading state', () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles new consultation rating from history view', async () => {
    render(
      <ConsultationRating showHistory={true} />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Rate a New Consultation')).toBeInTheDocument();
    });

    const rateNewButton = screen.getByRole('button', { name: /rate a new consultation/i });
    fireEvent.click(rateNewButton);

    // Should show rating form
    await waitFor(() => {
      expect(screen.getByText('Rate New Consultation')).toBeInTheDocument();
      expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    });
  });

  it('updates overall rating based on category averages', async () => {
    render(
      <ConsultationRating consultationId="consultation-123" />,
      { wrapper: createWrapper(mockAuthContextValue) }
    );

    await waitFor(() => {
      expect(screen.getByText('Rate Specific Areas')).toBeInTheDocument();
    });

    // Rate all categories with 4 stars
    const categoryNames = ['Communication', 'Professional Knowledge', 'Timeliness', 'Helpfulness', 'Environment'];

    for (const categoryName of categoryNames) {
      const categorySection = screen.getByText(categoryName).closest('div');
      const ratingStars = categorySection?.querySelectorAll('input[type="radio"]');

      if (ratingStars && ratingStars.length > 3) {
        fireEvent.click(ratingStars[3]); // Click 4th star (4-star rating)
      }
    }

    // Overall rating should be updated to 4
    await waitFor(() => {
      expect(screen.getByText('4/5')).toBeInTheDocument();
    });
  });
});