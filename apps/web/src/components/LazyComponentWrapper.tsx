import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LazyComponentWrapperProps {
  children: React.ReactNode;
  loadingMessage?: string;
}

/**
 * Wrapper component for lazy-loaded components that use React hooks.
 * Ensures React contexts are fully initialized before rendering children.
 * This prevents "dispatcher is null" errors with lazy-loaded components.
 */
export const LazyComponentWrapper: React.FC<LazyComponentWrapperProps> = ({
  children,
  loadingMessage = 'Loading...',
}) => {
  const [isContextReady, setIsContextReady] = React.useState(false);

  React.useEffect(() => {
    // Use a microtask to ensure React's context providers are ready
    Promise.resolve().then(() => {
      setIsContextReady(true);
    });
  }, []);

  if (!isContextReady) {
    return (
      <Box
        sx={{
          p: 3,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, color: '#666' }}>
            {loadingMessage}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
};

/**
 * Higher-order component version for wrapping component exports
 */
export const withLazyInit = <P extends object>(
  Component: React.ComponentType<P>,
  loadingMessage?: string
) => {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <LazyComponentWrapper loadingMessage={loadingMessage}>
      <Component {...props} ref={ref} />
    </LazyComponentWrapper>
  ));

  WrappedComponent.displayName = `withLazyInit(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
};

export default LazyComponentWrapper;
