import axios from 'axios';

/**
 * Utility functions for cookie operations
 * Note: HTTP-only cookies cannot be read directly by JavaScript,
 * but we can check for their existence through server communication
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://PharmaPilot-nttq.onrender.com/api';

export const hasAuthenticationCookies = async (): Promise<boolean> => {
  try {
    // Make a lightweight request to check if auth cookies exist
    const response = await axios.get(`${API_BASE_URL}/auth/check-cookies`, {
      withCredentials: true,
    });

    // Check if the response indicates cookies exist
    if (response.status === 200 && response.data.hasCookies) {

      return true;
    }

    return false;
  } catch (error) {
    console.error('Cookie check failed:', error);
    return false;
  }
};

/**
 * Checks if we're likely to be authenticated based on browser session state
 * This is a fallback for when the server check fails
 */
export const hasSessionState = (): boolean => {
  try {
    // Check if we have any session indicators
    // Since we're using HTTP-only cookies, we can't read them directly
    // But we can check browser session storage or other indicators
    return sessionStorage.getItem('auth_attempted') === 'true';
  } catch {
    return false;
  }
};

/**
 * Mark that authentication has been attempted in this session
 */
export const markAuthAttempted = (): void => {
  try {
    sessionStorage.setItem('auth_attempted', 'true');
  } catch {
    // Ignore if sessionStorage is not available
  }
};

/**
 * Clear session markers on logout
 */
export const clearSessionState = (): void => {
  try {
    sessionStorage.removeItem('auth_attempted');
  } catch {
    // Ignore if sessionStorage is not available
  }
};
