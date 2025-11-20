import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { PatientAuthProvider, PatientAuthContext } from '../../../contexts/PatientAuthContext';

// Mock the usePatientAuth hook
const mockAuthContext = {
  user: null,
  loading: false,
  isAuthenticated: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  verifyEmail: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  updateProfile: vi.fn(),
  refreshToken: vi.fn(),
  checkAuthStatus: vi.fn(),
};

const MockPatientAuthProvider: React.FC<{ 
  children: React.ReactNode;
  value?: Partial<typeof mockAuthContext>;
}> = ({ children, value = {} }) => {
  const contextValue = { ...mockAuthContext, ...value };
  
  // Compute isAuthenticated based on user and status
  if (contextValue.user && contextValue.user.status === 'active') {
    contextValue.isAuthenticated = true;
  } else {
    contextValue.isAuthenticated = false;
  }
  
  return (
    <PatientAuthContext.Provider value={contextValue}>
      {children}
    </PatientAuthContext.Provider>
  );
};

const TestComponent: React.FC = () => (
  <div data-testid="protected-content">Protected Content</div>
);

const renderWithRouter = (
  component: React.ReactElement,
  authValue: Partial<typeof mockAuthContext> = {}
) => {
  return render(
    <BrowserRouter>
      <MockPatientAuthProvider value={authValue}>
        <Routes>
          <Route path="/" element={component} />
          <Route path="/patient-portal/auth" element={<div>Login Page</div>} />
          <Route path="/patient-portal/verify-email" element={<div>Verify Email Page</div>} />
          <Route path="/patient-portal/complete-profile" element={<div>Complete Profile Page</div>} />
        </Routes>
      </MockPatientAuthProvider>
    </BrowserRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when authentication is loading', () => {
    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      { loading: true }
    );

    expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', async () => {
    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: false,
        user: null,
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders protected content when authenticated with active user', () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'active' as const,
      emailVerified: true,
      profileComplete: true,
    };

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: true,
        user: mockUser,
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('shows suspended account message for suspended users', () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'suspended' as const,
      emailVerified: true,
      profileComplete: true,
    };

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: false, // Suspended users are not considered authenticated
        user: mockUser,
      }
    );

    expect(screen.getByText('Account Suspended')).toBeInTheDocument();
    expect(screen.getByText('Your account has been suspended. Please contact Test Pharmacy for assistance.')).toBeInTheDocument();
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('shows pending approval message for pending users', () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'pending' as const,
      emailVerified: true,
      profileComplete: true,
    };

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: false, // Pending users are not considered authenticated
        user: mockUser,
      }
    );

    expect(screen.getByText('Account Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Your account is awaiting approval from Test Pharmacy. You\'ll receive an email once approved.')).toBeInTheDocument();
    expect(screen.getByText('Approval Pending')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to email verification when email is not verified and required', async () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'active' as const,
      emailVerified: false,
      profileComplete: true,
    };

    renderWithRouter(
      <ProtectedRoute requireEmailVerification={true}>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: true,
        user: mockUser,
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Verify Email Page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders content when email verification is not required', () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'active' as const,
      emailVerified: false,
      profileComplete: true,
    };

    renderWithRouter(
      <ProtectedRoute requireEmailVerification={false}>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: true,
        user: mockUser,
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('redirects to profile completion when profile is incomplete and required', async () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'active' as const,
      emailVerified: true,
      profileComplete: false,
    };

    renderWithRouter(
      <ProtectedRoute requireProfileComplete={true}>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: true,
        user: mockUser,
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Complete Profile Page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders content when profile completion is not required', () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'active' as const,
      emailVerified: true,
      profileComplete: false,
    };

    renderWithRouter(
      <ProtectedRoute requireProfileComplete={false}>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: true,
        user: mockUser,
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('handles all requirements together', () => {
    const mockUser = {
      id: 'patient_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'active' as const,
      emailVerified: true,
      profileComplete: true,
    };

    renderWithRouter(
      <ProtectedRoute requireEmailVerification={true} requireProfileComplete={true}>
        <TestComponent />
      </ProtectedRoute>,
      { 
        loading: false,
        isAuthenticated: true,
        user: mockUser,
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});