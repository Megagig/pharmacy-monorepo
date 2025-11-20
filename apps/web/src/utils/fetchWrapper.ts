/**
 * Fetch wrapper that ensures credentials are included
 * Uses Vite proxy (same origin for cookies)
 */

/**
 * Enhanced fetch that includes credentials for authentication
 */
export const apiFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  // Ensure credentials are included for cookie-based auth
  const finalInit: RequestInit = {
    ...init,
    credentials: init?.credentials || 'include',
  };
  
  return fetch(input, finalInit);
};

// Export as default for easy replacement
export default apiFetch;
