import axios from 'axios';

// Default API instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://PharmaPilot-nttq.onrender.com/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for ensuring credentials are included (for httpOnly cookies)
api.interceptors.request.use(
  (config) => {
    // Credentials are already set in the axios instance, but ensure it's always true
    config.withCredentials = true;

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for handling auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops - only retry once
    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If error is 401 (Unauthorized)
    if (error.response?.status === 401) {

      originalRequest._retry = true;

      try {
        // Try to refresh token using httpOnly cookies
        const response = await axios.post(
          `${api.defaults.baseURL}/auth/refresh-token`,
          {}, // Empty body - refresh token is in httpOnly cookie
          { withCredentials: true }
        );

        if (response.status === 200) {

          // New access token is automatically set as httpOnly cookie by server
          // Retry original request with the same config
          return axios({
            ...originalRequest,
            withCredentials: true, // Ensure credentials are sent
          });
        } else {
          console.warn(
            'Token refresh returned unexpected status:',
            response.status
          );
        }
      } catch (refreshError) {
        console.error('Failed to refresh authentication token:', refreshError);

        // Only redirect to login for actual auth failures, not network errors
        if (axios.isAxiosError(refreshError) && refreshError.response) {
          // Redirect to login page - cookies will be cleared by server
          window.location.href = '/login?session=expired';
        } else {
          console.warn(
            'Network error during token refresh - not redirecting to login'
          );
          // For network errors, don't redirect to login - might just be temporary connectivity issue
        }
      }
    }

    return Promise.reject(error);
  }
);

// Form data API instance (for file uploads)
export const formDataApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://PharmaPilot-nttq.onrender.com/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

// Apply the same credentials interceptor to formDataApi
formDataApi.interceptors.request.use(
  (config) => {
    // Ensure credentials are included for httpOnly cookies
    config.withCredentials = true;
    return config;
  },
  (error) => Promise.reject(error)
);

// Apply the same auth error handling to formDataApi
formDataApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 (Unauthorized) and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token using httpOnly cookies
        const response = await axios.post(
          `${formDataApi.defaults.baseURL}/auth/refresh-token`,
          {}, // Empty body - refresh token is in httpOnly cookie
          { withCredentials: true }
        );

        if (response.data.success) {
          // New access token is automatically set as httpOnly cookie by server
          // Retry original request
          return formDataApi(originalRequest);
        }
      } catch (refreshError) {
        console.error('Failed to refresh authentication token', refreshError);
        // Redirect to login page - cookies will be cleared by server
        window.location.href = '/login?session=expired';
      }
    }

    return Promise.reject(error);
  }
);

// Export a simplified fetch wrapper for simpler GET requests
export const fetchData = async (endpoint: string) => {
  try {
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
};

export default api;
