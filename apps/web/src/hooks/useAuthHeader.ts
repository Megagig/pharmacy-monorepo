import { useCallback } from 'react';

/**
 * Hook to get authentication headers for API requests
 * @returns Object containing auth headers with token if authenticated
 */
const useAuthHeader = () => {
  // Get the stored token from localStorage directly
  // This matches the pattern used in the app
  const getAuthHeader = useCallback(() => {
    const storedToken = localStorage.getItem('authToken');
    return storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
  }, []);

  return getAuthHeader;
};

export default useAuthHeader;
