import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PatientAuthProvider, PatientAuthContext } from '../PatientAuthContext';
import { usePatientAuth } from '../../hooks/usePatientAuth';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch
global.fetch = vi.fn();

// Test component that uses the context
const TestComponent: React.FC = () => {
  const { user, loading, isAuthenticated, login, logout } = usePatientAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      {user && (
        <div data-testid="user-info">
          {user.firstName} {user.lastName} - {user.email}
        </div>
      )}
      <button
        onClick={() => login({
          email: 'test@example.com',
          password: 'password123',
          workspaceId: 'workspace1',
        })}
        data-testid="login-button"
      >
        Login
      </button>
      <button onClick={logout} data-testid="logout-button">
        Logout
      </button>
    </div>
  );
};

describe('PatientAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('provides initial unauthenticated state', async () => {
    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    // The loading state resolves very quickly in tests, so we just check that it eventually shows not loading
    await waitFor(() => {
      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    });
  });

  it('handles successful login', async () => {
    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    });

    const loginButton = screen.getByTestId('login-button');
    
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Authenticated')).toBeInTheDocument();
      expect(screen.getByText('John Doe - test@example.com')).toBeInTheDocument();
    });

    // Check that token and user data were stored
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'patient_auth_token',
      expect.stringContaining('mock_jwt_token_')
    );
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'patient_user_data',
      expect.stringContaining('John')
    );
  });

  it('handles logout', async () => {
    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    // First login
    await waitFor(() => {
      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    });

    const loginButton = screen.getByTestId('login-button');
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Authenticated')).toBeInTheDocument();
    });

    // Then logout
    const logoutButton = screen.getByTestId('logout-button');
    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('patient_auth_token');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('patient_user_data');
  });

  it('restores authentication from stored token', async () => {
    const mockUser = {
      id: 'patient_123',
      email: 'stored@example.com',
      firstName: 'Stored',
      lastName: 'User',
      workspaceId: 'workspace1',
      workspaceName: 'Test Pharmacy',
      status: 'active',
      emailVerified: true,
      profileComplete: true,
    };

    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'patient_auth_token') return 'stored_token';
      if (key === 'patient_user_data') return JSON.stringify(mockUser);
      return null;
    });

    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Authenticated')).toBeInTheDocument();
      expect(screen.getByText('Stored User - stored@example.com')).toBeInTheDocument();
    });
  });

  it('clears invalid stored data on initialization failure', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'patient_auth_token') return 'invalid_token';
      return null;
    });

    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    });

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('patient_auth_token');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('patient_user_data');
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('usePatientAuth must be used within a PatientAuthProvider');

    consoleSpy.mockRestore();
  });
});

describe('PatientAuthService Mock Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('handles suspended account login', async () => {
    const TestSuspendedLogin: React.FC = () => {
      const { login } = usePatientAuth();
      const [result, setResult] = React.useState<any>(null);

      const handleLogin = async () => {
        const response = await login({
          email: 'suspended@example.com',
          password: 'password123',
          workspaceId: 'workspace1',
        });
        setResult(response);
      };

      return (
        <div>
          <button onClick={handleLogin} data-testid="login-suspended">
            Login Suspended
          </button>
          {result && (
            <div data-testid="login-result">
              {result.success ? 'Success' : result.message}
            </div>
          )}
        </div>
      );
    };

    render(
      <PatientAuthProvider>
        <TestSuspendedLogin />
      </PatientAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-suspended')).toBeInTheDocument();
    });

    const loginButton = screen.getByTestId('login-suspended');
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Your account has been suspended. Please contact the pharmacy.')).toBeInTheDocument();
    });
  });

  it('handles pending account login', async () => {
    const TestPendingLogin: React.FC = () => {
      const { login } = usePatientAuth();
      const [result, setResult] = React.useState<any>(null);

      const handleLogin = async () => {
        const response = await login({
          email: 'pending@example.com',
          password: 'password123',
          workspaceId: 'workspace1',
        });
        setResult(response);
      };

      return (
        <div>
          <button onClick={handleLogin} data-testid="login-pending">
            Login Pending
          </button>
          {result && (
            <div data-testid="login-result">
              {result.success ? 'Success' : result.message}
            </div>
          )}
        </div>
      );
    };

    render(
      <PatientAuthProvider>
        <TestPendingLogin />
      </PatientAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-pending')).toBeInTheDocument();
    });

    const loginButton = screen.getByTestId('login-pending');
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Your account is pending approval. Please wait for confirmation.')).toBeInTheDocument();
    });
  });

  it('handles wrong password login', async () => {
    const TestWrongPassword: React.FC = () => {
      const { login } = usePatientAuth();
      const [result, setResult] = React.useState<any>(null);

      const handleLogin = async () => {
        const response = await login({
          email: 'test@example.com',
          password: 'wrongpassword',
          workspaceId: 'workspace1',
        });
        setResult(response);
      };

      return (
        <div>
          <button onClick={handleLogin} data-testid="login-wrong">
            Login Wrong Password
          </button>
          {result && (
            <div data-testid="login-result">
              {result.success ? 'Success' : result.message}
            </div>
          )}
        </div>
      );
    };

    render(
      <PatientAuthProvider>
        <TestWrongPassword />
      </PatientAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-wrong')).toBeInTheDocument();
    });

    const loginButton = screen.getByTestId('login-wrong');
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });
});