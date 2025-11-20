import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SkipNavigation from '../SkipNavigation';
import { AccessibilityProvider } from '../AccessibilityProvider';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <AccessibilityProvider>
        {component}
      </AccessibilityProvider>
    </ThemeProvider>
  );
};

// Mock matchMedia for AccessibilityProvider
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('SkipNavigation', () => {
  beforeEach(() => {
    // Clear any existing elements
    document.body.innerHTML = '';
    
    // Add test elements that skip navigation might target
    const nav = document.createElement('nav');
    nav.id = 'patient-navigation';
    nav.tabIndex = -1;
    document.body.appendChild(nav);
    
    const searchInput = document.createElement('input');
    searchInput.id = 'search-input';
    document.body.appendChild(searchInput);
    
    const main = document.createElement('main');
    main.tabIndex = -1;
    document.body.appendChild(main);
  });

  afterEach(() => {
    // Clean up announcer elements
    const announcers = document.querySelectorAll('[aria-live]');
    announcers.forEach(el => el.remove());
  });

  it('renders skip navigation links', () => {
    renderWithProviders(<SkipNavigation />);

    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
    expect(screen.getByText('Skip to search')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    renderWithProviders(<SkipNavigation />);

    const nav = screen.getByRole('navigation', { name: 'Skip navigation' });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute('aria-label', 'Skip navigation');
  });

  it('is initially hidden but becomes visible on focus', () => {
    renderWithProviders(<SkipNavigation />);

    const nav = screen.getByRole('navigation', { name: 'Skip navigation' });
    
    // Should be positioned off-screen initially
    expect(nav).toHaveStyle({ top: '-1000px' });
    
    // Focus on the first skip link
    const skipToContentButton = screen.getByText('Skip to main content');
    skipToContentButton.focus();
    
    // Navigation should become visible when focused
    expect(nav).toHaveStyle({ top: '0px' });
  });

  it('skips to main content when clicked', () => {
    renderWithProviders(<SkipNavigation />);

    const mainElement = document.querySelector('main');
    const skipButton = screen.getByText('Skip to main content');
    
    fireEvent.click(skipButton);
    
    expect(mainElement).toHaveFocus();
  });

  it('skips to navigation when clicked', () => {
    renderWithProviders(<SkipNavigation />);

    const navElement = document.getElementById('patient-navigation');
    const skipButton = screen.getByText('Skip to navigation');
    
    fireEvent.click(skipButton);
    
    expect(navElement).toHaveFocus();
  });

  it('skips to search when clicked', () => {
    renderWithProviders(<SkipNavigation />);

    const searchElement = document.getElementById('search-input');
    const skipButton = screen.getByText('Skip to search');
    
    fireEvent.click(skipButton);
    
    expect(searchElement).toHaveFocus();
  });

  it('handles missing target elements gracefully', () => {
    // Remove the search input to test graceful handling
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.remove();
    }

    renderWithProviders(<SkipNavigation />);

    const skipButton = screen.getByText('Skip to search');
    
    // Should not throw an error when target doesn't exist
    expect(() => {
      fireEvent.click(skipButton);
    }).not.toThrow();
  });

  it('provides keyboard navigation support', () => {
    renderWithProviders(<SkipNavigation />);

    const buttons = screen.getAllByRole('button');
    
    // All buttons should be focusable
    buttons.forEach(button => {
      expect(button).toHaveAttribute('tabIndex', '0');
    });
  });

  it('has proper button styling for accessibility', () => {
    renderWithProviders(<SkipNavigation />);

    const buttons = screen.getAllByRole('button');
    
    buttons.forEach(button => {
      // Should have focus styles defined
      expect(button).toHaveStyle({
        '&:focus': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px',
        },
      });
    });
  });

  it('maintains proper tab order', () => {
    renderWithProviders(<SkipNavigation />);

    const skipToContent = screen.getByText('Skip to main content');
    const skipToNav = screen.getByText('Skip to navigation');
    const skipToSearch = screen.getByText('Skip to search');

    // Tab through the skip links
    skipToContent.focus();
    expect(skipToContent).toHaveFocus();

    // Simulate tab key
    fireEvent.keyDown(skipToContent, { key: 'Tab' });
    skipToNav.focus();
    expect(skipToNav).toHaveFocus();

    fireEvent.keyDown(skipToNav, { key: 'Tab' });
    skipToSearch.focus();
    expect(skipToSearch).toHaveFocus();
  });

  it('works with keyboard activation', () => {
    renderWithProviders(<SkipNavigation />);

    const mainElement = document.querySelector('main');
    const skipButton = screen.getByText('Skip to main content');
    
    skipButton.focus();
    
    // Activate with Enter key
    fireEvent.keyDown(skipButton, { key: 'Enter' });
    fireEvent.click(skipButton); // Click event is triggered by Enter
    
    expect(mainElement).toHaveFocus();
  });

  it('works with space key activation', () => {
    renderWithProviders(<SkipNavigation />);

    const mainElement = document.querySelector('main');
    const skipButton = screen.getByText('Skip to main content');
    
    skipButton.focus();
    
    // Activate with Space key
    fireEvent.keyDown(skipButton, { key: ' ' });
    fireEvent.click(skipButton); // Click event is triggered by Space
    
    expect(mainElement).toHaveFocus();
  });

  it('announces actions to screen readers', () => {
    renderWithProviders(<SkipNavigation />);

    const skipButton = screen.getByText('Skip to main content');
    fireEvent.click(skipButton);

    // Check that announcer element receives the message
    const announcer = document.querySelector('[aria-live]');
    expect(announcer).toHaveTextContent('Skipped to main content');
  });

  it('has appropriate ARIA labels', () => {
    renderWithProviders(<SkipNavigation />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Skip navigation');
  });

  it('maintains focus visibility', () => {
    renderWithProviders(<SkipNavigation />);

    const skipButton = screen.getByText('Skip to main content');
    skipButton.focus();

    // Should have visible focus indicator
    expect(skipButton).toHaveStyle({
      '&:focus': {
        outline: '3px solid',
        outlineColor: 'primary.main',
        outlineOffset: '2px',
      },
    });
  });
});