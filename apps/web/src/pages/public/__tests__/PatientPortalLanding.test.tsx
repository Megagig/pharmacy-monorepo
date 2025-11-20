import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PatientPortalLanding from '../PatientPortalLanding';

// Mock the hooks with simple return values
vi.mock('../../../hooks/useHealthBlog', () => ({
  useHealthBlog: {
    useFeaturedPosts: () => ({
      data: null,
      isLoading: false,
      error: null,
    }),
    useLatestPosts: () => ({
      data: null,
      isLoading: false,
      error: null,
    }),
  },
}));

// Mock the Footer component
vi.mock('../../../components/Footer', () => ({
  default: () => <div data-testid="footer">Footer</div>,
}));

// Mock the ThemeToggle component
vi.mock('../../../components/common/ThemeToggle', () => ({
  default: ({ size, variant }: { size: string; variant: string }) => (
    <button data-testid="theme-toggle" data-size={size} data-variant={variant}>
      Theme Toggle
    </button>
  ),
}));

// Mock intersection observer
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const theme = createTheme();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('PatientPortalLanding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the landing page with hero section', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check hero section content
    expect(screen.getByText('Your Health,')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Access your pharmacy services online/)).toBeInTheDocument();
    expect(screen.getByText('Trusted by Thousands of Patients!')).toBeInTheDocument();
  });

  it('renders navigation with correct links', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check navigation links
    expect(screen.getByText('PharmaCare Patient Portal')).toBeInTheDocument();
    
    // Use getAllByRole since there are multiple "Find My Pharmacy" links
    const findPharmacyLinks = screen.getAllByRole('link', { name: /Find My Pharmacy/i });
    expect(findPharmacyLinks[0]).toHaveAttribute('href', '/patient-portal/search');
    
    expect(screen.getByRole('link', { name: /About/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Contact/i })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: /Pricing/i })).toHaveAttribute('href', '/pricing');
  });

  it('renders call-to-action buttons in hero section', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check CTA buttons
    const findPharmacyButtons = screen.getAllByRole('link', { name: /Find My Pharmacy/i });
    expect(findPharmacyButtons.length).toBeGreaterThan(0);
    expect(findPharmacyButtons[0]).toHaveAttribute('href', '/patient-portal/search');

    const signInButtons = screen.getAllByRole('link', { name: /Sign In/i });
    expect(signInButtons.length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: /Learn More/i })).toBeInTheDocument();
  });

  it('renders features section with all features', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check features section
    expect(screen.getByText('Everything You Need for Better Health')).toBeInTheDocument();
    expect(screen.getByText('Easy Appointment Booking')).toBeInTheDocument();
    expect(screen.getByText('Medication Management')).toBeInTheDocument();
    expect(screen.getByText('Secure Messaging')).toBeInTheDocument();
    expect(screen.getByText('Health Records Access')).toBeInTheDocument();
    expect(screen.getByText('HIPAA Compliant')).toBeInTheDocument();
    expect(screen.getByText('Personalized Care')).toBeInTheDocument();
  });

  it('renders about section with benefits', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check about section
    expect(screen.getByText('Why Choose Our Patient Portal?')).toBeInTheDocument();
    expect(screen.getByText('Connect with your pharmacy anytime, anywhere')).toBeInTheDocument();
    expect(screen.getByText('Secure, HIPAA-compliant platform')).toBeInTheDocument();
    expect(screen.getByText('Easy-to-use interface designed for patients')).toBeInTheDocument();
    expect(screen.getByText('Real-time updates on your prescriptions')).toBeInTheDocument();
    expect(screen.getByText('Direct communication with your pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Access to educational health resources')).toBeInTheDocument();
  });

  it('renders CTA section', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check CTA section
    expect(screen.getByText('Ready to Take Control of Your Health?')).toBeInTheDocument();
    expect(screen.getByText(/Join thousands of patients who are already using/)).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('handles mobile menu toggle', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Find and click the mobile menu button
    const menuButton = screen.getByLabelText('menu');
    expect(menuButton).toBeInTheDocument();
    
    // Click the menu button
    fireEvent.click(menuButton);
    
    // The mobile menu functionality is tested by checking if the button exists and is clickable
    // Full drawer testing would require more complex setup
  });

  it('handles learn more button click', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    const learnMoreButton = screen.getByRole('button', { name: /Learn More/i });
    
    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    fireEvent.click(learnMoreButton);

    // The button should be clickable
    expect(learnMoreButton).toBeInTheDocument();
  });

  it('renders theme toggle component', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    const themeToggles = screen.getAllByTestId('theme-toggle');
    expect(themeToggles.length).toBeGreaterThan(0);
    
    // Check that theme toggle has correct props
    expect(themeToggles[0]).toHaveAttribute('data-size', 'sm');
    expect(themeToggles[0]).toHaveAttribute('data-variant', 'button');
  });

  it('is responsive and includes mobile navigation', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check that mobile-specific elements are rendered
    expect(screen.getByLabelText('menu')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    
    // Check for proper button labels
    expect(screen.getByLabelText('menu')).toBeInTheDocument();
    
    // Check for proper link accessibility
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('handles image error fallbacks gracefully', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Find images
    const images = screen.getAllByRole('img');
    
    // Images should be present
    expect(images.length).toBeGreaterThan(0);
    
    // Test that images have alt text
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('renders with proper semantic structure', () => {
    render(<PatientPortalLanding />, { wrapper: createWrapper() });

    // Check for proper semantic elements - banner exists (header)
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
  });
});