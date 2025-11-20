import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import PatientNavigation from '../PatientNavigation';
import { usePatientAuth } from '../../../hooks/usePatientAuth';

// Mock the usePatientAuth hook
vi.mock('../../../hooks/usePatientAuth');
const mockUsePatientAuth = usePatientAuth as any;

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/patient-portal/workspace123' }),
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
  phone: '+234-801-234-5678',
  workspaceId: 'workspace123',
  workspaceName: 'Test Pharmacy',
  status: 'active' as const,
  emailVerified: true,
  profileComplete: true,
};

describe('PatientNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      mockUsePatientAuth.mockReturnValue({
        user: mockAuthenticatedUser,
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        verifyEmail: vi.fn(),
        forgotPassword: vi.fn(),
        resetPassword: vi.fn(),
        updateProfile: vi.fn(),
        refreshToken: vi.fn(),
        checkAuthStatus: vi.fn(),
      });
    });

    it('renders navigation for authenticated user', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Check if workspace name is displayed
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();

      // Check if user info is displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('displays all navigation items for authenticated user', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Check main navigation items
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('My Profile')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(screen.getByText('Health Records')).toBeInTheDocument();
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Appointments')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('Education')).toBeInTheDocument();
    });

    it('shows notification badge', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Check for notification badge on Messages
      const messagesBadge = screen.getByText('3');
      expect(messagesBadge).toBeInTheDocument();
    });

    it('opens and closes mobile drawer', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(max-width:899.95px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Find and click mobile menu button
      const menuButton = screen.getByLabelText('open drawer');
      fireEvent.click(menuButton);

      // Check if drawer content is visible
      expect(screen.getAllByText('Test Pharmacy')).toHaveLength(2); // One in AppBar, one in drawer
    });

    it('opens profile menu and handles logout', async () => {
      const mockLogout = vi.fn();
      mockUsePatientAuth.mockReturnValue({
        user: mockAuthenticatedUser,
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: mockLogout,
        verifyEmail: vi.fn(),
        forgotPassword: vi.fn(),
        resetPassword: vi.fn(),
        updateProfile: vi.fn(),
        refreshToken: vi.fn(),
        checkAuthStatus: vi.fn(),
      });

      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Click on profile avatar
      const profileButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(profileButton);

      // Check if profile menu items appear
      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      // Click logout
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      // Check if logout was called
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/patient-access');
    });

    it('opens notification menu', async () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Click on notifications button
      const notificationButton = screen.getByRole('button', { name: /view notifications/i });
      fireEvent.click(notificationButton);

      // Check if notification menu appears
      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument();
        expect(screen.getByText('Appointment Reminder')).toBeInTheDocument();
        expect(screen.getByText('Medication Refill Due')).toBeInTheDocument();
        expect(screen.getByText('New Message')).toBeInTheDocument();
        expect(screen.getByText('View All Notifications')).toBeInTheDocument();
      });
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      mockUsePatientAuth.mockReturnValue({
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
      });
    });

    it('renders navigation for unauthenticated user', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Check if generic title is displayed
      expect(screen.getByText('Patient Portal')).toBeInTheDocument();

      // Check if public navigation items are displayed
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Health Blog')).toBeInTheDocument();
    });

    it('shows login button for unauthenticated user', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Check for account icon button that links to login
      const accountButton = screen.getByRole('button');
      expect(accountButton).toBeInTheDocument();
    });

    it('does not show user-specific content', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Should not show authenticated user navigation items
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Medications')).not.toBeInTheDocument();
    });

    it('does not show notifications or profile menu', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Should not show notification or profile buttons
      expect(screen.queryByLabelText('view notifications')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('account')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockUsePatientAuth.mockReturnValue({
        user: null,
        loading: true,
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
      });
    });

    it('handles loading state gracefully', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Should still render the basic navigation structure
      expect(screen.getByText('Patient Portal')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUsePatientAuth.mockReturnValue({
        user: mockAuthenticatedUser,
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        verifyEmail: vi.fn(),
        forgotPassword: vi.fn(),
        resetPassword: vi.fn(),
        updateProfile: vi.fn(),
        refreshToken: vi.fn(),
        checkAuthStatus: vi.fn(),
      });
    });

    it('has proper ARIA labels', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Check for navigation landmark
      expect(screen.getByRole('navigation', { name: 'patient portal navigation' })).toBeInTheDocument();

      // Check for drawer button label
      expect(screen.getByLabelText('open drawer')).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // All navigation links should be focusable
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('href');
      });

      // All buttons should be focusable
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('disabled');
      });
    });

    it('provides tooltips for icon buttons', () => {
      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Check for tooltip titles
      expect(screen.getByRole('button', { name: /view notifications/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('adapts to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(max-width:899.95px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      mockUsePatientAuth.mockReturnValue({
        user: mockAuthenticatedUser,
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        verifyEmail: vi.fn(),
        forgotPassword: vi.fn(),
        resetPassword: vi.fn(),
        updateProfile: vi.fn(),
        refreshToken: vi.fn(),
        checkAuthStatus: vi.fn(),
      });

      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Mobile menu button should be visible
      expect(screen.getByLabelText('open drawer')).toBeInTheDocument();
    });
  });

  describe('Default Props', () => {
    it('requires authentication by default', () => {
      mockUsePatientAuth.mockReturnValue({
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
      });

      renderWithProviders(<PatientNavigation workspaceId="workspace123" />);

      // Should show public navigation for unauthenticated users
      expect(screen.getByText('Patient Portal')).toBeInTheDocument();
    });
  });
});