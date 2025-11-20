import axios, { AxiosError } from 'axios';

// Development: Direct backend URL (Vite proxy is broken)
// Production: /api (same port, served by backend)
const API_BASE_URL = import.meta.env.MODE === 'development' 
  ? 'http://localhost:5000/api' 
  : '/api';

// Define subscription plan type
export interface SubscriptionPlan {
  _id: string;
  name: string;
  priceNGN: number;
  billingInterval: string;
  features: Record<string, unknown>;
}

// Define the user data type
export interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  currentPlan?: SubscriptionPlan;
  workplaceId?: string;
}

// Define workplace response type
export interface WorkplaceResponse {
  success: boolean;
  data: {
    _id: string;
    name: string;
    type: string;
    email: string;
    licenseNumber?: string; // Optional - can be added later
    address: string;
    state: string;
    lga: string;
    inviteCode: string;
    ownerId: string;
    teamMembers: string[];
    teamSize: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

// Define the auth response type
export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: UserData;
  token?: string;
}

// Create a type for the auth service to help with imports
export type AuthServiceType = {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  // Add other methods as needed
};

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
  inviteToken?: string;  // Workspace invite token from invite link
  inviteCode?: string;   // Workplace invite code
}

interface RegisterWithWorkplaceData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
  workplaceFlow: 'create' | 'join' | 'skip';
  workplace?: {
    name: string;
    type: string;
    email: string;
    address?: string;
    state?: string;
    lga?: string;
  };
  inviteCode?: string;
  workplaceRole?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface ProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface AuthError extends Error {
  status?: number;
  data?: unknown;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

class AuthService {
  private refreshPromise: Promise<boolean> | null = null;

  async makeRequest(url: string, options: RequestInit = {}): Promise<unknown> {
    try {
      const method = ((options.method as string) || 'GET') as HttpMethod;

      const response = await axios({
        url: `${API_BASE_URL}${url}`,
        method,
        data: options.body ? JSON.parse(options.body as string) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        },
        withCredentials: true, // Always include cookies
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      // If token expired, try to refresh (but avoid infinite loops)
      if (
        axiosError.response?.status === 401 &&
        !url.includes('/auth/refresh-token') &&
        !url.includes('/auth/me') &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/register')
      ) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request
          const method = ((options.method as string) || 'GET') as HttpMethod;
          const retryResponse = await axios({
            url: `${API_BASE_URL}${url}`,
            method,
            data: options.body ? JSON.parse(options.body as string) : undefined,
            headers: {
              'Content-Type': 'application/json',
              ...((options.headers as Record<string, string>) || {}),
            },
            withCredentials: true,
          });
          return retryResponse.data;
        }
      }

      // Handle different types of authentication/authorization errors
      if (axiosError.response?.status === 401) {
        const errorData = axiosError.response.data as { message?: string; requiresApproval?: boolean; requiresVerification?: boolean };
        const errorMessage = errorData?.message || 'Authentication failed';
        
        // Don't redirect if user needs approval or verification - they're already on login page
        const shouldRedirect = !url.includes('/auth/me') && 
                              !url.includes('/auth/refresh-token') && 
                              !url.includes('/auth/login') &&
                              !errorData?.requiresApproval &&
                              !errorData?.requiresVerification;
        
        if (shouldRedirect) {
          window.location.href = '/login';
        }
        
        const authError: AuthError = new Error(errorMessage);
        authError.status = axiosError.response.status;
        authError.data = errorData;
        throw authError;
      } else if (axiosError.response?.status === 402) {
        // Payment/subscription required - don't logout, just throw error
        const authError: AuthError = new Error(
          (axiosError.response.data as { message?: string })?.message ||
            'Subscription required'
        );
        authError.status = axiosError.response.status;
        throw authError;
      }

      const authError: AuthError = new Error(
        (axiosError.response?.data as { message?: string })?.message ||
          axiosError.message ||
          'An error occurred'
      );
      authError.status = axiosError.response?.status;
      throw authError;
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    return result;
  }

  private async performRefresh(): Promise<boolean> {
    try {

      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        {},
        {
          withCredentials: true, // Include httpOnly cookies
        }
      );

      if (response.status === 200) {

        // New access token is automatically set as httpOnly cookie by server
        return true;
      } else {

        // Refresh failed, we'll need to redirect to login
        return false;
      }
    } catch (err) {
      console.error('Token refresh error:', err);
      return false;
    }
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    return this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }) as Promise<AuthResponse>;
  }

  async registerWithWorkplace(
    userData: RegisterWithWorkplaceData
  ): Promise<AuthResponse> {
    return this.makeRequest('/auth/register-with-workplace', {
      method: 'POST',
      body: JSON.stringify(userData),
    }) as Promise<AuthResponse>;
  }

  async findWorkplaceByInviteCode(
    inviteCode: string
  ): Promise<WorkplaceResponse> {
    return this.makeRequest(`/auth/workplace/invite/${inviteCode}`, {
      method: 'GET',
    }) as Promise<WorkplaceResponse>;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = (await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })) as AuthResponse;

    // No need to store tokens - they're automatically set as httpOnly cookies by server
    return response;
  }

  async verifyEmail(token?: string, code?: string): Promise<AuthResponse> {
    const body: { token?: string; code?: string } = {};
    if (token) body.token = token;
    if (code) body.code = code;

    return this.makeRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as Promise<AuthResponse>;
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      // Continue with logout even if server request fails
      console.error('Logout request failed:', error);
    }
    // Cookies are cleared by server
  }

  async logoutAll(): Promise<void> {
    try {
      await this.makeRequest('/auth/logout-all', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout all request failed:', error);
    }
    // Cookies are cleared by server
  }

  async getCurrentUser(): Promise<AuthResponse> {
    return this.makeRequest('/auth/me') as Promise<AuthResponse>;
  }

  async refreshToken(): Promise<boolean> {
    try {
      await axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        {},
        {
          withCredentials: true, // Include httpOnly cookies
        }
      );
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  async updateProfile(profileData: ProfileData): Promise<AuthResponse> {
    return this.makeRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }) as Promise<AuthResponse>;
  }

  async forgotPassword(email: string): Promise<AuthResponse> {
    return this.makeRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }) as Promise<AuthResponse>;
  }

  async resetPassword(token: string, password: string): Promise<AuthResponse> {
    return this.makeRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }) as Promise<AuthResponse>;
  }

  async clearCookies(): Promise<unknown> {
    try {
      return await this.makeRequest('/auth/clear-cookies', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to clear cookies:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
export default authService;
