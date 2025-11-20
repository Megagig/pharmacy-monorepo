import axios from 'axios';

// Utility to check authentication status using httpOnly cookies
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const response = await axios.get('/api/auth/me', {
      withCredentials: true,
    });
    return response.status === 200;
  } catch {
    return false;
  }
};

// Utility to check if user has a specific role
export const hasRole = async (requiredRole: string): Promise<boolean> => {
  try {
    const response = await axios.get('/api/auth/me', {
      withCredentials: true,
    });

    if (response.status !== 200) return false;

    return response.data.user?.role === requiredRole;
  } catch {
    return false;
  }
};
