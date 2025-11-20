import React, { createContext, useState, useEffect, ReactNode } from 'react';
import {
  authService,
  UserData as ServiceUserData,
  AuthResponse as ServiceAuthResponse,
} from '../services/authService';
import { markAuthAttempted, clearSessionState } from '../utils/cookieUtils';

interface SubscriptionPlan {
  _id: string;
  name: string;
  priceNGN: number;
  billingInterval: 'monthly' | 'yearly';
  features: {
    patientLimit: number | null;
    reminderSmsMonthlyLimit: number | null;
    reportsExport: boolean;
    careNoteExport: boolean;
    adrModule: boolean;
    multiUserSupport: boolean;
  };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'pharmacist' | 'technician' | 'owner' | 'admin' | 'super_admin' | 'pharmacy_outlet' | 'pharmacy_team' | 'intern_pharmacist';
  workplaceRole?: 'Owner' | 'Staff' | 'Pharmacist' | 'Cashier' | 'Technician' | 'Assistant';
  status: 'pending' | 'active' | 'suspended';
  emailVerified: boolean;
  currentPlan: SubscriptionPlan;
  pharmacyId?: string;
  lastLoginAt?: Date;
  licenseStatus?: 'pending' | 'approved' | 'rejected';
  subscription?: {
    status: 'active' | 'canceled' | 'expired' | 'pending' | 'trial';
    expiresAt: string;
    canceledAt?: string;
    tier?: string;
  };
  // Workspace permissions - authoritative source for feature access
  permissions?: string[];
  tier?: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (userData: RegisterData) => Promise<AuthResponse>;
  verifyEmail: (token?: string, code?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateProfile: (profileData: Partial<User>) => Promise<AuthResponse>;
  forgotPassword: (email: string) => Promise<AuthResponse>;
  resetPassword: (token: string, password: string) => Promise<AuthResponse>;
  hasFeature: (featureName: string) => boolean;
  checkLimit: (limitName: string, currentCount: number) => boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role?: 'pharmacist' | 'technician' | 'owner' | 'pharmacy_outlet' | 'pharmacy_team' | 'intern_pharmacist';
}

interface AuthProviderProps {
  children: ReactNode;
}

// Export the context and types for use in hooks
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// Note: useAuth hook is now in ../hooks/useAuth.ts
export type { AuthContextType };

// Utility function to convert ServiceUserData to our User type
const convertUserData = (
  userData: ServiceUserData | undefined
): User | null => {
  if (!userData) return null;

  // Map the role string to our more specific type
  let typedRole:
    | 'pharmacist'
    | 'technician'
    | 'owner'
    | 'admin'
    | 'super_admin'
    | 'pharmacy_outlet'
    | 'pharmacy_team'
    | 'intern_pharmacist' = 'pharmacist';

  if (
    userData.role === 'pharmacist' ||
    userData.role === 'technician' ||
    userData.role === 'owner' ||
    userData.role === 'admin' ||
    userData.role === 'super_admin' ||
    userData.role === 'pharmacy_outlet' ||
    userData.role === 'pharmacy_team' ||
    userData.role === 'intern_pharmacist'
  ) {
    typedRole = userData.role as
      | 'pharmacist'
      | 'technician'
      | 'owner'
      | 'admin'
      | 'super_admin'
      | 'pharmacy_outlet'
      | 'pharmacy_team'
      | 'intern_pharmacist';
  }

  // Convert the status to the expected type
  let typedStatus: 'pending' | 'active' | 'suspended' = 'pending';
  if (
    userData.status === 'pending' ||
    userData.status === 'active' ||
    userData.status === 'suspended'
  ) {
    typedStatus = userData.status as 'pending' | 'active' | 'suspended';
  }

  return {
    ...userData,
    role: typedRole,
    status: typedStatus,
    // Ensure currentPlan is properly typed
    currentPlan: userData.currentPlan as SubscriptionPlan,
  };
};

// Utility function to convert ServiceAuthResponse to our AuthResponse type
const convertAuthResponse = (response: ServiceAuthResponse): AuthResponse => {
  return {
    ...response,
    // Ensure message exists (even if undefined in the original)
    message: response.message || '',
    // Convert user data if it exists
    user: response.user ? convertUserData(response.user) : undefined,
  } as AuthResponse; // Force type assertion
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize auth on mount only - no dependencies to avoid re-rendering
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      try {

        // Try to get current user - if successful, we're authenticated
        const userData = await authService.getCurrentUser();

        setUser(convertUserData(userData.user));
        markAuthAttempted();
      } catch (error: unknown) {
        console.error('AuthContext: Auth initialization failed:', error);
        const authError = error as { status?: number; message?: string };

        // Only clear user on explicit 401 Unauthorized
        if (authError?.status === 401) {

          setUser(null);
          clearSessionState();
        } else {

          // For all other errors (network, server errors, etc.), maintain current state
          // This prevents losing authentication due to temporary issues
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Clean up function
    return () => { };
  }, []); // Empty dependency array to run only on mount

  // Separate effect for token refresh that doesn't depend on user state
  useEffect(() => {
    // Set up token refresh interval - refresh every 30 minutes to ensure tokens never expire
    // Access token expires in 1 hour, so this gives us a 30-minute safety margin
    const tokenRefreshInterval = setInterval(async () => {
      try {
        // Check if user is logged in from a ref or some other means that doesn't cause re-renders

        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          console.warn('AuthContext: Scheduled token refresh failed');
        }
      } catch (error) {
        console.error(
          'AuthContext: Error during scheduled token refresh:',
          error
        );
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Clean up interval on component unmount
    return () => clearInterval(tokenRefreshInterval);
  }, []); // Empty dependency array to run only on mount
  const login = async (
    credentials: LoginCredentials
  ): Promise<AuthResponse> => {
    const serviceResponse = await authService.login(credentials);
    const response = convertAuthResponse(serviceResponse);
    if (response.success && response.user) {
      setUser(response.user);
      markAuthAttempted(); // Mark successful auth attempt
    }
    return response;
  };

  const register = async (userData: RegisterData): Promise<AuthResponse> => {
    const serviceResponse = await authService.register(userData);
    // Note: Registration doesn't automatically log in due to email verification
    return convertAuthResponse(serviceResponse);
  };

  const verifyEmail = async (
    token?: string,
    code?: string
  ): Promise<AuthResponse> => {
    const serviceResponse = await authService.verifyEmail(token, code);
    return convertAuthResponse(serviceResponse);
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      clearSessionState(); // Clear session markers
    }
  };

  const logoutAll = async (): Promise<void> => {
    try {
      await authService.logoutAll();
    } catch (error) {
      console.error('Logout all failed:', error);
    } finally {
      setUser(null);
      clearSessionState(); // Clear session markers
    }
  };

  const updateProfile = async (
    profileData: Partial<User>
  ): Promise<AuthResponse> => {
    const serviceResponse = await authService.updateProfile(profileData);
    const response = convertAuthResponse(serviceResponse);
    if (response.success && response.user) {
      setUser(response.user);
    }
    return response;
  };

  const forgotPassword = async (email: string): Promise<AuthResponse> => {
    const serviceResponse = await authService.forgotPassword(email);
    return convertAuthResponse(serviceResponse);
  };

  const resetPassword = async (
    token: string,
    password: string
  ): Promise<AuthResponse> => {
    const serviceResponse = await authService.resetPassword(token, password);
    return convertAuthResponse(serviceResponse);
  };

  const hasFeature = (featureName: string): boolean => {
    if (!user) return false;

    // Super admin has access to all features
    if (user.role === 'super_admin') return true;

    // Check workspace permissions first (authoritative source from backend)
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(featureName);
    }

    // Check user's subscription features
    if (user?.subscription?.status === 'active' || user?.subscription?.status === 'trial') {
      return true;
    }

    // Fallback to plan features for backward compatibility
    if (user.currentPlan) {
      return (
        user.currentPlan.features[
        featureName as keyof typeof user.currentPlan.features
        ] === true
      );
    }

    // Allow access to basic features for better UX
    const basicFeatures = [
      'dashboard_overview',
      'patient_management',
      'patient_engagement',
      'clinical_notes',
      'medication_management_basic',
      'basic_reports',
      'settings_config',
    ];

    return basicFeatures.includes(featureName);
  };

  const checkLimit = (limitName: string, currentCount: number): boolean => {
    if (!user || !user.currentPlan) return false;
    const limit =
      user.currentPlan.features[
      limitName as keyof typeof user.currentPlan.features
      ];
    return limit === null || currentCount < (limit as number);
  };

  const value = {
    user,
    loading,
    login,
    register,
    verifyEmail,
    logout,
    logoutAll,
    updateProfile,
    forgotPassword,
    resetPassword,
    hasFeature,
    checkLimit,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
