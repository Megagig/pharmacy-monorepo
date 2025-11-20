import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PatientPortalRoute from '../PatientPortalRoute';
import { usePatientAuth } from '../../../hooks/usePatientAuth';

// Mock the usePatientAuth hook
jest.mock('../../../hooks/usePatientAuth');
const mockUsePatientAuth = usePatientAuth as jest.MockedFunction<typeof usePatientAuth>;

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ workspaceId: 'workspace123' }),
}));

// Mock PatientNavigation component
jest.mock('../PatientNavigation', () => {
  return function MockPatientNavigation({ workspaceId }: { workspaceId?: string }) {
    return <div data-testid="patient-navigation">Navigation for {workspaceId}</div>;
  };
});

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

const mockAuthenticatedUser = {
  id: 'patient_123',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  workspaceId: 'workspace123',
  workspaceName: 'Test Pharmacy',
  status: 'active' as const,
  emailVerified: true,
  profileComplete: true,
};

const TestComponent = () => <div data-testid="test-content">Test Content</div>;

describe('PatientPortalRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner when authentication is loading', () => {
      mockUsePatientAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute>
          <TestComponent />
        </PatientPortalRoute>
      );

      expect(screen.getByText('Loading patient portal...')).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });
  });

  describe('Authentication Required', () => {
    it('redirects to authentication when not authenticated and auth is required', () => {
      mockUsePatientAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={true}>
          <TestComponent />
        </PatientPortalRoute>
      );

      // Should not render the test content
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });

    it('renders content when authentication is not required', () => {
      mockUsePatientAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={false}>
          <TestComponent />
        </PatientPortalRoute>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('patient-navigation')).toBeInTheDocument();
    });
  });

  describe('Authenticated User', () => {
    it('renders content for authenticated user with correct workspace', () => {
      mockUsePatientAuth.mockReturnValue({
        user: mockAuthenticatedUser,
        loading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={true}>
          <TestComponent />
        </PatientPortalRoute>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('patient-navigation')).toBeInTheDocument();
      expect(screen.getByText('Navigation for workspace123')).toBeInTheDocument();
    });

    it('shows access denied for wrong workspace', () => {
      const userWithDifferentWorkspace = {
        ...mockAuthenticatedUser,
        workspaceId: 'different-workspace',
      };

      mockUsePatientAuth.mockReturnValue({
        user: userWithDifferentWorkspace,
        loading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={true}>
          <TestComponent />
        </PatientPortalRoute>
      );

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText(/You don't have access to this workspace/)).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });
  });

  describe('Account Status', () => {
    it('shows pending approval message for pending accounts', () => {
      const pendingUser = {
        ...mockAuthenticatedUser,
        status: 'pending' as const,
      };

      mockUsePatientAuth.mockReturnValue({
        user: pendingUser,
        loading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={true}>
          <TestComponent />
        </PatientPortalRoute>
      );

      expect(screen.getByText('Account Pending Approval')).toBeInTheDocument();
      expect(screen.getByText(/Your account is pending approval/)).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });

    it('shows suspended account message for suspended accounts', () => {
      const suspendedUser = {
        ...mockAuthenticatedUser,
        status: 'suspended' as const,
      };

      mockUsePatientAuth.mockReturnValue({
        user: suspendedUser,
        loading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={true}>
          <TestComponent />
        </PatientPortalRoute>
      );

      expect(screen.getByText('Account Suspended')).toBeInTheDocument();
      expect(screen.getByText(/Your account has been suspended/)).toBeInTheDocument();
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders with proper layout structure', () => {
      mockUsePatientAuth.mockReturnValue({
        user: mockAuthenticatedUser,
        loading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={true}>
          <TestComponent />
        </PatientPortalRoute>
      );

      // Check that both navigation and content are rendered
      expect(screen.getByTestId('patient-navigation')).toBeInTheDocument();
      expect(screen.getByTestId('test-content')).toBeInTheDocument();

      // Check that the main content area has proper styling
      const mainContent = screen.getByRole('main');
      expect(mainContent).toBeInTheDocument();
    });

    it('passes workspace ID to navigation component', () => {
      mockUsePatientAuth.mockReturnValue({
        user: mockAuthenticatedUser,
        loading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute requiresAuth={true}>
          <TestComponent />
        </PatientPortalRoute>
      );

      expect(screen.getByText('Navigation for workspace123')).toBeInTheDocument();
    });
  });

  describe('Default Props', () => {
    it('requires authentication by default', () => {
      mockUsePatientAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        verifyEmail: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        updateProfile: jest.fn(),
        refreshToken: jest.fn(),
        checkAuthStatus: jest.fn(),
      });

      renderWithProviders(
        <PatientPortalRoute>
          <TestComponent />
        </PatientPortalRoute>
      );

      // Should not render content since auth is required by default
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });
  });
});