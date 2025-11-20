import axios from 'axios';

// Utility to get cookie value by name
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

// Create axios instance with base configuration
// Development: Direct backend URL (Vite proxy is broken)
// Production: /api (same port, served by backend)
export const apiClient = axios.create({
  baseURL: import.meta.env.MODE === 'development'
    ? '/api'
    : '/api',
  timeout: 300000, // 5 minutes to match main api service for AI operations
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for authentication
});

// Request interceptor (no longer needs token from localStorage)
apiClient.interceptors.request.use(
  (config) => {
    // Authentication is handled via httpOnly cookies
    // No need to manually add Authorization header

    // Add CSRF token for state-changing operations
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      const csrfToken = getCookie('csrf-token');
      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }

    // Don't add custom headers that aren't in CORS allowedHeaders
    // The backend RBAC will handle authentication via cookies

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Store pending requests when refreshing token
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Function to add callbacks to the queue
const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

// Function to execute all callbacks when token refresh is complete
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// Response interceptor with enhanced token refresh logic
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Only try to refresh for 401 errors that aren't from the auth endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh-token') &&
      !originalRequest.url?.includes('/patient-portal') && // Don't auto-refresh for patient portal endpoints
      !originalRequest.url?.includes('/public/') // Don't auto-refresh for public endpoints
    ) {
      if (!isRefreshing) {
        // Set flag to indicate we're refreshing
        isRefreshing = true;
        originalRequest._retry = true;

        try {
          // Try to refresh the token - use same baseURL logic
          const refreshURL = import.meta.env.MODE === 'development'
            ? 'http://localhost:5000/api/auth/refresh-token'
            : '/api/auth/refresh-token';

          const res = await axios.post(
            refreshURL,
            {},
            { withCredentials: true }
          );

          if (res.status === 200) {
            // Token is refreshed and automatically set as a cookie
            // Resume requests
            onTokenRefreshed('refreshed');
            isRefreshing = false;

            // Retry the original request
            return apiClient(originalRequest);
          } else {
            // If refresh failed, only redirect for actual auth failures
            isRefreshing = false;
            // Don't auto-redirect, let the app handle the error
            return Promise.reject(error);
          }
        } catch (refreshError: any) {
          // Only redirect to login if it's a refresh token error (401)
          isRefreshing = false;
          
          // Check if it's actually an auth error or a permission error
          if (refreshError.response?.status === 401) {
            // Only logout if the refresh token itself is invalid
            window.location.href = '/login?session=expired';
          }
          
          return Promise.reject(refreshError);
        }
      } else {
        // If refresh is already happening, wait for it to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh(() => {
            resolve(apiClient(originalRequest));
          });
        });
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
