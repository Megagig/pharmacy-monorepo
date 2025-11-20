import React, { createContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface PatientUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  workspaceId: string;
  workspaceName: string;
  status: 'pending' | 'active' | 'suspended';
  emailVerified: boolean;
  profileComplete: boolean;
  lastLoginAt?: Date;
  preferences?: {
    notifications: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
    language: string;
    timezone: string;
  };
}

interface PatientAuthResponse {
  success: boolean;
  message?: string;
  data?: {
    patientUser?: PatientUser;
    [key: string]: any;
  };
  user?: PatientUser; // For backward compatibility
  token?: string;
  requiresApproval?: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
  workspaceId: string;
}

interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender?: 'male' | 'female' | 'other'; // Optional
  password: string;
  workspaceId: string;
}

interface PatientAuthContextType {
  user: PatientUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<PatientAuthResponse>;
  register: (userData: RegistrationData) => Promise<PatientAuthResponse>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<PatientAuthResponse>;
  forgotPassword: (email: string, workspaceId: string) => Promise<PatientAuthResponse>;
  resetPassword: (token: string, password: string) => Promise<PatientAuthResponse>;
  updateProfile: (profileData: Partial<PatientUser>) => Promise<PatientAuthResponse>;
  refreshToken: () => Promise<boolean>;
  checkAuthStatus: () => Promise<void>;
}

interface PatientAuthProviderProps {
  children: ReactNode;
}

export const PatientAuthContext = createContext<PatientAuthContextType | undefined>(
  undefined
);

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Patient Auth Service using httpOnly cookies
class PatientAuthService {
  private static baseUrl = `${API_BASE_URL}/patient-portal/auth`;

  static async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      data?: any;
    } = {}
  ): Promise<T> {
    try {
      const response = await axios({
        url: `${this.baseUrl}${endpoint}`,
        method: options.method || 'GET',
        data: options.data,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true, // Include httpOnly cookies
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Request failed');
      }
      throw new Error(error.message || 'Network error');
    }
  }

  static async login(credentials: LoginCredentials): Promise<PatientAuthResponse> {
    return this.makeRequest<PatientAuthResponse>('/login', {
      method: 'POST',
      data: credentials,
    });
  }

  static async register(userData: RegistrationData): Promise<PatientAuthResponse> {
    return this.makeRequest<PatientAuthResponse>('/register', {
      method: 'POST',
      data: userData,
    });
  }

  static async getCurrentUser(): Promise<{ success: boolean; data: { patientUser: PatientUser } }> {
    return this.makeRequest<{ success: boolean; data: { patientUser: PatientUser } }>('/me');
  }

  static async refreshToken(): Promise<{ success: boolean }> {
    return this.makeRequest<{ success: boolean }>('/refresh-token', {
      method: 'POST',
    });
  }

  static async logout(): Promise<void> {
    await this.makeRequest('/logout', {
      method: 'POST',
    });
  }

  static async verifyEmail(token: string): Promise<PatientAuthResponse> {
    return this.makeRequest<PatientAuthResponse>('/verify-email', {
      method: 'POST',
      data: { token },
    });
  }

  static async forgotPassword(email: string, workspaceId: string): Promise<PatientAuthResponse> {
    return this.makeRequest<PatientAuthResponse>('/forgot-password', {
      method: 'POST',
      data: { email, workspaceId },
    });
  }

  static async resetPassword(token: string, password: string): Promise<PatientAuthResponse> {
    return this.makeRequest<PatientAuthResponse>('/reset-password', {
      method: 'POST',
      data: { token, password },
    });
  }

  static async updateProfile(profileData: Partial<PatientUser>): Promise<PatientAuthResponse> {
    return this.makeRequest<PatientAuthResponse>('/profile', {
      method: 'PUT',
      data: profileData,
    });
  }
}

export const PatientAuthProvider: React.FC<PatientAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<PatientUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get current user using httpOnly cookies
        const response = await PatientAuthService.getCurrentUser();
        if (response.success && response.data?.patientUser) {
          setUser(response.data.patientUser);
        }
      } catch (error) {

        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      try {
        await PatientAuthService.refreshToken();

      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, logout user
        await logout();
      }
    }, 30 * 60 * 1000); // Refresh every 30 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  const login = async (credentials: LoginCredentials): Promise<PatientAuthResponse> => {
    try {

      const response = await PatientAuthService.login(credentials);

      if (response.success && response.data?.patientUser) {

        setUser(response.data.patientUser);
        return response;
      }

      // If response is not successful, throw error
      console.error('❌ PatientAuthContext: Login response not successful');
      throw new Error(response.message || 'Login failed');
    } catch (error: any) {
      console.error('❌ PatientAuthContext: Login error:', error);
      // Re-throw the error so it can be caught by the calling code
      throw error;
    }
  };

  const register = async (userData: RegistrationData): Promise<PatientAuthResponse> => {
    try {
      return await PatientAuthService.register(userData);
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Registration failed. Please try again.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await PatientAuthService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const verifyEmail = async (token: string): Promise<PatientAuthResponse> => {
    try {
      return await PatientAuthService.verifyEmail(token);
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Email verification failed.',
      };
    }
  };

  const forgotPassword = async (email: string, workspaceId: string): Promise<PatientAuthResponse> => {
    try {
      return await PatientAuthService.forgotPassword(email, workspaceId);
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to send password reset email.',
      };
    }
  };

  const resetPassword = async (token: string, password: string): Promise<PatientAuthResponse> => {
    try {
      return await PatientAuthService.resetPassword(token, password);
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Password reset failed.',
      };
    }
  };

  const updateProfile = async (profileData: Partial<PatientUser>): Promise<PatientAuthResponse> => {
    try {
      const response = await PatientAuthService.updateProfile(profileData);

      if (response.success && response.user) {
        setUser(response.user);
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Profile update failed.',
      };
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      await PatientAuthService.refreshToken();
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  const checkAuthStatus = async (): Promise<void> => {
    try {
      const response = await PatientAuthService.getCurrentUser();
      if (response.success && response.data?.patientUser) {
        setUser(response.data.patientUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    }
  };

  const value: PatientAuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    updateProfile,
    refreshToken,
    checkAuthStatus,
  };

  return (
    <PatientAuthContext.Provider value={value}>
      {children}
    </PatientAuthContext.Provider>
  );
};