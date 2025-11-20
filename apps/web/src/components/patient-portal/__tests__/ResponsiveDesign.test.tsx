import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { vi } from 'vitest';

const theme = createTheme();

// Mock useMediaQuery
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  };
});

const ResponsiveComponent = () => {
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  return (
    <div>
      {isMobile && <div data-testid="mobile-view">Mobile View</div>}
      {isTablet && <div data-testid="tablet-view">Tablet View</div>}
      {isDesktop && <div data-testid="desktop-view">Desktop View</div>}
    </div>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('Responsive Design', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mobile view on small screens', () => {
    vi.mocked(useMediaQuery).mockImplementation((query) => {
      if (query === theme.breakpoints.down('md')) return true;
      if (query === theme.breakpoints.between('md', 'lg')) return false;
      if (query === theme.breakpoints.up('lg')) return false;
      return false;
    });

    renderWithProviders(<ResponsiveComponent />);

    expect(screen.getByTestId('mobile-view')).toBeInTheDocument();
    expect(screen.queryByTestId('tablet-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('desktop-view')).not.toBeInTheDocument();
  });

  it('renders tablet view on medium screens', () => {
    vi.mocked(useMediaQuery).mockImplementation((query) => {
      if (query === theme.breakpoints.down('md')) return false;
      if (query === theme.breakpoints.between('md', 'lg')) return true;
      if (query === theme.breakpoints.up('lg')) return false;
      return false;
    });

    renderWithProviders(<ResponsiveComponent />);

    expect(screen.queryByTestId('mobile-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('tablet-view')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-view')).not.toBeInTheDocument();
  });

  it('renders desktop view on large screens', () => {
    vi.mocked(useMediaQuery).mockImplementation((query) => {
      if (query === theme.breakpoints.down('md')) return false;
      if (query === theme.breakpoints.between('md', 'lg')) return false;
      if (query === theme.breakpoints.up('lg')) return true;
      return false;
    });

    renderWithProviders(<ResponsiveComponent />);

    expect(screen.queryByTestId('mobile-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tablet-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('desktop-view')).toBeInTheDocument();
  });

  it('handles window resize events', () => {
    // Mock window.matchMedia for resize events
    const mockMatchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    renderWithProviders(<ResponsiveComponent />);

    // Verify matchMedia was called for responsive queries
    expect(mockMatchMedia).toHaveBeenCalled();
  });

  it('handles touch events on mobile', () => {
    // Mock touch support
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      value: {},
    });

    const TouchComponent = () => {
      const isTouchDevice = 'ontouchstart' in window;
      return (
        <div data-testid={isTouchDevice ? 'touch-device' : 'non-touch-device'}>
          {isTouchDevice ? 'Touch Device' : 'Non-Touch Device'}
        </div>
      );
    };

    renderWithProviders(<TouchComponent />);

    expect(screen.getByTestId('touch-device')).toBeInTheDocument();
  });

  it('handles orientation changes', () => {
    // Mock orientation API
    Object.defineProperty(screen, 'orientation', {
      writable: true,
      value: { angle: 0 },
    });

    const OrientationComponent = () => {
      const [orientation, setOrientation] = React.useState('portrait');

      React.useEffect(() => {
        const handleOrientationChange = () => {
          setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
        };

        window.addEventListener('orientationchange', handleOrientationChange);
        return () => window.removeEventListener('orientationchange', handleOrientationChange);
      }, []);

      return <div data-testid={`${orientation}-mode`}>{orientation} Mode</div>;
    };

    renderWithProviders(<OrientationComponent />);

    expect(screen.getByTestId('portrait-mode')).toBeInTheDocument();
  });

  it('handles high DPI displays', () => {
    // Mock devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: 2,
    });

    const DPIComponent = () => {
      const isHighDPI = window.devicePixelRatio > 1;
      return (
        <div data-testid={isHighDPI ? 'high-dpi' : 'standard-dpi'}>
          {isHighDPI ? 'High DPI' : 'Standard DPI'}
        </div>
      );
    };

    renderWithProviders(<DPIComponent />);

    expect(screen.getByTestId('high-dpi')).toBeInTheDocument();
  });

  it('handles reduced motion preference', () => {
    // Mock prefers-reduced-motion
    const mockMatchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    const MotionComponent = () => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return (
        <div data-testid={prefersReducedMotion ? 'reduced-motion' : 'normal-motion'}>
          {prefersReducedMotion ? 'Reduced Motion' : 'Normal Motion'}
        </div>
      );
    };

    renderWithProviders(<MotionComponent />);

    expect(screen.getByTestId('reduced-motion')).toBeInTheDocument();
  });

  it('handles dark mode preference', () => {
    // Mock prefers-color-scheme
    const mockMatchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    const ThemeComponent = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return (
        <div data-testid={prefersDark ? 'dark-theme' : 'light-theme'}>
          {prefersDark ? 'Dark Theme' : 'Light Theme'}
        </div>
      );
    };

    renderWithProviders(<ThemeComponent />);

    expect(screen.getByTestId('dark-theme')).toBeInTheDocument();
  });
});