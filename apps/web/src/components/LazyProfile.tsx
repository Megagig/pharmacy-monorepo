import React from 'react';
import { lazyWithRetry } from '../utils/chunkLoadingUtils';

// Development mode: Import Profile directly as a fallback
const DirectProfile = React.lazy(() => import('../pages/Profile'));

// Production/Enhanced mode: Use retry mechanism
const RetryProfile = lazyWithRetry(() => import('../pages/Profile'), 'Profile');

// Export the appropriate component based on environment and preference
export const LazyProfile = import.meta.env.DEV ? DirectProfile : RetryProfile;

// Also export a version that always uses retry (for testing)
export const LazyProfileWithRetry = RetryProfile;

// Default export uses the environment-appropriate version
export default LazyProfile;