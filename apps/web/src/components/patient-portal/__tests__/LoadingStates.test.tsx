import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CircularProgress, Skeleton, LinearProgress } from '@mui/material';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Loading components
const CircularLoader = () => (
  <div data-testid="circular-loader">
    <CircularProgress />
  </div>
);

const LinearLoader = () => (
  <div data-testid="linear-loader">
    <LinearProgress />
  </div>
);

const SkeletonLoader = () => (
  <div data-testid="skeleton-loader">
    <Skeleton variant="text" width="100%" height={40} />
    <Skeleton variant="rectangular" width="100%" height={200} />
    <Skeleton variant="circular" width={40} height={40} />
  </div>
);

const CardSkeleton = () => (
  <div data-testid="card-skeleton">
    <Skeleton variant="rectangular" width="100%" height={120} />
    <Skeleton variant="text" width="80%" />
    <Skeleton variant="text" width="60%" />
  </div>
);

const TableSkeleton = () => (
  <div data-testid="table-skeleton">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
        <Skeleton variant="text" width="20%" />
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="text" width="25%" />
        <Skeleton variant="text" width="25%" />
      </div>
    ))}
  </div>
);

describe('Loading States', () => {
  it('renders circular progress loader', () => {
    renderWithProviders(<CircularLoader />);

    expect(screen.getByTestId('circular-loader')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders linear progress loader', () => {
    renderWithProviders(<LinearLoader />);

    expect(screen.getByTestId('linear-loader')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders skeleton loaders', () => {
    renderWithProviders(<SkeletonLoader />);

    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
    
    // Check for different skeleton variants
    const skeletons = screen.getAllByTestId('skeleton-loader')[0];
    expect(skeletons).toBeInTheDocument();
  });

  it('renders card skeleton', () => {
    renderWithProviders(<CardSkeleton />);

    expect(screen.getByTestId('card-skeleton')).toBeInTheDocument();
  });

  it('renders table skeleton', () => {
    renderWithProviders(<TableSkeleton />);

    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
  });

  it('handles loading with custom size', () => {
    renderWithProviders(
      <CircularProgress size={60} data-testid="large-loader" />
    );

    const loader = screen.getByTestId('large-loader');
    expect(loader).toBeInTheDocument();
  });

  it('handles loading with custom color', () => {
    renderWithProviders(
      <CircularProgress color="secondary" data-testid="colored-loader" />
    );

    const loader = screen.getByTestId('colored-loader');
    expect(loader).toBeInTheDocument();
  });

  it('handles determinate progress', () => {
    renderWithProviders(
      <LinearProgress variant="determinate" value={50} data-testid="progress-bar" />
    );

    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toBeInTheDocument();
  });

  it('handles skeleton with animation', () => {
    renderWithProviders(
      <Skeleton animation="wave" width="100%" height={40} data-testid="animated-skeleton" />
    );

    const skeleton = screen.getByTestId('animated-skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('handles skeleton without animation', () => {
    renderWithProviders(
      <Skeleton animation={false} width="100%" height={40} data-testid="static-skeleton" />
    );

    const skeleton = screen.getByTestId('static-skeleton');
    expect(skeleton).toBeInTheDocument();
  });
});